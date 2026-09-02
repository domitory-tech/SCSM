import { UserProfile } from "../types";

// Standard System Accounts with instant login access
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
    dormPosition: "ผู้ดูแลระบบ",
    password: "123456",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
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
    dormPosition: "เจ้าหน้าที่ส่วนกลาง",
    password: "123456",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "user-teacher",
    name: "ครูประจำหอพัก (Dorm Teacher)",
    role: "DORM_TEACHER",
    roleLevel: 3,
    roleCategory: "DORM_TEACHER",
    roleCategoryName: "ครูหอพัก",
    roleLabel: "ครูประจำหอพัก",
    dormPosition: "ครูประจำหอพัก",
    password: "123456",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
  }
];

export const DEMO_USERS: UserProfile[] = DEFAULT_SYSTEM_USERS;

