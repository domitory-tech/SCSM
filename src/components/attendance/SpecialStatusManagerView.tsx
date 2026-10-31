import React, { useState, useMemo } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  formatThaiFullDate,
  getNextDateString,
  getPreviousDateString,
  getTodayDateString
} from "../../utils/dateUtils";
import { getDormTypeBadgeStyle, getDormTypeLabel } from "../../utils/dormUtils";
import { ThaiDatePicker } from "../common/ThaiDatePicker";
import {
  CalendarRange,
  Calendar,
  Clock,
  Home,
  School,
  Check,
  CheckCircle2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Sparkles,
  Building2,
  CheckSquare,
  Square,
  Info,
  Shield,
  RotateCcw,
  ArrowRight,
  Filter,
  History,
  X,
  Users
} from "lucide-react";

interface SpecialStatusManagerViewProps {
  dorms: Dormitory[];
  students: Student[];
  currentUser: UserProfile | null;
  systemSettings: SystemSettings;
  onUpdateSystemSettings?: (settings: SystemSettings) => Promise<void> | void;
  allAttendanceRecords?: DailyAttendance[];
  onBatchSetDateRange: (payload: {
    startDate: string;
    endDate: string;
    dormIds: string[] | "ALL";
    status: "HOME_BREAK" | "SEMESTER_BREAK" | "PRESENT" | "CLEAR";
    orientationNotes?: string[];
  }) => Promise<{ affectedDatesCount: number; affectedRecordsCount: number; message: string }>;
  onNavigateToDashboard: () => void;
  onNavigateToCheck: (dormId?: string, date?: string) => void;
}

