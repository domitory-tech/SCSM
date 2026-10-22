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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const day = String(yesterday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const now = new Date();
  const currentHour = now.getHours(); // 0 - 23
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  const isAfter20 = currentHour >= 20;

  let hasTodayCheckStarted = false;
  if (todayAttendanceMap && typeof todayAttendanceMap === "object" && Object.keys(todayAttendanceMap).length > 0) {
    const attList = Object.values(todayAttendanceMap);
    hasTodayCheckStarted = attList.some((att) => {
      if (!att) return false;
      return (
        att.status === "CHECKED" ||
        att.status === "HOME_BREAK" ||
        att.status === "SEMESTER_BREAK" ||
        att.isHomeBreak ||
        (Array.isArray(att.records) && att.records.length > 0)
      );
    });
  }

  // Today's data is displayed IF today's check has started OR if current time is after 20.00
  if (hasTodayCheckStarted || isAfter20) {
    return todayStr;
  }

  // Otherwise, default to yesterday's date (ข้อมูลของเมื่อคืน)
  return yesterdayStr;
}

/**
 * Returns the most recent date that has checked attendance data.
 * Checks today first; if not checked today, finds the latest date in checkedDates list <= today.
 */
export function getLatestCheckedAttendanceDate(
  checkedDates: string[] = [],
  todayAttendanceMap?: Record<string, any> | null
): string {
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  // 1. Check if today has checked attendance or active check
  let hasTodayChecked = false;
  if (todayAttendanceMap && typeof todayAttendanceMap === "object" && Object.keys(todayAttendanceMap).length > 0) {
    const attList = Object.values(todayAttendanceMap);
    hasTodayChecked = attList.some((att) => {
      if (!att) return false;
      return (
        att.status === "CHECKED" ||
        att.status === "HOME_BREAK" ||
        att.status === "SEMESTER_BREAK" ||
        att.isHomeBreak ||
        (Array.isArray(att.records) && att.records.length > 0)
      );
    });
  }

  if (hasTodayChecked || checkedDates.includes(todayStr)) {
    return todayStr;
  }

  // 2. Look for the most recent checked date in history (<= today)
  const validDates = checkedDates
    .filter((d) => d && typeof d === "string" && d <= todayStr)
    .sort((a, b) => b.localeCompare(a));

  if (validDates.length > 0) {
    return validDates[0];
  }

  // 3. Fallback to yesterday or today if no records exist
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


