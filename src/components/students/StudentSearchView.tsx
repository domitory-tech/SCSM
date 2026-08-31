import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  DailyAttendance,
  Dormitory,
  Student,
  UserProfile,
  SystemSettings,
  AttendanceStatus
} from "../../types";
import {
  formatThaiFullDate,
  formatThaiMediumDate,
  getTodayDateString,
  detectStudentGender,
  formatGradeRoomShort
} from "../../utils/dateUtils";
import { matchStudentToDorm, findDormForStudent, getDormTypeLabel } from "../../utils/dormUtils";
import {
  printStudentSearchReport,
  printIndividualStudentHistory
} from "../../utils/studentSearchReportExporter";
import {
  Search,
  Calendar,
  Filter,
  UserCheck,
  UserX,
  Clock,
  Home,
  Building2,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ArrowUpDown,
  History,
  AlertCircle,
  CheckCircle2,
  FileText,
  BadgeAlert,
  GraduationCap,
  Sparkles,
  Info,
  CalendarDays,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  LogOut,
  Layers
} from "lucide-react";

interface StudentSearchViewProps {
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  currentUser: UserProfile | null;
  systemSettings?: SystemSettings;
  onNavigateToCheck?: (dormId?: string, date?: string) => void;
}

export interface StudentLeaveEvent {
  date: string;
  dormId: string;
  dormName: string;
  status: AttendanceStatus;
  statusLabel: string;
  statusColor: {
    bg: string;
    text: string;
    border: string;
  };
  reason?: string;
  checkedBy?: string;
  checkedAt?: string;
  isHomeBreak?: boolean;
}

export type SearchConditionMode = "ALL_STUDENTS" | "LEAVE_STUDENTS";

// Map AttendanceStatus to Thai label and badge styling
export const ATTENDANCE_STATUS_MAP: Record<
  string,
  { label: string; bg: string; text: string; border: string; isOut: boolean }
> = {
  PRESENT: {
    label: "อยู่ในหอพัก",
    bg: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    border: "border-emerald-200",
    isOut: false
  },
  ROUND_HOME: {
    label: "รอบกลับบ้าน",
    bg: "bg-purple-50 text-purple-700",
    text: "text-purple-700",
    border: "border-purple-200",
    isOut: true
  },
  HOME: {
    label: "กลับบ้าน",
    bg: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
    border: "border-rose-200",
    isOut: true
  },
  SICK: {
    label: "ป่วย / รักษาตัว",
    bg: "bg-amber-50 text-amber-700",
    text: "text-amber-700",
    border: "border-amber-200",
    isOut: true
  },
  CAMP: {
    label: "เข้าค่าย",
    bg: "bg-indigo-50 text-indigo-700",
    text: "text-indigo-700",
    border: "border-indigo-200",
    isOut: true
  },
  SKILL_COMP: {
    label: "แข่งขันทักษะ",
    bg: "bg-blue-50 text-blue-700",
    text: "text-blue-700",
    border: "border-blue-200",
    isOut: true
  },
  EXCHANGE: {
    label: "แลกเปลี่ยน",
    bg: "bg-cyan-50 text-cyan-700",
    text: "text-cyan-700",
    border: "border-cyan-200",
    isOut: true
  },
  OTHER: {
    label: "อื่นๆ",
    bg: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
    border: "border-slate-200",
    isOut: true
  }
};

export const getStatusMeta = (status?: string) => {
  if (!status || !ATTENDANCE_STATUS_MAP[status]) {
    return {
      label: status || "ไม่ระบุ",
      bg: "bg-slate-100 text-slate-700",
      text: "text-slate-700",
      border: "border-slate-200",
      isOut: status !== "PRESENT"
    };
  }
  return ATTENDANCE_STATUS_MAP[status];
};

