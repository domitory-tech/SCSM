import React, { useState, useMemo, useRef } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import { formatGradeRoomShort, getDaysInMonth, THAI_MONTHS, THAI_DAYS_SHORT } from "../../utils/dateUtils";
import { matchStudentToDorm, getDormTeachers } from "../../utils/dormUtils";
import {
  ATTENDANCE_CODE_MAPPING,
  ATTENDANCE_LEGEND_ITEMS,
  compareStudentByGradeRoomAndNo,
  exportDormRegisterBookHtml,
  isWeekendOrHoliday,
  triggerPrintDormBook
} from "../../utils/dormRegisterBookExporter";
import {
  BookOpen,
  Printer,
  Download,
  Calendar,
  Building2,
  FileText,
  CheckCircle2,
  Filter,
  Eye,
  Maximize2,
  RotateCw,
  Sparkles,
  Layers,
  HelpCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut
} from "lucide-react";

interface DormAttendanceBookViewProps {
  dorms: Dormitory[];
  students: Student[];
  users?: UserProfile[];
  attendanceRecords?: DailyAttendance[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  initialDormId?: string;
  onBackToOverview?: () => void;
}

export const DormAttendanceBookView: React.FC<DormAttendanceBookViewProps> = ({
  dorms,
  students,
  users = [],
  attendanceRecords = [],
  systemSettings,
  currentUser,
  initialDormId,
  onBackToOverview
}) => {
  // Selected Dormitory state
  const [selectedDormId, setSelectedDormId] = useState<string>(() => {
    if (initialDormId) return initialDormId;
    if (dorms.length > 0) return dorms[0].id;
    return "dorm-1";
  });

  // Selected Month and Year (BE)
  // Default to October (10) and 2026 (BE 2569) as explicitly specified by user
  const now = new Date();
  const currentYearCE = now.getFullYear(); // e.g. 2026
  const currentMonthNum = now.getMonth() + 1; // 1-12

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    // If current month is 10 or default to 10 (ตุลาคม)
    return currentMonthNum === 10 ? 10 : 10;
  });

  const [selectedYearBE, setSelectedYearBE] = useState<number>(() => {
    const be = currentYearCE + 543;
    return be === 2569 ? 2569 : 2569;
  });

  const selectedYearCE = selectedYearBE - 543;

  // Print Orientation: Landscape (แนวนอน) or Portrait (แนวตั้ง)
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

  // Content Mode: "blank" (ช่องว่างสำหรับเดินติ๊กมือ) or "filled" (ดึงข้อมูลที่มีในระบบ)
  const [dataMode, setDataMode] = useState<"blank" | "filled">("blank");

  // Sort criteria: Default is grade_room_no (เรียงจากน้อยไปหามาก: ชั้น/ห้อง ตามด้วยเลขที่)
  const [sortBy, setSortBy] = useState<"grade_room_no" | "no" | "room" | "grade" | "name">("grade_room_no");

  // Rows per page customization
  const [rowsPerPageOption, setRowsPerPageOption] = useState<"auto" | "18" | "22" | "26" | "30">("auto");

  // Zoom level for on-screen preview
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Active preview page
  const [previewPage, setPreviewPage] = useState<number>(0);

  // Print container ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Current active dormitory
  const currentDorm = useMemo(() => {
    return dorms.find((d) => d.id === selectedDormId) || dorms[0];
  }, [dorms, selectedDormId]);

  // Derived teachers for current dorm
  const dormTeachers = useMemo(() => {
    if (!currentDorm) return [];
    return getDormTeachers(currentDorm, users);
  }, [currentDorm, users]);

  const teacherNameDisplay = useMemo(() => {
    if (dormTeachers.length > 0) {
      const head = dormTeachers.find((t) => t.isHead) || dormTeachers[0];
      return head.name + (dormTeachers.length > 1 ? ` (และทีมงาน ${dormTeachers.length - 1} ท่าน)` : "");
    }
    return currentDorm?.teacherName || "-";
  }, [dormTeachers, currentDorm]);

  // Filter students for the selected dorm
  const dormStudents = useMemo(() => {
    if (!currentDorm) return [];
    const list = students.filter((s) => matchStudentToDorm(s, currentDorm));

    // Sort according to criteria (Default: ชั้น/ห้อง ตามด้วยเลขที่ เรียงจากน้อยไปหามาก)
    return [...list].sort((a, b) => {
      if (sortBy === "grade_room_no") {
        return compareStudentByGradeRoomAndNo(a, b);
      }
      if (sortBy === "no") {
        return (a.no || 999) - (b.no || 999);
      }
      if (sortBy === "room") {
        const roomA = a.dormRoom || "";
        const roomB = b.dormRoom || "";
        const bedA = a.dormBed || a.bed || "";
        const bedB = b.dormBed || b.bed || "";
        if (roomA !== roomB) return roomA.localeCompare(roomB, "th", { numeric: true });
        return String(bedA).localeCompare(String(bedB), "th", { numeric: true });
      }
      if (sortBy === "grade") {
        const gA = `${a.grade || ""}/${a.room || ""}`;
        const gB = `${b.grade || ""}/${b.room || ""}`;
        return gA.localeCompare(gB, "th", { numeric: true });
      }
      if (sortBy === "name") {
        const nA = `${a.firstName || ""} ${a.lastName || ""}`;
        const nB = `${b.firstName || ""} ${b.lastName || ""}`;
        return nA.localeCompare(nB, "th");
      }
      return compareStudentByGradeRoomAndNo(a, b);
    });
  }, [students, currentDorm, sortBy]);

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(selectedYearCE, selectedMonth);
  }, [selectedYearCE, selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // Effective rows per page
  const effectiveRowsPerPage = useMemo(() => {
    if (rowsPerPageOption !== "auto") {
      return parseInt(rowsPerPageOption, 10);
    }
    return orientation === "landscape" ? 22 : 28;
  }, [rowsPerPageOption, orientation]);

  // Paginated students chunks
  const studentPages = useMemo(() => {
    if (dormStudents.length === 0) return [[]];
    const pages: Student[][] = [];
    for (let i = 0; i < dormStudents.length; i += effectiveRowsPerPage) {
      pages.push(dormStudents.slice(i, i + effectiveRowsPerPage));
    }
    return pages;
  }, [dormStudents, effectiveRowsPerPage]);

  const totalPages = studentPages.length;

  // Build daily attendance lookup map if mode is "filled"
  const studentDailyCodes = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    if (dataMode !== "filled" || attendanceRecords.length === 0 || !currentDorm) return map;

    const monthStr = String(selectedMonth).padStart(2, "0");
    const yearMonthPrefix = `${selectedYearCE}-${monthStr}-`;

    attendanceRecords.forEach((att) => {
      if (!att.date || !att.date.startsWith(yearMonthPrefix)) return;
      if (att.dormId && att.dormId !== currentDorm.id && !att.dormId.includes(currentDorm.name)) return;

      const dayNum = parseInt(att.date.split("-")[2], 10);
      if (isNaN(dayNum)) return;

      if (att.records && Array.isArray(att.records)) {
        att.records.forEach((rec) => {
          if (!map[rec.studentId]) {
            map[rec.studentId] = {};
          }
          const mappedCode = ATTENDANCE_CODE_MAPPING[rec.status] || (rec.status ? "✓" : "");
          map[rec.studentId][dayNum] = mappedCode;
        });
      }
    });

    return map;
  }, [dataMode, attendanceRecords, selectedMonth, selectedYearCE, currentDorm]);

  // Generate HTML for current dorm
  const generatedHtml = useMemo(() => {
    if (!currentDorm) return "";
    return exportDormRegisterBookHtml({
      dorm: currentDorm,
      year: selectedYearCE,
      month: selectedMonth,
      students: dormStudents,
      attendanceRecords,
      systemSettings,
      orientation,
      mode: dataMode,
      studentsPerPage: effectiveRowsPerPage
    });
  }, [
    currentDorm,
    selectedYearCE,
    selectedMonth,
    dormStudents,
    attendanceRecords,
    systemSettings,
    orientation,
    dataMode,
    effectiveRowsPerPage
  ]);

  // Handle direct print
  const handlePrint = () => {
    triggerPrintDormBook(
      generatedHtml,
      `สมุดเช็คยอด_${currentDorm?.name || "หอพัก"}_เดือน${THAI_MONTHS[selectedMonth - 1]}_${selectedYearBE}`
    );
  };

  // Handle Download HTML
  const handleDownloadHtml = () => {
    const blob = new Blob([generatedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `สมุดเช็คยอดนักเรียน_${currentDorm?.name || "หอพัก"}_เดือน${THAI_MONTHS[selectedMonth - 1]}_${selectedYearBE}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const monthName = THAI_MONTHS[selectedMonth - 1] || "";
  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";

  return (
    <div className="space-y-6 pb-16 animate-fade-in text-slate-800">
      {/* Top Banner & Control Center */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#A05AFF] to-[#C084FC] flex items-center justify-center text-white shadow-md shadow-purple-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>สมุดเช็คยอดนักเรียนประจำเดือน (พิมพ์รายเดือน A4)</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-[#A05AFF] border border-purple-200">
                    พิมพ์เดือนละครั้ง
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  หัวตารางระบุเดือนและปี พ.ศ. พร้อมตารางรายชื่อนักเรียน วันที่ 1 - สิ้นเดือน ไฮไลท์สีวันหยุด และคำอธิบายสัญลักษณ์ท้ายตาราง
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>กลับหน้าข้อมูลหอพัก</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="ดาวน์โหลดเป็นไฟล์ HTML ไว้เปิดสั่งพิมพ์หรือเก็บไว้ในเครื่อง"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>ดาวน์โหลด HTML</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A05AFF] to-[#8E3CFF] hover:opacity-95 text-xs font-extrabold text-white transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-purple-200"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์สมุดเช็คยอด (A4 Print)</span>
            </button>
          </div>
        </div>

        {/* Filters & Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-5">
          {/* Select Dorm */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5">
              1. เลือกหอพักนักเรียน
            </label>
            <select
              value={selectedDormId}
              onChange={(e) => {
                setSelectedDormId(e.target.value);
                setPreviewPage(0);
              }}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
            >
              {dorms.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type === "male" ? "ชาย" : d.type === "female" ? "หญิง" : "รวม"})
                </option>
              ))}
            </select>
          </div>

          {/* Select Month */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5">
              2. เลือกเดือนที่จะพิมพ์
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
            >
              {THAI_MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  เดือน{m} {idx + 1 === 10 ? "⭐ (แนะนำ)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Select Year BE */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5">
              3. เลือกปี พ.ศ.
            </label>
            <select
              value={selectedYearBE}
              onChange={(e) => setSelectedYearBE(Number(e.target.value))}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
            >
              <option value={2568}>พ.ศ. 2568</option>
              <option value={2569}>พ.ศ. 2569 (ปีปัจจุบัน)</option>
              <option value={2570}>พ.ศ. 2570</option>
              <option value={2571}>พ.ศ. 2571</option>
            </select>
          </div>

          {/* Select Orientation */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5">
              4. ขนาดและทิศทาง A4
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  orientation === "landscape"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                แนวนอน (A4)
              </button>
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  orientation === "portrait"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                แนวตั้ง (A4)
              </button>
            </div>
          </div>

          {/* Select Data Mode */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5">
              5. รูปแบบช่องเช็คยอด
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setDataMode("blank")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dataMode === "blank"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="ตารางเปล่าสำหรับครูนำไปเดินตรวจและติ๊กมือ"
              >
                สมุดเปล่า (ติ๊กมือ)
              </button>
              <button
                type="button"
                onClick={() => setDataMode("filled")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dataMode === "filled"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="ดึงข้อมูลการเช็คที่บันทึกแล้วในระบบ"
              >
                ดึงข้อมูลในระบบ
              </button>
            </div>
          </div>
        </div>

        {/* Secondary options toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">เรียงตาม:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
              >
                <option value="grade_room_no">ชั้น/ห้อง ตามด้วยเลขที่ (จากน้อยไปมาก) ⭐</option>
                <option value="no">เลขที่นักเรียน (No.)</option>
                <option value="room">ห้องนอน / เตียง</option>
                <option value="grade">ชั้น / ห้องเรียน</option>
                <option value="name">ชื่อ - นามสกุล</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">จำนวนแถวต่อหน้า:</span>
              <select
                value={rowsPerPageOption}
                onChange={(e) => {
                  setRowsPerPageOption(e.target.value as any);
                  setPreviewPage(0);
                }}
                className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
              >
                <option value="auto">พอดีหน้า A4 (Auto: {orientation === "landscape" ? "22" : "28"} คน)</option>
                <option value="18">18 คน / หน้า</option>
                <option value="22">22 คน / หน้า</option>
                <option value="26">26 คน / หน้า</option>
                <option value="30">30 คน / หน้า</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              พบนักเรียน <strong className="text-purple-700 font-extrabold">{dormStudents.length}</strong> คน
              ({totalPages} หน้า A4)
            </span>
          </div>
        </div>
      </div>

      {/* Legend & Abbreviation Information Card */}
      <div className="bg-gradient-to-r from-purple-50/70 via-slate-50 to-emerald-50/60 rounded-2xl p-4 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-[#A05AFF] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-800">
              คำอธิบายสัญลักษณ์และอักษรย่อท้ายตาราง:
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-1 text-[11px] text-slate-600">
              {ATTENDANCE_LEGEND_ITEMS.map((item) => (
                <span key={item.code} className="inline-flex items-center gap-1">
                  <strong className="text-purple-900 bg-white px-1 rounded border border-purple-200">
                    {item.code}
                  </strong>
                  <span>= {item.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-[11px] text-rose-700 font-bold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          <span>ตารางไฮไลท์สีชมพู/แดงอ่อน = เสาร์-อาทิตย์ & วันหยุดนักขัตฤกษ์</span>
        </div>
      </div>

      {/* Interactive Print Preview Area */}
      <div className="bg-slate-200/70 rounded-3xl p-4 sm:p-6 border border-slate-300/80 shadow-inner">
        {/* Preview Toolbar */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-300 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-700" />
            <span className="font-black text-slate-800">
              ตัวอย่างการพิมพ์บนกระดาษ A4 ({orientation === "landscape" ? "แนวนอน Landscape" : "แนวตั้ง Portrait"})
            </span>
            <span className="text-slate-500 font-bold">
              (หน้า {previewPage + 1} จาก {totalPages})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-300 shadow-2xs">
                <button
                  type="button"
                  disabled={previewPage === 0}
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  {previewPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={previewPage >= totalPages - 1}
                  onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-700"
                title="ย่อขนาด"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-bold text-slate-700">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-700"
                title="ขยายขนาด"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-2 py-0.5 text-[11px] font-bold text-purple-700 hover:bg-purple-50 rounded cursor-pointer"
              >
                100%
              </button>
            </div>
          </div>
        </div>

        {/* Paper Sheet Preview Container */}
        <div className="overflow-x-auto pb-4 flex justify-center">
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out"
            }}
          >
            {/* Single A4 Page Sheet */}
            <div
              ref={printAreaRef}
              className={`bg-white rounded-sm shadow-xl border border-slate-300/80 p-6 md:p-8 select-text ${
                orientation === "landscape" ? "w-[1080px] min-h-[760px]" : "w-[800px] min-h-[1100px]"
              }`}
            >
              {/* Document Header */}
              <div className="text-center mb-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {schoolName}
                </div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                  สมุดเช็คยอดนักเรียนประจำเดือน เดือน{monthName} พ.ศ. {selectedYearBE}
                </h1>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b-2 border-slate-800 pb-2 mt-2">
                  <div>
                    <span>หอพัก: </span>
                    <strong className="text-purple-900">{currentDorm?.name}</strong>
                    <span className="text-slate-500 font-normal">
                      {" "}
                      ({currentDorm?.type === "male" ? "หอพักชาย" : currentDorm?.type === "female" ? "หอพักหญิง" : "หอพักรวม"})
                    </span>
                  </div>
                  <div>
                    <span>ครูประจำหอพัก: </span>
                    <strong className="text-slate-800">{teacherNameDisplay}</strong>
                  </div>
                  <div>
                    <span>นักเรียนทั้งหมด: </span>
                    <strong className="text-slate-800">{dormStudents.length}</strong> คน
                  </div>
                  <div className="text-slate-500">
                    หน้า {previewPage + 1} / {totalPages}
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th
                        rowSpan={2}
                        className="border border-slate-400 px-1.5 py-1 text-center w-8 text-[11px]"
                      >
                        เลขที่
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 px-2 py-1 text-left min-w-[150px] text-[11px]"
                      >
                        ชื่อ - สกุล นักเรียน
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 px-1.5 py-1 text-center w-12 text-[11px]"
                      >
                        ชื่อเล่น
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-400 px-1.5 py-1 text-center w-14 text-[11px]"
                      >
                        ชั้น/ห้อง
                      </th>
                      <th
                        colSpan={daysInMonth}
                        className="border border-slate-400 py-1 text-center font-bold text-[11px] bg-slate-200"
                      >
                        ตารางวันที่ 1 - สิ้นเดือน (ไฮไลท์สีวันหยุด)
                      </th>
                    </tr>
                    <tr className="bg-slate-50 text-[10px]">
                      {daysArray.map((day) => {
                        const dayInfo = isWeekendOrHoliday(selectedYearCE, selectedMonth, day);
                        const isHoliday = dayInfo.isHoliday;
                        return (
                          <th
                            key={day}
                            className={`border border-slate-400 py-0.5 text-center font-bold ${
                              orientation === "landscape" ? "w-[24px]" : "w-[18px]"
                            } ${isHoliday ? "bg-rose-100 text-rose-800 font-extrabold" : "text-slate-700"}`}
                            title={dayInfo.holidayName ? `${day}: ${dayInfo.holidayName}` : `${day} (${dayInfo.dayOfWeekName})`}
                          >
                            {day}
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-slate-100 text-[9px] text-slate-500 font-medium">
                      <th colSpan={4} className="border border-slate-300 text-right pr-2 py-0.5">
                        วันในสัปดาห์:
                      </th>
                      {daysArray.map((day) => {
                        const dayInfo = isWeekendOrHoliday(selectedYearCE, selectedMonth, day);
                        const isHoliday = dayInfo.isHoliday;
                        return (
                          <th
                            key={`dow-${day}`}
                            className={`border border-slate-300 text-center py-0.5 ${
                              isHoliday ? "bg-rose-100 text-rose-800 font-bold" : "text-slate-600"
                            }`}
                          >
                            {dayInfo.dayOfWeekName}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {studentPages[previewPage]?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={daysInMonth + 4}
                          className="border border-slate-300 py-8 text-center text-slate-400"
                        >
                          ไม่มีข้อมูลนักเรียนในหอพักนี้
                        </td>
                      </tr>
                    ) : (
                      studentPages[previewPage]?.map((std, idx) => {
                        const rowNo = previewPage * effectiveRowsPerPage + idx + 1;
                        const fullName = `${std.title || ""}${std.firstName || ""} ${std.lastName || ""}`.trim();
                        const nickname = std.nickname ? std.nickname : "-";
                        const gradeRoom = formatGradeRoomShort(std.grade, std.room);
                        const isEven = idx % 2 === 0;

                        return (
                          <tr
                            key={std.id || idx}
                            className={`${isEven ? "bg-white" : "bg-slate-50/70"} hover:bg-purple-50/30`}
                          >
                            <td className="border border-slate-300 text-center font-bold text-slate-700 py-1 text-[11px]">
                              {std.no || rowNo}
                            </td>
                            <td className="border border-slate-300 text-left px-2 py-1 font-medium text-slate-900 whitespace-nowrap text-[11px]">
                              {fullName}
                            </td>
                            <td className="border border-slate-300 text-center px-1 py-1 text-slate-600 whitespace-nowrap text-[10.5px]">
                              {nickname}
                            </td>
                            <td className="border border-slate-300 text-center px-1 py-1 font-bold text-slate-700 whitespace-nowrap text-[10.5px]">
                              {gradeRoom}
                            </td>
                            {daysArray.map((day) => {
                              const dayInfo = isWeekendOrHoliday(selectedYearCE, selectedMonth, day);
                              const isHoliday = dayInfo.isHoliday;

                              let cellText = "";
                              let textStyle = "";
                              if (dataMode === "filled") {
                                const code = studentDailyCodes[std.studentId]?.[day] || "";
                                if (code === "✓") {
                                  cellText = "✓";
                                  textStyle = "text-emerald-700 font-extrabold text-[11px]";
                                } else if (code === "รบ") {
                                  cellText = "รบ";
                                  textStyle = "text-amber-800 font-bold bg-amber-100 text-[9px]";
                                } else if (code) {
                                  cellText = code;
                                  textStyle = "text-rose-700 font-bold text-[9px]";
                                }
                              }

                              return (
                                <td
                                  key={`cell-${std.id}-${day}`}
                                  className={`border border-slate-300 text-center py-0.5 px-0 h-6 ${
                                    isHoliday ? "bg-rose-50/70" : ""
                                  } ${textStyle}`}
                                >
                                  {cellText}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Document Footer: Legend & Signatures */}
              <div className="mt-4 pt-2 border-t border-slate-300">
                {/* Legend Box */}
                <div className="border border-slate-400 bg-slate-50/80 rounded-md p-2 text-[10px] text-slate-800">
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-slate-900">คำอธิบายสัญลักษณ์และอักษรย่อ:</span>
                    <span className="text-rose-700 font-bold text-[9px]">
                      (ช่องสีชมพู/แดงอ่อน = วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1 text-[9.5px]">
                    {ATTENDANCE_LEGEND_ITEMS.map((item) => (
                      <div key={item.code} className="flex items-center gap-1">
                        <strong className="text-purple-900">{item.code}</strong>
                        <span>= {item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
