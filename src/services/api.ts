import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import {
  db,
  auth,
  ensureAuthReady,
  classifyFirestoreError,
  setFirestoreAccessIssue,
  commitChunkedSetDocs,
  commitChunkedDeleteDocs,
  cleanFirestoreData,
  handleFirestoreError,
  OperationType,
  withTimeout
} from "../lib/firebase";
import {
  DailyAttendance,
  DailyReportData,
  Dormitory,
  DormTeacher,
  Notice,
  Student,
  StudentAttendanceRecord,
  SystemSettings,
  UserProfile
} from "../types";
import { getTodayDateString, getYesterdayDateString, getPreviousDateString, getNextDateString, isGradeMatch, isRealAttendanceCheck, findNextSpecialStatus, isDormPresentStatus } from "../utils/dateUtils";
import { cleanBedValue, matchStudentToDorm, isDormMatch, isPlaceholderTeacherName } from "../utils/dormUtils";
import { formatStudentId, generateDefault5DigitStudentId, formatGrade } from "../utils/studentUtils";
import {
  hashPassword,
  verifyPassword,
  isValidPasswordStrength,
  sanitizeUserForClient,
  sanitizeSafeImageUrl,
  stripDangerousKeys
} from "../utils/security";

import { DEFAULT_ROLE_NAVIGATION_PERMISSIONS } from "../utils/permissionUtils";
import { DEFAULT_SYSTEM_USERS } from "../data/userProfiles";

// Default System Settings for Initial Setup
const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  schoolNameTh: "โรงเรียนพิจิตรปัญญานุกูล",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "พ.จ.ป.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "ระบบบริหารจัดการหอพักนักเรียน",
  systemNameEn: "Student Dormitory Management System",
  systemIcon: "building",
  lastUpdatedDate: "8 สิงหาคม พ.ศ. 2569",
  isAttendancePaused: false,
  pausedDormIds: [],
  attendancePauseReason: "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่",
  attendancePausedAt: "",
  attendancePausedBy: "",
  navigationPermissions: DEFAULT_ROLE_NAVIGATION_PERMISSIONS,
  guestRequiresLogin: false
};

// ----------------------------------------------------------------------
// LocalStorage Cache Manager Utilities
// ----------------------------------------------------------------------
export const CACHE_KEYS = {
  DORMS: "dorm_cache_dorms",
  STUDENTS: "dorm_cache_students",
  USERS: "dorm_cache_users",
  NOTICES: "dorm_cache_notices",
  ATTENDANCE: "dorm_cache_attendance_v2",
  SYSTEM_SETTINGS: "dorm_system_settings"
};

const AUTH_HASH_CACHE_KEY = "dorm_auth_hashes_v1";

export function getLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? stripDangerousKeys(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

function getAuthHashMap(): Record<string, string> {
  return getLocalCache<Record<string, string>>(AUTH_HASH_CACHE_KEY) || {};
}

function setAuthHashForUser(userId: string, passwordHash: string): void {
  const map = getAuthHashMap();
  map[userId] = passwordHash;
  setLocalCache(AUTH_HASH_CACHE_KEY, map);
}

export function setLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`LocalStorage write error for ${key}:`, e);
  }
}

// ----------------------------------------------------------------------
// Short-TTL & In-Flight Deduplicated Cloud Collection Read Cache
// ----------------------------------------------------------------------
const READ_DEDUPE_TTL_MS = 4000;
const inFlightCollectionReads = new Map<string, Promise<Array<{ id: string; data: Record<string, any> }>>>();
const recentCollectionReads = new Map<string, { timestamp: number; items: Array<{ id: string; data: Record<string, any> }> }>();

export function invalidateFirestoreReadCache(collectionName?: string): void {
  if (!collectionName) {
    recentCollectionReads.clear();
    inFlightCollectionReads.clear();
    return;
  }
  recentCollectionReads.delete(collectionName);
  inFlightCollectionReads.delete(collectionName);
}

async function readCollectionCached(
  collectionName: string,
  timeoutMs: number = 10000
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const cached = recentCollectionReads.get(collectionName);
  if (cached && Date.now() - cached.timestamp < READ_DEDUPE_TTL_MS) {
    return cached.items;
  }

  const existingPromise = inFlightCollectionReads.get(collectionName);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      await ensureAuthReady();
      const snap = await withTimeout(getDocs(collection(db, collectionName)), timeoutMs);
      const items = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
      recentCollectionReads.set(collectionName, { timestamp: Date.now(), items });
      if (collectionName !== "users") {
        setFirestoreAccessIssue(null);
      }
      return items;
    } catch (err) {
      classifyFirestoreError(err, collectionName, collectionName === "users");
      throw err;
    } finally {
      inFlightCollectionReads.delete(collectionName);
    }
  })();

  inFlightCollectionReads.set(collectionName, promise);
  return promise;
}

export function updateLocalCacheList<T extends { id: string }>(
  key: string,
  newItem: T,
  operation: "UPSERT" | "DELETE"
): T[] {
  if (key === CACHE_KEYS.DORMS) invalidateFirestoreReadCache("dorms");
  else if (key === CACHE_KEYS.STUDENTS) invalidateFirestoreReadCache("students");
  else if (key === CACHE_KEYS.USERS) invalidateFirestoreReadCache("users");
  else if (key === CACHE_KEYS.NOTICES) invalidateFirestoreReadCache("notices");
  else if (key === CACHE_KEYS.ATTENDANCE) invalidateFirestoreReadCache("attendance");

  const current = getLocalCache<T[]>(key) || [];
  let updated: T[];
  if (operation === "DELETE") {
    updated = current.filter((item) => item.id !== newItem.id);
  } else {
    const idx = current.findIndex((item) => item.id === newItem.id);
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...newItem };
    } else {
      updated = [newItem, ...current];
    }
  }
  setLocalCache(key, updated);
  return updated;
}

function mergeCloudWithUnsyncedLocal<T extends { id: string }>(
  cloudItems: T[],
  localItems: T[]
): T[] {
  if (!localItems || localItems.length === 0) return cloudItems;
  if (!cloudItems || cloudItems.length === 0) return localItems;
  const map = new Map<string, T>();
  localItems.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  cloudItems.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

// ----------------------------------------------------------------------
// Dormitories API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------
export async function fetchDorms(): Promise<Dormitory[]> {
  const localDorms = getLocalCache<Dormitory[]>(CACHE_KEYS.DORMS) || [];
  try {
    const docs = await readCollectionCached("dorms", 10000);
    if (docs.length > 0) {
      const cloudDorms = docs.map((d) => ({ id: d.id, ...d.data } as Dormitory));
      const merged = mergeCloudWithUnsyncedLocal(cloudDorms, localDorms);
      const sorted = merged.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      setLocalCache(CACHE_KEYS.DORMS, sorted);
      return sorted;
    }
    return localDorms;
  } catch (err: any) {
    console.warn("Primary database fetchDorms offline fallback:", err?.message || err);
    return localDorms;
  }
}

export async function addDorm(data: {
  name: string;
  type: "male" | "female" | "mixed";
  teacherName: string;
  teacherPhone: string;
  capacity: number;
  teachers?: DormTeacher[];
}) {
  const newId = `dorm-${Date.now()}`;
  const newDorm: Dormitory = { id: newId, ...data };
  try {
    await setDoc(doc(db, "dorms", newId), cleanFirestoreData(newDorm));
  } catch (e) {
    console.warn("Saved dorm offline locally:", e);
  }
  updateLocalCacheList(CACHE_KEYS.DORMS, newDorm, "UPSERT");
  return newDorm;
}

export async function updateDorm(
  id: string,
  data: Partial<Dormitory> & { assignedTeacherId?: string; teachers?: DormTeacher[] }
) {
  const docRef = doc(db, "dorms", id);
  let updatedData: any = { ...data, id };
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updatedData = { ...snap.data(), ...data };
    }
    await setDoc(docRef, cleanFirestoreData(updatedData), { merge: true });
  } catch (e) {
    console.warn("Updated dorm offline locally:", e);
  }
  updateLocalCacheList(CACHE_KEYS.DORMS, updatedData, "UPSERT");
  return updatedData as Dormitory;
}

export async function deleteDorm(id: string) {
  try {
    await deleteDoc(doc(db, "dorms", id));
  } catch (e) {
    console.warn("Deleted dorm offline locally:", e);
  }
  updateLocalCacheList(CACHE_KEYS.DORMS, { id } as any, "DELETE");
  return { success: true };
}

// ----------------------------------------------------------------------
// Students API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------
export async function fetchStudents(params?: {
  dormId?: string;
  grade?: string;
  room?: number;
}): Promise<Student[]> {
  const localStudents = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  try {
    const docs = await readCollectionCached("students", 10000);
    let students: Student[] = [];

    if (docs.length > 0) {
      const cloudStudents = docs.map((d) => {
        const raw = d.data;
        const bedVal = (raw.dormBed !== undefined && raw.dormBed !== null && String(raw.dormBed).trim() !== "")
          ? String(raw.dormBed).trim()
          : ((raw.bed !== undefined && raw.bed !== null) ? String(raw.bed).trim() : "");
        return {
          id: d.id,
          ...raw,
          studentId: formatStudentId(raw.studentId),
          grade: formatGrade(raw.grade),
          dormBed: bedVal,
          bed: bedVal
        } as Student;
      });
      students = mergeCloudWithUnsyncedLocal(cloudStudents, localStudents);
      setLocalCache(CACHE_KEYS.STUDENTS, students);
    } else {
      students = localStudents.map((s) => {
        const bedVal = (s.dormBed !== undefined && s.dormBed !== null && String(s.dormBed).trim() !== "")
          ? String(s.dormBed).trim()
          : ((s as any).bed !== undefined && (s as any).bed !== null ? String((s as any).bed).trim() : "");
        return {
          ...s,
          studentId: formatStudentId(s.studentId),
          grade: formatGrade(s.grade),
          dormBed: bedVal,
          bed: bedVal
        };
      });
    }

    if (params?.dormId) {
      students = students.filter((s) => s.dormId === params.dormId);
    }
    if (params?.grade) {
      students = students.filter((s) => isGradeMatch(s.grade, params.grade));
    }
    if (params?.room) {
      students = students.filter((s) => Number(s.room) === Number(params.room));
    }
    return students.sort((a, b) => (a.no || 0) - (b.no || 0));
  } catch (err: any) {
    console.warn("Primary database fetchStudents offline fallback:", err?.message || err);
    let students = localStudents.map((s) => {
      const bedVal = (s.dormBed !== undefined && s.dormBed !== null && String(s.dormBed).trim() !== "")
        ? String(s.dormBed).trim()
        : ((s as any).bed !== undefined && (s as any).bed !== null ? String((s as any).bed).trim() : "");
      return {
        ...s,
        studentId: formatStudentId(s.studentId),
        grade: formatGrade(s.grade),
        dormBed: bedVal,
        bed: bedVal
      };
    });
    if (params?.dormId) students = students.filter((s) => s.dormId === params.dormId);
    if (params?.grade) students = students.filter((s) => isGradeMatch(s.grade, params.grade));
    if (params?.room) students = students.filter((s) => Number(s.room) === Number(params.room));
    return students.sort((a, b) => (a.no || 0) - (b.no || 0));
  }
}

export async function importStudents(dormId: string, students: Partial<Student>[]) {
  const createdStudents: Student[] = [];

  students.forEach((s, idx) => {
    const targetDormId = s.dormId || dormId;
    const id = s.id || `std-${targetDormId}-${Date.now()}-${idx}`;
    const bedVal = (s.dormBed !== undefined && s.dormBed !== null)
      ? String(s.dormBed).trim()
      : ((s.bed !== undefined && s.bed !== null) ? String(s.bed).trim() : "");
    const formattedSid = formatStudentId(s.studentId) || generateDefault5DigitStudentId(idx + 1);
    const newStudent: Student = {
      id,
      studentId: formattedSid,
      no: s.no || idx + 1,
      title: s.title || "นาย",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      nickname: s.nickname || "",
      grade: formatGrade(s.grade),
      room: Number(s.room) || 1,
      dormId: targetDormId,
      dormRoom: s.dormRoom || "101",
      dormBed: bedVal,
      bed: bedVal,
      gender: (s.gender as any) || "male"
    };
    createdStudents.push(newStudent);
  });

  let count = 0;
  try {
    count = await commitChunkedSetDocs("students", createdStudents);
  } catch (e) {
    console.warn("Imported students offline locally:", e);
    count = createdStudents.length;
  }

  invalidateFirestoreReadCache("students");
  // Update local cache
  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const createdMap = new Map(createdStudents.map((s) => [s.id, s]));
  const merged = [...cached.filter((s) => !createdMap.has(s.id)), ...createdStudents];
  setLocalCache(CACHE_KEYS.STUDENTS, merged);

  return { success: true, count };
}

