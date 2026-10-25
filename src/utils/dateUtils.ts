import { SystemSettings } from "../types";
import { DEFAULT_ROLE_NAVIGATION_PERMISSIONS } from "./permissionUtils";

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  schoolNameTh: "โรงเรียนพิจิตรปัญญานุกูล",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "พ.จ.ป.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "ระบบบริหารจัดการหอพักนักเรียน",
  systemNameEn: "Student Dormitory Management System",
  systemTitleTh: "ระบบบริหารจัดการหอพักนักเรียน - โรงเรียนพิจิตรปัญญานุกูล",
  systemTitleEn: "Student Dormitory Management System - Pichit Panyanukul School",
  systemIcon: "building",
  lastUpdatedDate: "24 กรกฎาคม พ.ศ. 2569",
  maintenanceTitle: "แจ้งการปรับปรุงระบบและข่าวสาร",
  maintenanceMessage: "",
  showMaintenancePopup: false,
  showMaintenanceBox: false,
  isAttendancePaused: false,
  pausedDormIds: [],
  attendancePauseReason: "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่",
  attendancePausedAt: "",
  attendancePausedBy: "",
  navigationPermissions: DEFAULT_ROLE_NAVIGATION_PERMISSIONS
};

export function isDormAttendancePaused(dormId: string, settings?: SystemSettings): boolean {
  if (!settings) return false;
  if (settings.isAttendancePaused) return true;
  if (Array.isArray(settings.pausedDormIds) && settings.pausedDormIds.includes(dormId)) {
    return true;
  }
  return false;
}

export function getTodayDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date()); // YYYY-MM-DD
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export function getYesterdayDateString(): string {
  const todayStr = getTodayDateString();
  return getPreviousDateString(todayStr);
}

/**
 * Checks whether an attendance record status or reason must be EXCLUDED from "ยอดนักเรียนออกบ้าน"
 * (ยอดนักเรียนออกหอพัก / ออกบ้าน)
 * 
 * Excluded categories:
 * 1. ปิดภาคเรียน (SEMESTER_BREAK)
 * 2. รอบกลับบ้าน (ROUND_HOME / HOME_BREAK)
 * 3. ยังไม่เข้าหอพัก (NOT_ARRIVED)
 */
export function isExcludedFromHomeOut(status?: string, reason?: string, note?: string): boolean {
  if (!status && !reason && !note) return false;
  const s = (status || "").toUpperCase();
  const r = (reason || "").trim();
  const n = (note || "").trim();

  // 1. ปิดภาคเรียน
  if (s === "SEMESTER_BREAK") return true;
  if (r.includes("ปิดภาคเรียน") || n.includes("ปิดภาคเรียน")) return true;

  // 2. รอบกลับบ้าน
  if (s === "ROUND_HOME" || s === "HOME_BREAK") return true;
  if (r.includes("รอบกลับ") || r === "รบ" || n.includes("รอบกลับ") || n === "รบ") return true;

  // 3. ยังไม่เข้าหอพัก
  if (s === "NOT_ARRIVED") return true;
  if (r.includes("ยังไม่เข้า") || n.includes("ยังไม่เข้า")) return true;

  return false;
}

export function getPreviousDateString(dateStr: string): string {
  if (!dateStr) return getYesterdayDateString();
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getYesterdayDateString();
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const prevY = dt.getFullYear();
  const prevM = String(dt.getMonth() + 1).padStart(2, "0");
  const prevD = String(dt.getDate()).padStart(2, "0");
  return `${prevY}-${prevM}-${prevD}`;
}

