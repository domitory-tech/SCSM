import React, { useState } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import { formatThaiFullDate, getTodayDateString, isDormAttendancePaused } from "../../utils/dateUtils";
import { getDormTypeBadgeStyle, getDormTypeLabel } from "../../utils/dormUtils";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Home,
  Layers,
  Lock,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Shield,
  Sparkles,
  Unlock,
  Users,
  X
} from "lucide-react";

interface AttendanceControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  dorms: Dormitory[];
  students: Student[];
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (settings: SystemSettings) => Promise<void> | void;
  currentUser?: UserProfile | null;
  selectedDate: string;
  activeAttendanceMap: Record<string, DailyAttendance>;
  onBulkHomeBreak: (mode: "SET_HOME_BREAK" | "REVERT_NORMAL") => Promise<void>;
  initialTab?: "PAUSE_RESUME" | "HOME_BREAK";
}

export const AttendanceControlModal: React.FC<AttendanceControlModalProps> = ({
  isOpen,
  onClose,
  dorms,
  students,
  systemSettings,
  onUpdateSystemSettings,
  currentUser,
  selectedDate,
  activeAttendanceMap,
  onBulkHomeBreak,
  initialTab = "PAUSE_RESUME"
}) => {
  const [activeTab, setActiveTab] = useState<"PAUSE_RESUME" | "HOME_BREAK">(initialTab);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>(
    systemSettings.attendancePauseReason || "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmBulkHomeBreakMode, setConfirmBulkHomeBreakMode] = useState<"SET_HOME_BREAK" | "REVERT_NORMAL" | null>(null);

  // Sync pauseReasonInput when systemSettings changes
  React.useEffect(() => {
    if (systemSettings.attendancePauseReason) {
      setPauseReasonInput(systemSettings.attendancePauseReason);
    }
  }, [systemSettings.attendancePauseReason]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setConfirmBulkHomeBreakMode(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isGlobalPaused = Boolean(systemSettings.isAttendancePaused);
  const pausedDormIds = Array.isArray(systemSettings.pausedDormIds) ? systemSettings.pausedDormIds : [];

  // Count how many dorms are in Home Break today
  const homeBreakDormsCount = dorms.filter((d) => {
    const att = activeAttendanceMap[d.id];
    return att && (att.isHomeBreak || att.status === "HOME_BREAK");
  }).length;
  const isAllHomeBreak = dorms.length > 0 && homeBreakDormsCount === dorms.length;

  const formatNowThai = () => {
    const now = new Date();
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} น.`;
  };

  // 1. Toggle Global Pause (ทุกหอพัก)
  const handleToggleGlobalPause = async (pause: boolean) => {
    setIsUpdating(true);
    try {
      const nowStr = formatNowThai();
      const updated: SystemSettings = {
        ...systemSettings,
        isAttendancePaused: pause,
        attendancePauseReason: pauseReasonInput.trim() || systemSettings.attendancePauseReason,
        attendancePausedAt: pause ? nowStr : undefined,
        attendancePausedBy: pause ? currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่" : undefined,
        // When unpausing all, also clear individual paused list so everything opens cleanly
        pausedDormIds: pause ? pausedDormIds : []
      };
      await onUpdateSystemSettings(updated);
    } finally {
      setIsUpdating(false);
    }
  };

  // 2. Toggle Individual Dorm Pause (แยกตามหอพัก)
  const handleToggleDormPause = async (dormId: string) => {
    setIsUpdating(true);
    try {
      const nowStr = formatNowThai();
      let newPausedList: string[] = [];

      // If currently global pause is ON and user toggles an individual dorm:
      // It means they want specific control, so we switch off global pause and keep all other dorms paused except this one, or vice-versa!
      if (isGlobalPaused) {
        // All dorms were paused, unpausing this specific dorm means others stay paused
        newPausedList = dorms.map((d) => d.id).filter((id) => id !== dormId);
      } else {
        const isCurrentlyPaused = pausedDormIds.includes(dormId);
        if (isCurrentlyPaused) {
          newPausedList = pausedDormIds.filter((id) => id !== dormId);
        } else {
          newPausedList = [...pausedDormIds, dormId];
        }
      }

      const updated: SystemSettings = {
        ...systemSettings,
        isAttendancePaused: false, // Per-dorm precision mode
        pausedDormIds: newPausedList,
        attendancePauseReason: pauseReasonInput.trim() || systemSettings.attendancePauseReason,
        attendancePausedAt: newPausedList.length > 0 ? nowStr : undefined,
        attendancePausedBy: newPausedList.length > 0 ? currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่" : undefined
      };
      await onUpdateSystemSettings(updated);
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. Save Custom Pause Reason
  const handleSaveReason = async () => {
    setIsUpdating(true);
    try {
      const updated: SystemSettings = {
        ...systemSettings,
        attendancePauseReason: pauseReasonInput.trim()
      };
      await onUpdateSystemSettings(updated);
    } finally {
      setIsUpdating(false);
    }
  };

  // 4. Handle Bulk Home Break
  const handleExecuteBulkHomeBreak = async (mode: "SET_HOME_BREAK" | "REVERT_NORMAL") => {
    setIsUpdating(true);
    try {
      await onBulkHomeBreak(mode);
      setConfirmBulkHomeBreakMode(null);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight text-white">
                  แผงควบคุมระบบเช็คยอดนักเรียน
                </h3>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  เฉพาะผู้ดูแล & เจ้าหน้าที่
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                จัดการหยุดเช็คยอดชั่วคราว / เปิดระบบ (ทุกหอ & แยกหอ) และสถานะรอบกลับบ้าน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("PAUSE_RESUME")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "PAUSE_RESUME"
                ? "border-[#A05AFF] text-[#A05AFF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PauseCircle className="w-4 h-4" />
            <span>1. ระบบหยุด / เปิดเช็คยอดชั่วคราว</span>
            {(isGlobalPaused || pausedDormIds.length > 0) && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {isGlobalPaused ? "หยุดทุกหอ" : `หยุด ${pausedDormIds.length} หอ`}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HOME_BREAK")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "HOME_BREAK"
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Home className="w-4 h-4" />
            <span>2. ปุ่มสถานะรอบกลับบ้าน (ทุกหอพัก)</span>
            {homeBreakDormsCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {homeBreakDormsCount}/{dorms.length} หอ
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PAUSE / RESUME CONTROLS */}
          {activeTab === "PAUSE_RESUME" && (
            <div className="space-y-6 animate-fade-in">
              {/* SECTION A: ควบคุมทุกหอพักพร้อมกัน (GLOBAL CONTROLS) */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      ก. ควบคุมระบบเช็คยอด "ทุกหอพักพร้อมกัน" (คลิกเดียว)
                    </h4>
                  </div>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                    isGlobalPaused
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : pausedDormIds.length > 0
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}>
                    {isGlobalPaused
                      ? "⛔ สถานะ: หยุดเช็คยอดทุกหอพัก"
                      : pausedDormIds.length > 0
                      ? `⚠️ สถานะ: หยุดเช็คยอดเฉพาะบางหอพัก (${pausedDormIds.length} หอพัก)`
                      : "🟢 สถานะ: เปิดระบบเช็คยอดปกติทุกหอพัก"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  คลิกปุ่มด้านล่างเพื่อหยุดการเช็คยอดชั่วคราวพร้อมกันทุกหอพักทันที (เช่น ช่วงที่มีการนำเข้านักเรียนใหม่, ปรับปรุงรายชื่อนักเรียน หรือย้ายหอพัก)
                </p>

                {/* 2 Primary One-Click Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Button 1: หยุดเช็คยอดทุกหอพัก */}
                  <button
                    type="button"
                    onClick={() => handleToggleGlobalPause(true)}
                    disabled={isUpdating || isGlobalPaused}
                    className={`p-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isGlobalPaused
                        ? "bg-rose-600 text-white ring-2 ring-rose-400"
                        : "bg-white hover:bg-rose-50 text-rose-700 border-2 border-rose-300 hover:border-rose-400"
                    }`}
                  >
                    <PauseCircle className="w-5 h-5 text-rose-600" />
                    <span>⛔ หยุดเช็คยอดชั่วคราวทุกหอพัก (คลิกเดียว)</span>
                  </button>

                  {/* Button 2: เปิดระบบเช็คยอดทุกหอพัก */}
                  <button
                    type="button"
                    onClick={() => handleToggleGlobalPause(false)}
                    disabled={isUpdating || (!isGlobalPaused && pausedDormIds.length === 0)}
                    className={`p-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isGlobalPaused && pausedDormIds.length === 0
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                        : "bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-300 hover:border-emerald-400"
                    }`}
                  >
                    <PlayCircle className="w-5 h-5 text-emerald-600" />
                    <span>🟢 เปิดระบบการเช็คยอดทุกหอพัก (คลิกเดียว)</span>
                  </button>
                </div>

                {/* Pause Reason Field */}
                <div className="pt-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ระบุเหตุผลในการหยุดเช็คยอด (แสดงในแถบแจ้งเตือนแก่ครูหอพัก):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pauseReasonInput}
                      onChange={(e) => setPauseReasonInput(e.target.value)}
                      placeholder="เช่น ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-[#A05AFF] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveReason}
                      disabled={isUpdating}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      บันทึกเหตุผล
                    </button>
                  </div>
                  {systemSettings.attendancePausedAt && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      บันทึกล่าสุดเมื่อ: {systemSettings.attendancePausedAt}
                      {systemSettings.attendancePausedBy ? ` โดย ${systemSettings.attendancePausedBy}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION B: ควบคุมแยกตามหอพัก (INDIVIDUAL DORM CONTROLS) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#A05AFF]" />
                    <h4 className="text-sm font-black text-slate-900">
                      ข. ควบคุมระบบเช็คยอด "แยกตามหอพัก" (หอพัก 1 - 6)
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    คลิกสวิตช์ของแต่ละหอพัก เพื่อเปิดหรือหยุดเช็คยอดเฉพาะหอพักนั้นๆ
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {dorms.map((dorm) => {
                    const isThisDormPaused = isDormAttendancePaused(dorm.id, systemSettings);
                    const isPausedByGlobal = isGlobalPaused;
                    const dormStudentCount = students.filter((s) => {
                      const sDormId = String(s.dormId || "").trim();
                      const dNum = dorm.id.replace(/\D/g, "");
                      const sNum = sDormId.replace(/\D/g, "");
                      return sDormId === dorm.id || sDormId === dorm.name || (dNum && sNum && dNum === sNum);
                    }).length;

                    return (
                      <div
                        key={dorm.id}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isThisDormPaused
                            ? "bg-rose-50/70 border-rose-300 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-purple-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-slate-900 text-sm">{dorm.name}</h5>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${getDormTypeBadgeStyle(dorm)}`}>
                                {getDormTypeLabel(dorm, true)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              นักเรียน {dormStudentCount} คน • ครูประจำหอ: {dorm.teacherName || "-"}
                            </p>
                          </div>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                            isThisDormPaused
                              ? "bg-rose-200 text-rose-900"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}>
                            {isThisDormPaused ? (
                              <>
                                <Lock className="w-3 h-3 text-rose-700" />
                                <span>{isPausedByGlobal ? "หยุด (ทุกหอ)" : "หยุดเช็คยอด"}</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>เปิดปกติ</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Toggle Action */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-600">
                            {isThisDormPaused ? "หอพักนี้ถูกปิดการเช็คยอด" : "ครูหอพักเช็คยอดได้ตามปกติ"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleDormPause(dorm.id)}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs ${
                              isThisDormPaused
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-rose-600 hover:bg-rose-700 text-white"
                            }`}
                          >
                            {isThisDormPaused ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>เปิดระบบหอนี้</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>หยุดเช็คยอดหอนี้</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BULK HOME BREAK CONTROLS */}
          {activeTab === "HOME_BREAK" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-100/30 p-5 rounded-2xl border-2 border-amber-300 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-amber-700" />
                    <h4 className="text-base font-black text-amber-950">
                      ปุ่มสถานะรอบกลับบ้าน (ทุกหอพัก)
                    </h4>
                  </div>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider self-start sm:self-auto">
                    คลิกเดียวเปลี่ยนทุกหอพัก
                  </span>
                </div>

                <div className="text-xs text-amber-950 leading-relaxed space-y-2">
                  <p>
                    <strong>คำอธิบายระบบ:</strong> เมื่อถึงวันสุดสัปดาห์หรือวันรอบกลับบ้านของโรงเรียน
                    ผู้ดูแลหรือเจ้าหน้าที่สามารถคลิกปุ่มเดียวเพื่อเปลี่ยนสถานะของ <strong>นักเรียนทุกหอพัก (หอพัก 1 ถึง 6)</strong> ให้เป็นสถานะ <code className="bg-amber-200 px-1.5 py-0.5 rounded font-bold text-amber-900">รอบกลับบ้าน</code> ทันที
                  </p>
                  <p className="text-amber-800">
                    💡 <em>หมายเหตุ: ในส่วนของครูประจำหอพักแต่ละท่าน ยังคงมีปุ่มเปิด/ปิดรอบกลับบ้านเฉพาะหอพักของตนเองในหน้าเช็คยอดตามเดิม ไม่มีการเปลี่ยนแปลง</em>
                  </p>
                </div>

                {/* Status Summary */}
                <div className="bg-white/90 p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-extrabold text-slate-800">
                      สถานะรอบกลับบ้านประจำวันที่ {formatThaiFullDate(selectedDate)}:
                    </div>
                    <div className="text-slate-600 mt-0.5 font-medium">
                      มีหอพักที่อยู่ในสถานะรอบกลับบ้าน: <strong className="text-amber-700 font-black">{homeBreakDormsCount}</strong> จากทั้งหมด <strong>{dorms.length}</strong> หอพัก
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black self-start sm:self-auto ${
                    isAllHomeBreak
                      ? "bg-amber-500 text-white"
                      : homeBreakDormsCount > 0
                      ? "bg-amber-200 text-amber-900"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    {isAllHomeBreak
                      ? "✓ ทุกหอพักเป็นรอบกลับบ้านแล้ว"
                      : homeBreakDormsCount > 0
                      ? `เปิดรอบกลับบ้าน ${homeBreakDormsCount} หอพัก`
                      : "สถานะวันปกติ (ยังไม่เปิดรอบกลับบ้าน)"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Button A: เปลี่ยนทุกหอพักเป็นรอบกลับบ้าน */}
                  <button
                    type="button"
                    onClick={() => setConfirmBulkHomeBreakMode("SET_HOME_BREAK")}
                    disabled={isUpdating}
                    className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Home className="w-5 h-5 text-white" />
                    <span>เปลี่ยนสถานะทุกหอพักเป็น "รอบกลับบ้าน" (คลิกเดียว)</span>
                  </button>

                  {/* Button B: ยกเลิกรอบกลับบ้านทุกหอพัก (คืนค่าปกติ) */}
                  <button
                    type="button"
                    onClick={() => setConfirmBulkHomeBreakMode("REVERT_NORMAL")}
                    disabled={isUpdating || homeBreakDormsCount === 0}
                    className="p-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 font-black text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-5 h-5 text-slate-600" />
                    <span>ยกเลิกรอบกลับบ้านทุกหอพัก (คืนค่าวันปกติ)</span>
                  </button>
                </div>
              </div>

              {/* Dorms List Status Preview */}
              <div className="space-y-3">
                <h5 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                  สถานะการเช็คยอดและรอบกลับบ้านแยกแต่ละหอพัก (วันที่ {formatThaiFullDate(selectedDate)}):
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {dorms.map((dorm) => {
                    const att = activeAttendanceMap[dorm.id];
                    const isDormHome = att && (att.isHomeBreak || att.status === "HOME_BREAK");
                    const dormStudentCount = students.filter((s) => {
                      const sDormId = String(s.dormId || "").trim();
                      const dNum = dorm.id.replace(/\D/g, "");
                      const sNum = sDormId.replace(/\D/g, "");
                      return sDormId === dorm.id || sDormId === dorm.name || (dNum && sNum && dNum === sNum);
                    }).length;

                    return (
                      <div
                        key={dorm.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isDormHome
                            ? "bg-amber-50 border-amber-300 text-amber-950 font-medium"
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900">{dorm.name}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isDormHome
                              ? "bg-amber-500 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}>
                            {isDormHome ? "รอบกลับบ้าน" : "วันปกติ"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          นักเรียน: {dormStudentCount} คน
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            วันที่ทำงาน: <strong>{formatThaiFullDate(selectedDate)}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

        {/* Inner Confirmation Modal for Bulk Home Break */}
        {confirmBulkHomeBreakMode && (
          <div className="absolute inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmBulkHomeBreakMode === "SET_HOME_BREAK"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {confirmBulkHomeBreakMode === "SET_HOME_BREAK" ? (
                    <Home className="w-6 h-6" />
                  ) : (
                    <RotateCcw className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {confirmBulkHomeBreakMode === "SET_HOME_BREAK"
                      ? "ยืนยันเปลี่ยนทุกหอพักเป็น 'รอบกลับบ้าน'?"
                      : "ยืนยันยกเลิกสถานะรอบกลับบ้านทุกหอพัก?"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    สำหรับวันที่ {formatThaiFullDate(selectedDate)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                {confirmBulkHomeBreakMode === "SET_HOME_BREAK" ? (
                  <>
                    ระบบจะบันทึกสถานะการเช็คยอดของ <strong>ทุกหอพัก ({dorms.length} หอพัก)</strong> ในวันที่ {formatThaiFullDate(selectedDate)} ให้เป็น <strong>"รอบกลับบ้าน"</strong> และนักเรียนทุกคนจะถูกปรับสถานะเป็นรอบกลับบ้านโดยอัตโนมัติ
                  </>
                ) : (
                  <>
                    ระบบจะยกเลิกสถานะรอบกลับบ้านของทุกหอพัก และคืนค่าสถานะเป็นวันเช็คยอดปกติ
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmBulkHomeBreakMode(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteBulkHomeBreak(confirmBulkHomeBreakMode)}
                  disabled={isUpdating}
                  className={`px-5 py-2 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm ${
                    confirmBulkHomeBreakMode === "SET_HOME_BREAK"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isUpdating ? "กำลังบันทึก..." : "ยืนยันดำเนินการทันที"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
