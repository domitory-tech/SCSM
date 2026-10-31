import React, { useState } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  formatThaiFullDate,
  getNextDateString,
  getTodayDateString,
  isDormAttendancePaused
} from "../../utils/dateUtils";
import { getDormTypeBadgeStyle, getDormTypeLabel } from "../../utils/dormUtils";
import { useBatchSetAttendanceDateRangeMutation } from "../../services/useDormQueries";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Home,
  Info,
  Layers,
  Lock,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  School,
  Shield,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Users,
  X
} from "lucide-react";

export type AttendanceControlTab = "DATE_RANGE" | "HOME_BREAK" | "PAUSE_RESUME";

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
  onBatchSetDateRange?: (payload: {
    startDate: string;
    endDate: string;
    dormIds: string[] | "ALL";
    status: "HOME_BREAK" | "SEMESTER_BREAK" | "PRESENT" | "CLEAR";
    orientationNotes?: string[];
  }) => Promise<{ affectedDatesCount: number; affectedRecordsCount: number; message: string }>;
  initialTab?: AttendanceControlTab;
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
  onBatchSetDateRange,
  initialTab = "DATE_RANGE"
}) => {
  const [activeTab, setActiveTab] = useState<AttendanceControlTab>(initialTab);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>(
    systemSettings.attendancePauseReason || "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmBulkHomeBreakMode, setConfirmBulkHomeBreakMode] = useState<"SET_HOME_BREAK" | "REVERT_NORMAL" | null>(null);

  // -------------------------------------------------------------------------
  // State for Date Range Attendance Setting (Manual Staff Assignment)
  // -------------------------------------------------------------------------
  const [rangeStartDate, setRangeStartDate] = useState<string>(selectedDate || getTodayDateString());
  const [rangeEndDate, setRangeEndDate] = useState<string>(selectedDate || getTodayDateString());
  const [selectedDormIds, setSelectedDormIds] = useState<string[]>(dorms.map((d) => d.id));
  const [targetStatus, setTargetStatus] = useState<"HOME_BREAK" | "SEMESTER_BREAK" | "PRESENT" | "CLEAR">("HOME_BREAK");
  const [orientationNoteText, setOrientationNoteText] = useState<string>("");
  const [confirmDateRangeOpen, setConfirmDateRangeOpen] = useState(false);
  const [dateRangeSuccessMsg, setDateRangeSuccessMsg] = useState<string | null>(null);

  const batchMutation = useBatchSetAttendanceDateRangeMutation();

  // Sync state when modal opens or initialTab/selectedDate changes
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setConfirmBulkHomeBreakMode(null);
      setConfirmDateRangeOpen(false);
      setDateRangeSuccessMsg(null);
      if (selectedDate) {
        setRangeStartDate(selectedDate);
        setRangeEndDate(selectedDate);
      }
      setSelectedDormIds(dorms.map((d) => d.id));
    }
  }, [isOpen, initialTab, selectedDate, dorms]);

  // Sync pauseReasonInput when systemSettings changes
  React.useEffect(() => {
    if (systemSettings.attendancePauseReason) {
      setPauseReasonInput(systemSettings.attendancePauseReason);
    }
  }, [systemSettings.attendancePauseReason]);

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

  // Calculate day count between rangeStartDate and rangeEndDate
  const calculateDaysCount = (start: string, end: string): number => {
    if (!start || !end || start > end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDaysCount(rangeStartDate, rangeEndDate);

  // Quick Preset Helper for Date Range
  const handleApplyPreset = (daysAhead: number) => {
    const start = rangeStartDate || selectedDate || getTodayDateString();
    let curr = start;
    for (let i = 1; i < daysAhead; i++) {
      curr = getNextDateString(curr);
    }
    setRangeEndDate(curr);
  };

  // Dorm Selection helpers
  const isAllDormsSelected = dorms.length > 0 && selectedDormIds.length === dorms.length;

  const handleToggleSelectAllDorms = () => {
    if (isAllDormsSelected) {
      setSelectedDormIds([]);
    } else {
      setSelectedDormIds(dorms.map((d) => d.id));
    }
  };

  const handleToggleDormSelection = (dormId: string) => {
    setSelectedDormIds((prev) =>
      prev.includes(dormId) ? prev.filter((id) => id !== dormId) : [...prev, dormId]
    );
  };

  // Execute Date-Range Attendance Check
  const handleExecuteDateRangeCheck = async () => {
    if (!rangeStartDate || !rangeEndDate || rangeStartDate > rangeEndDate) {
      alert("กรุณาระบุช่วงวันที่ให้ถูกต้อง");
      return;
    }
    if (selectedDormIds.length === 0) {
      alert("กรุณาเลือกหอพักอย่างน้อย 1 หอพัก");
      return;
    }

    setIsUpdating(true);
    setDateRangeSuccessMsg(null);
    try {
      const notes = orientationNoteText.trim() ? [orientationNoteText.trim()] : [];
      let resMessage = "";

      if (onBatchSetDateRange) {
        const res = await onBatchSetDateRange({
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          dormIds: selectedDormIds.length === dorms.length ? "ALL" : selectedDormIds,
          status: targetStatus,
          orientationNotes: notes
        });
        resMessage = res.message;
      } else {
        const res = await batchMutation.mutateAsync({
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          dormIds: selectedDormIds.length === dorms.length ? "ALL" : selectedDormIds,
          status: targetStatus,
          orientationNotes: notes,
          operatorName: currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่",
          dorms,
          students
        });
        resMessage = res.message;
      }

      setDateRangeSuccessMsg(resMessage || "บันทึกสถานะตามช่วงวันที่ระบุเรียบร้อยแล้ว");
      setConfirmDateRangeOpen(false);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (err.message || String(err)));
    } finally {
      setIsUpdating(false);
    }
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

      if (isGlobalPaused) {
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
        isAttendancePaused: false,
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
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight text-white">
                  แผงควบคุมระบบการเช็คยอดนักเรียน
                </h3>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  เฉพาะเจ้าหน้าที่ & ผู้ดูแลระบบ
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                กำหนดสถานะตามช่วงวัน (เจ้าหน้าที่กำหนดเอง) / ปิดเปิดรอบกลับบ้าน / จัดการหยุดเช็คยอด
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

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0 gap-2 overflow-x-auto">
          {/* TAB 1: DATE RANGE BATCH CHECK (PRIMARY) */}
          <button
            type="button"
            onClick={() => setActiveTab("DATE_RANGE")}
            className={`pb-3 px-3.5 text-xs font-black transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "DATE_RANGE"
                ? "border-indigo-600 text-indigo-700 bg-white/60 rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarRange className="w-4 h-4 text-indigo-600" />
            <span>1. กำหนดสถานะตามช่วงวัน (เลือกวันที่ - สิ้นสุด)</span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.2 rounded-full font-black">
              เจ้าหน้าที่กำหนดเอง
            </span>
          </button>

          {/* TAB 2: HOME BREAK */}
          <button
            type="button"
            onClick={() => setActiveTab("HOME_BREAK")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "HOME_BREAK"
                ? "border-amber-500 text-amber-700 bg-white/60 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Home className="w-4 h-4 text-amber-600" />
            <span>2. รอบกลับบ้านด่วน (เฉพาะวันที่เลือก)</span>
            {homeBreakDormsCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {homeBreakDormsCount}/{dorms.length} หอ
              </span>
            )}
          </button>

          {/* TAB 3: PAUSE RESUME */}
          <button
            type="button"
            onClick={() => setActiveTab("PAUSE_RESUME")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "PAUSE_RESUME"
                ? "border-[#A05AFF] text-[#A05AFF] bg-white/60 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PauseCircle className="w-4 h-4 text-purple-600" />
            <span>3. ระบบหยุด / เปิดเช็คยอดชั่วคราว</span>
            {(isGlobalPaused || pausedDormIds.length > 0) && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {isGlobalPaused ? "หยุดทุกหอ" : `หยุด ${pausedDormIds.length} หอ`}
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ======================================================================= */}
          {/* TAB 1: DATE RANGE MANUAL ATTENDANCE (CORE USER REQUEST)                  */}
          {/* ======================================================================= */}
          {activeTab === "DATE_RANGE" && (
            <div className="space-y-6 animate-fade-in">
              {/* Notice Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 leading-relaxed">
                  <p className="font-bold text-indigo-900">
                    ระบบยกเลิกการเช็คยอดอัตโนมัติเรียบร้อยแล้ว:
                  </p>
                  <p className="text-indigo-800 mt-0.5">
                    เจ้าหน้าที่สามารถกำหนดสถานะการเช็คยอดตามช่วงวันที่ต้องการได้ด้วยตนเอง
                    เช่น กำหนดช่วงวัน <strong>"รอบกลับบ้าน"</strong> สำหรับวันหยุดยาว หรือ <strong>"ปิดภาคเรียน"</strong> สำหรับช่วงปิดเทอม
                    ระบบจะบันทึกสถานะให้ตรงตามที่เจ้าหน้าที่ระบุ โดยไม่มีการแก้ไขหรือส่งต่ออัตโนมัติเองในภายหลัง
                  </p>
                </div>
              </div>

              {/* Success Alert */}
              {dateRangeSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">{dateRangeSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDateRangeSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline cursor-pointer"
                  >
                    ปิดแจ้งเตือน
                  </button>
                </div>
              )}

              {/* Step 1: Select Date Range */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      ขั้นตอนที่ 1: เลือกช่วงวันที่ (วันที่เริ่มต้น - วันที่สิ้นสุด)
                    </h4>
                  </div>
                  {daysCount > 0 ? (
                    <span className="text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                      รวม {daysCount} วัน ({formatThaiFullDate(rangeStartDate)} ถึง {formatThaiFullDate(rangeEndDate)})
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full">
                      วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      📅 วันที่เริ่มต้น:
                    </label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      ไทย: {formatThaiFullDate(rangeStartDate)}
                    </p>
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      📅 วันที่สิ้นสุด:
                    </label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      ไทย: {formatThaiFullDate(rangeEndDate)}
                    </p>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    ปุ่มเลือกด่วน:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStartDate(selectedDate || getTodayDateString());
                      setRangeEndDate(selectedDate || getTodayDateString());
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer shadow-2xs"
                  >
                    1 วัน (เฉพาะวันนี้)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(3)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                  >
                    3 วัน (รวมสุดสัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(5)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                  >
                    5 วัน (วันธรรมดา)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(7)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                  >
                    7 วัน (1 สัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(14)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                  >
                    14 วัน (2 สัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 transition-all cursor-pointer shadow-2xs"
                  >
                    30 วัน (ปิดภาคเรียน 1 เดือน)
                  </button>
                </div>
              </div>

              {/* Step 2: Select Dormitories */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      ขั้นตอนที่ 2: เลือกหอพักที่ต้องการดำเนินการ
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllDorms}
                      className="px-3 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                    >
                      {isAllDormsSelected ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>เลือกครบทุกหอแล้ว (คลิกเพื่อล้าง)</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>เลือกทุกหอพัก (หอ 1 - 6)</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      ({selectedDormIds.length}/{dorms.length} หอ)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {dorms.map((dorm) => {
                    const isSelected = selectedDormIds.includes(dorm.id);
                    const dormStudentCount = students.filter((s) => {
                      const sDormId = String(s.dormId || "").trim();
                      const dNum = dorm.id.replace(/\D/g, "");
                      const sNum = sDormId.replace(/\D/g, "");
                      return sDormId === dorm.id || sDormId === dorm.name || (dNum && sNum && dNum === sNum);
                    }).length;

                    return (
                      <div
                        key={dorm.id}
                        onClick={() => handleToggleDormSelection(dorm.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-400"
                            : "bg-white border-slate-200 hover:border-slate-300 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-xs text-slate-900">{dorm.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${getDormTypeBadgeStyle(dorm)}`}>
                            {getDormTypeLabel(dorm, true)}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">เด็ก: {dormStudentCount} คน</span>
                          <span className={`font-black text-xs ${isSelected ? "text-indigo-600" : "text-slate-400"}`}>
                            {isSelected ? "✓ เลือก" : "+ เลือก"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Select Attendance Status */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-900">
                    ขั้นตอนที่ 3: เลือกสถานะที่ต้องการกำหนด (เจ้าหน้าที่ระบุเอง)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Status 1: HOME_BREAK */}
                  <div
                    onClick={() => setTargetStatus("HOME_BREAK")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      targetStatus === "HOME_BREAK"
                        ? "bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-400"
                        : "bg-white border-slate-200 hover:border-amber-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Home className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-black text-xs sm:text-sm text-slate-900">
                              🏡 รอบกลับบ้าน
                            </h5>
                            <span className="text-[10px] font-bold text-amber-700">HOME_BREAK / ROUND_HOME</span>
                          </div>
                        </div>
                        {targetStatus === "HOME_BREAK" && (
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        บันทึกสถานะหอพักเป็น "รอบกลับบ้าน" และนักเรียนทุกคนในหอพักจะถูกบันทึกเป็น <strong>รอบกลับบ้าน (ROUND_HOME)</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status 2: SEMESTER_BREAK */}
                  <div
                    onClick={() => setTargetStatus("SEMESTER_BREAK")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      targetStatus === "SEMESTER_BREAK"
                        ? "bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-400"
                        : "bg-white border-slate-200 hover:border-blue-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                            <School className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-black text-xs sm:text-sm text-slate-900">
                              🏖️ ปิดภาคเรียน
                            </h5>
                            <span className="text-[10px] font-bold text-blue-700">SEMESTER_BREAK</span>
                          </div>
                        </div>
                        {targetStatus === "SEMESTER_BREAK" && (
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        บันทึกสถานะหอพักเป็น "ปิดภาคเรียน" และนักเรียนทุกคนในหอพักจะถูกบันทึกเป็น <strong>ปิดภาคเรียน (SEMESTER_BREAK)</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status 3: PRESENT */}
                  <div
                    onClick={() => setTargetStatus("PRESENT")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      targetStatus === "PRESENT"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400"
                        : "bg-white border-slate-200 hover:border-emerald-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-black text-xs sm:text-sm text-slate-900">
                              🟢 เช็คยอดตามปกติ
                            </h5>
                            <span className="text-[10px] font-bold text-emerald-700">เช็คยอดตามปกติ (PRESENT)</span>
                          </div>
                        </div>
                        {targetStatus === "PRESENT" && (
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        บันทึกการเช็คยอดว่านักเรียนทุกคน <strong>เช็คยอดตามปกติ (PRESENT)</strong> พร้อมบันทึกชื่อเจ้าหน้าที่ผู้ดำเนินการ
                      </p>
                    </div>
                  </div>

                  {/* Status 4: CLEAR */}
                  <div
                    onClick={() => setTargetStatus("CLEAR")}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      targetStatus === "CLEAR"
                        ? "bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-400"
                        : "bg-white border-slate-200 hover:border-rose-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-black text-xs sm:text-sm text-slate-900">
                              🗑️ ล้างข้อมูลช่วงวัน / ยกเลิกการเช็คยอด
                            </h5>
                            <span className="text-[10px] font-bold text-rose-700">CLEAR / PENDING</span>
                          </div>
                        </div>
                        {targetStatus === "CLEAR" && (
                          <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        ลบข้อมูลการเช็คยอดช่วงวันที่ระบุออกจากระบบ และคืนสถานะเป็น <strong>รอการเช็คยอด</strong> เพื่อให้ครูหอพักเช็คใหม่ได้
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional orientation notes input */}
                {targetStatus !== "CLEAR" && (
                  <div className="pt-2 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ข้อความบันทึกการอบรม / หมายเหตุประจำช่วงวัน (ไม่บังคับ):
                    </label>
                    <input
                      type="text"
                      value={orientationNoteText}
                      onChange={(e) => setOrientationNoteText(e.target.value)}
                      placeholder={
                        targetStatus === "HOME_BREAK"
                          ? "เช่น รอบกลับบ้านประจำสัปดาห์ / วันหยุดยาว"
                          : targetStatus === "SEMESTER_BREAK"
                          ? "เช่น ปิดภาคเรียนที่ 1 ประจำปีการศึกษา 2569"
                          : "ข้อความเพิ่มเติม"
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Step 4: Summary & Confirm Button */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="space-y-1">
                  <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
                    สรุปคำสั่งดำเนินการ:
                  </div>
                  <div className="text-sm font-black text-white">
                    กำหนดสถานะเป็น:{" "}
                    <span className="text-amber-300">
                      {targetStatus === "HOME_BREAK"
                        ? "🏡 รอบกลับบ้าน"
                        : targetStatus === "SEMESTER_BREAK"
                        ? "🏖️ ปิดภาคเรียน"
                        : targetStatus === "PRESENT"
                        ? "🟢 เช็คยอดตามปกติ"
                        : "🗑️ ล้างข้อมูลช่วงวัน"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    ช่วงวัน: <strong>{formatThaiFullDate(rangeStartDate)}</strong> ถึง <strong>{formatThaiFullDate(rangeEndDate)}</strong> ({daysCount} วัน)
                    {" • "}
                    หอพัก: <strong>{selectedDormIds.length}</strong> หอพัก
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDateRangeOpen(true)}
                  disabled={isUpdating || daysCount <= 0 || selectedDormIds.length === 0}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>ตรวจสอบและบันทึกสถานะช่วงวัน</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: BULK HOME BREAK CONTROLS (QUICK FOR TODAY/SELECTED DATE)         */}
          {/* ======================================================================= */}
          {activeTab === "HOME_BREAK" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-100/30 p-5 rounded-2xl border-2 border-amber-300 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-amber-700" />
                    <h4 className="text-base font-black text-amber-950">
                      ปุ่มสถานะรอบกลับบ้านด่วน (เฉพาะวันที่เลือก)
                    </h4>
                  </div>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider self-start sm:self-auto">
                    คลิกเดียวทุกหอพัก
                  </span>
                </div>

                <div className="text-xs text-amber-950 leading-relaxed space-y-2">
                  <p>
                    <strong>คำอธิบายระบบ:</strong> เมื่อถึงวันสุดสัปดาห์หรือวันรอบกลับบ้าน
                    ผู้ดูแลหรือเจ้าหน้าที่สามารถคลิกปุ่มเพื่อเปลี่ยนสถานะของ <strong>นักเรียนทุกหอพัก (หอพัก 1 ถึง 6)</strong> ให้เป็นสถานะ <code className="bg-amber-200 px-1.5 py-0.5 rounded font-bold text-amber-900">รอบกลับบ้าน</code> ทันที
                  </p>
                  <p className="text-amber-800">
                    💡 <em>หากต้องการกำหนดล่วงหน้าหลายวันหรือกำหนดช่วงวันที่ ให้ใช้แท็บ <strong>"1. กำหนดสถานะตามช่วงวัน"</strong> ด้านบน</em>
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
                  <button
                    type="button"
                    onClick={() => setConfirmBulkHomeBreakMode("SET_HOME_BREAK")}
                    disabled={isUpdating}
                    className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Home className="w-5 h-5 text-white" />
                    <span>เปลี่ยนสถานะทุกหอพักเป็น "รอบกลับบ้าน" (เฉพาะวันนี้)</span>
                  </button>

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

          {/* ======================================================================= */}
          {/* TAB 3: PAUSE / RESUME CONTROLS                                          */}
          {/* ======================================================================= */}
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
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            วันที่ปัจจุบัน: <strong>{formatThaiFullDate(selectedDate)}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

        {/* Inner Confirmation Modal for Date Range Attendance */}
        {confirmDateRangeOpen && (
          <div className="absolute inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  targetStatus === "HOME_BREAK"
                    ? "bg-amber-100 text-amber-700"
                    : targetStatus === "SEMESTER_BREAK"
                    ? "bg-blue-100 text-blue-700"
                    : targetStatus === "PRESENT"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}>
                  {targetStatus === "HOME_BREAK" ? (
                    <Home className="w-6 h-6" />
                  ) : targetStatus === "SEMESTER_BREAK" ? (
                    <School className="w-6 h-6" />
                  ) : targetStatus === "PRESENT" ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Trash2 className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    ยืนยันการบันทึกสถานะตามช่วงวัน
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    โดยเจ้าหน้าที่: {currentUser?.name || "เจ้าหน้าที่"}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">ช่วงวันที่:</span>
                  <span className="font-bold text-slate-900">
                    {formatThaiFullDate(rangeStartDate)} ถึง {formatThaiFullDate(rangeEndDate)} ({daysCount} วัน)
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">หอพักที่ดำเนินการ:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDormIds.length === dorms.length ? "ทุกหอพัก (หอ 1 - 6)" : `${selectedDormIds.length} หอพัก`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">สถานะที่จะบันทึก:</span>
                  <span className={`font-black ${
                    targetStatus === "HOME_BREAK"
                      ? "text-amber-700"
                      : targetStatus === "SEMESTER_BREAK"
                      ? "text-blue-700"
                      : targetStatus === "PRESENT"
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}>
                    {targetStatus === "HOME_BREAK"
                      ? "🏡 รอบกลับบ้าน (ROUND_HOME)"
                      : targetStatus === "SEMESTER_BREAK"
                      ? "🏖️ ปิดภาคเรียน (SEMESTER_BREAK)"
                      : targetStatus === "PRESENT"
                      ? "🟢 เช็คยอดตามปกติ"
                      : "🗑️ ล้างข้อมูลช่วงวัน (PENDING)"}
                  </span>
                </div>
                {orientationNoteText.trim() && (
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500 font-semibold">หมายเหตุ:</span>
                    <span className="font-medium text-slate-800 text-right">{orientationNoteText.trim()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDateRangeOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDateRangeCheck}
                  disabled={isUpdating}
                  className={`px-5 py-2.5 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                    targetStatus === "HOME_BREAK"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : targetStatus === "SEMESTER_BREAK"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : targetStatus === "PRESENT"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isUpdating ? "กำลังบันทึก..." : "ยืนยันดำเนินการทันที"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inner Confirmation Modal for Bulk Home Break (Today) */}
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
