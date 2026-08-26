export type UserRoleCategory = "ADMIN" | "STAFF" | "DORM_TEACHER";
export type UserRole = "ADMIN_OFFICER" | "HEAD_TEACHER" | "DORM_TEACHER" | "DEPUTY_DIRECTOR" | "SYSTEM_ADMIN";

export type DormPosition = "ครูประธานหอพัก" | "ครูรองประธานหอพัก" | "ครูหัวหน้าหอพัก" | "ครูประจำหอพัก" | "ผู้ดูแลระบบ" | "เจ้าหน้าที่ส่วนกลาง" | string;

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleLevel: 1 | 2 | 3; // 1 = ผู้ดูแล, 2 = เจ้าหน้าที่, 3 = ครูหอพัก
  roleCategory: UserRoleCategory;
  roleCategoryName: string; // "ผู้ดูแล", "เจ้าหน้าที่", "ครูหอพัก"
  roleLabel: string;
  phone?: string;
  dormId?: string; // Primary Dorm ID
  dormPosition?: DormPosition; // ตำแหน่งประจำหอพัก (ครูประธานหอพัก, ครูรองประธานหอพัก, ครูหัวหน้าหอพัก, ครูประจำหอพัก)
  allowedDormIds?: string[]; // Dormitories this user is allowed to check student lists for
  avatarUrl?: string;
  password?: string;
}

export interface DormTeacher {
  id?: string;
  name: string;
  phone?: string;
  position?: DormPosition | string;
  isHead?: boolean;
}

export interface Dormitory {
  id: string;
  name: string;
  type: "male" | "female" | "mixed";
  gender?: "male" | "female" | "mixed";
  teacherName: string;
  teacherPhone: string;
  capacity: number;
  teachers?: DormTeacher[];
  assignedTeacherId?: string;
}

export interface Student {
  id: string;
  studentId: string;
  no: number;
  title: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  grade: string;
  room: number;
  dormId: string;
  dormRoom: string;
  gender: "male" | "female";
}

export type AttendanceStatus = "ROUND_HOME" | "PRESENT" | "HOME" | "CAMP" | "SICK" | "SKILL_COMP" | "EXCHANGE" | "OTHER";

export interface StudentAttendanceRecord {
  studentId: string;
  studentName?: string;
  status: AttendanceStatus;
  reason?: string;
  note?: string;
}


export interface DailyAttendance {
  id: string;
  date: string;
  dormId: string;
  isHomeBreak: boolean;
  status: "CHECKED" | "HOME_BREAK" | "PENDING";
  checkedAt?: string;
  checkedBy?: string;
  teacherOrientationNotes: string[];
  records: StudentAttendanceRecord[];
}

export interface Notice {
  id: string;
  date: string;
  title: string;
  topics: string[];
  createdBy: string;
  createdAt: string;
}

export interface DailyReportData {
  success: boolean;
  reportDate: string;
  summaryDate: string;
  date?: string;
  dormitories: Dormitory[];
  grades: string[];
  totalMatrix: Record<string, Record<string, number>>;
  outMatrix: Record<string, Record<string, number>>;
  remainingMatrix: Record<string, Record<string, number>>;
  dormTotals: Record<string, { total: number; out: number; remaining: number }>;
  gradeTotals: Record<string, { total: number; out: number; remaining: number }>;
  grandTotals: { total: number; out: number; remaining: number };
  absentStudentsList: Array<{
    no: number;
    studentId: string;
    fullName: string;
    gradeRoom: string;
    dormName: string;
    dormId: string;
    reason: string;
    status: AttendanceStatus;
  }>;
  signatories?: {
    creator: string;
    headTeacher: string;
    deputyDirector: string;
  };

  headTeacherNotices?: Array<{
    id: string;
    date: string;
    title: string;
    topics: string[];
    createdBy: string;
  }>;
  dormTeacherOrientations?: Array<{
    dormId: string;
    dormName: string;
    checkedBy?: string;
    checkedAt?: string;
    status?: string;
    orientationNotes: string[];
  }>;
}

export interface SystemSettings {
  schoolNameTh: string;
  schoolNameEn: string;
  schoolAcronymTh?: string;
  schoolAcronymEn?: string;
  schoolLogoUrl: string;
  systemNameTh: string;
  systemNameEn: string;
  systemTitleTh?: string;
  systemTitleEn?: string;
  systemIcon: string;
  lastUpdatedDate: string;
  // System Maintenance & Announcement Settings
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  showMaintenancePopup?: boolean;
  showMaintenanceBox?: boolean;
}
