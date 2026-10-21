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
 * Extracts the canonical dormitory number (1-99), e.g.:
 * "หอพักล้านนา 2 (ชาย)" -> "2"
 * "หอพัก 2 (ชาย)" -> "2"
 * "dorm-2" -> "2"
 * "2" -> "2"
 * Safely ignores timestamp IDs (e.g. "dorm-1785819050326").
 */
export function extractDormNumber(str?: string | null): string {
  if (!str) return "";
  const s = String(str).trim();
  if (!s) return "";

  // If the string is a pure timestamp or starts with dorm-timestamp (>= 6 digits)
  // e.g. "dorm-1785819050326" or "1785819050326"
  if (/^dorm-\d{6,}/i.test(s) || /^\d{6,}$/.test(s)) {
    return "";
  }

  // Look for explicit dorm patterns: "หอพัก 2", "หอพักล้านนา 2", "หอ 2", "ล้านนา 2", "dorm-2", "dorm 2", "อาคาร 2"
  const prefixMatch = s.match(/(?:หอพัก|หอ|dorm|ล้านนา|อาคาร)?\s*([0-9]{1,3})\b/i);
  if (prefixMatch && prefixMatch[1]) {
    const num = parseInt(prefixMatch[1], 10);
    if (num > 0 && num < 1000) {
      return String(num);
    }
  }

  // Look for word-bounded 1-2 digit number
  const wordNum = s.match(/\b([0-9]{1,2})\b/);
  if (wordNum && wordNum[1]) {
    return String(parseInt(wordNum[1], 10));
  }

  const anyNum = s.match(/[0-9]+/);
  if (anyNum && anyNum[0].length <= 3) {
    return String(parseInt(anyNum[0], 10));
  }

  return "";
}

/**
 * Normalizes a dormitory name by stripping common prefixes, words, and noise.
 * e.g. "หอพักล้านนา 2 (ชาย)" -> "2"
 * "หอพัก 2 (ชาย)" -> "2"
 * "หอ 2" -> "2"
 * "dorm-2" -> "2"
 */
export function normalizeDormName(str?: string | null): string {
  if (!str) return "";
  let s = String(str).trim().toLowerCase();
  // Strip common words and noise
  s = s.replace(/^(หอพัก|หอ|dorm|อาคาร|เรือนนอน)\s*/g, "");
  s = s.replace(/ล้านนา\s*/g, "");
  s = s.replace(/\((ชาย|หญิง|ช|ญ|male|female|all|รวม)\)/g, "");
  s = s.replace(/(ชาย|หญิง|male|female|all|รวม)$/g, "");
  s = s.replace(/[\s\-_()]/g, "");
  return s;
}

/**
 * Robustly checks if a student belongs to a given dormitory.
 * Handles cases where dormId is stored as dorm.id, dorm.name, numeric id, or variations (such as "หอพักล้านนา 2 (ชาย)" vs "dorm-2" vs "หอพัก 2").
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

  // 3. Cleaned dorm name matching (strips "หอพัก", "ล้านนา", "(ชาย)", etc.)
  const cleanS = normalizeDormName(sDormId);
  const cleanDId = normalizeDormName(dId);
  const cleanDName = normalizeDormName(dName);

  if (cleanS && (cleanS === cleanDId || cleanS === cleanDName)) {
    return true;
  }

  // 4. Canonical dorm number matching (e.g. 2 for "หอพักล้านนา 2 (ชาย)" and "dorm-2")
  const sNum = extractDormNumber(sDormId);
  const dNameNum = extractDormNumber(dName);
  const dIdNum = extractDormNumber(dId);
  const targetDormNum = dNameNum || dIdNum;

  if (sNum && targetDormNum && sNum === targetDormNum) {
    return true;
  }

  // 5. Thai prefix variations containment check
  if (normName && normS && (normName.includes(normS) || normS.includes(normName))) {
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

  const cleanT = normalizeDormName(target);
  const cleanDId = normalizeDormName(dId);
  const cleanDName = normalizeDormName(dName);

  if (cleanT && (cleanT === cleanDId || cleanT === cleanDName)) return true;

  const tNum = extractDormNumber(target);
  const dNameNum = extractDormNumber(dName);
  const dIdNum = extractDormNumber(dId);
  const targetDormNum = dNameNum || dIdNum;

  if (tNum && targetDormNum && tNum === targetDormNum) return true;

  if (normName && normT && (normName.includes(normT) || normT.includes(normName))) return true;

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
 * Checks if a name is a generic placeholder, sample/mock data, or system-generated text.
 * ห้ามใช้ชื่อที่มาจากข้อมูลตัวอย่าง หรือชื่อตำแหน่ง/ระบบแทนชื่อบุคคลจริง
 */