export function getNextDateString(dateStr: string): string {
  if (!dateStr) return getTodayDateString();
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getTodayDateString();
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const nextY = dt.getFullYear();
  const nextM = String(dt.getMonth() + 1).padStart(2, "0");
  const nextD = String(dt.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

export function getDashboardDefaultDate(todayAttendanceMap?: Record<string, any> | null): string {
  // Default to yesterday's date (ข้อมูลของการเช็คยอดล่าสุดเมื่อคืนที่ผ่านมา)
  return getYesterdayDateString();
}

/**
 * Determines whether an attendance record is a genuine, completed check entered into the system
 * (excludes pending drafts or auto-generated carry-over records).
 */
export function isRealAttendanceCheck(att: any): boolean {
  if (!att) return false;
  if (att.checkedBy && typeof att.checkedBy === "string" && att.checkedBy.includes("ระบบอัตโนมัติ")) {
    return false;
  }
  if (att.status === "PENDING") {
    return false;
  }
  if (att.status === "CHECKED" || att.status === "HOME_BREAK" || att.isHomeBreak) {
    return true;
  }
  if (att.status === "SEMESTER_BREAK" && !att.checkedBy?.includes("ระบบอัตโนมัติ")) {
    return true;
  }
  if (Array.isArray(att.records) && att.records.length > 0) {
    const hasManualRecord = att.records.some(
      (r: any) => !r.note?.includes("เช็คยอดอัตโนมัติ") && !r.note?.includes("อัตโนมัติ")
    );
    return hasManualRecord;
  }
  return false;
}

/**
 * Returns the latest checked attendance date.
 * If today has a real checked attendance entered into the system, automatically returns today.
 * Otherwise, returns the latest checked attendance date from last night (<= yesterday).
 * เช่น วันนี้วันที่ 25 ตุลาคม 2569 ถ้ายังไม่มีการเช็คยอด จะนำผลการเช็คยอดของคืนวันที่ 24 ตุลาคม 2569 มาแสดง
 * จนกว่าจะมีการเช็คยอดของวันที่ 25 ตุลาคม 2569 เข้าสู่ระบบ จึงให้ระบบแสดงเป็นวันที่ 25 ตุลาคม 2569 อัตโนมัติ
 */
export function getLatestCheckedAttendanceDate(
  checkedDates: string[] = [],
  todayAttendanceMap?: Record<string, any> | null
): string {
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  // 1. Check if today has a real check entered into the system
  let hasTodayRealCheck = false;
  if (todayAttendanceMap && typeof todayAttendanceMap === "object" && Object.keys(todayAttendanceMap).length > 0) {
    const attList = Object.values(todayAttendanceMap);
    hasTodayRealCheck = attList.some((att) => {
      if (!att || att.date !== todayStr) return false;
      return isRealAttendanceCheck(att);
    });
  }

  // If today has checked attendance in the system
  if (hasTodayRealCheck) {
    return todayStr;
  }

  // 2. Otherwise, find the latest checked date strictly <= yesterdayStr (ผลการเช็คยอดล่าสุดเมื่อคืนที่ผ่านมา)
  const validDates = checkedDates
    .filter((d) => d && typeof d === "string" && d <= yesterdayStr)
    .sort((a, b) => b.localeCompare(a));

  if (validDates.length > 0) {
    return validDates[0];
  }

  // Fallback to yesterday date string (เมื่อคืนที่ผ่านมา)
  return yesterdayStr;
}

export function formatThaiFullDate(dateStr: string, includeDayOfWeek: boolean = true): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม"
  ];

  const dayOfWeek = thaiDays[d.getDay()];
  const dayOfMonth = d.getDate();
  const monthName = thaiMonths[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  if (includeDayOfWeek) {
    return `วัน${dayOfWeek} ที่ ${dayOfMonth} เดือน${monthName} พ.ศ. ${yearBE}`;
  }
  return `${dayOfMonth} เดือน${monthName} พ.ศ. ${yearBE}`;
}

export function formatThaiMediumDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม"
  ];

  const dayOfMonth = d.getDate();
  const monthName = thaiMonths[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  return `${dayOfMonth} ${monthName} พ.ศ. ${yearBE}`;
}

export function getDirectImageUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();

  // Handle Google Drive share links
  // Example: https://drive.google.com/file/d/1ABC123xyz/view?usp=sharing
  // Example: https://drive.google.com/open?id=1ABC123xyz
  // Example: https://drive.google.com/uc?id=1ABC123xyz
  const fileIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (fileIdMatch && fileIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }

  return trimmed;
}

