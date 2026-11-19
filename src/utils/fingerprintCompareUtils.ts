import * as XLSX from "xlsx";
import { AttendanceStatus, DailyAttendance, Dormitory, Student } from "../types";
import { formatStudentId } from "./studentUtils";
import { formatThaiFullDate, formatThaiMediumDate, getPreviousDateString, normalizeGradeLevel, isDormPresentStatus } from "./dateUtils";
import { isDormMatch, matchStudentToDorm } from "./dormUtils";

export interface RawScannerRow {
  rowIndex: number;
  rawId: string;
  normalizedCode: string;
  rawName: string;
  rawDate: string;
  isoDate: string; // YYYY-MM-DD (Gregorian) or ""
  scanTime: string; // HH:MM or HH:MM:SS
  rawColumns: string[];
}

export interface ParsedScannerTable {
  headers: string[];
  rows: string[][];
  detectedColumns: {
    idCol: number;
    nameCol: number;
    lastNameCol: number;
    dateCol: number;
    timeCol: number;
  };
  headerRowIndex: number;
  fileName: string;
}

export interface ScannerMatchInfo {
  rawId: string;
  normalizedCode: string;
  rawName: string;
  scanDates: string[];
  scanTimes: string[]; // sorted ascending
  earliestTime: string;
  scanCount: number;
  matchMethod: "EXACT_ID" | "LAST_5_CHARS" | "UNPADDED_ID" | "NAME";
}

export type ComparisonCategory =
  | "PRESENT_NOT_SCANNED" // อยู่หอพัก แต่ไม่สแกนนิ้ว (สาย - ไม่สแกน)
  | "OUT_CONFIRMED" // ออกหอพัก (ไม่พบสแกนนิ้ว)
  | "OUT_BUT_SCANNED" // แจ้งออกหอพัก แต่พบสแกนนิ้ว (ขัดแย้ง)
  | "PRESENT_SCANNED" // อยู่หอพัก และสแกนนิ้วแล้ว
  | "UNCHECKED_SCANNED" // หอพักยังไม่ได้เช็คยอด แต่สแกนนิ้วแล้ว
  | "UNCHECKED_NOT_SCANNED"; // หอพักยังไม่ได้เช็คยอด และไม่พบสแกนนิ้ว

export type PunctualityStatus =
  | "EARLY" // สแกนก่อนเวลาที่กำหนด
  | "ON_TIME" // สแกนภายในเวลาที่กำหนด
  | "LATE_SCANNED" // สแกนหลังเวลาที่กำหนด -> สาย(เวลาที่เกินมา)
  | "LATE_NOT_SCANNED" // ไม่สแกน -> สาย(ไม่สแกน)
  | "SCANNED_NO_TIME" // สแกนแล้วแต่ในไฟล์ไม่มีข้อมูลเวลา
  | "QUARANTINE_EXEMPT" // อยู่หอพัก (กักตัว) ไม่นับสายกรณีไม่สแกนหรือสแกนสาย
  | "OUT_OF_DORM"; // ออกหอพักตามระบบ

export interface StudentComparisonItem {
  student: Student;
  dorm?: Dormitory;
  dormName: string;
  formattedId: string;
  fullName: string;
  gradeRoom: string;
  dormChecked: boolean;
  dormStatus: AttendanceStatus | "PENDING";
  dormStatusLabel: string;
  dormReason: string;
  isDormOut: boolean;
  hasScanned: boolean;
  scannerInfo?: ScannerMatchInfo;
  category: ComparisonCategory;
  punctualityStatus: PunctualityStatus;
  punctualityLabel: string;
  punctualityDetail: string;
  overMinutes: number; // > 0 when scanned after endTime
  earlyMinutes: number; // > 0 when scanned before startTime
}

export interface UnmatchedScannerRecord {
  rawId: string;
  normalizedCode: string;
  rawName: string;
  rawDate: string;
  isoDate: string;
  scanTimes: string[];
  scanCount: number;
}

export const ATTENDANCE_STATUS_THAI: Record<string, string> = {
  PRESENT: "อยู่หอพัก",
  QUARANTINE: "อยู่หอพัก (กักตัว)",
  HOME: "กลับบ้าน",
  ROUND_HOME: "รอบกลับบ้าน",
  CAMP: "เข้าค่าย",
  SICK: "ป่วย",
  SKILL_COMP: "แข่งทักษะ",
  EXCHANGE: "นักเรียนแลกเปลี่ยน",
  WALK_STUDY: "เดินเรียน",
  SEMESTER_BREAK: "ปิดภาคเรียน",
  NOT_ARRIVED: "ยังไม่เข้าหอพัก",
  OTHER: "อื่นๆ",
  PENDING: "ยังไม่ได้เช็คยอด"
};

const THAI_MONTH_ABBR_MAP: Record<string, number> = {
  "ม.ค.": 1, "มกราคม": 1,
  "ก.พ.": 2, "กุมภาพันธ์": 2,
  "มี.ค.": 3, "มีนาคม": 3,
  "เม.ย.": 4, "เมษายน": 4,
  "พ.ค.": 5, "พฤษภาคม": 5,
  "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7,
  "ส.ค.": 8, "สิงหาคม": 8,
  "ก.ย.": 9, "กันยายน": 9,
  "ต.ค.": 10, "ตุลาคม": 10,
  "พ.ย.": 11, "พฤศจิกายน": 11,
  "ธ.ค.": 12, "ธันวาคม": 12
};

/**
 * Extracts the last 5 characters of any student ID format from the fingerprint scanner.
 * Examples:
 *  - "M-69-M-06068" -> "06068"
 *  - "P-68-M-05963" -> "05963"
 *  - "6068"         -> "06068"
 *  - "06068"        -> "06068"
 */
export function extractScannerStudentCode(rawId: string | number | null | undefined): string {
  if (rawId === null || rawId === undefined) return "";
  const str = String(rawId).trim();
  if (!str) return "";

  if (str.length >= 5) {
    return str.slice(-5).toUpperCase();
  }

  return formatStudentId(str).toUpperCase();
}

