import { Dormitory, UserProfile } from "../types";
import { getDirectImageUrl } from "./dateUtils";
import { sanitizeSafeImageUrl } from "./security";

/**
 * Default system sample avatars separated by gender.
 * Used automatically whenever a user does not have a custom profile picture stored in Firestore.
 */
export const DEFAULT_MALE_AVATAR =
  `data:image/svg+xml;utf8,` +
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
  `<defs><linearGradient id="bgM" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23DBEAFE"/><stop offset="100%" stop-color="%23BFDBFE"/></linearGradient></defs>` +
  `<rect width="120" height="120" rx="60" fill="url(%23bgM)"/>` +
  `<path d="M22 114 C26 84, 41 76, 60 76 C79 76, 94 84, 98 114 Z" fill="%231E3A8A"/>` +
  `<polygon points="60,76 48,92 60,104 72,92" fill="%23FFFFFF"/>` +
  `<polygon points="60,88 55,96 60,114 65,96" fill="%233B82F6"/>` +
  `<rect x="51" y="61" width="18" height="19" rx="5" fill="%23F8C8A8"/>` +
  `<path d="M36 42 C36 25, 84 25, 84 42 V54 C84 68, 36 68, 36 54 Z" fill="%23FCD5B8"/>` +
  `<circle cx="34" cy="49" r="4.5" fill="%23F4B48C"/>` +
  `<circle cx="86" cy="49" r="4.5" fill="%23F4B48C"/>` +
  `<circle cx="50" cy="47" r="2.6" fill="%231E293B"/>` +
  `<circle cx="70" cy="47" r="2.6" fill="%231E293B"/>` +
  `<path d="M52 57 Q60 63 68 57" fill="none" stroke="%23B45309" stroke-width="2.4" stroke-linecap="round"/>` +
  `<path d="M34 42 C34 21, 86 20, 86 41 C80 30, 68 27, 56 30 C45 32, 39 36, 34 42 Z" fill="%231E293B"/>` +
  `</svg>`;

export const DEFAULT_FEMALE_AVATAR =
  `data:image/svg+xml;utf8,` +
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
  `<defs><linearGradient id="bgF" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FCE7F3"/><stop offset="100%" stop-color="%23F3E8FF"/></linearGradient></defs>` +
  `<rect width="120" height="120" rx="60" fill="url(%23bgF)"/>` +
  `<path d="M29 44 C29 20, 91 20, 91 44 V78 C91 84, 82 86, 78 78 V46 C78 29, 42 29, 42 46 V78 C38 86, 29 84, 29 78 Z" fill="%23334155"/>` +
  `<path d="M23 114 C27 84, 41 76, 60 76 C79 76, 93 84, 97 114 Z" fill="%239333EA"/>` +
  `<polygon points="60,96 46,76 55,76" fill="%23FFFFFF"/>` +
  `<polygon points="60,96 74,76 65,76" fill="%23FFFFFF"/>` +
  `<rect x="52" y="61" width="16" height="18" rx="5" fill="%23F8C8A8"/>` +
  `<path d="M37 42 C37 26, 83 26, 83 42 V54 C83 68, 37 68, 37 54 Z" fill="%23FCD5B8"/>` +
  `<circle cx="35" cy="49" r="4" fill="%23F4B48C"/>` +
  `<circle cx="85" cy="49" r="4" fill="%23F4B48C"/>` +
  `<circle cx="50" cy="47" r="2.6" fill="%231E293B"/>` +
  `<circle cx="70" cy="47" r="2.6" fill="%231E293B"/>` +
  `<circle cx="44" cy="53" r="3.5" fill="%23FDA4AF" opacity="0.55"/>` +
  `<circle cx="76" cy="53" r="3.5" fill="%23FDA4AF" opacity="0.55"/>` +
  `<path d="M53 57 Q60 63 67 57" fill="none" stroke="%23BE185D" stroke-width="2.3" stroke-linecap="round"/>` +
  `<path d="M35 42 C36 22, 84 22, 85 42 C72 28, 56 38, 35 42 Z" fill="%23334155"/>` +
  `</svg>`;

export function inferUserGender(
  user?: Partial<UserProfile> | null,
  dorms?: Dormitory[]
): "male" | "female" {
  if (user?.gender === "female") return "female";
  if (user?.gender === "male") return "male";

  const name = String(user?.name || "").trim();
  if (name) {
    const femaleHints = ["นางสาว", "น.ส.", "นาง", "ด.ญ.", "เด็กหญิง", "ครูนาง", "อ.หญิง", "ครูหญิง", "คุณแม่", "หญิง"];
    const maleHints = ["นาย", "ด.ช.", "เด็กชาย", "อ.ชาย", "ครูชาย", "คุณพ่อ"];
    if (femaleHints.some((hint) => name.includes(hint))) return "female";
    if (maleHints.some((hint) => name.includes(hint))) return "male";
  }

  if (dorms && dorms.length > 0) {
    const primaryDormId = user?.dormId || user?.allowedDormIds?.[0];
    if (primaryDormId) {
      const matchedDorm = dorms.find((d) => d.id === primaryDormId);
      const dormGender = matchedDorm?.gender || matchedDorm?.type;
      if (dormGender === "female") return "female";
      if (dormGender === "male") return "male";
    }
  }

  if (user?.id === "user-teacher") return "female";
  return "male";
}

export function getDefaultAvatarByGender(gender?: "male" | "female"): string {
  return gender === "female" ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR;
}

export function getGenderLabel(gender?: "male" | "female"): string {
  return gender === "female" ? "เพศหญิง" : "เพศชาย";
}

export function hasCustomAvatar(user?: Partial<UserProfile> | null): boolean {
  if (!user || typeof user.avatarUrl !== "string") return false;
  const trimmed = user.avatarUrl.trim();
  if (!trimmed) return false;
  return Boolean(sanitizeSafeImageUrl(getDirectImageUrl(trimmed) || trimmed));
}

export function getUserAvatarUrl(
  user?: Partial<UserProfile> | null,
  dorms?: Dormitory[]
): string {
  if (user && typeof user.avatarUrl === "string" && user.avatarUrl.trim().length > 0) {
    const candidate = getDirectImageUrl(user.avatarUrl.trim()) || user.avatarUrl.trim();
    const safe = sanitizeSafeImageUrl(candidate);
    if (safe) return safe;
  }
  return getDefaultAvatarByGender(inferUserGender(user, dorms));
}