export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม"
];

export const THAI_DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const THAI_DAYS_FULL = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์"
];

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatThaiMonthYear(year: number, month: number): string {
  const monthName = THAI_MONTHS[month - 1] || "";
  const yearBE = year + 543;
  return `เดือน${monthName} พ.ศ. ${yearBE}`;
}

export function formatThaiMonthString(ymStr: string): string {
  if (!ymStr) return "";
  const [y, m] = ymStr.split("-").map(Number);
  if (!y || !m) return ymStr;
  return formatThaiMonthYear(y, m);
}

export function formatThaiDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";
  return `${formatThaiFullDate(startDate)} ถึง ${formatThaiFullDate(endDate)}`;
}

export function formatGradeRoomFullTitle(grade: string, room: number | string): string {
  if (!grade) return `ห้อง ${room}`;
  const trimmed = grade.trim();
  if (trimmed.startsWith("ม.")) {
    const num = trimmed.replace("ม.", "").trim();
    return `มัธยมศึกษาปีที่ ${num}/${room}`;
  }
  if (trimmed.startsWith("ป.")) {
    const num = trimmed.replace("ป.", "").trim();
    return `ประถมศึกษาปีที่ ${num}/${room}`;
  }
  if (trimmed.startsWith("มัธยมศึกษาปีที่")) {
    const num = trimmed.replace("มัธยมศึกษาปีที่", "").trim();
    return `มัธยมศึกษาปีที่ ${num}/${room}`;
  }
  return `${trimmed}/${room}`;
}

export function formatGradeRoomShort(grade?: string, room?: number | string): string {
  if (!grade) return room !== undefined && room !== null ? `ห้อง ${room}` : "-";
  let trimmed = grade.trim();

  // Normalize "มัธยมศึกษาปีที่" or "ชั้นมัธยมศึกษาปีที่"
  trimmed = trimmed.replace(/^(ชั้น)?มัธยมศึกษาปีที่\s*/, "ม.");
  // Normalize "ประถมศึกษาปีที่" or "ชั้นประถมศึกษาปีที่"
  trimmed = trimmed.replace(/^(ชั้น)?ประถมศึกษาปีที่\s*/, "ป.");
  // Remove space after "ม." or "ป." e.g. "ม. 1" -> "ม.1"
  trimmed = trimmed.replace(/^([มป])\.\s+/, "$1.");

  // If already contains slash e.g. "ม.1/1" or "1/1"
  if (trimmed.includes("/")) {
    trimmed = trimmed.replace(/\s*\/\s*/, "/");
    if (!trimmed.startsWith("ม.") && !trimmed.startsWith("ป.")) {
      const matchNum = trimmed.match(/^(\d+)\/(\d+)$/);
      if (matchNum) {
        return `ม.${matchNum[1]}/${matchNum[2]}`;
      }
    }
    return trimmed;
  }

  // If numeric only e.g. "1" -> "ม.1"
  if (!trimmed.startsWith("ม.") && !trimmed.startsWith("ป.")) {
    const num = trimmed.replace(/[^0-9]/g, "");
    if (num) {
      trimmed = `ม.${num}`;
    }
  }

  if (room !== undefined && room !== null && String(room).trim() !== "") {
    return `${trimmed}/${String(room).trim()}`;
  }
  return trimmed;
}

/**
 * Normalizes a student's grade string into a canonical grade level, e.g. "ม.1" to "ม.6" or "ป.1" to "ป.6".
 * Handles formats: "1", "2", "ม.1", "ม. 1", "ม1", "มัธยมศึกษาปีที่ 1", "ม.1/1", "ชั้น ม.1", "1/1".
 */
