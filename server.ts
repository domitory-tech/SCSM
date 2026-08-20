import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// In-memory persistent database store initialized with rich Thai sample data
// In a production setup, this can be synced to Google Sheets or Firestore

export interface Student {
  id: string;
  studentId: string;
  no: number;
  title: string;
  firstName: string;
  lastName: string;
  grade: string; // ม.1, ม.2, ม.3, ม.4, ม.5, ม.6
  room: number; // 1, 2, 3...
  dormId: string; // dorm-1 to dorm-6
  dormRoom: string; // e.g., 101, 102
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
  role: "ADMIN_OFFICER" | "HEAD_TEACHER" | "DORM_TEACHER" | "DEPUTY_DIRECTOR" | "SYSTEM_ADMIN";
  roleLevel: 1 | 2 | 3;
  roleCategory: "ADMIN" | "STAFF" | "DORM_TEACHER";
  roleCategoryName: string;
  roleLabel: string;
  phone?: string;
  dormId?: string;
  dormPosition?: "ครูประธานหอพัก" | "ครูรองประธานหอพัก" | "ครูหัวหน้าหอพัก" | "ครูประจำหอพัก";
  allowedDormIds?: string[];
  avatarUrl?: string;
  password?: string;
}

export interface StudentAttendanceRecord {
  studentId: string;
  status: "ROUND_HOME" | "PRESENT" | "HOME" | "SICK" | "SKILL_COMP" | "EXCHANGE" | "OTHER";
  reason?: string;
  note?: string;
}

export interface DailyAttendance {
  id: string; // date_dormId
  date: string; // YYYY-MM-DD
  dormId: string;
  isHomeBreak: boolean; // วันรอบกลับบ้าน
  status: "CHECKED" | "HOME_BREAK" | "PENDING";
  checkedAt?: string;
  checkedBy?: string;
  teacherOrientationNotes: string[]; // เรื่องที่อบรม
  records: StudentAttendanceRecord[];
}

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

// Initial empty stores (sample data removed as requested)
let studentsStore: Student[] = [];
let noticesStore: Notice[] = [];
let attendanceStore: Record<string, DailyAttendance> = {};

// Initial Users Store
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
  },
  // Teacher User Accounts for Dormitories (Level 3 - DORM_TEACHER)
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
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
    password: "123456"
  }
];

// Default System Settings Store
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

// Main Primary Database File Persistence
const DB_FILE_PATH = path.join(process.cwd(), "database.json");

export function saveDbToDisk() {
  try {
    const payload = {
      dormitories,
      students: studentsStore,
      studentsStore,
      notices: noticesStore,
      noticesStore,
      attendance: attendanceStore,
      attendanceStore,
      users: usersStore,
      usersStore,
      systemSettings,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save primary database to disk:", err);
  }
}

export function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.dormitories) && parsed.dormitories.length > 0) dormitories = parsed.dormitories;
      
      const st = parsed.students || parsed.studentsStore;
      if (Array.isArray(st)) studentsStore = st;

      const nt = parsed.notices || parsed.noticesStore;
      if (Array.isArray(nt)) noticesStore = nt;

      const att = parsed.attendance || parsed.attendanceStore;
      if (att && typeof att === "object") attendanceStore = att;

      const us = parsed.users || parsed.usersStore;
      if (Array.isArray(us) && us.length > 0) usersStore = us;

      if (parsed.systemSettings && typeof parsed.systemSettings === "object") systemSettings = parsed.systemSettings;
      console.log(`Successfully loaded primary database from ${DB_FILE_PATH}`);
    } else {
      saveDbToDisk();
      console.log(`Initialized new primary database file at ${DB_FILE_PATH}`);
    }
  } catch (err) {
    console.error("Failed to load database from disk:", err);
  }
}

// Load primary database from disk on server initialization
loadDbFromDisk();