export async function addStudent(studentData: Partial<Student>): Promise<Student> {
  const id = studentData.id || `std-${Date.now()}`;
  const bedVal = (studentData.dormBed !== undefined && studentData.dormBed !== null)
    ? String(studentData.dormBed).trim()
    : ((studentData.bed !== undefined && studentData.bed !== null) ? String(studentData.bed).trim() : "");
  const formattedSid = formatStudentId(studentData.studentId) || generateDefault5DigitStudentId();
  const newStudent: Student = {
    id,
    studentId: formattedSid,
    no: studentData.no || 1,
    title: studentData.title || "นาย",
    firstName: studentData.firstName || "",
    lastName: studentData.lastName || "",
    nickname: studentData.nickname || "",
    grade: formatGrade(studentData.grade),
    room: Number(studentData.room) || 1,
    dormId: studentData.dormId || "dorm-1",
    dormRoom: studentData.dormRoom || "101",
    dormBed: bedVal,
    bed: bedVal,
    gender: studentData.gender || "male"
  };

  try {
    await setDoc(doc(db, "students", id), cleanFirestoreData(newStudent));
  } catch (e) {
    console.warn("Saved student offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.STUDENTS, newStudent, "UPSERT");
  return newStudent;
}

export async function updateStudent(id: string, studentData: Partial<Student>): Promise<Student> {
  const docRef = doc(db, "students", id);
  let updated: any = { ...studentData, id };
  if (studentData.studentId !== undefined) {
    updated.studentId = formatStudentId(studentData.studentId);
  }
  if (studentData.grade !== undefined) {
    updated.grade = formatGrade(studentData.grade);
  }
  if (studentData.dormBed !== undefined || (studentData as any).bed !== undefined) {
    const bedVal = (studentData.dormBed !== undefined && studentData.dormBed !== null)
      ? String(studentData.dormBed).trim()
      : ((studentData.bed !== undefined && studentData.bed !== null) ? String(studentData.bed).trim() : "");
    updated.dormBed = bedVal;
    updated.bed = bedVal;
  }
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updated = { ...snap.data(), ...updated };
    }
    await setDoc(docRef, cleanFirestoreData(updated), { merge: true });
  } catch (e) {
    console.warn("Updated student offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.STUDENTS, updated as Student, "UPSERT");
  return updated as Student;
}

export async function deleteStudent(id: string) {
  try {
    await deleteDoc(doc(db, "students", id));
  } catch (e) {
    console.warn("Deleted student offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.STUDENTS, { id } as any, "DELETE");
  return { success: true };
}

export async function batchDeleteStudents(ids: string[]) {
  try {
    await commitChunkedDeleteDocs("students", ids);
  } catch (e) {
    console.warn("Batch deleted students offline locally:", e);
  }

  invalidateFirestoreReadCache("students");
  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const idSet = new Set(ids);
  const remaining = cached.filter((s) => !idSet.has(s.id));
  setLocalCache(CACHE_KEYS.STUDENTS, remaining);

  return { success: true, count: ids.length };
}

export async function batchTransferStudentsDorm(
  studentIds: string[],
  targetDormId: string,
  targetDormRoom?: string
) {
  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const idSet = new Set(studentIds);
  const updatedStudents: Student[] = [];

  const updatedCache = cached.map((s) => {
    if (idSet.has(s.id)) {
      const updated: Student = {
        ...s,
        dormId: targetDormId,
        ...(targetDormRoom ? { dormRoom: targetDormRoom } : {})
      };
      updatedStudents.push(updated);
      return updated;
    }
    return s;
  });

  try {
    await commitChunkedSetDocs("students", updatedStudents);
  } catch (e) {
    console.warn("Batch transferred students offline locally:", e);
  }

  invalidateFirestoreReadCache("students");
  setLocalCache(CACHE_KEYS.STUDENTS, updatedCache);
  return { success: true, count: updatedStudents.length };
}

// ----------------------------------------------------------------------
// Users API (Central Cloud Database with Local Cache & PBKDF2 Credential Hashing)
// ----------------------------------------------------------------------
export async function fetchUsers(): Promise<UserProfile[]> {
  const localHashes = getAuthHashMap();
  const hydrateSafeUser = (u: any): UserProfile => {
    const hasHash = Boolean(u?.passwordHash || localHashes[u?.id] || u?.hasPassword);
    return sanitizeUserForClient({ ...u, hasPassword: hasHash });
  };

  try {
    const docs = await readCollectionCached("users", 10000);
    if (docs.length > 0) {
      // Cache password hashes strictly in internal hash store, never exposed in returned UserProfile objects
      docs.forEach((d) => {
        if (typeof d.data?.passwordHash === "string" && d.data.passwordHash.startsWith("pbkdf2_sha256$")) {
          setAuthHashForUser(d.id, d.data.passwordHash);
        }
      });
      const users = docs.map((d) => hydrateSafeUser({ id: d.id, ...d.data }));
      const sorted = users.sort((a, b) => (a.roleLevel || 3) - (b.roleLevel || 3));
      setLocalCache(CACHE_KEYS.USERS, sorted);
      return sorted;
    }
    const cached = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS);
    if (cached && cached.length > 0) return cached.map(hydrateSafeUser);
    const defaultSafe = DEFAULT_SYSTEM_USERS.map(hydrateSafeUser);
    setLocalCache(CACHE_KEYS.USERS, defaultSafe);
    return defaultSafe;
  } catch (err: any) {
    console.warn("fetchUsers offline fallback:", err?.message || err);
    const cached = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS);
    return (cached && cached.length > 0 ? cached : DEFAULT_SYSTEM_USERS).map(hydrateSafeUser);
  }
}

export async function verifyUserPasswordById(userId: string, enteredPassword: string): Promise<boolean> {
  if (!userId || !enteredPassword || !enteredPassword.trim()) return false;
  const hashMap = getAuthHashMap();
  let storedHash = hashMap[userId];

  if (!storedHash) {
    try {
      await ensureAuthReady();
      const snap = await withTimeout(getDoc(doc(db, "users", userId)), 6000);
      if (snap.exists()) {
        const data = snap.data() as Record<string, any>;
        if (typeof data.passwordHash === "string" && data.passwordHash.startsWith("pbkdf2_sha256$")) {
          storedHash = data.passwordHash;
          setAuthHashForUser(userId, storedHash);
        }
      }
    } catch (_) {}
  }

  return verifyPassword(enteredPassword, storedHash);
}

export async function verifyAuthorizedAdminOrStaffPassword(
  enteredPassword: string,
  currentUser: UserProfile | null,
  usersList?: UserProfile[]
): Promise<boolean> {
  if (!enteredPassword || !enteredPassword.trim()) return false;

  // Verify against current logged-in Admin/Staff first
  if (currentUser && (currentUser.roleLevel === 1 || currentUser.roleLevel === 2)) {
    if (await verifyUserPasswordById(currentUser.id, enteredPassword)) {
      return true;
    }
  }

  // Or verify against any Level 1 / Level 2 user who has a configured password hash
  const candidates = (usersList || (await fetchUsers())).filter(
    (u) => u.roleLevel === 1 || u.roleLevel === 2
  );
  for (const adminUser of candidates) {
    if (await verifyUserPasswordById(adminUser.id, enteredPassword)) {
      return true;
    }
  }

  return false;
}

export async function setupFirstTimePassword(userId: string, newPassword: string): Promise<UserProfile> {
  if (!isValidPasswordStrength(newPassword)) {
    throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  }

  const users = await fetchUsers();
  const targetUser = users.find((u) => u.id === userId) || DEFAULT_SYSTEM_USERS.find((u) => u.id === userId);
  if (!targetUser) {
    throw new Error("ไม่พบบัญชีผู้ใช้งานที่ระบุ");
  }

  const hashMap = getAuthHashMap();
  if (hashMap[userId] || targetUser.hasPassword) {
    throw new Error("บัญชีนี้ตั้งค่ารหัสผ่านไว้แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านเดิม");
  }

  const passwordHash = await hashPassword(newPassword);
  setAuthHashForUser(userId, passwordHash);

  const hashMapAfter = getAuthHashMap();
  const fullUserPayload = sanitizeUserForCloud({ ...targetUser, hasPassword: true, passwordHash }, hashMapAfter);
  try {
    await setDoc(doc(db, "users", userId), cleanFirestoreData(fullUserPayload));
  } catch (e) {
    console.warn("Saved initial password hash offline locally:", e);
  }

  const updatedSafe = sanitizeUserForClient({ ...targetUser, hasPassword: true });
  updateLocalCacheList(CACHE_KEYS.USERS, updatedSafe, "UPSERT");
  return updatedSafe;
}

export async function addUser(
  userData: Partial<UserProfile> & { password?: string }
): Promise<UserProfile> {
  const cleanInput = stripDangerousKeys(userData);
  const id = cleanInput.id || `user-${Date.now()}`;
  const rawPassword = typeof cleanInput.password === "string" ? cleanInput.password.trim() : "";

  if (rawPassword && !isValidPasswordStrength(rawPassword)) {
    throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  }

  const passwordHash = rawPassword ? await hashPassword(rawPassword) : undefined;
  if (passwordHash) {
    setAuthHashForUser(id, passwordHash);
  }

  const dbPayload: Record<string, any> = {
    ...cleanInput,
    id,
    name: (cleanInput.name || "ผู้ใช้งานใหม่").trim().slice(0, 120),
    role: cleanInput.role || "DORM_TEACHER",
    roleLevel: cleanInput.roleLevel || 3,
    roleCategory: cleanInput.roleCategory || "DORM_TEACHER",
    roleCategoryName: cleanInput.roleCategoryName || "ครูหอพัก",
    roleLabel: cleanInput.roleLabel || "ครูประจำหอพัก",
    avatarUrl:
      sanitizeSafeImageUrl(cleanInput.avatarUrl) ||
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    hasPassword: Boolean(passwordHash)
  };
  delete dbPayload.password;
  if (passwordHash) {
    dbPayload.passwordHash = passwordHash;
  }

  try {
    await setDoc(doc(db, "users", id), cleanFirestoreData(dbPayload));
  } catch (e) {
    console.warn("Saved user offline locally:", e);
  }

  const safeUser = sanitizeUserForClient(dbPayload);
  updateLocalCacheList(CACHE_KEYS.USERS, safeUser, "UPSERT");
  return safeUser;
}

export async function updateUser(
  id: string,
  userData: Partial<UserProfile> & { password?: string }
): Promise<UserProfile> {
  const cleanInput = stripDangerousKeys(userData);
  const docRef = doc(db, "users", id);
  const rawPassword = typeof cleanInput.password === "string" ? cleanInput.password.trim() : "";

  if (rawPassword && !isValidPasswordStrength(rawPassword)) {
    throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  }

  const dbUpdate: Record<string, any> = { ...cleanInput, id };
  delete dbUpdate.password;

  if (cleanInput.avatarUrl !== undefined) {
    dbUpdate.avatarUrl = sanitizeSafeImageUrl(cleanInput.avatarUrl) || cleanInput.avatarUrl;
  }

  if (rawPassword) {
    const newHash = await hashPassword(rawPassword);
    dbUpdate.passwordHash = newHash;
    dbUpdate.hasPassword = true;
    setAuthHashForUser(id, newHash);
  }

  let merged: any = dbUpdate;
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      merged = { ...snap.data(), ...dbUpdate };
      delete merged.password;
    }
    await setDoc(docRef, cleanFirestoreData(merged), { merge: true });
  } catch (e) {
    console.warn("Updated user offline locally:", e);
  }

  const safeUser = sanitizeUserForClient(merged);
  updateLocalCacheList(CACHE_KEYS.USERS, safeUser, "UPSERT");
  return safeUser;
}

export async function deleteUser(id: string) {
  try {
    await deleteDoc(doc(db, "users", id));
  } catch (e) {
    console.warn("Deleted user offline locally:", e);
  }

  const map = getAuthHashMap();
  if (map[id]) {
    delete map[id];
    setLocalCache(AUTH_HASH_CACHE_KEY, map);
  }

  updateLocalCacheList(CACHE_KEYS.USERS, { id } as any, "DELETE");
  return { success: true };
}

