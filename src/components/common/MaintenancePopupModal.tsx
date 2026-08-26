import React from "react";
import { SystemSettings } from "../../types";
import { formatThaiFullDate } from "../../utils/dateUtils";
import { Megaphone, CheckCircle2, X, Wrench, AlertCircle, Sparkles } from "lucide-react";

interface MaintenancePopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemSettings: SystemSettings;
  todayStr: string;
}

export const MaintenancePopupModal: React.FC<MaintenancePopupModalProps> = ({
  isOpen,
  onClose,
  systemSettings,
  todayStr
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-400 space-y-5 animate-scale-up relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-orange-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-amber-100 pb-3.5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
              <Megaphone className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                  ⚡ แจ้งการปรับปรุงระบบ
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                  {formatThaiFullDate(todayStr)}
                </span>
              </div>
              <h3 className="text-base font-black text-gray-900 mt-1 truncate">
                {systemSettings.maintenanceTitle || "แจ้งการปรับปรุงระบบและข่าวสาร"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Content Body */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200 space-y-3 shadow-2xs max-h-[50vh] overflow-y-auto">
          <div className="flex items-center gap-2 font-black text-amber-950 text-xs border-b border-amber-200/70 pb-2">
            <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
            <span>รายละเอียดการปรับปรุง / ข้อมูลสำคัญ:</span>
          </div>
          <div className="text-xs text-amber-950 font-medium leading-relaxed whitespace-pre-line break-words pl-1">
            {systemSettings.maintenanceMessage || "ระบบได้รับการปรับปรุงและอัปเดตเพื่อประสิทธิภาพสูงสุดในการใช้งาน"}
          </div>
        </div>

        {/* System & School Sub-Note */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-slate-600 text-[11px]">
          <Sparkles className="w-4 h-4 text-[#A05AFF] shrink-0" />
          <div className="truncate">
            <strong>{systemSettings.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน"}</strong> • {systemSettings.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล"}
          </div>
        </div>

        {/* Confirm Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>รับทราบข้อมูล (เข้าสู่หน้าระบบ)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
