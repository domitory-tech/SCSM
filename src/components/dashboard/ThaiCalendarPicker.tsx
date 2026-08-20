import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Calendar as CalendarIcon, RefreshCw } from "lucide-react";

interface ThaiCalendarPickerProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  checkedDates: string[];
  todayDate: string;
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
  checkedDates,
  todayDate
}) => {
  // Parse initial view year and month (0-indexed)
  const initialDateObj = useMemo(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    const todayParts = todayDate.split("-").map(Number);
    if (todayParts.length === 3 && !isNaN(todayParts[0])) {
      return new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    }
    return new Date();
  }, [selectedDate, todayDate]);

  const [viewYear, setViewYear] = useState<number>(initialDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDateObj.getMonth());

  const checkedSet = useMemo(() => new Set(checkedDates), [checkedDates]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const todayObj = new Date(todayDate);
    const nextViewDate = new Date(viewYear, viewMonth + 1, 1);
    if (nextViewDate > new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0)) {
      return; // Cannot go to future months
    }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
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
      const isSelected = selectedDate === dateStr;
      const isToday = dateStr === todayDate;

      days.push({
        dayNum: day,
        dateStr,
        isFuture,
        hasAttendance,
        isSelected,
        isToday
      });
    }

    return days;
  }, [viewYear, viewMonth, todayDate, checkedSet, selectedDate]);

  const isNextDisabled = useMemo(() => {
    const todayParts = todayDate.split("-").map(Number);
    if (todayParts.length !== 3) return false;
    const currentViewDate = new Date(viewYear, viewMonth, 1);
    const todayMonthDate = new Date(todayParts[0], todayParts[1] - 1, 1);
    return currentViewDate >= todayMonthDate;
  }, [viewYear, viewMonth, todayDate]);

  return (
    <div className="bg-white rounded-3xl p-4 lg:p-5 border border-purple-100 shadow-md flex flex-col justify-between h-full">
      <div>
        {/* Header Title & Status */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-100/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#A05AFF] flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">ปฏิทินรายงานเช็คยอดนักเรียน</h4>
              <p className="text-[10px] text-slate-500">เลือกวันที่เพื่อดูสถิตีย้อนหลัง</p>
            </div>
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate("")}
              className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 text-[11px] font-extrabold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              title="สลับเป็นผลการเช็คยอดล่าสุด"
            >
              <RefreshCw className="w-3 h-3 text-[#A05AFF]" />
              <span>แสดงยอดล่าสุด</span>
            </button>
          )}
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between mb-3 bg-purple-50/60 p-2 rounded-2xl border border-purple-100/60">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl hover:bg-white text-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4 text-purple-800" />
          </button>
          <div className="text-xs font-black text-purple-950">
            {THAI_MONTHS[viewMonth]} พ.ศ. {viewYear + 543}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isNextDisabled}
            className={`p-1.5 rounded-xl transition-colors ${
              isNextDisabled
                ? "text-slate-300 cursor-not-allowed opacity-40"
                : "hover:bg-white text-slate-700 cursor-pointer shadow-2xs"
            }`}
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
              className={`text-[10px] font-extrabold py-1 ${
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

            const { dayNum, dateStr, isFuture, hasAttendance, isSelected, isToday } = item;

            // Determine interactive status
            if (isFuture) {
              return (
                <div
                  key={dateStr}
                  className="h-9 rounded-xl bg-slate-50 border border-transparent text-slate-300 text-[11px] font-medium flex items-center justify-center opacity-30 cursor-not-allowed select-none"
                  title="ยังไม่ถึงกำหนดวัน (อนาคต)"
                >
                  {dayNum}
                </div>
              );
            }

            if (!hasAttendance) {
              return (
                <div
                  key={dateStr}
                  className="h-9 rounded-xl bg-slate-100/70 border border-slate-200/50 text-slate-400 text-[11px] font-medium flex items-center justify-center opacity-40 cursor-not-allowed select-none"
                  title="ยังไม่มีการเช็คยอดในวันที่นี้"
                >
                  {dayNum}
                </div>
              );
            }

            // Interactive Day with attendance data
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className={`h-9 rounded-xl text-[11px] font-extrabold relative flex items-center justify-center transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-[#A05AFF] text-white shadow-md ring-2 ring-purple-300 scale-105 z-10"
                    : isToday
                    ? "bg-emerald-100 text-emerald-950 border-2 border-emerald-500 hover:bg-emerald-200"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80"
                }`}
                title={`เช็คยอดแล้ว (${dateStr}) - คลิกเพื่อเลือกสถิติ`}
              >
                <span>{dayNum}</span>
                {/* Checkmark badge */}
                <span
                  className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shadow-2xs ${
                    isSelected
                      ? "bg-emerald-400 text-slate-950 font-black"
                      : "bg-emerald-600 text-white font-bold"
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="mt-4 pt-2.5 border-t border-purple-100/80 flex flex-wrap items-center justify-between text-[10px] gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center text-[7px] text-white font-bold">
            ✓
          </span>
          <span className="text-slate-700 font-semibold">เช็คยอดแล้ว (เลือกได้)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="text-slate-400 font-medium">ยังไม่เช็คยอด / อนาคต</span>
        </div>
      </div>
    </div>
  );
};
