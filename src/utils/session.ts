import { UserProfile } from "../types";

const SESSION_KEY = "dorm_user_session";

/**
 * Saves the current user session using a Session Cookie (and sessionStorage backup).
 * A session cookie has no 'Expires' or 'Max-Age' directive, so browsers delete it
 * automatically when the browser window or application is closed.
 */
export function setSessionUser(user: UserProfile): void {
  try {
    const jsonStr = encodeURIComponent(JSON.stringify(user));
    // Session cookie: no Expires or Max-Age directive
    document.cookie = `${SESSION_KEY}=${jsonStr}; path=/; SameSite=Lax`;
    // Backup in sessionStorage for iframe or tab navigation
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Error setting session cookie:", e);
  }
}

/**
 * Retrieves the logged-in user from the active Session Cookie or sessionStorage.
 * Returns null if the user logged out or if the browser was closed.
 */
export function getSessionUser(): UserProfile | null {
  try {
    // 1. Check Session Cookie
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [key, value] = cookie.trim().split("=");
      if (key === SESSION_KEY && value) {
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded) as UserProfile;
        if (parsed && parsed.id) return parsed;
      }
    }

    // 2. Check sessionStorage
    const sessionSaved = sessionStorage.getItem(SESSION_KEY);
    if (sessionSaved) {
      const parsed = JSON.parse(sessionSaved) as UserProfile;
      if (parsed && parsed.id) return parsed;
    }
  } catch (e) {
    console.error("Error reading session cookie:", e);
  }
  return null;
}

/**
 * Clears the user session cookie and sessionStorage upon explicit Logout.
 */
export function clearSessionUser(): void {
  try {
    document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error("Error clearing session cookie:", e);
  }
}
