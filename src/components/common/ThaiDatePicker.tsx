import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays
} from "lucide-react";
import {
  formatThaiFullDate,
  formatThaiMediumDate,
  getTodayDateString,
  getYesterdayDateString,
  getNextDateString
} from "../../utils/dateUtils";

export interface ThaiDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  label?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  showQuickButtons?: boolean;
  fullWidth?: boolean;
  inline?: boolean;
  required?: boolean;
}

export const THAI_MONTHS_FULL = [
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

export const THAI_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const THAI_DAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  disabled = false,
  placeholder = "เลือกวันที่ (ปฏิทินไทย)",
  className = "",
  align = "left",
  showQuickButtons = true,
  fullWidth = true,
  inline = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayStr = getTodayDateString();

  // Parse YYYY-MM-DD
  const parseYMD = (str: string) => {
    if (!str) return null;
    const parts = str.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
    return null;
  };

  const initialParsed = useMemo(() => {
    const fromVal = parseYMD(value);
    if (fromVal) return fromVal;
    const fromToday = parseYMD(todayStr);
    if (fromToday) return fromToday;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [value, todayStr]);

  const [viewYear, setViewYear] = useState<number>(initialParsed.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParsed.month);

  // Sync internal view when value changes
  useEffect(() => {
    if (value) {
      const parsed = parseYMD(value);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [value]);

  // Click outside listener to close popover
  useEffect(() => {
    if (inline || !isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, inline]);

  const handlePrevMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    if (!inline) {
      setIsOpen(false);
    }
  };

  // Generate Year options in Buddhist Era (พ.ศ. 2555 ถึง 2580)
  const yearOptions = useMemo(() => {
    const currentAD = new Date().getFullYear();
    const startAD = currentAD - 8; // e.g. 2018 (พ.ศ. 2561)
    const endAD = currentAD + 8; // e.g. 2034 (พ.ศ. 2577)
    const list: number[] = [];
    for (let y = startAD; y <= endAD; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // Calendar cells for the month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{
      dayNum: number;
      dateStr: string;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    } | null> = [];

    // Empty leading padding
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const monthStr = String(viewMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${viewYear}-${monthStr}-${dayStr}`;

      const isSelected = value === dateStr;
      const isToday = dateStr === todayStr;

      let isDisabled = false;
      if (min && dateStr < min) isDisabled = true;
      if (max && dateStr > max) isDisabled = true;

      cells.push({
        dayNum: day,
        dateStr,
        isSelected,
        isToday,
        isDisabled
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, todayStr, min, max]);

  const displayThaiString = value ? formatThaiFullDate(value, true) : "";

  // The Thai Calendar Body
  const calendarContent = (
    <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 w-[310px] sm:w-[330px] select-none text-slate-800">
      {/* Month & Year Header Controls */}
      <div className="flex items-center justify-between gap-1 mb-3 bg-gradient-to-r from-indigo-50/80 via-purple-50/80 to-indigo-50/80 p-2 rounded-xl border border-indigo-100/70">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-white text-indigo-900 transition-colors cursor-pointer shadow-2xs hover:text-indigo-600"
          title="เดือนก่อนหน้า"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          {/* Thai Month Dropdown */}
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="bg-white text-xs font-black text-indigo-950 rounded-lg px-2 py-1 border border-indigo-200 outline-none cursor-pointer hover:border-indigo-400"
          >
            {THAI_MONTHS_FULL.map((m, idx) => (
              <option key={idx} value={idx}>
                {m}
              </option>
            ))}
          </select>

          {/* Thai Year Dropdown (พ.ศ.) */}
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="bg-white text-xs font-black text-indigo-950 rounded-lg px-2 py-1 border border-indigo-200 outline-none cursor-pointer hover:border-indigo-400"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                พ.ศ. {y + 543}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg hover:bg-white text-indigo-900 transition-colors cursor-pointer shadow-2xs hover:text-indigo-600"
          title="เดือนถัดไป"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers in Thai */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
        {THAI_DAYS_SHORT.map((day, idx) => (
          <div
            key={idx}
            className={`text-[11px] font-black py-1 ${
              idx === 0
                ? "text-rose-600 font-extrabold"
                : idx === 6
                ? "text-amber-600 font-extrabold"
                : "text-slate-600"
            }`}
            title={THAI_DAYS_FULL[idx]}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Matrix */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-8 rounded-lg" />;
          }

          const { dayNum, dateStr, isSelected, isToday, isDisabled } = cell;

          if (isDisabled) {
            return (
              <div
                key={dateStr}
                className="h-8 rounded-lg bg-slate-50 text-slate-300 text-xs font-medium flex items-center justify-center cursor-not-allowed select-none opacity-40"
              >
                {dayNum}
              </div>
            );
          }

          let style = "bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-100";
          if (isSelected) {
            style = "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black shadow-md ring-2 ring-indigo-300 scale-105 z-10";
          } else if (isToday) {
            style = "bg-indigo-50/70 border-2 border-indigo-400 text-indigo-950 font-bold";
          }

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleSelectDay(dateStr)}
              className={`h-8 rounded-lg text-xs relative flex items-center justify-center transition-all cursor-pointer font-semibold ${style}`}
              title={`วันที่ ${formatThaiFullDate(dateStr, true)}`}
            >
              <span>{dayNum}</span>
              {isToday && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick shortcuts (Thai) */}
      {showQuickButtons && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectDay(getYesterdayDateString())}
            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            เมื่อวานนี้
          </button>
          <button
            type="button"
            onClick={() => handleSelectDay(todayStr)}
            className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            วันนี้ (พ.ศ. {Number(todayStr.split("-")[0]) + 543})
          </button>
          <button
            type="button"
            onClick={() => handleSelectDay(getNextDateString(todayStr))}
            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            พรุ่งนี้
          </button>
          {!inline && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ปิด
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div className={`inline-block ${className}`}>{calendarContent}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`}
    >
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
          <span>{label}</span>
          {value && (
            <span className="text-[11px] font-bold text-indigo-600">
              พ.ศ. {Number(value.split("-")[0]) + 543}
            </span>
          )}
        </label>
      )}

      {/* Input button triggering Thai calendar popover */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 sm:py-3 rounded-2xl border transition-all text-left shadow-2xs cursor-pointer ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75"
            : isOpen
            ? "bg-white border-indigo-500 ring-2 ring-indigo-200 text-slate-900"
            : "bg-slate-50/80 hover:bg-white border-slate-300 hover:border-indigo-300 text-slate-900"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              value ? "bg-indigo-100 text-indigo-700" : "bg-slate-200/70 text-slate-500"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            {value ? (
              <span className="block text-xs font-black text-slate-900 truncate">
                {displayThaiString}
              </span>
            ) : (
              <span className="block text-xs font-medium text-slate-400 truncate">
                {placeholder}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <CalendarIcon className="w-4 h-4 text-indigo-600" />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute z-50 mt-2 ${
            align === "right" ? "right-0" : "left-0"
          } animate-in fade-in zoom-in-95 duration-150`}
        >
          {calendarContent}
        </div>
      )}
    </div>
  );
};
