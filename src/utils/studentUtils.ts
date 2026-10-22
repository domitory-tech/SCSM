/**
 * Utility functions for Student ID handling and formatting
 * Enforces strict 5-digit student ID standard (e.g., "06120", "05807")
 */

/**
 * Formats a student ID string/number into a strict 5-digit string.
 * Automatically adds leading zeroes if shorter than 5 digits (e.g., "6120" -> "06120", 5807 -> "05807").
 * Trims extraneous whitespace.
 */
export function formatStudentId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return "";
  const raw = String(id).trim();
  if (!raw) return "";

  // If numeric or digits
  if (/^\d+$/.test(raw)) {
    return raw.padStart(5, "0");
  }

  // If it has fewer than 5 characters, pad with leading 0s
  if (raw.length < 5) {
    return raw.padStart(5, "0");
  }

  return raw;
}

/**
 * Checks whether a student ID is a valid 5-digit numeric string
 */
export function isValid5DigitStudentId(id: string | number | undefined | null): boolean {
  if (!id) return false;
  const str = String(id).trim();
  return /^\d{5}$/.test(str);
}

/**
 * Generates a default 5-digit student ID string based on index or random number
 */
export function generateDefault5DigitStudentId(seed?: number): string {
  if (typeof seed === "number" && seed > 0) {
    return String(seed).padStart(5, "0");
  }
  const rand = Math.floor(1000 + Math.random() * 8999);
  return `0${rand}`;
}

/**
 * Normalizes a grade level string/number to always have "ม." prefix for secondary school levels.
 * e.g., "1" -> "ม.1", "2" -> "ม.2", 1 -> "ม.1", "ม1" -> "ม.1", "ม. 1" -> "ม.1", "ชั้น 1" -> "ม.1"
 * If already formatted (e.g. "ม.1" or "ป.1"), preserves it cleanly.
 */
export function formatGrade(grade?: string | number | null): string {
  if (grade === undefined || grade === null) return "ม.1";
  const str = String(grade).trim();
  if (!str) return "ม.1";

  // Check if standard "ม.1" - "ม.6"
  if (/^ม\.[1-6]$/.test(str)) {
    return str;
  }

  // If has "ม." or "ม" followed by digits, e.g. "ม.1", "ม. 1", "ม1", "มัธยมศึกษาปีที่ 1", "ชั้น ม.1"
  const mMatch = str.match(/(?:มัธยมศึกษาปีที่|ชั้น\s*ม\.?|ม\.?)\s*([1-6])(?:\b|$)/);
  if (mMatch && mMatch[1]) {
    return `ม.${mMatch[1]}`;
  }

  // Primary school e.g. "ป.1"
  const pMatch = str.match(/(?:ประถมศึกษาปีที่|ชั้น\s*ป\.?|ป\.?)\s*([1-6])(?:\b|$)/);
  if (pMatch && pMatch[1]) {
    return `ป.${pMatch[1]}`;
  }

  // Purely digits e.g. "1" -> "ม.1", "2" -> "ม.2", 1 -> "ม.1"
  const numMatch = str.match(/^([1-6])(?:\/.*|\b|$)/);
  if (numMatch && numMatch[1]) {
    return `ม.${numMatch[1]}`;
  }

  // Fallback if number > 6 or custom
  const anyNum = str.match(/\d+/);
  if (anyNum) {
    return `ม.${anyNum[0]}`;
  }

  return str.startsWith("ม.") ? str : `ม.${str}`;
}

/**
 * Checks whether a student's grade string is missing the "ม." (or "ป.") prefix
 * (e.g. "1", "2", "3", "ม1", etc.)
 */
export function isGradeMissingPrefix(grade?: string | number | null): boolean {
  if (grade === undefined || grade === null) return false;
  const str = String(grade).trim();
  if (!str) return false;
  return !/^[มป]\.[1-6]$/.test(str);
}
