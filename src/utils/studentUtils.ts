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
