import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import {
  db,
  commitChunkedSetDocs,
  commitChunkedDeleteDocs,
  FIREBASE_PROJECT_INFO,
  withTimeout
} from "../lib/firebase";
import {
  DailyAttendance,
  DailyReportData,
  Dormitory,
  DormTeacher,
  Notice,
  Student,
  SystemSettings,
  UserProfile
} from "../types";
import { getTodayDateString, getPreviousDateString } from "../utils/dateUtils";

// Default System Settings for Firestore Initialization
const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  schoolNameTh: "โรงเรียนพิจิตรปัญญานุกูล",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "พ.จ.ป.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "ระบบบริหารจัดการหอพักนักเรียน",
  systemNameEn: "Student Dormitory Management System",
  systemIcon: "building",
  lastUpdatedDate: "8 สิงหาคม พ.ศ. 2569"
};

// ----------------------------------------------------------------------
// LocalStorage Cache Manager Utilities
// ----------------------------------------------------------------------
export const CACHE_KEYS = {
  DORMS: "dorm_cache_dorms",
  STUDENTS: "dorm_cache_students",
  USERS: "dorm_cache_users",
  NOTICES: "dorm_cache_notices",
  ATTENDANCE: "dorm_cache_attendance",
  SYSTEM_SETTINGS: "dorm_system_settings"
};

export function getLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`LocalStorage write error for ${key}:`, e);
  }
}

export function updateLocalCacheList<T extends { id: string }>(
  key: string,
  newItem: T,
  operation: "UPSERT" | "DELETE"
): T[] {
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

// ----------------------------------------------------------------------
// Dormitories API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchDorms(): Promise<Dormitory[]> {
  try {
    const snapshot = await withTimeout(getDocs(collection(db, "dorms")), 3500);
    if (!snapshot.empty) {
      const dorms = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Dormitory));
      const sorted = dorms.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      setLocalCache(CACHE_KEYS.DORMS, sorted);
      return sorted;
    }
    // If empty in Firestore, return empty array (do NOT seed mock data)
    setLocalCache(CACHE_KEYS.DORMS, []);
    return [];
  } catch (err: any) {
    console.warn("Firestore fetchDorms offline fallback:", err?.message || err);
    return getLocalCache<Dormitory[]>(CACHE_KEYS.DORMS) || [];
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
    await setDoc(doc(db, "dorms", newId), newDorm);
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
    await setDoc(docRef, updatedData, { merge: true });
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
// Students API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchStudents(params?: {
  dormId?: string;
  grade?: string;
  room?: number;
}): Promise<Student[]> {
  try {
    const snapshot = await withTimeout(getDocs(collection(db, "students")), 3500);
    let students: Student[] = [];

    if (!snapshot.empty) {
      students = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
      setLocalCache(CACHE_KEYS.STUDENTS, students);
    } else {
      // If collection is empty in Firestore, return empty array (do NOT seed mock data)
      setLocalCache(CACHE_KEYS.STUDENTS, []);
      students = [];
    }

    if (params?.dormId) {
      students = students.filter((s) => s.dormId === params.dormId);
    }
    if (params?.grade) {
      students = students.filter((s) => s.grade === params.grade);
    }
    if (params?.room) {
      students = students.filter((s) => Number(s.room) === Number(params.room));
    }
    return students.sort((a, b) => (a.no || 0) - (b.no || 0));
  } catch (err: any) {
    console.warn("Firestore fetchStudents offline fallback:", err?.message || err);
    let students = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
    if (params?.dormId) students = students.filter((s) => s.dormId === params.dormId);
    if (params?.grade) students = students.filter((s) => s.grade === params.grade);
    if (params?.room) students = students.filter((s) => Number(s.room) === Number(params.room));
    return students.sort((a, b) => (a.no || 0) - (b.no || 0));
  }
}