// Helper function to dynamically enrich dormitories with teachers
function getEnrichedDorms(): Dormitory[] {
  return dormitories.map((dorm) => {
    // If the dorm has explicit teachers saved directly on it, use those!
    if (dorm.teachers && dorm.teachers.length > 0) {
      const headTeacher = dorm.teachers.find((t) => t.isHead || t.position === "ครูประธานหอพัก") || dorm.teachers[0];
      const summaryName = headTeacher ? `${headTeacher.name}${dorm.teachers.length > 1 ? ` (และทีมครู ${dorm.teachers.length - 1} ท่าน)` : ""}` : dorm.teacherName;
      const summaryPhone = (headTeacher && headTeacher.phone) ? headTeacher.phone : dorm.teacherPhone;
      return {
        ...dorm,
        teacherName: summaryName,
        teacherPhone: summaryPhone
      };
    }

    // Find all users from usersStore who have Level 3 / DORM_TEACHER role and are assigned to this dorm
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

// API ROUTES

// 1. Dormitories
app.get("/api/dorms", (req, res) => {
  res.json({ success: true, data: getEnrichedDorms() });
});

app.post("/api/dorms", (req, res) => {
  const { name, type, teacherName, teacherPhone, capacity, teachers } = req.body;
  const newDorm: Dormitory = {
    id: `dorm-${dormitories.length + 1}`,
    name,
    type: type || "male",
    teacherName: teacherName || "ครูประจำหอพัก",
    teacherPhone: teacherPhone || "",
    capacity: capacity || 80,
    teachers: Array.isArray(teachers) ? teachers : []
  };
  dormitories.push(newDorm);
  saveDbToDisk();
  res.json({ success: true, data: newDorm });
});

app.put("/api/dorms/:id", (req, res) => {
  const { id } = req.params;
  const index = dormitories.findIndex((d) => d.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Dormitory not found" });

  const { name, type, teacherName, teacherPhone, capacity, teachers, assignedTeacherId } = req.body;
  dormitories[index] = {
    ...dormitories[index],
    ...(name && { name }),
    ...(type && { type }),
    ...(teacherName && { teacherName }),
    ...(teacherPhone !== undefined && { teacherPhone }),
    ...(capacity && { capacity: Number(capacity) }),
    ...(teachers !== undefined && { teachers: Array.isArray(teachers) ? teachers : [] }),
    ...(assignedTeacherId !== undefined && { assignedTeacherId })
  };

  // If assigned teacher updated, also reflect in teacherName if provided or found
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

// 2. Students CRUD & Batch Import
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
  // Sort by Grade, Room, Class No.
  result.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, "th");
    if (a.room !== b.room) return a.room - b.room;
    return a.no - b.no;
  });
  res.json({ success: true, data: result, total: result.length });
});

app.put("/api/students/:id", (req, res) => {
  const { id } = req.params;
  const index = studentsStore.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "Student not found" });

  studentsStore[index] = {
    ...studentsStore[index],
    ...req.body
  };
  saveDbToDisk();
  res.json({ success: true, data: studentsStore[index], message: "แก้ไขข้อมูลนักเรียนเรียบร้อย" });
});

// 2.1 Users CRUD & Password Management
app.get("/api/users", (req, res) => {
  res.json({ success: true, data: usersStore });
});

app.post("/api/users", (req, res) => {
  const { name, roleCategory, roleLevel, dormId, dormPosition, allowedDormIds, phone, avatarUrl, password } = req.body;
  
  let roleCategoryName = "ผู้ดูแล";
  let roleLabel = name;
  let role = "ADMIN_OFFICER";

  const numLevel = Number(roleLevel) || 2;

  if (numLevel === 1 || roleCategory === "ADMIN") {
    roleCategoryName = "ผู้ดูแล";
    roleLabel = "ผู้ดูแลระบบ";
    role = "SYSTEM_ADMIN";
  } else if (numLevel === 2 || roleCategory === "STAFF") {
    roleCategoryName = "เจ้าหน้าที่";
    roleLabel = "เจ้าหน้าที่สำนักงาน";
    role = "ADMIN_OFFICER";
  } else {
    roleCategoryName = "ครูหอพัก";
    roleLabel = dormPosition || "ครูประจำหอพัก";
    role = "DORM_TEACHER";
  }

  const finalAllowedDormIds = Array.isArray(allowedDormIds) && allowedDormIds.length > 0
    ? allowedDormIds
    : (dormId ? [dormId] : []);

  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    name,
    role: role as any,
    roleLevel: numLevel as any,
    roleCategory: roleCategory || "STAFF",
    roleCategoryName,
    roleLabel,
    phone: phone || undefined,
    dormId: dormId || (finalAllowedDormIds[0] || undefined),
    dormPosition: dormPosition || undefined,
    allowedDormIds: finalAllowedDormIds,
    avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    password: password || "123"
  };

  usersStore.push(newUser);
  saveDbToDisk();
  res.json({ success: true, data: newUser, message: "เพิ่มผู้ใช้งานเรียบร้อย" });
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const index = usersStore.findIndex((u) => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: "User not found" });

  const updatedData = { ...req.body };
  if (updatedData.dormId && (!updatedData.allowedDormIds || updatedData.allowedDormIds.length === 0)) {
    updatedData.allowedDormIds = [updatedData.dormId];
  }

  usersStore[index] = {
    ...usersStore[index],
    ...updatedData
  };
  saveDbToDisk();
  res.json({ success: true, data: usersStore[index], message: "อัปเดตข้อมูลผู้ใช้เรียบร้อย" });
});

