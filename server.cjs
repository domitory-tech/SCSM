var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  formatGrade: () => formatGrade,
  formatStudentId: () => formatStudentId,
  loadDbFromDisk: () => loadDbFromDisk,
  saveDbToDisk: () => saveDbToDisk
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.set("trust proxy", 1);
var DANGEROUS_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function stripDangerousKeys(input) {
  if (input === null || input === void 0 || typeof input !== "object") {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripDangerousKeys(item));
  }
  const cleanObj = /* @__PURE__ */ Object.create(null);
  const result = {};
  for (const [key, val] of Object.entries(input)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    cleanObj[key] = stripDangerousKeys(val);
  }
  Object.assign(result, cleanObj);
  return result;
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    const hostHeader = String(req.headers.host || "");
    const hostname = hostHeader.split(":")[0].toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    if (!isLocalHost && !req.secure && forwardedProto !== "https") {
      return res.redirect(301, `https://${hostHeader}${req.originalUrl}`);
    }
  }
  next();
});
app.use(import_express.default.json({ limit: "10mb" }));
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = stripDangerousKeys(req.body);
  }
  next();
});
var SESSION_SECRET = process.env.SESSION_SECRET || import_crypto.default.randomBytes(32).toString("hex");
var TOKEN_TTL_MS = 12 * 60 * 60 * 1e3;
var revokedTokens = /* @__PURE__ */ new Map();
var WEAK_PASSWORDS = /* @__PURE__ */ new Set(["123", "1234", "12345", "123456", "password", "admin", "qwerty"]);
function isValidServerPassword(password) {
  if (typeof password !== "string") return false;
  const trimmed = password.trim();
  if (trimmed.length < 6 || trimmed.length > 128) return false;
  if (WEAK_PASSWORDS.has(trimmed.toLowerCase())) return false;
  return true;
}
function hashServerPassword(plainPassword) {
  const pwd = plainPassword.trim();
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const derived = import_crypto.default.scryptSync(pwd, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}
function verifyServerPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const pwd = plainPassword.trim();
  if (!pwd) return false;
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;
    const derived = import_crypto.default.scryptSync(pwd, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return import_crypto.default.timingSafeEqual(derived, expected);
  }
  if (storedHash.startsWith("pbkdf2_sha256$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltB64 = parts[2];
    const expectedB64 = parts[3];
    if (!iterations || iterations < 1e4 || !saltB64 || !expectedB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(expectedB64, "base64");
    const derived = import_crypto.default.pbkdf2Sync(pwd, salt, iterations, expected.length, "sha256");
    if (derived.length !== expected.length) return false;
    return import_crypto.default.timingSafeEqual(derived, expected);
  }
  return false;
}
function issueAuthToken(user) {
  const payload = {
    sub: user.id,
    roleLevel: user.roleLevel,
    jti: import_crypto.default.randomBytes(12).toString("hex"),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = import_crypto.default.createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}
function verifyAuthToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const expectedSig = import_crypto.default.createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf-8");
    const expectedBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length !== expectedBuf.length || !import_crypto.default.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    for (const [k, exp] of revokedTokens.entries()) {
      if (Date.now() > exp) revokedTokens.delete(k);
    }
    if (payload.jti && revokedTokens.has(payload.jti)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function sanitizeSafeServerImageUrl(rawUrl) {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";
  if ((trimmed.startsWith("./") || trimmed.startsWith("/") && !trimmed.startsWith("//")) && !trimmed.includes("..")) {
    return trimmed;
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    if (lower.includes("<script") || lower.includes("<foreignobject") || lower.includes("javascript:") || /\son[a-z]+\s*=/.test(lower)) {
      return "";
    }
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return parsed.href;
  } catch {
    return "";
  }
  return "";
}
function sanitizeServerUser(user, includePii = false) {
  const clean = stripDangerousKeys({ ...user });
  const hasPwd = Boolean(
    typeof clean.passwordHash === "string" && clean.passwordHash.trim().length > 0 || clean.hasPassword === true
  );
  delete clean.password;
  delete clean.passwordHash;
  if (!includePii) {
    delete clean.phone;
  }
  return {
    ...clean,
    hasPassword: hasPwd
  };
}
function isValidResourceId(id) {
  return typeof id === "string" && id.trim().length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}
function isValidIsoDate(val) {
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val);
}
function sanitizeText(val, maxLen = 250) {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}
function attachOptionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    if (payload) {
      const matched = usersStore.find((u) => u.id === payload.sub);
      if (matched) {
        req.authUser = matched;
        req.authTokenPayload = payload;
      }
    }
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23" });
  }
  next();
}
function requireRole(allowedLevels) {
  return (req, res, next) => {
    if (!req.authUser) {
      return res.status(401).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23" });
    }
    if (!allowedLevels.includes(req.authUser.roleLevel)) {
      return res.status(403).json({ success: false, message: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E43\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E19\u0E35\u0E49" });
    }
    next();
  };
}
app.use(attachOptionalAuth);
var dormitories = [
  {
    id: "dorm-1",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-111-2222",
    capacity: 80,
    teachers: [
      { id: "t-101", name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35", phone: "081-111-2222", isHead: true },
      { id: "t-102", name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E0A\u0E31\u0E22 \u0E23\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", phone: "081-111-2223", isHead: false },
      { id: "t-103", name: "\u0E04\u0E23\u0E39\u0E18\u0E32\u0E19\u0E34\u0E19\u0E17\u0E23\u0E4C \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07", phone: "081-111-2224", isHead: false },
      { id: "t-104", name: "\u0E04\u0E23\u0E39\u0E21\u0E32\u0E19\u0E1E \u0E2A\u0E38\u0E02\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E34\u0E4C", phone: "081-111-2225", isHead: false }
    ]
  },
  {
    id: "dorm-2",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 2 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-222-3331",
    capacity: 80,
    teachers: [
      { id: "t-201", name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28", phone: "081-222-3331", isHead: true },
      { id: "t-202", name: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E40\u0E2A\u0E23\u0E34\u0E10 \u0E0A\u0E39\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34", phone: "081-222-3332", isHead: false },
      { id: "t-203", name: "\u0E04\u0E23\u0E39\u0E18\u0E35\u0E23\u0E30 \u0E28\u0E23\u0E35\u0E07\u0E32\u0E21", phone: "081-222-3333", isHead: false }
    ]
  },
  {
    id: "dorm-3",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 3 (\u0E0A\u0E32\u0E22)",
    type: "male",
    teacherName: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-333-4441",
    capacity: 80,
    teachers: [
      { id: "t-301", name: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07", phone: "081-333-4441", isHead: true },
      { id: "t-302", name: "\u0E04\u0E23\u0E39\u0E1E\u0E07\u0E29\u0E4C\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C \u0E40\u0E08\u0E23\u0E34\u0E0D\u0E14\u0E35", phone: "081-333-4442", isHead: false },
      { id: "t-303", name: "\u0E04\u0E23\u0E39\u0E2D\u0E14\u0E34\u0E28\u0E23 \u0E27\u0E07\u0E28\u0E4C\u0E29\u0E32", phone: "081-333-4443", isHead: false },
      { id: "t-304", name: "\u0E04\u0E23\u0E39\u0E2D\u0E19\u0E38\u0E23\u0E31\u0E01\u0E29\u0E4C \u0E23\u0E31\u0E15\u0E19\u0E40\u0E14\u0E0A", phone: "081-333-4444", isHead: false }
    ]
  },
  {
    id: "dorm-4",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 4 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-444-5551",
    capacity: 80,
    teachers: [
      { id: "t-401", name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32", phone: "081-444-5551", isHead: true },
      { id: "t-402", name: "\u0E04\u0E23\u0E39\u0E23\u0E31\u0E15\u0E19\u0E32 \u0E41\u0E01\u0E49\u0E27\u0E21\u0E13\u0E35", phone: "081-444-5552", isHead: false },
      { id: "t-403", name: "\u0E04\u0E23\u0E39\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E43\u0E08 \u0E2A\u0E27\u0E48\u0E32\u0E07\u0E08\u0E34\u0E15\u0E15\u0E4C", phone: "081-444-5553", isHead: false },
      { id: "t-404", name: "\u0E04\u0E23\u0E39\u0E2D\u0E32\u0E23\u0E35\u0E22\u0E32 \u0E40\u0E1E\u0E0A\u0E23\u0E41\u0E17\u0E49", phone: "081-444-5554", isHead: false }
    ]
  },
  {
    id: "dorm-5",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 5 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-555-6661",
    capacity: 80,
    teachers: [
      { id: "t-501", name: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C", phone: "081-555-6661", isHead: true },
      { id: "t-502", name: "\u0E04\u0E23\u0E39\u0E2A\u0E38\u0E1E\u0E23\u0E23\u0E29\u0E32 \u0E14\u0E27\u0E07\u0E41\u0E01\u0E49\u0E27", phone: "081-555-6662", isHead: false },
      { id: "t-503", name: "\u0E04\u0E23\u0E39\u0E27\u0E23\u0E23\u0E13\u0E32 \u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C", phone: "081-555-6663", isHead: false }
    ]
  },
  {
    id: "dorm-6",
    name: "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 6 (\u0E2B\u0E0D\u0E34\u0E07)",
    type: "female",
    teacherName: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    teacherPhone: "081-666-7771",
    capacity: 80,
    teachers: [
      { id: "t-601", name: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C", phone: "081-666-7771", isHead: true },
      { id: "t-602", name: "\u0E04\u0E23\u0E39\u0E0A\u0E19\u0E34\u0E14\u0E32 \u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E44\u0E27", phone: "081-666-7772", isHead: false },
      { id: "t-603", name: "\u0E04\u0E23\u0E39\u0E28\u0E34\u0E23\u0E34\u0E1E\u0E23 \u0E1A\u0E38\u0E0D\u0E2A\u0E48\u0E07", phone: "081-666-7773", isHead: false },
      { id: "t-604", name: "\u0E04\u0E23\u0E39\u0E19\u0E07\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C \u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E44\u0E1E\u0E1A\u0E39\u0E25\u0E22\u0E4C", phone: "081-666-7774", isHead: false }
    ]
  }
];
var studentsStore = [];
var noticesStore = [];
var attendanceStore = {};
var usersStore = [
  {
    id: "user-5",
    name: "\u0E14\u0E23.\u0E1B\u0E23\u0E30\u0E40\u0E2A\u0E23\u0E34\u0E10 (\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23)",
    role: "DEPUTY_DIRECTOR",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25",
    roleLabel: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A / \u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23 (\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14)",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-2",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 (\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01)",
    role: "HEAD_TEACHER",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25",
    roleLabel: "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 (\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 & \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14)",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-1",
    name: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48 \u0E2A\u0E21\u0E28\u0E23\u0E35 (\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19)",
    role: "ADMIN_OFFICER",
    roleLevel: 2,
    roleCategory: "STAFF",
    roleCategoryName: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48",
    roleLabel: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19 (\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 & \u0E08\u0E31\u0E14\u0E17\u0E33\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19)",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-101",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E0A\u0E32\u0E22 \u0E43\u0E08\u0E14\u0E35",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    phone: "081-111-2222",
    dormId: "dorm-1",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-102",
    name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E0A\u0E31\u0E22 \u0E23\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01 1 (\u0E0A\u0E32\u0E22)",
    phone: "081-111-2223",
    dormId: "dorm-1",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-201",
    name: "\u0E04\u0E23\u0E39\u0E2A\u0E21\u0E04\u0E34\u0E14 \u0E14\u0E35\u0E40\u0E25\u0E34\u0E28",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 2 (\u0E0A\u0E32\u0E22)",
    phone: "081-222-3331",
    dormId: "dorm-2",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-2"],
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-301",
    name: "\u0E04\u0E23\u0E39\u0E40\u0E01\u0E23\u0E35\u0E22\u0E07\u0E44\u0E01\u0E23 \u0E21\u0E31\u0E48\u0E19\u0E04\u0E07",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 3 (\u0E0A\u0E32\u0E22)",
    phone: "081-333-4441",
    dormId: "dorm-3",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-3"],
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-401",
    name: "\u0E04\u0E23\u0E39\u0E27\u0E34\u0E44\u0E25\u0E27\u0E23\u0E23\u0E13 \u0E40\u0E21\u0E15\u0E15\u0E32",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 4 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-444-5551",
    dormId: "dorm-4",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-4"],
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-501",
    name: "\u0E04\u0E23\u0E39\u0E19\u0E20\u0E32 \u0E1E\u0E23\u0E2B\u0E21\u0E21\u0E34\u0E19\u0E17\u0E23\u0E4C",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 5 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-555-6661",
    dormId: "dorm-5",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-5"],
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-601",
    name: "\u0E04\u0E23\u0E39\u0E01\u0E32\u0E19\u0E14\u0E32 \u0E19\u0E1E\u0E23\u0E31\u0E15\u0E19\u0E4C",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    roleLabel: "\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01 6 (\u0E2B\u0E0D\u0E34\u0E07)",
    phone: "081-666-7771",
    dormId: "dorm-6",
    dormPosition: "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    allowedDormIds: ["dorm-6"],
    avatarUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  }
];
var systemSettings = {
  schoolNameTh: "\u0E42\u0E23\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19\u0E1E\u0E34\u0E08\u0E34\u0E15\u0E23\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E19\u0E38\u0E01\u0E39\u0E25",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "\u0E1E.\u0E08.\u0E1B.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "\u0E23\u0E30\u0E1A\u0E1A\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19",
  systemNameEn: "Student Dormitory Management System",
  systemIcon: "building",
  lastUpdatedDate: "8 \u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21 \u0E1E.\u0E28. 2569"
};
var DB_FILE_PATH = import_path.default.join(process.cwd(), "database.json");
function normalizeLoadedUsers(rawUsers) {
  let modified = false;
  const users = rawUsers.filter((u) => u && typeof u === "object" && isValidResourceId(u.id)).map((rawUser) => {
    const clean = stripDangerousKeys({ ...rawUser });
    if (typeof clean.password === "string") {
      modified = true;
      const legacyPwd = clean.password.trim();
      delete clean.password;
      if (legacyPwd && !WEAK_PASSWORDS.has(legacyPwd.toLowerCase()) && legacyPwd.length >= 6) {
        clean.passwordHash = hashServerPassword(legacyPwd);
        clean.hasPassword = true;
      } else {
        delete clean.passwordHash;
        clean.hasPassword = false;
      }
    }
    clean.hasPassword = Boolean(clean.passwordHash);
    return clean;
  });
  return { users, modified };
}
function saveDbToDisk() {
  try {
    const cleanUsers = usersStore.map((u) => {
      const copy = stripDangerousKeys({ ...u });
      delete copy.password;
      copy.hasPassword = Boolean(copy.passwordHash);
      return copy;
    });
    const payload = {
      dormitories,
      students: studentsStore,
      notices: noticesStore,
      attendance: attendanceStore,
      users: cleanUsers,
      systemSettings,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    import_fs.default.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save primary database to disk:", err);
  }
}
function formatStudentId(id) {
  if (id === void 0 || id === null) return "";
  const s = String(id).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.padStart(5, "0");
  if (s.length < 5) return s.padStart(5, "0");
  return s;
}
function formatGrade(grade) {
  if (grade === void 0 || grade === null) return "\u0E21.1";
  const str = String(grade).trim();
  if (!str) return "\u0E21.1";
  if (/^ม\.[1-6]$/.test(str)) return str;
  const mMatch = str.match(/(?:มัธยมศึกษาปีที่|ชั้น\s*ม\.?|ม\.?)\s*([1-6])(?:\b|$)/);
  if (mMatch && mMatch[1]) return `\u0E21.${mMatch[1]}`;
  const pMatch = str.match(/(?:ประถมศึกษาปีที่|ชั้น\s*ป\.?|ป\.?)\s*([1-6])(?:\b|$)/);
  if (pMatch && pMatch[1]) return `\u0E1B.${pMatch[1]}`;
  const numMatch = str.match(/^([1-6])(?:\/.*|\b|$)/);
  if (numMatch && numMatch[1]) return `\u0E21.${numMatch[1]}`;
  const anyNum = str.match(/\d+/);
  if (anyNum) return `\u0E21.${anyNum[0]}`;
  return str.startsWith("\u0E21.") ? str : `\u0E21.${str}`;
}
function loadDbFromDisk() {
  try {
    if (import_fs.default.existsSync(DB_FILE_PATH)) {
      const raw = import_fs.default.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = stripDangerousKeys(JSON.parse(raw));
      if (Array.isArray(parsed.dormitories) && parsed.dormitories.length > 0) dormitories = parsed.dormitories;
      const st = parsed.students || parsed.studentsStore;
      if (Array.isArray(st)) {
        studentsStore = st.map((s) => ({
          ...s,
          studentId: formatStudentId(s.studentId),
          grade: formatGrade(s.grade)
        }));
      }
      const nt = parsed.notices || parsed.noticesStore;
      if (Array.isArray(nt)) noticesStore = nt;
      const att = parsed.attendance || parsed.attendanceStore;
      if (att && typeof att === "object") {
        for (const k of Object.keys(att)) {
          if (Array.isArray(att[k]?.records)) {
            att[k].records = att[k].records.map((r) => ({
              ...r,
              studentId: formatStudentId(r.studentId)
            }));
          }
        }
        attendanceStore = att;
      }
      let scrubbedLegacySecrets = false;
      const us = parsed.users || parsed.usersStore;
      if (Array.isArray(us) && us.length > 0) {
        const normalized = normalizeLoadedUsers(us);
        usersStore = normalized.users;
        scrubbedLegacySecrets = normalized.modified;
      }
      if (parsed.systemSettings && typeof parsed.systemSettings === "object") {
        systemSettings = { ...systemSettings, ...parsed.systemSettings };
      }
      if (scrubbedLegacySecrets) {
        saveDbToDisk();
      }
      console.log(`Successfully loaded primary database from ${DB_FILE_PATH}`);
    } else {
      saveDbToDisk();
      console.log(`Initialized new primary database file at ${DB_FILE_PATH}`);
    }
  } catch (err) {
    console.error("Failed to load database from disk:", err);
  }
}
loadDbFromDisk();
function getEnrichedDorms() {
  return dormitories.map((dorm) => {
    if (dorm.teachers && dorm.teachers.length > 0) {
      const headTeacher = dorm.teachers.find((t) => t.isHead || t.position === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01") || dorm.teachers[0];
      const summaryName = headTeacher ? `${headTeacher.name}${dorm.teachers.length > 1 ? ` (\u0E41\u0E25\u0E30\u0E17\u0E35\u0E21\u0E04\u0E23\u0E39 ${dorm.teachers.length - 1} \u0E17\u0E48\u0E32\u0E19)` : ""}` : dorm.teacherName;
      const summaryPhone = headTeacher && headTeacher.phone ? headTeacher.phone : dorm.teacherPhone;
      return {
        ...dorm,
        teacherName: summaryName,
        teacherPhone: summaryPhone
      };
    }
    const assignedTeacherUsers = usersStore.filter((u) => {
      const isTeacher = u.roleLevel === 3 || u.roleCategory === "DORM_TEACHER" || u.role === "DORM_TEACHER";
      const matchesDorm = u.dormId === dorm.id || u.allowedDormIds && u.allowedDormIds.includes(dorm.id);
      return isTeacher && matchesDorm;
    });
    if (assignedTeacherUsers.length > 0) {
      const dynamicTeachers = assignedTeacherUsers.map((u, idx) => {
        let pos = u.dormPosition;
        if (!pos) {
          if (idx === 0) pos = "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else if (idx === 1) pos = "\u0E04\u0E23\u0E39\u0E23\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else if (idx === 2) pos = "\u0E04\u0E23\u0E39\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
          else pos = "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
        }
        return {
          id: u.id,
          name: u.name,
          phone: u.phone || "",
          position: pos,
          isHead: pos === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01" || idx === 0
        };
      });
      const headTeacher = assignedTeacherUsers.find((u) => u.dormPosition === "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E18\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01") || assignedTeacherUsers[0];
      const teacherNameSummary = `${headTeacher.name}${assignedTeacherUsers.length > 1 ? ` (\u0E41\u0E25\u0E30\u0E17\u0E35\u0E21\u0E04\u0E23\u0E39 ${assignedTeacherUsers.length - 1} \u0E17\u0E48\u0E32\u0E19)` : ""}`;
      const teacherPhoneSummary = headTeacher.phone || dorm.teacherPhone || "-";
      return {
        ...dorm,
        teacherName: teacherNameSummary,
        teacherPhone: teacherPhoneSummary,
        teachers: dynamicTeachers
      };
    }
    return dorm;
  });
}
app.post("/api/auth/login", (req, res) => {
  const userId = sanitizeText(req.body?.userId, 128);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isValidResourceId(userId) || !password.trim()) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19" });
  }
  const user = usersStore.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (!user.passwordHash) {
    return res.status(403).json({
      success: false,
      requiresInitialSetup: true,
      message: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19"
    });
  }
  if (!verifyServerPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const token = issueAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeServerUser(user, true)
  });
});
app.post("/api/auth/first-password", (req, res) => {
  const userId = sanitizeText(req.body?.userId, 128);
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!isValidResourceId(userId)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (!isValidServerPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 6 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E40\u0E14\u0E32\u0E07\u0E48\u0E32\u0E22"
    });
  }
  const user = usersStore.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19" });
  }
  if (user.passwordHash || user.hasPassword) {
    return res.status(409).json({
      success: false,
      message: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E14\u0E34\u0E21"
    });
  }
  user.passwordHash = hashServerPassword(newPassword);
  user.hasPassword = true;
  saveDbToDisk();
  const token = issueAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeServerUser(user, true),
    message: "\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08"
  });
});
app.post("/api/auth/logout", (req, res) => {
  if (req.authTokenPayload?.jti) {
    revokedTokens.set(req.authTokenPayload.jti, req.authTokenPayload.exp);
  }
  return res.json({ success: true, message: "\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: sanitizeServerUser(req.authUser, true)
  });
});
app.get("/api/dorms", (_req, res) => {
  res.json({ success: true, data: getEnrichedDorms() });
});
app.post("/api/dorms", requireAuth, requireRole([1, 2]), (req, res) => {
  const name = sanitizeText(req.body?.name, 100);
  const rawType = req.body?.type;
  const type = rawType === "female" || rawType === "mixed" ? rawType : "male";
  const teacherName = sanitizeText(req.body?.teacherName, 120) || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
  const teacherPhone = sanitizeText(req.body?.teacherPhone, 30);
  const capacityNum = Number(req.body?.capacity);
  const capacity = Number.isFinite(capacityNum) && capacityNum > 0 && capacityNum <= 2e3 ? Math.floor(capacityNum) : 80;
  if (!name) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E2B\u0E2D\u0E1E\u0E31\u0E01" });
  }
  const sanitizedTeachers = Array.isArray(req.body?.teachers) ? req.body.teachers.slice(0, 20).map((t) => ({
    id: isValidResourceId(t?.id) ? t.id : void 0,
    name: sanitizeText(t?.name, 120),
    phone: sanitizeText(t?.phone, 30),
    position: sanitizeText(t?.position, 80) || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    isHead: Boolean(t?.isHead)
  })) : [];
  const newDorm = {
    id: `dorm-${Date.now()}`,
    name,
    type,
    teacherName,
    teacherPhone,
    capacity,
    teachers: sanitizedTeachers
  };
  dormitories.push(newDorm);
  saveDbToDisk();
  res.json({ success: true, data: newDorm });
});
app.put("/api/dorms/:id", requireAuth, requireRole([1, 2]), (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const index = dormitories.findIndex((d) => d.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Dormitory not found" });
  const name = req.body?.name !== void 0 ? sanitizeText(req.body.name, 100) : void 0;
  const rawType = req.body?.type;
  const type = rawType === "male" || rawType === "female" || rawType === "mixed" ? rawType : void 0;
  const teacherName = req.body?.teacherName !== void 0 ? sanitizeText(req.body.teacherName, 120) : void 0;
  const teacherPhone = req.body?.teacherPhone !== void 0 ? sanitizeText(req.body.teacherPhone, 30) : void 0;
  const capacityNum = Number(req.body?.capacity);
  const capacity = req.body?.capacity !== void 0 && Number.isFinite(capacityNum) && capacityNum > 0 && capacityNum <= 2e3 ? Math.floor(capacityNum) : void 0;
  const teachers = Array.isArray(req.body?.teachers) ? req.body.teachers.slice(0, 20).map((t) => ({
    id: isValidResourceId(t?.id) ? t.id : void 0,
    name: sanitizeText(t?.name, 120),
    phone: sanitizeText(t?.phone, 30),
    position: sanitizeText(t?.position, 80) || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    isHead: Boolean(t?.isHead)
  })) : void 0;
  const assignedTeacherId = isValidResourceId(req.body?.assignedTeacherId) ? req.body.assignedTeacherId : void 0;
  dormitories[index] = {
    ...dormitories[index],
    ...name ? { name } : {},
    ...type ? { type } : {},
    ...teacherName !== void 0 ? { teacherName } : {},
    ...teacherPhone !== void 0 ? { teacherPhone } : {},
    ...capacity !== void 0 ? { capacity } : {},
    ...teachers !== void 0 ? { teachers } : {},
    ...assignedTeacherId !== void 0 ? { assignedTeacherId } : {}
  };
  if (assignedTeacherId) {
    const assignedUser = usersStore.find((u) => u.id === assignedTeacherId);
    if (assignedUser) {
      dormitories[index].teacherName = assignedUser.name;
      assignedUser.dormId = id;
    }
  }
  saveDbToDisk();
  res.json({ success: true, data: dormitories[index], message: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/students", (req, res) => {
  const { dormId, grade, room } = req.query;
  let result = [...studentsStore];
  if (dormId) {
    result = result.filter((s) => s.dormId === String(dormId));
  }
  if (grade) {
    result = result.filter((s) => s.grade === String(grade));
  }
  if (room) {
    result = result.filter((s) => s.room === Number(room));
  }
  result.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, "th");
    if (a.room !== b.room) return a.room - b.room;
    return a.no - b.no;
  });
  res.json({ success: true, data: result, total: result.length });
});
app.put("/api/students/:id", requireAuth, requireRole([1, 2]), (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Student not found" });
  const b = req.body || {};
  const current = studentsStore[index];
  const updated = {
    ...current,
    ...b.no !== void 0 && Number.isFinite(Number(b.no)) ? { no: Math.max(1, Math.min(999, Math.floor(Number(b.no)))) } : {},
    ...b.title !== void 0 ? { title: sanitizeText(b.title, 40) } : {},
    ...b.firstName !== void 0 ? { firstName: sanitizeText(b.firstName, 100) } : {},
    ...b.lastName !== void 0 ? { lastName: sanitizeText(b.lastName, 100) } : {},
    ...b.nickname !== void 0 ? { nickname: sanitizeText(b.nickname, 60) } : {},
    ...b.dormId !== void 0 && isValidResourceId(b.dormId) ? { dormId: b.dormId } : {},
    ...b.dormRoom !== void 0 ? { dormRoom: sanitizeText(b.dormRoom, 40) } : {},
    ...b.dormBed !== void 0 ? { dormBed: sanitizeText(String(b.dormBed), 20) } : {},
    ...b.room !== void 0 && Number.isFinite(Number(b.room)) ? { room: Math.max(1, Math.min(50, Math.floor(Number(b.room)))) } : {},
    ...b.gender === "male" || b.gender === "female" ? { gender: b.gender } : {},
    studentId: formatStudentId(b.studentId !== void 0 ? b.studentId : current.studentId),
    grade: b.grade !== void 0 ? formatGrade(b.grade) : current.grade
  };
  studentsStore[index] = updated;
  saveDbToDisk();
  res.json({ success: true, data: updated, message: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/users", (req, res) => {
  const includePii = Boolean(req.authUser);
  res.json({
    success: true,
    data: usersStore.map((u) => sanitizeServerUser(u, includePii))
  });
});
app.post("/api/users", requireAuth, requireRole([1]), (req, res) => {
  const name = sanitizeText(req.body?.name, 120);
  if (!name) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19" });
  }
  const rawPassword = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  if (rawPassword && !isValidServerPassword(rawPassword)) {
    return res.status(400).json({
      success: false,
      message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 6 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E40\u0E14\u0E32\u0E07\u0E48\u0E32\u0E22"
    });
  }
  const roleCategoryRaw = req.body?.roleCategory;
  const numLevelRaw = Number(req.body?.roleLevel);
  const numLevel = numLevelRaw === 1 || numLevelRaw === 2 || numLevelRaw === 3 || numLevelRaw === 4 ? numLevelRaw : 2;
  let roleCategory = "STAFF";
  let roleCategoryName = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48";
  let roleLabel = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19";
  let role = "ADMIN_OFFICER";
  const dormPosition = sanitizeText(req.body?.dormPosition, 80) || void 0;
  if (numLevel === 1 || roleCategoryRaw === "ADMIN") {
    roleCategory = "ADMIN";
    roleCategoryName = "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25";
    roleLabel = "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A";
    role = "SYSTEM_ADMIN";
  } else if (numLevel === 2 || roleCategoryRaw === "STAFF") {
    roleCategory = "STAFF";
    roleCategoryName = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48";
    roleLabel = "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19";
    role = "ADMIN_OFFICER";
  } else if (numLevel === 4 || roleCategoryRaw === "GUEST") {
    roleCategory = "GUEST";
    roleCategoryName = "\u0E1C\u0E39\u0E49\u0E40\u0E22\u0E35\u0E48\u0E22\u0E21\u0E0A\u0E21";
    roleLabel = "\u0E1C\u0E39\u0E49\u0E40\u0E22\u0E35\u0E48\u0E22\u0E21\u0E0A\u0E21\u0E23\u0E30\u0E1A\u0E1A";
    role = "GUEST";
  } else {
    roleCategory = "DORM_TEACHER";
    roleCategoryName = "\u0E04\u0E23\u0E39\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    roleLabel = dormPosition || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    role = "DORM_TEACHER";
  }
  const dormId = isValidResourceId(req.body?.dormId) ? req.body.dormId : void 0;
  const allowedDormIds = Array.isArray(req.body?.allowedDormIds) ? req.body.allowedDormIds.filter((d) => isValidResourceId(d)).slice(0, 20) : dormId ? [dormId] : [];
  const passwordHash = rawPassword ? hashServerPassword(rawPassword) : void 0;
  const newUser = {
    id: `user-${Date.now()}`,
    name,
    role,
    roleLevel: numLevel,
    roleCategory,
    roleCategoryName,
    roleLabel,
    phone: sanitizeText(req.body?.phone, 30) || void 0,
    dormId: dormId || allowedDormIds[0] || void 0,
    dormPosition,
    allowedDormIds,
    avatarUrl: sanitizeSafeServerImageUrl(req.body?.avatarUrl) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    ...passwordHash ? { passwordHash } : {},
    hasPassword: Boolean(passwordHash)
  };
  usersStore.push(newUser);
  saveDbToDisk();
  res.json({
    success: true,
    data: sanitizeServerUser(newUser, true),
    message: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22"
  });
});
app.put("/api/users/:id", requireAuth, requireRole([1]), (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const index = usersStore.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "User not found" });
  const current = usersStore[index];
  const b = req.body || {};
  const rawPassword = typeof b.password === "string" ? b.password.trim() : "";
  if (rawPassword && !isValidServerPassword(rawPassword)) {
    return res.status(400).json({
      success: false,
      message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 6 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E40\u0E14\u0E32\u0E07\u0E48\u0E32\u0E22"
    });
  }
  const nextDormId = b.dormId !== void 0 ? isValidResourceId(b.dormId) ? b.dormId : void 0 : current.dormId;
  let nextAllowedDormIds = current.allowedDormIds || [];
  if (Array.isArray(b.allowedDormIds)) {
    nextAllowedDormIds = b.allowedDormIds.filter((d) => isValidResourceId(d)).slice(0, 20);
  }
  if (nextDormId && nextAllowedDormIds.length === 0) {
    nextAllowedDormIds = [nextDormId];
  }
  const nextLevel = b.roleLevel === 1 || b.roleLevel === 2 || b.roleLevel === 3 || b.roleLevel === 4 ? b.roleLevel : current.roleLevel;
  const updated = {
    ...current,
    ...b.name !== void 0 && sanitizeText(b.name, 120) ? { name: sanitizeText(b.name, 120) } : {},
    roleLevel: nextLevel,
    ...b.roleCategory === "ADMIN" || b.roleCategory === "STAFF" || b.roleCategory === "DORM_TEACHER" || b.roleCategory === "GUEST" ? { roleCategory: b.roleCategory } : {},
    ...b.roleCategoryName !== void 0 ? { roleCategoryName: sanitizeText(b.roleCategoryName, 80) } : {},
    ...b.roleLabel !== void 0 ? { roleLabel: sanitizeText(b.roleLabel, 150) } : {},
    ...b.phone !== void 0 ? { phone: sanitizeText(b.phone, 30) } : {},
    dormId: nextDormId,
    ...b.dormPosition !== void 0 ? { dormPosition: sanitizeText(b.dormPosition, 80) } : {},
    allowedDormIds: nextAllowedDormIds,
    ...b.avatarUrl !== void 0 ? { avatarUrl: sanitizeSafeServerImageUrl(b.avatarUrl) || current.avatarUrl } : {},
    ...rawPassword ? { passwordHash: hashServerPassword(rawPassword), hasPassword: true } : {}
  };
  usersStore[index] = updated;
  saveDbToDisk();
  res.json({
    success: true,
    data: sanitizeServerUser(updated, true),
    message: "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22"
  });
});
app.delete("/api/users/:id", requireAuth, requireRole([1]), (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (req.authUser?.id === id) {
    return res.status(400).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E25\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E44\u0E14\u0E49" });
  }
  usersStore = usersStore.filter((u) => u.id !== id);
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.post("/api/users/:id/change-password", requireAuth, (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const oldPassword = typeof req.body?.oldPassword === "string" ? req.body.oldPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const isAdminOverride = Boolean(req.body?.isAdminOverride);
  if (isAdminOverride) {
    if (req.authUser?.roleLevel !== 1) {
      return res.status(403).json({ success: false, message: "\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E30\u0E14\u0E31\u0E1A 1 \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E1C\u0E39\u0E49\u0E2D\u0E37\u0E48\u0E19\u0E44\u0E14\u0E49" });
    }
  } else if (req.authUser?.id !== id) {
    return res.status(403).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E2D\u0E37\u0E48\u0E19" });
  }
  if (!isValidServerPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 6 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E17\u0E35\u0E48\u0E04\u0E32\u0E14\u0E40\u0E14\u0E32\u0E07\u0E48\u0E32\u0E22"
    });
  }
  const user = usersStore.find((u) => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (!isAdminOverride && user.passwordHash) {
    if (!verifyServerPassword(oldPassword, user.passwordHash)) {
      return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E14\u0E34\u0E21\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
    }
  }
  user.passwordHash = hashServerPassword(newPassword);
  user.hasPassword = true;
  saveDbToDisk();
  res.json({ success: true, message: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/system-settings", (_req, res) => {
  res.json({ success: true, data: systemSettings });
});
app.put("/api/system-settings", requireAuth, requireRole([1]), (req, res) => {
  const b = req.body || {};
  const nextSettings = {
    ...systemSettings,
    ...b.schoolNameTh !== void 0 ? { schoolNameTh: sanitizeText(b.schoolNameTh, 160) } : {},
    ...b.schoolNameEn !== void 0 ? { schoolNameEn: sanitizeText(b.schoolNameEn, 160) } : {},
    ...b.schoolAcronymTh !== void 0 ? { schoolAcronymTh: sanitizeText(b.schoolAcronymTh, 40) } : {},
    ...b.schoolAcronymEn !== void 0 ? { schoolAcronymEn: sanitizeText(b.schoolAcronymEn, 40) } : {},
    ...b.schoolLogoUrl !== void 0 ? { schoolLogoUrl: sanitizeSafeServerImageUrl(b.schoolLogoUrl) || systemSettings.schoolLogoUrl } : {},
    ...b.systemNameTh !== void 0 ? { systemNameTh: sanitizeText(b.systemNameTh, 160) } : {},
    ...b.systemNameEn !== void 0 ? { systemNameEn: sanitizeText(b.systemNameEn, 160) } : {},
    ...b.systemIcon !== void 0 ? { systemIcon: sanitizeText(b.systemIcon, 40) } : {},
    ...b.lastUpdatedDate !== void 0 ? { lastUpdatedDate: sanitizeText(b.lastUpdatedDate, 80) } : {},
    ...b.maintenanceTitle !== void 0 ? { maintenanceTitle: sanitizeText(b.maintenanceTitle, 200) } : {},
    ...b.maintenanceMessage !== void 0 ? { maintenanceMessage: sanitizeText(b.maintenanceMessage, 1e3) } : {},
    ...b.showMaintenancePopup !== void 0 ? { showMaintenancePopup: Boolean(b.showMaintenancePopup) } : {},
    ...b.showMaintenanceBox !== void 0 ? { showMaintenanceBox: Boolean(b.showMaintenanceBox) } : {},
    ...b.isAttendancePaused !== void 0 ? { isAttendancePaused: Boolean(b.isAttendancePaused) } : {},
    ...Array.isArray(b.pausedDormIds) ? { pausedDormIds: b.pausedDormIds.filter((d) => isValidResourceId(d)).slice(0, 50) } : {},
    ...b.attendancePauseReason !== void 0 ? { attendancePauseReason: sanitizeText(b.attendancePauseReason, 300) } : {},
    ...b.attendancePausedAt !== void 0 ? { attendancePausedAt: sanitizeText(b.attendancePausedAt, 60) } : {},
    ...b.attendancePausedBy !== void 0 ? { attendancePausedBy: sanitizeText(b.attendancePausedBy, 120) } : {},
    ...b.guestRequiresLogin !== void 0 ? { guestRequiresLogin: Boolean(b.guestRequiresLogin) } : {}
  };
  systemSettings = nextSettings;
  saveDbToDisk();
  res.json({ success: true, data: systemSettings, message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.post("/api/database/save-primary", requireAuth, requireRole([1]), (_req, res) => {
  saveDbToDisk();
  res.json({
    success: true,
    message: "\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E0A\u0E38\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27"
  });
});
app.post("/api/database/reset", requireAuth, requireRole([1]), (_req, res) => {
  studentsStore = [];
  attendanceStore = {};
  noticesStore = [];
  dormitories = [];
  usersStore = usersStore.filter((u) => u.roleLevel === 1).map((u) => ({
    ...u,
    dormId: void 0,
    allowedDormIds: []
  }));
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E49\u0E32\u0E07\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 (\u0E23\u0E27\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E39\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E2B\u0E2D\u0E1E\u0E31\u0E01) \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/database/clear-attendance", requireAuth, requireRole([1]), (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, clearNotices } = req.body;
  let countCleared = 0;
  let countNoticesCleared = 0;
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "BY_DATE" && isValidIsoDate(date)) return itemDate === date;
    if (mode === "BY_MONTH" && typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) return itemDate.startsWith(month);
    if (mode === "BY_RANGE" && isValidIsoDate(startDate) && isValidIsoDate(endDate)) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  const targetDorm = dormitories.find((d) => d.id === dormId);
  const dormNameLabel = dormId === "ALL" || !dormId ? "\u0E17\u0E38\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01" : targetDorm ? targetDorm.name : sanitizeText(dormId, 60);
  Object.keys(attendanceStore).forEach((key) => {
    const record = attendanceStore[key];
    const recordDate = record?.date || key.split("_")[0];
    const recordDorm = record?.dormId || key.split("_")[1];
    const matchDate = isMatchingDate(recordDate);
    const matchDorm = dormId === "ALL" || !dormId || recordDorm === dormId;
    if (matchDate && matchDorm) {
      delete attendanceStore[key];
      countCleared++;
    }
  });
  if (clearNotices) {
    const beforeNotices = noticesStore.length;
    noticesStore = noticesStore.filter((n) => !isMatchingDate(n.date));
    countNoticesCleared = beforeNotices - noticesStore.length;
  }
  saveDbToDisk();
  return res.json({
    success: true,
    message: `\u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14 (${countCleared} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23) \u0E41\u0E25\u0E30\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 (${countNoticesCleared} \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07) \u0E02\u0E2D\u0E07 ${dormNameLabel} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`,
    countCleared,
    countNoticesCleared
  });
});
app.post("/api/database/attendance/export", requireAuth, requireRole([1, 2]), (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, includeNotices = true } = req.body;
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && isValidIsoDate(date)) return itemDate === date;
    if (mode === "MONTH" && typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) return itemDate.startsWith(month);
    if (mode === "RANGE" && isValidIsoDate(startDate) && isValidIsoDate(endDate)) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  const filteredAttendance = Object.values(attendanceStore).filter((r) => {
    const matchDate = isMatchingDate(r.date);
    const matchDorm = !dormId || dormId === "ALL" || r.dormId === dormId;
    return matchDate && matchDorm;
  });
  const filteredNotices = includeNotices ? noticesStore.filter((n) => isMatchingDate(n.date)) : [];
  res.json({
    success: true,
    data: {
      backupType: "ATTENDANCE_AND_NOTICES",
      mode,
      selectedDate: date || null,
      selectedMonth: month || null,
      startDate: startDate || null,
      endDate: endDate || null,
      dormId: dormId || "ALL",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      attendance: filteredAttendance,
      notices: filteredNotices
    }
  });
});
app.post("/api/database/attendance/restore", requireAuth, requireRole([1]), (req, res) => {
  const { data, mode = "ALL", date, month, startDate, endDate, dormId } = req.body;
  const rawAttendance = Array.isArray(data?.attendance) ? data.attendance : [];
  const rawNotices = Array.isArray(data?.notices) ? data.notices : [];
  const isMatchingDate = (itemDate) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && isValidIsoDate(date)) return itemDate === date;
    if (mode === "MONTH" && typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) return itemDate.startsWith(month);
    if (mode === "RANGE" && isValidIsoDate(startDate) && isValidIsoDate(endDate)) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };
  let restoredAtt = 0;
  rawAttendance.forEach((att) => {
    if (att && isValidIsoDate(att.date) && isValidResourceId(att.dormId) && isMatchingDate(att.date) && (!dormId || dormId === "ALL" || att.dormId === dormId)) {
      attendanceStore[`${att.date}_${att.dormId}`] = {
        ...att,
        id: `${att.date}_${att.dormId}`,
        records: Array.isArray(att.records) ? att.records : [],
        teacherOrientationNotes: Array.isArray(att.teacherOrientationNotes) ? att.teacherOrientationNotes : []
      };
      restoredAtt++;
    }
  });
  let restoredNotices = 0;
  rawNotices.forEach((n) => {
    if (n && isValidResourceId(n.id) && isValidIsoDate(n.date) && isMatchingDate(n.date)) {
      const idx = noticesStore.findIndex((item) => item.id === n.id);
      if (idx >= 0) noticesStore[idx] = n;
      else noticesStore.push(n);
      restoredNotices++;
    }
  });
  saveDbToDisk();
  res.json({
    success: true,
    message: `\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: \u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14 ${restoredAtt} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23, \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21 ${restoredNotices} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`
  });
});
app.post("/api/database/clear-students", requireAuth, requireRole([1]), (req, res) => {
  const { mode, dormId } = req.body;
  const countBefore = studentsStore.length;
  if (mode === "BY_DORM") {
    if (!isValidResourceId(dormId)) {
      return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19" });
    }
    const targetDorm = dormitories.find((d) => d.id === dormId);
    studentsStore = studentsStore.filter((s) => s.dormId !== dormId);
    saveDbToDisk();
    const deletedCount = countBefore - studentsStore.length;
    return res.json({
      success: true,
      message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E43\u0E19 ${targetDorm?.name || dormId} \u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
    });
  } else if (mode === "ALL") {
    const deletedCount = studentsStore.length;
    studentsStore = [];
    saveDbToDisk();
    return res.json({
      success: true,
      message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E38\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01 \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
    });
  }
  res.status(400).json({ success: false, message: "\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
});
app.get("/api/database/export", requireAuth, requireRole([1]), (_req, res) => {
  res.json({
    success: true,
    data: {
      dormitories,
      students: studentsStore,
      notices: noticesStore,
      attendance: attendanceStore,
      users: usersStore.map((u) => sanitizeServerUser(u, true)),
      systemSettings,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
app.post("/api/database/restore", requireAuth, requireRole([1]), (req, res) => {
  const { dormitories: d, students: s, notices: n, attendance: a, users: u, systemSettings: set } = req.body;
  if (Array.isArray(d)) dormitories = d;
  if (Array.isArray(s)) {
    studentsStore = s.map((item) => ({
      ...item,
      studentId: formatStudentId(item.studentId),
      grade: formatGrade(item.grade)
    }));
  }
  if (Array.isArray(n)) noticesStore = n;
  if (a && typeof a === "object" && !Array.isArray(a)) attendanceStore = a;
  if (Array.isArray(u)) {
    usersStore = normalizeLoadedUsers(u).users;
  }
  if (set && typeof set === "object") {
    systemSettings = { ...systemSettings, ...set };
  }
  saveDbToDisk();
  res.json({ success: true, message: "\u0E01\u0E39\u0E49\u0E04\u0E37\u0E19\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01\u0E44\u0E1F\u0E25\u0E4C JSON \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/students/import", requireAuth, requireRole([1, 2]), (req, res) => {
  const { dormId, students } = req.body;
  if (!isValidResourceId(dormId) || !Array.isArray(students) || students.length > 2e3) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }
  const dorm = dormitories.find((d) => d.id === dormId);
  const newStudentsList = students.map((s, idx) => ({
    id: `std-${Date.now()}-${idx}`,
    studentId: formatStudentId(s?.studentId) || String(66e3 + idx).padStart(5, "0"),
    no: Number(s?.no) || idx + 1,
    title: sanitizeText(s?.title, 40) || (dorm?.type === "male" ? "\u0E19\u0E32\u0E22" : "\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27"),
    firstName: sanitizeText(s?.firstName, 100),
    lastName: sanitizeText(s?.lastName, 100),
    grade: formatGrade(s?.grade),
    room: Number(s?.room) || 1,
    dormId,
    dormRoom: sanitizeText(s?.dormRoom, 40) || "101",
    gender: dorm?.type === "female" ? "female" : "male"
  }));
  studentsStore = studentsStore.filter((s) => s.dormId !== dormId).concat(newStudentsList);
  saveDbToDisk();
  res.json({
    success: true,
    message: `\u0E19\u0E33\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E08\u0E33\u0E19\u0E27\u0E19 ${newStudentsList.length} \u0E04\u0E19`,
    count: newStudentsList.length
  });
});
app.post("/api/students", requireAuth, requireRole([1, 2]), (req, res) => {
  const dormId = sanitizeText(req.body?.dormId, 128);
  const firstName = sanitizeText(req.body?.firstName, 100);
  const lastName = sanitizeText(req.body?.lastName, 100);
  if (!isValidResourceId(dormId) || !firstName || !lastName) {
    return res.status(400).json({ success: false, message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E21\u0E48\u0E04\u0E23\u0E1A\u0E16\u0E49\u0E27\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const newStudent = {
    id: `std-${Date.now()}`,
    studentId: formatStudentId(req.body?.studentId) || `0${Math.floor(1e3 + Math.random() * 8999)}`,
    no: Math.max(1, Math.min(999, Number(req.body?.no) || 1)),
    title: sanitizeText(req.body?.title, 40) || "\u0E19\u0E32\u0E22",
    firstName,
    lastName,
    grade: formatGrade(req.body?.grade),
    room: Math.max(1, Math.min(50, Number(req.body?.room) || 1)),
    dormId,
    dormRoom: sanitizeText(req.body?.dormRoom, 40) || "101",
    gender: req.body?.gender === "female" ? "female" : "male"
  };
  studentsStore.push(newStudent);
  saveDbToDisk();
  res.json({ success: true, data: newStudent });
});
app.delete("/api/students/:id", requireAuth, requireRole([1, 2]), (req, res) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  studentsStore = studentsStore.filter((s) => s.id !== id);
  saveDbToDisk();
  res.json({ success: true, message: "\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
});
app.post("/api/students/batch-delete", requireAuth, requireRole([1, 2]), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 2e3) {
    return res.status(400).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A" });
  }
  const idSet = new Set(ids.filter((id) => typeof id === "string"));
  const countBefore = studentsStore.length;
  studentsStore = studentsStore.filter((s) => !idSet.has(s.id));
  saveDbToDisk();
  const deletedCount = countBefore - studentsStore.length;
  res.json({ success: true, message: `\u0E25\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19 ${deletedCount} \u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27` });
});
app.get("/api/notices", (req, res) => {
  const { date } = req.query;
  let list = [...noticesStore];
  if (date) {
    list = list.filter((n) => n.date === String(date));
  }
  res.json({ success: true, data: list });
});
app.post("/api/notices", requireAuth, requireRole([1, 2]), (req, res) => {
  const title = sanitizeText(req.body?.title, 200);
  const rawDate = req.body?.date;
  const date = isValidIsoDate(rawDate) ? rawDate : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const topicsInput = Array.isArray(req.body?.topics) ? req.body.topics : [req.body?.topics];
  const topics = topicsInput.map((t) => sanitizeText(t, 400)).filter((t) => t.length > 0).slice(0, 30);
  if (!title) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21" });
  }
  const newNotice = {
    id: `not-${Date.now()}`,
    date,
    title,
    topics,
    createdBy: sanitizeText(req.body?.createdBy, 120) || req.authUser?.name || "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  noticesStore.unshift(newNotice);
  saveDbToDisk();
  res.json({ success: true, data: newNotice });
});
var ALLOWED_ATTENDANCE_STATUSES = /* @__PURE__ */ new Set([
  "ROUND_HOME",
  "PRESENT",
  "QUARANTINE",
  "HOME",
  "CAMP",
  "SICK",
  "SKILL_COMP",
  "EXCHANGE",
  "WALK_STUDY",
  "SEMESTER_BREAK",
  "NOT_ARRIVED",
  "OTHER"
]);
app.get("/api/attendance", (req, res) => {
  const { date, dormId } = req.query;
  const reqDate = date ? String(date) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (dormId) {
    const key = `${reqDate}_${dormId}`;
    const record = attendanceStore[key] || {
      id: key,
      date: reqDate,
      dormId: String(dormId),
      isHomeBreak: false,
      status: "PENDING",
      teacherOrientationNotes: [],
      records: []
    };
    return res.json({ success: true, data: record });
  }
  const result = {};
  dormitories.forEach((d) => {
    const key = `${reqDate}_${d.id}`;
    result[d.id] = attendanceStore[key] || {
      id: key,
      date: reqDate,
      dormId: d.id,
      isHomeBreak: false,
      status: "PENDING",
      teacherOrientationNotes: [],
      records: []
    };
  });
  res.json({ success: true, data: result, date: reqDate });
});
app.post("/api/attendance", requireAuth, requireRole([1, 2, 3]), (req, res) => {
  const date = req.body?.date;
  const dormId = req.body?.dormId;
  if (!isValidIsoDate(date) || !isValidResourceId(dormId)) {
    return res.status(400).json({ success: false, message: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (req.authUser?.roleLevel === 3) {
    const allowed = /* @__PURE__ */ new Set([...req.authUser.allowedDormIds || [], ...req.authUser.dormId ? [req.authUser.dormId] : []]);
    if (!allowed.has(dormId)) {
      return res.status(403).json({ success: false, message: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E02\u0E2D\u0E07\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E2D\u0E37\u0E48\u0E19" });
    }
  }
  const key = `${date}_${dormId}`;
  const isHomeBreak = Boolean(req.body?.isHomeBreak);
  const teacherOrientationNotes = Array.isArray(req.body?.teacherOrientationNotes) ? req.body.teacherOrientationNotes.map((n) => sanitizeText(n, 400)).filter(Boolean).slice(0, 30) : [];
  const records = Array.isArray(req.body?.records) ? req.body.records.slice(0, 1e3).map((r) => ({
    studentId: formatStudentId(r?.studentId),
    status: ALLOWED_ATTENDANCE_STATUSES.has(r?.status) ? r.status : "PRESENT",
    ...r?.reason !== void 0 ? { reason: sanitizeText(r.reason, 200) } : {},
    ...r?.note !== void 0 ? { note: sanitizeText(r.note, 200) } : {}
  })) : [];
  const updatedRecord = {
    id: key,
    date,
    dormId,
    isHomeBreak,
    status: isHomeBreak ? "HOME_BREAK" : "CHECKED",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    checkedBy: sanitizeText(req.body?.checkedBy, 120) || req.authUser?.name || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
    teacherOrientationNotes,
    records
  };
  attendanceStore[key] = updatedRecord;
  saveDbToDisk();
  res.json({ success: true, data: updatedRecord, message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
});
app.get("/api/reports/daily", (req, res) => {
  const rawDate = req.query.date ? String(req.query.date) : "";
  const reportDate = isValidIsoDate(rawDate) ? rawDate : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const reportD = new Date(reportDate);
  reportD.setDate(reportD.getDate() - 1);
  const summaryDate = reportD.toISOString().split("T")[0];
  const gradesList = ["\u0E21.1", "\u0E21.2", "\u0E21.3", "\u0E21.4", "\u0E21.5", "\u0E21.6"];
  const totalMatrix = {};
  const outMatrix = {};
  const remainingMatrix = {};
  const dormTotals = {};
  const gradeTotals = {};
  gradesList.forEach((g) => {
    gradeTotals[g] = { total: 0, out: 0, remaining: 0 };
  });
  const absentStudentsList = [];
  let overallTotal = 0;
  let overallOut = 0;
  let overallRemaining = 0;
  let absentCounter = 0;
  dormitories.forEach((dorm) => {
    totalMatrix[dorm.id] = {};
    outMatrix[dorm.id] = {};
    remainingMatrix[dorm.id] = {};
    let dormTotalCount = 0;
    let dormOutCount = 0;
    let dormRemCount = 0;
    const dormStudents = studentsStore.filter((s) => s.dormId === dorm.id);
    const attendanceKey = `${summaryDate}_${dorm.id}`;
    const attendance = attendanceStore[attendanceKey];
    gradesList.forEach((g) => {
      const studentsInGrade = dormStudents.filter((s) => s.grade === g);
      const totalInGrade = studentsInGrade.length;
      let outInGrade = 0;
      if (attendance) {
        if (attendance.isHomeBreak) {
          outInGrade = totalInGrade;
        } else {
          studentsInGrade.forEach((std) => {
            const stdRec = attendance.records.find((r) => r.studentId === std.studentId);
            if (stdRec && stdRec.status !== "PRESENT") {
              outInGrade++;
              absentCounter++;
              let statusLabel = stdRec.status === "ROUND_HOME" ? "\u0E23\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19" : "\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19";
              if (stdRec.status === "SICK") statusLabel = "\u0E1B\u0E48\u0E27\u0E22";
              if (stdRec.status === "SKILL_COMP") statusLabel = "\u0E41\u0E02\u0E48\u0E07\u0E17\u0E31\u0E01\u0E29\u0E30";
              if (stdRec.status === "EXCHANGE") statusLabel = "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E41\u0E25\u0E01\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19";
              if (stdRec.status === "OTHER") statusLabel = "\u0E2D\u0E37\u0E48\u0E19";
              absentStudentsList.push({
                no: absentCounter,
                studentId: std.studentId,
                fullName: `${std.title}${std.firstName} ${std.lastName}`,
                gradeRoom: `${std.grade}/${std.room}`,
                dormName: dorm.name,
                dormId: dorm.id,
                reason: stdRec.reason ? `${statusLabel} (${stdRec.reason})` : statusLabel,
                status: stdRec.status
              });
            }
          });
        }
      }
      const remInGrade = totalInGrade - outInGrade;
      totalMatrix[dorm.id][g] = totalInGrade;
      outMatrix[dorm.id][g] = outInGrade;
      remainingMatrix[dorm.id][g] = remInGrade;
      dormTotalCount += totalInGrade;
      dormOutCount += outInGrade;
      dormRemCount += remInGrade;
      gradeTotals[g].total += totalInGrade;
      gradeTotals[g].out += outInGrade;
      gradeTotals[g].remaining += remInGrade;
    });
    dormTotals[dorm.id] = {
      total: dormTotalCount,
      out: dormOutCount,
      remaining: dormRemCount
    };
    overallTotal += dormTotalCount;
    overallOut += dormOutCount;
    overallRemaining += dormRemCount;
  });
  const headTeacherNotices = noticesStore.filter((n) => n.date === summaryDate || n.date === reportDate);
  const dormTeacherOrientations = dormitories.map((dorm) => {
    const attendanceKey = `${summaryDate}_${dorm.id}`;
    const attendance = attendanceStore[attendanceKey];
    const dormEnriched = getEnrichedDorms().find((d) => d.id === dorm.id);
    const defaultTeacherName = dormEnriched?.teachers?.[0]?.name || dorm.teacherName || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
    const ownNotes = (attendance?.teacherOrientationNotes || []).filter((n) => n.trim().length > 0);
    return {
      dormId: dorm.id,
      dormName: dorm.name,
      checkedBy: attendance?.checkedBy || defaultTeacherName,
      checkedAt: attendance?.checkedAt,
      status: attendance?.status || "PENDING",
      orientationNotes: ownNotes
    };
  });
  res.json({
    success: true,
    reportDate,
    summaryDate,
    dormitories,
    grades: gradesList,
    totalMatrix,
    outMatrix,
    remainingMatrix,
    dormTotals,
    gradeTotals,
    grandTotals: {
      total: overallTotal,
      out: overallOut,
      remaining: overallRemaining
    },
    absentStudentsList,
    signatories: {
      creator: "\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
      headTeacher: "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01",
      deputyDirector: "\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23\u0E1D\u0E48\u0E32\u0E22\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E01\u0E34\u0E08\u0E01\u0E32\u0E23\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19"
    },
    headTeacherNotices,
    dormTeacherOrientations
  });
});
app.post("/api/google-sheets/export", requireAuth, requireRole([1, 2]), async (req, res) => {
  try {
    const { accessToken, reportData } = req.body;
    if (!reportData || typeof reportData !== "object") {
      return res.status(400).json({ success: false, message: "Missing reportData" });
    }
    const TARGET_DRIVE_FOLDER_ID = "17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg";
    const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg?usp=sharing";
    if (typeof accessToken === "string" && accessToken.trim().length > 10 && accessToken.length < 4096) {
      const safeToken = accessToken.trim();
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${safeToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48_${sanitizeText(reportData.reportDate, 30)}`
          },
          sheets: [
            { properties: { title: "1.\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19" } },
            { properties: { title: "2.\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01" } },
            { properties: { title: "3.\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19" } }
          ]
        })
      });
      if (createRes.ok) {
        const sheetJson = await createRes.json();
        const spreadsheetId = sheetJson.spreadsheetId;
        const spreadsheetUrl = sheetJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`;
        if (isValidResourceId(spreadsheetId)) {
          try {
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?addParents=${TARGET_DRIVE_FOLDER_ID}`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${safeToken}` }
              }
            );
          } catch (fErr) {
            console.warn("Could not move file to folder:", fErr instanceof Error ? fErr.message : "unknown error");
          }
          const sheet1Values = [
            ["\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E43\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
            [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
            [],
            ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "", "", "", "", "", "", "\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
            ["\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21", "\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21"],
            ...reportData.dormitories.map((d) => [
              d.name,
              ...reportData.grades.map((g) => reportData.totalMatrix[d.id][g]),
              reportData.dormTotals[d.id].total,
              d.name,
              ...reportData.grades.map((g) => reportData.outMatrix[d.id][g]),
              reportData.dormTotals[d.id].out
            ]),
            [
              "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
              ...reportData.grades.map((g) => reportData.gradeTotals[g].total),
              reportData.grandTotals.total,
              "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
              ...reportData.grades.map((g) => reportData.gradeTotals[g].out),
              reportData.grandTotals.out
            ],
            [],
            ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E15\u0E48\u0E25\u0E30\u0E2B\u0E2D\u0E1E\u0E31\u0E01", "", "", "", "", "", "", ""],
            ["\u0E2B\u0E2D\u0E1E\u0E31\u0E01 / \u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19", ...reportData.grades, "\u0E23\u0E27\u0E21", "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................", "(.....................................................)"],
            ...reportData.dormitories.map((d, idx) => {
              let sigLabel = "";
              if (idx === 0) sigLabel = "\u0E1C\u0E39\u0E49\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19 (\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19)";
              if (idx === 2) sigLabel = "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................";
              if (idx === 3) sigLabel = "(.....................................................)";
              if (idx === 4) sigLabel = "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01";
              let sigValue = "";
              if (idx === 1) sigValue = "\u0E25\u0E07\u0E0A\u0E37\u0E48\u0E2D.....................................................................";
              if (idx === 2) sigValue = "(.....................................................)";
              if (idx === 3) sigValue = "\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E2D\u0E33\u0E19\u0E27\u0E22\u0E01\u0E32\u0E23";
              return [
                d.name,
                ...reportData.grades.map((g) => reportData.remainingMatrix[d.id][g]),
                reportData.dormTotals[d.id].remaining,
                sigLabel,
                sigValue
              ];
            }),
            [
              "\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19",
              ...reportData.grades.map((g) => reportData.gradeTotals[g].remaining),
              reportData.grandTotals.remaining
            ]
          ];
          const sheet2Values = [
            ["\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
            [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
            [],
            ["\u0E17\u0E35\u0E48", "\u0E23\u0E2B\u0E31\u0E2A\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", "\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E0A\u0E31\u0E49\u0E19/\u0E2B\u0E49\u0E2D\u0E07", "\u0E2B\u0E2D\u0E1E\u0E31\u0E01", "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
            ...reportData.absentStudentsList.map((s) => [
              s.no,
              s.studentId,
              s.fullName,
              s.gradeRoom,
              s.dormName,
              s.reason
            ])
          ];
          const sheet3Values = [
            ["\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19"],
            [`\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E17\u0E33\u0E2A\u0E23\u0E38\u0E1B\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19: ${reportData.reportDate}`, `\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49: ${reportData.summaryDate}`],
            [],
            ["1. \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01"],
            ...reportData.headTeacherNotices && reportData.headTeacherNotices.length > 0 ? reportData.headTeacherNotices.flatMap((n) => [
              [`\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D: ${n.title}`],
              ...n.topics.map((t) => [`   - ${t}`])
            ]) : [["\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E43\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49"]],
            [],
            ["2. \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01\u0E2D\u0E1A\u0E23\u0E21\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19"],
            ...reportData.dormTeacherOrientations && reportData.dormTeacherOrientations.length > 0 ? reportData.dormTeacherOrientations.flatMap((o) => [
              [`${o.dormName} (\u0E04\u0E23\u0E39\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E47\u0E04\u0E22\u0E2D\u0E14\u0E41\u0E25\u0E30\u0E2D\u0E1A\u0E23\u0E21: ${o.checkedBy || "\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01"})`],
              ...o.orientationNotes && o.orientationNotes.length > 0 ? o.orientationNotes.map((note) => [`   - ${note}`]) : [["   - \u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E43\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49"]]
            ]) : [["\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E08\u0E32\u0E01\u0E04\u0E23\u0E39\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2B\u0E2D\u0E1E\u0E31\u0E01"]]
          ];
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${safeToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                valueInputOption: "USER_ENTERED",
                data: [
                  { range: "'1.\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E08\u0E33\u0E19\u0E27\u0E19\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19'!A1", values: sheet1Values },
                  { range: "'2.\u0E15\u0E32\u0E23\u0E32\u0E07\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2D\u0E2D\u0E01\u0E2B\u0E2D\u0E1E\u0E31\u0E01'!A1", values: sheet2Values },
                  { range: "'3.\u0E43\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E08\u0E49\u0E07\u0E2D\u0E1A\u0E23\u0E21\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19'!A1", values: sheet3Values }
                ]
              })
            }
          );
        }
        return res.json({
          success: true,
          spreadsheetId,
          spreadsheetUrl,
          driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
          message: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C\u0E25\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C Google Drive \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27!"
        });
      }
    }
    return res.json({
      success: true,
      spreadsheetUrl: TARGET_DRIVE_FOLDER_URL,
      driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
      message: "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1B\u0E34\u0E14\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C Google Drive \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E23\u0E38\u0E1B\u0E2B\u0E2D\u0E1E\u0E31\u0E01"
    });
  } catch (err) {
    console.error("Export Google Sheets Error:", err instanceof Error ? err.message : "unknown error");
    res.status(500).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E1B\u0E22\u0E31\u0E07 Google Sheets \u0E44\u0E14\u0E49" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa"
    });
    app.get("/@vite/client", async (_req, res, next) => {
      try {
        const result = await vite.transformRequest("/@vite/client");
        if (result && result.code) {
          const patched = result.code.replace(
            /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
            "/* HMR WebSocket disabled */"
          );
          res.type("application/javascript").send(patched);
          return;
        }
      } catch (_err) {
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  formatGrade,
  formatStudentId,
  loadDbFromDisk,
  saveDbToDisk
});
//# sourceMappingURL=server.cjs.map
