import React, { useState, useEffect } from "react";
import { UserProfile, SystemSettings } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS, getDirectImageUrl } from "../../utils/dateUtils";
import { isMenuAccessible } from "../../utils/permissionUtils";
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
  Wrench,
  AlertTriangle,
  Bell,
  Search,
  BedDouble,
  LayoutGrid,
  Calendar,
  ChevronDown,
  X
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
  onOpenSwitchUser?: () => void;
  onOpenMaintenanceModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
  uncheckedDormsCount = 0,
  currentUser,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onOpenLogin,
  onOpenSwitchUser,
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

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpenMobile) {
        setIsOpenMobile(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenMobile, setIsOpenMobile]);

  // Auto-close mobile drawer when window resizes to desktop width (>= 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isOpenMobile) {
        setIsOpenMobile(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpenMobile, setIsOpenMobile]);

  // Thai formatted date for display
  const now = new Date();
  const thaiWeekdays = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const formattedThaiDate = `${thaiWeekdays[now.getDay()]} ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;

  const handleUserClick = () => {
    if (onOpenSwitchUser) {
      onOpenSwitchUser();
    } else {
      onOpenLogin();
    }
  };

  const menuItems = [
    {
      id: "dashboard",
      label: "ภาพรวมหอพัก",
      fullLabel: "ภาพรวมหอพัก",
      icon: BarChart3
    },
    {
      id: "dorm-layout",
      label: "ผังการจัดหอพัก",
      fullLabel: "ผังการจัดหอพัก",
      icon: BedDouble
    },
    {
      id: "student-search",
      label: "ค้นหานักเรียน",
      fullLabel: "ค้นหานักเรียน",
      icon: Search
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

  const displayedMenuItems = menuItems.filter((item) =>
    isMenuAccessible(item.id, currentUser, systemSettings.navigationPermissions)
  );

  return (
    <>
      {/* Desktop Sidebar (lg:flex) */}
      <aside className="hidden lg:flex w-64 bg-white text-slate-700 flex-col h-full min-h-full self-stretch border-r border-slate-200 shrink-0 select-none overflow-y-auto">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
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

        {/* Date Section (ก่อน nav เมนู) */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div
            id="sidebar-today-date"
            className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/90 px-2.5 py-2 rounded-xl shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-[#A05AFF] shrink-0" />
            <span className="truncate">{formattedThaiDate}</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
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
        <div className="p-3 mx-3 mt-3 mb-2 bg-gradient-to-br from-[#A05AFF]/10 via-[#4BCBEB]/10 to-[#1BCFB4]/10 rounded-2xl border border-[#A05AFF]/20 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 font-bold text-[#A05AFF] text-xs mb-1">
            <ShieldAlert className="w-4 h-4 text-[#A05AFF] shrink-0" />
            <span>เช็คยอดเวลา 20.00 น.</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            ครูประจำหอพักเช็คชื่อนักเรียนทุกคืนและบันทึกรายงานเรื่องที่อบรม
          </p>
        </div>

        {/* System Maintenance & Announcement Box */}
        {systemSettings.showMaintenanceBox && Boolean(systemSettings.maintenanceMessage?.trim()) && (
          <div className="p-3 mx-3 mb-3 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/15 rounded-2xl border-2 border-amber-400/60 shadow-xs space-y-1.5 shrink-0 animate-fade-in">
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

        {/* User Login Status (ด้านล่างสุด แทนที่สถานะเชื่อมต่อฐานข้อมูลเดิม) */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          {currentUser ? (
            <button
              type="button"
              id="sidebar-bottom-user-status"
              onClick={handleUserClick}
              className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-50 hover:bg-purple-50/80 active:scale-98 border border-slate-200/90 hover:border-purple-200 transition-all cursor-pointer text-left shadow-2xs group"
              title="คลิกเพื่อสลับผู้ใช้หรือจัดการโปรไฟล์"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-white ring-2 ring-[#A05AFF]/30 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-800 truncate leading-tight group-hover:text-[#A05AFF] transition-colors">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-[#A05AFF] font-bold truncate">
                    ระดับ {currentUser.roleLevel} ({currentUser.roleCategoryName || "ผู้ใช้งาน"})
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-[#A05AFF] shrink-0 transition-colors" />
            </button>
          ) : (
            <button
              type="button"
              id="sidebar-bottom-login-btn"
              onClick={onOpenLogin}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#A05AFF] to-[#8E3CFF] hover:opacity-95 active:scale-98 text-white px-3.5 py-2.5 rounded-xl text-xs font-black shadow-sm shadow-[#A05AFF]/25 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile & Tablet Drawer Backdrop Overlay */}
      <div
        id="mobile-sidebar-backdrop"
        onClick={() => setIsOpenMobile(false)}
        className={`lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          isOpenMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Mobile & Tablet Hamburger Drawer (lg:hidden) */}
      <aside
        id="mobile-hamburger-drawer"
        aria-label="เมนูหลักสำหรับมือถือและแท็บเล็ต"
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] bg-white text-slate-700 flex flex-col h-full shadow-2xl border-r border-slate-200 transform transition-transform duration-300 ease-in-out select-none ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header with Brand & Close Button */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
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

          {/* Close Button */}
          <button
            type="button"
            id="btn-close-mobile-menu"
            onClick={() => setIsOpenMobile(false)}
            aria-label="ปิดเมนู"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-purple-100 active:bg-purple-200 text-slate-500 hover:text-[#A05AFF] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Date Section (ก่อน nav เมนู) */}
        <div className="p-3 bg-slate-50/70 border-b border-purple-100 shrink-0">
          <div
            id="mobile-sidebar-today-date"
            className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/90 px-2.5 py-2 rounded-xl shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-[#A05AFF] shrink-0" />
            <span className="truncate">{formattedThaiDate}</span>
          </div>
        </div>

        {/* Mobile Navigation Links */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
          {displayedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={`mobile-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpenMobile(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all cursor-pointer min-h-[46px] ${
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
                เข้าสู่ระบบเพื่อใช้งานเมนูเช็คยอด และจัดการข้อมูล
              </p>
              <button
                onClick={() => {
                  setIsOpenMobile(false);
                  onOpenLogin();
                }}
                className="w-full py-2 bg-[#A05AFF] hover:bg-[#8E3CFF] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </nav>

        {/* Evening Check Reminder Card */}
        <div className="p-3 mx-3 mt-1 mb-2 bg-gradient-to-br from-[#A05AFF]/10 via-[#4BCBEB]/10 to-[#1BCFB4]/10 rounded-2xl border border-[#A05AFF]/20 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 font-bold text-[#A05AFF] text-xs mb-1">
            <ShieldAlert className="w-4 h-4 text-[#A05AFF] shrink-0" />
            <span>เช็คยอดเวลา 20.00 น.</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            ครูประจำหอพักเช็คชื่อนักเรียนทุกคืนและบันทึกรายงานเรื่องที่อบรม
          </p>
        </div>

        {/* System Maintenance & Announcement Box */}
        {systemSettings.showMaintenanceBox && Boolean(systemSettings.maintenanceMessage?.trim()) && (
          <div className="p-3 mx-3 mb-2 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/15 rounded-2xl border-2 border-amber-400/60 shadow-xs space-y-1.5 shrink-0">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs min-w-0">
                <Wrench className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <span className="truncate">{systemSettings.maintenanceTitle || "แจ้งการปรับปรุงระบบ"}</span>
              </div>
              {onOpenMaintenanceModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpenMobile(false);
                    onOpenMaintenanceModal();
                  }}
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
                onClick={() => {
                  setIsOpenMobile(false);
                  onOpenMaintenanceModal();
                }}
                className="w-full mt-1 py-1 px-2 bg-amber-500/90 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>ดูประกาศเต็ม</span>
              </button>
            )}
          </div>
        )}

        {/* User Login Status (ด้านล่างสุด แทนที่สถานะเชื่อมต่อฐานข้อมูลเดิม) */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          {currentUser ? (
            <button
              type="button"
              id="mobile-sidebar-bottom-user-status"
              onClick={() => {
                setIsOpenMobile(false);
                handleUserClick();
              }}
              className="w-full flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-purple-50 active:scale-98 border border-slate-200 hover:border-purple-200 p-2 rounded-xl transition-all cursor-pointer text-left shadow-2xs"
              title="คลิกเพื่อสลับผู้ใช้หรือจัดการโปรไฟล์"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={currentUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-white ring-2 ring-[#A05AFF]/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-slate-800 truncate leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-[#A05AFF] font-bold truncate">
                    ระดับ {currentUser.roleLevel} ({currentUser.roleCategoryName || "ผู้ใช้งาน"})
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              id="mobile-sidebar-bottom-login-btn"
              onClick={() => {
                setIsOpenMobile(false);
                onOpenLogin();
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#A05AFF] to-[#8E3CFF] hover:opacity-95 text-white px-3.5 py-2.5 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

