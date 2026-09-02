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
      guest: false,
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
  guest: ["dashboard"],
  level3: ["dashboard", "dorm-layout", "student-search", "check-attendance", "reports", "users-db"],
  level2: ["dashboard", "dorm-layout", "student-search", "check-attendance", "notices", "reports", "students", "dorms", "users-db"],
  level1: ["dashboard", "dorm-layout", "student-search", "check-attendance", "notices", "reports", "students", "dorms", "users-db"]
};

/**
 * Checks if a specific user role or guest has access to a target tab ID
 */
export function isMenuAccessible(
  menuId: string,
  currentUser: { roleLevel?: number } | null | undefined,
  permissions?: RoleNavigationPermissions | null
): boolean {
  const activePerms = permissions || DEFAULT_ROLE_NAVIGATION_PERMISSIONS;

  // Level 1 Admin always has full access fallback
  if (currentUser?.roleLevel === 1) {
    const l1List = activePerms.level1 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1 ?? [];
    return l1List.includes(menuId);
  }

  // Level 2 Staff
  if (currentUser?.roleLevel === 2) {
    const l2List = activePerms.level2 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2 ?? [];
    return l2List.includes(menuId);
  }

  // Level 3 Teacher / User
  if (currentUser?.roleLevel === 3) {
    const l3List = activePerms.level3 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3 ?? [];
    return l3List.includes(menuId);
  }

  // Guest (Not logged in)
  const guestList = activePerms.guest ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest ?? [];
  return guestList.includes(menuId);
}
