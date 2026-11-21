import { UserProfile } from "../types";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

export function stripDangerousKeys<T>(input: T): T {
  if (input === null || input === undefined || typeof input !== "object") {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripDangerousKeys(item)) as unknown as T;
  }
  const cleanObj: Record<string, unknown> = Object.create(null);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    cleanObj[key] = stripDangerousKeys(val);
  }
  Object.assign(result, cleanObj);
  return result as T;
}

export function sanitizeHttpsUrl(
  rawUrl: unknown,
  options: { allowLocalhostDev?: boolean } = {}
): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") {
      return parsed.href;
    }
    if (
      options.allowLocalhostDev &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return parsed.href;
    }
    return "";
  } catch {
    return "";
  }
}

export function sanitizeSafeImageUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";

  // Allow safe Google Drive file links mapped to direct image URL
  if (/^https:\/\/(drive|docs)\.google\.com\//i.test(trimmed)) {
    const fileIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  // Allow safe relative static paths (e.g., ./favicon.svg or /assets/...)
  if (
    (trimmed.startsWith("./") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) &&
    !trimmed.includes("\\") &&
    !trimmed.includes("..")
  ) {
    return trimmed;
  }

  // Allow browser object URLs created for local image preview before compression
  if (/^blob:(https?:\/\/|null\/)/i.test(trimmed)) {
    return trimmed;
  }

  // Allow raster data URIs strictly
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Validate SVG data URIs strictly (reject script / event handlers / foreignObject)
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    const lowerDecoded = (() => {
      try {
        if (trimmed.toLowerCase().includes(";base64,")) {
          const b64 = trimmed.split(",")[1] || "";
          return atob(b64).toLowerCase();
        }
        return decodeURIComponent(trimmed).toLowerCase();
      } catch {
        return trimmed.toLowerCase();
      }
    })();

    if (
      lowerDecoded.includes("<script") ||
      lowerDecoded.includes("<foreignobject") ||
      lowerDecoded.includes("javascript:") ||
      lowerDecoded.includes("vbscript:") ||
      /\son[a-z]+\s*=/.test(lowerDecoded)
    ) {
      return "";
    }
    return trimmed;
  }

  // Allow valid HTTPS URLs only
  return sanitizeHttpsUrl(trimmed);
}

export function sanitizeHtmlFragment(html: string): string {
  if (!html) return "";
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(html, "text/html");
      const blockedTags = parsedDoc.querySelectorAll(
        "script, iframe, object, embed, link, meta, base, frame, frameset"
      );
      blockedTags.forEach((node) => node.remove());

      const allElements = parsedDoc.body.querySelectorAll("*");
      allElements.forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim().toLowerCase();
          if (name.startsWith("on")) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (
            (name === "href" || name === "src" || name === "xlink:href" || name === "action" || name === "formaction") &&
            (val.startsWith("javascript:") || val.startsWith("vbscript:") || val.startsWith("data:text/html"))
          ) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (
            name === "style" &&
            (val.includes("expression(") || val.includes("javascript:") || val.includes("vbscript:"))
          ) {
            el.removeAttribute(attr.name);
          }
        }
      });
      return parsedDoc.body.innerHTML;
    } catch {
      // Fallback below
    }
  }
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function openSafeWindowUrl(url: string): Window | null {
  const safeUrl =
    url.startsWith("blob:")
      ? url
      : sanitizeHttpsUrl(url, { allowLocalhostDev: import.meta.env.DEV });
  if (!safeUrl) return null;
  return window.open(safeUrl, "_blank", "noopener,noreferrer");
}

export function isValidPasswordStrength(password: string): boolean {
  if (typeof password !== "string") return false;
  const trimmed = password.trim();
  return trimmed.length >= 6 && trimmed.length <= 128;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  const pwd = plainPassword.trim();
  const iterations = 100000;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(pwd),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    const hashBytes = new Uint8Array(derivedBits);
    return `pbkdf2_sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hashBytes)}`;
  }

  throw new Error("Web Crypto API is unavailable for secure password hashing.");
}

export async function verifyPassword(
  plainPassword: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!plainPassword || !storedHash) return false;
  const pwd = plainPassword.trim();
  if (!pwd) return false;

  if (storedHash.startsWith("pbkdf2_sha256$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltB64 = parts[2];
    const expectedB64 = parts[3];
    if (!iterations || !saltB64 || !expectedB64) return false;

    const salt = base64ToBytes(saltB64);
    const expectedBytes = base64ToBytes(expectedB64);

    if (typeof crypto !== "undefined" && crypto.subtle) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(pwd),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt.buffer as ArrayBuffer,
          iterations,
          hash: "SHA-256"
        },
        keyMaterial,
        expectedBytes.length * 8
      );
      return constantTimeEqual(new Uint8Array(derivedBits), expectedBytes);
    }
  }

  return false;
}

export function sanitizeUserForClient(rawUser: any): UserProfile {
  const clean = stripDangerousKeys(rawUser || {}) as Record<string, any>;
  const hasPwd = Boolean(
    (typeof clean.passwordHash === "string" && clean.passwordHash.trim().length > 0) ||
      clean.hasPassword === true
  );

  delete clean.password;
  delete clean.passwordHash;

  return {
    ...(clean as UserProfile),
    avatarUrl: sanitizeSafeImageUrl(clean.avatarUrl) || clean.avatarUrl || "",
    hasPassword: hasPwd
  };
}
