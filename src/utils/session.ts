import { UserProfile } from "../types";
import { sanitizeUserForClient, stripDangerousKeys } from "./security";

const SESSION_KEY = "dorm_user_session";

function getCookieSecureFlag(): string {
  try {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return "; Secure";
    }
  } catch (_) {}
  return "";
}

/**
 * Saves the current user session (credentials/hashes stripped) using sessionStorage,
 * localStorage, and a compact Session Cookie.
 */
export function setSessionUser(user: UserProfile): void {
  try {
    const safeUser = sanitizeUserForClient(user);
    const serialized = JSON.stringify(safeUser);
    const secureFlag = getCookieSecureFlag();

    try {
      sessionStorage.setItem(SESSION_KEY, serialized);
    } catch (_) {}
    try {
      localStorage.setItem(SESSION_KEY, serialized);
    } catch (_) {}

    try {
      let jsonStr = encodeURIComponent(serialized);
      // Browsers enforce ~4KB cookie limits; store compact session cookie without large base64 avatar data
      if (jsonStr.length > 3800) {
        const compactUser: UserProfile = { ...safeUser, avatarUrl: "" };
        jsonStr = encodeURIComponent(JSON.stringify(compactUser));
      }
      if (jsonStr.length <= 3900) {
        document.cookie = `${SESSION_KEY}=${jsonStr}; path=/; SameSite=Lax${secureFlag}`;
      } else {
        document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
      }
    } catch (_) {}
  } catch (e) {
    console.error("Error setting session user:", e);
  }
}

function parseSafeSession(raw: string): UserProfile | null {
  try {
    const parsed = stripDangerousKeys(JSON.parse(raw)) as UserProfile;
    if (parsed && typeof parsed.id === "string" && parsed.id.trim()) {
      return sanitizeUserForClient(parsed);
    }
  } catch (_) {}
  return null;
}

/**
 * Retrieves the logged-in user from sessionStorage, localStorage, or active Session Cookie.
 * Strips any legacy plaintext password fields if present.
 */
export function getSessionUser(): UserProfile | null {
  try {
    try {
      const sessionSaved = sessionStorage.getItem(SESSION_KEY);
      if (sessionSaved) {
        const parsed = parseSafeSession(sessionSaved);
        if (parsed) return parsed;
      }
    } catch (_) {}

    try {
      const localSaved = localStorage.getItem(SESSION_KEY);
      if (localSaved) {
        const parsed = parseSafeSession(localSaved);
        if (parsed) return parsed;
      }
    } catch (_) {}

    try {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqIdx = cookie.indexOf("=");
        if (eqIdx === -1) continue;
        const key = cookie.slice(0, eqIdx).trim();
        const value = cookie.slice(eqIdx + 1).trim();
        if (key === SESSION_KEY && value) {
          const decoded = decodeURIComponent(value);
          const parsed = parseSafeSession(decoded);
          if (parsed) return parsed;
        }
      }
    } catch (_) {}
  } catch (e) {
    console.error("Error reading session:", e);
  }
  return null;
}

/**
 * Clears the user session cookie, sessionStorage, and localStorage upon explicit Logout.
 */
export function clearSessionUser(): void {
  const secureFlag = getCookieSecureFlag();
  try {
    try {
      document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
    } catch (_) {}
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  } catch (e) {
    console.error("Error clearing session:", e);
  }
}