export const SpecialStatusManagerView: React.FC<SpecialStatusManagerViewProps> = ({
  dorms,
  students,
  currentUser,
  systemSettings,
  allAttendanceRecords = [],
  onBatchSetDateRange,
  onNavigateToDashboard,
  onNavigateToCheck
}) => {
  const todayStr = getTodayDateString();

  // Active View Tab: "CREATE" (กำหนดสถานะช่วงวัน) | "SCHEDULE_HISTORY" (ตารางและประวัติที่มีผล)
  const [activeSubTab, setActiveSubTab] = useState<"CREATE" | "SCHEDULE_HISTORY">("CREATE");

  // Form State
  const [rangeStartDate, setRangeStartDate] = useState<string>(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState<string>(todayStr);
  const [selectedDormIds, setSelectedDormIds] = useState<string[]>(dorms.map((d) => d.id));
  const [targetStatus, setTargetStatus] = useState<"HOME_BREAK" | "SEMESTER_BREAK" | "PRESENT" | "CLEAR">("HOME_BREAK");
  const [orientationNoteText, setOrientationNoteText] = useState<string>("");

  // UI Control states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successAlert, setSuccessAlert] = useState<{ message: string; datesCount: number; recordsCount: number } | null>(null);

  // Quick Action Single-Date Clear Modal
  const [clearTargetDate, setClearTargetDate] = useState<string | null>(null);

  // Sync all dorms on load
  React.useEffect(() => {
    if (dorms.length > 0 && selectedDormIds.length === 0) {
      setSelectedDormIds(dorms.map((d) => d.id));
    }
  }, [dorms]);

  // Calculate day count
  const calculateDaysCount = (start: string, end: string): number => {
    if (!start || !end || start > end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDaysCount(rangeStartDate, rangeEndDate);

  // Quick Preset Helper
  const handleApplyPreset = (daysAhead: number) => {
    const start = rangeStartDate || todayStr;
    let curr = start;
    for (let i = 1; i < daysAhead; i++) {
      curr = getNextDateString(curr);
    }
    setRangeEndDate(curr);
  };

  // Preset to this upcoming weekend (Friday - Sunday)
  const handleApplyThisWeekendPreset = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    // calculate days until Friday
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);

    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${date}`;
    };

    setRangeStartDate(formatYMD(friday));
    setRangeEndDate(formatYMD(sunday));
    setTargetStatus("HOME_BREAK");
    setOrientationNoteText("รอบกลับบ้านประจำสัปดาห์ (ศุกร์ - อาทิตย์)");
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

  // Execute Batch Assignment
  const handleExecuteBatch = async () => {
    if (!rangeStartDate || !rangeEndDate || rangeStartDate > rangeEndDate) {
      alert("กรุณาระบุช่วงวันที่ให้ถูกต้อง");
      return;
    }
    if (selectedDormIds.length === 0) {
      alert("กรุณาเลือกหอพักอย่างน้อย 1 หอพัก");
      return;
    }

    setIsSubmitting(true);
    setSuccessAlert(null);
    try {
      const notes = orientationNoteText.trim() ? [orientationNoteText.trim()] : [];
      const res = await onBatchSetDateRange({
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        dormIds: selectedDormIds.length === dorms.length ? "ALL" : selectedDormIds,
        status: targetStatus,
        orientationNotes: notes
      });

      setSuccessAlert({
        message: res.message,
        datesCount: res.affectedDatesCount,
        recordsCount: res.affectedRecordsCount
      });
      setConfirmModalOpen(false);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Clear of a specific date from schedule list
  const handleExecuteClearSingleDate = async (targetDateStr: string) => {
    setIsSubmitting(true);
    try {
      await onBatchSetDateRange({
        startDate: targetDateStr,
        endDate: targetDateStr,
        dormIds: "ALL",
        status: "CLEAR"
      });
      setClearTargetDate(null);
      setSuccessAlert({
        message: `ยกเลิกสถานะพิเศษและคืนค่ารอเช็คยอดสำหรับวันที่ ${formatThaiFullDate(targetDateStr)} เรียบร้อยแล้ว`,
        datesCount: 1,
        recordsCount: dorms.length
      });
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการล้างข้อมูล: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Parse existing Special Statuses from allAttendanceRecords
  // ---------------------------------------------------------------------------
  const specialStatusDatesList = useMemo(() => {
    if (!allAttendanceRecords || allAttendanceRecords.length === 0) return [];

    // Group records by date
    const dateMap: Record<
      string,
      {
        date: string;
        homeBreakDorms: string[];
        semesterBreakDorms: string[];
        checkedByNames: Set<string>;
        notes: Set<string>;
        totalRecords: number;
      }
    > = {};

    allAttendanceRecords.forEach((att) => {
      if (!att || !att.date) return;
      const isHome = att.isHomeBreak || att.status === "HOME_BREAK" || (Array.isArray(att.records) && att.records.length > 0 && att.records.every((r) => r.status === "ROUND_HOME"));
      const isSemester = att.status === "SEMESTER_BREAK" || (Array.isArray(att.records) && att.records.length > 0 && att.records.every((r) => r.status === "SEMESTER_BREAK"));

      if (!isHome && !isSemester) return;

      if (!dateMap[att.date]) {
        dateMap[att.date] = {
          date: att.date,
          homeBreakDorms: [],
          semesterBreakDorms: [],
          checkedByNames: new Set<string>(),
          notes: new Set<string>(),
          totalRecords: 0
        };
      }

      if (isHome) {
        dateMap[att.date].homeBreakDorms.push(att.dormId);
      }
      if (isSemester) {
        dateMap[att.date].semesterBreakDorms.push(att.dormId);
      }
      if (att.checkedBy && !att.checkedBy.includes("ระบบอัตโนมัติ") && att.checkedBy !== "-") {
        dateMap[att.date].checkedByNames.add(att.checkedBy);
      }
      if (Array.isArray(att.teacherOrientationNotes)) {
        att.teacherOrientationNotes.forEach((n) => {
          if (n && n.trim() && n !== "-") dateMap[att.date].notes.add(n.trim());
        });
      }
      dateMap[att.date].totalRecords++;
    });

    // Sort descending by date
    return Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceRecords]);

  // Today Special Status Summary
  const todaySpecialRecord = specialStatusDatesList.find((d) => d.date === todayStr);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-xs">
                <CalendarRange className="w-3.5 h-3.5 text-indigo-300" />
                <span>การจัดการวันหยุดและรอบพิเศษ</span>
              </span>
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                เฉพาะเจ้าหน้าที่ & ผู้ดูแล
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              กำหนดสถานะพิเศษ (รอบกลับบ้าน & ปิดภาคเรียน)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              แยกเมนูพิเศษสำหรับการตั้งค่าวันหยุดยาว รอบกลับบ้านประจำสัปดาห์ และช่วงปิดภาคเรียนตามช่วงวัน
              เจ้าหน้าที่เป็นผู้กำหนดเองอย่างแม่นยำ หมดปัญหาระบบสลับสถานะอัตโนมัติ
            </p>
          </div>

          {/* Quick Info Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col gap-2 shrink-0 min-w-[240px]">
            <div className="text-[11px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>สถานะพิเศษประจำวันนี้</span>
            </div>
            <div className="text-base font-black text-white flex items-center gap-2">
              {todaySpecialRecord ? (
                todaySpecialRecord.homeBreakDorms.length > 0 ? (
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <Home className="w-4 h-4" />
                    <span>รอบกลับบ้าน ({todaySpecialRecord.homeBreakDorms.length}/{dorms.length} หอ)</span>
                  </span>
                ) : (
                  <span className="text-sky-300 flex items-center gap-1.5">
                    <School className="w-4 h-4" />
                    <span>ปิดภาคเรียน ({todaySpecialRecord.semesterBreakDorms.length}/{dorms.length} หอ)</span>
                  </span>
                )
              ) : (
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>วันเปิดเรียนปกติ</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              วันที่: {formatThaiFullDate(todayStr)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab("CREATE")}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
            activeSubTab === "CREATE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          <span>1. กำหนดสถานะตามช่วงวัน (เลือกวันที่ - สิ้นสุด)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("SCHEDULE_HISTORY")}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
            activeSubTab === "SCHEDULE_HISTORY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          <span>2. ตารางและประวัติสถานะพิเศษที่มีผล</span>
          {specialStatusDatesList.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeSubTab === "SCHEDULE_HISTORY" ? "bg-white text-indigo-700" : "bg-indigo-100 text-indigo-800"
            }`}>
              {specialStatusDatesList.length} วัน
            </span>
          )}
        </button>
      </div>

      {/* Success Notification Banner */}
      {successAlert && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-emerald-900">บันทึกข้อมูลเรียบร้อยแล้ว</h4>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">{successAlert.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessAlert(null)}
            className="px-3 py-1.5 rounded-xl bg-emerald-200 hover:bg-emerald-300 text-emerald-900 text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดแจ้งเตือน
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 1: CREATE SPECIAL STATUS BY DATE RANGE                          */}
      {/* ======================================================================= */}
      {activeSubTab === "CREATE" && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Shortcut Buttons Header */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                ปุ่มลัดสำหรับตั้งค่ายอดนิยม (คลิกเดียวกรอกข้อมูลให้อัตโนมัติ):
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleApplyThisWeekendPreset}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-amber-600" />
                    <span>รอบกลับบ้านสุดสัปดาห์นี้</span>
                  </span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                    3 วัน
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  ตั้งค่าทุกหอพักเป็นรอบกลับบ้าน (ศุกร์ - อาทิตย์)
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetStatus("SEMESTER_BREAK");
                  handleApplyPreset(14);
                  setOrientationNoteText("ปิดภาคเรียน (2 สัปดาห์)");
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 border border-sky-300/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-sky-950 flex items-center gap-1.5">
                    <School className="w-4 h-4 text-sky-600" />
                    <span>ปิดภาคเรียน 2 สัปดาห์</span>
                  </span>
                  <span className="text-[10px] font-bold bg-sky-200 text-sky-900 px-2 py-0.5 rounded-md">
                    14 วัน
                  </span>
                </div>
                <p className="text-[11px] text-sky-800 mt-1">
                  ตั้งค่าปิดภาคเรียนต่อเนื่อง 14 วัน สำหรับช่วงปิดเทอม
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetStatus("CLEAR");
                  setRangeStartDate(todayStr);
                  setRangeEndDate(todayStr);
                  setOrientationNoteText("");
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-red-50 hover:from-rose-100 hover:to-red-100 border border-rose-300/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-rose-950 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>ล้างค่า / คืนสู่รอเช็คยอด</span>
                  </span>
                  <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-md">
                    รีเซ็ต
                  </span>
                </div>
                <p className="text-[11px] text-rose-800 mt-1">
                  ล้างเอกสารเช็คยอด คืนค่ารอเช็คยอด (PENDING) ให้ครูหอ
                </p>
              </button>
            </div>
          </div>

          {/* Form Step 1: Select Status */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-black text-slate-900">
                เลือกประเภทสถานะพิเศษที่ต้องการกำหนด
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Option A: HOME_BREAK */}
              <div
                onClick={() => setTargetStatus("HOME_BREAK")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  targetStatus === "HOME_BREAK"
                    ? "bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-400"
                    : "bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-amber-50/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
                      <Home className="w-5 h-5" />
                    </div>
                    {targetStatus === "HOME_BREAK" && (
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-slate-900 text-sm mt-3">
                    🏡 รอบกลับบ้าน
                  </h4>
                  <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                    HOME_BREAK (ROUND_HOME)
                  </span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    บันทึกสถานะหอพักเป็น "รอบกลับบ้าน" และนักเรียนทุกคนในหอพักจะถูกบันทึกเป็น <strong>รอบกลับบ้าน</strong>
                  </p>
                </div>
              </div>

              {/* Option B: SEMESTER_BREAK */}
              <div
                onClick={() => setTargetStatus("SEMESTER_BREAK")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  targetStatus === "SEMESTER_BREAK"
                    ? "bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-400"
                    : "bg-slate-50/70 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
                      <School className="w-5 h-5" />
                    </div>
                    {targetStatus === "SEMESTER_BREAK" && (
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-slate-900 text-sm mt-3">
                    🏖️ ปิดภาคเรียน
                  </h4>
                  <span className="text-[10px] font-bold text-blue-700 block mt-0.5">
                    SEMESTER_BREAK
                  </span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    บันทึกสถานะหอพักเป็น "ปิดภาคเรียน" และนักเรียนทุกคนในหอพักจะถูกบันทึกเป็น <strong>ปิดภาคเรียน</strong>
                  </p>
                </div>
              </div>

              {/* Option C: PRESENT */}
              <div
                onClick={() => {
                  setTargetStatus("PRESENT");
                  setRangeEndDate(rangeStartDate);
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  targetStatus === "PRESENT"
                    ? "bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-400"
                    : "bg-slate-50/70 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                      <Check className="w-5 h-5" />
                    </div>
                    {targetStatus === "PRESENT" && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-slate-900 text-sm mt-3">
                    🟢 เช็คยอดตามปกติ
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                    เช็คยอดตามปกติ (PRESENT)
                  </span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    บันทึกสถานะเปิดเรียนปกติ นักเรียนทุกคน <strong>เช็คยอดตามปกติ (อยู่หอพัก)</strong>
                  </p>
                </div>
              </div>

              {/* Option D: CLEAR */}
              <div
                onClick={() => setTargetStatus("CLEAR")}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  targetStatus === "CLEAR"
                    ? "bg-rose-50/80 border-rose-500 shadow-md ring-2 ring-rose-400"
                    : "bg-slate-50/70 border-slate-200 hover:border-rose-300 hover:bg-rose-50/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-2xs">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    {targetStatus === "CLEAR" && (
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-slate-900 text-sm mt-3">
                    🗑️ ล้างข้อมูลช่วงวัน
                  </h4>
                  <span className="text-[10px] font-bold text-rose-700 block mt-0.5">
                    CLEAR / คืนค่า PENDING
                  </span>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    ลบเอกสารเช็คยอดช่วงวันที่เลือก คืนค่าเป็น <strong>รอเช็คยอด</strong> เพื่อให้ครูหอเช็คใหม่
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Step 2: Select Date (Single Date for PRESENT, or Date Range for others) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  {targetStatus === "PRESENT"
                    ? "เลือกวันที่ดำเนินการ (เช็คยอดตามปกติ 1 วัน - ไม่ต้องเลือกช่วงวัน)"
                    : "เลือกช่วงวันที่ดำเนินการ (วันที่เริ่มต้น - สิ้นสุด)"}
                </h3>
              </div>

              {targetStatus === "PRESENT" ? (
                <span className="text-xs font-black bg-emerald-600 text-white px-3 py-1 rounded-full shadow-xs">
                  เช็คยอดตามปกติวันที่ {formatThaiFullDate(rangeStartDate)} (1 วัน)
                </span>
              ) : daysCount > 0 ? (
                <span className="text-xs font-black bg-indigo-600 text-white px-3 py-1 rounded-full shadow-xs">
                  รวม {daysCount} วัน ({formatThaiFullDate(rangeStartDate)} ถึง {formatThaiFullDate(rangeEndDate)})
                </span>
              ) : (
                <span className="text-xs font-bold bg-rose-100 text-rose-800 px-3 py-1 rounded-full">
                  วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
                </span>
              )}
            </div>

            {targetStatus === "PRESENT" ? (
              /* Single Date Selector for PRESENT - No range needed */
              <div className="space-y-3.5">
                <div className="max-w-md">
                  <ThaiDatePicker
                    label="📅 เลือกวันที่ต้องการเช็คยอดตามปกติ:"
                    value={rangeStartDate}
                    onChange={(val) => {
                      setRangeStartDate(val);
                      setRangeEndDate(val);
                    }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    ไทย: <strong>{formatThaiFullDate(rangeStartDate)}</strong>
                  </p>
                </div>

                {/* Quick Shortcuts for Single Date */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    เลือกด่วน:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStartDate(todayStr);
                      setRangeEndDate(todayStr);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      rangeStartDate === todayStr
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    วันนี้ ({formatThaiFullDate(todayStr, false)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yStr = getPreviousDateString(todayStr);
                      setRangeStartDate(yStr);
                      setRangeEndDate(yStr);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      rangeStartDate === getPreviousDateString(todayStr)
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    เมื่อวานนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nStr = getNextDateString(todayStr);
                      setRangeStartDate(nStr);
                      setRangeEndDate(nStr);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      rangeStartDate === getNextDateString(todayStr)
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    พรุ่งนี้
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>สถานะเช็คยอดตามปกติ (PRESENT):</strong> ไม่ต้องเลือกช่วงวันที่เริ่มต้น-สิ้นสุด ดำเนินการแบบรายวัน (1 วัน) ระบบจะกำหนดสถานะนักเรียนทุกคนในหอพักที่เลือกเป็น <strong>"อยู่หอพักปกติ"</strong> สำหรับวันที่ระบุ และพร้อมให้ครูประจำหอพักเช็คยอดต่อได้ทันที
                  </p>
                </div>
              </div>
            ) : (
              /* Date Range Selector for HOME_BREAK, SEMESTER_BREAK, CLEAR */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <ThaiDatePicker
                      label="📅 วันที่เริ่มต้น:"
                      value={rangeStartDate}
                      onChange={(val) => {
                        setRangeStartDate(val);
                        if (val > rangeEndDate) {
                          setRangeEndDate(val);
                        }
                      }}
                    />
                    <p className="text-[11px] text-slate-500">
                      ไทย: <strong>{formatThaiFullDate(rangeStartDate)}</strong>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <ThaiDatePicker
                      label="📅 วันที่สิ้นสุด:"
                      value={rangeEndDate}
                      min={rangeStartDate}
                      onChange={(val) => setRangeEndDate(val)}
                    />
                    <p className="text-[11px] text-slate-500">
                      ไทย: <strong>{formatThaiFullDate(rangeEndDate)}</strong>
                    </p>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    เลือกด่วน:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStartDate(todayStr);
                      setRangeEndDate(todayStr);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    1 วัน (วันนี้)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(3)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    3 วัน (สุดสัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(5)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    5 วัน (วันทำงาน)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(7)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    7 วัน (1 สัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(14)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    14 วัน (2 สัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                  >
                    30 วัน (ปิดภาคเรียน 1 เดือน)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Step 3: Select Dormitories */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  เลือกหอพักเป้าหมายที่ต้องการดำเนินการ
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAllDorms}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  {isAllDormsSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      <span>เลือกครบทุกหอแล้ว (คลิกเพื่อล้าง)</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 text-slate-400" />
                      <span>เลือกทุกหอพัก (หอ 1 - 6)</span>
                    </>
                  )}
                </button>
                <span className="text-xs font-bold text-slate-500">
                  ({selectedDormIds.length}/{dorms.length} หอ)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                        ? "bg-indigo-50/90 border-indigo-500 shadow-xs ring-1 ring-indigo-400"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-xs text-slate-900">{dorm.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${getDormTypeBadgeStyle(dorm)}`}>
                          {getDormTypeLabel(dorm, true)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        นักเรียน: <strong>{dormStudentCount}</strong> คน
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className={`font-black text-xs ${isSelected ? "text-indigo-600" : "text-slate-400"}`}>
                        {isSelected ? "✓ เลือกแล้ว" : "+ คลิกเลือก"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Step 4: Orientation / Notes */}
          {targetStatus !== "CLEAR" && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                  4
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  ข้อความบันทึกการอบรม / หมายเหตุประจำช่วงวัน (ไม่บังคับ)
                </h3>
              </div>
              <input
                type="text"
                value={orientationNoteText}
                onChange={(e) => setOrientationNoteText(e.target.value)}
                placeholder={
                  targetStatus === "HOME_BREAK"
                    ? "เช่น รอบกลับบ้านประจำสัปดาห์ / วันหยุดยาววันเฉลิมพระชนมพรรษา"
                    : targetStatus === "SEMESTER_BREAK"
                    ? "เช่น ปิดภาคเรียนที่ 1 ประจำปีการศึกษา 2569"
                    : "ระบุข้อความเพิ่มเติม"
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}

          {/* Form Step 5: Summary & Confirm Bar */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-indigo-900/60">
            <div className="space-y-1.5">
              <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>สรุปข้อมูลก่อนดำเนินการบันทึก:</span>
              </div>
              <div className="text-base font-black text-white flex items-center gap-2 flex-wrap">
                <span>กำหนดสถานะเป็น:</span>
                <span className="text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full text-xs font-black border border-amber-400/40">
                  {targetStatus === "HOME_BREAK"
                    ? "🏡 รอบกลับบ้าน (ROUND_HOME)"
                    : targetStatus === "SEMESTER_BREAK"
                    ? "🏖️ ปิดภาคเรียน (SEMESTER_BREAK)"
                    : targetStatus === "PRESENT"
                    ? "🟢 เช็คยอดตามปกติ"
                    : "🗑️ ล้างข้อมูลช่วงวัน (PENDING)"}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
                {targetStatus === "PRESENT" ? (
                  <span>วันที่ดำเนินการ: <strong>{formatThaiFullDate(rangeStartDate)}</strong> (1 วัน)</span>
                ) : (
                  <span>ช่วงวันที่: <strong>{formatThaiFullDate(rangeStartDate)}</strong> ถึง <strong>{formatThaiFullDate(rangeEndDate)}</strong> ({daysCount} วัน)</span>
                )}
                <span>•</span>
                <span>หอพัก: <strong>{selectedDormIds.length}</strong> หอพัก</span>
                <span>•</span>
                <span>บันทึกโดย: <strong>{currentUser?.name || "เจ้าหน้าที่"}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={isSubmitting || daysCount <= 0 || selectedDormIds.length === 0}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isSubmitting ? "กำลังดำเนินการ..." : "ยืนยันและบันทึกสถานะช่วงวัน"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 2: SCHEDULE & HISTORY OF SPECIAL STATUSES                       */}
      {/* ======================================================================= */}
      {activeSubTab === "SCHEDULE_HISTORY" && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ตารางวันที่ที่มีการกำหนดสถานะพิเศษในระบบ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แสดงรายการวันที่ที่อยู่ในสถานะ "รอบกลับบ้าน" หรือ "ปิดภาคเรียน" ทั้งหมดในฐานข้อมูล
                </p>
              </div>

              <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                พบทั้งหมด <strong>{specialStatusDatesList.length}</strong> วันที่มีสถานะพิเศษ
              </div>
            </div>

            {specialStatusDatesList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-bold text-sm text-slate-700">ยังไม่มีวันที่กำหนดสถานะพิเศษในระบบ</p>
                <p className="text-xs text-slate-500">
                  คุณสามารถใช้แท็บ "กำหนดสถานะตามช่วงวัน" ด้านบน เพื่อกำหนดช่วงวันรอบกลับบ้านหรือปิดภาคเรียนได้ทันที
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black text-slate-600 uppercase border-b border-slate-200">
                      <th className="py-3 px-4">วันที่ (ปี พ.ศ.)</th>
                      <th className="py-3 px-4">สถานะพิเศษ</th>
                      <th className="py-3 px-4">หอพักที่มีผล</th>
                      <th className="py-3 px-4">บันทึกโดย</th>
                      <th className="py-3 px-4">หมายเหตุ / เรื่องอบรม</th>
                      <th className="py-3 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {specialStatusDatesList.map((item) => {
                      const isToday = item.date === todayStr;
                      const hasHome = item.homeBreakDorms.length > 0;
                      const hasSemester = item.semesterBreakDorms.length > 0;

                      return (
                        <tr
                          key={item.date}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isToday ? "bg-amber-50/40 font-semibold" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {formatThaiFullDate(item.date)}
                              </span>
                              {isToday && (
                                <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                                  วันนี้
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.date}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1">
                              {hasHome && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 w-fit">
                                  <Home className="w-3.5 h-3.5 text-amber-700" />
                                  <span>รอบกลับบ้าน</span>
                                </span>
                              )}
                              {hasSemester && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-900 border border-sky-300 w-fit">
                                  <School className="w-3.5 h-3.5 text-sky-700" />
                                  <span>ปิดภาคเรียน</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {hasHome && (
                              <div className="text-slate-700 font-medium">
                                {item.homeBreakDorms.length === dorms.length ? (
                                  <span className="font-bold text-indigo-700">ทุกหอพัก (หอ 1 - 6)</span>
                                ) : (
                                  <span>{item.homeBreakDorms.map((id) => dorms.find((d) => d.id === id)?.name || id).join(", ")}</span>
                                )}
                              </div>
                            )}
                            {hasSemester && (
                              <div className="text-slate-700 font-medium">
                                {item.semesterBreakDorms.length === dorms.length ? (
                                  <span className="font-bold text-sky-700">ทุกหอพัก (หอ 1 - 6)</span>
                                ) : (
                                  <span>{item.semesterBreakDorms.map((id) => dorms.find((d) => d.id === id)?.name || id).join(", ")}</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {Array.from(item.checkedByNames).join(", ") || "-"}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                            {Array.from(item.notes).join("; ") || "-"}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setClearTargetDate(item.date)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-200 hover:border-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto shadow-2xs"
                              title="ยกเลิกสถานะพิเศษและคืนค่ารอเช็คยอด"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>ล้าง / ยกเลิก</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inner Confirmation Modal for Batch Assignment */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
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
                  โดย: {currentUser?.name || "เจ้าหน้าที่งานหอพัก"}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-semibold">
                  {targetStatus === "PRESENT" ? "วันที่ดำเนินการ:" : "ช่วงวันที่:"}
                </span>
                <span className="font-bold text-slate-900">
                  {targetStatus === "PRESENT"
                    ? `${formatThaiFullDate(rangeStartDate)} (1 วัน)`
                    : `${formatThaiFullDate(rangeStartDate)} ถึง ${formatThaiFullDate(rangeEndDate)} (${daysCount} วัน)`}
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
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={isSubmitting}
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
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันดำเนินการทันที"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing a Single Date from History */}
      {clearTargetDate && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  ยืนยันการล้างสถานะพิเศษวันที่นี้?
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  วันที่: {formatThaiFullDate(clearTargetDate)}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
              ระบบจะลบข้อมูลสถานะพิเศษของทุกหอพักในวันที่ <strong>{formatThaiFullDate(clearTargetDate)}</strong> และคืนค่าเป็นสถานะ <strong>"รอการเช็คยอด" (PENDING)</strong> เพื่อให้ครูประจำหอพักสามารถเข้ามาเช็คยอดได้ตามปกติ
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setClearTargetDate(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleExecuteClearSingleDate(clearTargetDate)}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md"
              >
                {isSubmitting ? "กำลังล้างข้อมูล..." : "ยืนยันล้างสถานะทันที"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