export async function changeUserPassword(
  id: string,
  payload: { oldPassword?: string; newPassword: string; isAdminOverride?: boolean }
) {
  if (!isValidPasswordStrength(payload.newPassword)) {
    throw new Error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  }

  const existingHash = getAuthHashMap()[id];
  if (!payload.isAdminOverride && existingHash) {
    if (!payload.oldPassword || !(await verifyUserPasswordById(id, payload.oldPassword))) {
      throw new Error("รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
    }
  }

  const passwordHash = await hashPassword(payload.newPassword);
  setAuthHashForUser(id, passwordHash);

  const cachedUsers = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
  const existingUser = cachedUsers.find((u) => u.id === id) || DEFAULT_SYSTEM_USERS.find((u) => u.id === id);
  const docRef = doc(db, "users", id);
  try {
    if (existingUser) {
      const fullPayload = sanitizeUserForCloud({ ...existingUser, hasPassword: true, passwordHash }, getAuthHashMap());
      await setDoc(docRef, cleanFirestoreData(fullPayload));
    } else {
      await setDoc(docRef, { passwordHash, hasPassword: true }, { merge: true });
    }
  } catch (e) {
    console.warn("Changed password offline locally:", e);
  }
  const idx = cachedUsers.findIndex((u) => u.id === id);
  if (idx >= 0) {
    cachedUsers[idx] = sanitizeUserForClient({ ...cachedUsers[idx], hasPassword: true });
    setLocalCache(CACHE_KEYS.USERS, cachedUsers);
  }

  return { success: true, message: "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว" };
}

// ----------------------------------------------------------------------
// Database Management API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------
export interface DeleteSampleDataOptions {
  target: "ALL" | "USERS" | "DORMS" | "STUDENTS" | "ATTENDANCE_NOTICES";
  keepAdminAccount?: boolean;
}

export async function deleteSampleData(options: DeleteSampleDataOptions = { target: "ALL" }) {
  const { target, keepAdminAccount } = options;
  const deletedCounts = {
    users: 0,
    dorms: 0,
    students: 0,
    attendance: 0,
    notices: 0
  };

  // 1. Delete Students
  if (target === "ALL" || target === "STUDENTS") {
    try {
      const snap = await getDocs(collection(db, "students"));
      const ids = snap.docs.map((d) => d.id);
      if (ids.length > 0) {
        deletedCounts.students = await commitChunkedDeleteDocs("students", ids);
      }
    } catch (e) {
      console.warn("Cleared students offline:", e);
    }
    setLocalCache(CACHE_KEYS.STUDENTS, []);
  }

  // 2. Delete Dorms
  if (target === "ALL" || target === "DORMS") {
    try {
      const snap = await getDocs(collection(db, "dorms"));
      const ids = snap.docs.map((d) => d.id);
      if (ids.length > 0) {
        deletedCounts.dorms = await commitChunkedDeleteDocs("dorms", ids);
      }
    } catch (e) {
      console.warn("Cleared dorms offline:", e);
    }
    setLocalCache(CACHE_KEYS.DORMS, []);
  }

  // 3. Delete Users
  if (target === "ALL" || target === "USERS") {
    try {
      const snap = await getDocs(collection(db, "users"));
      let docsToDelete = snap.docs;
      if (keepAdminAccount) {
        docsToDelete = docsToDelete.filter((d) => {
          const uData = d.data() as UserProfile;
          return uData.roleLevel !== 1 && uData.role !== "SYSTEM_ADMIN";
        });
      }
      const ids = docsToDelete.map((d) => d.id);
      if (ids.length > 0) {
        deletedCounts.users = await commitChunkedDeleteDocs("users", ids);
      }
    } catch (e) {
      console.warn("Cleared users offline:", e);
    }
    if (!keepAdminAccount) {
      setLocalCache(CACHE_KEYS.USERS, []);
    } else {
      const cached = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
      setLocalCache(CACHE_KEYS.USERS, cached.filter((u) => u.roleLevel === 1 || u.role === "SYSTEM_ADMIN"));
    }
  }

  // 4. Delete Attendance & Notices
  if (target === "ALL" || target === "ATTENDANCE_NOTICES") {
    try {
      const attSnap = await getDocs(collection(db, "attendance"));
      const attIds = attSnap.docs.map((d) => d.id);
      if (attIds.length > 0) {
        deletedCounts.attendance = await commitChunkedDeleteDocs("attendance", attIds);
      }
      const notSnap = await getDocs(collection(db, "notices"));
      const notIds = notSnap.docs.map((d) => d.id);
      if (notIds.length > 0) {
        deletedCounts.notices = await commitChunkedDeleteDocs("notices", notIds);
      }
    } catch (e) {
      console.warn("Cleared attendance & notices offline:", e);
    }
    setLocalCache(CACHE_KEYS.ATTENDANCE, []);
    setLocalCache(CACHE_KEYS.NOTICES, []);
  }

  invalidateFirestoreReadCache();
  const total = deletedCounts.students + deletedCounts.dorms + deletedCounts.users + deletedCounts.attendance + deletedCounts.notices;
  return {
    success: true,
    message: `ลบข้อมูลตัวอย่างเรียบร้อยแล้ว รวมทั้งหมด ${total} รายการ (นักเรียน: ${deletedCounts.students}, หอพัก: ${deletedCounts.dorms}, ผู้ใช้: ${deletedCounts.users}, เช็คยอด: ${deletedCounts.attendance}, เรื่องแจ้งอบรม: ${deletedCounts.notices})`,
    deletedCounts,
    total
  };
}

export async function clearDatabase() {
  const collections = ["dorms", "students", "users", "notices", "attendance"];
  let totalDeleted = 0;
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const ids = snap.docs.map((d) => d.id);
      if (ids.length > 0) {
        totalDeleted += await commitChunkedDeleteDocs(colName, ids);
      }
    } catch (e) {
      console.warn(`Could not clear ${colName} in primary database (offline):`, e);
    }
  }

  invalidateFirestoreReadCache();
  // Clear local caches
  setLocalCache(CACHE_KEYS.DORMS, []);
  setLocalCache(CACHE_KEYS.STUDENTS, []);
  setLocalCache(CACHE_KEYS.USERS, []);
  setLocalCache(CACHE_KEYS.NOTICES, []);
  setLocalCache(CACHE_KEYS.ATTENDANCE, []);

  return { success: true, message: `ล้างฐานข้อมูลเรียบร้อยแล้ว (${totalDeleted} รายการ)` };
}

export async function clearAttendanceDatabase(payload: {
  mode: "BY_DATE" | "BY_MONTH" | "BY_RANGE" | "ALL";
  date?: string;
  month?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  dormId?: string; // "ALL" or specific dormId
  clearNotices?: boolean; // also clear notices in the specified date/month/range
}) {
  const { mode, date, month, startDate, endDate, dormId, clearNotices } = payload;
  let deletedAttendanceCount = 0;
  let deletedNoticesCount = 0;

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "BY_DATE" && date) return itemDate === date;
    if (mode === "BY_MONTH" && month) return itemDate.startsWith(month);
    if (mode === "BY_RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  try {
    const snap = await getDocs(collection(db, "attendance"));
    const idsToDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      const matchDate = isMatchingDate(data.date);
      const matchDorm = !dormId || dormId === "ALL" || data.dormId === dormId;
      if (matchDate && matchDorm) {
        idsToDelete.push(d.id);
      }
    });

    if (idsToDelete.length > 0) {
      deletedAttendanceCount = await commitChunkedDeleteDocs("attendance", idsToDelete);
    }

    if (clearNotices) {
      const noticesSnap = await getDocs(collection(db, "notices"));
      const noticeIdsToDelete: string[] = [];
      noticesSnap.docs.forEach((d) => {
        const data = d.data();
        if (isMatchingDate(data.date)) {
          noticeIdsToDelete.push(d.id);
        }
      });
      if (noticeIdsToDelete.length > 0) {
        deletedNoticesCount = await commitChunkedDeleteDocs("notices", noticeIdsToDelete);
      }
    }
  } catch (e) {
    console.warn("Cleared attendance database offline locally:", e);
  }

  // Sync local cache for attendance
  const cachedAttendance = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  const filteredAttendance = cachedAttendance.filter((item) => {
    const matchDate = isMatchingDate(item.date);
    const matchDorm = !dormId || dormId === "ALL" || item.dormId === dormId;
    if (matchDate && matchDorm) {
      return false; // remove
    }
    return true;
  });
  setLocalCache(CACHE_KEYS.ATTENDANCE, filteredAttendance);

  // Sync local cache for notices if requested
  if (clearNotices) {
    const cachedNotices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
    const filteredNotices = cachedNotices.filter((n) => {
      if (isMatchingDate(n.date)) {
        return false;
      }
      return true;
    });
    setLocalCache(CACHE_KEYS.NOTICES, filteredNotices);
  }

  invalidateFirestoreReadCache("attendance");
  if (clearNotices) invalidateFirestoreReadCache("notices");
  return {
    success: true,
    message: `ล้างข้อมูลเช็คยอดเรียบร้อยแล้ว (${deletedAttendanceCount} รายการเช็คยอด${clearNotices ? `, ${deletedNoticesCount} เรื่องแจ้งอบรม` : ""})`,
    deletedAttendanceCount,
    deletedNoticesCount
  };
}

export async function exportAttendanceAndNoticesDatabase(payload: {
  mode: "DATE" | "MONTH" | "RANGE" | "ALL";
  date?: string;
  month?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  dormId?: string;
  includeNotices?: boolean;
}) {
  const { mode, date, month, startDate, endDate, dormId, includeNotices = true } = payload;

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  let allAttendance: DailyAttendance[] = [];
  let allNotices: Notice[] = [];

  try {
    const [attSnap, noticesSnap] = await Promise.all([
      getDocs(collection(db, "attendance")),
      includeNotices ? getDocs(collection(db, "notices")) : Promise.resolve(null)
    ]);

    allAttendance = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAttendance));
    if (noticesSnap) {
      allNotices = noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
    }
  } catch (err) {
    console.warn("Exporting attendance offline fallback:", err);
    allAttendance = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
    if (includeNotices) {
      allNotices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
    }
  }

  const filteredAttendance = allAttendance.filter((r) => {
    const matchDate = isMatchingDate(r.date);
    const matchDorm = !dormId || dormId === "ALL" || r.dormId === dormId;
    return matchDate && matchDorm;
  });

  const filteredNotices = includeNotices
    ? allNotices.filter((n) => isMatchingDate(n.date))
    : [];

  return {
    backupType: "ATTENDANCE_AND_NOTICES",
    mode,
    selectedDate: date || null,
    selectedMonth: month || null,
    startDate: startDate || null,
    endDate: endDate || null,
    dormId: dormId || "ALL",
    exportedAt: new Date().toISOString(),
    totalAttendance: filteredAttendance.length,
    totalNotices: filteredNotices.length,
    attendance: filteredAttendance,
    notices: filteredNotices,
    system: "Student Counting System"
  };
}

export async function restoreAttendanceAndNoticesDatabase(payload: {
  data: any;
  mode?: "ALL" | "DATE" | "MONTH" | "RANGE";
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  dormId?: string;
  restoreStrategy?: "UPSERT" | "REPLACE";
}) {
  const cleanPayload = stripDangerousKeys(payload);
  const { data, mode = "ALL", date, month, startDate, endDate, dormId, restoreStrategy = "UPSERT" } = cleanPayload;
  if (!data || typeof data !== "object") {
    throw new Error("รูปแบบข้อมูลสำรองไม่ถูกต้อง");
  }
  const rawAttendance: DailyAttendance[] = Array.isArray(data.attendance) ? data.attendance : [];
  const rawNotices: Notice[] = Array.isArray(data.notices) ? data.notices : [];

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  const attendanceToRestore = rawAttendance.filter((r) => {
    const matchDate = isMatchingDate(r.date);
    const matchDorm = !dormId || dormId === "ALL" || r.dormId === dormId;
    return matchDate && matchDorm;
  });

  const noticesToRestore = rawNotices.filter((n) => isMatchingDate(n.date));

  // If strategy is REPLACE, first delete existing records in target scope
  if (restoreStrategy === "REPLACE") {
    await clearAttendanceDatabase({
      mode: mode === "ALL" ? "ALL" : mode === "DATE" ? "BY_DATE" : mode === "MONTH" ? "BY_MONTH" : "BY_RANGE",
      date,
      month,
      startDate,
      endDate,
      dormId,
      clearNotices: noticesToRestore.length > 0
    });
  }

  let restoredAttendanceCount = 0;
  let restoredNoticesCount = 0;

  if (attendanceToRestore.length > 0) {
    try {
      restoredAttendanceCount = await commitChunkedSetDocs("attendance", attendanceToRestore);
    } catch (e) {
      console.warn("Restored attendance offline:", e);
    }

    // Merge into local cache
    const currentCached = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
    const map = new Map<string, DailyAttendance>();
    currentCached.forEach((item) => map.set(item.id || `${item.date}_${item.dormId}`, item));
    attendanceToRestore.forEach((item) => map.set(item.id || `${item.date}_${item.dormId}`, item));
    setLocalCache(CACHE_KEYS.ATTENDANCE, Array.from(map.values()));
  }

  if (noticesToRestore.length > 0) {
    try {
      restoredNoticesCount = await commitChunkedSetDocs("notices", noticesToRestore);
    } catch (e) {
      console.warn("Restored notices offline:", e);
    }

    // Merge into local cache
    const currentNotices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
    const noticeMap = new Map<string, Notice>();
    currentNotices.forEach((n) => noticeMap.set(n.id, n));
    noticesToRestore.forEach((n) => noticeMap.set(n.id, n));
    setLocalCache(CACHE_KEYS.NOTICES, Array.from(noticeMap.values()));
  }

  invalidateFirestoreReadCache("attendance");
  if (noticesToRestore.length > 0) invalidateFirestoreReadCache("notices");
  return {
    success: true,
    message: `กู้คืนข้อมูลสำเร็จ: เช็คยอด ${attendanceToRestore.length} รายการ, เรื่องแจ้งอบรม ${noticesToRestore.length} รายการ`,
    restoredAttendanceCount: attendanceToRestore.length,
    restoredNoticesCount: noticesToRestore.length
  };
}