export async function importStudents(dormId: string, students: Partial<Student>[]) {
  const createdStudents: Student[] = [];

  students.forEach((s, idx) => {
    const id = s.id || `std-${dormId}-${Date.now()}-${idx}`;
    const newStudent: Student = {
      id,
      studentId: s.studentId || `STD${Math.floor(1000 + Math.random() * 9000)}`,
      no: s.no || idx + 1,
      title: s.title || "นาย",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      nickname: s.nickname || "",
      grade: s.grade || "ม.1",
      room: Number(s.room) || 1,
      dormId,
      dormRoom: s.dormRoom || "101",
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

  // Update local cache
  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const createdMap = new Map(createdStudents.map((s) => [s.id, s]));
  const merged = [...cached.filter((s) => !createdMap.has(s.id)), ...createdStudents];
  setLocalCache(CACHE_KEYS.STUDENTS, merged);

  return { success: true, count };
}

export async function addStudent(studentData: Partial<Student>): Promise<Student> {
  const id = studentData.id || `std-${Date.now()}`;
  const newStudent: Student = {
    id,
    studentId: studentData.studentId || `STD${Math.floor(1000 + Math.random() * 9000)}`,
    no: studentData.no || 1,
    title: studentData.title || "นาย",
    firstName: studentData.firstName || "",
    lastName: studentData.lastName || "",
    nickname: studentData.nickname || "",
    grade: studentData.grade || "ม.1",
    room: Number(studentData.room) || 1,
    dormId: studentData.dormId || "dorm-1",
    dormRoom: studentData.dormRoom || "101",
    gender: studentData.gender || "male"
  };

  try {
    await setDoc(doc(db, "students", id), newStudent);
  } catch (e) {
    console.warn("Saved student offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.STUDENTS, newStudent, "UPSERT");
  return newStudent;
}

export async function updateStudent(id: string, studentData: Partial<Student>): Promise<Student> {
  const docRef = doc(db, "students", id);
  let updated: any = { ...studentData, id };
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updated = { ...snap.data(), ...studentData };
    }
    await setDoc(docRef, updated, { merge: true });
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

  const cached = getLocalCache<Student[]>(CACHE_KEYS.STUDENTS) || [];
  const idSet = new Set(ids);
  const remaining = cached.filter((s) => !idSet.has(s.id));
  setLocalCache(CACHE_KEYS.STUDENTS, remaining);

  return { success: true, count: ids.length };
}

// ----------------------------------------------------------------------
// Users API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const snapshot = await withTimeout(getDocs(collection(db, "users")), 3500);
    if (!snapshot.empty) {
      const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
      const sorted = users.sort((a, b) => (a.roleLevel || 3) - (b.roleLevel || 3));
      setLocalCache(CACHE_KEYS.USERS, sorted);
      return sorted;
    }
    // If empty in Firestore, return empty array (do NOT seed mock data)
    setLocalCache(CACHE_KEYS.USERS, []);
    return [];
  } catch (err: any) {
    console.warn("Firestore fetchUsers offline fallback:", err?.message || err);
    return getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
  }
}

export async function addUser(userData: Partial<UserProfile>): Promise<UserProfile> {
  const id = userData.id || `user-${Date.now()}`;
  const newUser: UserProfile = {
    id,
    name: userData.name || "ผู้ใช้งานใหม่",
    role: userData.role || "DORM_TEACHER",
    roleLevel: userData.roleLevel || 3,
    roleCategory: userData.roleCategory || "DORM_TEACHER",
    roleCategoryName: userData.roleCategoryName || "ครูหอพัก",
    roleLabel: userData.roleLabel || "ครูประจำหอพัก",
    password: userData.password || "123456",
    avatarUrl: userData.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    ...userData
  };

  try {
    await setDoc(doc(db, "users", id), newUser);
  } catch (e) {
    console.warn("Saved user offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.USERS, newUser, "UPSERT");
  return newUser;
}

export async function updateUser(id: string, userData: Partial<UserProfile>): Promise<UserProfile> {
  const docRef = doc(db, "users", id);
  let updated: any = { ...userData, id };
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updated = { ...snap.data(), ...userData };
    }
    await setDoc(docRef, updated, { merge: true });
  } catch (e) {
    console.warn("Updated user offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.USERS, updated as UserProfile, "UPSERT");
  return updated as UserProfile;
}

export async function deleteUser(id: string) {
  try {
    await deleteDoc(doc(db, "users", id));
  } catch (e) {
    console.warn("Deleted user offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.USERS, { id } as any, "DELETE");
  return { success: true };
}

export async function changeUserPassword(
  id: string,
  payload: { oldPassword?: string; newPassword: string; isAdminOverride?: boolean }
) {
  const docRef = doc(db, "users", id);
  try {
    await updateDoc(docRef, { password: payload.newPassword });
  } catch (e) {
    console.warn("Changed password offline locally:", e);
  }

  const cachedUsers = getLocalCache<UserProfile[]>(CACHE_KEYS.USERS) || [];
  const idx = cachedUsers.findIndex((u) => u.id === id);
  if (idx >= 0) {
    cachedUsers[idx] = { ...cachedUsers[idx], password: payload.newPassword };
    setLocalCache(CACHE_KEYS.USERS, cachedUsers);
  }

  return { success: true, message: "เปลี่ยนรหัสผ่านสำเร็จใน Firebase" };
}

// ----------------------------------------------------------------------
// Database Management API (Firebase Firestore Exclusive with Local Cache)
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
      console.warn(`Could not clear ${colName} in Firestore (offline):`, e);
    }
  }

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
    system: "Student Counting System",
    firebaseProject: FIREBASE_PROJECT_INFO.projectId
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
  const { data, mode = "ALL", date, month, startDate, endDate, dormId, restoreStrategy = "UPSERT" } = payload;
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
      users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      notices: noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      attendance: attSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      systemSettings: sysSnap.exists() ? sysSnap.data() : null,
      exportedAt: new Date().toISOString(),
      system: "Student Counting System",
      firebaseProject: FIREBASE_PROJECT_INFO.projectId
    };

    // Update local cache with exported snapshot
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
      users: getLocalCache(CACHE_KEYS.USERS) || [],
      notices: getLocalCache(CACHE_KEYS.NOTICES) || [],
      attendance: getLocalCache(CACHE_KEYS.ATTENDANCE) || [],
      systemSettings: getLocalCache(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS,
      exportedAt: new Date().toISOString(),
      system: "Student Counting System",
      firebaseProject: FIREBASE_PROJECT_INFO.projectId
    };
  }
}

export async function restoreDatabase(data: any) {
  let restoredCount = 0;

  if (Array.isArray(data.dorms) && data.dorms.length > 0) {
    setLocalCache(CACHE_KEYS.DORMS, data.dorms);
    try {
      restoredCount += await commitChunkedSetDocs("dorms", data.dorms);
    } catch (e) { console.warn("Restored dorms offline:", e); }
  }
  if (Array.isArray(data.students) && data.students.length > 0) {
    setLocalCache(CACHE_KEYS.STUDENTS, data.students);
    try {
      restoredCount += await commitChunkedSetDocs("students", data.students);
    } catch (e) { console.warn("Restored students offline:", e); }
  }
  if (Array.isArray(data.users) && data.users.length > 0) {
    setLocalCache(CACHE_KEYS.USERS, data.users);
    try {
      restoredCount += await commitChunkedSetDocs("users", data.users);
    } catch (e) { console.warn("Restored users offline:", e); }
  }
  if (Array.isArray(data.notices) && data.notices.length > 0) {
    setLocalCache(CACHE_KEYS.NOTICES, data.notices);
    try {
      restoredCount += await commitChunkedSetDocs("notices", data.notices);
    } catch (e) { console.warn("Restored notices offline:", e); }
  }
  if (Array.isArray(data.attendance) && data.attendance.length > 0) {
    setLocalCache(CACHE_KEYS.ATTENDANCE, data.attendance);
    try {
      restoredCount += await commitChunkedSetDocs("attendance", data.attendance);
    } catch (e) { console.warn("Restored attendance offline:", e); }
  }
  if (data.systemSettings && typeof data.systemSettings === "object") {
    setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, data.systemSettings);
    try {
      await setDoc(doc(db, "system_settings", "config"), data.systemSettings, { merge: true });
    } catch (e) { console.warn("Restored settings offline:", e); }
  }

  return { success: true, message: `กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว (${restoredCount} รายการ)` };
}