app.delete("/api/users/:id", (req, res) => {
  usersStore = usersStore.filter((u) => u.id !== req.params.id);
  saveDbToDisk();
  res.json({ success: true, message: "ลบบัญชีผู้ใช้งานเรียบร้อย" });
});

app.post("/api/users/:id/change-password", (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword, isAdminOverride } = req.body;
  const user = usersStore.find((u) => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (!isAdminOverride) {
    if (user.password && user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }
  }

  user.password = newPassword;
  saveDbToDisk();
  res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย" });
});

// System Settings API
app.get("/api/system-settings", (req, res) => {
  res.json({ success: true, data: systemSettings });
});

app.put("/api/system-settings", (req, res) => {
  systemSettings = {
    ...systemSettings,
    ...req.body
  };
  saveDbToDisk();
  res.json({ success: true, data: systemSettings, message: "บันทึกการตั้งค่าระบบเรียบร้อย" });
});

// 2.2 Database Management
app.post("/api/database/save-primary", (req, res) => {
  saveDbToDisk();
  res.json({
    success: true,
    message: "กำหนดและบันทึกชุดข้อมูลปัจจุบันเป็นฐานข้อมูลหลักของระบบเรียบร้อยแล้ว"
  });
});

app.post("/api/database/reset", (req, res) => {
  studentsStore = [];
  attendanceStore = {};
  noticesStore = [];
  dormitories = [];
  // Keep Level 1 Admin accounts and remove dorm teacher / staff accounts
  usersStore = usersStore.filter((u) => u.roleLevel === 1).map((u) => ({
    ...u,
    dormId: undefined,
    allowedDormIds: []
  }));
  saveDbToDisk();

  res.json({ success: true, message: "ล้างฐานข้อมูลทั้งหมด (รวมข้อมูลหอพักและรายชื่อครูผู้ดูแลหอพัก) เรียบร้อยแล้ว" });
});

