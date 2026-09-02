import React from "react";
import { UserProfile, SystemSettings } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS } from "../../utils/dateUtils";
import {
  Calendar,
  ChevronDown,
  LayoutDashboard,
  CheckCircle2,
  Megaphone,
  FileText,
  Users,
  Home,
  LogIn,
  Shield,
  Search,
  BedDouble
} from "lucide-react";

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
  activeTab
}) => {
  const now = new Date();
  const thaiWeekdays = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const formattedThaiDate = `${thaiWeekdays[now.getDay()]} ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

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
        {/* Left Side: 1. System Name <h1> */}
        <div className="flex items-center gap-3">
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

        {/* Right Side: 2. Date <div> and 3. Login Status <button> on Separate Lines */}
        <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
          {/* 2. <div> วันที่ (คนละบรรทัด) */}
          <div
            id="navbar-today-date"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl self-start sm:self-end"
          >
            <Calendar className="w-3.5 h-3.5 text-[#A05AFF]" />
            <span>{formattedThaiDate}</span>
          </div>

          {/* 3. <button> สถานะ Login (คนละบรรทัด) */}
          {currentUser ? (
            <button
              type="button"
              id="btn-user-profile-status"
              onClick={onOpenSwitchUser}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 active:scale-98 border border-slate-200 px-3 py-1 rounded-xl transition-all cursor-pointer text-left shadow-2xs self-start sm:self-end"
            >
              <img
                src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover border border-white ring-1 ring-[#A05AFF]/40 shrink-0"
              />
              <div className="text-xs">
                <span className="font-extrabold text-slate-800">{currentUser.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#A05AFF] text-white rounded-md ml-1.5">
                  ระดับ {currentUser.roleLevel} ({currentUser.roleCategoryName || "ผู้ใช้งาน"})
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              id="btn-login-status"
              onClick={onOpenSwitchUser}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-90 active:scale-98 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-sm shadow-[#A05AFF]/25 transition-all cursor-pointer self-start sm:self-end"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

