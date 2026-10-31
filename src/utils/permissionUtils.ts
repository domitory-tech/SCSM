import { RoleNavigationPermissions } from "../types";

export interface NavigationMenuDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: "MAIN" | "OPERATIONS" | "DATA" | "ADMIN";
  defaultRoles: {
    guest: boolean;
    level3: boolean; // ครูหอพัก
    level2: boolean; // เจ้าหน้าที่
    level1: boolean; // ผู้ดูแลระบบ
  };
}

export const ALL_NAVIGATION_MENUS: NavigationMenuDefinition[] = [
  {
    id: "dashboard",
    name: "ภาพรวมหอพัก (Dashboard)",
    shortName: "ภาพรวม",
    description: "แสดงสถิตินักเรียนแยกตามหอพัก กราฟิก และข้อมูลสรุปประจำวัน",
    category: "MAIN",
    defaultRoles: {
      guest: true,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "dorm-layout",
    name: "ผังการจัดหอพัก (Dorm Layout)",
    shortName: "ผังหอพัก",
    description: "ผังเตียงนอน ห้องพัก และจัดเรียงนักเรียนในแต่ละหอพัก",
    category: "MAIN",
    defaultRoles: {
      guest: false,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "student-search",
    name: "ค้นหานักเรียน (Student Search)",
    shortName: "ค้นหานักเรียน",
    description: "สืบค้นข้อมูลรายบุคคล ประวัติการเช็คยอด และสถานะการพัก",
    category: "OPERATIONS",
    defaultRoles: {
      guest: false,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "check-attendance",
    name: "เช็คยอดหอพัก (Attendance Check)",
    shortName: "เช็คยอด",
    description: "บันทึกการเช็คชื่อนักเรียนประจำวัน 20.00 น. และบันทึกเรื่องอบรม",
    category: "OPERATIONS",
    defaultRoles: {
      guest: false,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "special-status",
    name: "กำหนดสถานะพิเศษ (Special Status)",
    shortName: "กำหนดสถานะพิเศษ",
    description: "จัดการกำหนดสถานะรอบกลับบ้านและปิดภาคเรียนตามช่วงวัน สำหรับวันหยุดยาวและปิดเทอม",
    category: "OPERATIONS",
    defaultRoles: {
      guest: true,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "notices",
    name: "เรื่องแจ้งอบรม (Notices)",
    shortName: "แจ้งอบรม",
    description: "จัดการเรื่องแจ้งอบรม บันทึกหัวข้ออบรมนักเรียนประจำวัน",
    category: "OPERATIONS",
    defaultRoles: {
      guest: false,
      level3: false,
      level2: true,
      level1: true
    }
  },
  {
    id: "reports",
    name: "สรุป & พิมพ์รายงาน (Reports)",
    shortName: "รายงาน",
    description: "สรุปยอดประจำวัน พิมพ์ใบรายงานผล และส่งออกข้อมูล",
    category: "OPERATIONS",
    defaultRoles: {
      guest: true,
      level3: true,
      level2: true,
      level1: true
    }
  },
  {
    id: "students",
    name: "ข้อมูลนักเรียน (Students Management)",
    shortName: "นักเรียน",
    description: "จัดการรายชื่อ นำเข้าข้อมูล และแก้ไขข้อมูลนักเรียนทั้งหมด",
    category: "DATA",
    defaultRoles: {
      guest: false,
      level3: false,
      level2: true,
      level1: true
    }
  },
  {
    id: "dorms",
    name: "ข้อมูลหอพัก (Dorms Management)",
    shortName: "หอพัก",
    description: "จัดการข้อมูลหอพัก ความจุ และรายชื่อครูประจำหอพัก",
    category: "DATA",
    defaultRoles: {
      guest: false,
      level3: false,
      level2: true,
      level1: true
    }
  },
  {
    id: "users-db",
    name: "ตั้งค่าระบบ บัญชีผู้ใช้ สิทธิ์ และฐานข้อมูล (Settings & Database)",
    shortName: "ตั้งค่าระบบ",
    description: "จัดการบัญชีผู้ใช้ สิทธิ์เข้าถึงเมนู และสำรอง/กู้คืนฐานข้อมูล",
    category: "ADMIN",
    defaultRoles: {
      guest: false,
      level3: true, // Level 3 เข้าหน้าเปลี่ยนรหัสผ่าน & โปรไฟล์ได้
      level2: true,
      level1: true
    }
  }
];

export const DEFAULT_ROLE_NAVIGATION_PERMISSIONS: RoleNavigationPermissions = {
  guest: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "reports"],
  level3: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "reports", "users-db"],
  level2: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "notices", "reports", "students", "dorms", "users-db"],
  level1: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "notices", "reports", "students", "dorms", "users-db"]
};

/**
 * Normalizes navigation permissions by ensuring newly added system menus like
 * "special-status" are included even if older system settings were persisted in Firestore.
 */
export function normalizeNavigationPermissions(
  permissions?: RoleNavigationPermissions | null
): RoleNavigationPermissions {
  const result: RoleNavigationPermissions = {
    guest: permissions?.guest ? [...permissions.guest] : [...DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest],
    level3: permissions?.level3 ? [...permissions.level3] : [...DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3],
    level2: permissions?.level2 ? [...permissions.level2] : [...DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2],
    level1: permissions?.level1 ? [...permissions.level1] : [...DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1]
  };

  // Backwards compatibility migration: ensure "special-status" is present in level1, level2, level3, and guest
  if (!result.level1.includes("special-status")) {
    result.level1.push("special-status");
  }
  if (!result.level2.includes("special-status")) {
    result.level2.push("special-status");
  }
  if (!result.level3.includes("special-status")) {
    result.level3.push("special-status");
  }
  if (!result.guest.includes("special-status")) {
    result.guest.push("special-status");
  }

  return result;
}

/**
 * Checks if a specific user role or guest has access to a target tab ID
 */
export function isMenuAccessible(
  menuId: string,
  currentUser: { roleLevel?: number } | null | undefined,
  permissions?: RoleNavigationPermissions | null
): boolean {
  const activePerms = normalizeNavigationPermissions(permissions);

  // Level 1 Admin always has full access fallback
  if (currentUser?.roleLevel === 1) {
    return activePerms.level1.includes(menuId);
  }

  // Level 2 Staff
  if (currentUser?.roleLevel === 2) {
    return activePerms.level2.includes(menuId);
  }

  // Level 3 Teacher / User
  if (currentUser?.roleLevel === 3) {
    return activePerms.level3.includes(menuId);
  }

  // Guest (Not logged in)
  return activePerms.guest.includes(menuId);
}
