import React, { useState, useMemo, useRef } from "react";
import { toPng, toBlob } from "html-to-image";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  DEFAULT_SYSTEM_SETTINGS,
  detectStudentGender,
  formatGradeRoomShort,
  formatThaiFullDate,
  formatThaiMediumDate,
  getTodayDateString,
  getYesterdayDateString
} from "../../utils/dateUtils";
import { exportDormitoryReportHtmlDocument } from "../../utils/dormitoryReportExporter";
import {
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode,
  FileText,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Printer,
  Share2,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
  X
} from "lucide-react";

interface DormitorySummaryReportViewProps {
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  isLoading?: boolean;
}

// Reason mappings
const REASON_CONFIGS: Record<string, { label: string; color: string; bg: string; text: string }> = {
  ROUND_HOME: { label: "รอบกลับบ้าน", color: "#64748b", bg: "bg-slate-100", text: "text-slate-700" },
  HOME: { label: "กลับบ้าน", color: "#f97316", bg: "bg-orange-100", text: "text-orange-700" },
  CAMP: { label: "เข้าค่าย", color: "#1d4ed8", bg: "bg-blue-100", text: "text-blue-700" },
  SICK: { label: "ป่วย", color: "#f43f5e", bg: "bg-rose-100", text: "text-rose-700" },
  SKILL_COMP: { label: "แข่งทักษะ", color: "#a855f7", bg: "bg-purple-100", text: "text-purple-700" },
  EXCHANGE: { label: "แลกเปลี่ยน", color: "#0ea5e9", bg: "bg-sky-100", text: "text-sky-700" },
  OTHER: { label: "อื่น", color: "#d97706", bg: "bg-amber-100", text: "text-amber-700" }
};

// Helper: Get clean reason text based on status and check data
const getAttendanceReasonText = (status?: string, reason?: string, note?: string): string => {
  if (status === "ROUND_HOME") return "รอบกลับบ้าน";
  if (status === "HOME") {
    if (reason && reason.trim() && !reason.includes("กลับบ้าน/ธุระครอบครัว")) return reason.trim();
    return "กลับบ้าน";
  }
  if (status === "CAMP") {
    if (reason && reason.trim() && !reason.includes("เข้าค่ายวิชาการ")) return reason.trim();
    return "เข้าค่าย";
  }
  if (status === "SICK") {
    if (reason && reason.trim() && !reason.includes("ป่วย/รักษาพยาบาล")) return reason.trim();
    return "ป่วย";
  }
  if (status === "SKILL_COMP") {
    if (reason && reason.trim() && !reason.includes("แข่งขันทักษะวิชาการ")) return reason.trim();
    return "แข่งทักษะ";
  }
  if (status === "EXCHANGE") {
    if (reason && reason.trim() && !reason.includes("นักเรียนแลกเปลี่ยน")) return reason.trim();
    return "แลกเปลี่ยน";
  }
  if (status === "OTHER") {
    if (reason && reason.trim() && !reason.includes("อื่นๆ/ลากิจ")) return reason.trim();
    if (note && note.trim()) return note.trim();
    return "อื่น";
  }
  if (reason && reason.trim()) return reason.trim();
  if (note && note.trim()) return note.trim();
  return REASON_CONFIGS[status || "OTHER"]?.label || "ไม่ระบุสาเหตุ";
};

// Safe formatter for check time to eliminate "Invalid Date"
const formatCheckedTime = (val?: string): string | null => {
  if (!val || typeof val !== "string") return null;
  const clean = val.trim();
  if (!clean || clean === "Invalid Date" || clean.toLowerCase().includes("invalid")) {
    return null;
  }
  // Check if string is already formatted as HH:mm or HH:mm:ss
  const timeMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, "0");
    const mm = timeMatch[2];
    return `${hh}:${mm}`;
  }
  // Parse standard Date / ISO
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const formatted = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    if (!formatted || formatted.includes("Invalid")) return null;
    return formatted;
  }
  return null;
};

