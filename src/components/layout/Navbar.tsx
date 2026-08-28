import React from "react";
import { UserProfile, SystemSettings } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utils/dateUtils";
import { Calendar, ChevronDown, FileSpreadsheet, LayoutDashboard, CheckCircle2, Megaphone, FileText, Users, Home, LogIn, Shield, Search } from "lucide-react";
import { FirebaseStatusBadge } from "../common/FirebaseStatusBadge";

interface NavbarProps {
  currentUser: UserProfile | null;
  systemSettings?: SystemSettings;
  onOpenSwitchUser: () => void;
  activeTab: string;
  onExportSheetsClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onOpenSwitchUser,
  activeTab,
  onExportSheetsClick,
}) => {
  const todayFormatted = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  const getTabInfo = () => {
    switch (activeTab) {
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left Breadcrumb Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#A05AFF] text-white rounded-xl flex items-center justify-center shadow-md shadow-[#A05AFF]/30 shrink-0">
            <TabIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base lg:text-lg font-extrabold text-slate-900 leading-tight">
                {currentTab.label}
              </h1>
              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Overview</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden md:flex flex-col leading-tight mt-1 space-y-0.5">
              <span className="font-semibold text-slate-700">{systemSettings.systemNameTh}</span>
              <span className="text-slate-500">{systemSettings.schoolNameTh}</span>
            </div>
          </div>
        </div>


        {/* Right Info & Role Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Firebase Connection Status Badge */}
          <FirebaseStatusBadge compact={true} />

          {/* Date Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-[#A05AFF]" />
            <span>{todayFormatted}</span>
          </div>

          {/* Login / User Switch Profile Button */}
          {currentUser ? (
            <button
              onClick={onOpenSwitchUser}
              className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer text-left shadow-2xs"
            >
              <img
                src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-white ring-2 ring-[#A05AFF]/30 shrink-0"
              />
              <div className="hidden md:block text-xs">
                <div className="font-extrabold text-slate-800 line-clamp-1">{currentUser.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#A05AFF] text-white rounded-md">
                    ระดับ {currentUser.roleLevel}
                  </span>
                  <span className="text-[#9E58FF] font-semibold text-[10px]">{currentUser.roleCategoryName}</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={onOpenSwitchUser}
              className="flex items-center gap-2 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

