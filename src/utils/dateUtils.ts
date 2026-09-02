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
  navigationPermissions: DEFAULT_ROLE_NAVIGATION_PERMISSIONS
};

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

export function getDashboardDefaultDate(todayAttendanceMap?: Record<string, any> | null): string {
  const now = new Date();
  const currentHour = now.getHours(); // 0 - 23
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  const isAfter20 = currentHour >= 20;

  let hasTodayCheckStarted = false;
  if (todayAttendanceMap && Object.keys(todayAttendanceMap).length > 0) {
    const attList = Object.values(todayAttendanceMap);
    hasTodayCheckStarted = attList.some((att) => {
      if (!att) return false;
      return (
        att.status === "CHECKED" ||
        att.status === "HOME_BREAK" ||
        (att.records && Array.isArray(att.records) && att.records.length > 0)
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
  const trimmed = grade.trim();
  let gradeShort = trimmed;
  if (trimmed.startsWith("มัธยมศึกษาปีที่")) {
    const num = trimmed.replace("มัธยมศึกษาปีที่", "").trim();
    gradeShort = `ม.${num}`;
  } else if (trimmed.startsWith("ประถมศึกษาปีที่")) {
    const num = trimmed.replace("ประถมศึกษาปีที่", "").trim();
    gradeShort = `ป.${num}`;
  } else if (!trimmed.startsWith("ม.") && !trimmed.startsWith("ป.")) {
    const num = trimmed.replace(/[^0-9]/g, "");
    if (num) {
      gradeShort = `ม.${num}`;
    }
  }

  if (gradeShort.includes("/")) {
    return gradeShort;
  }

  if (room !== undefined && room !== null && String(room).trim() !== "") {
    return `${gradeShort}/${room}`;
  }
  return gradeShort;
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