/**
 * Normalizes a Thai student name for fallback matching:
 * strips title prefixes ("นาย", "นางสาว", "เด็กชาย", "ด.ช.", "ด.ญ.", etc.)
 * and collapses whitespace.
 */
export function normalizeThaiStudentName(name: string | null | undefined): string {
  if (!name) return "";
  let s = String(name).trim();
  if (!s) return "";

  s = s.replace(/^(เด็กหญิง|เด็กชาย|นางสาว|ด\.ญ\.|ด\.ช\.|น\.ส\.|ด\.ญ|ด\.ช|น\.ส|นาย|นาง)\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Extracts and normalizes time strings like "06:35", "6.45", "07:12:30", "07.15 น." -> "HH:MM" or "HH:MM:SS".
 */
export function normalizeTimeString(rawTime: unknown): string {
  if (rawTime === null || rawTime === undefined) return "";

  if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
    const hh = String(rawTime.getHours()).padStart(2, "0");
    const mm = String(rawTime.getMinutes()).padStart(2, "0");
    const ss = rawTime.getSeconds();
    return ss > 0 ? `${hh}:${mm}:${String(ss).padStart(2, "0")}` : `${hh}:${mm}`;
  }

  if (typeof rawTime === "number" && !isNaN(rawTime) && rawTime >= 0 && rawTime < 1) {
    const totalSec = Math.round(rawTime * 86400);
    const hh = Math.floor(totalSec / 3600) % 24;
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return ss > 0
      ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
      : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const str = String(rawTime).trim();
  if (!str) return "";

  // Match HH:MM[:SS] or H.MM[:SS]
  const match = str.match(/\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*น\.?)?/);
  if (!match) return "";

  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ss = match[3] ? parseInt(match[3], 10) : 0;

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return "";

  return ss > 0
    ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Converts "HH:MM[:SS]" to total seconds from midnight, or null if invalid.
 */
export function timeStringToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [hh, mm, ss = 0] = parts;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return hh * 3600 + mm * 60 + ss;
}

/**
 * Formats seconds delta into readable Thai duration, e.g., "15 นาที", "1 ชม. 10 นาที", "45 วินาที".
 */
export function formatThaiDuration(totalSeconds: number): string {
  const absSec = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(absSec / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);
  const seconds = absSec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ชม.`);
  if (minutes > 0) parts.push(`${minutes} นาที`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds} วินาที`);
  if (parts.length === 0) return "0 นาที";
  return parts.join(" ");
}

/**
 * Parses Thai or Gregorian date strings or Excel serial values into { isoDate: "YYYY-MM-DD", scanTime: "HH:MM[:SS]" }.
 */
export function parseScannerDateTime(rawValue: unknown): { isoDate: string; scanTime: string } {
  if (rawValue === null || rawValue === undefined) {
    return { isoDate: "", scanTime: "" };
  }

  // Handle JS Date object
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    let year = rawValue.getFullYear();
    if (year >= 2400) year -= 543;
    const month = String(rawValue.getMonth() + 1).padStart(2, "0");
    const day = String(rawValue.getDate()).padStart(2, "0");
    const hh = rawValue.getHours();
    const mm = rawValue.getMinutes();
    const ss = rawValue.getSeconds();
    const hasTime = hh !== 0 || mm !== 0 || ss !== 0;
    const scanTime = hasTime
      ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${ss ? `:${String(ss).padStart(2, "0")}` : ""}`
      : "";
    return { isoDate: `${year}-${month}-${day}`, scanTime };
  }

  // Handle pure Excel numeric serial date
  if (typeof rawValue === "number" && !isNaN(rawValue) && rawValue > 20000) {
    const parsed = XLSX.SSF.parse_date_code(rawValue);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      let y = parsed.y;
      if (y >= 2400) y -= 543;
      const isoDate = `${y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      const hasTime = parsed.H > 0 || parsed.M > 0 || parsed.S > 0;
      const scanTime = hasTime
        ? `${String(parsed.H).padStart(2, "0")}:${String(parsed.M).padStart(2, "0")}${parsed.S ? `:${String(Math.floor(parsed.S)).padStart(2, "0")}` : ""}`
        : "";
      return { isoDate, scanTime };
    }
  }

  const str = String(rawValue).trim();
  if (!str) return { isoDate: "", scanTime: "" };

  // Numeric Excel serial passed as string
  if (/^\d{5,6}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 20000 && num < 400000) {
      return parseScannerDateTime(num);
    }
  }

  // Extract time component after date or standalone
  let scanTime = "";
  const timeMatch = str.match(/(?:\s|^)(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)(?:\s*น\.?)?(?:\s|$)/);
  if (timeMatch && timeMatch[1]) {
    scanTime = normalizeTimeString(timeMatch[1]);
  }

  // 1. DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY (Thai BE or Gregorian AD)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);

    if (year < 100) {
      year = year >= 40 ? 2500 + year : 2000 + year;
    }
    if (year >= 2400) {
      year -= 543;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2200) {
      return {
        isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        scanTime
      };
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (year >= 2400) year -= 543;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        scanTime
      };
    }
  }

  // 3. Thai text date e.g. "14 พ.ย. 2569", "14-พ.ย.-2569", or "14 พ.ย. 69"
  const thaiTextMatch = str.match(/(\d{1,2})[\s\-]+([^\s\d\-]+)[\s\-]+(\d{2,4})/);
  if (thaiTextMatch) {
    const day = parseInt(thaiTextMatch[1], 10);
    const monthStr = thaiTextMatch[2].trim();
    let year = parseInt(thaiTextMatch[3], 10);
    if (year < 100) {
      year = year >= 40 ? 2500 + year : 2000 + year;
    }
    if (year >= 2400) year -= 543;
    const month = THAI_MONTH_ABBR_MAP[monthStr];
    if (month && day >= 1 && day <= 31) {
      return {
        isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        scanTime
      };
    }
  }

  return { isoDate: "", scanTime };
}