export async function syncLiveFirebaseDatabase() {
  try {
    const [dormsSnap, studentsSnap, usersSnap, noticesSnap, attSnap, sysSnap] = await Promise.all([
      getDocs(collection(db, "dorms")),
      getDocs(collection(db, "students")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "notices")),
      getDocs(collection(db, "attendance")),
      getDoc(doc(db, "system_settings", "config"))
    ]);

    const dorms = dormsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const notices = noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const attendance = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setLocalCache(CACHE_KEYS.DORMS, dorms);
    setLocalCache(CACHE_KEYS.STUDENTS, students);
    setLocalCache(CACHE_KEYS.USERS, users);
    setLocalCache(CACHE_KEYS.NOTICES, notices);
    setLocalCache(CACHE_KEYS.ATTENDANCE, attendance);

    if (sysSnap.exists()) {
      setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, sysSnap.data());
    }

    return {
      success: true,
      message: `ซิงค์ข้อมูลจริงจาก Firebase สำเร็จ: หอพัก ${dorms.length} แห่ง, นักเรียน ${students.length} คน, ผู้ใช้ ${users.length} บัญชี, บันทึกยอด ${attendance.length} รายการ`,
      counts: {
        dorms: dorms.length,
        students: students.length,
        users: users.length,
        notices: notices.length,
        attendance: attendance.length
      }
    };
  } catch (e: any) {
    console.warn("Sync live firebase database failed:", e);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการซิงค์ข้อมูลจาก Firebase: ${e?.message || e}`,
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
// Notices API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchNotices(date?: string): Promise<Notice[]> {
  try {
    const snap = await withTimeout(getDocs(collection(db, "notices")), 3500);
    if (!snap.empty) {
      let notices = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
      setLocalCache(CACHE_KEYS.NOTICES, notices);
      if (date) notices = notices.filter((n) => n.date === date);
      return notices.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
  } catch (err: any) {
    console.warn("Firestore fetchNotices offline fallback:", err?.message || err);
  }

  let notices = getLocalCache<Notice[]>(CACHE_KEYS.NOTICES) || [];
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
    await setDoc(doc(db, "notices", id), newNotice);
  } catch (e) {
    console.warn("Posted notice offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.NOTICES, newNotice, "UPSERT");
  return newNotice;
}

export async function updateNotice(noticeData: Notice) {
  try {
    await setDoc(doc(db, "notices", noticeData.id), noticeData, { merge: true });
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
// Attendance API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchAllCheckedAttendanceDates(): Promise<string[]> {
  let records: DailyAttendance[] = [];
  try {
    const snap = await getDocs(collection(db, "attendance"));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAttendance));
    setLocalCache(CACHE_KEYS.ATTENDANCE, records);
  } catch (err: any) {
    console.warn("Firestore fetchAllCheckedAttendanceDates offline fallback:", err?.message || err);
    records = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  }

  const datesSet = new Set<string>();
  records.forEach((data) => {
    if (data && data.date && (data.status === "CHECKED" || data.status === "HOME_BREAK" || (data.records && data.records.length > 0))) {
      datesSet.add(data.date);
    }
  });
  return Array.from(datesSet);
}

export async function fetchAllAttendanceRecords(): Promise<DailyAttendance[]> {
  try {
    const snap = await withTimeout(getDocs(collection(db, "attendance")), 3500);
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAttendance));
    setLocalCache(CACHE_KEYS.ATTENDANCE, records);
    return records;
  } catch (err: any) {
    console.warn("Firestore fetchAllAttendanceRecords offline fallback:", err?.message || err);
    return getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  }
}

export async function fetchAttendance(
  date: string,
  dormId?: string
): Promise<Record<string, DailyAttendance> | DailyAttendance> {
  let allRecords: DailyAttendance[] = [];
  try {
    const snap = await withTimeout(getDocs(collection(db, "attendance")), 3500);
    allRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAttendance));
    setLocalCache(CACHE_KEYS.ATTENDANCE, allRecords);
  } catch (err: any) {
    console.warn("Firestore fetchAttendance offline fallback:", err?.message || err);
    allRecords = getLocalCache<DailyAttendance[]>(CACHE_KEYS.ATTENDANCE) || [];
  }

  if (dormId) {
    const docId = `${date}_${dormId}`;
    const match = allRecords.find(
      (r) =>
        (r.date === date || r.id === docId) &&
        (r.dormId === dormId || r.id?.endsWith(`_${dormId}`))
    );
    if (match) return match;

    // Direct Firestore Document lookup fallback
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
    records: payload.records || [],
    ...existingData,
    ...payload
  };

  try {
    await setDoc(docRef, updatedRecord, { merge: true });
  } catch (e) {
    console.warn("Saved attendance offline locally:", e);
  }

  updateLocalCacheList(CACHE_KEYS.ATTENDANCE, updatedRecord, "UPSERT");
  return updatedRecord;
}

// ----------------------------------------------------------------------
// System Settings API (Firebase Firestore Exclusive with Local Cache)
// ----------------------------------------------------------------------
export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const snap = await withTimeout(getDoc(doc(db, "system_settings", "config")), 3500);
    if (snap.exists()) {
      const settings = snap.data() as SystemSettings;
      setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, settings);
      return settings;
    }
    return getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;
  } catch (err: any) {
    console.warn("Firestore fetchSystemSettings offline fallback:", err?.message || err);
    return getLocalCache<SystemSettings>(CACHE_KEYS.SYSTEM_SETTINGS) || DEFAULT_SYSTEM_SETTINGS;
  }
}

export async function updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  setLocalCache(CACHE_KEYS.SYSTEM_SETTINGS, settings);

  try {
    await setDoc(doc(db, "system_settings", "config"), settings, { merge: true });
  } catch (err) {
    console.warn("Firestore updateSystemSettings saved locally (offline):", err);
  }
  return settings;
}

// ----------------------------------------------------------------------
// Reports API (Generated from Firebase Firestore Data)
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
    const attRes = await fetchAttendance(summaryDate);
    if (attRes && typeof attRes === "object" && !("records" in attRes)) {
      attendanceMap = attRes as Record<string, DailyAttendance>;
    } else if (attRes && "records" in attRes) {
      attendanceMap[(attRes as DailyAttendance).dormId] = attRes as DailyAttendance;
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

    const dormStudents = students.filter((s) => s.dormId === dorm.id);
    const attendance = attendanceMap[dorm.id];

    gradesList.forEach((g) => {
      const studentsInGrade = dormStudents.filter((s) => s.grade === g);
      const totalInGrade = studentsInGrade.length;
      let outInGrade = 0;

      if (attendance) {
        if (attendance.isHomeBreak) {
          outInGrade = totalInGrade;
        } else if (Array.isArray(attendance.records)) {
          studentsInGrade.forEach((std) => {
            const stdRec = attendance.records.find((r) => r.studentId === std.studentId);
            if (stdRec && stdRec.status !== "PRESENT") {
              outInGrade++;
              absentCounter++;
              let statusLabel = stdRec.status === "ROUND_HOME" ? "รอบกลับบ้าน" : "กลับบ้าน";
              if (stdRec.status === "CAMP") statusLabel = "เข้าค่าย";
              if (stdRec.status === "SICK") statusLabel = "ป่วย";
              if (stdRec.status === "SKILL_COMP") statusLabel = "แข่งทักษะ";
              if (stdRec.status === "EXCHANGE") statusLabel = "นักเรียนแลกเปลี่ยน";
              if (stdRec.status === "OTHER") statusLabel = "อื่น";

              absentStudentsList.push({
                no: absentCounter,
                studentId: std.studentId,
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
    const attendance = attendanceMap[dorm.id];
    const defaultTeacherName = dorm.teachers?.[0]?.name || dorm.teacherName || "ครูประจำหอพัก";
    const ownNotes = (attendance?.teacherOrientationNotes || []).filter((n: string) => n.trim().length > 0);
    return {
      dormId: dorm.id,
      dormName: dorm.name,
      checkedBy: attendance?.checkedBy || defaultTeacherName,
      checkedAt: attendance?.checkedAt,
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
