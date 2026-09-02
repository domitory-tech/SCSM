import React, { useState } from "react";
import { RoleNavigationPermissions, SystemSettings } from "../../types";
import { ALL_NAVIGATION_MENUS, DEFAULT_ROLE_NAVIGATION_PERMISSIONS } from "../../utils/permissionUtils";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  Users,
  Shield,
  UserCheck,
  Sparkles,
  Info,
  Check,
  X,
  Eye,
  Settings,
  HelpCircle
} from "lucide-react";

interface NavigationPermissionsTabProps {
  systemSettings: SystemSettings;
  onSavePermissions: (newPermissions: RoleNavigationPermissions) => void;
  isAdmin: boolean;
  showNotification: (type: "success" | "error", text: string) => void;
}

export const NavigationPermissionsTab: React.FC<NavigationPermissionsTabProps> = ({
  systemSettings,
  onSavePermissions,
  isAdmin,
  showNotification
}) => {
  const currentPermissions: RoleNavigationPermissions = {
    guest: systemSettings.navigationPermissions?.guest ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest ?? [],
    level3: systemSettings.navigationPermissions?.level3 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3 ?? [],
    level2: systemSettings.navigationPermissions?.level2 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2 ?? [],
    level1: systemSettings.navigationPermissions?.level1 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1 ?? []
  };

  const [permissionsState, setPermissionsState] = useState<RoleNavigationPermissions>(currentPermissions);
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "MAIN" | "OPERATIONS" | "DATA" | "ADMIN">("ALL");

  // Keep synced if systemSettings changes externally
  React.useEffect(() => {
    setPermissionsState({
      guest: systemSettings.navigationPermissions?.guest ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.guest ?? [],
      level3: systemSettings.navigationPermissions?.level3 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level3 ?? [],
      level2: systemSettings.navigationPermissions?.level2 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level2 ?? [],
      level1: systemSettings.navigationPermissions?.level1 ?? DEFAULT_ROLE_NAVIGATION_PERMISSIONS.level1 ?? []
    });
  }, [systemSettings.navigationPermissions]);

  const togglePermission = (roleKey: keyof RoleNavigationPermissions, menuId: string) => {
    if (!isAdmin) {
      showNotification("error", "เฉพาะผู้ดูแลระบบ (Admin ระดับ 1) เท่านั้นที่สามารถตั้งค่าสิทธิ์การเข้าถึงเมนูได้");
      return;
    }

    setPermissionsState((prev) => {
      const currentList = prev[roleKey] || [];
      const hasItem = currentList.includes(menuId);
      const newList = hasItem
        ? currentList.filter((id) => id !== menuId)
        : [...currentList, menuId];

      return {
        ...prev,
        [roleKey]: newList
      };
    });
  };

  const handleToggleColumnAll = (roleKey: keyof RoleNavigationPermissions, shouldEnable: boolean) => {
    if (!isAdmin) return;
    setPermissionsState((prev) => ({
      ...prev,
      [roleKey]: shouldEnable ? ALL_NAVIGATION_MENUS.map((m) => m.id) : []
    }));
  };

  const handleResetToDefaults = () => {
    if (!isAdmin) return;
    setPermissionsState({ ...DEFAULT_ROLE_NAVIGATION_PERMISSIONS });
    showNotification("success", "รีเซ็ตค่าสิทธิ์การเข้าถึงเมนูกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว (อย่าลืมกดบันทึก)");
  };

  const handleSave = () => {
    if (!isAdmin) {
      showNotification("error", "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถบันทึกได้");
      return;
    }
    onSavePermissions(permissionsState);
    showNotification("success", "บันทึกการตั้งค่าการอนุญาตเข้าถึงเมนู Navigation สำเร็จเรียบร้อยแล้ว");
  };

  const filteredMenus = selectedCategory === "ALL"
    ? ALL_NAVIGATION_MENUS
    : ALL_NAVIGATION_MENUS.filter((m) => m.category === selectedCategory);

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
      subLabel: "ยังไม่ได้เข้าสู่ระบบ (Guest)",
      levelText: "สาธารณะ",
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
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <span>การอนุญาตเข้าถึงเมนู (Navigation Menu Access Control)</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md">
                  เฉพาะ Admin ระดับ 1
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                กำหนดสิทธิ์การมองเห็นและการเข้าถึงเมนูแถบข้าง (Navigation Sidebar) และหน้าระบบ สำหรับผู้ใช้งานแต่ละระดับ
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
            disabled={!isAdmin}
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
              - <strong>ผู้เยี่ยมชม (Guest):</strong> แนะนำให้เปิดเฉพาะ "ภาพรวมหอพัก" เพื่อให้ดูสถิติทั่วไปได้โดยไม่ต้องล็อกอิน<br />
              - <strong>ครูหอพัก (ระดับ 3):</strong> ติ๊กเลือกเมนูที่จำเป็น เช่น ผังการจัดหอพัก, ค้นหานักเรียน, เช็คยอดหอพัก, สรุป & พิมพ์รายงาน<br />
              - ติ๊กถูก <strong className="text-emerald-700">✓ (เข้าถึงได้)</strong> หรือ ติ๊กออก <strong className="text-slate-400">✕ (ไม่ให้เข้า)</strong> แล้วกดปุ่ม <strong>"บันทึกการอนุญาต"</strong> ระบบจะมีผลทันที
            </p>
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
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
                {rolesConfig.map((role) => (
                  <th
                    key={role.key}
                    className={`py-3.5 px-3 text-center min-w-[130px] font-black border-l border-gray-200/80 ${role.headerBg}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${role.badgeBg}`}>
                        {role.levelText}
                      </span>
                      <span className={`text-xs font-black ${role.textColor}`}>
                        {role.label}
                      </span>
                      <span className="text-[10px] font-medium text-gray-500 max-w-[120px] truncate" title={role.subLabel}>
                        {role.subLabel}
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
                            title="ยกเลิกทั้งหมด"
                          >
                            ล้าง
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
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

                      return (
                        <td
                          key={role.key}
                          className="py-3 px-3 text-center border-l border-gray-100 align-middle"
                        >
                          <label
                            className={`inline-flex items-center justify-center p-2 rounded-xl transition-all select-none ${
                              isAdmin ? "cursor-pointer hover:scale-110 active:scale-95" : "cursor-not-allowed opacity-80"
                            } ${
                              isChecked
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs"
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
                                <Check className="w-4 h-4 stroke-[3]" />
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
              จำนวนเมนูทั้งหมดในระบบ: <strong>{ALL_NAVIGATION_MENUS.length} เมนู</strong> | กำลังแสดง: <strong>{filteredMenus.length} เมนู</strong>
            </span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center"
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