export async function clearStudentsDatabase(payload: {
  mode: "BY_DORM" | "ALL";
  dormId?: string;
}) {
  try {
    const snap = await getDocs(collection(db, "students"));
    const idsToDelete: string[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (payload.mode === "ALL") {
        idsToDelete.push(d.id);
      } else if (payload.mode === "BY_DORM" && payload.dormId) {
        if (data.dormId === payload.dormId) {
          idsToDelete.push(d.id);
        }
      }
    });

    if (idsToDelete.length > 0) {
      await commitChunkedDeleteDocs("students", idsToDelete);
    }
  } catch (e) {
    console.warn("Cleared students database offline locally:", e);
  }

  // Sync local cache
  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const filtered = cached.filter((item) => {
    if (payload.mode === "ALL") return false;
    if (payload.mode === "BY_DORM" && payload.dormId && item.dormId === payload.dormId) return false;
    return true;
  });
  invalidateFirestoreReadCache("students");
  setLocalCache(CACHE_KEYS.STUDENTS, filtered);

  return { success: true, message: "ลบรายชื่อนักเรียนเรียบร้อยแล้ว" };
}

export async function exportDatabase() {
  try {
    const [dormsSnap, studentsSnap, usersSnap, noticesSnap, attSnap, sysSnap] = await Promise.all([
      getDocs(collection(db, "dorms")),
      getDocs(collection(db, "students")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "notices")),
      getDocs(collection(db, "attendance")),
      getDoc(doc(db, "system_settings", "config"))
    ]);

    const exportObj = {
      dorms: dormsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      students: studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      users: usersSnap.docs.map((d) => sanitizeUserForClient({ id: d.id, ...d.data() })),
      notices: noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      attendance: attSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      systemSettings: sysSnap.exists() ? sysSnap.data() : null,
      exportedAt: new Date().toISOString(),
      system: "Student Counting System"
    };

    // Update local cache with exported snapshot (never cache raw credentials)
    setLocalCache(CACHE_KEYS.DORMS, exportObj.dorms);
    setLocalCache(CACHE_KEYS.STUDENTS, exportObj.students);
    setLocalCache(CACHE_KEYS.USERS, exportObj.users);
    setLocalCache(CACHE_KEYS.NOTICES, exportObj.notices);
    setLocalCache(CACHE_KEYS.ATTENDANCE, exportObj.attendance);
    if (exportObj.systemSettings) {
      setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, exportObj.systemSettings);
    }

    return exportObj;
  } catch (err) {
    console.warn("Exporting database offline from local cache:", err);
    return {
      dorms: getLocalCache(CACHE_KEYS.DORMS) || [],
      students: getLocalCache(CACHE_KEYS.STUDENTS) || [],
      users: ((getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || []) as any[]).map(sanitizeUserForClient),
      notices: getLocalCache(CACHE_KEYS.NOTICES) || [],
      attendance: getLocalCache(CACHE_KEYS.ATTENDANCE) || [],
      systemSettings: getLocalCache(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS,
      exportedAt: new Date().toISOString(),
      system: "Student Counting System"
    };
  }
}

export async function restoreDatabase(rawData: any) {
  const data = stripDangerousKeys(rawData);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("รูปแบบไฟล์สำรองฐานข้อมูลไม่ถูกต้อง");
  }
  let restoredCount = 0;

  const rawDorms = Array.isArray(data.dorms)
    ? data.dorms
    : Array.isArray(data.dormitories)
    ? data.dormitories
    : [];
  if (rawDorms.length > 0) {
    const cleanDorms = rawDorms.map(sanitizeDormForCloud);
    setLocalCache(CACHE_KEYS.DORMS, cleanDorms);
    try {
      restoredCount += await commitChunkedSetDocs("dorms", cleanDorms, "id", false);
    } catch (e) { console.warn("Restored dorms offline:", e); }
  }
  if (Array.isArray(data.students) && data.students.length > 0) {
    const cleanStudents = data.students.map((s: any, idx: number) => sanitizeStudentForCloud(s, idx));
    setLocalCache(CACHE_KEYS.STUDENTS, cleanStudents);
    try {
      restoredCount += await commitChunkedSetDocs("students", cleanStudents, "id", false);
    } catch (e) { console.warn("Restored students offline:", e); }
  }
  if (Array.isArray(data.users) && data.users.length > 0) {
    const hashMap = getAuthHashMap();
    const cleanUsers = data.users.map((u: any) => sanitizeUserForCloud(u, hashMap));
    setLocalCache(CACHE_KEYS.USERS, cleanUsers.map(sanitizeUserForClient));
    try {
      restoredCount += await commitChunkedSetDocs("users", cleanUsers, "id", false);
    } catch (e) { console.warn("Restored users offline:", e); }
  }
  if (Array.isArray(data.notices) && data.notices.length > 0) {
    const cleanNotices = data.notices
      .map((n: any) => sanitizeNoticeForCloud(n))
      .filter((n: Notice | null): n is Notice => n !== null);
    setLocalCache(CACHE_KEYS.NOTICES, cleanNotices);
    try {
      restoredCount += await commitChunkedSetDocs("notices", cleanNotices, "id", false);
    } catch (e) { console.warn("Restored notices offline:", e); }
  }
  if (Array.isArray(data.attendance) && data.attendance.length > 0) {
    const cleanAttendance = data.attendance
      .map((a: any) => sanitizeAttendanceForCloud(a))
      .filter((a: DailyAttendance | null): a is DailyAttendance => a !== null);
    setLocalCache(CACHE_KEYS.ATTENDANCE, cleanAttendance);
    try {
      restoredCount += await commitChunkedSetDocs("attendance", cleanAttendance, "id", false);
    } catch (e) { console.warn("Restored attendance offline:", e); }
  }
  if (data.systemSettings && typeof data.systemSettings === "object") {
    const cleanSettings = sanitizeSettingsForCloud(data.systemSettings);
    setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, cleanSettings);
    try {
      await setDoc(doc(db, "system_settings", "config"), cleanFirestoreData(cleanSettings));
    } catch (e) { console.warn("Restored settings offline:", e); }
  }

  invalidateFirestoreReadCache();
  return { success: true, message: `กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว (${restoredCount} รายการ)` };
}

