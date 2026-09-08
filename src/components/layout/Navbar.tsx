import React from "react";
import { UserProfile, SystemSettings } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utils/dateUtils";
import {
  LayoutDashboard,
  CheckCircle2,
  Megaphone,
  FileText,
  Users,
  Home,
  Shield,
  Search,
  BedDouble,
  Menu,
  X
} from "lucide-react";

interface NavbarProps {
  currentUser: UserProfile | null;
  systemSettings?: SystemSettings;
  onOpenSwitchUser?: () => void;
  activeTab: string;
  onExportSheetsClick: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  uncheckedDormsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  activeTab,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  uncheckedDormsCount = 0
}) => {
  const getTabInfo = () => {
    switch (activeTab) {
      case "dorm-layout":
        return { label: "ผังการจัดหอพัก", icon: BedDouble };
      case "student-search":
        return { label: "ค้นหานักเรียน", icon: Search };
      case "check-attendance":
        return { label: "เช็คยอดหอพัก", icon: CheckCircle2 };
      case "notices":
        return { label: "เรื่องแจ้งอบรม", icon: Megaphone };
      case "reports":
        return { label: "รายงานประจำวัน", icon: FileText };
      case "students":
        return { label: "ข้อมูลนักเรียน", icon: Users };
      case "dorms":
        return { label: "ข้อมูลหอพัก", icon: Home };
      case "users-db":
        return {
          label: (currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2) ? "ตั้งค่าระบบ" : "เปลี่ยนรหัสผ่าน & โปรไฟล์",
          icon: Shield
        };
      default:
        return { label: "ภาพรวมหอพัก", icon: LayoutDashboard };
    }
  };

  const currentTab = getTabInfo();
  const TabIcon = currentTab.icon;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Left Side: Hamburger (mobile/tablet) + System Name <h1> */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Hamburger Menu Toggle Button (Mobile & Tablet: lg:hidden) */}
          <button
            type="button"
            id="btn-hamburger-menu"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-purple-50 active:bg-purple-100 text-slate-700 hover:text-[#A05AFF] border border-slate-200 transition-all cursor-pointer shadow-2xs relative shrink-0"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-[#A05AFF]" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
            {uncheckedDormsCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-3 h-3 bg-[#FE9496] rounded-full ring-2 ring-white animate-pulse"
                title={`${uncheckedDormsCount} หอพักรอเช็คยอด`}
              />
            )}
          </button>

          <div className="w-10 h-10 bg-[#A05AFF] text-white rounded-xl flex items-center justify-center shadow-md shadow-[#A05AFF]/25 shrink-0">
            <TabIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {systemSettings.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน"}
              <span className="text-xs font-bold text-[#A05AFF] ml-2 font-normal hidden md:inline">
                ({currentTab.label})
              </span>
            </h1>
            <div className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
              {systemSettings.schoolNameTh || "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

