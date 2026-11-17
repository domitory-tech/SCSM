import React, { useState } from "react";
import { RoleNavigationPermissions, SystemSettings } from "../../types";
import {
  ALL_NAVIGATION_MENUS,
  DEFAULT_ROLE_NAVIGATION_PERMISSIONS,
  normalizeNavigationPermissions,
  validateNavigationPermissions
} from "../../utils/permissionUtils";
import {
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  Unlock,
  Sparkles,
  Info,
  Check,
  X,
  Eye,
  LogIn
} from "lucide-react";

interface NavigationPermissionsTabProps {
  systemSettings: SystemSettings;
  onSavePermissions: (newPermissions: RoleNavigationPermissions, guestRequiresLogin: boolean) => void;
  isAdmin: boolean;
  showNotification: (type: "success" | "error", text: string) => void;
}

export const NavigationPermissionsTab: React.FC<NavigationPermissionsTabProps> = ({
  systemSettings,
  onSavePermissions,
  isAdmin,
  showNotification
}) => {
  const currentPermissions = normalizeNavigationPermissions(systemSettings.navigationPermissions);

  const [permissionsState, setPermissionsState] = useState<RoleNavigationPermissions>(currentPermissions);
  const [guestRequiresLogin, setGuestRequiresLogin] = useState<boolean>(
    Boolean(systemSettings.guestRequiresLogin)
  );
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "MAIN" | "OPERATIONS" | "DATA" | "ADMIN">("ALL");

  // Keep synced if systemSettings changes externally
  React.useEffect(() => {
    setPermissionsState(normalizeNavigationPermissions(systemSettings.navigationPermissions));
    setGuestRequiresLogin(Boolean(systemSettings.guestRequiresLogin));
  }, [systemSettings.navigationPermissions, systemSettings.guestRequiresLogin]);

  const rolesConfig: Array<{
    key: keyof RoleNavigationPermissions;
    label: string;
    subLabel: string;
    levelText: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
    headerBg: string;
  }> = [
    {
      key: "guest",
      label: "ผู้เยี่ยมชม",
      subLabel: "ผู้เยี่ยมชมระบบ / สาธารณะ (Visitor)",
      levelText: "ระดับ 4",
      badgeBg: "bg-slate-100 text-slate-700 border-slate-300",
      textColor: "text-slate-800",
      borderColor: "border-slate-300",
      headerBg: "bg-slate-50"
    },
    {
      key: "level3",
      label: "ครูหอพัก",
      subLabel: "ครูประจำหอพัก / ผู้ใช้งานทั่วไป",
      levelText: "ระดับ 3",
      badgeBg: "bg-pink-100 text-pink-800 border-pink-300",
      textColor: "text-pink-900",
      borderColor: "border-pink-300",
      headerBg: "bg-pink-50/70"
    },
    {
      key: "level2",
      label: "เจ้าหน้าที่",
      subLabel: "เจ้าหน้าที่ส่วนกลาง / งานหอพัก",
      levelText: "ระดับ 2",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-300",
      textColor: "text-blue-900",
      borderColor: "border-blue-300",
      headerBg: "bg-blue-50/70"
    },
    {
      key: "level1",
      label: "ผู้ดูแลระบบ",
      subLabel: "ผู้ดูแลระบบสูงสุด (Admin)",
      levelText: "ระดับ 1",
      badgeBg: "bg-purple-100 text-purple-900 border-purple-300",
      textColor: "text-purple-950",
      borderColor: "border-purple-300",
      headerBg: "bg-purple-50/70"
    }
  ];

  const getRoleDisplayName = (roleKey: keyof RoleNavigationPermissions) => {
    const found = rolesConfig.find((r) => r.key === roleKey);
    return found ? `${found.levelText} ${found.label}` : roleKey;
  };

  const togglePermission = (roleKey: keyof RoleNavigationPermissions, menuId: string) => {
    if (!isAdmin) {
      showNotification("error", "เฉพาะผู้ดูแลระบบ (Admin ระดับ 1) เท่านั้นที่สามารถตั้งค่าสิทธิ์การเข้าถึงเมนูได้");
      return;
    }

    const currentList = permissionsState[roleKey] || [];
    const hasItem = currentList.includes(menuId);

    if (hasItem && currentList.length <= 1) {
      showNotification(
        "error",
        `ไม่สามารถปิดเมนูสุดท้ายได้: ${getRoleDisplayName(roleKey)} ต้องมีการอนุญาตเข้าถึงเมนูอย่างน้อย 1 เมนู`
      );
      return;
    }

    setPermissionsState((prev) => {
      const prevList = prev[roleKey] || [];
      const exists = prevList.includes(menuId);
      if (exists && prevList.length <= 1) {
        return prev;
      }
      const newList = exists
        ? prevList.filter((id) => id !== menuId)
        : [...prevList, menuId];

      return {
        ...prev,
        [roleKey]: newList
      };
    });
  };

  const handleToggleColumnAll = (roleKey: keyof RoleNavigationPermissions, shouldEnable: boolean) => {
    if (!isAdmin) return;
    if (shouldEnable) {
      setPermissionsState((prev) => ({
        ...prev,
        [roleKey]: ALL_NAVIGATION_MENUS.map((m) => m.id)
      }));
      return;
    }

    // Enforce minimum 1 menu permitted per role when clearing
    const currentList = permissionsState[roleKey] || [];
    const fallbackMenuId = currentList.includes("dashboard")
      ? "dashboard"
      : currentList[0] || ALL_NAVIGATION_MENUS[0].id;
    const keptMenu = ALL_NAVIGATION_MENUS.find((m) => m.id === fallbackMenuId);

    setPermissionsState((prev) => ({
      ...prev,
      [roleKey]: [fallbackMenuId]
    }));
    showNotification(
      "success",
      `คงเหลือสิทธิ์เข้าถึง 1 เมนู (${keptMenu?.shortName || fallbackMenuId}) สำหรับ ${getRoleDisplayName(roleKey)} เนื่องจากทุกระดับต้องมีอย่างน้อย 1 เมนู`
    );
  };

  const handleResetToDefaults = () => {
    if (!isAdmin) return;
    setPermissionsState({
      guest: [...(DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest || ["dashboard"])],
      level3: [...(DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3 || ["dashboard"])],
      level2: [...(DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2 || ["dashboard"])],
      level1: [...(DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1 || ["dashboard"])]
    });
    setGuestRequiresLogin(false);
    showNotification("success", "รีเซ็ตค่าสิทธิ์การเข้าถึงเมนูกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว (อย่าลืมกดบันทึก)");
  };

  const handleSave = () => {
    if (!isAdmin) {
      showNotification("error", "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถบันทึกได้");
      return;
    }

    const validation = validateNavigationPermissions(permissionsState);
    if (!validation.valid) {
      const roleNames = validation.emptyRoles.map((r) => getRoleDisplayName(r)).join(", ");
      showNotification(
        "error",
        `ไม่สามารถบันทึกได้: ${roleNames} ต้องมีการอนุญาตเข้าถึงเมนูอย่างน้อย 1 เมนู`
      );
      return;
    }

    onSavePermissions(permissionsState, guestRequiresLogin);
    showNotification("success", "บันทึกการตั้งค่าการอนุญาตเข้าถึงเมนู Navigation สำเร็จเรียบร้อยแล้ว");
  };

  const filteredMenus = selectedCategory === "ALL"
    ? ALL_NAVIGATION_MENUS
    : ALL_NAVIGATION_MENUS.filter((m) => m.category === selectedCategory);

  const validation = validateNavigationPermissions(permissionsState);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A05AFF] to-[#1BCFB4] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2 flex-wrap">
                <span>การอนุญาตเข้าถึงเมนู (Navigation Menu Access Control)</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md">
                  เฉพาะ Admin ระดับ 1
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                กำหนดสิทธิ์การมองเห็นและการเข้าถึงเมนูแถบข้าง (Navigation Sidebar) และหน้าระบบ สำหรับผู้ใช้งานทั้ง 4 ระดับ
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleResetToDefaults}
            disabled={!isAdmin}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            title="รีเซ็ตสิทธิ์เป็นค่าเริ่มต้นที่ระบบแนะนำ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าเริ่มต้น</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isAdmin || !validation.valid}
            className="px-4.5 py-2 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-95 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกการอนุญาต</span>
          </button>
        </div>
      </div>

      {/* Admin Notice / Access Warning */}
      {!isAdmin ? (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-black text-amber-950">ท่านกำลังเปิดดูในโหมดอ่านเท่านั้น (Read-Only)</div>
            <p className="leading-relaxed">
              เฉพาะบัญชี <strong>ระดับ 1: ผู้ดูแลระบบ (Admin)</strong> เท่านั้นที่สามารถเปลี่ยนสิทธิ์การเข้าถึงเมนู navigation ได้ หากต้องการเปลี่ยนแปลง กรุณาเข้าสู่ระบบด้วยบัญชี Admin
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-2xl border border-purple-200/80 flex items-start gap-3 text-xs text-slate-700 shadow-2xs">
          <Sparkles className="w-5 h-5 text-[#A05AFF] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-purple-950">คำแนะนำการตั้งค่าสิทธิ์ (Tick & Apply):</div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              - <strong>ทุกระดับ (ระดับ 1 - ระดับ 4 ผู้เยี่ยมชม)</strong> ต้องมีการอนุญาตให้เข้าถึงเมนู <strong>อย่างน้อย 1 เมนู</strong> เพื่อใช้งานระบบได้<br />
              - <strong>ระดับ 4 ผู้เยี่ยมชม (Guest):</strong> สามารถกำหนดได้ว่าจะให้เข้าดูเมนูที่อนุญาตได้ทันที หรือต้องผ่านหน้าเข้าสู่ระบบ (Login) ก่อน<br />
              - ติ๊กถูก <strong className="text-emerald-700">✓ (อนุญาต)</strong> หรือ ติ๊กออก <strong className="text-slate-400">✕ (ปิด)</strong> แล้วกดปุ่ม <strong>"บันทึกการอนุญาต"</strong> ระบบจะมีผลทันที
            </p>
          </div>
        </div>
      )}

      {/* Guest / Visitor Login Requirement Setting Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 shrink-0">
              <Eye className="w-4.5 h-4.5 text-[#A05AFF]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>การตั้งค่าการล็อกอินสำหรับระดับ 4: ผู้เยี่ยมชม (Visitor Access Mode)</span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                    guestRequiresLogin
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {guestRequiresLogin ? "ต้องล็อกอินก่อนเข้าใช้งาน" : "เข้าชมได้โดยไม่ต้องล็อกอิน"}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                เลือกว่าผู้เยี่ยมชมที่เปิดเว็บไซต์จะต้องเข้าสู่ระบบก่อน หรือสามารถเข้าดูเมนูที่อนุญาตได้ทันที
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Option 1: No Login Required */}
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setGuestRequiresLogin(false)}
            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
              !isAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
            } ${
              !guestRequiresLogin
                ? "border-emerald-500 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                !guestRequiresLogin
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Unlock className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900">
                  ไม่ต้องผ่านการล็อกอิน (เข้าชมได้ทันที)
                </span>
                {!guestRequiresLogin && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                    <Check className="w-3 h-3" /> เลือกอยู่
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                เมื่อเปิดเว็บไซต์ ระบบจะแสดงหน้าหลักและเมนูที่อนุญาตให้ระดับผู้เยี่ยมชมทันทีโดยไม่ต้องเข้าสู่ระบบ
              </p>
            </div>
          </button>

          {/* Option 2: Login Required First */}
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setGuestRequiresLogin(true)}
            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
              !isAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
            } ${
              guestRequiresLogin
                ? "border-[#A05AFF] bg-purple-50/70 shadow-xs ring-2 ring-[#A05AFF]/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                guestRequiresLogin
                  ? "bg-[#A05AFF] text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <LogIn className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900">
                  ต้องผ่านการล็อกอินก่อนเข้าใช้งาน
                </span>
                {guestRequiresLogin && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#A05AFF] bg-purple-100 px-2 py-0.5 rounded-md shrink-0">
                    <Check className="w-3 h-3" /> เลือกอยู่
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                เมื่อยังไม่เข้าสู่ระบบ จะซ่อนเมนูและข้อมูลทั้งหมด แล้วแสดง<strong>เฉพาะกล่องหน้า Login อยู่กลางหน้าจอ</strong> จนกว่าจะเข้าสู่ระบบ (รวมถึงบัญชีระดับ 4 ผู้เยี่ยมชม)
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-gray-500 mr-1 shrink-0">หมวดหมู่:</span>
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
            selectedCategory === "ALL"
              ? "bg-[#A05AFF] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ทั้งหมด ({ALL_NAVIGATION_MENUS.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("MAIN")}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
            selectedCategory === "MAIN"
              ? "bg-[#A05AFF] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          เมนูหลัก (Main)
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("OPERATIONS")}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
            selectedCategory === "OPERATIONS"
              ? "bg-[#A05AFF] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          งานเช็คยอด & บันทึก (Operations)
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("DATA")}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
            selectedCategory === "DATA"
              ? "bg-[#A05AFF] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          จัดการข้อมูล (Data)
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory("ADMIN")}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shrink-0 ${
            selectedCategory === "ADMIN"
              ? "bg-[#A05AFF] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ตั้งค่า & ฐานข้อมูล (Admin)
        </button>
      </div>

      {/* Validation Error Banner (if any role ever has 0 menus) */}
      {!validation.valid && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            ระดับสิทธิ์ต่อไปนี้ยังไม่มีเมนูที่อนุญาต: {validation.emptyRoles.map((r) => getRoleDisplayName(r)).join(", ")} (ทุกระดับต้องมีอย่างน้อย 1 เมนู)
          </span>
        </div>
      )}

      {/* Permission Matrix Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50/90 text-gray-700">
                <th className="py-3.5 px-4 font-black w-2/5 min-w-[240px]">
                  <span>เมนูระบบ (Navigation Menu)</span>
                </th>
                {rolesConfig.map((role) => {
                  const enabledCount = (permissionsState[role.key] || []).length;
                  const isEmpty = enabledCount === 0;
                  return (
                    <th
                      key={role.key}
                      className={`py-3.5 px-3 text-center min-w-[135px] font-black border-l border-gray-200/80 ${role.headerBg}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${role.badgeBg}`}>
                          {role.levelText}
                        </span>
                        <span className={`text-xs font-black ${role.textColor}`}>
                          {role.label}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 max-w-[125px] truncate" title={role.subLabel}>
                          {role.subLabel}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            isEmpty
                              ? "bg-rose-100 text-rose-700 border-rose-300"
                              : "bg-white/90 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          เปิด {enabledCount}/{ALL_NAVIGATION_MENUS.length} เมนู
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-200/60 w-full justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggleColumnAll(role.key, true)}
                              className="text-[9px] font-bold text-emerald-700 hover:underline px-1 cursor-pointer"
                              title="เลือกทั้งหมด"
                            >
                              เลือกหมด
                            </button>
                            <span className="text-gray-300 text-[9px]">|</span>
                            <button
                              type="button"
                              onClick={() => handleToggleColumnAll(role.key, false)}
                              className="text-[9px] font-bold text-rose-600 hover:underline px-1 cursor-pointer"
                              title="ลดเหลือ 1 เมนูหลัก"
                            >
                              เหลือ 1 เมนู
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100">
              {filteredMenus.map((menu, idx) => {
                return (
                  <tr
                    key={menu.id}
                    className={`hover:bg-purple-50/30 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    {/* Menu Details Column */}
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-gray-900 text-xs flex items-center gap-2">
                        <span>{menu.name}</span>
                        <span className="text-[9px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          id: {menu.id}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {menu.description}
                      </div>
                    </td>

                    {/* Role Checkboxes */}
                    {rolesConfig.map((role) => {
                      const list = permissionsState[role.key] || [];
                      const isChecked = list.includes(menu.id);
                      const isLastRemaining = isChecked && list.length <= 1;

                      return (
                        <td
                          key={role.key}
                          className="py-3 px-3 text-center border-l border-gray-100 align-middle"
                        >
                          <label
                            title={
                              isLastRemaining
                                ? "ต้องอนุญาตอย่างน้อย 1 เมนู (เปิดเมนูอื่นก่อนจึงจะปิดเมนูนี้ได้)"
                                : isChecked
                                ? "คลิกเพื่อปิดการเข้าถึงเมนูนี้"
                                : "คลิกเพื่ออนุญาตเข้าถึงเมนูนี้"
                            }
                            className={`inline-flex items-center justify-center p-2 rounded-xl transition-all select-none ${
                              isAdmin
                                ? isLastRemaining
                                  ? "cursor-pointer opacity-90"
                                  : "cursor-pointer hover:scale-110 active:scale-95"
                                : "cursor-not-allowed opacity-80"
                            } ${
                              isChecked
                                ? isLastRemaining
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-400 ring-2 ring-emerald-200 shadow-2xs"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs"
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!isAdmin}
                              onChange={() => togglePermission(role.key, menu.id)}
                              className="sr-only"
                            />
                            {isChecked ? (
                              <div className="flex items-center gap-1 font-black text-xs text-emerald-700">
                                {isLastRemaining ? (
                                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Check className="w-4 h-4 stroke-[3]" />
                                )}
                                <span className="text-[11px]">อนุญาต</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 font-bold text-xs text-gray-400">
                                <X className="w-3.5 h-3.5" />
                                <span className="text-[10px]">ปิด</span>
                              </div>
                            )}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#A05AFF]" />
            <span>
              จำนวนเมนูทั้งหมดในระบบ: <strong>{ALL_NAVIGATION_MENUS.length} เมนู</strong> | กำลังแสดง: <strong>{filteredMenus.length} เมนู</strong> (ทุกระดับต้องมีอย่างน้อย 1 เมนู)
            </span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!validation.valid}
              className="px-5 py-2 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการอนุญาตเข้าถึงเมนู</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
