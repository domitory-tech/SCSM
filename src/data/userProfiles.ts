import { UserProfile } from "../types";

// Default system roles (passwords are configured securely on first login or by an administrator)
// Users without a custom avatarUrl automatically use the system gender-based sample avatar.
export const DEFAULT_SYSTEM_USERS: UserProfile[] = [
  {
    id: "user-admin",
    name: "ผู้ดูแลระบบ (Administrator)",
    role: "SYSTEM_ADMIN",
    roleLevel: 1,
    roleCategory: "ADMIN",
    roleCategoryName: "ผู้ดูแล",
    roleLabel: "ผู้ดูแลระบบสูงสุด (Admin)",
    phone: "081-234-5678",
    gender: "male",
    dormPosition: "ผู้ดูแลระบบ",
    hasPassword: false,
    avatarUrl: ""
  },
  {
    id: "user-staff",
    name: "เจ้าหน้าที่งานหอพัก (Staff Officer)",
    role: "ADMIN_OFFICER",
    roleLevel: 2,
    roleCategory: "STAFF",
    roleCategoryName: "เจ้าหน้าที่",
    roleLabel: "เจ้าหน้าที่ประสานงานหอพัก",
    phone: "089-876-5432",
    gender: "male",
    dormPosition: "เจ้าหน้าที่ส่วนกลาง",
    hasPassword: false,
    avatarUrl: ""
  },
  {
    id: "user-teacher",
    name: "ครูประจำหอพัก (Dorm Teacher)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก",
    gender: "female",
    dormPosition: "ครูประจำหอพัก",
    hasPassword: false,
    avatarUrl: ""
  },
  {
    id: "user-guest",
    name: "ผู้เยี่ยมชมระบบ (Visitor)",
    role: "GUEST",
    roleLevel: 4,
    roleCategory: "GUEST",
    roleCategoryName: "ผู้เยี่ยมชม",
    roleLabel: "ผู้เยี่ยมชมทั่วไป (Visitor)",
    gender: "male",
    dormPosition: "ผู้เยี่ยมชม",
    hasPassword: false,
    avatarUrl: ""
  }
];

export const DEMO_USERS: UserProfile[] = DEFAULT_SYSTEM_USERS;
