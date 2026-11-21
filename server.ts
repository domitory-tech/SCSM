import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.set("trust proxy", 1);

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function stripDangerousKeys<T>(input: T): T {
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

// Security headers & Production HTTPS enforcement
app.use((req: Request, res: Response, next: NextFunction) => {
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

app.use(express.json({ limit: "10mb" }));
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    req.body = stripDangerousKeys(req.body);
  }
  next();
});

// In-memory persistent database store initialized with school dormitory structure
// In a production setup, this can be synced to Google Sheets or the primary cloud database

export interface Student {
  id: string;
  studentId: string;
  no: number;
  title: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  grade: string; // ม.1, ม.2, ม.3, ม.4, ม.5, ม.6
  room: number; // 1, 2, 3...
  dormId: string; // dorm-1 to dorm-6
  dormRoom: string; // e.g., 101, 102
  dormBed?: string;
  bed?: string | number;
  gender: "male" | "female";
}

export interface DormTeacher {
  id?: string;
  name: string;
  phone?: string;
  position?: "ประธานหอพัก" | "รองประธานหอพัก" | "ครูประจำหอพัก" | string;
  isHead?: boolean;
}

export interface Dormitory {
  id: string;
  name: string;
  type: "male" | "female" | "mixed";
  teacherName: string;
  teacherPhone: string;
  teachers?: DormTeacher[];
  capacity: number;
  assignedTeacherId?: string;
}

export interface Notice {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  topics: string[];
  createdBy: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: "ADMIN_OFFICER" | "HEAD_TEACHER" | "DORM_TEACHER" | "DEPUTY_DIRECTOR" | "SYSTEM_ADMIN" | "GUEST";
  roleLevel: 1 | 2 | 3 | 4;
  roleCategory: "ADMIN" | "STAFF" | "DORM_TEACHER" | "GUEST";
  roleCategoryName: string;
  roleLabel: string;
  phone?: string;
  dormId?: string;
  dormPosition?: "ครูประธานหอพัก" | "ครูรองประธานหอพัก" | "ครูหัวหน้าหอพัก" | "ครูประจำหอพัก" | string;
  allowedDormIds?: string[];
  avatarUrl?: string;
  passwordHash?: string;
  hasPassword?: boolean;
}

export interface StudentAttendanceRecord {
  studentId: string;
  status:
    | "ROUND_HOME"
    | "PRESENT"
    | "QUARANTINE"
    | "HOME"
    | "CAMP"
    | "SICK"
    | "SKILL_COMP"
    | "EXCHANGE"
    | "WALK_STUDY"
    | "SEMESTER_BREAK"
    | "NOT_ARRIVED"
    | "OTHER";
  reason?: string;
  note?: string;
}

export interface DailyAttendance {
  id: string; // date_dormId
  date: string; // YYYY-MM-DD
  dormId: string;
  isHomeBreak: boolean; // วันรอบกลับบ้าน
  status: "CHECKED" | "HOME_BREAK" | "SEMESTER_BREAK" | "PENDING";
  checkedAt?: string;
  checkedBy?: string;
  teacherOrientationNotes: string[]; // เรื่องที่อบรม
  records: StudentAttendanceRecord[];
}

// Cryptographic Credential & Session Helpers
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const revokedTokens = new Map<string, number>();

const WEAK_PASSWORDS = new Set(["123", "1234", "12345", "123456", "password", "admin", "qwerty"]);

function isValidServerPassword(password: unknown): password is string {
  if (typeof password !== "string") return false;
  const trimmed = password.trim();
  if (trimmed.length < 6 || trimmed.length > 128) return false;
  if (WEAK_PASSWORDS.has(trimmed.toLowerCase())) return false;
  return true;
}