export function isPlaceholderTeacherName(name?: string | null): boolean {
  if (!name) return true;
  const cleaned = String(name).trim();
  if (
    !cleaned ||
    cleaned === "-" ||
    cleaned === "ยังไม่ระบุ" ||
    cleaned === "ยังไม่มี" ||
    cleaned === "default-1" ||
    cleaned === "undefined" ||
    cleaned === "null"
  ) {
    return true;
  }

  const lower = cleaned.toLowerCase();
  if (
    lower.includes("admin") ||
    lower.includes("administrator") ||
    lower.includes("staff") ||
    lower.includes("sample") ||
    lower.includes("demo") ||
    lower.includes("mock") ||
    lower.includes("placeholder") ||
    lower.includes("test")
  ) {
    return true;
  }

  if (
    cleaned.includes("ตัวอย่าง") ||
    cleaned.includes("ทดสอบ") ||
    cleaned.includes("ระบบอัตโนมัติ") ||
    cleaned.includes("ผู้ดูแลระบบ") ||
    cleaned.includes("เจ้าหน้าที่") ||
    cleaned.includes("ผู้ใช้งาน") ||
    cleaned.includes("ครูประจำหอ") ||
    cleaned.includes("ครูหอพัก") ||
    cleaned.includes("ผู้ดูแลหอ") ||
    cleaned.includes("เจ้าหน้าที่หอ") ||
    cleaned.includes("Dorm Teacher") ||
    cleaned.includes("Staff Officer") ||
    cleaned.includes("System Admin")
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts and cleans the list of all teachers for a given dormitory.
 * ONLY includes real teachers from User Profiles (ชื่อผู้ใช้จากฐานข้อมูลผู้ใช้) who are assigned to this dorm.
 * Never creates or returns system-generated fallback teacher names, and does not show unlinked teacher strings.
 * Accurately cross-references and verifies phone numbers and positions with User Profile data.
 */
export function getDormTeachers(dorm: Dormitory | null | undefined, users?: UserProfile[]): DormTeacher[] {
  if (!dorm) return [];
  if (!Array.isArray(users) || users.length === 0) return [];

  const teacherMap = new Map<string, DormTeacher>();

  // Format/sanitize phone number
  const resolvePhone = (userPhone?: string): string => {
    if (userPhone && userPhone.trim() && userPhone.trim() !== "-") {
      return userPhone.trim();
    }
    return "-";
  };

  // Derive ONLY from real User Profiles assigned to this dormitory
  const matchingUsers = users.filter((u) => {
    if (!u || !u.name || isPlaceholderTeacherName(u.name)) return false;

    // Check if user is associated with this dorm
    const isPrimaryDorm = u.dormId === dorm.id || (u.dormId ? isDormMatch(dorm, u.dormId) : false);
    const isAllowedDorm = Array.isArray(u.allowedDormIds) && u.allowedDormIds.some((dId) => dId === dorm.id || isDormMatch(dorm, dId));

    if (!isPrimaryDorm && !isAllowedDorm) return false;

    // Must be a Dorm Teacher user (Level 3 or DORM_TEACHER role or users with teacher positions)
    // Exclude Admin Level 1 / Staff Level 2 if they are not dorm teachers
    if (u.roleLevel === 1 || u.roleLevel === 2) {
      if (u.roleCategory !== "DORM_TEACHER" && !u.dormPosition) {
        return false;
      }
    }

    return true;
  });

  matchingUsers.forEach((u, index) => {
    const cleanKey = cleanThaiTeacherName(u.name) || `user-${u.id || index}`;
    const rawPos = (u.dormPosition || "").trim();
    const pos = normalizeDormPosition(rawPos, undefined, false);
    const isHead = pos === "ครูประธานหอพัก" || u.role === "HEAD_TEACHER" || rawPos.includes("ประธาน");
    const phone = resolvePhone(u.phone);

    teacherMap.set(cleanKey, {
      id: u.id || `u-t-${index}`,
      name: u.name.trim(),
      phone,
      position: pos,
      isHead
    });
  });

  // If no user-added teachers were found, return empty array (do NOT generate default fake names)
  if (teacherMap.size === 0) {
    return [];
  }

  // Sort in hierarchical position order:
  // 1. ครูประธานหอพัก / HEAD_TEACHER / ประธาน
  // 2. ครูรองประธานหอพัก
  // 3. ครูหัวหน้าหอพัก
  // 4. ครูประจำหอพัก
  // 5. others
  const positionWeight = (pos?: string, isHead?: boolean): number => {
    const p = (pos || "").trim();
    if (p.includes("ประธาน") && !p.includes("รอง")) return 1;
    if (isHead) return 1;
    if (p.includes("รองประธาน")) return 2;
    if (p.includes("หัวหน้า")) return 3;
    if (p.includes("ประจำ")) return 4;
    return 5;
  };

  return Array.from(teacherMap.values()).sort((a, b) => {
    const wA = positionWeight(a.position, a.isHead);
    const wB = positionWeight(b.position, b.isHead);
    if (wA !== wB) return wA - wB;
    return a.name.localeCompare(b.name, "th");
  });
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

/**
 * Accurately determines dormitory type ("male" | "female" | "mixed").
 * Checks dorm.type, dorm.gender, and analyzes the dorm name if missing.
 */
export function getDormType(dorm: Dormitory | null | undefined): "male" | "female" | "mixed" {
  if (!dorm) return "male";
  if (dorm.type === "female" || dorm.gender === "female") return "female";
  if (dorm.type === "mixed" || dorm.gender === "mixed") return "mixed";
  if (dorm.type === "male" || dorm.gender === "male") return "male";

  // Name based deduction
  const name = String(dorm.name || "").toLowerCase();
  if (name.includes("หญิง") || name.includes("female") || name.includes("ญ")) return "female";
  if (name.includes("รวม") || name.includes("mixed")) return "mixed";
  return "male";
}

/**
 * Returns formatted Thai label for dormitory type.
 */
export function getDormTypeLabel(dorm: Dormitory | null | undefined, full: boolean = false): string {
  const t = getDormType(dorm);
  if (t === "female") return full ? "หอพักหญิง" : "หญิง";
  if (t === "mixed") return full ? "หอพักรวม" : "รวม";
  return full ? "หอพักชาย" : "ชาย";
}

/**
 * Returns Tailwind CSS badge classes for dormitory type.
 */
export function getDormTypeBadgeStyle(dorm: Dormitory | null | undefined): string {
  const t = getDormType(dorm);
  if (t === "female") return "bg-pink-100 text-pink-700 border border-pink-200";
  if (t === "mixed") return "bg-purple-100 text-purple-700 border border-purple-200";
  return "bg-blue-100 text-blue-700 border border-blue-200";
}

/**
 * Returns abbreviated dormitory name, e.g. "หอ 1", "หอ 2", "หอ 6".
 */
export function formatDormShort(dormNameOrObj?: string | Dormitory | null): string {
  if (!dormNameOrObj) return "-";
  const name = typeof dormNameOrObj === "string" ? dormNameOrObj : dormNameOrObj.name || dormNameOrObj.id || "";
  const trimmed = name.trim();
  const num = extractDormNumber(trimmed);
  if (num) {
    return `หอ ${num}`;
  }
  if (trimmed.startsWith("หอพัก")) {
    return trimmed.replace(/^หอพัก\s*/, "หอ ");
  }
  return trimmed || "-";
}

/**
 * Cleans a bed value by trimming whitespace and normalizing duplicated "เตียง เตียง" prefixes if any,
 * while preserving the user's entered text and format (e.g. "1", "2", "เตียง 1", "เตียงคู่ 1", "1A").
 */
export function cleanBedValue(bed: string | number | undefined | null): string {
  if (bed === undefined || bed === null) return "";
  let s = String(bed).trim();
  if (!s || s === "-") return "";
  // Strip duplicate "เตียง เตียง" prefixes if present
  while (/^(เตียง\s*){2,}/i.test(s)) {
    s = s.replace(/^(เตียง\s*){2,}/i, "เตียง ").trim();
  }
  return s;
}

/**
 * Formats a bed value for display.
 * If the value already includes "เตียง" (e.g. "เตียง 1", "เตียงคู่ 2"), display as is.
 * If the value is a number or alphanumeric code (e.g. "1", "2", "1A"), prefix with "เตียง ".
 * If empty and defaultIdx is provided, outputs `เตียง ${defaultIdx}`.
 * If empty and no defaultIdx, returns "-".
 */
export function formatBedDisplay(bed: string | number | undefined | null, defaultIdx?: number): string {
  if (bed === undefined || bed === null) {
    if (defaultIdx !== undefined && defaultIdx !== null) {
      return `เตียง ${defaultIdx}`;
    }
    return "-";
  }
  let s = cleanBedValue(bed);
  if (!s || s === "-") {
    if (defaultIdx !== undefined && defaultIdx !== null) {
      return `เตียง ${defaultIdx}`;
    }
    return "-";
  }
  if (s.startsWith("เตียง")) {
    return s;
  }
  return `เตียง ${s}`;
}

/**
 * Parses numeric bed number for sorting (e.g. 1, 2, "เตียง 1", "เตียงคู่ 2", "1A").
 */
export function parseBedNumber(bedVal: string | number | undefined | null): number {
  if (bedVal === undefined || bedVal === null || String(bedVal).trim() === "") return 99999;
  const num = parseInt(String(bedVal).replace(/\D/g, ""), 10);
  return isNaN(num) ? 99999 : num;
}