export const StudentSearchView: React.FC<StudentSearchViewProps> = ({
  students,
  dorms,
  attendanceRecords,
  currentUser,
  systemSettings,
  onNavigateToCheck
}) => {
  const todayStr = getTodayDateString();

  // Helper to compute default start date (30 days ago)
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Condition 1: ค้นหานักเรียน | Condition 2: ค้นหานักเรียนออกหอพัก
  const [searchMode, setSearchMode] = useState<SearchConditionMode>("ALL_STUDENTS");

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDormFilter, setSelectedDormFilter] = useState<string>("ALL");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "PRESENT" | "OUT">("ALL");
  const [selectedLeaveTypeFilter, setSelectedLeaveTypeFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [sortBy, setSortBy] = useState<"leaveCountDesc" | "latestDateDesc" | "gradeRoom" | "name">("latestDateDesc");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");

  // Print Preview Modal State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("landscape");

  // Expanded student cards
  const [expandedStudentIds, setExpandedStudentIds] = useState<Record<string, boolean>>({});

  // Individual Student History Modal
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<{
    student: Student;
    dorm?: Dormitory;
    currentStatus: {
      isOut: boolean;
      status: AttendanceStatus;
      label: string;
      reason?: string;
      date: string;
    };
    leaveHistory: StudentLeaveEvent[];
    allLeaveHistory: StudentLeaveEvent[];
  } | null>(null);

  // Reset pagination when search parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchMode,
    searchQuery,
    selectedDormFilter,
    selectedGradeFilter,
    selectedStatusFilter,
    selectedLeaveTypeFilter,
    startDate,
    endDate,
    sortBy,
    pageSize
  ]);

  // Toggle card expansion
  const toggleExpand = (studentId: string) => {
    setExpandedStudentIds((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Quick Date Preset Handlers
  const handleSetDatePreset = (preset: "7days" | "30days" | "thisMonth" | "term" | "all") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const endStr = `${y}-${m}-${d}`;
    setEndDate(endStr);

    if (preset === "7days") {
      const dt = new Date();
      dt.setDate(dt.getDate() - 7);
      const sy = dt.getFullYear();
      const sm = String(dt.getMonth() + 1).padStart(2, "0");
      const sd = String(dt.getDate()).padStart(2, "0");
      setStartDate(`${sy}-${sm}-${sd}`);
    } else if (preset === "30days") {
      const dt = new Date();
      dt.setDate(dt.getDate() - 30);
      const sy = dt.getFullYear();
      const sm = String(dt.getMonth() + 1).padStart(2, "0");
      const sd = String(dt.getDate()).padStart(2, "0");
      setStartDate(`${sy}-${sm}-${sd}`);
    } else if (preset === "thisMonth") {
      setStartDate(`${y}-${m}-01`);
    } else if (preset === "term") {
      const termMonth = now.getMonth() >= 10 ? "11" : "06";
      setStartDate(`${y}-${termMonth}-01`);
    } else if (preset === "all") {
      setStartDate("2020-01-01");
    }
  };

  // Build a lookup map of Dormitory by ID and name
  const dormLookup = useMemo(() => {
    const map = new Map<string, Dormitory>();
    dorms.forEach((d) => {
      map.set(d.id, d);
      map.set(d.name, d);
    });
    return map;
  }, [dorms]);

  // Extract distinct Grade/Room combinations for filter dropdown
  const availableGradesAndRooms = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade) {
        const short = formatGradeRoomShort(s.grade, s.room);
        set.add(short);
      }
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.replace(/\D/g, "") || "0", 10);
      return numA - numB;
    });
  }, [students]);

  // Pre-process all student leave records and latest status across all attendance records
  const processedStudentsData = useMemo(() => {
    // 1. Sort attendance records by date descending (Newest first)
    const sortedAttendance = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));

    // 2. Pre-index attendance records by studentId
    const studentEventsMap = new Map<string, StudentLeaveEvent[]>();
    const studentLatestStatusMap = new Map<
      string,
      {
        status: AttendanceStatus;
        isOut: boolean;
        label: string;
        reason?: string;
        date: string;
        dormName: string;
      }
    >();

    sortedAttendance.forEach((att) => {
      const attDate = att.date;
      const dormObj = dormLookup.get(att.dormId);
      const dormName = dormObj?.name || att.dormId;

      if (att.records && Array.isArray(att.records)) {
        att.records.forEach((rec) => {
          if (!rec.studentId) return;

          const meta = getStatusMeta(rec.status);
          const isLeave = rec.status !== "PRESENT";

          // Record latest status if not recorded yet
          if (!studentLatestStatusMap.has(rec.studentId)) {
            studentLatestStatusMap.set(rec.studentId, {
              status: rec.status,
              isOut: isLeave,
              label: meta.label,
              reason: rec.reason,
              date: attDate,
              dormName
            });
          }

          // If it's a leave record, push to student's leave events
          if (isLeave) {
            const eventList = studentEventsMap.get(rec.studentId) || [];
            eventList.push({
              date: attDate,
              dormId: att.dormId,
              dormName,
              status: rec.status,
              statusLabel: meta.label,
              statusColor: {
                bg: meta.bg,
                text: meta.text,
                border: meta.border
              },
              reason: rec.reason,
              checkedBy: att.checkedBy,
              checkedAt: att.checkedAt,
              isHomeBreak: att.isHomeBreak
            });
            studentEventsMap.set(rec.studentId, eventList);
          }
        });
      }
    });

    // 3. Map students to their computed dataset
    return students.map((student) => {
      const dorm = findDormForStudent(student, dorms);
      const dormName = dorm?.name || student.dormId || "ไม่ระบุหอพัก";
      const allEvents = studentEventsMap.get(student.studentId) || [];

      // Filter leave events by selected start and end date
      const filteredEvents = allEvents.filter((ev) => {
        if (startDate && ev.date < startDate) return false;
        if (endDate && ev.date > endDate) return false;
        return true;
      });

      // Compute latest/current status
      const latestCheck = studentLatestStatusMap.get(student.studentId);
      let currentStatus: {
        status: AttendanceStatus;
        isOut: boolean;
        label: string;
        reason?: string;
        date: string;
        dormName: string;
      };

      if (latestCheck) {
        currentStatus = latestCheck;
      } else {
        currentStatus = {
          status: "PRESENT",
          isOut: false,
          label: "อยู่ในหอพัก (ปกติ)",
          date: todayStr,
          dormName
        };
      }

      // Most recent leave date (from all-time or filtered)
      const latestLeaveDate = allEvents[0]?.date || "";
      const latestLeaveReason = allEvents[0]?.reason || "";
      const latestLeaveStatusLabel = allEvents[0]?.statusLabel || "";
      const latestLeaveStatus = allEvents[0]?.status;

      return {
        student,
        dorm,
        dormName,
        currentStatus,
        leaveCount: filteredEvents.length,
        allLeaveCount: allEvents.length,
        leaveHistory: filteredEvents, // Sorted newest first
        allLeaveHistory: allEvents,
        latestLeaveDate,
        latestLeaveReason,
        latestLeaveStatusLabel,
        latestLeaveStatus
      };
    });
  }, [students, dorms, attendanceRecords, dormLookup, startDate, endDate, todayStr]);

  // Filter and Sort the processed students list based on search mode and conditions
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return processedStudentsData
      .filter((item) => {
        const s = item.student;

        // Condition 2 Check: ค้นหานักเรียนออกหอพัก
        if (searchMode === "LEAVE_STUDENTS") {
          // Must have leave records in the date range OR currently out of dorm
          const hasLeaveInRange = item.leaveCount > 0;
          const isCurrentlyOut = item.currentStatus.isOut;

          if (!hasLeaveInRange && !isCurrentlyOut) {
            return false;
          }

          // Leave Type filter in LEAVE_STUDENTS mode
          if (selectedLeaveTypeFilter !== "ALL") {
            const matchesLeaveTypeHistory = item.leaveHistory.some(
              (ev) => ev.status === selectedLeaveTypeFilter
            );
            const matchesCurrentStatus = item.currentStatus.status === selectedLeaveTypeFilter;

            if (!matchesLeaveTypeHistory && !matchesCurrentStatus) {
              return false;
            }
          }
        }

        // 1. Search Query Filter (Student ID, Firstname, Lastname, Nickname, Dorm room, Grade)
        if (q) {
          const matchId = (s.studentId || "").toLowerCase().includes(q);
          const matchFirst = (s.firstName || "").toLowerCase().includes(q);
          const matchLast = (s.lastName || "").toLowerCase().includes(q);
          const matchFull = `${s.title || ""}${s.firstName || ""} ${s.lastName || ""}`.toLowerCase().includes(q);
          const matchNick = (s.nickname || "").toLowerCase().includes(q);
          const matchDormRoom = (s.dormRoom || "").toLowerCase().includes(q);
          const matchGrade = (s.grade || "").toLowerCase().includes(q);
          const matchDorm = (item.dormName || "").toLowerCase().includes(q);

          if (!matchId && !matchFirst && !matchLast && !matchFull && !matchNick && !matchDormRoom && !matchGrade && !matchDorm) {
            return false;
          }
        }

        // 2. Dormitory Filter
        if (selectedDormFilter !== "ALL") {
          const targetDorm = dorms.find((d) => d.id === selectedDormFilter);
          if (targetDorm && !matchStudentToDorm(s, targetDorm)) {
            return false;
          }
        }

        // 3. Grade / Room Filter
        if (selectedGradeFilter !== "ALL") {
          const sGradeShort = formatGradeRoomShort(s.grade, s.room);
          if (sGradeShort !== selectedGradeFilter && s.grade !== selectedGradeFilter) {
            return false;
          }
        }

        // 4. Current Status Filter (ALL / PRESENT / OUT) - for ALL_STUDENTS mode
        if (searchMode === "ALL_STUDENTS") {
          if (selectedStatusFilter === "PRESENT" && item.currentStatus.isOut) {
            return false;
          }
          if (selectedStatusFilter === "OUT" && !item.currentStatus.isOut) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "leaveCountDesc") {
          return b.leaveCount - a.leaveCount;
        }
        if (sortBy === "latestDateDesc") {
          if (!a.latestLeaveDate && !b.latestLeaveDate) return 0;
          if (!a.latestLeaveDate) return 1;
          if (!b.latestLeaveDate) return -1;
          return b.latestLeaveDate.localeCompare(a.latestLeaveDate);
        }
        if (sortBy === "gradeRoom") {
          const gradeA = parseInt((a.student.grade || "").replace(/\D/g, "") || "999", 10);
          const gradeB = parseInt((b.student.grade || "").replace(/\D/g, "") || "999", 10);
          if (gradeA !== gradeB) return gradeA - gradeB;
          const roomA = typeof a.student.room === "number" ? a.student.room : parseInt(String(a.student.room || "0"), 10);
          const roomB = typeof b.student.room === "number" ? b.student.room : parseInt(String(b.student.room || "0"), 10);
          if (roomA !== roomB) return roomA - roomB;
          const noA = typeof a.student.no === "number" ? a.student.no : parseInt(String(a.student.no || "0"), 10);
          const noB = typeof b.student.no === "number" ? b.student.no : parseInt(String(b.student.no || "0"), 10);
          return noA - noB;
        }
        if (sortBy === "name") {
          return (a.student.firstName || "").localeCompare(b.student.firstName || "", "th");
        }
        return 0;
      });
  }, [
    processedStudentsData,
    searchMode,
    searchQuery,
    selectedDormFilter,
    selectedGradeFilter,
    selectedStatusFilter,
    selectedLeaveTypeFilter,
    dorms,
    sortBy
  ]);

  // Overall Aggregated Statistics
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    let currentlyIn = 0;
    let currentlyOut = 0;
    let totalLeavesInRange = 0;
    let totalEverLeft = 0;

    filteredStudents.forEach((item) => {
      if (item.currentStatus.isOut) {
        currentlyOut++;
      } else {
        currentlyIn++;
      }
      totalLeavesInRange += item.leaveCount;
      if (item.leaveCount > 0 || item.allLeaveCount > 0) {
        totalEverLeft++;
      }
    });

    return {
      total,
      currentlyIn,
      currentlyOut,
      totalLeavesInRange,
      totalEverLeft
    };
  }, [filteredStudents]);

  // Pagination Calculations
  const totalItems = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, startIndex, endIndex]);

  // Pagination range numbers generator (smart 1 2 ... 5 6)
  const paginationRange = useMemo(() => {
    const delta = 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= validCurrentPage - delta && i <= validCurrentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (typeof i === "number") {
        if (l !== undefined) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l !== 1) {
            rangeWithDots.push("...");
          }
        }
        rangeWithDots.push(i);
        l = i;
      }
    });

    return rangeWithDots;
  }, [totalPages, validCurrentPage]);

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPageInput("");
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      return;
    }

    // 1. Summary Sheet
    const summaryData = filteredStudents.map((item, idx) => {
      const s = item.student;
      return {
        "ลำดับ": idx + 1,
        "รหัสนักเรียน": s.studentId,
        "คำนำหน้า": s.title || "",
        "ชื่อ": s.firstName,
        "นามสกุล": s.lastName,
        "ชื่อเล่น": s.nickname || "",
        "เพศ": detectStudentGender(s.title, s.firstName, s.gender) === "male" ? "ชาย" : "หญิง",
        "ระดับชั้น": s.grade || "",
        "ห้อง": s.room || "",
        "เลขที่": s.no || "",
        "หอพัก": item.dormName,
        "ห้องพัก": s.dormRoom || "",
        "สถานะปัจจุบัน": item.currentStatus.label,
        "เหตุผลสถานะปัจจุบัน": item.currentStatus.reason || "-",
        [`จำนวนครั้งที่ออกหอ (${startDate} ถึง ${endDate})`]: item.leaveCount,
        "จำนวนครั้งที่ออกหอตลอดประวัติ": item.allLeaveCount,
        "วันที่ออกหอล่าสุด": item.latestLeaveDate ? formatThaiMediumDate(item.latestLeaveDate) : "-",
        "ประเภทการออกล่าสุด": item.latestLeaveStatusLabel || "-",
        "เหตุผลการออกล่าสุด": item.latestLeaveReason || "-"
      };
    });

    // 2. Detailed History Sheet
    const historyData: any[] = [];
    filteredStudents.forEach((item) => {
      const s = item.student;
      item.leaveHistory.forEach((ev) => {
        historyData.push({
          "รหัสนักเรียน": s.studentId,
          "ชื่อ-นามสกุล": `${s.title || ""}${s.firstName} ${s.lastName}`,
          "ชื่อเล่น": s.nickname || "",
          "ระดับชั้น/ห้อง": formatGradeRoomShort(s.grade, s.room),
          "หอพัก": item.dormName,
          "วันที่ออกหอพัก": ev.date,
          "ประเภทการออก": ev.statusLabel,
          "เหตุผล": ev.reason || "-",
          "บันทึกโดย": ev.checkedBy || "-",
          "เวลาที่บันทึก": ev.checkedAt || "-"
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(
      wb,
      wsSummary,
      searchMode === "LEAVE_STUDENTS" ? "รายชื่อนักเรียนออกหอพัก" : "รายชื่อและสถานะนักเรียน"
    );

    if (historyData.length > 0) {
      const wsHistory = XLSX.utils.json_to_sheet(historyData);
      XLSX.utils.book_append_sheet(wb, wsHistory, "ประวัติการออกหอพักละเอียด");
    }

    const modePrefix = searchMode === "LEAVE_STUDENTS" ? "รายงานนักเรียนออกหอพัก" : "รายงานค้นหานักเรียน";
    const fileName = `${modePrefix}_${startDate}_ถึง_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Direct print search results / leave list report
  const handlePrintSearchReport = () => {
    const reportTitle =
      searchMode === "LEAVE_STUDENTS"
        ? "รายงานสรุปรายชื่อนักเรียนออกหอพัก"
        : "รายงานข้อมูลนักเรียนและสถานะการเข้าพักหอพัก";

    printStudentSearchReport({
      title: reportTitle,
      mode: searchMode,
      students: filteredStudents,
      dormName: selectedDormName,
      gradeFilter: selectedGradeFilter,
      startDate,
      endDate,
      stats,
      systemSettings,
      currentUser,
      orientation: printOrientation
    });
  };

  // Direct print individual student history report
  const handlePrintStudentHistory = (studentItem: any) => {
    if (!studentItem) return;
    printIndividualStudentHistory({
      student: studentItem.student,
      dorm: studentItem.dorm,
      dormName: studentItem.dormName || studentItem.dorm?.name || "ไม่ระบุหอพัก",
      currentStatus: studentItem.currentStatus,
      leaveHistory: studentItem.leaveHistory || [],
      allLeaveHistory: studentItem.allLeaveHistory || [],
      startDate,
      endDate,
      systemSettings,
      currentUser
    });
  };

  // Get dorm filter label for print and UI
  const selectedDormName = useMemo(() => {
    if (selectedDormFilter === "ALL") return "ทุกหอพัก";
    const d = dorms.find((dm) => dm.id === selectedDormFilter);
    return d ? d.name : selectedDormFilter;
  }, [selectedDormFilter, dorms]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Toolbar & Mode Selection */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A05AFF] to-[#7932e6] flex items-center justify-center text-white shadow-sm shadow-purple-200">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  ค้นหานักเรียน
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  สืบค้นข้อมูลนักเรียน ประวัติการออกหอพัก และตรวจสอบสถานะการเข้าพักแบบเรียลไทม์
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Print Preview, Direct Print & Export Excel */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              id="btn-print-preview"
              onClick={() => setIsPrintPreviewOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-98 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-4 h-4 text-purple-300" />
              <span>ตัวอย่างการพิมพ์</span>
            </button>

            <button
              type="button"
              id="btn-direct-print-search"
              onClick={handlePrintSearchReport}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#A05AFF] hover:bg-[#8e42f2] active:scale-98 text-white rounded-2xl text-xs font-extrabold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์</span>
            </button>

            <button
              type="button"
              id="btn-export-excel"
              onClick={handleExportExcel}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1BCFB4] hover:bg-[#17b39b] active:scale-98 text-white rounded-2xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* 2. Condition Mode Switcher: 1. ค้นหานักเรียน vs 2. ค้นหานักเรียนออกหอพัก */}
        <div className="space-y-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#A05AFF]" />
            <span>เลือกเงื่อนไขการค้นหา:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Condition 1 */}
            <button
              type="button"
              id="tab-search-all-students"
              onClick={() => {
                setSearchMode("ALL_STUDENTS");
                setSelectedStatusFilter("ALL");
              }}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                searchMode === "ALL_STUDENTS"
                  ? "bg-gradient-to-r from-purple-50 to-indigo-50/50 border-[#A05AFF] ring-2 ring-[#A05AFF]/20 shadow-xs"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 text-slate-700"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                  searchMode === "ALL_STUDENTS"
                    ? "bg-[#A05AFF] text-white shadow-xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                1
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">1. ค้นหานักเรียน</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                    ทั้งหมด
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  ค้นหาข้อมูลนักเรียนทุกคน ตรวจสอบห้องพัก และดูประวัติการเข้าพัก
                </p>
              </div>
            </button>

            {/* Condition 2 */}
            <button
              type="button"
              id="tab-search-leave-students"
              onClick={() => {
                setSearchMode("LEAVE_STUDENTS");
              }}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                searchMode === "LEAVE_STUDENTS"
                  ? "bg-gradient-to-r from-rose-50 to-purple-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 text-slate-700"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                  searchMode === "LEAVE_STUDENTS"
                    ? "bg-rose-500 text-white shadow-xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                2
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">2. ค้นหานักเรียนออกหอพัก</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                    เฉพาะออกหอ
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  ค้นหาเฉพาะนักเรียนที่มีประวัติออกหอพัก หรือไม่อยู่ในหอพักปัจจุบัน
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Search Filters & Date Range Controls */}
        <div className="space-y-4 pt-1">
          {/* Main Keyword Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="input-search-student"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาด้วย: รหัสนักเรียน, ชื่อ, นามสกุล, ชื่อเล่น, ชั้น/ห้อง, เลขที่, หรือห้องพัก..."
              className="w-full pl-12 pr-10 py-3.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#A05AFF] rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-50 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Secondary Dropdowns & Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Dormitory Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>หอพัก</span>
              </label>
              <select
                id="select-dorm-filter"
                value={selectedDormFilter}
                onChange={(e) => setSelectedDormFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#A05AFF] focus:outline-none"
              >
                <option value="ALL">🏢 ทุกหอพัก ({dorms.length} หอ)</option>
                {dorms.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({getDormTypeLabel(d, false)})
                  </option>
                ))}
              </select>
            </div>

            {/* Grade / Room Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>ระดับชั้น / ห้องเรียน</span>
              </label>
              <select
                id="select-grade-filter"
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#A05AFF] focus:outline-none"
              >
                <option value="ALL">🎓 ทุกระดับชั้นและห้องเรียน</option>
                {availableGradesAndRooms.map((gr) => (
                  <option key={gr} value={gr}>
                    ชั้น {gr}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span>เริ่มค้นหาจากวันที่</span>
              </label>
              <input
                type="date"
                id="input-start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#A05AFF] focus:outline-none"
              />
            </div>

            {/* End Date Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span>ถึงวันที่</span>
              </label>
              <input
                type="date"
                id="input-end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#A05AFF] focus:outline-none"
              />
            </div>
          </div>

          {/* Specific Mode Filters & Quick Date Presets */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] font-bold mr-1">ช่วงเวลา:</span>
              <button
                type="button"
                onClick={() => handleSetDatePreset("7days")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-[#A05AFF] text-slate-600 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                7 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset("30days")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-[#A05AFF] text-slate-600 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                30 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset("thisMonth")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-[#A05AFF] text-slate-600 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset("term")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-[#A05AFF] text-slate-600 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                ต้นภาคเรียน
              </button>
              <button
                type="button"
                onClick={() => handleSetDatePreset("all")}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-[#A05AFF] text-slate-600 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                ทั้งหมด
              </button>
            </div>

            {/* Mode-specific status filter */}
            <div className="flex flex-wrap items-center gap-2">
              {searchMode === "ALL_STUDENTS" ? (
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("ALL")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedStatusFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    ทุกสถานะ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("PRESENT")}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      selectedStatusFilter === "PRESENT"
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-300" />
                    <span>อยู่ในหอ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("OUT")}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      selectedStatusFilter === "OUT"
                        ? "bg-rose-500 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-300" />
                    <span>ออกหอพัก</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-bold text-[11px]">ประเภทการออกหอ:</span>
                  <select
                    value={selectedLeaveTypeFilter}
                    onChange={(e) => setSelectedLeaveTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    <option value="ALL">🚪 ทุกประเภทการออกหอ</option>
                    <option value="ROUND_HOME">รอบกลับบ้าน</option>
                    <option value="HOME">กลับบ้าน</option>
                    <option value="SICK">ป่วย / รักษาตัว</option>
                    <option value="CAMP">เข้าค่าย</option>
                    <option value="SKILL_COMP">แข่งขันทักษะ</option>
                    <option value="EXCHANGE">แลกเปลี่ยน</option>
                    <option value="OTHER">อื่นๆ</option>
                  </select>
                </div>
              )}

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400 font-bold text-[11px]">เรียง:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="latestDateDesc">📅 วันที่ออกล่าสุด (ใหม่-เก่า)</option>
                  <option value="leaveCountDesc">🔥 จำนวนครั้งออกหอมากสุด</option>
                  <option value="gradeRoom">🎓 ระดับชั้น / ห้อง / เลขที่</option>
                  <option value="name">🔤 ชื่อ-นามสกุล (ก-ฮ)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. KPI Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">นักเรียนตามเงื่อนไข</span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 text-[#A05AFF] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.total.toLocaleString()} <span className="text-xs font-normal text-slate-500">คน</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {searchMode === "LEAVE_STUDENTS" ? "พบประวัติออกหอพัก" : "นักเรียนทั้งหมดในระบบ"}
          </div>
        </div>

        {/* Currently In Dorm */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">อยู่ในหอพัก (ปกติ)</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {stats.currentlyIn.toLocaleString()} <span className="text-xs font-normal text-slate-500">คน</span>
          </div>
          <div className="text-[11px] text-emerald-700/80 font-medium">
            เช็คชื่อล่าสุด: อยู่ประจำหอ
          </div>
        </div>

        {/* Currently Out Of Dorm */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">ออกหอพัก (ปัจจุบัน)</span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {stats.currentlyOut.toLocaleString()} <span className="text-xs font-normal text-slate-500">คน</span>
          </div>
          <div className="text-[11px] text-rose-700/80 font-medium">
            กลับบ้าน / ป่วย / ค่าย / แข่งขัน
          </div>
        </div>

        {/* Total Leaves in Selected Range */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">ครั้งที่ออกหอรวม</span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {stats.totalLeavesInRange.toLocaleString()} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
          </div>
          <div className="text-[11px] text-amber-700/80 font-medium truncate">
            {startDate} ถึง {endDate}
          </div>
        </div>
      </div>

      {/* 5. Results Header with View Mode & Top Pagination Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-700">
            ผลการค้นหา: {totalItems.toLocaleString()} คน
          </span>
          {totalItems > 0 && (
            <span className="text-[11px] text-slate-500 font-medium">
              (แสดง {startIndex + 1} - {endIndex} จากทั้งหมด)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-bold text-[11px]">แสดงต่อหน้า:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === "cards" ? "bg-[#A05AFF] text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              การ์ด
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === "table" ? "bg-[#A05AFF] text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ตาราง
            </button>
          </div>
        </div>
      </div>

      {/* 6. Main Student Results List (Cards or Table) */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#A05AFF] flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-800">
            {searchMode === "LEAVE_STUDENTS"
              ? "ไม่พบนักเรียนที่มีประวัติออกหอพักตามเงื่อนไข"
              : "ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไขการค้นหา"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ลองปรับเปลี่ยนคำค้นหา ขยายช่วงวันที่ หรือเลือกหอพักและระดับชั้นอื่น
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedDormFilter("ALL");
              setSelectedGradeFilter("ALL");
              setSelectedStatusFilter("ALL");
              setSelectedLeaveTypeFilter("ALL");
              handleSetDatePreset("30days");
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ล้างตัวกรองทั้งหมด</span>
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedStudents.map((item) => {
            const s = item.student;
            const isExpanded = !!expandedStudentIds[s.studentId];
            const isOut = item.currentStatus.isOut;

            return (
              <div
                key={s.studentId}
                className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:border-[#A05AFF]/40 transition-all flex flex-col justify-between gap-4 relative overflow-hidden"
              >
                {/* Status Indicator Stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isOut ? "bg-gradient-to-r from-rose-500 to-amber-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                  }`}
                />

                <div className="space-y-3.5">
                  {/* Top Row: Avatar & Basic Information */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${
                          detectStudentGender(s.title, s.firstName, s.gender) === "male"
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-pink-50 text-pink-700 border border-pink-100"
                        }`}
                      >
                        {s.firstName.charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                            {s.title || ""}{s.firstName} {s.lastName}
                          </h4>
                          {s.nickname && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                              ({s.nickname})
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                          <span className="font-mono font-bold text-slate-700">รหัส: {s.studentId}</span>
                          <span>•</span>
                          <span>ชั้น {formatGradeRoomShort(s.grade, s.room)}</span>
                          {s.no && <span>(เลขที่ {s.no})</span>}
                        </div>
                      </div>
                    </div>

                    {/* Current Status Badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-xl border ${
                          isOut ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOut ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                          }`}
                        />
                        <span>{item.currentStatus.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dorm & Room Info */}
                  <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">หอพัก</span>
                      <div className="font-extrabold text-slate-800 truncate flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.dormName}</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">ห้องพักในหอ</span>
                      <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-slate-400" />
                        <span>ห้อง {s.dormRoom || "101"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Leave History Quick Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-[#A05AFF]" />
                        <span>ประวัติการออกหอพัก ({item.leaveCount} ครั้งในช่วงที่เลือก)</span>
                      </span>
                      {item.latestLeaveDate && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          ล่าสุด: {formatThaiMediumDate(item.latestLeaveDate)}
                        </span>
                      )}
                    </div>

                    {/* Latest Leave Event Snippet */}
                    {item.leaveHistory.length > 0 ? (
                      <div className="bg-purple-50/50 rounded-2xl p-3 border border-purple-100/80 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-purple-900">
                            {formatThaiFullDate(item.leaveHistory[0].date)}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${item.leaveHistory[0].statusColor.bg} ${item.leaveHistory[0].statusColor.border}`}
                          >
                            {item.leaveHistory[0].statusLabel}
                          </span>
                        </div>
                        {item.leaveHistory[0].reason && (
                          <div className="text-xs text-purple-800 font-medium">
                            เหตุผล: {item.leaveHistory[0].reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center text-xs text-slate-400">
                        ไม่พบประวัติการออกหอพักในช่วงเวลานี้
                      </div>
                    )}

                    {/* Expanded History List */}
                    {isExpanded && item.leaveHistory.length > 1 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto pr-1">
                        <div className="text-[11px] font-bold text-slate-400">ประวัติครั้งอื่นๆ ก่อนหน้า:</div>
                        {item.leaveHistory.slice(1).map((ev, evIdx) => (
                          <div
                            key={evIdx}
                            className="bg-white rounded-xl p-2.5 border border-slate-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{formatThaiFullDate(ev.date)}</span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${ev.statusColor.bg} ${ev.statusColor.border}`}
                              >
                                {ev.statusLabel}
                              </span>
                            </div>
                            {ev.reason && (
                              <div className="text-xs text-slate-600">เหตุผล: {ev.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                  {item.leaveHistory.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(s.studentId)}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-bold py-1 px-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>ซ่อนประวัติย่อย</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>ดูเพิ่ม ({item.leaveHistory.length - 1} รายการ)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handlePrintStudentHistory(item)}
                      title="พิมพ์ประวัติการออกหอพักของนักเรียนคนนี้"
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-300" />
                      <span>พิมพ์ประวัติ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudentForDetail(item)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#A05AFF] hover:bg-[#8f47ef] text-white font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>ดูรายละเอียด</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3.5 px-4 text-center w-12">ลำดับ</th>
                  <th className="py-3.5 px-4">รหัสนักเรียน</th>
                  <th className="py-3.5 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3.5 px-4">ชื่อเล่น</th>
                  <th className="py-3.5 px-4">ชั้น/ห้อง</th>
                  <th className="py-3.5 px-4">หอพัก</th>
                  <th className="py-3.5 px-4">ห้องพัก</th>
                  <th className="py-3.5 px-4 text-center">สถานะปัจจุบัน</th>
                  <th className="py-3.5 px-4 text-center">ออกหอ (ครั้ง)</th>
                  <th className="py-3.5 px-4">วันที่ออกล่าสุด</th>
                  <th className="py-3.5 px-4 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((item, idx) => {
                  const s = item.student;
                  const isOut = item.currentStatus.isOut;

                  return (
                    <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {s.studentId}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {s.title || ""}{s.firstName} {s.lastName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {s.nickname || "-"}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {formatGradeRoomShort(s.grade, s.room)} {s.no && `(${s.no})`}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {item.dormName}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        ห้อง {s.dormRoom || "101"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                            isOut ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOut ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                          />
                          <span>{item.currentStatus.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-purple-700">
                        {item.leaveCount}
                      </td>
                      <td className="py-3 px-4">
                        {item.latestLeaveDate ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800">
                              {formatThaiMediumDate(item.latestLeaveDate)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {item.latestLeaveStatusLabel}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForDetail(item)}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-[#A05AFF] text-[#A05AFF] hover:text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            ดูประวัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintStudentHistory(item)}
                            title="พิมพ์ประวัตินักเรียนคนนี้"
                            className="p-1 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Bottom Pagination Controls (ตัวแบ่งหน้า) */}
      {totalPages > 1 && (
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium text-center md:text-left">
            แสดงรายการที่ <span className="font-bold text-slate-800">{startIndex + 1}</span> ถึง{" "}
            <span className="font-bold text-slate-800">{endIndex}</span> จากทั้งหมด{" "}
            <span className="font-bold text-slate-800">{totalItems.toLocaleString()}</span> คน (หน้า{" "}
            <span className="font-bold text-[#A05AFF]">{validCurrentPage}</span> / {totalPages})
          </div>

          {/* Page navigation buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {/* First Page Button */}
            <button
              type="button"
              id="btn-page-first"
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าแรกสุด"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page Button */}
            <button
              type="button"
              id="btn-page-prev"
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            {paginationRange.map((pageNumber, idx) => {
              if (pageNumber === "...") {
                return (
                  <span key={`dots-${idx}`} className="px-2 text-slate-400 font-bold text-xs">
                    ...
                  </span>
                );
              }

              const isCurrent = pageNumber === validCurrentPage;

              return (
                <button
                  key={`page-${pageNumber}`}
                  type="button"
                  onClick={() => setCurrentPage(Number(pageNumber))}
                  className={`w-9 h-9 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#A05AFF] text-white shadow-xs scale-105"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            {/* Next Page Button */}
            <button
              type="button"
              id="btn-page-next"
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page Button */}
            <button
              type="button"
              id="btn-page-last"
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="หน้าสุดท้าย"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Jump to Page Form */}
          <form onSubmit={handleJumpPage} className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">ไปที่หน้า:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(validCurrentPage)}
              className="w-12 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#A05AFF]"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-slate-100 hover:bg-[#A05AFF] hover:text-white text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
            >
              ไป
            </button>
          </form>
        </div>
      )}

      {/* 8. PRINT PREVIEW MODAL (ตัวอย่างการพิมพ์) */}
      {isPrintPreviewOpen && (
        <div
          id="print-preview-modal"
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header & Print Actions Toolbar */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-purple-300">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">ตัวอย่างการพิมพ์ (Print Preview)</h3>
                  <p className="text-xs text-slate-400">
                    {searchMode === "LEAVE_STUDENTS"
                      ? "รายงานนักเรียนออกหอพัก"
                      : "รายงานข้อมูลนักเรียนและสถานะการเข้าพักหอพัก"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Print Orientation */}
                <div className="flex items-center bg-white/10 rounded-xl p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("portrait")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      printOrientation === "portrait" ? "bg-white text-slate-900 shadow-xs" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    แนวตั้ง
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("landscape")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      printOrientation === "landscape" ? "bg-white text-slate-900 shadow-xs" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    แนวนอน
                  </button>
                </div>

                {/* Print Button */}
                <button
                  type="button"
                  id="btn-execute-print"
                  onClick={handlePrintSearchReport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#A05AFF] hover:bg-[#8e42f2] text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>สั่งพิมพ์ (Print)</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper Content */}
            <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100/70">
              <div
                id="printable-search-report"
                className={`bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200 text-slate-900 mx-auto ${
                  printOrientation === "landscape" ? "max-w-4xl" : "max-w-3xl"
                }`}
              >
                {/* School Header */}
                <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-4 mb-5">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                    โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย
                  </h2>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    {searchMode === "LEAVE_STUDENTS"
                      ? "รายงานสรุปรายชื่อนักเรียนออกหอพัก"
                      : "รายงานข้อมูลนักเรียนและสถานะการเข้าพักหอพัก"}
                  </h3>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 pt-1 font-medium">
                    <span>เงื่อนไข: {searchMode === "LEAVE_STUDENTS" ? "นักเรียนออกหอพัก" : "ค้นหานักเรียนทั่วไป"}</span>
                    <span>•</span>
                    <span>หอพัก: {selectedDormName}</span>
                    <span>•</span>
                    <span>ชั้น/ห้อง: {selectedGradeFilter === "ALL" ? "ทุกระดับชั้น" : selectedGradeFilter}</span>
                    <span>•</span>
                    <span>ช่วงวันที่: {formatThaiMediumDate(startDate)} ถึง {formatThaiMediumDate(endDate)}</span>
                  </div>
                </div>

                {/* Printable KPI Summary */}
                <div className="grid grid-cols-4 gap-3 mb-5 text-center text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-slate-500 font-bold">นักเรียนในรายงาน</div>
                    <div className="text-base font-black text-slate-900 mt-0.5">{stats.total} คน</div>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <div className="text-emerald-700 font-bold">อยู่ในหอพัก</div>
                    <div className="text-base font-black text-emerald-800 mt-0.5">{stats.currentlyIn} คน</div>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <div className="text-rose-700 font-bold">ออกหอพัก</div>
                    <div className="text-base font-black text-rose-800 mt-0.5">{stats.currentlyOut} คน</div>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <div className="text-amber-700 font-bold">ออกหอรวม</div>
                    <div className="text-base font-black text-amber-800 mt-0.5">{stats.totalLeavesInRange} ครั้ง</div>
                  </div>
                </div>

                {/* Printable Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border border-slate-300 font-black text-slate-800">
                        <th className="p-2 text-center w-8 border border-slate-300">#</th>
                        <th className="p-2 border border-slate-300">รหัส</th>
                        <th className="p-2 border border-slate-300">ชื่อ-สกุล (ชื่อเล่น)</th>
                        <th className="p-2 border border-slate-300">ชั้น/ห้อง</th>
                        <th className="p-2 border border-slate-300">หอพัก</th>
                        <th className="p-2 border border-slate-300">ห้อง</th>
                        <th className="p-2 text-center border border-slate-300">สถานะ</th>
                        <th className="p-2 text-center border border-slate-300">ออกหอ</th>
                        <th className="p-2 border border-slate-300">ออกล่าสุด / เหตุผล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((item, idx) => {
                        const s = item.student;
                        return (
                          <tr key={s.studentId} className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                            <td className="p-2 text-center border border-slate-200 font-mono">{idx + 1}</td>
                            <td className="p-2 border border-slate-200 font-mono font-bold">{s.studentId}</td>
                            <td className="p-2 border border-slate-200 font-bold">
                              {s.title || ""}{s.firstName} {s.lastName} {s.nickname && `(${s.nickname})`}
                            </td>
                            <td className="p-2 border border-slate-200 font-medium">
                              {formatGradeRoomShort(s.grade, s.room)} {s.no && `(#${s.no})`}
                            </td>
                            <td className="p-2 border border-slate-200">{item.dormName}</td>
                            <td className="p-2 border border-slate-200 font-bold">{s.dormRoom || "101"}</td>
                            <td className="p-2 text-center border border-slate-200 font-bold">
                              <span className={item.currentStatus.isOut ? "text-rose-700" : "text-emerald-700"}>
                                {item.currentStatus.label}
                              </span>
                            </td>
                            <td className="p-2 text-center border border-slate-200 font-bold font-mono">
                              {item.leaveCount}
                            </td>
                            <td className="p-2 border border-slate-200 text-[10px]">
                              {item.latestLeaveDate ? (
                                <div>
                                  <span className="font-bold">{formatThaiMediumDate(item.latestLeaveDate)}</span>{" "}
                                  ({item.latestLeaveStatusLabel})
                                  {item.latestLeaveReason && (
                                    <div className="text-slate-500">เหตุผล: {item.latestLeaveReason}</div>
                                  )}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sign-off Section */}
                <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
                  <div className="space-y-1">
                    <div>ผู้จัดทำรายงาน: {currentUser?.name || "เจ้าหน้าที่หอพัก"}</div>
                    <div className="text-slate-400 text-[10px]">
                      พิมพ์เมื่อ: {formatThaiFullDate(todayStr)} {new Date().toLocaleTimeString("th-TH")}
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div>ลงชื่อ ........................................................................</div>
                    <div className="text-[11px] text-slate-500">( ครูหอพัก / เจ้าหน้าที่ผู้รับผิดชอบ )</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                รวมทั้งหมด {filteredStudents.length} รายการ
              </span>
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Individual Student Detail Modal */}
      {selectedStudentForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#A05AFF] to-[#7932e6] text-white p-6 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-purple-200 font-bold uppercase tracking-wider">
                  <GraduationCap className="w-4 h-4" />
                  <span>ข้อมูลประวัตินักเรียนรายบุคคล</span>
                </div>
                <h3 className="text-xl font-black">
                  {selectedStudentForDetail.student.title || ""}{selectedStudentForDetail.student.firstName} {selectedStudentForDetail.student.lastName}
                  {selectedStudentForDetail.student.nickname && (
                    <span className="text-purple-200 text-sm ml-2">
                      ({selectedStudentForDetail.student.nickname})
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-purple-100 font-medium">
                  <span>รหัสนักเรียน: {selectedStudentForDetail.student.studentId}</span>
                  <span>•</span>
                  <span>ชั้น {formatGradeRoomShort(selectedStudentForDetail.student.grade, selectedStudentForDetail.student.room)}</span>
                  <span>•</span>
                  <span>{selectedStudentForDetail.dorm?.name || selectedStudentForDetail.student.dormId}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForDetail(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Current Status Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase">สถานะการเข้าพักปัจจุบัน</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full ${
                        selectedStudentForDetail.currentStatus.isOut ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {selectedStudentForDetail.currentStatus.isOut
                          ? `ออกหอพัก (${selectedStudentForDetail.currentStatus.label})`
                          : "อยู่ในหอพัก (ปกติ)"}
                      </div>
                      {selectedStudentForDetail.currentStatus.reason && (
                        <div className="text-xs text-rose-600 font-semibold">
                          เหตุผล: {selectedStudentForDetail.currentStatus.reason}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-400">
                    ข้อมูลล่าสุด: {formatThaiMediumDate(selectedStudentForDetail.currentStatus.date)}
                  </div>
                </div>
              </div>

              {/* Leave Statistics Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 rounded-2xl p-3.5 border border-purple-100 text-center">
                  <div className="text-xs font-bold text-purple-700">ออกหอพักในช่วงที่เลือก</div>
                  <div className="text-xl font-black text-purple-900 mt-0.5">
                    {selectedStudentForDetail.leaveHistory.length} <span className="text-xs font-normal">ครั้ง</span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-100 text-center">
                  <div className="text-xs font-bold text-blue-700">ออกหอพักทั้งหมดตลอดปี</div>
                  <div className="text-xl font-black text-blue-900 mt-0.5">
                    {selectedStudentForDetail.allLeaveHistory.length} <span className="text-xs font-normal">ครั้ง</span>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100 text-center col-span-2 sm:col-span-1">
                  <div className="text-xs font-bold text-emerald-700">ห้องพักในหอ</div>
                  <div className="text-xl font-black text-emerald-900 mt-0.5">
                    ห้อง {selectedStudentForDetail.student.dormRoom || "101"}
                  </div>
                </div>
              </div>

              {/* Timeline of leave records */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                    <History className="w-4 h-4 text-[#A05AFF]" />
                    <span>บันทึกการออกหอพักทั้งหมด ({selectedStudentForDetail.allLeaveHistory.length} ครั้ง)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">เรียงจากวันที่ล่าสุด</span>
                </div>

                {selectedStudentForDetail.allLeaveHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    ไม่พบประวัติการออกหอพัก นักเรียนอยู่ประจำหอพักสม่ำเสมอ
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedStudentForDetail.allLeaveHistory.map((ev, evIdx) => (
                      <div
                        key={evIdx}
                        className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900">
                              {formatThaiFullDate(ev.date)}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-black border ${ev.statusColor.bg} ${ev.statusColor.border}`}
                            >
                              {ev.statusLabel}
                            </span>
                          </div>
                          {ev.reason ? (
                            <div className="text-xs text-slate-600 font-medium">
                              เหตุผล: {ev.reason}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 font-normal">
                              -
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 sm:text-right shrink-0">
                          <div>หอพัก: {ev.dormName}</div>
                          {ev.checkedBy && <div>ผู้บันทึก: {ev.checkedBy}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                id="btn-print-student-history"
                onClick={() => handlePrintStudentHistory(selectedStudentForDetail)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#A05AFF] hover:bg-[#8e42f2] active:scale-98 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ประวัตินี้</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentForDetail(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
