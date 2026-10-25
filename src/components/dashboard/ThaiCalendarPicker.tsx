import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Sparkles } from "lucide-react";
import { formatThaiFullDate, getTodayDateString, getYesterdayDateString } from "../../utils/dateUtils";

export interface ThaiCalendarPickerProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  checkedDates?: string[];
  semesterBreakDates?: string[];
  homeBreakDates?: string[];
  todayDate: string;
  title?: string;
  subtitle?: string;
  onNavigateToCheck?: () => void;
  disableUnchecked?: boolean;
  effectiveDate?: string;
}

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม"
];

const THAI_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export const ThaiCalendarPicker: React.FC<ThaiCalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  checkedDates = [],
  semesterBreakDates = [],
  homeBreakDates = [],
  todayDate,
  title = "ปฏิทินรายงานเช็คยอดนักเรียน",
  subtitle = "เลือกวันที่เพื่อดูสถิติและรายงานย้อนหลัง",
  onNavigateToCheck,
  disableUnchecked = true,
  effectiveDate = ""
}) => {
  // Safe helper to parse "YYYY-MM-DD"
  const parseDateParts = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
    return null;
  };

  const initialParsed = useMemo(() => {
    const fromSelected = parseDateParts(selectedDate);
    if (fromSelected) return fromSelected;
    const fromEffective = parseDateParts(effectiveDate);
    if (fromEffective) return fromEffective;
    const fromToday = parseDateParts(todayDate);
    if (fromToday) return fromToday;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [selectedDate, effectiveDate, todayDate]);

  const [viewYear, setViewYear] = useState<number>(initialParsed.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParsed.month);

  // Sync view when selectedDate or effectiveDate changes externally
  useEffect(() => {
    const target = selectedDate || effectiveDate;
    if (target) {
      const parsed = parseDateParts(target);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [selectedDate, effectiveDate]);

  const checkedSet = useMemo(() => new Set(checkedDates), [checkedDates]);
  const semesterBreakSet = useMemo(() => new Set(semesterBreakDates), [semesterBreakDates]);
  const homeBreakSet = useMemo(() => new Set(homeBreakDates), [homeBreakDates]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Jump to today
  const handleJumpToToday = () => {
    const parsed = parseDateParts(todayDate);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      onSelectDate(todayDate);
    }
  };

  // Jump to yesterday
  const handleJumpToYesterday = () => {
    const yesterday = getYesterdayDateString();
    const parsed = parseDateParts(yesterday);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      onSelectDate(yesterday);
    }
  };

  // Generate days array for the month grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{
      dayNum: number;
      dateStr: string;
      isFuture: boolean;
      hasAttendance: boolean;
      isSemesterBreak: boolean;
      isHomeBreak: boolean;
      isSelected: boolean;
      isToday: boolean;
    } | null> = [];

    // Empty cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const monthStr = String(viewMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${viewYear}-${monthStr}-${dayStr}`;

      const isFuture = dateStr > todayDate;
      const hasAttendance = checkedSet.has(dateStr);
      const isSemesterBreak = semesterBreakSet.has(dateStr);
      const isHomeBreak = homeBreakSet.has(dateStr) && !isSemesterBreak;
      const isSelected = selectedDate ? selectedDate === dateStr : (effectiveDate ? effectiveDate === dateStr : false);
      const isToday = dateStr === todayDate;

      days.push({
        dayNum: day,
        dateStr,
        isFuture,
        hasAttendance,
        isSemesterBreak,
        isHomeBreak,
        isSelected,
        isToday
      });
    }

    return days;
  }, [viewYear, viewMonth, todayDate, checkedSet, semesterBreakSet, homeBreakSet, selectedDate, effectiveDate]);

  const yesterdayStr = getYesterdayDateString();
  const isYesterdayChecked = checkedSet.has(yesterdayStr) || semesterBreakSet.has(yesterdayStr) || homeBreakSet.has(yesterdayStr);
  const isTodayChecked = checkedSet.has(todayDate) || semesterBreakSet.has(todayDate) || homeBreakSet.has(todayDate);

  return (
    <div className="bg-white rounded-3xl p-4 lg:p-5 border border-purple-100 shadow-md flex flex-col justify-between h-full">
      <div>
        {/* Header Title & Reset to Latest */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-100/80 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#A05AFF] flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-900 truncate">{title}</h4>
              <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedDate && (
              <button
                type="button"
                onClick={() => onSelectDate("")}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-extrabold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                title="สลับเป็นผลการเช็คยอดล่าสุด"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>กลับสู่ยอดล่าสุด</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Day Selector Shortcuts */}
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          <button
            type="button"
            disabled={disableUnchecked && !isYesterdayChecked}
            onClick={handleJumpToYesterday}
            className={`py-1 px-2 text-[10px] font-bold rounded-xl border transition-all text-center ${
              selectedDate === yesterdayStr
                ? "bg-purple-600 text-white border-purple-600 shadow-xs cursor-pointer"
                : disableUnchecked && !isYesterdayChecked
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50 select-none"
                : "bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200 cursor-pointer"
            }`}
            title={
              disableUnchecked && !isYesterdayChecked
                ? "เมื่อวานนี้ยังไม่มีการเช็คยอด (ปิดการเลือก)"
                : "ดูข้อมูลการเช็คยอดเมื่อวานนี้"
            }
          >
            เมื่อวานนี้
          </button>
          <button
            type="button"
            disabled={disableUnchecked && !isTodayChecked}
            onClick={handleJumpToToday}
            className={`py-1 px-2 text-[10px] font-bold rounded-xl border transition-all text-center ${
              selectedDate === todayDate
                ? "bg-purple-600 text-white border-purple-600 shadow-xs cursor-pointer"
                : disableUnchecked && !isTodayChecked
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50 select-none"
                : "bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200 cursor-pointer"
            }`}
            title={
              disableUnchecked && !isTodayChecked
                ? "วันนี้ยังไม่มีการเช็คยอด (ปิดการเลือก)"
                : "ดูข้อมูลการเช็คยอดวันนี้"
            }
          >
            วันนี้ (ปัจจุบัน)
          </button>
        </div>

        {/* Month & Year Navigator */}
        <div className="flex items-center justify-between mb-2.5 bg-purple-50/70 p-2 rounded-2xl border border-purple-100/70">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4 text-purple-800" />
          </button>
          <div className="text-xs font-black text-purple-950 flex items-center gap-1">
            <span>{THAI_MONTHS[viewMonth]}</span>
            <span>พ.ศ. {viewYear + 543}</span>
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="เดือนถัดไป"
          >
            <ChevronRight className="w-4 h-4 text-purple-800" />
          </button>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {THAI_DAYS_SHORT.map((day, idx) => (
            <div
              key={idx}
              className={`text-[10px] font-extrabold py-0.5 ${
                idx === 0 ? "text-rose-600" : idx === 6 ? "text-amber-600" : "text-slate-600"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((item, idx) => {
            if (!item) {
              return <div key={`empty-${idx}`} className="h-9 rounded-xl" />;
            }

            const {
              dayNum,
              dateStr,
              isFuture,
              hasAttendance,
              isSemesterBreak,
              isHomeBreak,
              isSelected,
              isToday
            } = item;

            const hasCheck = hasAttendance || isSemesterBreak || isHomeBreak;
            const isUnchecked = !hasCheck;

            // Future Day (cannot select future dates)
            if (isFuture) {
              return (
                <div
                  key={dateStr}
                  className="h-9 rounded-xl bg-slate-50/60 border border-transparent text-slate-300 text-[11px] font-medium flex items-center justify-center opacity-30 cursor-not-allowed select-none"
                  title={`วันในอนาคต (${dateStr}) - ยังไม่ถึงกำหนด`}
                >
                  {dayNum}
                </div>
              );
            }

            // Unchecked Day: if disableUnchecked is active, disable it completely!
            if (disableUnchecked && isUnchecked) {
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled
                  className={`h-9 rounded-xl text-[11px] relative flex items-center justify-center bg-slate-50/90 text-slate-300 border border-slate-200/50 cursor-not-allowed select-none opacity-45 ${
                    isToday ? "ring-2 ring-purple-300/80 bg-purple-50/20 font-bold" : ""
                  }`}
                  title={
                    isToday
                      ? `วันนี้ (${dateStr}) ยังไม่มีการเช็คยอดเข้าสู่ระบบ - ปิดการเลือก (จะเปิดอัตโนมัติเมื่อเช็คยอดเสร็จสิ้น)`
                      : `ไม่มีการเช็คยอด (${dateStr}) - ปิดการเลือก`
                  }
                >
                  <span>{dayNum}</span>
                  {isToday && (
                    <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-slate-200 text-slate-600 px-1 py-0.2 rounded-md">
                      ยังไม่เช็ค
                    </span>
                  )}
                </button>
              );
            }

            // Calculate visual style based on status:
            let dayBgStyle = "bg-slate-50 hover:bg-purple-50 text-slate-700 border border-slate-200/70";
            let badgeEl: React.ReactNode = null;
            let tooltipText = `วันที่ ${dateStr} (คลิกเพื่อเลือกดู)`;

            if (isSelected) {
              dayBgStyle = "bg-[#A05AFF] text-white shadow-md ring-2 ring-purple-300 scale-105 z-10 font-black";
            } else if (isSemesterBreak) {
              dayBgStyle = "bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-950 shadow-2xs font-extrabold";
              tooltipText = `ปิดภาคเรียน (${dateStr}) - คลิกเพื่อดูรายงาน`;
              badgeEl = (
                <span
                  className="absolute -top-1 -right-1 text-[8px] font-black bg-amber-400 text-neutral-950 px-1 py-0.2 rounded-md shadow-2xs leading-tight"
                  title="ปิดภาคเรียน"
                >
                  ปภ
                </span>
              );
            } else if (isHomeBreak) {
              dayBgStyle = "bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs font-bold";
              tooltipText = `รอบกลับบ้าน (${dateStr}) - คลิกเพื่อดูรายงาน`;
              badgeEl = (
                <span
                  className="absolute -top-1 -right-1 text-[8px] font-black bg-amber-500 text-white px-1 py-0.2 rounded-md shadow-2xs leading-tight"
                  title="รอบกลับบ้าน"
                >
                  รบ
                </span>
              );
            } else if (hasAttendance) {
              dayBgStyle = "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs font-extrabold";
              tooltipText = `เช็คยอดแล้ว (${dateStr}) - คลิกเพื่อดูรายงาน`;
              badgeEl = (
                <span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold shadow-2xs"
                  title="เช็คยอดแล้ว"
                >
                  ✓
                </span>
              );
            } else {
              dayBgStyle = "bg-white hover:bg-purple-50 text-slate-600 border border-dashed border-slate-300 font-medium";
              tooltipText = `ยังไม่ได้เช็คยอด (${dateStr}) - คลิกเพื่อเลือกดู`;
              badgeEl = (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-300"
                  title="ยังไม่เช็คยอด"
                />
              );
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className={`h-9 rounded-xl text-[11px] relative flex items-center justify-center transition-all cursor-pointer select-none ${dayBgStyle} ${
                  isToday && !isSelected ? "ring-2 ring-blue-500 ring-offset-1 font-black" : ""
                }`}
                title={tooltipText}
              >
                <span>{dayNum}</span>
                {badgeEl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="mt-4 pt-2.5 border-t border-purple-100/80 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
              ✓
            </span>
            <span className="text-slate-700 font-bold truncate">เช็คยอดแล้ว</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.2 rounded-md bg-neutral-900 text-amber-400 text-[8px] font-black shrink-0">
              ปภ
            </span>
            <span className="text-slate-800 font-bold truncate">ปิดภาคเรียน</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.2 rounded-md bg-amber-500 text-white text-[8px] font-black shrink-0">
              รบ
            </span>
            <span className="text-slate-700 font-bold truncate">รอบกลับบ้าน</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center text-[9px] shrink-0 font-bold select-none">
              -
            </span>
            <span className="text-slate-400 font-medium truncate">ไม่เช็คยอด (ปิดเลือก)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
