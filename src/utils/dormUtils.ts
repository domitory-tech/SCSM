import { Dormitory, Student } from "../types";

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