export async function syncLiveFirebaseDatabase() {
  try {
    await ensureAuthReady();

    const [dormsSnap, studentsSnap, noticesSnap, attSnap, sysSnap] = await Promise.all([
      withTimeout(getDocs(collection(db, "dorms")), 15000),
      withTimeout(getDocs(collection(db, "students")), 15000),
      withTimeout(getDocs(collection(db, "notices")), 15000),
      withTimeout(getDocs(collection(db, "attendance")), 15000),
      withTimeout(getDocFromServer(doc(db, "system_settings", "config")), 10000)
    ]);

    let users: UserProfile[] = [];
    try {
      const usersSnap = await withTimeout(getDocs(collection(db, "users")), 10000);
      users = usersSnap.docs.map((d) => sanitizeUserForClient({ id: d.id, ...d.data() }));
      setLocalCache(CACHE_KEYS.USERS, users);
    } catch (userErr) {
      // Non-admin Google accounts are restricted from listing /users
      users = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
    }

    const dorms = dormsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const notices = noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const attendance = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setLocalCache(CACHE_KEYS.DORMS, dorms);
    setLocalCache(CACHE_KEYS.STUDENTS, students);
    setLocalCache(CACHE_KEYS.NOTICES, notices);
    setLocalCache(CACHE_KEYS.ATTENDANCE, attendance);

    if (sysSnap.exists()) {
      setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, sysSnap.data());
    }

    invalidateFirestoreReadCache();
    setFirestoreAccessIssue(null);

    return {
      success: true,
      message: `ซิงค์ข้อมูลจากฐานข้อมูลกลางสำเร็จ: หอพัก ${dorms.length} แห่ง, นักเรียน ${students.length} คน, ผู้ใช้ ${users.length} บัญชี, บันทึกยอด ${attendance.length} รายการ`,
      counts: {
        dorms: dorms.length,
        students: students.length,
        users: users.length,
        notices: notices.length,
        attendance: attendance.length
      }
    };
  } catch (e: any) {
    console.warn("Sync live database failed:", e);
    classifyFirestoreError(e, "sync", false);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการซิงค์ข้อมูลจากฐานข้อมูลกลาง: ${e?.message || e}`,
      counts: {
        dorms: (getLocalCache<any[]>(CACHE_KEYS.DORMS) || []).length,
        students: (getLocalCache<any[]>(CACHE_KEYS.STUDENTS) || []).length,
        users: (getLocalCache<any[]>(CACHE_KEYS.USERS) || []).length,
        notices: (getLocalCache<any[]>(CACHE_KEYS.NOTICES) || []).length,
        attendance: (getLocalCache<any[]>(CACHE_KEYS.ATTENDANCE) || []).length
      }
    };
  }
}

export const initializeDefaultFirebaseDatabase = syncLiveFirebaseDatabase;

function sanitizeIdForRule(rawId: any, fallbackPrefix: string): string {
  const cleaned = String(rawId || "").trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
  if (cleaned.length > 0 && cleaned.length <= 128) return cleaned;
  return `${fallbackPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function sanitizeDormForCloud(d: any): Dormitory {
  const id = sanitizeIdForRule(d?.id, "dorm");
  const typeVal: "male" | "female" | "mixed" =
    d?.type === "female" || d?.type === "mixed" ? d.type : "male";
  const out: Dormitory = {
    id,
    name: String(d?.name || id).trim().slice(0, 120) || id,
    type: typeVal,
    teacherName: String(d?.teacherName || "").trim().slice(0, 160),
    teacherPhone: String(d?.teacherPhone || "").trim().slice(0, 40),
    capacity: Number.isFinite(Number(d?.capacity)) ? Math.max(0, Math.min(5000, Math.floor(Number(d.capacity)))) : 80
  };
  if (d?.gender === "male" || d?.gender === "female" || d?.gender === "mixed") {
    out.gender = d.gender;
  }
  if (Array.isArray(d?.teachers)) {
    out.teachers = d.teachers.slice(0, 30).map((t: any) => ({
      ...(t?.id ? { id: String(t.id).slice(0, 128) } : {}),
      name: String(t?.name || "").trim().slice(0, 120),
      ...(t?.phone ? { phone: String(t.phone).trim().slice(0, 40) } : {}),
      ...(t?.position ? { position: String(t.position).trim().slice(0, 80) } : {}),
      isHead: Boolean(t?.isHead)
    }));
  }
  if (d?.assignedTeacherId) {
    out.assignedTeacherId = String(d.assignedTeacherId).trim().slice(0, 128);
  }
  return out;
}

function sanitizeStudentForCloud(s: any, idx: number): Student {
  const id = sanitizeIdForRule(s?.id, "std");
  const sidRaw = formatStudentId(s?.studentId).replace(/\D/g, "");
  const studentId = sidRaw.length === 5 ? sidRaw : sidRaw.padStart(5, "0").slice(-5);
  const bedVal = (s?.dormBed !== undefined && s?.dormBed !== null && String(s.dormBed).trim() !== "")
    ? String(s.dormBed).trim().slice(0, 20)
    : ((s?.bed !== undefined && s?.bed !== null) ? String(s.bed).trim().slice(0, 20) : "");
  const out: Student = {
    id,
    studentId: /^[0-9]{5}$/.test(studentId) ? studentId : generateDefault5DigitStudentId(idx + 1),
    no: Number.isFinite(Number(s?.no)) ? Math.max(0, Math.min(2000, Math.floor(Number(s.no)))) : idx + 1,
    title: String(s?.title || "").trim().slice(0, 40),
    firstName: String(s?.firstName || "-").trim().slice(0, 100) || "-",
    lastName: String(s?.lastName || "-").trim().slice(0, 100) || "-",
    grade: formatGrade(s?.grade).slice(0, 20),
    room: Number.isFinite(Number(s?.room)) ? Math.max(0, Math.min(100, Math.floor(Number(s.room)))) : 1,
    dormId: sanitizeIdForRule(s?.dormId || "dorm-1", "dorm"),
    dormRoom: String(s?.dormRoom || "101").trim().slice(0, 40),
    gender: s?.gender === "female" ? "female" : "male"
  };
  if (s?.nickname) out.nickname = String(s.nickname).trim().slice(0, 60);
  if (bedVal) {
    out.dormBed = bedVal;
    out.bed = bedVal;
  }
  return out;
}

function sanitizeUserForCloud(u: any, hashMap: Record<string, string>): Record<string, any> {
  const id = sanitizeIdForRule(u?.id, "user");
  const allowedRoles = ["ADMIN_OFFICER", "HEAD_TEACHER", "DORM_TEACHER", "DEPUTY_DIRECTOR", "SYSTEM_ADMIN", "GUEST"];
  const role = allowedRoles.includes(u?.role) ? u.role : "DORM_TEACHER";
  const roleLevel = [1, 2, 3, 4].includes(Number(u?.roleLevel)) ? Number(u.roleLevel) : 3;
  const allowedCats = ["ADMIN", "STAFF", "DORM_TEACHER", "GUEST"];
  const roleCategory = allowedCats.includes(u?.roleCategory)
    ? u.roleCategory
    : roleLevel === 1 ? "ADMIN" : roleLevel === 2 ? "STAFF" : roleLevel === 4 ? "GUEST" : "DORM_TEACHER";

  const payload: Record<string, any> = {
    id,
    name: String(u?.name || id).trim().slice(0, 120) || id,
    role,
    roleLevel,
    roleCategory,
    hasPassword: Boolean(u?.hasPassword || hashMap[id] || u?.passwordHash)
  };
  if (u?.roleCategoryName) payload.roleCategoryName = String(u.roleCategoryName).trim().slice(0, 80);
  if (u?.roleLabel) payload.roleLabel = String(u.roleLabel).trim().slice(0, 160);
  if (u?.phone) payload.phone = String(u.phone).trim().slice(0, 40);
  if (u?.dormId) payload.dormId = String(u.dormId).trim().slice(0, 128);
  if (u?.dormPosition) payload.dormPosition = String(u.dormPosition).trim().slice(0, 80);
  if (Array.isArray(u?.allowedDormIds)) {
    payload.allowedDormIds = u.allowedDormIds
      .filter((x: any) => typeof x === "string" && x.trim().length > 0)
      .slice(0, 20);
  }
  if (typeof u?.avatarUrl === "string" && u.avatarUrl.trim().length > 0 && u.avatarUrl.length <= 32768) {
    payload.avatarUrl = u.avatarUrl;
  }
  const hashCandidate =
    (typeof u?.passwordHash === "string" && u.passwordHash.startsWith("pbkdf2_sha256$") && u.passwordHash.length <= 512)
      ? u.passwordHash
      : (typeof hashMap[id] === "string" && hashMap[id].startsWith("pbkdf2_sha256$") && hashMap[id].length <= 512
          ? hashMap[id]
          : undefined);
  if (hashCandidate) {
    payload.passwordHash = hashCandidate;
    payload.hasPassword = true;
  }
  return payload;
}

function sanitizeNoticeForCloud(n: any): Notice | null {
  const dateStr = String(n?.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const title = String(n?.title || "").trim().slice(0, 300);
  if (!title) return null;
  const id = sanitizeIdForRule(n?.id, "notice");
  const out: Notice = {
    id,
    date: dateStr,
    title,
    topics: Array.isArray(n?.topics)
      ? n.topics.filter((t: any) => typeof t === "string").map((t: string) => t.trim()).filter(Boolean).slice(0, 30)
      : [],
    createdBy: String(n?.createdBy || "เจ้าหน้าที่").trim().slice(0, 120),
    createdAt: String(n?.createdAt || new Date().toISOString()).trim().slice(0, 64)
  };
  return out;
}

function sanitizeAttendanceForCloud(r: any): DailyAttendance | null {
  const dateStr = String(r?.date || "").trim();
  const dormId = sanitizeIdForRule(r?.dormId, "dorm");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !dormId) return null;
  const rawId = String(r?.id || `${dateStr}_${dormId}`).trim();
  const id = /^[a-zA-Z0-9_\-]+$/.test(rawId) && rawId.length <= 128
    ? rawId
    : sanitizeIdForRule(`${dateStr}_${dormId}`, "att");
  const allowedStatus = ["CHECKED", "HOME_BREAK", "SEMESTER_BREAK", "PENDING"];
  const status: DailyAttendance["status"] = allowedStatus.includes(r?.status) ? r.status : "CHECKED";
  const records: StudentAttendanceRecord[] = Array.isArray(r?.records)
    ? r.records.slice(0, 500).map((rec: any) => ({
        studentId: formatStudentId(rec?.studentId),
        ...(rec?.studentName ? { studentName: String(rec.studentName).trim().slice(0, 140) } : {}),
        status: rec?.status || "PRESENT",
        ...(rec?.reason ? { reason: String(rec.reason).trim().slice(0, 300) } : {}),
        ...(rec?.note ? { note: String(rec.note).trim().slice(0, 300) } : {})
      }))
    : [];

  const out: DailyAttendance = {
    id,
    date: dateStr,
    dormId,
    isHomeBreak: Boolean(r?.isHomeBreak),
    status,
    teacherOrientationNotes: Array.isArray(r?.teacherOrientationNotes)
      ? r.teacherOrientationNotes
          .filter((n: any) => typeof n === "string")
          .map((n: string) => n.trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 30)
      : [],
    records
  };
  if (r?.checkedAt) out.checkedAt = String(r.checkedAt).trim().slice(0, 64);
  if (r?.checkedBy) out.checkedBy = String(r.checkedBy).trim().slice(0, 120);
  return out;
}

function sanitizeSettingsForCloud(s: any): SystemSettings {
  const src = { ...DEFAULT_SYSTEM_SETTINGS, ...(s || {}) };
  const allowedKeys = [
    "schoolNameTh", "schoolNameEn", "schoolAcronymTh", "schoolAcronymEn",
    "schoolLogoUrl", "systemNameTh", "systemNameEn", "systemTitleTh", "systemTitleEn",
    "systemIcon", "lastUpdatedDate", "maintenanceTitle", "maintenanceMessage",
    "showMaintenancePopup", "showMaintenanceBox", "isAttendancePaused", "pausedDormIds",
    "attendancePauseReason", "attendancePausedAt", "attendancePausedBy",
    "navigationPermissions", "guestRequiresLogin"
  ] as const;
  const out: Record<string, any> = {};
  for (const key of allowedKeys) {
    const val = (src as any)[key];
    if (val !== undefined && val !== null) {
      out[key] = val;
    }
  }
  if (typeof out.schoolNameTh === "string") out.schoolNameTh = out.schoolNameTh.slice(0, 200);
  if (typeof out.schoolNameEn === "string") out.schoolNameEn = out.schoolNameEn.slice(0, 200);
  if (typeof out.schoolAcronymTh === "string") out.schoolAcronymTh = out.schoolAcronymTh.slice(0, 40);
  if (typeof out.schoolAcronymEn === "string") out.schoolAcronymEn = out.schoolAcronymEn.slice(0, 40);
  if (typeof out.schoolLogoUrl === "string") out.schoolLogoUrl = out.schoolLogoUrl.slice(0, 65536);
  if (typeof out.systemNameTh === "string") out.systemNameTh = out.systemNameTh.slice(0, 200);
  if (typeof out.systemNameEn === "string") out.systemNameEn = out.systemNameEn.slice(0, 200);
  if (typeof out.systemTitleTh === "string") out.systemTitleTh = out.systemTitleTh.slice(0, 200);
  if (typeof out.systemTitleEn === "string") out.systemTitleEn = out.systemTitleEn.slice(0, 200);
  if (typeof out.systemIcon === "string") out.systemIcon = out.systemIcon.slice(0, 40);
  if (typeof out.lastUpdatedDate === "string") out.lastUpdatedDate = out.lastUpdatedDate.slice(0, 80);
  if (typeof out.maintenanceTitle === "string") out.maintenanceTitle = out.maintenanceTitle.slice(0, 200);
  if (typeof out.maintenanceMessage === "string") out.maintenanceMessage = out.maintenanceMessage.slice(0, 1000);
  if (typeof out.attendancePauseReason === "string") out.attendancePauseReason = out.attendancePauseReason.slice(0, 300);
  if (typeof out.attendancePausedAt === "string") out.attendancePausedAt = out.attendancePausedAt.slice(0, 64);
  if (typeof out.attendancePausedBy === "string") out.attendancePausedBy = out.attendancePausedBy.slice(0, 120);
  if (Array.isArray(out.pausedDormIds)) {
    out.pausedDormIds = out.pausedDormIds.filter((x: any) => typeof x === "string").slice(0, 50);
  }
  return out as SystemSettings;
}

export interface DisplayedDatabaseSnapshot {
  dorms: Dormitory[];
  students: Student[];
  users: UserProfile[];
  notices: Notice[];
  attendance: DailyAttendance[];
  systemSettings: SystemSettings;
}

export function getDisplayedDatabaseSnapshot(liveData?: {
  dorms?: Dormitory[];
  students?: Student[];
  users?: UserProfile[];
  notices?: Notice[];
  attendance?: DailyAttendance[];
  systemSettings?: SystemSettings;
}): DisplayedDatabaseSnapshot {
  const cachedDorms = getLocalCache<Dormitory[]>(CACHE_KEYS.DORMS) || [];
  const cachedStudents = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const cachedUsers = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
  const cachedNotices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
  const cachedAttendance = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  const cachedSettings = getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;

  const dorms = mergeCloudWithUnsyncedLocal(liveData?.dorms || [], cachedDorms);
  const students = mergeCloudWithUnsyncedLocal(liveData?.students || [], cachedStudents);
  const users = mergeCloudWithUnsyncedLocal(
    liveData?.users || [],
    cachedUsers.length > 0 ? cachedUsers : DEFAULT_SYSTEM_USERS
  );
  const notices = mergeCloudWithUnsyncedLocal(liveData?.notices || [], cachedNotices);
  const attendance = mergeCloudWithUnsyncedLocal(liveData?.attendance || [], cachedAttendance);
  const systemSettings = sanitizeSettingsForCloud(liveData?.systemSettings || cachedSettings);

  return { dorms, students, users, notices, attendance, systemSettings };
}

export async function uploadCurrentDisplayedDatabaseToCloud(liveData?: {
  dorms?: Dormitory[];
  students?: Student[];
  users?: UserProfile[];
  notices?: Notice[];
  attendance?: DailyAttendance[];
  systemSettings?: SystemSettings;
}): Promise<{
  success: boolean;
  message: string;
  uploadedCounts: {
    dorms: number;
    students: number;
    users: number;
    notices: number;
    attendance: number;
    attendanceDates: number;
  };
  verifiedCloudCounts: {
    dorms: number;
    students: number;
    users: number;
    notices: number;
    attendance: number;
  };
}> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    throw new Error("AUTH_REQUIRED: กรุณายืนยันตัวตนด้วยบัญชี Google (domitory@pcccr.ac.th) ก่อนอัพโหลดข้อมูลลงฐานข้อมูล");
  }

  const snapshot = getDisplayedDatabaseSnapshot(liveData);
  const hashMap = { ...getAuthHashMap() };

  // Preserve any existing passwordHash stored on Firestore user docs before full-doc overwrite
  try {
    const existingUsersSnap = await getDocs(collection(db, "users"));
    existingUsersSnap.docs.forEach((d) => {
      const data = d.data();
      if (!hashMap[d.id] && typeof data?.passwordHash === "string" && data.passwordHash.startsWith("pbkdf2_sha256$")) {
        hashMap[d.id] = data.passwordHash;
      }
    });
  } catch (_) {}

  const dormsMap = new Map<string, Dormitory>();
  snapshot.dorms.forEach((d) => {
    const clean = sanitizeDormForCloud(d);
    dormsMap.set(clean.id, clean);
  });

  const studentsToUpload = snapshot.students.map((s, idx) => sanitizeStudentForCloud(s, idx));
  const noticesToUpload = snapshot.notices
    .map((n) => sanitizeNoticeForCloud(n))
    .filter((n): n is Notice => n !== null);
  const attendanceToUpload = snapshot.attendance
    .map((a) => sanitizeAttendanceForCloud(a))
    .filter((a): a is DailyAttendance => a !== null);

  // Ensure every dormId referenced by students or attendance exists in dormsToUpload
  // so Firestore rules `exists(/dorms/$(dormId))` checks always succeed
  studentsToUpload.forEach((s) => {
    if (!dormsMap.has(s.dormId)) {
      dormsMap.set(s.dormId, sanitizeDormForCloud({ id: s.dormId, name: s.dormId, type: "male" }));
    }
  });
  attendanceToUpload.forEach((a) => {
    if (!dormsMap.has(a.dormId)) {
      dormsMap.set(a.dormId, sanitizeDormForCloud({ id: a.dormId, name: a.dormId, type: "male" }));
    }
  });

  const dormsToUpload = Array.from(dormsMap.values());
  const usersToUpload = snapshot.users.map((u) => sanitizeUserForCloud(u, hashMap));
  const settingsToUpload = sanitizeSettingsForCloud(snapshot.systemSettings);

  // Use merge=false so stale legacy fields (e.g. old password, null, or unallowed keys) are cleanly replaced
  // 1. Upload dorms FIRST (required by student and attendance exists() rules)
  const dormCount = await commitChunkedSetDocs("dorms", dormsToUpload, "id", false);
  // 2. Upload users
  const userCount = await commitChunkedSetDocs("users", usersToUpload, "id", false);
  // 3. Upload students
  const studentCount = await commitChunkedSetDocs("students", studentsToUpload, "id", false);
  // 4. Upload notices
  const noticeCount = await commitChunkedSetDocs("notices", noticesToUpload, "id", false);
  // 5. Upload attendance records (highlight!)
  const attendanceCount = await commitChunkedSetDocs("attendance", attendanceToUpload, "id", false);
  // 6. Upload system settings & saved marker
  try {
    await setDoc(doc(db, "system_settings", "config"), cleanFirestoreData(settingsToUpload));
    await setDoc(doc(db, "_system_status", "saved"), {
      lastSavedAt: new Date().toISOString(),
      status: "SAVED"
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "system_settings/config", true);
  }

  // Update local cache with sanitized dataset
  setLocalCache(CACHE_KEYS.DORMS, dormsToUpload);
  setLocalCache(CACHE_KEYS.STUDENTS, studentsToUpload);
  setLocalCache(CACHE_KEYS.USERS, usersToUpload.map(sanitizeUserForClient));
  setLocalCache(CACHE_KEYS.NOTICES, noticesToUpload);
  setLocalCache(CACHE_KEYS.ATTENDANCE, attendanceToUpload);
  setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, settingsToUpload);
  invalidateFirestoreReadCache();

  // Verify live cloud counts directly from Firestore
  let verifiedCloudCounts = {
    dorms: dormCount,
    students: studentCount,
    users: userCount,
    notices: noticeCount,
    attendance: attendanceCount
  };
  try {
    const [dSnap, sSnap, uSnap, nSnap, aSnap] = await Promise.all([
      getDocs(collection(db, "dorms")),
      getDocs(collection(db, "students")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "notices")),
      getDocs(collection(db, "attendance"))
    ]);
    verifiedCloudCounts = {
      dorms: dSnap.size,
      students: sSnap.size,
      users: uSnap.size,
      notices: nSnap.size,
      attendance: aSnap.size
    };
  } catch (err) {
    console.warn("Verification count read warning:", err);
  }

  const attendanceDates = new Set(attendanceToUpload.map((a) => a.date)).size;

  return {
    success: true,
    message: `อัพโหลดฐานข้อมูลชุดที่แสดงอยู่ตอนนี้ลง Firestore สำเร็จ! (เช็คยอดนักเรียน ${attendanceCount} รายการ / ${attendanceDates} วัน, นักเรียน ${studentCount} คน, หอพัก ${dormCount} แห่ง, เรื่องแจ้งอบรม ${noticeCount} เรื่อง, ผู้ใช้ ${userCount} บัญชี)`,
    uploadedCounts: {
      dorms: dormCount,
      students: studentCount,
      users: userCount,
      notices: noticeCount,
      attendance: attendanceCount,
      attendanceDates
    },
    verifiedCloudCounts
  };
}