export const DormitorySummaryReportView: React.FC<DormitorySummaryReportViewProps> = ({
  students = [],
  dorms = [],
  attendanceRecords = [],
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  currentUser,
  isLoading = false
}) => {
  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  // Date selection state
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Accessible Dormitories Logic:
  // - Admin (ผู้ดูแล) & Staff (เจ้าหน้าที่): Allowed to view and select ALL dormitories
  // - Dorm Teacher (ครูหอพัก): Allowed to view and select ONLY their own dormitory (หอพักตัวเอง)
  const accessibleDorms = useMemo(() => {
    if (!currentUser) return dorms;

    const isAdminOrStaff =
      currentUser.roleLevel === 1 ||
      currentUser.roleLevel === 2 ||
      currentUser.roleCategory === "ADMIN" ||
      currentUser.roleCategory === "STAFF" ||
      currentUser.role === "SYSTEM_ADMIN" ||
      currentUser.role === "ADMIN_OFFICER" ||
      currentUser.role === "HEAD_TEACHER" ||
      currentUser.role === "DEPUTY_DIRECTOR";

    if (isAdminOrStaff) {
      return dorms;
    }

    // ครูหอพัก: แสดงเฉพาะหอพักของตัวเอง
    if (currentUser.allowedDormIds && currentUser.allowedDormIds.length > 0) {
      const allowed = dorms.filter((d) => currentUser.allowedDormIds?.includes(d.id));
      if (allowed.length > 0) return allowed;
    }

    if (currentUser.dormId) {
      const userDorm = dorms.filter((d) => d.id === currentUser.dormId);
      if (userDorm.length > 0) return userDorm;
    }

    return dorms;
  }, [dorms, currentUser]);

  // Dormitory selection state: Default to assigned dorm within accessible dorms, or first accessible dorm
  const defaultDormId = useMemo(() => {
    if (currentUser?.dormId && accessibleDorms.some((d) => d.id === currentUser.dormId)) {
      return currentUser.dormId;
    }
    if (accessibleDorms.length > 0) return accessibleDorms[0].id;
    if (dorms.length > 0) return dorms[0].id;
    return "dorm-1";
  }, [currentUser, accessibleDorms, dorms]);

  const [selectedDormId, setSelectedDormId] = useState<string>(defaultDormId);

  // Sync selectedDormId if accessibleDorms change
  React.useEffect(() => {
    if (accessibleDorms.length > 0 && !accessibleDorms.some((d) => d.id === selectedDormId)) {
      setSelectedDormId(accessibleDorms[0].id);
    }
  }, [accessibleDorms, selectedDormId]);

  // Card reference for screenshot capture
  const captureCardRef = useRef<HTMLDivElement>(null);

  // Screenshot capture states
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Active Dormitory Object
  const currentDorm = useMemo(() => {
    return dorms.find((d) => d.id === selectedDormId) || dorms[0] || {
      id: selectedDormId,
      name: "หอพัก 1",
      type: "male",
      gender: "male",
      capacity: 80
    };
  }, [dorms, selectedDormId]);

  // Filter students belonging to this dormitory
  const dormStudents = useMemo(() => {
    return students.filter((s) => s.dormId === selectedDormId);
  }, [students, selectedDormId]);

  // 1. Calculations: Total, Male, Female Students
  const totalStudentsInDorm = dormStudents.length;
  const maleStudentsCount = useMemo(() => {
    return dormStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length;
  }, [dormStudents]);
  const femaleStudentsCount = useMemo(() => {
    return dormStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length;
  }, [dormStudents]);

  // 2. Attendance data for selected dormitory and selected date
  const attendanceForDate = useMemo(() => {
    return attendanceRecords.find((att) => att.date === selectedDate && att.dormId === selectedDormId);
  }, [attendanceRecords, selectedDate, selectedDormId]);

  const isHomeBreak = attendanceForDate?.isHomeBreak || attendanceForDate?.status === "HOME_BREAK";

  // Orientation Notes list
  const orientationNotesList: string[] = useMemo(() => {
    const notes = attendanceForDate?.teacherOrientationNotes || (attendanceForDate as any)?.orientationNotes || [];
    if (Array.isArray(notes)) {
      return notes.filter((n: string) => typeof n === "string" && n.trim().length > 0);
    }
    if (typeof notes === "string" && (notes as string).trim().length > 0) {
      return [(notes as string).trim()];
    }
    return [];
  }, [attendanceForDate]);

  // Process Absent / Present Students
  const { absentList, presentCount, outCount, reasonsSummary } = useMemo(() => {
    const absents: Array<{
      index: number;
      studentNo?: number;
      studentId: string;
      fullName: string;
      gradeRoom: string;
      grade: string;
      room?: number;
      reason: string;
      status: string;
      statusLabel: string;
    }> = [];

    const reasonCounts: Record<string, { label: string; count: number; color: string }> = {};

    if (isHomeBreak) {
      dormStudents.forEach((s, idx) => {
        absents.push({
          index: idx + 1,
          studentNo: s.no,
          studentId: s.studentId,
          fullName: `${s.title}${s.firstName} ${s.lastName}`,
          gradeRoom: formatGradeRoomShort(s.grade, s.room),
          grade: s.grade,
          room: s.room,
          reason: "รอบกลับบ้าน",
          status: "ROUND_HOME",
          statusLabel: "รอบกลับบ้าน"
        });
      });

      reasonCounts["ROUND_HOME"] = {
        label: "รอบกลับบ้าน",
        count: dormStudents.length,
        color: "#64748b"
      };
    } else if (attendanceForDate?.records && Array.isArray(attendanceForDate.records)) {
      attendanceForDate.records.forEach((rec) => {
        if (rec.status && rec.status !== "PRESENT") {
          const s = dormStudents.find((st) => st.studentId === rec.studentId);
          const fullName = s ? `${s.title}${s.firstName} ${s.lastName}` : rec.studentName || rec.studentId;
          const gradeRoom = s ? formatGradeRoomShort(s.grade, s.room) : "-";
          const reasonText = getAttendanceReasonText(rec.status, rec.reason, rec.note);
          const statusConfig = REASON_CONFIGS[rec.status] || { label: rec.status, color: "#64748b" };

          absents.push({
            index: absents.length + 1,
            studentNo: s?.no,
            studentId: rec.studentId,
            fullName,
            gradeRoom,
            grade: s?.grade || "",
            room: s?.room,
            reason: reasonText,
            status: rec.status,
            statusLabel: statusConfig.label
          });

          const groupKey = rec.status || "OTHER";
          if (!reasonCounts[groupKey]) {
            reasonCounts[groupKey] = {
              label: statusConfig.label,
              count: 0,
              color: statusConfig.color
            };
          }
          reasonCounts[groupKey].count += 1;
        }
      });
    }

    const getGradeWeight = (g: string) => {
      if (g.includes("1")) return 1;
      if (g.includes("2")) return 2;
      if (g.includes("3")) return 3;
      if (g.includes("4")) return 4;
      if (g.includes("5")) return 5;
      if (g.includes("6")) return 6;
      return 99;
    };

    absents.sort((a, b) => {
      const gA = getGradeWeight(a.grade);
      const gB = getGradeWeight(b.grade);
      if (gA !== gB) return gA - gB;
      const rA = a.room || 0;
      const rB = b.room || 0;
      if (rA !== rB) return rA - rB;
      const noA = a.studentNo ?? 9999;
      const noB = b.studentNo ?? 9999;
      if (noA !== noB) return noA - noB;
      return a.studentId.localeCompare(b.studentId);
    });

    absents.forEach((item, i) => {
      item.index = i + 1;
    });

    const totalOut = absents.length;
    const totalPresent = Math.max(0, totalStudentsInDorm - totalOut);

    const sortedReasons = Object.entries(reasonCounts)
      .map(([key, data], idx) => ({
        index: idx + 1,
        key,
        label: data.label,
        count: data.count,
        percentOfOut: totalOut > 0 ? (data.count / totalOut) * 100 : 0,
        percentOfTotal: totalStudentsInDorm > 0 ? (data.count / totalStudentsInDorm) * 100 : 0,
        color: data.color
      }))
      .sort((a, b) => b.count - a.count);

    sortedReasons.forEach((r, i) => {
      r.index = i + 1;
    });

    return {
      absentList: absents,
      presentCount: totalPresent,
      outCount: totalOut,
      reasonsSummary: sortedReasons
    };
  }, [isHomeBreak, attendanceForDate, dormStudents, totalStudentsInDorm]);

  // 3. Percentages
  const presentPercent = totalStudentsInDorm > 0 ? (presentCount / totalStudentsInDorm) * 100 : 100;
  const outPercent = totalStudentsInDorm > 0 ? (outCount / totalStudentsInDorm) * 100 : 0;

  // 4. Grade breakdown inside this dormitory
  const gradeStats = useMemo(() => {
    const grades = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
    return grades.map((g) => {
      const gStudents = dormStudents.filter((s) => s.grade === g);
      const total = gStudents.length;
      const male = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length;
      const female = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length;
      const gOut = absentList.filter((a) => a.grade === g).length;
      const gPresent = Math.max(0, total - gOut);
      const rate = total > 0 ? (gPresent / total) * 100 : 100;

      return {
        grade: g,
        male,
        female,
        total,
        present: gPresent,
        out: gOut,
        rate
      };
    });
  }, [dormStudents, absentList]);

  // Formatted date string
  const formattedDateStr = formatThaiFullDate(selectedDate);

  // Capture Screenshot & Share to LINE Handler
  const handleCaptureScreenshot = async () => {
    if (!captureCardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      // Render high-resolution PNG using browser-native SVG foreignObject (supports oklab/oklch colors)
      const dataUrl = await toPng(captureCardRef.current, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true
      });

      setCapturedImageUrl(dataUrl);
      setShowCaptureModal(true);

      // 1. Try to copy image directly to Clipboard
      try {
        const blob = await toBlob(captureCardRef.current, {
          pixelRatio: 2.5,
          backgroundColor: "#ffffff",
          cacheBust: true
        });

        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob
            })
          ]);
          setCopyImageSuccess(true);
          setTimeout(() => setCopyImageSuccess(false), 3500);
        }
      } catch (err) {
        console.warn("Direct clipboard image copy not supported on this device/browser:", err);
      }

      // 2. Trigger automated download of PNG file
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `สรุปยอดหอพัก_${currentDorm.name}_${selectedDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
      alert("เกิดข้อผิดพลาดในการแคปหน้าจอ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCapturing(false);
    }
  };

  // Copy Image Button inside modal
  const handleCopyImageAgain = () => {
    if (!capturedImageUrl) return;
    fetch(capturedImageUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob
            })
          ]);
          setCopyImageSuccess(true);
          setTimeout(() => setCopyImageSuccess(false), 3000);
        } else {
          alert("เบราว์เซอร์นี้ไม่รองรับการคัดลอกรูปภาพโดยตรง กรุณากดบันทึกรูปภาพแทน");
        }
      })
      .catch((e) => console.error(e));
  };

  // Download image again
  const handleDownloadImageAgain = () => {
    if (!capturedImageUrl) return;
    const link = document.createElement("a");
    link.href = capturedImageUrl;
    link.download = `สรุปยอดหอพัก_${currentDorm.name}_${selectedDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy plain text summary (Formatted as requested)
  const handleCopyText = () => {
    const lines = [
      `รายงานสรุปรายหอพัก: ${currentDorm.name}`,
      `สรุปยอดประจำวัน: ${formattedDateStr}`,
      `-----------------------------`,
      `รายละเอียดสรุปยอดประจำวันของ ${currentDorm.name}`,
      `นักเรียนในหอพัก ${totalStudentsInDorm} คน`,
      `นักเรียนชาย จำนวน ${maleStudentsCount} คน`,
      `นักเรียนหญิง จำนวน ${femaleStudentsCount} คน`,
      `-----------------------------`,
      `นักเรียนอยู่หอพัก จำนวน ${presentCount} คน คิดเป็นร้อยละ ${presentPercent.toFixed(1)}%`,
      `นักเรียนออกหอพัก  จำนวน ${outCount} คน คิดเป็นร้อยละ ${outPercent.toFixed(1)}%`,
      `สาเหตุที่ออกหอพัก:`
    ];

    if (reasonsSummary.length === 0) {
      lines.push(`(ไม่มีนักเรียนออกหอพัก)`);
    } else {
      reasonsSummary.forEach((r) => {
        lines.push(`${r.index}. ${r.label} จำนวน ${r.count} คน คิดเป็นร้อยละ ${r.percentOfTotal.toFixed(1)}%`);
      });
    }

    lines.push(`-----------------------------`);
    lines.push(`เรื่องการอบรม:`);
    if (orientationNotesList.length > 0) {
      orientationNotesList.forEach((n, idx) => {
        lines.push(`${idx + 1}. ${n}`);
      });
    } else {
      lines.push(`- ไม่มีบันทึกเรื่องการอบรม -`);
    }

    if (attendanceForDate?.checkedBy) {
      lines.push(`ผู้บันทึกการเช็คยอด: ${attendanceForDate.checkedBy}`);
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    });
  };

  // Export HTML / Printable Document
  const handleExportHtml = () => {
    exportDormitoryReportHtmlDocument({
      dormId: currentDorm.id,
      dormName: currentDorm.name,
      dormType: (currentDorm.type || currentDorm.gender || "all") as any,
      reportDate: selectedDate,
      dateText: formattedDateStr,
      systemSettings,
      currentUser,
      totalStudents: totalStudentsInDorm,
      maleStudents: maleStudentsCount,
      femaleStudents: femaleStudentsCount,
      presentCount,
      presentPercent,
      outCount,
      outPercent,
      reasons: reasonsSummary,
      gradeStats,
      absentList,
      isHomeBreak,
      orientationNotes: orientationNotesList.length > 0 ? orientationNotesList.join("\n") : undefined
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Toolbar: Dorm Selector & Date Picker */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-purple-700 uppercase">
              <Home className="w-4 h-4" />
              <span>Dormitory Summary Report</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>รายงานสรุปรายหอพัก</span>
              <span className="text-purple-600 font-extrabold text-base bg-purple-50 px-3 py-0.5 rounded-xl border border-purple-100">
                {currentDorm.name}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงข้อมูลสถิติยอดอยู่/ออกหอพักและจำแนกสาเหตุตามการล็อคอินเข้าสู่ระบบ
            </p>
          </div>

          {/* Action Buttons: Capture Screenshot for LINE, Print, & Copy Text */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action: Capture Screenshot for LINE */}
            <button
              onClick={handleCaptureScreenshot}
              disabled={isCapturing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-200/80 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              title="แคปหน้าจอรูปภาพสรุปยอดที่จัดรูปแบบสวยงาม เพื่อส่งเข้ากลุ่ม LINE ทันที"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังแคปหน้าจอ...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>📸 แคปหน้าจอส่ง LINE</span>
                </>
              )}
            </button>

            {/* Secondary Action: Print A4 */}
            <button
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-md shadow-purple-200 cursor-pointer transition-all hover:scale-[1.02]"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน A4 (PDF)</span>
            </button>

            {/* Fallback Text Copy */}
            <button
              onClick={handleCopyText}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                copiedText
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
              title="คัดลอกข้อความสรุปเป็นตัวอักษร"
            >
              {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedText ? "คัดลอกข้อความแล้ว" : "คัดลอกข้อความ"}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Dormitory Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>เลือกหอพัก:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {accessibleDorms.map((d) => {
                const isSelected = d.id === selectedDormId;
                const isUserDorm = currentUser?.dormId === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDormId(d.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-sm shadow-purple-200 ring-2 ring-purple-300"
                        : "bg-slate-50 hover:bg-purple-50 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <span>{d.name}</span>
                    {isUserDorm && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isSelected ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"}`}>
                        หอของคุณ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>วันที่:</span>
            </span>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                selectedDate === todayStr ? "bg-purple-100 text-purple-800" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              วันนี้
            </button>
            <button
              onClick={() => setSelectedDate(yesterdayStr)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                selectedDate === yesterdayStr ? "bg-purple-100 text-purple-800" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              เมื่อวาน
            </button>
          </div>
        </div>

        {/* User context indicator */}
        {currentUser && (
          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span>
                ผู้เข้าสู่ระบบ: <strong>{currentUser.name}</strong> ({currentUser.roleLabel || currentUser.roleCategoryName})
              </span>
            </div>
            <div className="text-[11px] font-semibold text-purple-700">
              {currentUser.roleLevel === 1 || currentUser.roleLevel === 2
                ? "สิทธิ์การเข้าถึง: แสดงและเลือกได้ทุกหอพัก"
                : `หอพักประจำตัว: ${dorms.find((d) => d.id === currentUser.dormId)?.name || currentUser.dormId || currentDorm.name}`}
            </div>
          </div>
        )}
      </div>

      {/* Main Formatted Summary Card (Target for Screenshot Capture & Line Sharing) */}
      <div
        ref={captureCardRef}
        id="dorm-summary-capture-card"
        className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-200/90 shadow-sm relative overflow-hidden space-y-6"
      >
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-100/50 via-indigo-50/30 to-transparent rounded-bl-full pointer-events-none -mr-8 -mt-8"></div>

        <div className="max-w-5xl mx-auto space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2 pb-5 border-b border-slate-100">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/90 text-purple-900 text-xs font-black">
              <Building2 className="w-4 h-4 text-purple-700" />
              <span>สรุปรายละเอียดประจำหอพัก</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {currentDorm.name}
            </h3>
            <p className="text-xs sm:text-sm font-bold text-slate-500">
              สรุปยอดประจำวัน {formattedDateStr}
            </p>
          </div>

          {/* 2-Column Grid Layout: Left = รายละเอียดสรุปยอดประจำวัน, Right = เรื่องการอบรม */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: รายละเอียดสรุปยอดประจำวันของ {currentDorm.name} */}
            <div className="lg:col-span-6 bg-slate-50/90 rounded-3xl p-5 sm:p-6 border border-slate-200 space-y-5 font-sans shadow-2xs flex flex-col justify-between">
              <div className="space-y-5">
                {/* Title inside left column */}
                <div className="text-sm font-black text-purple-950 flex items-center gap-2.5 pb-2 border-b border-slate-200/80">
                  <span className="w-3 h-3 rounded-full bg-purple-600 shadow-xs"></span>
                  <span>รายละเอียดสรุปยอดประจำวันของ {currentDorm.name}</span>
                </div>

                {/* Section 1: ข้อมูลนักเรียนในหอพัก */}
                <div className="space-y-2.5">
                  {/* นักเรียนในหอพัก รวม */}
                  <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <span className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-900">
                      <Users className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>นักเรียนในหอพัก</span>
                    </span>
                    <span className="text-purple-700 font-black text-base sm:text-lg">
                      {totalStudentsInDorm} <span className="text-xs font-normal text-slate-500">คน</span>
                    </span>
                  </div>

                  {/* ชาย / หญิง */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50/80 border border-blue-100 text-xs">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                        <span>ชาย</span>
                      </span>
                      <span className="font-black text-blue-800 text-sm">{maleStudentsCount} <span className="text-[11px] font-normal text-blue-600">คน</span></span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-pink-50/80 border border-pink-100 text-xs">
                      <span className="font-bold text-pink-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                        <span>หญิง</span>
                      </span>
                      <span className="font-black text-pink-800 text-sm">{femaleStudentsCount} <span className="text-[11px] font-normal text-pink-600">คน</span></span>
                    </div>
                  </div>
                </div>

                {/* Divider Line: ----------------------------- */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t-2 border-dashed border-slate-300"></div>
                  <span className="flex-shrink mx-3 px-2.5 py-0.5 bg-white rounded-full border border-slate-200 text-slate-500 text-[10px] font-mono font-black tracking-widest uppercase">
                    สรุปยอดคืนนี้
                  </span>
                  <div className="flex-grow border-t-2 border-dashed border-slate-300"></div>
                </div>

                {/* Section 2: นักเรียนอยู่ / นักเรียนออกหอพัก */}
                <div className="space-y-2.5">
                  {/* อยู่หอพัก */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="font-extrabold text-emerald-950 text-xs sm:text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>นักเรียนอยู่หอพัก</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-800 text-sm sm:text-base">
                        {presentCount} <span className="text-[11px] font-normal text-emerald-700">คน</span>
                      </span>
                      <span className="text-[11px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300">
                        {presentPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* ออกหอพัก */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="font-extrabold text-rose-950 text-xs sm:text-sm flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>นักเรียนออกหอพัก</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-rose-800 text-sm sm:text-base">
                        {outCount} <span className="text-[11px] font-normal text-rose-700">คน</span>
                      </span>
                      <span className="text-[11px] font-black text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-lg border border-rose-300">
                        {outPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: สาเหตุที่ออกหอพัก */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>สาเหตุที่ออกหอพัก</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-500">
                      รวม {outCount} คน
                    </span>
                  </div>

                  {reasonsSummary.length > 0 ? (
                    <div className="space-y-2">
                      {reasonsSummary.map((r) => (
                        <div
                          key={r.key}
                          className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-purple-200 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-black text-[10px] flex items-center justify-center shrink-0">
                              {r.index}
                            </span>
                            <span className="font-bold text-slate-800">{r.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">
                              <strong className="text-purple-700">{r.count}</strong> คน
                            </span>
                            <span className="text-[10px] font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                              {r.percentOfTotal.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-center">
                      <p className="text-xs font-bold text-emerald-800">
                        ✓ ไม่มีนักเรียนออกหอพักในวันนี้ (นักเรียนอยู่ครบ 100%)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: เรื่องการอบรม */}
            <div className="lg:col-span-6 bg-slate-50/90 rounded-3xl p-5 sm:p-6 border border-slate-200 space-y-4 font-sans shadow-2xs flex flex-col justify-between">
              <div className="space-y-4">
                {/* Title inside right column */}
                <div className="text-sm font-black text-purple-950 flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shadow-xs"></span>
                    <span>เรื่องการอบรม</span>
                  </div>
                  {attendanceForDate?.checkedBy && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-lg">
                      ผู้บันทึก: {attendanceForDate.checkedBy}
                    </span>
                  )}
                </div>

                {/* Training topics list */}
                {orientationNotesList.length > 0 ? (
                  <div className="space-y-3">
                    {orientationNotesList.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {idx + 1}
                          </span>
                          <span>หัวข้อที่ {idx + 1}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium pl-7 leading-relaxed whitespace-pre-wrap">
                          {note}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-white border border-slate-200/80 text-center space-y-2 flex flex-col items-center justify-center min-h-[220px]">
                    <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-amber-500" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-600">
                      ไม่มีบันทึกเรื่องการอบรม
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      สามารถระบุเรื่องการอบรมได้ในหน้าเช็คยอดประจำวัน
                    </p>
                  </div>
                )}
              </div>

              {/* Note footer */}
              <div className="pt-3 border-t border-slate-200/70 text-[11px] text-slate-400 flex items-center justify-between">
                <span>บันทึกการอบรมประจำหอพัก</span>
                {formatCheckedTime(attendanceForDate?.checkedAt) ? (
                  <span>เวลาเช็คยอด: {formatCheckedTime(attendanceForDate?.checkedAt)} น.</span>
                ) : (
                  <span>{formattedDateStr}</span>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Watermark in Capture Image */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
            <span>{systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล"}</span>
            <span>ระบบบริหารจัดการหอพักนักเรียน</span>
          </div>
        </div>
      </div>

      {/* Grid: Grade Breakdown & Absent Students List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table 1: สรุปสถิติข้อมูลแยกตามระดับชั้น (ม.1 - ม.6) ในหอพักนี้ */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>สรุปสถิติข้อมูลแยกตามระดับชั้น ({currentDorm.name})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">จำแนกตามชั้น ม.1 - ม.6</p>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200">ระดับชั้น</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-200">ชาย</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-200">หญิง</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-200">รวม</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-200">อยู่</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-200">ออก</th>
                  <th className="py-2.5 px-2 text-center">ร้อยละ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeStats.map((g) => (
                  <tr key={g.grade} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-100">{g.grade}</td>
                    <td className="py-2 px-2 text-center font-semibold text-blue-700 border-r border-slate-100">{g.male}</td>
                    <td className="py-2 px-2 text-center font-semibold text-pink-700 border-r border-slate-100">{g.female}</td>
                    <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-100">{g.total}</td>
                    <td className="py-2 px-2 text-center font-bold text-emerald-700 border-r border-slate-100">{g.present}</td>
                    <td className="py-2 px-2 text-center font-bold text-rose-600 border-r border-slate-100">{g.out}</td>
                    <td className="py-2 px-2 text-center font-extrabold text-purple-700">{g.rate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                <tr>
                  <td className="py-2.5 px-3 font-black text-slate-900 border-r border-slate-200">รวมทั้งหมด</td>
                  <td className="py-2.5 px-2 text-center font-bold text-blue-800 border-r border-slate-200">{maleStudentsCount}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-pink-800 border-r border-slate-200">{femaleStudentsCount}</td>
                  <td className="py-2.5 px-2 text-center font-black text-slate-900 border-r border-slate-200">{totalStudentsInDorm}</td>
                  <td className="py-2.5 px-2 text-center font-black text-emerald-800 border-r border-slate-200">{presentCount}</td>
                  <td className="py-2.5 px-2 text-center font-black text-rose-700 border-r border-slate-200">{outCount}</td>
                  <td className="py-2.5 px-2 text-center font-black text-purple-800">{presentPercent.toFixed(0)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table 2: รายชื่อนักเรียนที่มีการออกหอพักในวันนั้น (ลบคอลัมน์สถานะและเลขที่ออก, ชั้น/ห้องใช้แบบย่อ เช่น ม.1/1, สาเหตุใช้ตามสถานะ) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-rose-600" />
              <span>บัญชีรายชื่อนักเรียนที่มีการออกหอพัก ({absentList.length} คน)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">เรียงลำดับตามชั้น/ห้อง</p>
          </div>

          {absentList.length > 0 ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-2.5 text-center border-r border-slate-200 w-12">ลำดับ</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-200 w-24">รหัสนักเรียน</th>
                    <th className="py-2 px-3 border-r border-slate-200">ชื่อ - สกุล</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-200 w-20">ชั้น/ห้อง</th>
                    <th className="py-2 px-3">สาเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {absentList.map((st) => (
                    <tr key={st.studentId} className="hover:bg-slate-50 text-xs">
                      <td className="py-2 px-2.5 text-center font-semibold text-slate-500 border-r border-slate-100">{st.index}</td>
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-purple-900 border-r border-slate-100">{st.studentId}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-100">{st.fullName}</td>
                      <td className="py-2 px-2.5 text-center font-bold text-slate-800 border-r border-slate-100">{st.gradeRoom}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{st.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mb-2" />
              <h4 className="text-sm font-black text-emerald-900">นักเรียนอยู่ครบทุกคน</h4>
              <p className="text-xs text-emerald-700 mt-0.5">ไม่มีนักเรียนออกหอพักในวันที่เลือก ({formattedDateStr})</p>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot & Share to LINE Modal */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>แคปภาพสรุปยอดสำหรับส่ง LINE</span>
                    <span className="text-emerald-700 text-xs bg-emerald-100 px-2 py-0.5 rounded-full font-bold">สำเร็จ</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentDorm.name} • {formattedDateStr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCaptureModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Image Preview */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Notification Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 space-y-1">
                  <p className="font-bold">
                    {copyImageSuccess
                      ? "คัดลอกรูปภาพลงคลิปบอร์ดแล้ว! และดาวน์โหลดไฟล์ภาพลงเครื่องเรียบร้อย"
                      : "ดาวน์โหลดไฟล์ภาพลงเครื่องเรียบร้อยแล้ว!"}
                  </p>
                  <p className="text-emerald-800">
                    💡 <strong>คำแนะนำในการส่ง LINE:</strong> บนคอมพิวเตอร์สามารถกด <strong>Ctrl + V</strong> เพื่อวางรูปภาพในแชท LINE ได้ทันที หรือส่งไฟล์รูปที่ดาวน์โหลดไว้
                  </p>
                </div>
              </div>

              {/* Image Preview Box */}
              {capturedImageUrl && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50 max-h-[380px] overflow-y-auto flex items-center justify-center p-2">
                  <img
                    src={capturedImageUrl}
                    alt="Captured Dormitory Summary"
                    className="max-w-full h-auto rounded-xl shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedText ? "คัดลอกข้อความแล้ว" : "คัดลอกเป็นข้อความ"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyImageAgain}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 cursor-pointer shadow-xs transition"
                >
                  <Copy className="w-4 h-4 text-emerald-600" />
                  <span>{copyImageSuccess ? "คัดลอกรูปภาพแล้ว!" : "คัดลอกรูปภาพ"}</span>
                </button>

                <button
                  onClick={handleDownloadImageAgain}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md shadow-emerald-200 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดรูปภาพ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