/**
 * Formats YYYY-MM-DD to Thai short format DD/MM/BBBB e.g. "14/11/2569"
 */
export function formatIsoToThaiSlash(isoDate: string): string {
  if (!isoDate) return "-";
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const [y, m, d] = parts;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

/**
 * Decodes ArrayBuffer text safely for UTF-8 and legacy Windows-874 / TIS-620 Thai CSV exports.
 */
export function decodeTextWithThaiFallback(buffer: ArrayBuffer): string {
  const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  if (utf8Text.includes("\uFFFD")) {
    try {
      const tisDecoder = new TextDecoder("windows-874");
      return tisDecoder.decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text.replace(/^\uFEFF/, "");
}

/**
 * Parses raw text lines (CSV, TSV, or pasted Excel table) into a 2D array.
 */
export function parseDelimitedTextToGrid(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const sample = lines.slice(0, 5).join("\n");
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;

  const delimiter =
    tabCount >= commaCount && tabCount >= semiCount && tabCount > 0
      ? "\t"
      : semiCount > commaCount && semiCount > 0
      ? ";"
      : ",";

  return lines.map((line) => {
    if (delimiter === "\t") {
      return line.split("\t").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
    }

    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

/**
 * Auto-detects header row and column indices for Student ID, Full Name, Scan Date, and Scan Time.
 */
export function detectScannerColumns(grid: string[][]): {
  headerRowIndex: number;
  headers: string[];
  dataRows: string[][];
  detectedColumns: {
    idCol: number;
    nameCol: number;
    lastNameCol: number;
    dateCol: number;
    timeCol: number;
  };
} {
  if (grid.length === 0) {
    return {
      headerRowIndex: -1,
      headers: [],
      dataRows: [],
      detectedColumns: { idCol: 0, nameCol: 1, lastNameCol: -1, dateCol: 2, timeCol: -1 }
    };
  }

  let headerRowIndex = -1;
  let idCol = -1;
  let nameCol = -1;
  let lastNameCol = -1;
  let dateCol = -1;
  let timeCol = -1;

  const scanLimit = Math.min(10, grid.length);
  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r];
    if (!row || row.length < 2) continue;

    let tempId = -1;
    let tempName = -1;
    let tempLastName = -1;
    let tempDate = -1;
    let tempTime = -1;

    row.forEach((cell, cIdx) => {
      const h = String(cell || "").trim().toLowerCase().replace(/\s+/g, "");
      if (!h) return;

      if (
        tempId === -1 &&
        (h.includes("รหัสนักเรียน") ||
          h.includes("รหัสประจำตัว") ||
          h === "รหัส" ||
          h === "studentid" ||
          h === "student_id" ||
          h === "emp_id" ||
          h === "userid" ||
          h === "user_id" ||
          h === "pin" ||
          h === "id")
      ) {
        tempId = cIdx;
      } else if (
        tempName === -1 &&
        (h.includes("ชื่อ-นามสกุล") ||
          h.includes("ชื่อ-สกุล") ||
          h.includes("ชื่อสกุล") ||
          h.includes("fullname") ||
          h.includes("full_name") ||
          h === "name" ||
          h === "ชื่อ")
      ) {
        tempName = cIdx;
      } else if (
        tempLastName === -1 &&
        (h === "นามสกุล" || h === "สกุล" || h === "lastname" || h === "surname")
      ) {
        tempLastName = cIdx;
      } else if (
        tempTime === -1 &&
        (h === "เวลา" || h === "เวลาสแกน" || h === "เวลาสแกนนิ้ว" || h === "time" || h === "scantime" || h === "scan_time")
      ) {
        tempTime = cIdx;
      } else if (
        tempDate === -1 &&
        (h.includes("วันที่สแกน") ||
          h.includes("วันเวลาสแกน") ||
          h.includes("วันที่") ||
          h.includes("วัน/เดือน/ปี") ||
          h.includes("scandate") ||
          h.includes("scan_date") ||
          h === "date" ||
          h === "datetime" ||
          h === "checktime" ||
          h === "timestamp")
      ) {
        tempDate = cIdx;
      }
    });

    const foundSignals = [tempId !== -1, tempName !== -1, tempDate !== -1].filter(Boolean).length;
    if (foundSignals >= 2) {
      headerRowIndex = r;
      idCol = tempId;
      nameCol = tempName;
      lastNameCol = tempLastName;
      dateCol = tempDate;
      timeCol = tempTime;
      break;
    }
  }

  const maxCols = Math.max(...grid.slice(0, 20).map((r) => r.length), 3);
  const startDataIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const dataRows = grid.slice(startDataIdx).filter((r) => r.some((cell) => String(cell || "").trim() !== ""));

  // Heuristic fallback if any column wasn't found via header
  if (idCol === -1 || nameCol === -1 || dateCol === -1 || timeCol === -1) {
    const sampleRows = dataRows.slice(0, 15);
    for (let c = 0; c < maxCols; c++) {
      let idScore = 0;
      let dateScore = 0;
      let timeScore = 0;
      let nameScore = 0;

      sampleRows.forEach((row) => {
        const val = String(row[c] || "").trim();
        if (!val) return;
        if (/^[A-Za-z0-9]+-[A-Za-z0-9-]+$/.test(val) && /\d{4,6}$/.test(val)) {
          idScore += 2;
        } else if (/^\d{4,6}$/.test(val)) {
          idScore += 2;
        }
        if (parseScannerDateTime(val).isoDate !== "") {
          dateScore += 2;
        } else if (normalizeTimeString(val) !== "" && !/[\/\-]/.test(val)) {
          timeScore += 2;
        }
        if (/[\u0E00-\u0E7F]{2,}\s+[\u0E00-\u0E7F]{2,}/.test(val)) {
          nameScore += 2;
        } else if (/[\u0E00-\u0E7F]{2,}/.test(val) && !/\d/.test(val)) {
          nameScore += 1;
        }
      });

      if (idCol === -1 && idScore >= sampleRows.length * 0.5 && idScore > 0) idCol = c;
      else if (dateCol === -1 && dateScore >= sampleRows.length * 0.5 && dateScore > 0) dateCol = c;
      else if (timeCol === -1 && timeScore >= sampleRows.length * 0.5 && timeScore > 0) timeCol = c;
      else if (nameCol === -1 && nameScore >= sampleRows.length * 0.5 && nameScore > 0) nameCol = c;
    }
  }

  // Final positional defaults
  if (idCol === -1) idCol = 0;
  if (nameCol === -1) nameCol = maxCols > 1 && idCol !== 1 ? 1 : 0;
  if (dateCol === -1) dateCol = maxCols > 2 ? 2 : maxCols - 1;

  const headers =
    headerRowIndex >= 0
      ? grid[headerRowIndex].map((h, i) => String(h || "").trim() || `คอลัมน์ ${i + 1}`)
      : Array.from({ length: maxCols }, (_, i) => `คอลัมน์ ${i + 1}`);

  return {
    headerRowIndex,
    headers,
    dataRows,
    detectedColumns: { idCol, nameCol, lastNameCol, dateCol, timeCol }
  };
}

/**
 * Parses an uploaded File (.xlsx, .xls, .csv, .txt) into a ParsedScannerTable.
 */
export async function parseScannerFile(file: File): Promise<ParsedScannerTable> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const buffer = await file.arrayBuffer();

  let rawGrid: string[][] = [];

  if (ext === "csv" || ext === "txt" || ext === "tsv") {
    const decoded = decodeTextWithThaiFallback(buffer);
    rawGrid = parseDelimitedTextToGrid(decoded);
  } else {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("ไม่พบชีตข้อมูลในไฟล์ Excel");
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    rawGrid = aoa.map((row) => row.map((cell) => String(cell ?? "").trim()));
  }

  const detected = detectScannerColumns(rawGrid);
  return {
    headers: detected.headers,
    rows: detected.dataRows,
    detectedColumns: detected.detectedColumns,
    headerRowIndex: detected.headerRowIndex,
    fileName: file.name
  };
}

/**
 * Parses raw pasted text into a ParsedScannerTable.
 */
export function parseScannerPastedText(text: string): ParsedScannerTable {
  const rawGrid = parseDelimitedTextToGrid(text);
  const detected = detectScannerColumns(rawGrid);
  return {
    headers: detected.headers,
    rows: detected.dataRows,
    detectedColumns: detected.detectedColumns,
    headerRowIndex: detected.headerRowIndex,
    fileName: "ข้อมูลวางจากคลิปบอร์ด"
  };
}

/**
 * Converts a ParsedScannerTable into structured RawScannerRow items using selected column mapping.
 */
export function extractScannerRows(
  table: ParsedScannerTable,
  mapping: { idCol: number; nameCol: number; lastNameCol: number; dateCol: number; timeCol: number }
): RawScannerRow[] {
  const result: RawScannerRow[] = [];

  table.rows.forEach((row, idx) => {
    const rawId = String(row[mapping.idCol] ?? "").trim();
    const firstPart = mapping.nameCol >= 0 ? String(row[mapping.nameCol] ?? "").trim() : "";
    const lastPart = mapping.lastNameCol >= 0 ? String(row[mapping.lastNameCol] ?? "").trim() : "";
    const rawName = lastPart ? `${firstPart} ${lastPart}`.trim() : firstPart;
    const rawDate = mapping.dateCol >= 0 ? String(row[mapping.dateCol] ?? "").trim() : "";
    const rawExtraTime = mapping.timeCol >= 0 ? String(row[mapping.timeCol] ?? "").trim() : "";

    if (!rawId && !rawName) return;

    const parsedDate = parseScannerDateTime(rawDate);
    let scanTime = parsedDate.scanTime;
    if (rawExtraTime) {
      const normalizedExtra = normalizeTimeString(rawExtraTime);
      if (normalizedExtra) {
        scanTime = normalizedExtra;
      }
    }

    result.push({
      rowIndex: idx + 1,
      rawId,
      normalizedCode: extractScannerStudentCode(rawId),
      rawName,
      rawDate,
      isoDate: parsedDate.isoDate,
      scanTime,
      rawColumns: row
    });
  });

  return result;
}

/**
 * Evaluates scan punctuality against configured [startTime, endTime] window (e.g. "06:00" - "07:00").
 */
function evaluatePunctuality(params: {
  hasScanned: boolean;
  isDormOut: boolean;
  dormChecked: boolean;
  dormStatus?: string;
  earliestTime: string;
  startTime: string;
  endTime: string;
}): {
  punctualityStatus: PunctualityStatus;
  punctualityLabel: string;
  punctualityDetail: string;
  overMinutes: number;
  earlyMinutes: number;
} {
  const { hasScanned, isDormOut, dormChecked, dormStatus, earliestTime, startTime, endTime } = params;

  const startSec = timeStringToSeconds(startTime) ?? 6 * 3600;
  const endSec = timeStringToSeconds(endTime) ?? 7 * 3600;

  if (!hasScanned) {
    if (isDormOut) {
      return {
        punctualityStatus: "OUT_OF_DORM",
        punctualityLabel: "ออกหอพัก (ไม่สแกน)",
        punctualityDetail: "มีสถานะออกหอพักตามระบบเช็คยอด",
        overMinutes: 0,
        earlyMinutes: 0
      };
    }
    if (dormStatus === "QUARANTINE") {
      return {
        punctualityStatus: "QUARANTINE_EXEMPT",
        punctualityLabel: "อยู่หอพัก (กักตัว) · ไม่สแกน (ยกเว้น)",
        punctualityDetail: "สถานะอยู่หอพัก (กักตัว) ไม่นับรวมในสรุปรายงานนักเรียนลงหอพักสาย",
        overMinutes: 0,
        earlyMinutes: 0
      };
    }
    return {
      punctualityStatus: "LATE_NOT_SCANNED",
      punctualityLabel: "สาย (ไม่สแกน)",
      punctualityDetail: dormChecked ? "อยู่หอพักแต่ไม่พบการสแกนนิ้ว" : "ไม่พบการสแกนนิ้ว (หอพักยังไม่เช็คยอด)",
      overMinutes: 0,
      earlyMinutes: 0
    };
  }

  // Has scanned
  const scanSec = timeStringToSeconds(earliestTime);
  if (scanSec === null) {
    return {
      punctualityStatus: "SCANNED_NO_TIME",
      punctualityLabel: "สแกนแล้ว (ไม่ระบุเวลา)",
      punctualityDetail: "ในไฟล์ที่อัปโหลดไม่มีข้อมูลเวลาสแกน",
      overMinutes: 0,
      earlyMinutes: 0
    };
  }

  if (scanSec < startSec) {
    const earlySec = startSec - scanSec;
    const earlyMinutes = Math.ceil(earlySec / 60);
    return {
      punctualityStatus: "EARLY",
      punctualityLabel: `สแกนก่อนเวลา (${earliestTime} น.)`,
      punctualityDetail: `มาก่อนเวลา ${formatThaiDuration(earlySec)} (กำหนด ${startTime} - ${endTime} น.)`,
      overMinutes: 0,
      earlyMinutes
    };
  }

  if (scanSec <= endSec) {
    return {
      punctualityStatus: "ON_TIME",
      punctualityLabel: `สแกนตรงเวลา (${earliestTime} น.)`,
      punctualityDetail: `อยู่ในช่วงเวลา ${startTime} - ${endTime} น.`,
      overMinutes: 0,
      earlyMinutes: 0
    };
  }

  // scanSec > endSec -> Late (except QUARANTINE which is exempt from late report)
  const overSec = scanSec - endSec;
  const overMinutes = Math.max(1, Math.ceil(overSec / 60));
  const overText = formatThaiDuration(overSec);
  if (!isDormOut && dormStatus === "QUARANTINE") {
    return {
      punctualityStatus: "QUARANTINE_EXEMPT",
      punctualityLabel: `อยู่หอพัก (กักตัว) · สแกน ${earliestTime} น. (ยกเว้น)`,
      punctualityDetail: `สแกนเวลา ${earliestTime} น. (สถานะอยู่หอพัก (กักตัว) ไม่นับรวมในสรุปรายงานนักเรียนลงหอพักสาย)`,
      overMinutes: 0,
      earlyMinutes: 0
    };
  }
  return {
    punctualityStatus: "LATE_SCANNED",
    punctualityLabel: `สาย (เกิน ${overText})`,
    punctualityDetail: `สแกนเวลา ${earliestTime} น. (เกินเวลา ${endTime} น. มา ${overText})`,
    overMinutes,
    earlyMinutes: 0
  };
}

/**
 * Cross-compares uploaded fingerprint scan records against dormitory students and attendance records.
 */
export function compareFingerprintWithDorm(params: {
  scannerRows: RawScannerRow[];
  scanDateFilter: string; // "ALL" or "YYYY-MM-DD"
  attendanceDate: string; // "YYYY-MM-DD" (default: previous night = scanDate - 1 day)
  startTime: string; // e.g. "06:00"
  endTime: string; // e.g. "07:00"
  hasTimeColumn?: boolean;
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  dormFilter: string; // "ALL" or dormId
  gradeFilter: string; // "ALL" or "ม.1".."ม.6"
}): {
  items: StudentComparisonItem[];
  unmatchedScannerRows: UnmatchedScannerRecord[];
  counts: {
    totalStudents: number;
    dormCheckedCount: number;
    dormOutTotal: number;
    presentNotScanned: number;
    outConfirmed: number;
    outButScanned: number;
    presentScanned: number;
    uncheckedScanned: number;
    uncheckedNotScanned: number;
    unmatchedCount: number;
    totalScannerStudentsMatched: number;
    // Punctuality counters (for non-out students / or overall)
    earlyCount: number;
    onTimeCount: number;
    lateScannedCount: number;
    lateNotScannedCount: number;
    lateTotalCount: number;
    inDormCount: number;
    flaggedCount: number;
  };
  dormCheckStatus: Array<{ dorm: Dormitory; isChecked: boolean; status: string }>;
} {
  const {
    scannerRows,
    scanDateFilter,
    attendanceDate,
    startTime,
    endTime,
    hasTimeColumn,
    students,
    dorms,
    attendanceRecords,
    dormFilter,
    gradeFilter
  } = params;

  // 1. Filter scanner rows by selected scanDateFilter
  const activeScannerRows =
    scanDateFilter === "ALL"
      ? scannerRows
      : scannerRows.filter((r) => r.isoDate === scanDateFilter || (!r.isoDate && scanDateFilter === ""));

  const hasTimeTracking = Boolean(hasTimeColumn) || activeScannerRows.some((r) => Boolean(r.scanTime));

  // 2. Build fast lookup maps for Students in DB (using last 5 chars standard)
  const byExactId = new Map<string, Student>();
  const byLast5Code = new Map<string, Student>();
  const byUnpaddedCode = new Map<string, Student[]>();
  const byNormalizedName = new Map<string, Student[]>();

  students.forEach((st) => {
    const rawSid = String(st.studentId || "").trim().toUpperCase();
    const padded = formatStudentId(st.studentId);
    const last5 = extractScannerStudentCode(st.studentId);

    if (rawSid) byExactId.set(rawSid, st);
    if (padded) byLast5Code.set(padded.toUpperCase(), st);
    if (last5) byLast5Code.set(last5, st);

    const digitsOnly = padded.replace(/^0+/, "");
    if (digitsOnly) {
      const list = byUnpaddedCode.get(digitsOnly) || [];
      list.push(st);
      byUnpaddedCode.set(digitsOnly, list);
    }

    const fullNoTitle = normalizeThaiStudentName(`${st.firstName} ${st.lastName}`);
    if (fullNoTitle) {
      const list = byNormalizedName.get(fullNoTitle) || [];
      list.push(st);
      byNormalizedName.set(fullNoTitle, list);
    }
  });

  // 3. Match each scanner row to a DB student (or collect unmatched)
  const matchedScannerByStudentKey = new Map<string, ScannerMatchInfo>();
  const unmatchedMap = new Map<string, UnmatchedScannerRecord>();

  activeScannerRows.forEach((row) => {
    const upperRawId = row.rawId.trim().toUpperCase();
    const last5Code = row.normalizedCode; // Already last 5 chars e.g. "06068"
    const unpadded = last5Code.replace(/^0+/, "");
    const normName = normalizeThaiStudentName(row.rawName);

    let matchedStudent: Student | undefined;
    let matchMethod: ScannerMatchInfo["matchMethod"] = "LAST_5_CHARS";

    if (upperRawId && byExactId.has(upperRawId)) {
      matchedStudent = byExactId.get(upperRawId);
      matchMethod = "EXACT_ID";
    } else if (last5Code && byLast5Code.has(last5Code)) {
      matchedStudent = byLast5Code.get(last5Code);
      matchMethod = "LAST_5_CHARS";
    } else if (unpadded && byUnpaddedCode.get(unpadded)?.length === 1) {
      matchedStudent = byUnpaddedCode.get(unpadded)![0];
      matchMethod = "UNPADDED_ID";
    } else if (normName && byNormalizedName.get(normName)?.length === 1) {
      matchedStudent = byNormalizedName.get(normName)![0];
      matchMethod = "NAME";
    }

    if (matchedStudent) {
      const key = matchedStudent.id || formatStudentId(matchedStudent.studentId);
      const existing = matchedScannerByStudentKey.get(key);
      if (existing) {
        existing.scanCount += 1;
        if (row.isoDate && !existing.scanDates.includes(row.isoDate)) {
          existing.scanDates.push(row.isoDate);
        }
        if (row.scanTime && !existing.scanTimes.includes(row.scanTime)) {
          existing.scanTimes.push(row.scanTime);
          existing.scanTimes.sort((a, b) => (timeStringToSeconds(a) ?? 0) - (timeStringToSeconds(b) ?? 0));
          existing.earliestTime = existing.scanTimes[0] || "";
        }
      } else {
        const times = row.scanTime ? [row.scanTime] : [];
        matchedScannerByStudentKey.set(key, {
          rawId: row.rawId,
          normalizedCode: row.normalizedCode,
          rawName: row.rawName,
          scanDates: row.isoDate ? [row.isoDate] : [],
          scanTimes: times,
          earliestTime: times[0] || "",
          scanCount: 1,
          matchMethod
        });
      }
    } else {
      const uKey = `${last5Code || upperRawId || normName}__${row.isoDate || row.rawDate}`;
      const existingU = unmatchedMap.get(uKey);
      if (existingU) {
        existingU.scanCount += 1;
        if (row.scanTime && !existingU.scanTimes.includes(row.scanTime)) {
          existingU.scanTimes.push(row.scanTime);
        }
      } else {
        unmatchedMap.set(uKey, {
          rawId: row.rawId,
          normalizedCode: row.normalizedCode,
          rawName: row.rawName,
          rawDate: row.rawDate,
          isoDate: row.isoDate,
          scanTimes: row.scanTime ? [row.scanTime] : [],
          scanCount: 1
        });
      }
    }
  });

  // 4. Collect attendance records for attendanceDate
  const attendanceForDateList = attendanceRecords.filter((r) => r && r.date === attendanceDate);

  const dormCheckStatus = dorms.map((dorm) => {
    const att = attendanceForDateList.find((a) => isDormMatch(dorm, a.dormId));
    const isChecked = Boolean(
      att &&
        att.status !== "PENDING" &&
        (att.status === "CHECKED" ||
          att.status === "HOME_BREAK" ||
          att.status === "SEMESTER_BREAK" ||
          att.isHomeBreak ||
          (Array.isArray(att.records) && att.records.length > 0))
    );
    return {
      dorm,
      isChecked,
      status: att?.status || "PENDING"
    };
  });

  // 5. แสดงเฉพาะรายชื่อนักเรียนที่นำเข้าจากระบบสแกนลายนิ้วมือเท่านั้น และกรองตามหอพัก / ระดับชั้น
  const targetDormObj = dormFilter !== "ALL" ? dorms.find((d) => d.id === dormFilter) : undefined;

  const filteredStudents = students.filter((st) => {
    const stKey = st.id || formatStudentId(st.studentId);
    if (!matchedScannerByStudentKey.has(stKey)) return false;

    if (dormFilter !== "ALL") {
      if (targetDormObj) {
        if (!matchStudentToDorm(st, targetDormObj)) return false;
      } else if (st.dormId !== dormFilter) {
        return false;
      }
    }
    if (gradeFilter !== "ALL") {
      if (normalizeGradeLevel(st.grade) !== gradeFilter) return false;
    }
    return true;
  });

  // 6. Build comparison items
  const counts = {
    totalStudents: filteredStudents.length,
    dormCheckedCount: 0,
    dormOutTotal: 0,
    presentNotScanned: 0,
    outConfirmed: 0,
    outButScanned: 0,
    presentScanned: 0,
    uncheckedScanned: 0,
    uncheckedNotScanned: 0,
    unmatchedCount: unmatchedMap.size,
    totalScannerStudentsMatched: 0,
    earlyCount: 0,
    onTimeCount: 0,
    lateScannedCount: 0,
    lateNotScannedCount: 0,
    lateTotalCount: 0,
    inDormCount: 0,
    flaggedCount: 0
  };

  const items: StudentComparisonItem[] = filteredStudents.map((st) => {
    const dormObj = dorms.find((d) => matchStudentToDorm(st, d));
    const dormName = dormObj?.name || st.dormId || "ไม่ระบุหอพัก";
    const formattedId = formatStudentId(st.studentId);
    const fullName = `${st.title || ""}${st.firstName} ${st.lastName}`.trim();
    const gradeRoom = st.room ? `${st.grade}/${st.room}` : st.grade || "-";

    const att = dormObj
      ? attendanceForDateList.find((a) => isDormMatch(dormObj, a.dormId))
      : attendanceForDateList.find((a) => a.dormId === st.dormId);

    const isDormChecked = Boolean(
      att &&
        att.status !== "PENDING" &&
        (att.status === "CHECKED" ||
          att.status === "HOME_BREAK" ||
          att.status === "SEMESTER_BREAK" ||
          att.isHomeBreak ||
          (Array.isArray(att.records) && att.records.length > 0))
    );

    let dormStatus: AttendanceStatus | "PENDING" = "PENDING";
    let dormReason = "";

    if (isDormChecked && att) {
      counts.dormCheckedCount += 1;

      const isSemBreak =
        att.status === "SEMESTER_BREAK" ||
        (Array.isArray(att.records) && att.records.length > 0 && att.records.every((r) => r.status === "SEMESTER_BREAK"));
      const isHomeBreak = Boolean(att.isHomeBreak || att.status === "HOME_BREAK");

      const rec = Array.isArray(att.records)
        ? att.records.find(
            (r) => formatStudentId(r.studentId) === formattedId || r.studentId === st.studentId
          )
        : undefined;

      if (rec) {
        dormStatus = rec.status;
        dormReason = rec.reason || rec.note || "";
      } else if (isSemBreak) {
        dormStatus = "SEMESTER_BREAK";
        dormReason = "ปิดภาคเรียน";
      } else if (isHomeBreak) {
        dormStatus = "ROUND_HOME";
        dormReason = "รอบกลับบ้าน";
      } else {
        dormStatus = "PRESENT";
      }
    }

    const dormStatusLabel = ATTENDANCE_STATUS_THAI[dormStatus] || dormStatus;
    const isDormOut = isDormChecked && !isDormPresentStatus(dormStatus);

    const stKey = st.id || formattedId;
    const scannerInfo = matchedScannerByStudentKey.get(stKey);
    const hasScanned = hasTimeTracking
      ? Boolean(scannerInfo && scannerInfo.scanTimes.length > 0)
      : Boolean(scannerInfo);

    if (hasScanned) {
      counts.totalScannerStudentsMatched += 1;
    }

    let category: ComparisonCategory;
    if (!isDormChecked) {
      if (hasScanned) {
        category = "UNCHECKED_SCANNED";
        counts.uncheckedScanned += 1;
      } else {
        category = "UNCHECKED_NOT_SCANNED";
        counts.uncheckedNotScanned += 1;
      }
    } else if (isDormOut) {
      counts.dormOutTotal += 1;
      if (hasScanned) {
        category = "OUT_BUT_SCANNED";
        counts.outButScanned += 1;
      } else {
        category = "OUT_CONFIRMED";
        counts.outConfirmed += 1;
      }
    } else {
      if (hasScanned) {
        category = "PRESENT_SCANNED";
        counts.presentScanned += 1;
      } else {
        category = "PRESENT_NOT_SCANNED";
        counts.presentNotScanned += 1;
      }
    }

    const punctuality = evaluatePunctuality({
      hasScanned,
      isDormOut,
      dormChecked: isDormChecked,
      dormStatus,
      earliestTime: scannerInfo?.earliestTime || "",
      startTime,
      endTime
    });

    // Count punctuality stats for non-out students
    if (!isDormOut) {
      counts.inDormCount += 1;
      if (punctuality.punctualityStatus === "EARLY") {
        counts.earlyCount += 1;
        counts.flaggedCount += 1;
      } else if (punctuality.punctualityStatus === "ON_TIME") {
        counts.onTimeCount += 1;
      } else if (punctuality.punctualityStatus === "LATE_SCANNED") {
        counts.lateScannedCount += 1;
        counts.lateTotalCount += 1;
        counts.flaggedCount += 1;
      } else if (punctuality.punctualityStatus === "LATE_NOT_SCANNED") {
        counts.lateNotScannedCount += 1;
        counts.lateTotalCount += 1;
        counts.flaggedCount += 1;
      }
    }

    return {
      student: st,
      dorm: dormObj,
      dormName,
      formattedId,
      fullName,
      gradeRoom,
      dormChecked: isDormChecked,
      dormStatus,
      dormStatusLabel,
      dormReason,
      isDormOut,
      hasScanned,
      scannerInfo,
      category,
      ...punctuality
    };
  });

  // Sort items naturally by dorm, grade, room, studentId
  items.sort((a, b) => {
    const dormCmp = a.dormName.localeCompare(b.dormName, "th", { numeric: true });
    if (dormCmp !== 0) return dormCmp;
    const gradeCmp = a.gradeRoom.localeCompare(b.gradeRoom, "th", { numeric: true });
    if (gradeCmp !== 0) return gradeCmp;
    return a.formattedId.localeCompare(b.formattedId);
  });

  return {
    items,
    unmatchedScannerRows: Array.from(unmatchedMap.values()),
    counts,
    dormCheckStatus
  };
}

/**
 * Generates and downloads a sample Excel template matching the school's fingerprint scanner format (with scan time).
 */
export function downloadScannerSampleTemplate(students: Student[] = []): void {
  const headers = ["รหัสนักเรียน", "ชื่อ-นามสกุล", "วันที่สแกน", "เวลาสแกน"];
  const sampleTimes = ["05:45", "06:20", "06:45", "07:12", "07:25", "06:10", "06:58", "07:05"];

  const sampleRows: string[][] = [
    ["M-69-M-06068", "ตัวอย่าง นักเรียน", "14/11/2569", "06:35"],
    ["P-68-M-05963", "จิโรจน์ มูลอัง", "14/11/2569", "07:15"]
  ];

  students.slice(0, 8).forEach((st, idx) => {
    const code = formatStudentId(st.studentId);
    const prefix = st.gender === "female" ? "M-69-F" : "M-69-M";
    const fullName = `${st.firstName} ${st.lastName}`.trim();
    if (code !== "05963" && code !== "06068") {
      sampleRows.push([`${prefix}-${code}`, fullName, "14/11/2569", sampleTimes[idx % sampleTimes.length]]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ข้อมูลสแกนลายนิ้วมือ");
  XLSX.writeFile(wb, "ตัวอย่างไฟล์สแกนลายนิ้วมือ_เทียบออกหอพัก.xlsx");
}

/**
 * Exports comparison results to a multi-sheet formatted Excel workbook.
 */
export function exportFingerprintComparisonExcel(params: {
  items: StudentComparisonItem[];
  unmatchedScannerRows: UnmatchedScannerRecord[];
  attendanceDate: string;
  scanDateFilter: string;
  startTime: string;
  endTime: string;
}): void {
  const { items, unmatchedScannerRows, attendanceDate, scanDateFilter, startTime, endTime } = params;

  const wb = XLSX.utils.book_new();

  const mapItemToRow = (item: StudentComparisonItem, idx: number) => ({
    "ลำดับ": idx + 1,
    "รหัสนักเรียน": item.formattedId,
    "รหัสสแกนนิ้ว": item.scannerInfo?.rawId || "-",
    "ชื่อ - นามสกุล": item.fullName,
    "ชั้น/ห้อง": item.gradeRoom,
    "หอพัก": item.dormName,
    "ห้องพัก": item.student.dormRoom || "-",
    "สถานะหอพัก": item.dormStatusLabel,
    "เหตุผล/หมายเหตุ": item.dormReason || "-",
    "สถานะสแกนนิ้ว": item.hasScanned ? "สแกนนิ้วแล้ว" : "ไม่พบสแกนนิ้ว",
    "เวลาสแกน": item.scannerInfo?.scanTimes.join(", ") || "-",
    [`ผลการตรวจเวลา (${startTime}-${endTime} น.)`]: item.punctualityLabel,
    "รายละเอียดเวลา": item.punctualityDetail
  });

  const isQuarantineExempt = (i: StudentComparisonItem) =>
    i.dormStatus === "QUARANTINE" &&
    (!i.hasScanned ||
      i.punctualityStatus === "LATE_SCANNED" ||
      i.punctualityStatus === "LATE_NOT_SCANNED" ||
      i.punctualityStatus === "QUARANTINE_EXEMPT");

  const lateNotScannedList = items.filter(
    (i) => !i.isDormOut && !isQuarantineExempt(i) && i.punctualityStatus === "LATE_NOT_SCANNED"
  );
  const lateScannedList = items.filter(
    (i) => !i.isDormOut && !isQuarantineExempt(i) && i.punctualityStatus === "LATE_SCANNED"
  );
  const earlyList = items.filter((i) => !i.isDormOut && i.punctualityStatus === "EARLY");
  const outList = items.filter((i) => i.isDormOut);
  const conflictList = items.filter((i) => i.category === "OUT_BUT_SCANNED");

  const appendStyledSheet = (rows: any[], sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "ข้อความ": "ไม่มีรายการ" }]);
    ws["!cols"] = [
      { wch: 7 },
      { wch: 14 },
      { wch: 18 },
      { wch: 26 },
      { wch: 10 },
      { wch: 20 },
      { wch: 10 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 26 },
      { wch: 32 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  };

  const flaggedList = items.filter(
    (i) =>
      !i.isDormOut &&
      !isQuarantineExempt(i) &&
      (i.punctualityStatus === "EARLY" ||
        i.punctualityStatus === "LATE_SCANNED" ||
        i.punctualityStatus === "LATE_NOT_SCANNED")
  );

  appendStyledSheet(lateNotScannedList.map(mapItemToRow), "1_สาย_ไม่สแกน");
  appendStyledSheet(lateScannedList.map(mapItemToRow), "2_สาย_สแกนหลังเวลา");
  appendStyledSheet(earlyList.map(mapItemToRow), "3_สแกนก่อนเวลา");
  appendStyledSheet(outList.map(mapItemToRow), "4_นักเรียนออกหอพัก");
  appendStyledSheet(conflictList.map(mapItemToRow), "5_แจ้งออกแต่สแกนนิ้ว");
  appendStyledSheet(flaggedList.map(mapItemToRow), "6_ก่อนเวลาและสายทั้งหมด");

  if (unmatchedScannerRows.length > 0) {
    const unmatchedRows = unmatchedScannerRows.map((u, idx) => ({
      "ลำดับ": idx + 1,
      "รหัสสแกนนิ้ว": u.rawId,
      "5 ตัวท้ายที่ตัดได้": u.normalizedCode,
      "ชื่อ-นามสกุล (จากเครื่องสแกน)": u.rawName,
      "วันที่สแกน": u.isoDate ? formatThaiMediumDate(u.isoDate) : u.rawDate,
      "เวลา": u.scanTimes.join(", ") || "-"
    }));
    const wsU = XLSX.utils.json_to_sheet(unmatchedRows);
    wsU["!cols"] = [{ wch: 7 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsU, "7_ไม่พบในระบบหอพัก");
  }

  const scanLabel = scanDateFilter === "ALL" ? "ทุกวันในไฟล์" : scanDateFilter;
  const fileName = `เทียบรายชื่อสแกนนิ้ว_หอพัก_${attendanceDate}_สแกน_${scanLabel}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export { formatThaiFullDate, getPreviousDateString };
