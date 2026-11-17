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
    id: "fingerprint-compare",
    name: "ลงหอสาย (สแกนลายนิ้วมือ)",
    shortName: "ลงหอสาย",
    description: "นำเข้าข้อมูลจากระบบสแกนลายนิ้วมือเพื่อตรวจสอบนักเรียนที่สแกนก่อนเวลา ลงหอสาย และออกหอพัก",
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
  guest: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "fingerprint-compare", "reports"],
  level3: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "fingerprint-compare", "reports", "users-db"],
  level2: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "fingerprint-compare", "notices", "reports", "students", "dorms", "users-db"],
  level1: ["dashboard", "dorm-layout", "student-search", "check-attendance", "special-status", "fingerprint-compare", "notices", "reports", "students", "dorms", "users-db"]
};

const VALID_MENU_IDS = new Set(ALL_NAVIGATION_MENUS.map((m) => m.id));

function sanitizeRoleMenuList(
  list: string[] | undefined | null,
  fallback: string[]
): string[] {
  if (!Array.isArray(list)) {
    return [...fallback];
  }
  const cleaned = Array.from(new Set(list.filter((id) => VALID_MENU_IDS.has(id))));
  if (cleaned.length === 0) {
    return [fallback[0] || ALL_NAVIGATION_MENUS[0].id];
  }
  return cleaned;
}

/**
 * Normalizes navigation permissions while strictly preserving admin-configured
 * opt-outs (including "special-status" and "fingerprint-compare") and ensuring
 * every role level retains at least 1 permitted menu.
 */
export function normalizeNavigationPermissions(
  permissions?: RoleNavigationPermissions | null
): RoleNavigationPermissions {
  return {
    guest: sanitizeRoleMenuList(permissions?.guest, DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest || ["dashboard"]),
    level3: sanitizeRoleMenuList(permissions?.level3, DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3 || ["dashboard"]),
    level2: sanitizeRoleMenuList(permissions?.level2, DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2 || ["dashboard"]),
    level1: sanitizeRoleMenuList(permissions?.level1, DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1 || ["dashboard"])
  };
}

/**
 * Validates that every role level has at least 1 permitted menu.
 */
export function validateNavigationPermissions(
  permissions: RoleNavigationPermissions
): { valid: boolean; emptyRoles: Array<keyof RoleNavigationPermissions> } {
  const roleKeys: Array<keyof RoleNavigationPermissions> = ["guest", "level3", "level2", "level1"];
  const emptyRoles = roleKeys.filter(
    (key) => !Array.isArray(permissions[key]) || permissions[key]!.length === 0
  );
  return {
    valid: emptyRoles.length === 0,
    emptyRoles
  };
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

  // Level 1 Admin
  if (currentUser?.roleLevel === 1) {
    return (activePerms.level1 || []).includes(menuId);
  }

  // Level 2 Staff
  if (currentUser?.roleLevel === 2) {
    return (activePerms.level2 || []).includes(menuId);
  }

  // Level 3 Teacher / User
  if (currentUser?.roleLevel === 3) {
    return (activePerms.level3 || []).includes(menuId);
  }

  // Level 4 Visitor (Logged in) or Guest (Not logged in)
  return (activePerms.guest || []).includes(menuId);
}

/**
 * Returns the first accessible menu ID for the given user/guest
 */
export function getFirstAccessibleMenuId(
  currentUser: { roleLevel?: number } | null | undefined,
  permissions?: RoleNavigationPermissions | null
): string {
  const first = ALL_NAVIGATION_MENUS.find((m) =>
    isMenuAccessible(m.id, currentUser, permissions)
  );
  return first ? first.id : ALL_NAVIGATION_MENUS[0].id;
}