export function normalizeGradeLevel(grade?: string | number | null): string {
  if (grade === undefined || grade === null) return "";
  const s = String(grade).trim();
  if (!s) return "";

  // If already standard e.g. "ม.1" - "ม.6"
  if (/^ม\.[1-6]$/.test(s)) return s;

  // Match secondary school grade pattern: "ม.1", "ม. 1", "ม1", "มัธยมศึกษาปีที่ 1", "ชั้น ม.1", "ม.1/2"
  const mMatch = s.match(/(?:มัธยมศึกษาปีที่|ชั้น\s*ม\.?|ม\.?)\s*([1-6])(?:\/|\b|$)/);
  if (mMatch && mMatch[1]) {
    return `ม.${mMatch[1]}`;
  }

  // Match primary school pattern: "ป.1", "ป. 1", "ป1", "ประถมศึกษาปีที่ 1"
  const pMatch = s.match(/(?:ประถมศึกษาปีที่|ชั้น\s*ป\.?|ป\.?)\s*([1-6])(?:\/|\b|$)/);
  if (pMatch && pMatch[1]) {
    return `ป.${pMatch[1]}`;
  }

  // If numeric only: "1" -> "ม.1", "1/1" -> "ม.1"
  const numMatch = s.match(/^([1-6])(?:\/.*|\b|$)/);
  if (numMatch && numMatch[1]) {
    return `ม.${numMatch[1]}`;
  }

  // Fallback: check if contains any digit 1-6
  const anyDigit = s.match(/[1-6]/);
  if (anyDigit) {
    return `ม.${anyDigit[0]}`;
  }

  return s;
}

/**
 * Checks if a student's grade matches a target grade (e.g. "ม.1", "ม.2", "1", "ม. 1").
 */
export function isGradeMatch(studentGrade?: string | number | null, targetGrade?: string | number | null): boolean {
  if (studentGrade === undefined || studentGrade === null || targetGrade === undefined || targetGrade === null) {
    return false;
  }
  const s = String(studentGrade).trim();
  const t = String(targetGrade).trim();
  if (!s || !t) return false;

  if (s === t) return true;

  const normS = normalizeGradeLevel(s);
  const normT = normalizeGradeLevel(t);

  if (normS && normT && normS === normT) return true;

  return false;
}

/**
 * คัดแยกเพศนักเรียน (ชาย/หญิง) จากคำนำหน้านามตามเงื่อนไข:
 * เพศชาย = เด็กชาย, ด.ช., นาย
 * เพศหญิง = เด็กหญิง, ด.ญ., นาง, นางสาว (รวมถึง น.ส.)
 */
export function detectStudentGender(
  title?: string,
  firstName?: string,
  fallbackGender?: string
): "male" | "female" {
  const t = (title || "").trim();
  const fn = (firstName || "").trim();

  // กรองเพศหญิง: เด็กหญิง, ด.ญ., นาง, นางสาว (รวม น.ส.)
  if (
    t.startsWith("เด็กหญิง") ||
    t.startsWith("ด.ญ.") ||
    t.startsWith("ด.ญ") ||
    t.startsWith("นางสาว") ||
    t.startsWith("นาง") ||
    t.startsWith("น.ส.") ||
    t.startsWith("น.ส") ||
    fn.startsWith("เด็กหญิง") ||
    fn.startsWith("ด.ญ.") ||
    fn.startsWith("ด.ญ") ||
    fn.startsWith("นางสาว") ||
    fn.startsWith("นาง") ||
    fn.startsWith("น.ส.") ||
    fn.startsWith("น.ส")
  ) {
    return "female";
  }

  // กรองเพศชาย: เด็กชาย, ด.ช., นาย
  if (
    t.startsWith("เด็กชาย") ||
    t.startsWith("ด.ช.") ||
    t.startsWith("ด.ช") ||
    t.startsWith("นาย") ||
    fn.startsWith("เด็กชาย") ||
    fn.startsWith("ด.ช.") ||
    fn.startsWith("ด.ช") ||
    fn.startsWith("นาย")
  ) {
    return "male";
  }

  // Fallback
  if (fallbackGender === "female" || fallbackGender === "FEMALE" || fallbackGender === "หญิง") {
    return "female";
  }
  return "male";
}


