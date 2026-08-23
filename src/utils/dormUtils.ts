import { Dormitory, DormTeacher, Student, UserProfile } from "../types";

/**
 * Normalizes a string by trimming, converting to lower case, and removing spaces, hyphens, and underscores.
 */
function normalizeKey(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
}

/**
 * Extracts digits from a string (e.g., "หอพัก 1" -> "1", "dorm-6" -> "6").
 */
function extractNumber(str?: string | null): string {
  if (!str) return "";
  const match = String(str).match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Robustly checks if a student belongs to a given dormitory.
 * Handles cases where dormId is stored as dorm.id, dorm.name, numeric id, or variations.
 */
export function matchStudentToDorm(
  student: Student | Partial<Student> | null | undefined,
  dorm: Dormitory | null | undefined
): boolean {
  if (!student || !dorm) return false;

  const sDormId = String(student.dormId || "").trim();
  const dId = String(dorm.id || "").trim();
  const dName = String(dorm.name || "").trim();

  if (!sDormId) return false;

  // 1. Direct exact match by ID or Name
  if (sDormId === dId || sDormId === dName) {
    return true;
  }

  // 2. Normalized string comparison (ignoring case, spaces, dashes)
  const normS = normalizeKey(sDormId);
  const normId = normalizeKey(dId);
  const normName = normalizeKey(dName);

  if (normS && (normS === normId || normS === normName)) {
    return true;
  }

  // 3. Thai prefix variations (e.g. "หอ 1" vs "หอพัก 1" vs "หอพักชาย 1")
  if (normName.includes(normS) || normS.includes(normName)) {
    // If one contains the other, check if they refer to the same number
    const sNum = extractNumber(sDormId);
    const dNum = extractNumber(dId) || extractNumber(dName);
    if (sNum && dNum && sNum === dNum) {
      return true;
    }
  }

  // 4. Numeric ID matching fallback (e.g., "1" matches "dorm-1" or "หอพัก 1")
  const sNum = extractNumber(sDormId);
  const dNum = extractNumber(dId) || extractNumber(dName);
  if (sNum && dNum && sNum === dNum && sNum.length <= 4) {
    return true;
  }

  return false;
}

/**
 * Robustly checks if a dorm identifier (string) matches a Dormitory object.
 */
export function isDormMatch(dorm: Dormitory | null | undefined, dormIdOrName: string | null | undefined): boolean {
  if (!dorm || !dormIdOrName) return false;
  const target = String(dormIdOrName).trim();
  const dId = String(dorm.id || "").trim();
  const dName = String(dorm.name || "").trim();

  if (target === dId || target === dName) return true;

  const normT = normalizeKey(target);
  const normId = normalizeKey(dId);
  const normName = normalizeKey(dName);

  if (normT && (normT === normId || normT === normName)) return true;

  const tNum = extractNumber(target);
  const dNum = extractNumber(dId) || extractNumber(dName);
  if (tNum && dNum && tNum === dNum) return true;

  return false;
}

/**
 * Finds the matching Dormitory object for a given student.
 */
export function findDormForStudent(student: Student | Partial<Student>, dorms: Dormitory[]): Dormitory | undefined {
  if (!student || !Array.isArray(dorms)) return undefined;
  return dorms.find((d) => matchStudentToDorm(student, d));
}

/**
 * Returns all students belonging to a specific dormitory.
 */
export function getStudentsInDorm(students: Student[], dorm: Dormitory): Student[] {
  if (!Array.isArray(students) || !dorm) return [];
  return students.filter((s) => matchStudentToDorm(s, dorm));
}

/**
 * Counts the exact number of registered students in a dormitory.
 */
export function countStudentsInDorm(students: Student[], dorm: Dormitory): number {
  return getStudentsInDorm(students, dorm).length;
}

/**
 * Normalizes and formats the teacher position text.
 */
export function normalizeDormPosition(pos?: string, isHead?: boolean, isFirstIndex: boolean = false): string {
  const trimmed = (pos || "").trim();
  if (trimmed) {
    if (trimmed === "ประธานหอพัก" || trimmed === "หัวหน้าครูประธานหอพัก") return "ครูประธานหอพัก";
    if (trimmed === "รองประธานหอพัก") return "ครูรองประธานหอพัก";
    if (trimmed === "หัวหน้าหอพัก") return "ครูหัวหน้าหอพัก";
    if (trimmed === "ประจำหอพัก") return "ครูประจำหอพัก";
    return trimmed;
  }
  if (isHead) return "ครูประธานหอพัก";
  if (isHead === false) return "ครูประจำหอพัก";
  if (isFirstIndex) return "ครูประธานหอพัก";
  return "ครูประจำหอพัก";
}

/**
 * Standard position badge styling matching DormsManagementView.
 */
export function getPositionBadgeStyle(pos?: string): string {
  const normalized = (pos || "").trim();
  if (!normalized) return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
  if (normalized.includes("ประธาน") && !normalized.includes("รอง")) return "bg-purple-100 text-purple-800 border-purple-200 font-black";
  if (normalized.includes("รองประธาน")) return "bg-blue-100 text-blue-800 border-blue-200 font-extrabold";
  if (normalized.includes("หัวหน้า")) return "bg-amber-100 text-amber-800 border-amber-200 font-extrabold";
  return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
}

/**
 * Standard dot/indicator color based on dormitory teacher position.
 */
export function getPositionDotColor(pos?: string): string {
  const normalized = (pos || "").trim();
  if (!normalized) return "bg-emerald-500";
  if (normalized.includes("ประธาน") && !normalized.includes("รอง")) return "bg-purple-600";
  if (normalized.includes("รองประธาน")) return "bg-blue-600";
  if (normalized.includes("หัวหน้า")) return "bg-amber-600";
  return "bg-emerald-600";
}

/**
 * Extracts and cleans the list of all teachers for a given dormitory.
 * Automatically derives teachers from User Management based on assigned dormitory permissions (allowedDormIds / dormId).
 * If no users are provided or matched, gracefully falls back to dorm.teachers or dorm.teacherName.
 */
export function getDormTeachers(dorm: Dormitory | null | undefined, users?: UserProfile[]): DormTeacher[] {
  if (!dorm) return [];

  // 1. Derive from User Profile Management based on dorm access permissions
  if (Array.isArray(users) && users.length > 0) {
    const matchingUsers = users.filter((u) => {
      if (!u || !u.name || !u.name.trim()) return false;
      const isPrimaryDorm = u.dormId === dorm.id || (u.dormId ? isDormMatch(dorm, u.dormId) : false);
      const isAllowedDorm = Array.isArray(u.allowedDormIds) && u.allowedDormIds.some((dId) => dId === dorm.id || isDormMatch(dorm, dId));
      return isPrimaryDorm || isAllowedDorm;
    });

    if (matchingUsers.length > 0) {
      // Sort in hierarchical position order:
      // 1. ครูประธานหอพัก / HEAD_TEACHER
      // 2. ครูรองประธานหอพัก
      // 3. ครูหัวหน้าหอพัก
      // 4. ครูประจำหอพัก
      // 5. others
      const positionWeight = (pos?: string, role?: string): number => {
        const p = (pos || "").trim();
        if (p.includes("ประธาน") && !p.includes("รอง")) return 1;
        if (role === "HEAD_TEACHER") return 1;
        if (p.includes("รองประธาน")) return 2;
        if (p.includes("หัวหน้า")) return 3;
        if (p.includes("ประจำ")) return 4;
        return 5;
      };

      const sortedUsers = [...matchingUsers].sort((a, b) => {
        const wA = positionWeight(a.dormPosition, a.role);
        const wB = positionWeight(b.dormPosition, b.role);
        if (wA !== wB) return wA - wB;
        return (a.roleLevel || 3) - (b.roleLevel || 3);
      });

      return sortedUsers.map((u, index) => {
        const rawPos = (u.dormPosition || "").trim();
        const pos = normalizeDormPosition(rawPos, undefined, false);
        const isHead = pos === "ครูประธานหอพัก" || u.role === "HEAD_TEACHER";
        return {
          id: u.id || `u-t-${index}`,
          name: u.name.trim(),
          phone: u.phone || dorm.teacherPhone || "-",
          position: pos,
          isHead
        };
      });
    }
  }

  // 2. If explicit teachers array exists with valid entries
  if (Array.isArray(dorm.teachers) && dorm.teachers.length > 0) {
    const valid = dorm.teachers.filter((t) => t && t.name && t.name.trim().length > 0);
    if (valid.length > 0) {
      return valid.map((t, index) => {
        const rawPos = (t.position || "").trim();
        const pos = normalizeDormPosition(rawPos, t.isHead, index === 0 && t.isHead !== false);
        const isHead = t.isHead ?? (pos === "ครูประธานหอพัก");
        return {
          id: t.id || `t-${index}`,
          name: t.name.trim(),
          phone: t.phone || dorm.teacherPhone || "-",
          position: pos,
          isHead
        };
      });
    }
  }

  // 3. Fallback: Parse from dorm.teacherName
  const rawTeacherName = (dorm.teacherName || "").trim();
  if (rawTeacherName) {
    // If it contains multiple names separated by comma or semicolon
    const cleanPrimaryName = rawTeacherName.replace(/\(และทีมงาน.*?\)/, "").trim();
    return [
      {
        id: "head-1",
        name: cleanPrimaryName || "ครูประจำหอพัก",
        phone: dorm.teacherPhone || "-",
        position: "ครูประธานหอพัก",
        isHead: true
      }
    ];
  }

  return [
    {
      id: "default-1",
      name: "ครูประจำหอพัก",
      phone: dorm.teacherPhone || "-",
      position: "ครูประจำหอพัก",
      isHead: true
    }
  ];
}

/**
 * Normalizes Thai names by stripping common titles, prefixes, and punctuation.
 */
function cleanThaiTeacherName(name?: string | null): string {
  if (!name) return "";
  return String(name)
    .replace(/^(ครู|นาย|นางสาว|นาง|น\.ส\.|ว่าที่ ร\.ต\.|ว่าที่ร้อยตรี|อ\.|ผศ\.|รศ\.|ดร\.|อาจารย์|คุณ|ผอ\.|รอง\s*ผอ\.)\s*/g, "")
    .replace(/[\s\-_.,()]/g, "")
    .toLowerCase();
}

/**
 * Checks if a teacher name matches the checker name (checkedBy).
 */
export function isTeacherCheckedBy(
  teacherName: string | undefined | null,
  checkedBy: string | undefined | null
): boolean {
  if (!teacherName || !checkedBy) return false;
  const cleanTeacher = cleanThaiTeacherName(teacherName);
  const cleanChecked = cleanThaiTeacherName(checkedBy);

  if (!cleanTeacher || !cleanChecked) return false;

  if (cleanTeacher === cleanChecked) return true;
  if (cleanTeacher.includes(cleanChecked) || cleanChecked.includes(cleanTeacher)) return true;

  // Split by first name / last name to check partial matches
  const teacherParts = String(teacherName).trim().split(/\s+/);
  const checkedParts = String(checkedBy).trim().split(/\s+/);

  if (teacherParts.length > 0 && checkedParts.length > 0) {
    const cleanTeacherFirst = cleanThaiTeacherName(teacherParts[0]);
    const cleanCheckedFirst = cleanThaiTeacherName(checkedParts[0]);
    if (cleanTeacherFirst && cleanCheckedFirst && cleanTeacherFirst === cleanCheckedFirst) {
      // If last names are also provided, check them
      if (teacherParts.length > 1 && checkedParts.length > 1) {
        const cleanTeacherLast = cleanThaiTeacherName(teacherParts[1]);
        const cleanCheckedLast = cleanThaiTeacherName(checkedParts[1]);
        if (cleanTeacherLast === cleanCheckedLast) return true;
      } else {
        return true;
      }
    }
  }

  return false;
}

