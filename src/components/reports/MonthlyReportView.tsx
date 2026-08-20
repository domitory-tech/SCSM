import React, { useState, useMemo } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  DEFAULT_SYSTEM_SETTINGS,
  formatGradeRoomFullTitle,
  formatThaiMonthYear,
  getDaysInMonth,
  THAI_DAYS_SHORT,
  THAI_MONTHS
} from "../../utils/dateUtils";
import {
  exportAllMonthlyReportsHtml,
  exportMonthlyReportHtmlDocument,
  MonthlyRoomData
} from "../../utils/monthlyReportExporter";
import {
  Calendar,
  ChevronDown,
  Download,
  FileCode,
  FileText,
  Filter,
  Layers,
  Search,
  Sparkles,
  Users
} from "lucide-react";

interface MonthlyReportViewProps {
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  isLoading?: boolean;
}

// Attendance code mapping
const ATTENDANCE_CODE_MAP: Record<string, { code: string; label: string; colorClass: string; bgClass: string; hexColor: string }> = {
  PRESENT: {
    code: "✓",
    label: "อยู่หอพัก",
    colorClass: "text-emerald-700 font-bold",
    bgClass: "bg-emerald-50/60",
    hexColor: "#059669"
  },
  ROUND_HOME: {
    code: "รบ",
    label: "รอบกลับบ้าน",
    colorClass: "text-amber-950 font-black",
    bgClass: "bg-yellow-200",
    hexColor: "#78350f"
  },
  HOME: {
    code: "กบ",
    label: "กลับบ้าน",
    colorClass: "text-orange-700 font-extrabold",
    bgClass: "bg-orange-100",
    hexColor: "#ea580c"
  },
  CAMP: {
    code: "ค",
    label: "เข้าค่าย",
    colorClass: "text-blue-700 font-extrabold",
    bgClass: "bg-blue-100",
    hexColor: "#1d4ed8"
  },
  SICK: {
    code: "ป",
    label: "ป่วย",
    colorClass: "text-rose-700 font-extrabold",
    bgClass: "bg-rose-100",
    hexColor: "#e11d48"
  },
  SKILL_COMP: {
    code: "ท",
    label: "แข่งทักษะ",
    colorClass: "text-purple-700 font-extrabold",
    bgClass: "bg-purple-100",
    hexColor: "#9333ea"
  },
  EXCHANGE: {
    code: "ลป",
    label: "แลกเปลี่ยน",
    colorClass: "text-sky-700 font-extrabold",
    bgClass: "bg-sky-100",
    hexColor: "#0284c7"
  },
  OTHER: {
    code: "อ",
    label: "อื่นๆ",
    colorClass: "text-amber-900 font-extrabold",
    bgClass: "bg-amber-100",
    hexColor: "#78350f"
  }
};

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  students = [],
  dorms = [],
  attendanceRecords = [],
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  currentUser,
  isLoading = false
}) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("ม.1/1");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const daysInMonth = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Days array: [1, 2, 3, ... 31]
  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // Map of (dateString) -> (dormId) -> DailyAttendance
  const attendanceLookup = useMemo(() => {
    const map: Record<string, Record<string, DailyAttendance>> = {};
    attendanceRecords.forEach((att) => {
      if (att && att.date) {
        if (!map[att.date]) map[att.date] = {};
        map[att.date][att.dormId] = att;
      }
    });
    return map;
  }, [attendanceRecords]);

  // Process data by classroom
  const processedRoomsData: MonthlyRoomData[] = useMemo(() => {
    // 1. Group students by Grade/Room
    const groups: Record<string, { grade: string; room: number | string; students: Student[] }> = {};

    students.forEach((s) => {
      const grade = s.grade || "ม.1";
      const room = s.room || 1;
      const key = `${grade}/${room}`;
      if (!groups[key]) {
        groups[key] = { grade, room, students: [] };
      }
      groups[key].students.push(s);
    });

    // Sort rooms in logical school order (ม.1/1, ม.1/2, ม.2/1, ..., ม.6/x)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return a.localeCompare(b, "th-TH", { numeric: true });
    });

    const monthStr = String(selectedMonth).padStart(2, "0");

    return sortedKeys.map((key) => {
      const group = groups[key];
      // Sort students by student 'no' ascending, then studentId
      const sortedStudents = [...group.students].sort((a, b) => (a.no || 0) - (b.no || 0));

      const attendanceMap: MonthlyRoomData["attendanceMap"] = {};
      const studentOutTotals: Record<string, number> = {};
      const dayStats: MonthlyRoomData["dayStats"] = {};

      // Initialize day stats
      daysArray.forEach((d) => {
        dayStats[d] = { total: sortedStudents.length, present: 0, out: 0 };
      });

      sortedStudents.forEach((std) => {
        attendanceMap[std.studentId] = {};
        let outDaysCount = 0;

        daysArray.forEach((d) => {
          const dayStr = String(d).padStart(2, "0");
          const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
          const dormAtt = attendanceLookup[dateStr]?.[std.dormId];

          if (!dormAtt) {
            // Unchecked date
            attendanceMap[std.studentId][d] = {
              status: "NONE",
              label: "-",
              code: "-",
              color: "text-gray-300"
            };
          } else {
            if (dormAtt.isHomeBreak) {
              attendanceMap[std.studentId][d] = {
                status: "ROUND_HOME",
                label: "รอบกลับบ้าน",
                code: "รบ",
                color: ATTENDANCE_CODE_MAP.ROUND_HOME.colorClass
              };
              outDaysCount++;
              dayStats[d].out++;
            } else if (Array.isArray(dormAtt.records)) {
              const record = dormAtt.records.find((r) => r.studentId === std.studentId);
              if (record && record.status !== "PRESENT") {
                const conf = ATTENDANCE_CODE_MAP[record.status] || ATTENDANCE_CODE_MAP.OTHER;
                attendanceMap[std.studentId][d] = {
                  status: record.status,
                  label: conf.label,
                  code: conf.code,
                  color: conf.colorClass
                };
                outDaysCount++;
                dayStats[d].out++;
              } else if (dormAtt.status === "CHECKED" || (record && record.status === "PRESENT")) {
                attendanceMap[std.studentId][d] = {
                  status: "PRESENT",
                  label: "อยู่หอพัก",
                  code: "✓",
                  color: ATTENDANCE_CODE_MAP.PRESENT.colorClass
                };
                dayStats[d].present++;
              } else {
                attendanceMap[std.studentId][d] = {
                  status: "NONE",
                  label: "-",
                  code: "-",
                  color: "text-gray-300"
                };
              }
            } else if (dormAtt.status === "CHECKED") {
              attendanceMap[std.studentId][d] = {
                status: "PRESENT",
                label: "อยู่หอพัก",
                code: "✓",
                color: ATTENDANCE_CODE_MAP.PRESENT.colorClass
              };
              dayStats[d].present++;
            } else {
              attendanceMap[std.studentId][d] = {
                status: "NONE",
                label: "-",
                code: "-",
                color: "text-gray-300"
              };
            }
          }
        });

        studentOutTotals[std.studentId] = outDaysCount;
      });

      return {
        grade: group.grade,
        room: group.room,
        roomKey: key,
        fullTitle: formatGradeRoomFullTitle(group.grade, group.room),
        students: sortedStudents,
        attendanceMap,
        dayStats,
        studentOutTotals,
        totalStudents: sortedStudents.length
      };
    });
  }, [students, daysArray, selectedYear, selectedMonth, attendanceLookup]);

  // Filtered rooms for screen display (defaults to ม.1/1)
  const displayedRooms = useMemo(() => {
    let list = processedRoomsData;
    if (selectedRoomFilter !== "ALL") {
      const filtered = list.filter((r) => r.roomKey === selectedRoomFilter);
      if (filtered.length > 0) {
        list = filtered;
      } else if (selectedRoomFilter === "ม.1/1" && list.length > 0) {
        const fallback = list.find((r) => r.roomKey.includes("1/1") || r.grade.includes("1")) || list[0];
        list = fallback ? [fallback] : list;
      } else {
        list = filtered;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.roomKey.toLowerCase().includes(q) ||
          r.fullTitle.toLowerCase().includes(q) ||
          r.grade.toLowerCase().includes(q) ||
          r.students.some(
            (s) =>
              s.firstName.toLowerCase().includes(q) ||
              s.lastName.toLowerCase().includes(q) ||
              s.studentId.includes(q)
          )
      );
    }
    return list;
  }, [processedRoomsData, selectedRoomFilter, searchQuery]);

  // Summary Metrics
  const totalRoomsCount = processedRoomsData.length;
  const totalStudentsCount = useMemo(() => {
    return processedRoomsData.reduce((sum, r) => sum + r.totalStudents, 0);
  }, [processedRoomsData]);

  const monthTitle = formatThaiMonthYear(selectedYear, selectedMonth);

  // Handle Export HTML (Exports ALL grades and classrooms for entire school)
  const handleExportHtml = () => {
    try {
      const fileName = `รายงานสรุปเช็คยอดนักเรียน_ทุกระดับชั้น_${THAI_MONTHS[selectedMonth - 1]}_${selectedYear + 543}.html`;
      exportAllMonthlyReportsHtml(
        processedRoomsData,
        selectedYear,
        selectedMonth,
        systemSettings.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล",
        fileName
      );
    } catch (e: any) {
      alert("เกิดข้อผิดพลาดในการส่งออก HTML: " + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Control & Filter Toolbar (Hidden when printing) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#A05AFF] uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              <span>รายงานสรุปประจำเดือน (A4 แนวนอน • 1 หน้า = 1 ห้อง)</span>
            </div>
            <h2 className="text-xl font-black text-slate-800 mt-1">
              สรุปเช็คยอดนักเรียนประจำเดือน
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleExportHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              title="ดาวน์โหลดไฟล์ HTML/CSS รวมรายงานทุกระดับชั้นทุกห้องเรียน (1 หน้า = 1 ห้อง)"
            >
              <FileCode className="w-4 h-4" />
              <span>ส่งออก HTML ทุกระดับชั้น ({totalRoomsCount} ห้อง)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          {/* Month Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              เลือกเดือน
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
            >
              {THAI_MONTHS.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m} (เดือน {idx + 1})
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              เลือกปี พ.ศ.
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
            >
              {[2025, 2026, 2027, 2028, 2029].map((y) => (
                <option key={y} value={y}>
                  พ.ศ. {y + 543} (ค.ศ. {y})
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              เลือกห้องเรียน
            </label>
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
            >
              {processedRoomsData.map((r) => (
                <option key={r.roomKey} value={r.roomKey}>
                  {r.fullTitle} ({r.totalStudents} คน)
                </option>
              ))}
              <option value="ALL">แสดงทุกห้องเรียน ({totalRoomsCount} ห้อง)</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              ค้นหารายชื่อ / ห้อง
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="พิมพ์ชื่อนักเรียน หรือ ม.1/1..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Legend Quick Preview Bar */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 flex items-center flex-wrap gap-x-4 gap-y-2 text-[11px]">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#A05AFF]" />
            สัญลักษณ์ในรายงาน:
          </span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">✓</span>
            <span>อยู่หอพัก</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-extrabold text-[10px]">รบ</span>
            <span>รอบกลับบ้าน</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 font-extrabold text-[10px]">กบ</span>
            <span>กลับบ้าน</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold text-[10px]">ป</span>
            <span>ป่วย</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-extrabold text-[10px]">ท</span>
            <span>แข่งทักษะ</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 font-extrabold text-[10px]">ลป</span>
            <span>แลกเปลี่ยน</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px]">อ</span>
            <span>อื่นๆ</span>
          </div>
        </div>
      </div>

      {/* Printable Report Container (Formatted for A4 Landscape) */}
      <div id="monthly-report-printable-container" className="space-y-8 print:space-y-0">
        {displayedRooms.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-700">ไม่พบข้อมูลห้องเรียนตามเงื่อนไขที่เลือก</h3>
            <p className="text-xs text-slate-500 mt-1">
              กรุณาเปลี่ยนเงื่อนไขการค้นหา หรือตรวจสอบรายชื่อนักเรียนในระบบ
            </p>
          </div>
        ) : (
          displayedRooms.map((roomData, roomIdx) => {
            return (
              <div
                key={roomData.roomKey}
                className="monthly-print-page bg-white rounded-xl py-6 pr-6 pl-8 sm:pl-10 border border-slate-300 shadow-xs text-slate-800 flex flex-col justify-between print:border-0 print:shadow-none print:rounded-none print:p-0 print:m-0"
                style={{
                  minHeight: "194mm",
                  pageBreakAfter: roomIdx === displayedRooms.length - 1 ? "auto" : "always",
                  breakAfter: roomIdx === displayedRooms.length - 1 ? "auto" : "page"
                }}
              >
                {/* 1. Header Section */}
                <div className="text-center mb-3 pb-2 border-b border-slate-200 print:border-b-0">
                  <h1 className="text-base font-black text-slate-900 leading-tight">
                    {systemSettings.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล"}
                  </h1>
                  <h2 className="text-sm font-bold text-slate-800 leading-tight mt-0.5">
                    สรุปเช็คยอดนักเรียนประจำเดือน {monthTitle}
                  </h2>
                  <div className="inline-block mt-1 px-3 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-xs font-bold text-slate-900">
                    นักเรียนระดับชั้น {roomData.fullTitle} (จำนวน {roomData.totalStudents} คน)
                  </div>
                </div>

                {/* 2. Main Attendance Table */}
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-[10.5px] border-collapse border border-slate-400">
                    {/* First Row Header */}
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold">
                        <th className="border border-slate-400 px-1 py-1 w-8 text-center shrink-0">
                          เลขที่
                        </th>
                        <th className="border border-slate-400 px-2 py-1 min-w-[140px] text-left">
                          ชื่อ - สกุล นักเรียน
                        </th>
                        {daysArray.map((d) => {
                          const dateObj = new Date(selectedYear, selectedMonth - 1, d);
                          const dayOfWeek = THAI_DAYS_SHORT[dateObj.getDay()];
                          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                          return (
                            <th
                              key={d}
                              className={`border border-slate-400 px-0.5 py-0.5 text-center min-w-[20px] max-w-[24px] ${
                                isWeekend ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              <div className="text-[10px] leading-none">{d}</div>
                              <div className="text-[8px] font-normal text-slate-500 leading-none mt-0.5">
                                {dayOfWeek}
                              </div>
                            </th>
                          );
                        })}
                        <th className="border border-slate-400 px-1.5 py-1 min-w-[80px] max-w-[90px] text-center bg-purple-50 text-purple-950 font-extrabold leading-tight">
                          สรุปนักเรียน<br />ออกหอพัก/วัน
                        </th>
                      </tr>
                    </thead>

                    {/* Student Rows */}
                    <tbody>
                      {roomData.students.length === 0 ? (
                        <tr>
                          <td
                            colSpan={daysInMonth + 3}
                            className="border border-slate-300 py-6 text-center text-slate-400"
                          >
                            ไม่มีรายชื่อนักเรียนในห้องนี้
                          </td>
                        </tr>
                      ) : (
                        roomData.students.map((student, sIdx) => {
                          const outCount = roomData.studentOutTotals[student.studentId] || 0;
                          const isEven = sIdx % 2 === 0;

                          return (
                            <tr
                              key={student.id || student.studentId}
                              className={`${isEven ? "bg-white" : "bg-slate-50/60"} hover:bg-purple-50/40 transition-colors`}
                            >
                              <td className="border border-slate-300 px-1 py-0.5 text-center font-bold text-slate-700">
                                {student.no}
                              </td>
                              <td className="border border-slate-300 px-2 py-0.5 text-left font-medium text-slate-900 truncate">
                                {student.title}{student.firstName} {student.lastName}
                              </td>
                              {daysArray.map((d) => {
                                const att = roomData.attendanceMap[student.studentId]?.[d];
                                const code = att?.code || "-";
                                const isCheckmark = code === "✓";
                                const isRoundHome = code === "รบ";

                                return (
                                  <td
                                    key={d}
                                    className={`border border-slate-300 px-0.5 py-0.5 text-center leading-none ${
                                      isRoundHome
                                        ? "bg-yellow-200 text-amber-950 font-black text-[10px]"
                                        : isCheckmark
                                        ? "text-emerald-600 font-black text-xs"
                                        : code !== "-"
                                        ? `${att?.color || "text-slate-800"} text-[10px]`
                                        : "text-slate-300 text-[10px]"
                                    }`}
                                  >
                                    {code}
                                  </td>
                                );
                              })}
                              <td className="border border-slate-300 px-1 py-0.5 text-center font-bold text-purple-900 bg-purple-50/40">
                                {outCount > 0 ? (
                                  <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-extrabold text-[10px]">
                                    {outCount} วัน
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">0</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* Summary Row 1: Total Students */}
                      <tr className="bg-slate-100/90 font-bold text-slate-800 border-t-2 border-slate-400">
                        <td colSpan={2} className="border border-slate-400 px-2 py-0.5 text-right font-black">
                          รวมนักเรียนทั้งหมด (คน)
                        </td>
                        {daysArray.map((d) => (
                          <td key={d} className="border border-slate-400 px-0.5 py-0.5 text-center text-[9.5px]">
                            {roomData.dayStats[d]?.total || roomData.totalStudents}
                          </td>
                        ))}
                        <td className="border border-slate-400 px-1 py-0.5 text-center text-purple-900 font-black bg-purple-50">
                          {roomData.totalStudents}
                        </td>
                      </tr>

                      {/* Summary Row 2: Present Count */}
                      <tr className="bg-emerald-50/70 font-bold text-emerald-900">
                        <td colSpan={2} className="border border-slate-400 px-2 py-0.5 text-right text-emerald-800 font-black">
                          อยู่หอพัก (คน)
                        </td>
                        {daysArray.map((d) => (
                          <td key={d} className="border border-slate-400 px-0.5 py-0.5 text-center text-[9.5px] text-emerald-700 font-bold">
                            {roomData.dayStats[d]?.present > 0 ? roomData.dayStats[d].present : "-"}
                          </td>
                        ))}
                        <td className="border border-slate-400 px-1 py-0.5 text-center text-emerald-900 font-black">
                          -
                        </td>
                      </tr>

                      {/* Summary Row 3: Out Count */}
                      <tr className="bg-rose-50/70 font-bold text-rose-900">
                        <td colSpan={2} className="border border-slate-400 px-2 py-0.5 text-right text-rose-800 font-black">
                          ออกหอพัก (คน)
                        </td>
                        {daysArray.map((d) => (
                          <td key={d} className="border border-slate-400 px-0.5 py-0.5 text-center text-[9.5px] text-rose-700 font-bold">
                            {roomData.dayStats[d]?.out > 0 ? roomData.dayStats[d].out : "-"}
                          </td>
                        ))}
                        <td className="border border-slate-400 px-1 py-0.5 text-center text-rose-900 font-black">
                          -
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Footer: Abbreviations Legend (No Signatures) */}
                <div className="mt-3 pt-2 border-t border-slate-300 avoid-break print:border-t-0">
                  {/* Legend of Abbreviations */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
                    <span className="font-extrabold text-slate-900">คำอธิบายสัญลักษณ์และอักษรย่อ:</span>
                    <span className="font-semibold">
                      <strong className="text-emerald-600 font-black text-xs">✓</strong> = อยู่หอพัก
                    </span>
                    <span className="font-semibold">
                      <strong className="text-amber-950 font-black bg-yellow-200 px-1 py-0.5 rounded border border-yellow-300">รบ</strong> = รอบกลับบ้าน (สีเหลือง)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-orange-700 font-black">กบ</strong> = กลับบ้าน (สีส้ม)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-blue-700 font-black">ค</strong> = เข้าค่าย (สีน้ำเงิน)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-rose-700 font-black">ป</strong> = ป่วย (สีแดง)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-purple-700 font-black">ท</strong> = แข่งทักษะ (สีม่วง)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-sky-700 font-black">ลป</strong> = แลกเปลี่ยน (สีฟ้า)
                    </span>
                    <span className="font-semibold">
                      <strong className="text-amber-900 font-black">อ</strong> = อื่นๆ (สีน้ำตาล)
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
