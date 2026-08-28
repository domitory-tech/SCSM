import React, { useState, useEffect } from "react";
import { UserProfile, SystemSettings } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS, getDirectImageUrl } from "../../utils/dateUtils";
import { FirebaseStatusBadge } from "../common/FirebaseStatusBadge";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Home,
  Megaphone,
  ShieldAlert,
  Users,
  LogIn,
  Lock,
  UserCheck,
  Building2,
  Sparkles,
  Database,
  Wifi,
  Wrench,
  AlertTriangle,
  Bell,
  Search
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  uncheckedDormsCount?: number;
  currentUser: UserProfile | null;
  systemSettings?: SystemSettings;
  onOpenLogin: () => void;
  onOpenMaintenanceModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  uncheckedDormsCount = 0,
  currentUser,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onOpenLogin,
  onOpenMaintenanceModal
}) => {
  const [lastDbSaveTime, setLastDbSaveTime] = useState<string>(() => {
    return (
      localStorage.getItem("dorm_last_db_save") ||
      `${new Date().getDate()} สิงหาคม ${new Date().getFullYear() + 543} เวลา ${new Date()
        .getHours()
        .toString()
        .padStart(2, "0")}:${new Date().getMinutes().toString().padStart(2, "0")} น.`
    );
  });

  useEffect(() => {
    const checkDbTime = () => {
      const saved = localStorage.getItem("dorm_last_db_save");
      if (saved) {
        setLastDbSaveTime(saved);
      }
    };
    checkDbTime();
    const interval = setInterval(checkDbTime, 1500);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    {
      id: "dashboard",
      label: "ภาพรวมหอพัก",
      fullLabel: "ภาพรวมหอพัก",
      icon: BarChart3,
      badge: "เปิดทุกคน",
      badgeColor: "bg-[#1BCFB4] text-white font-extrabold"
    },
    {
      id: "student-search",
      label: "ค้นหานักเรียน",
      fullLabel: "ค้นหานักเรียน",
      icon: Search,
      badge: "ค้นหา",
      badgeColor: "bg-[#A05AFF] text-white font-extrabold"
    },
    {
      id: "check-attendance",
      label: "เช็คยอด",
      fullLabel: "เช็คยอดหอพัก",
      icon: CheckCircle2,
      badge: uncheckedDormsCount > 0 ? `${uncheckedDormsCount} รอเช็ค` : undefined,
      badgeColor: "bg-[#FE9496] text-white font-extrabold"
    },
    {
      id: "notices",
      label: "แจ้งอบรม",
      fullLabel: "เรื่องแจ้งอบรม",
      icon: Megaphone
    },
    {
      id: "reports",
      label: "รายงาน",
      fullLabel: "สรุป & พิมพ์รายงาน",
      icon: FileText
    },
    {
      id: "students",
      label: "นักเรียน",
      fullLabel: "ข้อมูลนักเรียน",
      icon: Users
    },
    {
      id: "dorms",
      label: "หอพัก",
      fullLabel: "ข้อมูลหอพัก",
      icon: Home
    },
    {
      id: "users-db",
      label: (currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2) ? "ตั้งค่า" : "โปรไฟล์",
      fullLabel: (currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2) ? "ตั้งค่าระบบ" : "เปลี่ยนรหัสผ่าน & โปรไฟล์",
      icon: UserCheck
    }
  ];

  const displayedMenuItems = currentUser
    ? currentUser.roleLevel === 3
      ? menuItems.filter(
          (item) =>
            item.id === "dashboard" ||
            item.id === "student-search" ||
            item.id === "check-attendance" ||
            item.id === "reports" ||
            item.id === "users-db"
        )
      : menuItems
    : menuItems.filter((item) => item.id === "dashboard");

  return (
    <>
      {/* Desktop Sidebar (lg:flex) */}
      <aside className="hidden lg:flex w-64 bg-white text-slate-700 flex-col h-full border-r border-slate-200 shrink-0 select-none overflow-y-auto">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-white p-0.5 border border-purple-200/80 shadow-xs shrink-0 overflow-hidden flex items-center justify-center">
              {systemSettings.schoolLogoUrl ? (
                <img
                  src={getDirectImageUrl(systemSettings.schoolLogoUrl)}
                  alt="School Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <Building2 className="w-5 h-5 text-[#A05AFF]" />
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-black tracking-tight text-slate-800 leading-tight truncate">
                {systemSettings.systemNameTh || "ระบบบริหารหอพัก"}
              </div>
              <div className="text-[10px] text-[#A05AFF] font-bold truncate">
                {systemSettings.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล"} {systemSettings.schoolAcronymTh ? `(${systemSettings.schoolAcronymTh})` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links - ENLARGED BEAUTIFUL FONT & TYPOGRAPHY */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-black text-purple-900 tracking-wider uppercase flex items-center justify-between border-b border-purple-100/80 pb-2 mb-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#A05AFF]" />
              <span>{currentUser ? "เมนูระบบ (NAVIGATION)" : "ภาพรวมหอพัก (OPEN DASHBOARD)"}</span>
            </span>
          </div>

          {displayedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-[#A05AFF] to-[#8E3CFF] text-white font-extrabold shadow-md shadow-purple-200"
                    : "text-slate-700 hover:text-purple-900 hover:bg-purple-50/80 font-bold"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-[#A05AFF]"}`} />
                  <span className="truncate text-[14px] leading-snug">{item.fullLabel}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-lg font-black shrink-0 ${
                      isActive
                        ? "bg-white/20 text-white backdrop-blur-xs border border-white/30"
                        : item.badgeColor || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {!currentUser && (
            <div className="mt-4 p-3 bg-purple-50/60 border border-purple-100 rounded-2xl text-center space-y-2">
              <div className="w-8 h-8 bg-[#A05AFF]/10 text-[#A05AFF] rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-700">เมนูการจัดการอื่นซ่อนอยู่</div>
              <p className="text-[10px] text-slate-500 leading-normal">
                เข้าสู่ระบบด้วยสิทธิ์ครูหอพัก หรือผู้ดูแลระบบ เพื่อใช้งานเมนูเช็คยอด และจัดการข้อมูล
              </p>
              <button
                onClick={onOpenLogin}
                className="w-full py-2 bg-[#A05AFF] hover:bg-[#8E3CFF] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </nav>

        {/* Evening Check Reminder Card */}
        <div className="p-3 mx-3 mt-3 mb-2 bg-gradient-to-br from-[#A05AFF]/10 via-[#4BCBEB]/10 to-[#1BCFB4]/10 rounded-2xl border border-[#A05AFF]/20 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-[#A05AFF] text-xs mb-1">
            <ShieldAlert className="w-4 h-4 text-[#A05AFF] shrink-0" />
            <span>เช็คยอดเวลา 20.00 น.</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            ครูประจำหอพักเช็คชื่อนักเรียนทุกคืนและบันทึกรายงานเรื่องที่อบรม
          </p>
        </div>

        {/* System Maintenance & Announcement Box (แสดงต่อจากกล่องเช็คยอด 20.00 น.) */}
        {systemSettings.showMaintenanceBox && Boolean(systemSettings.maintenanceMessage?.trim()) && (
          <div className="p-3 mx-3 mb-3 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/15 rounded-2xl border-2 border-amber-400/60 shadow-xs space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs min-w-0">
                <Wrench className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <span className="truncate">{systemSettings.maintenanceTitle || "แจ้งการปรับปรุงระบบ"}</span>
              </div>
              {onOpenMaintenanceModal && (
                <button
                  type="button"
                  onClick={onOpenMaintenanceModal}
                  className="w-5 h-5 rounded-md bg-amber-200/80 hover:bg-amber-300 text-amber-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title="เปิดดูรายละเอียดแบบเต็ม"
                >
                  <Bell className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed font-medium whitespace-pre-line break-words">
              {systemSettings.maintenanceMessage}
            </p>
            {onOpenMaintenanceModal && (
              <button
                type="button"
                onClick={onOpenMaintenanceModal}
                className="w-full mt-1 py-1 px-2 bg-amber-500/90 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>ดูประกาศเต็ม</span>
              </button>
            )}
          </div>
        )}

        {/* System & Database Connection Status Footer */}
        <FirebaseStatusBadge variant="sidebar" lastDbSaveTime={lastDbSaveTime} />


      </aside>

      {/* Mobile & Tablet Bottom Navigation Bar (lg:hidden) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 shadow-2xl flex items-center justify-around select-none">
        {displayedMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const hasUncheckedBadge = item.id === "check-attendance" && uncheckedDormsCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer relative min-w-[50px] ${
                isActive
                  ? "text-[#1BCFB4] font-bold bg-[#1BCFB4]/15"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "text-[#1BCFB4] scale-110" : "text-slate-400"}`} />
                {hasUncheckedBadge && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-[#FE9496] rounded-full ring-2 ring-slate-900 animate-pulse" />
                )}
              </div>
              <span className={`text-[9px] mt-1 tracking-tight truncate ${isActive ? "text-[#1BCFB4] font-bold" : "text-slate-400"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        {!currentUser && (
          <button
            onClick={onOpenLogin}
            className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-xs text-[#A05AFF] hover:text-white cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-bold">เข้าสู่ระบบ</span>
          </button>
        )}
      </nav>
    </>
  );
};