function hashServerPassword(plainPassword: string): string {
  const pwd = plainPassword.trim();
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pwd, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyServerPassword(plainPassword: string, storedHash?: string | null): boolean {
  if (!plainPassword || !storedHash) return false;
  const pwd = plainPassword.trim();
  if (!pwd) return false;

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;
    const derived = crypto.scryptSync(pwd, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  if (storedHash.startsWith("pbkdf2_sha256$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltB64 = parts[2];
    const expectedB64 = parts[3];
    if (!iterations || iterations < 10000 || !saltB64 || !expectedB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(expectedB64, "base64");
    const derived = crypto.pbkdf2Sync(pwd, salt, iterations, expected.length, "sha256");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  return false;
}

interface SessionTokenPayload {
  sub: string;
  roleLevel: number;
  jti: string;
  exp: number;
}

function issueAuthToken(user: UserProfile): string {
  const payload: SessionTokenPayload = {
    sub: user.id,
    roleLevel: user.roleLevel,
    jti: crypto.randomBytes(12).toString("hex"),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyAuthToken(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf-8");
    const expectedBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as SessionTokenPayload;
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    // Prune expired revocations opportunistically
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

function sanitizeSafeServerImageUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";
  if ((trimmed.startsWith("./") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) && !trimmed.includes("..")) {
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

function sanitizeServerUser(user: UserProfile, includePii: boolean = false): Omit<UserProfile, "passwordHash"> {
  const clean: Record<string, any> = stripDangerousKeys({ ...user });
  const hasPwd = Boolean(
    (typeof clean.passwordHash === "string" && clean.passwordHash.trim().length > 0) ||
      clean.hasPassword === true
  );
  delete clean.password;
  delete clean.passwordHash;
  if (!includePii) {
    delete clean.phone;
  }
  return {
    ...(clean as Omit<UserProfile, "passwordHash">),
    hasPassword: hasPwd
  };
}

function isValidResourceId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function isValidIsoDate(val: unknown): val is string {
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function sanitizeText(val: unknown, maxLen: number = 250): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

type AuthenticatedRequest = Request & {
  authUser?: UserProfile;
  authTokenPayload?: SessionTokenPayload;
};

function attachOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
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

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" });
  }
  next();
}

function requireRole(allowedLevels: number[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" });
    }
    if (!allowedLevels.includes(req.authUser.roleLevel)) {
      return res.status(403).json({ success: false, message: "บัญชีผู้ใช้งานไม่มีสิทธิ์ดำเนินการในส่วนนี้" });
    }
    next();
  };
}

app.use(attachOptionalAuth);

// Initial Dormitories Setup (H1 - H6) with 3-4 teachers per dorm
let dormitories: Dormitory[] = [
  {
    id: "dorm-1",
    name: "หอพัก 1 (ชาย)",
    type: "male",
    teacherName: "ครูสมชาย ใจดี (หัวหน้าหอพัก)",
    teacherPhone: "081-111-2222",
    capacity: 80,
    teachers: [
      { id: "t-101", name: "ครูสมชาย ใจดี", phone: "081-111-2222", isHead: true },
      { id: "t-102", name: "ครูวิชัย รักเรียน", phone: "081-111-2223", isHead: false },
      { id: "t-103", name: "ครูธานินทร์ มั่นคง", phone: "081-111-2224", isHead: false },
      { id: "t-104", name: "ครูมานพ สุขสวัสดิ์", phone: "081-111-2225", isHead: false }
    ]
  },
  {
    id: "dorm-2",
    name: "หอพัก 2 (ชาย)",
    type: "male",
    teacherName: "ครูสมคิด ดีเลิศ (หัวหน้าหอพัก)",
    teacherPhone: "081-222-3331",
    capacity: 80,
    teachers: [
      { id: "t-201", name: "ครูสมคิด ดีเลิศ", phone: "081-222-3331", isHead: true },
      { id: "t-202", name: "ครูประเสริฐ ชูเกียรติ", phone: "081-222-3332", isHead: false },
      { id: "t-203", name: "ครูธีระ ศรีงาม", phone: "081-222-3333", isHead: false }
    ]
  },
  {
    id: "dorm-3",
    name: "หอพัก 3 (ชาย)",
    type: "male",
    teacherName: "ครูเกรียงไกร มั่นคง (หัวหน้าหอพัก)",
    teacherPhone: "081-333-4441",
    capacity: 80,
    teachers: [
      { id: "t-301", name: "ครูเกรียงไกร มั่นคง", phone: "081-333-4441", isHead: true },
      { id: "t-302", name: "ครูพงษ์ศักดิ์ เจริญดี", phone: "081-333-4442", isHead: false },
      { id: "t-303", name: "ครูอดิศร วงศ์ษา", phone: "081-333-4443", isHead: false },
      { id: "t-304", name: "ครูอนุรักษ์ รัตนเดช", phone: "081-333-4444", isHead: false }
    ]
  },
  {
    id: "dorm-4",
    name: "หอพัก 4 (หญิง)",
    type: "female",
    teacherName: "ครูวิไลวรรณ เมตตา (หัวหน้าหอพัก)",
    teacherPhone: "081-444-5551",
    capacity: 80,
    teachers: [
      { id: "t-401", name: "ครูวิไลวรรณ เมตตา", phone: "081-444-5551", isHead: true },
      { id: "t-402", name: "ครูรัตนา แก้วมณี", phone: "081-444-5552", isHead: false },
      { id: "t-403", name: "ครูพิมพ์ใจ สว่างจิตต์", phone: "081-444-5553", isHead: false },
      { id: "t-404", name: "ครูอารียา เพชรแท้", phone: "081-444-5554", isHead: false }
    ]
  },
  {
    id: "dorm-5",
    name: "หอพัก 5 (หญิง)",
    type: "female",
    teacherName: "ครูนภา พรหมมินทร์ (หัวหน้าหอพัก)",
    teacherPhone: "081-555-6661",
    capacity: 80,
    teachers: [
      { id: "t-501", name: "ครูนภา พรหมมินทร์", phone: "081-555-6661", isHead: true },
      { id: "t-502", name: "ครูสุพรรษา ดวงแก้ว", phone: "081-555-6662", isHead: false },
      { id: "t-503", name: "ครูวรรณา สมบูรณ์", phone: "081-555-6663", isHead: false }
    ]
  },
  {
    id: "dorm-6",
    name: "หอพัก 6 (หญิง)",
    type: "female",
    teacherName: "ครูกานดา นพรัตน์ (หัวหน้าหอพัก)",
    teacherPhone: "081-666-7771",
    capacity: 80,
    teachers: [
      { id: "t-601", name: "ครูกานดา นพรัตน์", phone: "081-666-7771", isHead: true },
      { id: "t-602", name: "ครูชนิดา ปัญญาไว", phone: "081-666-7772", isHead: false },
      { id: "t-603", name: "ครูศิริพร บุญส่ง", phone: "081-666-7773", isHead: false },
      { id: "t-604", name: "ครูนงลักษณ์ เกียรติไพบูลย์", phone: "081-666-7774", isHead: false }
    ]
  }
];

let studentsStore: Student[] = [];
let noticesStore: Notice[] = [];
let attendanceStore: Record<string, DailyAttendance> = {};

// Initial Users Store (without hardcoded default passwords; users configure personal passwords on first setup)
let usersStore: UserProfile[] = [
  {
    id: "user-5",
    name: "ดร.ประเสริฐ (รองผู้อำนวยการ)",
    role: "DEPUTY_DIRECTOR",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "ผู้ดูแล",
    roleLabel: "ผู้ดูแลระบบ / ผู้บริหาร (สิทธิ์เข้าถึงทั้งหมด)",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-2",
    name: "ครูสมชาย (หัวหน้างานหอพัก)",
    role: "HEAD_TEACHER",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "ผู้ดูแล",
    roleLabel: "หัวหน้างานหอพัก (แจ้งอบรม & อนุมัติการเช็คยอด)",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-1",
    name: "เจ้าหน้าที่ สมศรี (สำนักงาน)",
    role: "ADMIN_OFFICER",
    roleLevel: 2,
    roleCategory: "STAFF",
    roleCategoryName: "เจ้าหน้าที่",
    roleLabel: "เจ้าหน้าที่สำนักงาน (นำเข้าข้อมูล & จัดทำรายงาน)",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-101",
    name: "ครูสมชาย ใจดี",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 1 (ชาย)",
    phone: "081-111-2222",
    dormId: "dorm-1",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-102",
    name: "ครูวิชัย รักเรียน",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 1 (ชาย)",
    phone: "081-111-2223",
    dormId: "dorm-1",
    dormPosition: "ครูประจำหอพัก",
    allowedDormIds: ["dorm-1"],
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-201",
    name: "ครูสมคิด ดีเลิศ",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 2 (ชาย)",
    phone: "081-222-3331",
    dormId: "dorm-2",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-2"],
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-301",
    name: "ครูเกรียงไกร มั่นคง",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 3 (ชาย)",
    phone: "081-333-4441",
    dormId: "dorm-3",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-3"],
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-401",
    name: "ครูวิไลวรรณ เมตตา",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 4 (หญิง)",
    phone: "081-444-5551",
    dormId: "dorm-4",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-4"],
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-501",
    name: "ครูนภา พรหมมินทร์",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 5 (หญิง)",
    phone: "081-555-6661",
    dormId: "dorm-5",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-5"],
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  },
  {
    id: "user-601",
    name: "ครูกานดา นพรัตน์",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ประธานหอพัก 6 (หญิง)",
    phone: "081-666-7771",
    dormId: "dorm-6",
    dormPosition: "ครูประธานหอพัก",
    allowedDormIds: ["dorm-6"],
    avatarUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80",
    hasPassword: false
  }
];

export interface SystemSettings {
  schoolNameTh: string;
  schoolNameEn: string;
  schoolAcronymTh: string;
  schoolAcronymEn: string;
  schoolLogoUrl: string;
  systemNameTh: string;
  systemNameEn: string;
  systemIcon: string;
  lastUpdatedDate: string;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  showMaintenancePopup?: boolean;
  showMaintenanceBox?: boolean;
  isAttendancePaused?: boolean;
  pausedDormIds?: string[];
  attendancePauseReason?: string;
  attendancePausedAt?: string;
  attendancePausedBy?: string;
  guestRequiresLogin?: boolean;
}

let systemSettings: SystemSettings = {
  schoolNameTh: "โรงเรียนพิจิตรปัญญานุกูล",
  schoolNameEn: "Pichit Panyanukul School",
  schoolAcronymTh: "พ.จ.ป.",
  schoolAcronymEn: "PCCC",
  schoolLogoUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`,
  systemNameTh: "ระบบบริหารจัดการหอพักนักเรียน",
  systemNameEn: "Student Dormitory Management System",
  systemIcon: "building",
  lastUpdatedDate: "8 สิงหาคม พ.ศ. 2569"
};

const DB_FILE_PATH = path.join(process.cwd(), "database.json");

function normalizeLoadedUsers(rawUsers: any[]): { users: UserProfile[]; modified: boolean } {
  let modified = false;
  const users = rawUsers
    .filter((u) => u && typeof u === "object" && isValidResourceId(u.id))
    .map((rawUser) => {
      const clean: Record<string, any> = stripDangerousKeys({ ...rawUser });
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
      return clean as UserProfile;
    });
  return { users, modified };
}

export function saveDbToDisk() {
  try {
    const cleanUsers = usersStore.map((u) => {
      const copy: Record<string, any> = stripDangerousKeys({ ...u });
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
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save primary database to disk:", err);
  }
}

export function formatStudentId(id: any): string {
  if (id === undefined || id === null) return "";
  const s = String(id).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.padStart(5, "0");
  if (s.length < 5) return s.padStart(5, "0");
  return s;
}

export function formatGrade(grade: any): string {
  if (grade === undefined || grade === null) return "ม.1";
  const str = String(grade).trim();
  if (!str) return "ม.1";
  if (/^ม\.[1-6]$/.test(str)) return str;
  const mMatch = str.match(/(?:มัธยมศึกษาปีที่|ชั้น\s*ม\.?|ม\.?)\s*([1-6])(?:\b|$)/);
  if (mMatch && mMatch[1]) return `ม.${mMatch[1]}`;
  const pMatch = str.match(/(?:ประถมศึกษาปีที่|ชั้น\s*ป\.?|ป\.?)\s*([1-6])(?:\b|$)/);
  if (pMatch && pMatch[1]) return `ป.${pMatch[1]}`;
  const numMatch = str.match(/^([1-6])(?:\/.*|\b|$)/);
  if (numMatch && numMatch[1]) return `ม.${numMatch[1]}`;
  const anyNum = str.match(/\d+/);
  if (anyNum) return `ม.${anyNum[0]}`;
  return str.startsWith("ม.") ? str : `ม.${str}`;
}

export function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = stripDangerousKeys(JSON.parse(raw));
      if (Array.isArray(parsed.dormitories) && parsed.dormitories.length > 0) dormitories = parsed.dormitories;

      const st = parsed.students || parsed.studentsStore;
      if (Array.isArray(st)) {
        studentsStore = st.map((s: Student) => ({
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
            att[k].records = att[k].records.map((r: any) => ({
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

function getEnrichedDorms(): Dormitory[] {
  return dormitories.map((dorm) => {
    if (dorm.teachers && dorm.teachers.length > 0) {
      const headTeacher = dorm.teachers.find((t) => t.isHead || t.position === "ครูประธานหอพัก") || dorm.teachers[0];
      const summaryName = headTeacher
        ? `${headTeacher.name}${dorm.teachers.length > 1 ? ` (และทีมครู ${dorm.teachers.length - 1} ท่าน)` : ""}`
        : dorm.teacherName;
      const summaryPhone = headTeacher && headTeacher.phone ? headTeacher.phone : dorm.teacherPhone;
      return {
        ...dorm,
        teacherName: summaryName,
        teacherPhone: summaryPhone
      };
    }

    const assignedTeacherUsers = usersStore.filter((u) => {
      const isTeacher = u.roleLevel === 3 || u.roleCategory === "DORM_TEACHER" || u.role === "DORM_TEACHER";
      const matchesDorm = u.dormId === dorm.id || (u.allowedDormIds && u.allowedDormIds.includes(dorm.id));
      return isTeacher && matchesDorm;
    });

    if (assignedTeacherUsers.length > 0) {
      const dynamicTeachers: DormTeacher[] = assignedTeacherUsers.map((u, idx) => {
        let pos = u.dormPosition;
        if (!pos) {
          if (idx === 0) pos = "ครูประธานหอพัก";
          else if (idx === 1) pos = "ครูรองประธานหอพัก";
          else if (idx === 2) pos = "ครูหัวหน้าหอพัก";
          else pos = "ครูประจำหอพัก";
        }
        return {
          id: u.id,
          name: u.name,
          phone: u.phone || "",
          position: pos,
          isHead: pos === "ครูประธานหอพัก" || idx === 0
        };
      });

      const headTeacher = assignedTeacherUsers.find((u) => u.dormPosition === "ครูประธานหอพัก") || assignedTeacherUsers[0];
      const teacherNameSummary = `${headTeacher.name}${assignedTeacherUsers.length > 1 ? ` (และทีมครู ${assignedTeacherUsers.length - 1} ท่าน)` : ""}`;
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

// ----------------------------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------------------------
app.post("/api/auth/login", (req: AuthenticatedRequest, res: Response) => {
  const userId = sanitizeText(req.body?.userId, 128);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!isValidResourceId(userId) || !password.trim()) {
    return res.status(400).json({ success: false, message: "กรุณาระบุบัญชีผู้ใช้งานและรหัสผ่าน" });
  }

  const user = usersStore.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: "ไม่พบบัญชีผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" });
  }

  if (!user.passwordHash) {
    return res.status(403).json({
      success: false,
      requiresInitialSetup: true,
      message: "บัญชีนี้ยังไม่ได้ตั้งรหัสผ่านเริ่มต้น กรุณากำหนดรหัสผ่านใหม่ก่อนเข้าใช้งาน"
    });
  }

  if (!verifyServerPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
  }

  const token = issueAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeServerUser(user, true)
  });
});

app.post("/api/auth/first-password", (req: AuthenticatedRequest, res: Response) => {
  const userId = sanitizeText(req.body?.userId, 128);
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!isValidResourceId(userId)) {
    return res.status(400).json({ success: false, message: "รหัสผู้ใช้งานไม่ถูกต้อง" });
  }
  if (!isValidServerPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และไม่ใช้รหัสผ่านที่คาดเดาง่าย"
    });
  }

  const user = usersStore.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "ไม่พบบัญชีผู้ใช้งาน" });
  }
  if (user.passwordHash || user.hasPassword) {
    return res.status(409).json({
      success: false,
      message: "บัญชีนี้ตั้งค่ารหัสผ่านไว้แล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านเดิม"
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
    message: "ตั้งค่ารหัสผ่านเริ่มต้นสำเร็จ"
  });
});

app.post("/api/auth/logout", (req: AuthenticatedRequest, res: Response) => {
  if (req.authTokenPayload?.jti) {
    revokedTokens.set(req.authTokenPayload.jti, req.authTokenPayload.exp);
  }
  return res.json({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: sanitizeServerUser(req.authUser!, true)
  });
});

// ----------------------------------------------------------------------
// 1. Dormitories API
// ----------------------------------------------------------------------
app.get("/api/dorms", (_req, res) => {
  res.json({ success: true, data: getEnrichedDorms() });
});

app.post("/api/dorms", requireAuth, requireRole([1, 2]), (req: AuthenticatedRequest, res: Response) => {
  const name = sanitizeText(req.body?.name, 100);
  const rawType = req.body?.type;
  const type: "male" | "female" | "mixed" =
    rawType === "female" || rawType === "mixed" ? rawType : "male";
  const teacherName = sanitizeText(req.body?.teacherName, 120) || "ครูประจำหอพัก";
  const teacherPhone = sanitizeText(req.body?.teacherPhone, 30);
  const capacityNum = Number(req.body?.capacity);
  const capacity = Number.isFinite(capacityNum) && capacityNum > 0 && capacityNum <= 2000 ? Math.floor(capacityNum) : 80;

  if (!name) {
    return res.status(400).json({ success: false, message: "กรุณาระบุชื่อหอพัก" });
  }

  const sanitizedTeachers: DormTeacher[] = Array.isArray(req.body?.teachers)
    ? req.body.teachers.slice(0, 20).map((t: any) => ({
        id: isValidResourceId(t?.id) ? t.id : undefined,
        name: sanitizeText(t?.name, 120),
        phone: sanitizeText(t?.phone, 30),
        position: sanitizeText(t?.position, 80) || "ครูประจำหอพัก",
        isHead: Boolean(t?.isHead)
      }))
    : [];

  const newDorm: Dormitory = {
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

app.put("/api/dorms/:id", requireAuth, requireRole([1, 2]), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "รหัสหอพักไม่ถูกต้อง" });
  }
  const index = dormitories.findIndex((d) => d.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Dormitory not found" });

  const name = req.body?.name !== undefined ? sanitizeText(req.body.name, 100) : undefined;
  const rawType = req.body?.type;
  const type =
    rawType === "male" || rawType === "female" || rawType === "mixed" ? rawType : undefined;
  const teacherName = req.body?.teacherName !== undefined ? sanitizeText(req.body.teacherName, 120) : undefined;
  const teacherPhone = req.body?.teacherPhone !== undefined ? sanitizeText(req.body.teacherPhone, 30) : undefined;
  const capacityNum = Number(req.body?.capacity);
  const capacity =
    req.body?.capacity !== undefined && Number.isFinite(capacityNum) && capacityNum > 0 && capacityNum <= 2000
      ? Math.floor(capacityNum)
      : undefined;
  const teachers = Array.isArray(req.body?.teachers)
    ? req.body.teachers.slice(0, 20).map((t: any) => ({
        id: isValidResourceId(t?.id) ? t.id : undefined,
        name: sanitizeText(t?.name, 120),
        phone: sanitizeText(t?.phone, 30),
        position: sanitizeText(t?.position, 80) || "ครูประจำหอพัก",
        isHead: Boolean(t?.isHead)
      }))
    : undefined;
  const assignedTeacherId = isValidResourceId(req.body?.assignedTeacherId) ? req.body.assignedTeacherId : undefined;

  dormitories[index] = {
    ...dormitories[index],
    ...(name ? { name } : {}),
    ...(type ? { type } : {}),
    ...(teacherName !== undefined ? { teacherName } : {}),
    ...(teacherPhone !== undefined ? { teacherPhone } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    ...(teachers !== undefined ? { teachers } : {}),
    ...(assignedTeacherId !== undefined ? { assignedTeacherId } : {})
  };

  if (assignedTeacherId) {
    const assignedUser = usersStore.find((u) => u.id === assignedTeacherId);
    if (assignedUser) {
      dormitories[index].teacherName = assignedUser.name;
      assignedUser.dormId = id;
    }
  }

  saveDbToDisk();
  res.json({ success: true, data: dormitories[index], message: "แก้ไขข้อมูลหอพักเรียบร้อย" });
});

// ----------------------------------------------------------------------
// 2. Students CRUD & Batch Import
// ----------------------------------------------------------------------
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

app.put("/api/students/:id", requireAuth, requireRole([1, 2]), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "รหัสรายการนักเรียนไม่ถูกต้อง" });
  }
  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Student not found" });

  const b = req.body || {};
  const current = studentsStore[index];
  const updated: Student = {
    ...current,
    ...(b.no !== undefined && Number.isFinite(Number(b.no)) ? { no: Math.max(1, Math.min(999, Math.floor(Number(b.no)))) } : {}),
    ...(b.title !== undefined ? { title: sanitizeText(b.title, 40) } : {}),
    ...(b.firstName !== undefined ? { firstName: sanitizeText(b.firstName, 100) } : {}),
    ...(b.lastName !== undefined ? { lastName: sanitizeText(b.lastName, 100) } : {}),
    ...(b.nickname !== undefined ? { nickname: sanitizeText(b.nickname, 60) } : {}),
    ...(b.dormId !== undefined && isValidResourceId(b.dormId) ? { dormId: b.dormId } : {}),
    ...(b.dormRoom !== undefined ? { dormRoom: sanitizeText(b.dormRoom, 40) } : {}),
    ...(b.dormBed !== undefined ? { dormBed: sanitizeText(String(b.dormBed), 20) } : {}),
    ...(b.room !== undefined && Number.isFinite(Number(b.room)) ? { room: Math.max(1, Math.min(50, Math.floor(Number(b.room)))) } : {}),
    ...(b.gender === "male" || b.gender === "female" ? { gender: b.gender } : {}),
    studentId: formatStudentId(b.studentId !== undefined ? b.studentId : current.studentId),
    grade: b.grade !== undefined ? formatGrade(b.grade) : current.grade
  };

  studentsStore[index] = updated;
  saveDbToDisk();
  res.json({ success: true, data: updated, message: "แก้ไขข้อมูลนักเรียนเรียบร้อย" });
});

// ----------------------------------------------------------------------
// 2.1 Users CRUD & Password Management
// ----------------------------------------------------------------------
app.get("/api/users", (req: AuthenticatedRequest, res: Response) => {
  const includePii = Boolean(req.authUser);
  res.json({
    success: true,
    data: usersStore.map((u) => sanitizeServerUser(u, includePii))
  });
});

app.post("/api/users", requireAuth, requireRole([1]), (req: AuthenticatedRequest, res: Response) => {
  const name = sanitizeText(req.body?.name, 120);
  if (!name) {
    return res.status(400).json({ success: false, message: "กรุณาระบุชื่อผู้ใช้งาน" });
  }

  const rawPassword = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  if (rawPassword && !isValidServerPassword(rawPassword)) {
    return res.status(400).json({
      success: false,
      message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และไม่ใช้รหัสผ่านที่คาดเดาง่าย"
    });
  }

  const roleCategoryRaw = req.body?.roleCategory;
  const numLevelRaw = Number(req.body?.roleLevel);
  const numLevel: 1 | 2 | 3 | 4 =
    numLevelRaw === 1 || numLevelRaw === 2 || numLevelRaw === 3 || numLevelRaw === 4 ? numLevelRaw : 2;

  let roleCategory: UserProfile["roleCategory"] = "STAFF";
  let roleCategoryName = "เจ้าหน้าที่";
  let roleLabel = "เจ้าหน้าที่สำนักงาน";
  let role: UserProfile["role"] = "ADMIN_OFFICER";

  const dormPosition = sanitizeText(req.body?.dormPosition, 80) || undefined;

  if (numLevel === 1 || roleCategoryRaw === "ADMIN") {
    roleCategory = "ADMIN";
    roleCategoryName = "ผู้ดูแล";
    roleLabel = "ผู้ดูแลระบบ";
    role = "SYSTEM_ADMIN";
  } else if (numLevel === 2 || roleCategoryRaw === "STAFF") {
    roleCategory = "STAFF";
    roleCategoryName = "เจ้าหน้าที่";
    roleLabel = "เจ้าหน้าที่สำนักงาน";
    role = "ADMIN_OFFICER";
  } else if (numLevel === 4 || roleCategoryRaw === "GUEST") {
    roleCategory = "GUEST";
    roleCategoryName = "ผู้เยี่ยมชม";
    roleLabel = "ผู้เยี่ยมชมระบบ";
    role = "GUEST";
  } else {
    roleCategory = "DORM_TEACHER";
    roleCategoryName = "ครูหอพัก";
    roleLabel = dormPosition || "ครูประจำหอพัก";
    role = "DORM_TEACHER";
  }

  const dormId = isValidResourceId(req.body?.dormId) ? req.body.dormId : undefined;
  const allowedDormIds = Array.isArray(req.body?.allowedDormIds)
    ? req.body.allowedDormIds.filter((d: unknown) => isValidResourceId(d)).slice(0, 20)
    : dormId
    ? [dormId]
    : [];

  const passwordHash = rawPassword ? hashServerPassword(rawPassword) : undefined;
  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    name,
    role,
    roleLevel: numLevel,
    roleCategory,
    roleCategoryName,
    roleLabel,
    phone: sanitizeText(req.body?.phone, 30) || undefined,
    dormId: dormId || allowedDormIds[0] || undefined,
    dormPosition,
    allowedDormIds,
    avatarUrl:
      sanitizeSafeServerImageUrl(req.body?.avatarUrl) ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    ...(passwordHash ? { passwordHash } : {}),
    hasPassword: Boolean(passwordHash)
  };

  usersStore.push(newUser);
  saveDbToDisk();
  res.json({
    success: true,
    data: sanitizeServerUser(newUser, true),
    message: "เพิ่มผู้ใช้งานเรียบร้อย"
  });
});

app.put("/api/users/:id", requireAuth, requireRole([1]), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "รหัสผู้ใช้งานไม่ถูกต้อง" });
  }
  const index = usersStore.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "User not found" });

  const current = usersStore[index];
  const b = req.body || {};

  const rawPassword = typeof b.password === "string" ? b.password.trim() : "";
  if (rawPassword && !isValidServerPassword(rawPassword)) {
    return res.status(400).json({
      success: false,
      message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และไม่ใช้รหัสผ่านที่คาดเดาง่าย"
    });
  }

  const nextDormId = b.dormId !== undefined ? (isValidResourceId(b.dormId) ? b.dormId : undefined) : current.dormId;
  let nextAllowedDormIds = current.allowedDormIds || [];
  if (Array.isArray(b.allowedDormIds)) {
    nextAllowedDormIds = b.allowedDormIds.filter((d: unknown) => isValidResourceId(d)).slice(0, 20);
  }
  if (nextDormId && nextAllowedDormIds.length === 0) {
    nextAllowedDormIds = [nextDormId];
  }

  const nextLevel =
    b.roleLevel === 1 || b.roleLevel === 2 || b.roleLevel === 3 || b.roleLevel === 4
      ? b.roleLevel
      : current.roleLevel;

  const updated: UserProfile = {
    ...current,
    ...(b.name !== undefined && sanitizeText(b.name, 120) ? { name: sanitizeText(b.name, 120) } : {}),
    roleLevel: nextLevel,
    ...(b.roleCategory === "ADMIN" || b.roleCategory === "STAFF" || b.roleCategory === "DORM_TEACHER" || b.roleCategory === "GUEST"
      ? { roleCategory: b.roleCategory }
      : {}),
    ...(b.roleCategoryName !== undefined ? { roleCategoryName: sanitizeText(b.roleCategoryName, 80) } : {}),
    ...(b.roleLabel !== undefined ? { roleLabel: sanitizeText(b.roleLabel, 150) } : {}),
    ...(b.phone !== undefined ? { phone: sanitizeText(b.phone, 30) } : {}),
    dormId: nextDormId,
    ...(b.dormPosition !== undefined ? { dormPosition: sanitizeText(b.dormPosition, 80) } : {}),
    allowedDormIds: nextAllowedDormIds,
    ...(b.avatarUrl !== undefined
      ? { avatarUrl: sanitizeSafeServerImageUrl(b.avatarUrl) || current.avatarUrl }
      : {}),
    ...(rawPassword
      ? { passwordHash: hashServerPassword(rawPassword), hasPassword: true }
      : {})
  };

  usersStore[index] = updated;
  saveDbToDisk();
  res.json({
    success: true,
    data: sanitizeServerUser(updated, true),
    message: "อัปเดตข้อมูลผู้ใช้เรียบร้อย"
  });
});

app.delete("/api/users/:id", requireAuth, requireRole([1]), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "รหัสผู้ใช้งานไม่ถูกต้อง" });
  }
  if (req.authUser?.id === id) {
    return res.status(400).json({ success: false, message: "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้" });
  }
  usersStore = usersStore.filter((u) => u.id !== id);
  saveDbToDisk();
  res.json({ success: true, message: "ลบบัญชีผู้ใช้งานเรียบร้อย" });
});

app.post("/api/users/:id/change-password", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidResourceId(id)) {
    return res.status(400).json({ success: false, message: "รหัสผู้ใช้งานไม่ถูกต้อง" });
  }

  const oldPassword = typeof req.body?.oldPassword === "string" ? req.body.oldPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const isAdminOverride = Boolean(req.body?.isAdminOverride);

  if (isAdminOverride) {
    if (req.authUser?.roleLevel !== 1) {
      return res.status(403).json({ success: false, message: "เฉพาะผู้ดูแลระบบระดับ 1 เท่านั้นที่รีเซ็ตรหัสผ่านผู้อื่นได้" });
    }
  } else if (req.authUser?.id !== id) {
    return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์เปลี่ยนรหัสผ่านของบัญชีอื่น" });
  }

  if (!isValidServerPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร และไม่ใช้รหัสผ่านที่คาดเดาง่าย"
    });
  }

  const user = usersStore.find((u) => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (!isAdminOverride && user.passwordHash) {
    if (!verifyServerPassword(oldPassword, user.passwordHash)) {
      return res.status(400).json({ success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }
  }

  user.passwordHash = hashServerPassword(newPassword);
  user.hasPassword = true;
  saveDbToDisk();
  res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย" });
});

// ----------------------------------------------------------------------
// System Settings API
// ----------------------------------------------------------------------
app.get("/api/system-settings", (_req, res) => {
  res.json({ success: true, data: systemSettings });
});

app.put("/api/system-settings", requireAuth, requireRole([1]), (req: AuthenticatedRequest, res: Response) => {
  const b = req.body || {};
  const nextSettings: SystemSettings = {
    ...systemSettings,
    ...(b.schoolNameTh !== undefined ? { schoolNameTh: sanitizeText(b.schoolNameTh, 160) } : {}),
    ...(b.schoolNameEn !== undefined ? { schoolNameEn: sanitizeText(b.schoolNameEn, 160) } : {}),
    ...(b.schoolAcronymTh !== undefined ? { schoolAcronymTh: sanitizeText(b.schoolAcronymTh, 40) } : {}),
    ...(b.schoolAcronymEn !== undefined ? { schoolAcronymEn: sanitizeText(b.schoolAcronymEn, 40) } : {}),
    ...(b.schoolLogoUrl !== undefined
      ? { schoolLogoUrl: sanitizeSafeServerImageUrl(b.schoolLogoUrl) || systemSettings.schoolLogoUrl }
      : {}),
    ...(b.systemNameTh !== undefined ? { systemNameTh: sanitizeText(b.systemNameTh, 160) } : {}),
    ...(b.systemNameEn !== undefined ? { systemNameEn: sanitizeText(b.systemNameEn, 160) } : {}),
    ...(b.systemIcon !== undefined ? { systemIcon: sanitizeText(b.systemIcon, 40) } : {}),
    ...(b.lastUpdatedDate !== undefined ? { lastUpdatedDate: sanitizeText(b.lastUpdatedDate, 80) } : {}),
    ...(b.maintenanceTitle !== undefined ? { maintenanceTitle: sanitizeText(b.maintenanceTitle, 200) } : {}),
    ...(b.maintenanceMessage !== undefined ? { maintenanceMessage: sanitizeText(b.maintenanceMessage, 1000) } : {}),
    ...(b.showMaintenancePopup !== undefined ? { showMaintenancePopup: Boolean(b.showMaintenancePopup) } : {}),
    ...(b.showMaintenanceBox !== undefined ? { showMaintenanceBox: Boolean(b.showMaintenanceBox) } : {}),
    ...(b.isAttendancePaused !== undefined ? { isAttendancePaused: Boolean(b.isAttendancePaused) } : {}),
    ...(Array.isArray(b.pausedDormIds)
      ? { pausedDormIds: b.pausedDormIds.filter((d: unknown) => isValidResourceId(d)).slice(0, 50) }
      : {}),
    ...(b.attendancePauseReason !== undefined ? { attendancePauseReason: sanitizeText(b.attendancePauseReason, 300) } : {}),
    ...(b.attendancePausedAt !== undefined ? { attendancePausedAt: sanitizeText(b.attendancePausedAt, 60) } : {}),
    ...(b.attendancePausedBy !== undefined ? { attendancePausedBy: sanitizeText(b.attendancePausedBy, 120) } : {}),
    ...(b.guestRequiresLogin !== undefined ? { guestRequiresLogin: Boolean(b.guestRequiresLogin) } : {})
  };

  systemSettings = nextSettings;
  saveDbToDisk();
  res.json({ success: true, data: systemSettings, message: "บันทึกการตั้งค่าระบบเรียบร้อย" });
});

// ----------------------------------------------------------------------
// 2.2 Database Management (Admin Level 1 Protected)
// ----------------------------------------------------------------------
app.post("/api/database/save-primary", requireAuth, requireRole([1]), (_req, res) => {
  saveDbToDisk();
  res.json({
    success: true,
    message: "กำหนดและบันทึกชุดข้อมูลปัจจุบันเป็นฐานข้อมูลหลักของระบบเรียบร้อยแล้ว"
  });
});

app.post("/api/database/reset", requireAuth, requireRole([1]), (_req, res) => {
  studentsStore = [];
  attendanceStore = {};
  noticesStore = [];
  dormitories = [];
  usersStore = usersStore
    .filter((u) => u.roleLevel === 1)
    .map((u) => ({
      ...u,
      dormId: undefined,
      allowedDormIds: []
    }));
  saveDbToDisk();

  res.json({ success: true, message: "ล้างฐานข้อมูลทั้งหมด (รวมข้อมูลหอพักและรายชื่อครูผู้ดูแลหอพัก) เรียบร้อยแล้ว" });
});

app.post("/api/database/clear-attendance", requireAuth, requireRole([1]), (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, clearNotices } = req.body;
  let countCleared = 0;
  let countNoticesCleared = 0;

  const isMatchingDate = (itemDate: string) => {
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
  const dormNameLabel = dormId === "ALL" || !dormId ? "ทุกหอพัก" : targetDorm ? targetDorm.name : sanitizeText(dormId, 60);

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
    message: `ล้างข้อมูลการเช็คยอด (${countCleared} รายการ) และเรื่องแจ้งอบรม (${countNoticesCleared} เรื่อง) ของ ${dormNameLabel} เรียบร้อยแล้ว`,
    countCleared,
    countNoticesCleared
  });
});

app.post("/api/database/attendance/export", requireAuth, requireRole([1, 2]), (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, includeNotices = true } = req.body;

  const isMatchingDate = (itemDate: string) => {
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
      exportedAt: new Date().toISOString(),
      attendance: filteredAttendance,
      notices: filteredNotices
    }
  });
});

app.post("/api/database/attendance/restore", requireAuth, requireRole([1]), (req, res) => {
  const { data, mode = "ALL", date, month, startDate, endDate, dormId } = req.body;
  const rawAttendance: DailyAttendance[] = Array.isArray(data?.attendance) ? data.attendance : [];
  const rawNotices: Notice[] = Array.isArray(data?.notices) ? data.notices : [];

  const isMatchingDate = (itemDate: string) => {
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
    if (
      att &&
      isValidIsoDate(att.date) &&
      isValidResourceId(att.dormId) &&
      isMatchingDate(att.date) &&
      (!dormId || dormId === "ALL" || att.dormId === dormId)
    ) {
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
    message: `กู้คืนข้อมูลสำเร็จ: เช็คยอด ${restoredAtt} รายการ, เรื่องแจ้งอบรม ${restoredNotices} รายการ`
  });
});

app.post("/api/database/clear-students", requireAuth, requireRole([1]), (req, res) => {
  const { mode, dormId } = req.body;
  const countBefore = studentsStore.length;

  if (mode === "BY_DORM") {
    if (!isValidResourceId(dormId)) {
      return res.status(400).json({ success: false, message: "กรุณาระบุหอพักที่ต้องการลบรายชื่อนักเรียน" });
    }
    const targetDorm = dormitories.find((d) => d.id === dormId);
    studentsStore = studentsStore.filter((s) => s.dormId !== dormId);
    saveDbToDisk();
    const deletedCount = countBefore - studentsStore.length;
    return res.json({
      success: true,
      message: `ลบรายชื่อนักเรียนใน ${targetDorm?.name || dormId} จำนวน ${deletedCount} คนเรียบร้อยแล้ว`
    });
  } else if (mode === "ALL") {
    const deletedCount = studentsStore.length;
    studentsStore = [];
    saveDbToDisk();
    return res.json({
      success: true,
      message: `ลบรายชื่อนักเรียนทุกหอพัก ทั้งหมดจำนวน ${deletedCount} คนเรียบร้อยแล้ว`
    });
  }

  res.status(400).json({ success: false, message: "รูปแบบคำสั่งลบรายชื่อนักเรียนไม่ถูกต้อง" });
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
      exportedAt: new Date().toISOString()
    }
  });
});

app.post("/api/database/restore", requireAuth, requireRole([1]), (req, res) => {
  const { dormitories: d, students: s, notices: n, attendance: a, users: u, systemSettings: set } = req.body;
  if (Array.isArray(d)) dormitories = d;
  if (Array.isArray(s)) {
    studentsStore = s.map((item: any) => ({
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

  res.json({ success: true, message: "กู้คืนฐานข้อมูลจากไฟล์ JSON เรียบร้อยแล้ว" });
});

app.post("/api/students/import", requireAuth, requireRole([1, 2]), (req, res) => {
  const { dormId, students } = req.body;
  if (!isValidResourceId(dormId) || !Array.isArray(students) || students.length > 2000) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  const dorm = dormitories.find((d) => d.id === dormId);
  const newStudentsList: Student[] = students.map((s: any, idx: number) => ({
    id: `std-${Date.now()}-${idx}`,
    studentId: formatStudentId(s?.studentId) || String(66000 + idx).padStart(5, "0"),
    no: Number(s?.no) || idx + 1,
    title: sanitizeText(s?.title, 40) || (dorm?.type === "male" ? "นาย" : "นางสาว"),
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
    message: `นำเข้าข้อมูลนักเรียนหอพักสำเร็จจำนวน ${newStudentsList.length} คน`,
    count: newStudentsList.length
  });
});

app.post("/api/students", requireAuth, requireRole([1, 2]), (req, res) => {
  const dormId = sanitizeText(req.body?.dormId, 128);
  const firstName = sanitizeText(req.body?.firstName, 100);
  const lastName = sanitizeText(req.body?.lastName, 100);
  if (!isValidResourceId(dormId) || !firstName || !lastName) {
    return res.status(400).json({ success: false, message: "ข้อมูลนักเรียนไม่ครบถ้วนหรือไม่ถูกต้อง" });
  }

  const newStudent: Student = {
    id: `std-${Date.now()}`,
    studentId: formatStudentId(req.body?.studentId) || `0${Math.floor(1000 + Math.random() * 8999)}`,
    no: Math.max(1, Math.min(999, Number(req.body?.no) || 1)),
    title: sanitizeText(req.body?.title, 40) || "นาย",
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
    return res.status(400).json({ success: false, message: "รหัสรายการนักเรียนไม่ถูกต้อง" });
  }
  studentsStore = studentsStore.filter((s) => s.id !== id);
  saveDbToDisk();
  res.json({ success: true, message: "ลบรายชื่อนักเรียนสำเร็จ" });
});

app.post("/api/students/batch-delete", requireAuth, requireRole([1, 2]), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 2000) {
    return res.status(400).json({ success: false, message: "ไม่พบรายการนักเรียนที่ต้องการลบ" });
  }
  const idSet = new Set(ids.filter((id: unknown) => typeof id === "string"));
  const countBefore = studentsStore.length;
  studentsStore = studentsStore.filter((s) => !idSet.has(s.id));
  saveDbToDisk();
  const deletedCount = countBefore - studentsStore.length;
  res.json({ success: true, message: `ลบรายชื่อนักเรียนจำนวน ${deletedCount} คนเรียบร้อยแล้ว` });
});

// ----------------------------------------------------------------------
// 3. Notices API
// ----------------------------------------------------------------------
app.get("/api/notices", (req, res) => {
  const { date } = req.query;
  let list = [...noticesStore];
  if (date) {
    list = list.filter((n) => n.date === String(date));
  }
  res.json({ success: true, data: list });
});

app.post("/api/notices", requireAuth, requireRole([1, 2]), (req: AuthenticatedRequest, res: Response) => {
  const title = sanitizeText(req.body?.title, 200);
  const rawDate = req.body?.date;
  const date = isValidIsoDate(rawDate) ? rawDate : new Date().toISOString().split("T")[0];
  const topicsInput = Array.isArray(req.body?.topics) ? req.body.topics : [req.body?.topics];
  const topics = topicsInput
    .map((t: unknown) => sanitizeText(t, 400))
    .filter((t: string) => t.length > 0)
    .slice(0, 30);

  if (!title) {
    return res.status(400).json({ success: false, message: "กรุณาระบุหัวข้อแจ้งอบรม" });
  }

  const newNotice: Notice = {
    id: `not-${Date.now()}`,
    date,
    title,
    topics,
    createdBy: sanitizeText(req.body?.createdBy, 120) || req.authUser?.name || "หัวหน้างานหอพัก",
    createdAt: new Date().toISOString()
  };
  noticesStore.unshift(newNotice);
  saveDbToDisk();
  res.json({ success: true, data: newNotice });
});

// ----------------------------------------------------------------------
// 4. Daily Attendance Check API
// ----------------------------------------------------------------------
const ALLOWED_ATTENDANCE_STATUSES = new Set([
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
  const reqDate = date ? String(date) : new Date().toISOString().split("T")[0];

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

  const result: Record<string, DailyAttendance> = {};
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

app.post("/api/attendance", requireAuth, requireRole([1, 2, 3]), (req: AuthenticatedRequest, res: Response) => {
  const date = req.body?.date;
  const dormId = req.body?.dormId;

  if (!isValidIsoDate(date) || !isValidResourceId(dormId)) {
    return res.status(400).json({ success: false, message: "วันที่หรือรหัสหอพักไม่ถูกต้อง" });
  }

  // Enforce Dorm Teacher scope on Level 3 accounts
  if (req.authUser?.roleLevel === 3) {
    const allowed = new Set([...(req.authUser.allowedDormIds || []), ...(req.authUser.dormId ? [req.authUser.dormId] : [])]);
    if (!allowed.has(dormId)) {
      return res.status(403).json({ success: false, message: "บัญชีครูประจำหอพักไม่มีสิทธิ์บันทึกข้อมูลของหอพักอื่น" });
    }
  }

  const key = `${date}_${dormId}`;
  const isHomeBreak = Boolean(req.body?.isHomeBreak);
  const teacherOrientationNotes = Array.isArray(req.body?.teacherOrientationNotes)
    ? req.body.teacherOrientationNotes.map((n: unknown) => sanitizeText(n, 400)).filter(Boolean).slice(0, 30)
    : [];
  const records: StudentAttendanceRecord[] = Array.isArray(req.body?.records)
    ? req.body.records.slice(0, 1000).map((r: any) => ({
        studentId: formatStudentId(r?.studentId),
        status: ALLOWED_ATTENDANCE_STATUSES.has(r?.status) ? r.status : "PRESENT",
        ...(r?.reason !== undefined ? { reason: sanitizeText(r.reason, 200) } : {}),
        ...(r?.note !== undefined ? { note: sanitizeText(r.note, 200) } : {})
      }))
    : [];

  const updatedRecord: DailyAttendance = {
    id: key,
    date,
    dormId,
    isHomeBreak,
    status: isHomeBreak ? "HOME_BREAK" : "CHECKED",
    checkedAt: new Date().toISOString(),
    checkedBy: sanitizeText(req.body?.checkedBy, 120) || req.authUser?.name || "ครูประจำหอพัก",
    teacherOrientationNotes,
    records
  };

  attendanceStore[key] = updatedRecord;
  saveDbToDisk();
  res.json({ success: true, data: updatedRecord, message: "บันทึกการเช็คยอดนักเรียนสำเร็จ" });
});

// ----------------------------------------------------------------------
// 5. Daily Summary Reports Generator
// ----------------------------------------------------------------------
app.get("/api/reports/daily", (req, res) => {
  const rawDate = req.query.date ? String(req.query.date) : "";
  const reportDate = isValidIsoDate(rawDate) ? rawDate : new Date().toISOString().split("T")[0];

  const reportD = new Date(reportDate);
  reportD.setDate(reportD.getDate() - 1);
  const summaryDate = reportD.toISOString().split("T")[0];

  const gradesList = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
  const totalMatrix: Record<string, Record<string, number>> = {};
  const outMatrix: Record<string, Record<string, number>> = {};
  const remainingMatrix: Record<string, Record<string, number>> = {};
  const dormTotals: Record<string, { total: number; out: number; remaining: number }> = {};
  const gradeTotals: Record<string, { total: number; out: number; remaining: number }> = {};

  gradesList.forEach((g) => {
    gradeTotals[g] = { total: 0, out: 0, remaining: 0 };
  });

  const absentStudentsList: Array<{
    no: number;
    studentId: string;
    fullName: string;
    gradeRoom: string;
    dormName: string;
    dormId: string;
    reason: string;
    status: string;
  }> = [];

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
              let statusLabel = stdRec.status === "ROUND_HOME" ? "รอบกลับบ้าน" : "กลับบ้าน";
              if (stdRec.status === "SICK") statusLabel = "ป่วย";
              if (stdRec.status === "SKILL_COMP") statusLabel = "แข่งทักษะ";
              if (stdRec.status === "EXCHANGE") statusLabel = "นักเรียนแลกเปลี่ยน";
              if (stdRec.status === "OTHER") statusLabel = "อื่น";

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
    const defaultTeacherName = dormEnriched?.teachers?.[0]?.name || dorm.teacherName || "ครูประจำหอพัก";
    const ownNotes = (attendance?.teacherOrientationNotes || []).filter((n: string) => n.trim().length > 0);
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
      creator: "เจ้าหน้าที่งานหอพัก",
      headTeacher: "หัวหน้างานหอพัก",
      deputyDirector: "รองผู้อำนวยการฝ่ายบริหารกิจการนักเรียน"
    },
    headTeacherNotices,
    dormTeacherOrientations
  });
});

// ----------------------------------------------------------------------
// 6. Export to Google Sheets API endpoint (Authenticated Admin/Staff Only)
// ----------------------------------------------------------------------
app.post("/api/google-sheets/export", requireAuth, requireRole([1, 2]), async (req, res) => {
  try {
    const { accessToken, reportData } = req.body;

    if (!reportData || typeof reportData !== "object") {
      return res.status(400).json({ success: false, message: "Missing reportData" });
    }

    const TARGET_DRIVE_FOLDER_ID = "17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg";
    const TARGET_DRIVE_FOLDER_URL =
      "https://drive.google.com/drive/folders/17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg?usp=sharing";

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
            title: `รายงานสรุปยอดนักเรียนหอพักประจำวันที่_${sanitizeText(reportData.reportDate, 30)}`
          },
          sheets: [
            { properties: { title: "1.สรุปยอดจำนวนนักเรียน" } },
            { properties: { title: "2.ตารางรายชื่อนักเรียนออกหอพัก" } },
            { properties: { title: "3.ใบรายงานเรื่องแจ้งอบรมประจำวัน" } }
          ]
        })
      });

      if (createRes.ok) {
        const sheetJson = await createRes.json();
        const spreadsheetId = sheetJson.spreadsheetId;
        const spreadsheetUrl =
          sheetJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`;

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
            ["รายงานสรุปยอดนักเรียนในหอพักประจำวัน"],
            [`วันที่จัดทำสรุปรายงาน: ${reportData.reportDate}`, `สรุปยอดนักเรียนอยู่หอพักเมื่อคืนนี้: ${reportData.summaryDate}`],
            [],
            ["ตารางจำนวนนักเรียนทั้งหมด", "", "", "", "", "", "", "ตารางจำนวนนักเรียนออกหอพัก"],
            ["หอพัก / ระดับชั้น", ...reportData.grades, "รวม", "หอพัก / ระดับชั้น", ...reportData.grades, "รวม"],
            ...reportData.dormitories.map((d: any) => [
              d.name,
              ...reportData.grades.map((g: string) => reportData.totalMatrix[d.id][g]),
              reportData.dormTotals[d.id].total,
              d.name,
              ...reportData.grades.map((g: string) => reportData.outMatrix[d.id][g]),
              reportData.dormTotals[d.id].out
            ]),
            [
              "รวมทั้งสิ้น",
              ...reportData.grades.map((g: string) => reportData.gradeTotals[g].total),
              reportData.grandTotals.total,
              "รวมทั้งสิ้น",
              ...reportData.grades.map((g: string) => reportData.gradeTotals[g].out),
              reportData.grandTotals.out
            ],
            [],
            ["ตารางจำนวนนักเรียนคงเหลือแต่ละหอพัก", "", "", "", "", "", "", ""],
            ["หอพัก / ระดับชั้น", ...reportData.grades, "รวม", "ลงชื่อ.....................................................................", "(.....................................................)"],
            ...reportData.dormitories.map((d: any, idx: number) => {
              let sigLabel = "";
              if (idx === 0) sigLabel = "ผู้รายงาน (เจ้าหน้าที่สำนักงาน)";
              if (idx === 2) sigLabel = "ลงชื่อ.....................................................................";
              if (idx === 3) sigLabel = "(.....................................................)";
              if (idx === 4) sigLabel = "หัวหน้างานหอพัก";

              let sigValue = "";
              if (idx === 1) sigValue = "ลงชื่อ.....................................................................";
              if (idx === 2) sigValue = "(.....................................................)";
              if (idx === 3) sigValue = "รองผู้อำนวยการ";

              return [
                d.name,
                ...reportData.grades.map((g: string) => reportData.remainingMatrix[d.id][g]),
                reportData.dormTotals[d.id].remaining,
                sigLabel,
                sigValue
              ];
            }),
            [
              "รวมทั้งสิ้น",
              ...reportData.grades.map((g: string) => reportData.gradeTotals[g].remaining),
              reportData.grandTotals.remaining
            ]
          ];

          const sheet2Values = [
            ["ตารางรายชื่อนักเรียนออกหอพักประจำวัน"],
            [`วันที่จัดทำสรุปรายงาน: ${reportData.reportDate}`, `วันที่สรุปยอดนักเรียนอยู่หอพักเมื่อคืนนี้: ${reportData.summaryDate}`],
            [],
            ["ที่", "รหัสนักเรียน", "รายชื่อนักเรียน", "ระดับชั้น/ห้อง", "หอพัก", "เหตุผลที่ออกหอพัก"],
            ...reportData.absentStudentsList.map((s: any) => [
              s.no,
              s.studentId,
              s.fullName,
              s.gradeRoom,
              s.dormName,
              s.reason
            ])
          ];

          const sheet3Values = [
            ["ใบรายงานเรื่องแจ้งอบรมประจำวัน"],
            [`วันที่จัดทำสรุปรายงาน: ${reportData.reportDate}`, `วันที่สรุปยอดนักเรียนอยู่หอพักเมื่อคืนนี้: ${reportData.summaryDate}`],
            [],
            ["1. เรื่องแจ้งอบรมจากหัวหน้างานหอพัก"],
            ...(reportData.headTeacherNotices && reportData.headTeacherNotices.length > 0
              ? reportData.headTeacherNotices.flatMap((n: any) => [
                  [`หัวข้อ: ${n.title}`],
                  ...n.topics.map((t: string) => [`   - ${t}`])
                ])
              : [["ไม่มีเรื่องแจ้งอบรมจากหัวหน้างานหอพักในวันนี้"]]),
            [],
            ["2. เรื่องที่ครูประจำหอพักอบรมนักเรียน"],
            ...(reportData.dormTeacherOrientations && reportData.dormTeacherOrientations.length > 0
              ? reportData.dormTeacherOrientations.flatMap((o: any) => [
                  [`${o.dormName} (ครูผู้เช็คยอดและอบรม: ${o.checkedBy || "ครูประจำหอพัก"})`],
                  ...(o.orientationNotes && o.orientationNotes.length > 0
                    ? o.orientationNotes.map((note: string) => [`   - ${note}`])
                    : [["   - ไม่มีเรื่องอบรมในวันนี้"]])
                ])
              : [["ไม่มีข้อมูลเรื่องอบรมจากครูประจำหอพัก"]])
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
                  { range: "'1.สรุปยอดจำนวนนักเรียน'!A1", values: sheet1Values },
                  { range: "'2.ตารางรายชื่อนักเรียนออกหอพัก'!A1", values: sheet2Values },
                  { range: "'3.ใบรายงานเรื่องแจ้งอบรมประจำวัน'!A1", values: sheet3Values }
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
          message: "สร้างและบันทึกไฟล์ลงโฟลเดอร์ Google Drive เรียบร้อยแล้ว!"
        });
      }
    }

    return res.json({
      success: true,
      spreadsheetUrl: TARGET_DRIVE_FOLDER_URL,
      driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
      message: "พร้อมเปิดไปยังโฟลเดอร์ Google Drive รายงานสรุปหอพัก"
    });
  } catch (err) {
    console.error("Export Google Sheets Error:", err instanceof Error ? err.message : "unknown error");
    res.status(500).json({ success: false, message: "ไม่สามารถส่งออกข้อมูลไปยัง Google Sheets ได้" });
  }
});

// START EXPRESS & VITE MIDDLEWARE
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
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
        // Fallback to Vite middleware
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
