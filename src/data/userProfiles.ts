import { UserProfile } from "../types";

export const DEMO_USERS: UserProfile[] = [
  {
    id: "user-5",
    name: "ดร.ประเสริฐ (รองผู้อำนวยการ)",
    role: "DEPUTY_DIRECTOR",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "ผู้ดูแล",
    roleLabel: "ผู้ดูแลระบบ / ผู้บริหาร (สิทธิ์เข้าถึงทั้งหมด)",
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23A05AFF"/><path d="M22 68 L28 36 L42 50 L50 28 L58 50 L72 36 L78 68 Z" fill="%23FDE047"/><circle cx="28" cy="32" r="3" fill="%23FFFFFF"/><circle cx="50" cy="24" r="4" fill="%23FFFFFF"/><circle cx="72" cy="32" r="3" fill="%23FFFFFF"/><rect x="22" y="68" width="56" height="8" rx="2" fill="%23FFFFFF"/></svg>`,
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
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%232563EB"/><path d="M50 20 L72 32 V52 C72 68 50 80 50 80 C50 80 28 68 28 52 V32 Z" fill="%23FFFFFF" opacity="0.2"/><path d="M50 25 L68 35 V50 C68 63 50 73 50 73 C50 73 32 63 32 50 V35 Z" fill="%23FDE047"/><path d="M50 35 L53 43 L62 43 L55 48 L57 56 L50 51 L43 56 L45 48 L38 43 L47 43 Z" fill="%231E3A8A"/></svg>`,
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
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23EA580C"/><circle cx="38" cy="42" r="14" fill="none" stroke="%23FFFFFF" stroke-width="6"/><path d="M48 48 L72 72 M60 60 L66 54 M66 66 L72 60" stroke="%23FFFFFF" stroke-width="6" stroke-linecap="round"/></svg>`,
    password: "123456"
  },
  {
    id: "user-3",
    name: "ครูวิชัย (ครูหอพัก 1 - ชาย)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 1 (ชาย)",
    dormId: "dorm-1",
    allowedDormIds: ["dorm-1"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%231BCFB4"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%231BCFB4"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%231BCFB4"/><rect x="44" y="64" width="12" height="16" fill="%231BCFB4"/></svg>`,
    password: "123456"
  },
  {
    id: "user-32",
    name: "ครูสมคิด (ครูหอพัก 2 - ชาย)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 2 (ชาย)",
    dormId: "dorm-2",
    allowedDormIds: ["dorm-2"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%233B82F6"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%233B82F6"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%233B82F6"/><rect x="44" y="64" width="12" height="16" fill="%233B82F6"/></svg>`,
    password: "123456"
  },
  {
    id: "user-33",
    name: "ครูเกรียงไกร (ครูหอพัก 3 - ชาย)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 3 (ชาย)",
    dormId: "dorm-3",
    allowedDormIds: ["dorm-3"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%238B5CF6"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%238B5CF6"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%238B5CF6"/><rect x="44" y="64" width="12" height="16" fill="%238B5CF6"/></svg>`,
    password: "123456"
  },
  {
    id: "user-4",
    name: "ครูวิไลวรรณ (ครูหอพัก 4 - หญิง)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 4 (หญิง)",
    dormId: "dorm-4",
    allowedDormIds: ["dorm-4"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23EC4899"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%23EC4899"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%23EC4899"/><rect x="44" y="64" width="12" height="16" fill="%23EC4899"/></svg>`,
    password: "123456"
  },
  {
    id: "user-35",
    name: "ครูนภา (ครูหอพัก 5 - หญิง)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 5 (หญิง)",
    dormId: "dorm-5",
    allowedDormIds: ["dorm-5"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23F43F5E"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%23F43F5E"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%23F43F5E"/><rect x="44" y="64" width="12" height="16" fill="%23F43F5E"/></svg>`,
    password: "123456"
  },
  {
    id: "user-36",
    name: "ครูกานดา (ครูหอพัก 6 - หญิง)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก 6 (หญิง)",
    dormId: "dorm-6",
    allowedDormIds: ["dorm-6"],
    avatarUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2310B981"/><path d="M50 22 L80 48 H20 Z" fill="%23FFFFFF"/><rect x="26" y="48" width="48" height="32" rx="2" fill="%23FFFFFF"/><rect x="34" y="54" width="10" height="10" rx="1" fill="%2310B981"/><rect x="56" y="54" width="10" height="10" rx="1" fill="%2310B981"/><rect x="44" y="64" width="12" height="16" fill="%2310B981"/></svg>`,
    password: "123456"
  }
];