app.post("/api/database/clear-attendance", (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, clearNotices } = req.body;
  let countCleared = 0;
  let countNoticesCleared = 0;

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "BY_DATE" && date) return itemDate === date;
    if (mode === "BY_MONTH" && month) return itemDate.startsWith(month);
    if (mode === "BY_RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  const targetDorm = dormitories.find((d) => d.id === dormId);
  const dormNameLabel = dormId === "ALL" || !dormId ? "ทุกหอพัก" : (targetDorm ? targetDorm.name : dormId);

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

app.post("/api/database/attendance/export", (req, res) => {
  const { mode, date, month, startDate, endDate, dormId, includeNotices = true } = req.body;

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  const filteredAttendance = Object.values(attendanceStore).filter((r) => {
    const matchDate = isMatchingDate(r.date);
    const matchDorm = !dormId || dormId === "ALL" || r.dormId === dormId;
    return matchDate && matchDorm;
  });

  const filteredNotices = includeNotices
    ? noticesStore.filter((n) => isMatchingDate(n.date))
    : [];

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

app.post("/api/database/attendance/restore", (req, res) => {
  const { data, mode = "ALL", date, month, startDate, endDate, dormId } = req.body;
  const rawAttendance: DailyAttendance[] = Array.isArray(data?.attendance) ? data.attendance : [];
  const rawNotices: Notice[] = Array.isArray(data?.notices) ? data.notices : [];

  const isMatchingDate = (itemDate: string) => {
    if (!itemDate) return false;
    if (mode === "ALL") return true;
    if (mode === "DATE" && date) return itemDate === date;
    if (mode === "MONTH" && month) return itemDate.startsWith(month);
    if (mode === "RANGE" && startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate;
    }
    return false;
  };

  let restoredAtt = 0;
  rawAttendance.forEach((att) => {
    if (isMatchingDate(att.date) && (!dormId || dormId === "ALL" || att.dormId === dormId)) {
      attendanceStore[`${att.date}_${att.dormId}`] = att;
      restoredAtt++;
    }
  });

  let restoredNotices = 0;
  rawNotices.forEach((n) => {
    if (isMatchingDate(n.date)) {
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

app.post("/api/database/clear-students", (req, res) => {
  const { mode, dormId } = req.body;
  const countBefore = studentsStore.length;

  if (mode === "BY_DORM") {
    if (!dormId) {
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

app.get("/api/database/export", (req, res) => {
  res.json({
    success: true,
    data: {
      dormitories,
      students: studentsStore,
      notices: noticesStore,
      attendance: attendanceStore,
      users: usersStore,
      systemSettings,
      exportedAt: new Date().toISOString()
    }
  });
});

app.post("/api/database/restore", (req, res) => {
  const { dormitories: d, students: s, notices: n, attendance: a, users: u, systemSettings: set } = req.body;
  if (Array.isArray(d)) dormitories = d;
  if (Array.isArray(s)) studentsStore = s;
  if (Array.isArray(n)) noticesStore = n;
  if (a && typeof a === "object") attendanceStore = a;
  if (Array.isArray(u)) usersStore = u;
  if (set && typeof set === "object") systemSettings = set;
  saveDbToDisk();

  res.json({ success: true, message: "กู้คืนฐานข้อมูลจากไฟล์ JSON เรียบร้อยแล้ว" });
});

app.post("/api/students/import", (req, res) => {
  const { dormId, students } = req.body; // students: Array<{ no, studentId, title, firstName, lastName, grade, room }>
  if (!dormId || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  // Remove existing students for this dorm or append
  const dorm = dormitories.find((d) => d.id === dormId);
  const newStudentsList: Student[] = students.map((s, idx) => ({
    id: `std-${Date.now()}-${idx}`,
    studentId: String(s.studentId || `${66000 + idx}`),
    no: Number(s.no) || idx + 1,
    title: s.title || (dorm?.type === "male" ? "นาย" : "นางสาว"),
    firstName: s.firstName,
    lastName: s.lastName,
    grade: s.grade || "ม.1",
    room: Number(s.room) || 1,
    dormId: dormId,
    dormRoom: s.dormRoom || "101",
    gender: dorm?.type === "female" ? "female" : "male"
  }));

  // Append or replace
  studentsStore = studentsStore.filter((s) => s.dormId !== dormId).concat(newStudentsList);
  saveDbToDisk();

  res.json({
    success: true,
    message: `นำเข้าข้อมูลนักเรียนหอพักสำเร็จจำนวน ${newStudentsList.length} คน`,
    count: newStudentsList.length
  });
});

app.post("/api/students", (req, res) => {
  const newStudent: Student = {
    id: `std-${Date.now()}`,
    studentId: req.body.studentId,
    no: Number(req.body.no) || 1,
    title: req.body.title || "นาย",
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    grade: req.body.grade || "ม.1",
    room: Number(req.body.room) || 1,
    dormId: req.body.dormId,
    dormRoom: req.body.dormRoom || "101",
    gender: req.body.gender || "male"
  };
  studentsStore.push(newStudent);
  saveDbToDisk();
  res.json({ success: true, data: newStudent });
});

app.delete("/api/students/:id", (req, res) => {
  studentsStore = studentsStore.filter((s) => s.id !== req.params.id);
  saveDbToDisk();
  res.json({ success: true, message: "ลบรายชื่อนักเรียนสำเร็จ" });
});

app.post("/api/students/batch-delete", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: "ไม่พบรายการนักเรียนที่ต้องการลบ" });
  }
  const idSet = new Set(ids);
  const countBefore = studentsStore.length;
  studentsStore = studentsStore.filter((s) => !idSet.has(s.id));
  saveDbToDisk();
  const deletedCount = countBefore - studentsStore.length;
  res.json({ success: true, message: `ลบรายชื่อนักเรียนจำนวน ${deletedCount} คนเรียบร้อยแล้ว` });
});

// 3. Notices (เรื่องที่หัวหน้างานหอพักแจ้งให้อบรบ)
app.get("/api/notices", (req, res) => {
  const { date } = req.query;
  let list = [...noticesStore];
  if (date) {
    list = list.filter((n) => n.date === String(date));
  }
  res.json({ success: true, data: list });
});

app.post("/api/notices", (req, res) => {
  const { date, title, topics, createdBy } = req.body;
  const newNotice: Notice = {
    id: `not-${Date.now()}`,
    date: date || new Date().toISOString().split("T")[0],
    title,
    topics: Array.isArray(topics) ? topics : [topics],
    createdBy: createdBy || "หัวหน้างานหอพัก",
    createdAt: new Date().toISOString()
  };
  noticesStore.unshift(newNotice);
  saveDbToDisk();
  res.json({ success: true, data: newNotice });
});

// 4. Daily Attendance Check
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

  // If no dormId specified, return all dorms for that date
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

app.post("/api/attendance", (req, res) => {
  const { date, dormId, isHomeBreak, teacherOrientationNotes, records, checkedBy } = req.body;
  const key = `${date}_${dormId}`;

  const updatedRecord: DailyAttendance = {
    id: key,
    date,
    dormId,
    isHomeBreak: Boolean(isHomeBreak),
    status: isHomeBreak ? "HOME_BREAK" : "CHECKED",
    checkedAt: new Date().toISOString(),
    checkedBy: checkedBy || "ครูประจำหอพัก",
    teacherOrientationNotes: Array.isArray(teacherOrientationNotes) ? teacherOrientationNotes : [],
    records: records || []
  };

  attendanceStore[key] = updatedRecord;
  saveDbToDisk();
  res.json({ success: true, data: updatedRecord, message: "บันทึกการเช็คยอดนักเรียนสำเร็จ" });
});

// 5. Daily Summary Reports Generator (สำหรับเจ้าหน้าที่สำนักงานในตอนเช้า)
app.get("/api/reports/daily", (req, res) => {
  // Query param: date (this is the report generation date, default today)
  // Summary date is yesterday date
  const reportDate = req.query.date ? String(req.query.date) : new Date().toISOString().split("T")[0];

  // Calculate yesterday date relative to reportDate
  const reportD = new Date(reportDate);
  reportD.setDate(reportD.getDate() - 1);
  const summaryDate = reportD.toISOString().split("T")[0];

  const gradesList = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];

  // Matrix Structures
  // 1.1 Total Students
  // 1.2 Out of Dorm
  // 1.3 Remaining
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
          outInGrade = totalInGrade; // All out on home break
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

// 6. Export to Google Sheets API endpoint
app.post("/api/google-sheets/export", async (req, res) => {
  try {
    const { accessToken, reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({ success: false, message: "Missing reportData" });
    }

    // Target Google Drive Folder ID
    const TARGET_DRIVE_FOLDER_ID = "17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg";
    const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg?usp=sharing";

    // If an OAuth access token is provided, we can call the official Google Sheets API
    if (accessToken) {
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title: `รายงานสรุปยอดนักเรียนหอพักประจำวันที่_${reportData.reportDate}`
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
        const spreadsheetUrl = sheetJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

        // Move created spreadsheet to the specified Google Drive Folder
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${TARGET_DRIVE_FOLDER_ID}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        } catch (fErr) {
          console.warn("Could not move file to folder:", fErr);
        }

        // Populate values into sheet 1, sheet 2, and sheet 3
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
                [`${o.dormName} (ครูผู้เช็คยอดและอบรม: ${o.checkedBy || 'ครูประจำหอพัก'})`],
                ...(o.orientationNotes && o.orientationNotes.length > 0
                  ? o.orientationNotes.map((note: string) => [`   - ${note}`])
                  : [["   - ไม่มีเรื่องอบรมในวันนี้"]])
              ])
            : [["ไม่มีข้อมูลเรื่องอบรมจากครูประจำหอพัก"]])
        ];

        // Batch update values
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
        });

        return res.json({
          success: true,
          spreadsheetId,
          spreadsheetUrl,
          driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
          message: "สร้างและบันทึกไฟล์ลงโฟลเดอร์ Google Drive เรียบร้อยแล้ว!"
        });
      }
    }

    // Default response targeting the requested Google Drive Folder
    return res.json({
      success: true,
      spreadsheetUrl: TARGET_DRIVE_FOLDER_URL,
      driveFolderUrl: TARGET_DRIVE_FOLDER_URL,
      message: "พร้อมเปิดไปยังโฟลเดอร์ Google Drive รายงานสรุปหอพัก"
    });
  } catch (err: any) {
    console.error("Export Google Sheets Error:", err);
    res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
});

// START EXPRESS & VITE MIDDLEWARE
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