export async function savePrimaryDatabase() {
  try {
    await setDoc(doc(db, "_system_status", "saved"), {
      lastSavedAt: new Date().toISOString(),
      status: "SAVED"
    }, { merge: true });
  } catch (e) {
    console.warn("Touch primary database saved marker offline:", e);
  }
  return { success: true, message: "บันทึกข้อมูลหลักสำเร็จ" };
}

// ----------------------------------------------------------------------
// Notices API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------
export async function fetchNotices(date?: string): Promise<Notice[]> {
  const localNotices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
  try {
    const docs = await readCollectionCached("notices", 10000);
    if (docs.length > 0) {
      const cloudNotices = docs.map((d) => ({ id: d.id, ...d.data } as Notice));
      let notices = mergeCloudWithUnsyncedLocal(cloudNotices, localNotices);
      setLocalCache(CACHE_KEYS.NOTICES, notices);
      if (date) notices = notices.filter((n) => n.date === date);
      return notices.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
  } catch (err: any) {
    console.warn("Primary database fetchNotices offline fallback:", err?.message || err);
  }

  let notices = localNotices;
  if (date) notices = notices.filter((n) => n.date === date);
  return notices.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function postNotice(noticeData: {
  date: string;
  title: string;
  topics: string[];
  createdBy: string;
}) {
  const id = `notice-${Date.now()}`;
  const newNotice: Notice = {
    id,
    ...noticeData,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "notices", id), cleanFirestoreData(newNotice));
  } catch (e) {
    console.warn("Posted notice offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.NOTICES, newNotice, "UPSERT");
  return newNotice;
}

export async function updateNotice(noticeData: Notice) {
  try {
    await setDoc(doc(db, "notices", noticeData.id), cleanFirestoreData(noticeData), { merge: true });
  } catch (e) {
    console.warn("Updated notice offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.NOTICES, noticeData, "UPSERT");
  return noticeData;
}

export async function deleteNotice(id: string) {
  try {
    await deleteDoc(doc(db, "notices", id));
  } catch (e) {
    console.warn("Deleted notice offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.NOTICES, { id } as any, "DELETE");
  return { success: true };
}

// ----------------------------------------------------------------------
// Attendance API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------

/**
 * Auto-propagate SEMESTER_BREAK attendance:
 * "เมื่อมีสถานะการเช็คยอด ปิดภาคเรียน ให้ในวันถัดไป ให้ระบบทำการเช็คยอด ปิดภาคเรียน อัตโนมัติจนกว่าจะมีการเปลี่ยนสถานะการเช็คยอด"
 * 
 * If a dormitory has a checked attendance where students were marked as SEMESTER_BREAK (ปิดภาคเรียน),
 * the next day(s) up to targetDate (default today) are automatically checked as SEMESTER_BREAK,
 * UNTIL an attendance status on a subsequent date is modified by the user (or changed away from SEMESTER_BREAK).
 */
/**
 * Detect whether an attendance record has an active break status:
 * - "SEMESTER_BREAK" (ปิดภาคเรียน)
 * - null (Normal attendance / other)
 * Note: HOME_BREAK (รอบกลับบ้าน) does not auto-propagate across dates.
 */
export function getAttendanceBreakType(
  rec: DailyAttendance | null | undefined
): "SEMESTER_BREAK" | null {
  if (!rec) return null;

  // 1. SEMESTER_BREAK:
  // Must be explicitly marked as SEMESTER_BREAK at dorm-level, OR every single student in the dorm
  // must have SEMESTER_BREAK. If only some students are on break, that is normal attendance (CHECKED),
  // not a dorm-wide semester break.
  if (rec.status === "SEMESTER_BREAK") return "SEMESTER_BREAK";
  if (
    rec.records &&
    rec.records.length > 0 &&
    rec.records.every((r) => r.status === "SEMESTER_BREAK" || r.reason === "ปิดภาคเรียน")
  ) {
    return "SEMESTER_BREAK";
  }

  return null;
}

export interface BatchSetAttendanceDateRangePayload {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional for PRESENT: auto-resolved until next special status)
  dormIds: string[] | "ALL"; // specific dorm ids or "ALL"
  status: "HOME_BREAK" | "SEMESTER_BREAK" | "PRESENT" | "CLEAR";
  orientationNotes?: string[];
  operatorName?: string;
  dorms: Dormitory[];
  students: Student[];
  stopAtSpecialStatus?: boolean;
}

/**
 * กำหนดสถานะเช็คยอดตามช่วงวันที่ โดยเจ้าหน้าที่/ผู้ดูแลระบบเป็นผู้ระบุเอง (Manual Date-Range Batch Attendance Check)
 * - รอบกลับบ้าน: ให้เลือกช่วงวันที่ดำเนินการ (วันที่เริ่มต้น - สิ้นสุด)
 * - ปิดภาคเรียน: ให้เลือกช่วงวันที่ดำเนินการ (วันที่เริ่มต้น - สิ้นสุด)
 * - เช็คยอดตามปกติ: ไม่ต้องเลือกช่วงวันที่ดำเนินการ (วันที่เริ่มต้น - สิ้นสุด) แต่ให้เช็คยอดไปจนถึงวันที่มีการตั้งสถานะพิเศษ รอบกลับบ้าน และ ปิดภาคเรียน
 */
export async function batchSetAttendanceDateRange(
  payload: BatchSetAttendanceDateRangePayload
): Promise<{
  success: boolean;
  affectedDatesCount: number;
  affectedRecordsCount: number;
  message: string;
}> {
  const { startDate, dormIds, status, orientationNotes, operatorName, dorms, students, stopAtSpecialStatus } = payload;
  let effectiveEndDate = payload.endDate;

  if (!startDate) {
    throw new Error("กรุณาระบุวันที่เริ่มต้นให้ถูกต้อง");
  }

  // Load cached attendance to inspect existing special statuses
  const cachedAttendance = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];

  // For PRESENT status: if no endDate is provided, auto-calculate up to the next special status!
  if (status === "PRESENT" && (!effectiveEndDate || effectiveEndDate < startDate)) {
    const nextSpecial = findNextSpecialStatus(startDate, cachedAttendance, dormIds);
    if (nextSpecial && nextSpecial.date > startDate) {
      effectiveEndDate = nextSpecial.stopDate;
    } else if (nextSpecial && nextSpecial.date === startDate) {
      throw new Error(`วันที่ ${startDate} มีการกำหนดสถานะพิเศษ (${nextSpecial.typeLabel}) อยู่แล้ว ไม่สามารถเช็คยอดตามปกติในวันที่มีสถานะพิเศษได้`);
    } else {
      // If no upcoming special status is found, default to 7 days ahead or same date
      let curr = startDate;
      for (let i = 1; i < 7; i++) {
        curr = getNextDateString(curr);
      }
      effectiveEndDate = curr;
    }
  }

  if (!effectiveEndDate || startDate > effectiveEndDate) {
    throw new Error("ช่วงวันที่ไม่ถูกต้อง วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น");
  }

  // Generate date list from startDate to effectiveEndDate
  const dateList: string[] = [];
  let curr = startDate;
  let safety = 0;
  while (curr <= effectiveEndDate && safety < 180) {
    dateList.push(curr);
    curr = getNextDateString(curr);
    safety++;
  }

  const targetDorms = (dormIds === "ALL" || (Array.isArray(dormIds) && dormIds.includes("ALL")))
    ? dorms
    : dorms.filter((d) => (dormIds as string[]).includes(d.id));

  if (targetDorms.length === 0) {
    throw new Error("กรุณาเลือกหอพักอย่างน้อย 1 หอพัก");
  }

  const opName = operatorName || "เจ้าหน้าที่";
  const timeNow = new Date().toLocaleTimeString("th-TH");
  let affectedRecordsCount = 0;

  if (status === "CLEAR") {
    // Mode CLEAR: Delete attendance documents for selected dorms across dateList
    const idsToDelete: string[] = [];
    dateList.forEach((dateStr) => {
      targetDorms.forEach((dorm) => {
        idsToDelete.push(`${dateStr}_${dorm.id}`);
      });
    });

    if (idsToDelete.length > 0) {
      affectedRecordsCount = await commitChunkedDeleteDocs("attendance", idsToDelete);
    }

    // Sync local cache
    const currentCached = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
    const deleteSet = new Set(idsToDelete);
    const filteredCached = currentCached.filter((item) => !deleteSet.has(item.id || `${item.date}_${item.dormId}`));
    setLocalCache(CACHE_KEYS.ATTENDANCE, filteredCached);

    return {
      success: true,
      affectedDatesCount: dateList.length,
      affectedRecordsCount,
      message: `ล้างข้อมูลการเช็คยอดสำหรับ ${targetDorms.length} หอพัก ตั้งแต่วันที่ ${startDate} ถึง ${effectiveEndDate} (รวม ${dateList.length} วัน) เรียบร้อยแล้ว`
    };
  }

  // Status is HOME_BREAK, SEMESTER_BREAK, or PRESENT
  const recordsToSave: DailyAttendance[] = [];

  dateList.forEach((dateStr) => {
    targetDorms.forEach((dorm) => {
      const docId = `${dateStr}_${dorm.id}`;

      // Check if existing record has special status when mode is PRESENT
      if (status === "PRESENT") {
        const existing = cachedAttendance.find((c) => (c.date === dateStr || c.id === docId) && c.dormId === dorm.id);
        if (existing && (existing.isHomeBreak || existing.status === "HOME_BREAK" || existing.status === "SEMESTER_BREAK")) {
          // Do not overwrite existing special status with normal check
          return;
        }
      }

      // Find students belonging to this dorm
      const dormStudents = students.filter((s) => {
        const sDormId = String(s.dormId || "").trim();
        const dNum = dorm.id.replace(/\D/g, "");
        const sNum = sDormId.replace(/\D/g, "");
        return sDormId === dorm.id || sDormId === dorm.name || (dNum && sNum && dNum === sNum);
      });

      const isHome = status === "HOME_BREAK";
      const isSemBreak = status === "SEMESTER_BREAK";

      const studentRecords: StudentAttendanceRecord[] = dormStudents.map((s) => ({
        studentId: formatStudentId(s.studentId),
        studentName: `${s.title}${s.firstName} ${s.lastName}`,
        status: isHome ? "ROUND_HOME" : isSemBreak ? "SEMESTER_BREAK" : "PRESENT",
        reason: isHome ? "รอบกลับบ้าน" : isSemBreak ? "ปิดภาคเรียน" : "",
        note: isHome ? "รอบกลับบ้าน" : isSemBreak ? "ปิดภาคเรียน" : ""
      }));

      const notes = (orientationNotes || []).filter((n) => n && n.trim().length > 0);

      const record: DailyAttendance = {
        id: docId,
        date: dateStr,
        dormId: dorm.id,
        isHomeBreak: isHome,
        status: isHome ? "HOME_BREAK" : isSemBreak ? "SEMESTER_BREAK" : "CHECKED",
        checkedAt: timeNow,
        checkedBy: isHome
          ? `${opName} (กำหนดรอบกลับบ้านตามช่วงวัน)`
          : isSemBreak
          ? `${opName} (กำหนดปิดภาคเรียนตามช่วงวัน)`
          : `${opName} (เช็คยอดตามปกติ)`,
        teacherOrientationNotes: notes,
        records: studentRecords
      };

      recordsToSave.push(record);
    });
  });

  if (recordsToSave.length > 0) {
    affectedRecordsCount = await commitChunkedSetDocs("attendance", recordsToSave);
  }

  invalidateFirestoreReadCache("attendance");
  // Update local cache
  const cached = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  const map = new Map<string, DailyAttendance>();
  cached.forEach((r) => map.set(r.id || `${r.date}_${r.dormId}`, r));
  recordsToSave.forEach((r) => map.set(r.id || `${r.date}_${r.dormId}`, r));
  setLocalCache(CACHE_KEYS.ATTENDANCE, Array.from(map.values()));

  const statusLabel =
    status === "HOME_BREAK" ? "รอบกลับบ้าน" : status === "SEMESTER_BREAK" ? "ปิดภาคเรียน" : "เช็คยอดตามปกติ";

  return {
    success: true,
    affectedDatesCount: dateList.length,
    affectedRecordsCount: recordsToSave.length,
    message: status === "PRESENT"
      ? `เช็คยอดตามปกติสำหรับ ${targetDorms.length} หอพัก ตั้งแต่วันที่ ${startDate} ไปจนถึงวันที่ ${effectiveEndDate} (รวม ${dateList.length} วัน รวม ${recordsToSave.length} บันทึก) สำเร็จเรียบร้อยแล้ว`
      : `กำหนดสถานะ [${statusLabel}] สำหรับ ${targetDorms.length} หอพัก ตั้งแต่วันที่ ${startDate} ถึง ${effectiveEndDate} (รวม ${dateList.length} วัน รวม ${recordsToSave.length} บันทึก) สำเร็จเรียบร้อยแล้ว`
  };
}

// No-op compatibility functions (auto-carry cancelled as requested by user)
export async function syncAutoAttendanceCarryOver(allRecords: DailyAttendance[]): Promise<DailyAttendance[]> {
  return allRecords;
}
export const syncSemesterBreakAutoAttendance = syncAutoAttendanceCarryOver;

export async function fetchAllCheckedAttendanceDates(): Promise<string[]> {
  const localRecords = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  let records: DailyAttendance[] = [];
  try {
    const docs = await readCollectionCached("attendance", 15000);
    const cloudRecords = docs.map((d) => ({ id: d.id, ...d.data } as DailyAttendance));
    records = mergeCloudWithUnsyncedLocal(cloudRecords, localRecords);
    if (records.length > 0) {
      setLocalCache(CACHE_KEYS.ATTENDANCE, records);
    }
  } catch (err: any) {
    console.warn("Primary database fetchAllCheckedAttendanceDates offline fallback:", err?.message || err);
    records = localRecords;
  }

  const datesSet = new Set<string>();
  records.forEach((data) => {
    if (!data || !data.date) return;

    if (
      data.status === "CHECKED" ||
      data.status === "HOME_BREAK" ||
      data.status === "SEMESTER_BREAK" ||
      (data.records && data.records.length > 0)
    ) {
      datesSet.add(data.date);
    }
  });
  return Array.from(datesSet);
}

export async function fetchAllAttendanceRecords(): Promise<DailyAttendance[]> {
  const localRecords = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  let records: DailyAttendance[] = [];
  try {
    const docs = await readCollectionCached("attendance", 15000);
    const cloudRecords = docs.map((d) => ({ id: d.id, ...d.data } as DailyAttendance));
    records = mergeCloudWithUnsyncedLocal(cloudRecords, localRecords);
    if (records.length > 0) {
      setLocalCache(CACHE_KEYS.ATTENDANCE, records);
    }
  } catch (err: any) {
    console.warn("Primary database fetchAllAttendanceRecords offline fallback:", err?.message || err);
    records = localRecords;
  }
  return records;
}

export async function fetchAttendance(
  date: string,
  dormId?: string
): Promise<Record<string, DailyAttendance> | DailyAttendance> {
  const localRecords = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  let allRecords: DailyAttendance[] = [];
  try {
    const docs = await readCollectionCached("attendance", 15000);
    const cloudRecords = docs.map((d) => ({ id: d.id, ...d.data } as DailyAttendance));
    allRecords = mergeCloudWithUnsyncedLocal(cloudRecords, localRecords);
    if (allRecords.length > 0) {
      setLocalCache(CACHE_KEYS.ATTENDANCE, allRecords);
    }
  } catch (err: any) {
    console.warn("Primary database fetchAttendance offline fallback:", err?.message || err);
    allRecords = localRecords;
  }

  if (dormId) {
    const docId = `${date}_${dormId}`;
    const match = allRecords.find(
      (r) =>
        (r.date === date || r.id === docId) &&
        (r.dormId === dormId || r.id?.endsWith(`_${dormId}`))
    );
    if (match) return match;

    // Direct Cloud Document lookup fallback
    try {
      const docSnap = await getDoc(doc(db, "attendance", docId));
      if (docSnap.exists()) {
        const docData = { id: docSnap.id, ...docSnap.data() } as DailyAttendance;
        updateLocalCacheList(CACHE_KEYS.ATTENDANCE, docData, "UPSERT");
        return docData;
      }
    } catch (e) {
      console.warn("Direct doc fetch fallback:", e);
    }

    return {
      id: docId,
      date,
      dormId,
      isHomeBreak: false,
      status: "PENDING",
      teacherOrientationNotes: [],
      records: []
    };
  } else {
    const resMap: Record<string, DailyAttendance> = {};
    allRecords.forEach((r) => {
      if (r.date === date || r.id?.startsWith(`${date}_`)) {
        resMap[r.dormId] = r;
      }
    });
    return resMap;
  }
}

export async function saveAttendance(payload: Partial<DailyAttendance>): Promise<DailyAttendance> {
  const date = payload.date || new Date().toISOString().split("T")[0];
  const dormId = payload.dormId || "dorm-1";
  const docId = `${date}_${dormId}`;

  const docRef = doc(db, "attendance", docId);
  let existingData: Partial<DailyAttendance> = {};
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (e) {
    console.warn("Could not fetch doc before save (offline):", e);
  }

  const updatedRecord: DailyAttendance = {
    id: docId,
    date,
    dormId,
    isHomeBreak: payload.isHomeBreak || false,
    status: payload.status || "CHECKED",
    checkedAt: new Date().toLocaleTimeString("th-TH"),
    checkedBy: payload.checkedBy || "เจ้าหน้าที่",
    teacherOrientationNotes: payload.teacherOrientationNotes || [],
    records: (payload.records || existingData.records || []).map((r) => ({
      ...r,
      studentId: formatStudentId(r.studentId)
    })),
    ...existingData,
    ...payload,
    // Ensure records from payload have formatted studentId
    ...(payload.records
      ? {
          records: payload.records.map((r) => ({
            ...r,
            studentId: formatStudentId(r.studentId)
          }))
        }
      : {})
  };

  try {
    const cleaned = cleanFirestoreData(updatedRecord);
    await setDoc(docRef, cleaned, { merge: true });
  } catch (e) {
    console.warn("Saved attendance offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.ATTENDANCE, updatedRecord, "UPSERT");

  // If status on this date is no longer a break (SEMESTER_BREAK or HOME_BREAK),
  // clean up any subsequent future auto-generated records for this dorm
  const activeBreakType = getAttendanceBreakType(updatedRecord);
  if (!activeBreakType) {
    const cached = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
    const toDelete = cached.filter(
      (c) =>
        c.dormId === dormId &&
        c.date > date &&
        c.checkedBy?.includes("ระบบอัตโนมัติ")
    );
    if (toDelete.length > 0) {
      const remaining = cached.filter((c) => !toDelete.some((d) => d.id === c.id));
      setLocalCache(CACHE_KEYS.ATTENDANCE, remaining);
      (async () => {
        try {
          const batch = writeBatch(db);
          toDelete.forEach((d) => {
            batch.delete(doc(db, "attendance", d.id));
          });
          await batch.commit();
        } catch (err: any) {
          console.warn("Could not delete cancelled auto-attendance records:", err?.message || err);
        }
      })().catch(() => {});
    }
  }

  return updatedRecord;
}

/**
 * Bulk updates all dormitories to "ROUND_HOME" (รอบกลับบ้าน) or reverts back.
 * Used exclusively by Admin (ผู้ดูแล) or Staff (เจ้าหน้าที่) with a single click.
 */
export async function bulkSetHomeBreakAllDorms(
  targetDate: string,
  dorms: Dormitory[],
  students: Student[],
  operatorName: string,
  mode: "SET_HOME_BREAK" | "REVERT_NORMAL"
): Promise<{ success: boolean; count: number; message: string; updatedRecords: DailyAttendance[] }> {
  const updatedRecords: DailyAttendance[] = [];
  const timeNow = new Date().toLocaleTimeString("th-TH");

  for (const dorm of dorms) {
    const docId = `${targetDate}_${dorm.id}`;
    // Find all students for this dorm
    const dormStudents = students.filter((s) => {
      const sDormId = String(s.dormId || "").trim();
      const dNum = dorm.id.replace(/\D/g, "");
      const sNum = sDormId.replace(/\D/g, "");
      return sDormId === dorm.id || sDormId === dorm.name || (dNum && sNum && dNum === sNum);
    });

    const isHome = mode === "SET_HOME_BREAK";
    const studentRecords: StudentAttendanceRecord[] = dormStudents.map((s) => ({
      studentId: formatStudentId(s.studentId),
      studentName: `${s.title}${s.firstName} ${s.lastName}`,
      status: isHome ? "ROUND_HOME" : "PRESENT",
      reason: isHome ? "รอบกลับบ้าน" : ""
    }));

    const record: DailyAttendance = {
      id: docId,
      date: targetDate,
      dormId: dorm.id,
      isHomeBreak: isHome,
      status: isHome ? "HOME_BREAK" : "CHECKED",
      checkedAt: timeNow,
      checkedBy: isHome ? `${operatorName} (รอบกลับบ้านทุกหอพัก)` : operatorName,
      teacherOrientationNotes: [],
      records: studentRecords
    };

    updatedRecords.push(record);
  }

  // Save chunked batch in primary cloud database
  try {
    const CHUNK_SIZE = 10;
    for (let i = 0; i < updatedRecords.length; i += CHUNK_SIZE) {
      const chunk = updatedRecords.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        batch.set(doc(db, "attendance", rec.id), cleanFirestoreData(rec), { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    console.warn("Primary database bulkSetHomeBreakAllDorms saved offline locally:", err?.message || err);
  }

  invalidateFirestoreReadCache("attendance");
  // Update local cache
  const cached = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  const map = new Map<string, DailyAttendance>();
  cached.forEach((r) => map.set(r.id, r));
  updatedRecords.forEach((r) => map.set(r.id, r));
  setLocalCache(CACHE_KEYS.ATTENDANCE, Array.from(map.values()));

  const actionMsg = mode === "SET_HOME_BREAK"
    ? `เปลี่ยนสถานะทุกหอพักเป็น "รอบกลับบ้าน" เรียบร้อยแล้ว (ครอบคลุม ${dorms.length} หอพัก)`
    : `ยกเลิกสถานะรอบกลับบ้านทุกหอพักเรียบร้อยแล้ว (ครอบคลุม ${dorms.length} หอพัก)`;

  return {
    success: true,
    count: dorms.length,
    message: actionMsg,
    updatedRecords
  };
}

// ----------------------------------------------------------------------
// System Settings API (Primary Cloud Database with Local Cache)
// ----------------------------------------------------------------------
export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;
    }
    await ensureAuthReady();
    const snap = await withTimeout(getDocFromServer(doc(db, "system_settings", "config")), 8000);
    if (snap.exists()) {
      const settings = snap.data() as SystemSettings;
      setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, settings);
      setFirestoreAccessIssue(null);
      return settings;
    }
    setFirestoreAccessIssue(null);
    return getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;
  } catch (err: any) {
    console.warn("Primary database fetchSystemSettings offline fallback:", err?.message || err);
    classifyFirestoreError(err, "system_settings/config", false);
    return getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;
  }
}

export async function updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, settings);

  try {
    await setDoc(doc(db, "system_settings", "config"), cleanFirestoreData(settings), { merge: true });
  } catch (err) {
    console.warn("Primary database updateSystemSettings saved locally (offline):", err);
  }
  return settings;
}

// ----------------------------------------------------------------------
// Reports API (Generated from Primary Cloud Database Data)
// ----------------------------------------------------------------------
export async function fetchDailyReport(date?: string): Promise<DailyReportData> {
  const reportDate = date || getTodayDateString();
  const summaryDate = getPreviousDateString(reportDate);

  const [dorms, students, notices] = await Promise.all([
    fetchDorms(),
    fetchStudents(),
    fetchNotices()
  ]);

  let attendanceMap: Record<string, DailyAttendance> = {};
  try {
    let attRes = await fetchAttendance(summaryDate);
    let hasRecords = false;
    if (attRes && typeof attRes === "object" && !("records" in attRes)) {
      hasRecords = Object.values(attRes).some((a) => a && (a.status === "CHECKED" || a.status === "HOME_BREAK" || a.status === "SEMESTER_BREAK" || (a.records && a.records.length > 0)));
      if (hasRecords) {
        attendanceMap = attRes as Record<string, DailyAttendance>;
      }
    } else if (attRes && "records" in attRes) {
      attendanceMap[(attRes as DailyAttendance).dormId] = attRes as DailyAttendance;
      hasRecords = true;
    }

    // Fallback: If summaryDate (previous night check) has no checked records, check reportDate directly
    if (!hasRecords) {
      const todayAttRes = await fetchAttendance(reportDate);
      if (todayAttRes && typeof todayAttRes === "object" && !("records" in todayAttRes)) {
        attendanceMap = todayAttRes as Record<string, DailyAttendance>;
      } else if (todayAttRes && "records" in todayAttRes) {
        attendanceMap[(todayAttRes as DailyAttendance).dormId] = todayAttRes as DailyAttendance;
      }
    }
  } catch (e) {
    console.error("Error fetching attendance for report:", e);
  }

  const gradesList = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
  const totalMatrix: Record<string, Record<string, number>> = {};
  const outMatrix: Record<string, Record<string, number>> = {};
  const remainingMatrix: Record<string, Record<string, number>> = {};
  const dormTotals: Record<string, { total: number; out: number; remaining: number }> = {};
  const gradeTotals: Record<string, { total: number; out: number; remaining: number }> = {};

  gradesList.forEach((g) => {
    gradeTotals[g] = { total: 0, out: 0, remaining: 0 };
  });

  const absentStudentsList: Array<{
    no: number;
    studentId: string;
    fullName: string;
    gradeRoom: string;
    dormName: string;
    dormId: string;
    reason: string;
    status: any;
  }> = [];

  let overallTotal = 0;
  let overallOut = 0;
  let overallRemaining = 0;
  let absentCounter = 0;

  dorms.forEach((dorm) => {
    totalMatrix[dorm.id] = {};
    outMatrix[dorm.id] = {};
    remainingMatrix[dorm.id] = {};

    let dormTotalCount = 0;
    let dormOutCount = 0;
    let dormRemCount = 0;

    const dormStudents = students.filter((s) => matchStudentToDorm(s, dorm));
    const attendance = attendanceMap[dorm.id] || Object.values(attendanceMap).find((a) => a && isDormMatch(dorm, a.dormId));

    const isSemBreak = Boolean(
      attendance && (
        attendance.status === "SEMESTER_BREAK" ||
        (Array.isArray(attendance.records) && attendance.records.length > 0 && attendance.records.every((r) => r.status === "SEMESTER_BREAK"))
      )
    );
    const isHmBreak = Boolean(attendance && (attendance.isHomeBreak || attendance.status === "HOME_BREAK"));

    gradesList.forEach((g) => {
      const studentsInGrade = dormStudents.filter((s) => isGradeMatch(s.grade, g));
      const totalInGrade = studentsInGrade.length;
      let outInGrade = 0;

      if (attendance) {
        if (isSemBreak) {
          // ปิดภาคเรียน: ถือว่านักเรียนทุกคนในหอพักไม่อยู่ในหอพัก (ออกหอพักทั้งหมด)
          outInGrade = totalInGrade;
          studentsInGrade.forEach((std) => {
            absentCounter++;
            const stdSid = formatStudentId(std.studentId);
            const stdRec = Array.isArray(attendance.records)
              ? attendance.records.find((r) => {
                  const rSid = formatStudentId(r.studentId);
                  return rSid === stdSid || r.studentId === std.studentId;
                })
              : undefined;
            const noteOrReason = stdRec?.reason && stdRec.reason !== "ปิดภาคเรียน"
              ? `ปิดภาคเรียน (${stdRec.reason})`
              : "ปิดภาคเรียน";

            absentStudentsList.push({
              no: absentCounter,
              studentId: stdSid,
              fullName: `${std.title}${std.firstName} ${std.lastName}`,
              gradeRoom: `${std.grade}/${std.room}`,
              dormName: dorm.name,
              dormId: dorm.id,
              reason: noteOrReason,
              status: "SEMESTER_BREAK"
            });
          });
        } else if (isHmBreak) {
          // รอบกลับบ้าน: ถือว่านักเรียนทุกคนในหอพักออกหอพัก
          outInGrade = totalInGrade;
          studentsInGrade.forEach((std) => {
            absentCounter++;
            const stdSid = formatStudentId(std.studentId);
            absentStudentsList.push({
              no: absentCounter,
              studentId: stdSid,
              fullName: `${std.title}${std.firstName} ${std.lastName}`,
              gradeRoom: `${std.grade}/${std.room}`,
              dormName: dorm.name,
              dormId: dorm.id,
              reason: "รอบกลับบ้าน",
              status: "ROUND_HOME"
            });
          });
        } else if (Array.isArray(attendance.records)) {
          studentsInGrade.forEach((std) => {
            const stdSid = formatStudentId(std.studentId);
            const stdRec = attendance.records.find((r) => {
              const rSid = formatStudentId(r.studentId);
              return rSid === stdSid || r.studentId === std.studentId;
            });
            // ตรวจสอบตามความเป็นจริงของการเช็คยอด: หากสถานะไม่ใช่ PRESENT หรือ QUARANTINE ถือว่าออกหอพัก
            if (stdRec && !isDormPresentStatus(stdRec.status)) {
              outInGrade++;
              absentCounter++;
              let statusLabel = stdRec.status === "ROUND_HOME" ? "รอบกลับบ้าน" : "กลับบ้าน";
              if (stdRec.status === "CAMP") statusLabel = "เข้าค่าย";
              if (stdRec.status === "SICK") statusLabel = "ป่วย";
              if (stdRec.status === "SKILL_COMP") statusLabel = "แข่งทักษะ";
              if (stdRec.status === "EXCHANGE") statusLabel = "นักเรียนแลกเปลี่ยน";
              if (stdRec.status === "WALK_STUDY") statusLabel = "เดินเรียน";
              if (stdRec.status === "SEMESTER_BREAK") statusLabel = "ปิดภาคเรียน";
              if (stdRec.status === "NOT_ARRIVED") statusLabel = "ยังไม่เข้าหอพัก";
              if (stdRec.status === "OTHER") statusLabel = "อื่น";

              absentStudentsList.push({
                no: absentCounter,
                studentId: stdSid,
                fullName: `${std.title}${std.firstName} ${std.lastName}`,
                gradeRoom: `${std.grade}/${std.room}`,
                dormName: dorm.name,
                dormId: dorm.id,
                reason: stdRec.reason ? `${statusLabel} (${stdRec.reason})` : statusLabel,
                status: stdRec.status
              });
            }
          });
        }
      }

      const remInGrade = Math.max(0, totalInGrade - outInGrade);
      totalMatrix[dorm.id][g] = totalInGrade;
      outMatrix[dorm.id][g] = outInGrade;
      remainingMatrix[dorm.id][g] = remInGrade;

      dormTotalCount += totalInGrade;
      dormOutCount += outInGrade;
      dormRemCount += remInGrade;

      gradeTotals[g].total += totalInGrade;
      gradeTotals[g].out += outInGrade;
      gradeTotals[g].remaining += remInGrade;
    });

    dormTotals[dorm.id] = {
      total: dormTotalCount,
      out: dormOutCount,
      remaining: dormRemCount
    };

    overallTotal += dormTotalCount;
    overallOut += dormOutCount;
    overallRemaining += dormRemCount;
  });

  const headTeacherNotices = notices.filter((n) => n.date === summaryDate || n.date === reportDate);
  const dormTeacherOrientations = dorms.map((dorm) => {
    const attendance = attendanceMap[dorm.id] || Object.values(attendanceMap).find((a) => a && isDormMatch(dorm, a.dormId));

    // Check if this dorm actually performed an attendance check (CHECKED or HOME_BREAK)
    const hasChecked = Boolean(
      attendance && (
        attendance.status === "CHECKED" ||
        attendance.status === "HOME_BREAK"
      )
    );

    // Filter orientation notes: remove empty notes and automated/system placeholders (e.g. ปิดภาคเรียน, ระบบอัตโนมัติ)
    const ownNotes = (attendance?.teacherOrientationNotes || []).filter((n: string) => {
      if (!n) return false;
      const trimmed = n.trim();
      return (
        trimmed.length > 0 &&
        trimmed !== "-" &&
        !trimmed.includes("ปิดภาคเรียน") &&
        !trimmed.includes("รอบกลับบ้าน") &&
        !trimmed.includes("ระบบอัตโนมัติ")
      );
    });
    const hasOrientation = ownNotes.length > 0;

    // หอพักไม่มีการเช็คยอดและอบรม ไม่ต้องระบุชื่อครู ให้ใช้ - แทน และห้ามใช้ชื่อที่มาจากข้อมูลตัวอย่าง
    let checkedBy = "-";
    if (hasChecked || hasOrientation) {
      const rec = attendance?.checkedBy?.trim();
      if (rec && !isPlaceholderTeacherName(rec)) {
        checkedBy = rec;
      }
    }

    return {
      dormId: dorm.id,
      dormName: dorm.name,
      checkedBy,
      checkedAt: hasChecked ? attendance?.checkedAt : undefined,
      status: attendance?.status || "PENDING",
      orientationNotes: ownNotes
    };
  });

  return {
    success: true,
    reportDate,
    summaryDate,
    dormitories: dorms,
    grades: gradesList,
    totalMatrix,
    outMatrix,
    remainingMatrix,
    dormTotals,
    gradeTotals,
    grandTotals: {
      total: overallTotal,
      out: overallOut,
      remaining: overallRemaining
    },
    absentStudentsList,
    signatories: {
      creator: "เจ้าหน้าที่งานหอพัก",
      headTeacher: "หัวหน้างานหอพัก",
      deputyDirector: "รองผู้อำนวยการฝ่ายบริหารกิจการนักเรียน"
    },
    headTeacherNotices,
    dormTeacherOrientations
  };
}

export async function exportToGoogleSheets(reportData: DailyReportData, accessToken?: string) {
  if (!accessToken) {
    throw new Error("กรุณาเชื่อมต่อบัญชี Google เพื่อส่งออกรายงานไปยัง Google Sheets");
  }
  return { success: true, message: "เตรียมการส่งออกข้อมูลเรียบร้อยแล้ว" };
}
