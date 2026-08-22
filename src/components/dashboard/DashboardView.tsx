import React from "react";
import { Bar, Doughnut, Line, Radar } from "react-chartjs-2";
import "../charts/ChartSetup";
import { DailyAttendance, DailyReportData, Dormitory, Notice, Student, UserProfile } from "../../types";
import { fetchAllCheckedAttendanceDates, fetchAttendance, fetchNotices, fetchAllAttendanceRecords } from "../../services/api";
import { getDashboardDefaultDate, getTodayDateString, detectStudentGender } from "../../utils/dateUtils";
import { matchStudentToDorm, getStudentsInDorm, countStudentsInDorm, isDormMatch } from "../../utils/dormUtils";
import { ThaiCalendarPicker } from "./ThaiCalendarPicker";
import {
  exportDailyReportToExcel,
  GOOGLE_DRIVE_FOLDER_URL
} from "../../utils/excelReportExport";
import { exportHtmlDocument } from "../../utils/htmlReportExporter";
import { ReasonAnalyticsCard } from "./ReasonAnalyticsCard";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileSpreadsheet,
  Home,
  Megaphone,
  Printer,
  UserCheck,
  UserMinus,
  Users,
  TrendingUp,
  Bookmark,
  Activity,
  Filter,
  Table,
  X,
  Sparkles,
  Layers
} from "lucide-react";

interface DashboardViewProps {
  reportData?: DailyReportData;
  isLoading: boolean;
  dorms?: Dormitory[];
  students?: Student[];
  todayAttendance?: Record<string, DailyAttendance>;
  latestNotice?: Notice;
  onNavigateToCheck: (dormId?: string, date?: string) => void;
  onNavigateToReports: () => void;
  currentUser?: UserProfile | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportData,
  isLoading,
  dorms = [],
  students = [],
  todayAttendance = {},
  latestNotice,
  onNavigateToCheck,
  onNavigateToReports,
  currentUser
}) => {
  const [selectedDormIdsForChart, setSelectedDormIdsForChart] = React.useState<string[]>([]);
  const [chartViewMode, setChartViewMode] = React.useState<"bar" | "radar">("bar");
  const [isDormLayoutModalOpen, setIsDormLayoutModalOpen] = React.useState<boolean>(false);

  // Date selection state for Dashboard statistics
  const [selectedDashboardDate, setSelectedDashboardDate] = React.useState<string>("");
  const [historicalAttendanceMap, setHistoricalAttendanceMap] = React.useState<Record<string, DailyAttendance> | null>(null);
  const [dateNotices, setDateNotices] = React.useState<Notice[] | null>(null);
  const [isFetchingDate, setIsFetchingDate] = React.useState<boolean>(false);
  const [checkedAttendanceDates, setCheckedAttendanceDates] = React.useState<string[]>([]);

  // Analytics Trend Filter Tab state: "today" | "weekly" | "monthly" | "overall"
  const [trendTab, setTrendTab] = React.useState<"today" | "weekly" | "monthly" | "overall">("weekly");
  const [allHistoricalRecords, setAllHistoricalRecords] = React.useState<DailyAttendance[]>([]);

  // Helper to format next day's date string (DD/MM/YYYY)
  const getFormattedNextDay = React.useCallback((dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }, []);

  // Default dashboard date logic:
  // Show yesterday's data by default (ข้อมูลของเมื่อคืน)
  // Today's data is displayed ONLY IF current time is after 20.00 AND check has started.
  const defaultDashboardDate = React.useMemo(() => {
    return getDashboardDefaultDate(todayAttendance);
  }, [todayAttendance]);

  const effectiveDashboardDate = selectedDashboardDate || defaultDashboardDate;

  // Fetch list of dates that have checked attendance data
  React.useEffect(() => {
    let isMounted = true;
    fetchAllCheckedAttendanceDates().then((dates) => {
      if (!isMounted) return;
      const todayStr = getTodayDateString();
      const setDates = new Set(dates);
      if (todayAttendance && Object.keys(todayAttendance).length > 0) {
        const attList = Object.values(todayAttendance) as DailyAttendance[];
        const checkedToday = attList.some(
          (a) => a && (a.status === "CHECKED" || a.status === "HOME_BREAK" || (a.records && a.records.length > 0))
        );
        if (checkedToday) setDates.add(todayStr);
      }
      setCheckedAttendanceDates(Array.from(setDates));
    });
    return () => {
      isMounted = false;
    };
  }, [todayAttendance]);

  // Fetch all historical attendance records from Firestore for statistical analytics
  React.useEffect(() => {
    let isMounted = true;
    fetchAllAttendanceRecords().then((records) => {
      if (isMounted && Array.isArray(records)) {
        setAllHistoricalRecords(records);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [todayAttendance]);

  // Fetch attendance and notices data when effective dashboard date changes
  React.useEffect(() => {
    if (!effectiveDashboardDate) {
      setHistoricalAttendanceMap(null);
      setDateNotices(null);
      return;
    }
    let isMounted = true;
    setIsFetchingDate(true);

    Promise.all([
      fetchAttendance(effectiveDashboardDate),
      fetchNotices(effectiveDashboardDate)
    ])
      .then(([attRes, noticeRes]) => {
        if (!isMounted) return;
        if (attRes && typeof attRes === "object" && !("records" in attRes)) {
          setHistoricalAttendanceMap(attRes as Record<string, DailyAttendance>);
        } else if (attRes && "records" in attRes) {
          const rec = attRes as DailyAttendance;
          setHistoricalAttendanceMap({ [rec.dormId]: rec });
        } else {
          setHistoricalAttendanceMap({});
        }

        if (Array.isArray(noticeRes)) {
          setDateNotices(noticeRes);
        } else {
          setDateNotices([]);
        }

        setIsFetchingDate(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Error fetching historical data:", err);
          setHistoricalAttendanceMap({});
          setDateNotices([]);
          setIsFetchingDate(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveDashboardDate]);

  // Active attendance map: historical map if date is loaded/picked, otherwise today's attendance
  const activeAttendanceMap = React.useMemo(() => {
    if (historicalAttendanceMap !== null) {
      return historicalAttendanceMap;
    }
    if (effectiveDashboardDate === getTodayDateString()) {
      return todayAttendance;
    }
    return {};
  }, [historicalAttendanceMap, todayAttendance, effectiveDashboardDate]);

  // Active notice: notice for effective date if loaded/picked, otherwise latest notice
  const activeNotice = React.useMemo(() => {
    if (dateNotices !== null) {
      return dateNotices.length > 0 ? dateNotices[0] : null;
    }
    return latestNotice || null;
  }, [dateNotices, latestNotice]);

  // Orientation notes recorded by dorm teachers, grouped and sorted by dormitory order (หอพัก 1 -> 6)
  const groupedDormOrientationNotes = React.useMemo(() => {
    if (!activeAttendanceMap) return [];

    const groupMap: Record<string, { dormId: string; dormName: string; notes: string[] }> = {};

    // 1. Iterate through sorted dorms list to preserve correct dorm ordering (1 to 6)
    (dorms || []).forEach((dorm) => {
      const att = activeAttendanceMap[dorm.id];
      if (att && att.teacherOrientationNotes && Array.isArray(att.teacherOrientationNotes)) {
        const validNotes = att.teacherOrientationNotes.filter((n) => n && n.trim().length > 0);
        if (validNotes.length > 0) {
          groupMap[dorm.id] = {
            dormId: dorm.id,
            dormName: dorm.name,
            notes: validNotes.map((n) => n.trim()),
          };
        }
      }
    });

    // 2. Check any remaining attendance records in activeAttendanceMap that might not be in dorms list
    Object.values(activeAttendanceMap).forEach((att: any) => {
      if (att && att.dormId && !groupMap[att.dormId]) {
        if (att.teacherOrientationNotes && Array.isArray(att.teacherOrientationNotes)) {
          const validNotes = att.teacherOrientationNotes.filter((n) => n && n.trim().length > 0);
          if (validNotes.length > 0) {
            const dorm = (dorms || []).find((d) => d.id === att.dormId);
            const dormName = dorm ? dorm.name : `หอพัก ${att.dormId}`;
            groupMap[att.dormId] = {
              dormId: att.dormId,
              dormName,
              notes: validNotes.map((n) => n.trim()),
            };
          }
        }
      }
    });

    const result = Object.values(groupMap);
    result.sort((a, b) => {
      const numA = parseInt(a.dormId.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.dormId.replace(/\D/g, "") || "0", 10);
      if (numA !== numB) return numA - numB;
      return a.dormName.localeCompare(b.dormName, "th");
    });

    return result;
  }, [activeAttendanceMap, dorms]);

  const handleExportDormLayoutHtml = () => {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      exportHtmlDocument(
        "dorm-layout-printable",
        `ผังการจัดหอพัก_Dormitory_Layout_${dateStr}.html`,
        "landscape"
      );
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก HTML: " + err.message);
    }
  };

  // Helper for gender abbreviation (ช) or (ญ)
  const getGenderTag = (title: string = "", gender?: string): "(ช)" | "(ญ)" => {
    const t = (title || "").trim();
    if (t.startsWith("ด.ช") || t.startsWith("เด็กชาย") || t === "นาย" || t.startsWith("นาย")) {
      return "(ช)";
    }
    if (t.startsWith("ด.ญ") || t.startsWith("เด็กหญิง") || t === "นาง" || t.startsWith("นาง")) {
      return "(ญ)";
    }
    if (gender === "female") return "(ญ)";
    return "(ช)";
  };

  // Helper for school classification based on Grade & Room rules:
  // ม.1 - ม.3: Rooms 1-4 = จภ.ชร., Room 5 = จภ.ลป.
  // ม.4 - ม.6: Rooms 1-6 = จภ.ชร., Room 7 = จภ.ลป.
  const getSchoolByGradeRoom = (grade: string = "", room: string | number = ""): "จภ.ชร." | "จภ.ลป." => {
    const roomNum = parseInt(String(room).replace(/\D/g, ""), 10);
    const gStr = grade.trim();

    if (gStr.includes("1") || gStr.includes("2") || gStr.includes("3")) {
      if (roomNum === 5) return "จภ.ลป.";
      return "จภ.ชร.";
    }
    if (gStr.includes("4") || gStr.includes("5") || gStr.includes("6")) {
      if (roomNum === 7) return "จภ.ลป.";
      return "จภ.ชร.";
    }
    return "จภ.ชร.";
  };

  // Distinct color themes per dormitory for table highlighting
  const DORM_COLOR_SCHEMES = [
    {
      headerBg: "bg-purple-700 text-white border-purple-800",
      subHeaderBg: "bg-purple-800 text-purple-100 border-purple-900",
      cellBg: "bg-purple-50/20 border-purple-100/60",
      cellActive: "bg-purple-100 text-purple-950 font-extrabold border-purple-200",
      footerBg: "bg-purple-200 text-purple-950 border-purple-300 font-black",
      badgeBg: "bg-purple-600 text-white"
    },
    {
      headerBg: "bg-blue-700 text-white border-blue-800",
      subHeaderBg: "bg-blue-800 text-blue-100 border-blue-900",
      cellBg: "bg-blue-50/20 border-blue-100/60",
      cellActive: "bg-blue-100 text-blue-950 font-extrabold border-blue-200",
      footerBg: "bg-blue-200 text-blue-950 border-blue-300 font-black",
      badgeBg: "bg-blue-600 text-white"
    },
    {
      headerBg: "bg-emerald-700 text-white border-emerald-800",
      subHeaderBg: "bg-emerald-800 text-emerald-100 border-emerald-900",
      cellBg: "bg-emerald-50/20 border-emerald-100/60",
      cellActive: "bg-emerald-100 text-emerald-950 font-extrabold border-emerald-200",
      footerBg: "bg-emerald-200 text-emerald-950 border-emerald-300 font-black",
      badgeBg: "bg-emerald-600 text-white"
    },
    {
      headerBg: "bg-amber-700 text-white border-amber-800",
      subHeaderBg: "bg-amber-800 text-amber-100 border-amber-900",
      cellBg: "bg-amber-50/20 border-amber-100/60",
      cellActive: "bg-amber-100 text-amber-950 font-extrabold border-amber-200",
      footerBg: "bg-amber-200 text-amber-950 border-amber-300 font-black",
      badgeBg: "bg-amber-600 text-white"
    },
    {
      headerBg: "bg-rose-700 text-white border-rose-800",
      subHeaderBg: "bg-rose-800 text-rose-100 border-rose-900",
      cellBg: "bg-rose-50/20 border-rose-100/60",
      cellActive: "bg-rose-100 text-rose-950 font-extrabold border-rose-200",
      footerBg: "bg-rose-200 text-rose-950 border-rose-300 font-black",
      badgeBg: "bg-rose-600 text-white"
    },
    {
      headerBg: "bg-cyan-700 text-white border-cyan-800",
      subHeaderBg: "bg-cyan-800 text-cyan-100 border-cyan-900",
      cellBg: "bg-cyan-50/20 border-cyan-100/60",
      cellActive: "bg-cyan-100 text-cyan-950 font-extrabold border-cyan-200",
      footerBg: "bg-cyan-200 text-cyan-950 border-cyan-300 font-black",
      badgeBg: "bg-cyan-600 text-white"
    },
    {
      headerBg: "bg-indigo-700 text-white border-indigo-800",
      subHeaderBg: "bg-indigo-800 text-indigo-100 border-indigo-900",
      cellBg: "bg-indigo-50/20 border-indigo-100/60",
      cellActive: "bg-indigo-100 text-indigo-950 font-extrabold border-indigo-200",
      footerBg: "bg-indigo-200 text-indigo-950 border-indigo-300 font-black",
      badgeBg: "bg-indigo-600 text-white"
    },
    {
      headerBg: "bg-fuchsia-700 text-white border-fuchsia-800",
      subHeaderBg: "bg-fuchsia-800 text-fuchsia-100 border-fuchsia-900",
      cellBg: "bg-fuchsia-50/20 border-fuchsia-100/60",
      cellActive: "bg-fuchsia-100 text-fuchsia-950 font-extrabold border-fuchsia-200",
      footerBg: "bg-fuchsia-200 text-fuchsia-950 border-fuchsia-300 font-black",
      badgeBg: "bg-fuchsia-600 text-white"
    }
  ];

  // Compute dormitory layout statistics by Grade/Room and Gender (ช)/(ญ)
  const dormLayoutData = React.useMemo(() => {
    const countsByDormAndKey: Record<string, Record<string, number>> = {};
    const dormTotalsMap: Record<string, number> = {};
    const keyTotalMap: Record<string, number> = {};

    let totalMale = 0;
    let totalFemale = 0;
    let pccCR_Male = 0;
    let pccCR_Female = 0;
    let pccLP_Male = 0;
    let pccLP_Female = 0;

    dorms.forEach((d) => {
      countsByDormAndKey[d.id] = {};
      dormTotalsMap[d.id] = 0;
    });

    students.forEach((st) => {
      if (!st.dormId) return;

      const gTag = getGenderTag(st.title, st.gender);
      const isMale = gTag === "(ช)";

      if (isMale) totalMale++;
      else totalFemale++;

      // School determination
      const school = getSchoolByGradeRoom(st.grade, st.room);
      if (school === "จภ.ลป.") {
        if (isMale) pccLP_Male++;
        else pccLP_Female++;
      } else {
        if (isMale) pccCR_Male++;
        else pccCR_Female++;
      }

      const gradeRoomStr = st.room ? `${st.grade}/${st.room}` : st.grade;
      const key = `${gradeRoomStr} ${gTag}`;

      if (!countsByDormAndKey[st.dormId]) {
        countsByDormAndKey[st.dormId] = {};
      }
      countsByDormAndKey[st.dormId][key] = (countsByDormAndKey[st.dormId][key] || 0) + 1;
      dormTotalsMap[st.dormId] = (dormTotalsMap[st.dormId] || 0) + 1;
      keyTotalMap[key] = (keyTotalMap[key] || 0) + 1;
    });

    // KEEP ONLY keys where total students across ALL dorms > 0
    const keysWithStudents = Object.keys(keyTotalMap).filter((k) => keyTotalMap[k] > 0);

    const sortedKeys = keysWithStudents.sort((a, b) => {
      const isAMale = a.includes("(ช)");
      const isBMale = b.includes("(ช)");
      if (isAMale && !isBMale) return -1;
      if (!isAMale && isBMale) return 1;
      return a.localeCompare(b, "th", { numeric: true });
    });

    // For each dorm, extract only those keys where countsByDormAndKey[d.id][key] > 0
    const dormActiveKeysMap: Record<string, { key: string; count: number }[]> = {};
    let maxRows = 0;

    dorms.forEach((d) => {
      const activeKeysForDorm = sortedKeys
        .filter((k) => (countsByDormAndKey[d.id]?.[k] || 0) > 0)
        .map((k) => ({ key: k, count: countsByDormAndKey[d.id][k] }));
      dormActiveKeysMap[d.id] = activeKeysForDorm;
      if (activeKeysForDorm.length > maxRows) {
        maxRows = activeKeysForDorm.length;
      }
    });

    return {
      countsByDormAndKey,
      dormTotalsMap,
      sortedKeys,
      dormActiveKeysMap,
      maxRows,
      totalMale,
      totalFemale,
      totalStudents: totalMale + totalFemale,
      pccCR_Male,
      pccCR_Female,
      pccCR_Total: pccCR_Male + pccCR_Female,
      pccLP_Male,
      pccLP_Female,
      pccLP_Total: pccLP_Male + pccLP_Female
    };
  }, [dorms, students]);

  React.useEffect(() => {
    if (dorms.length > 0 && selectedDormIdsForChart.length === 0) {
      setSelectedDormIdsForChart(dorms.map((d) => d.id));
    }
  }, [dorms]);

  const dormTotals = reportData?.dormTotals || {};
  const absentStudentsList = reportData?.absentStudentsList || [];

  // Real-time calculation of dorm totals based on active attendance check status (selected date or latest)
  const realtimeDormTotals = React.useMemo(() => {
    const result: Record<string, { total: number; out: number; remaining: number }> = {};

    dorms.forEach((d) => {
      const dormStudents = getStudentsInDorm(students, d);
      const totalCount = dormStudents.length;
      const att = activeAttendanceMap[d.id] || Object.values(activeAttendanceMap).find((a) => a && isDormMatch(d, a.dormId));

      if (att && (att.status === "CHECKED" || (att.records && att.records.length > 0))) {
        let outCount = 0;
        if (att.isHomeBreak || att.status === "HOME_BREAK") {
          outCount = totalCount;
        } else if (Array.isArray(att.records)) {
          const absentSet = new Set(
            att.records
              .filter((r) => r.status && r.status !== "PRESENT")
              .map((r) => r.studentId)
          );
          outCount = dormStudents.filter((s) => absentSet.has(s.studentId)).length;
          // Fallback if records didn't match student IDs exactly
          if (outCount === 0 && absentSet.size > 0) {
            outCount = Math.min(totalCount, absentSet.size);
          }
        }
        result[d.id] = {
          total: totalCount,
          out: outCount,
          remaining: Math.max(0, totalCount - outCount)
        };
      } else if (att && (att.status === "HOME_BREAK" || att.isHomeBreak)) {
        result[d.id] = {
          total: totalCount,
          out: totalCount,
          remaining: 0
        };
      } else {
        result[d.id] = {
          total: totalCount,
          out: 0,
          remaining: totalCount
        };
      }
    });

    return result;
  }, [dorms, students, activeAttendanceMap]);

  // Calculation of grand totals across all dorms
  const realtimeGrandTotals = React.useMemo(() => {
    // Total students ALWAYS uses total registered students in system (Rule 2)
    const totalRegStudents = students.length;

    let out = 0;
    let remaining = 0;

    Object.values(realtimeDormTotals).forEach((st: any) => {
      out += Number(st?.out || 0);
      remaining += Number(st?.remaining || 0);
    });

    const total = totalRegStudents > 0 ? totalRegStudents : (out + remaining);

    return { total, out, remaining };
  }, [students.length, realtimeDormTotals]);

  // 1. Grade Statistics (สรุปสถิติข้อมูลแยกตามระดับชั้น ม.1 - ม.6) สำหรับวันปัจจุบัน/วันที่เลือก
  const dashboardGradeStats = React.useMemo(() => {
    const gradeList = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];

    // Track absent students by studentId for the active dashboard date
    const absentStudentIds = new Set<string>();

    dorms.forEach((d) => {
      const att = activeAttendanceMap[d.id] || Object.values(activeAttendanceMap).find((a) => a && isDormMatch(d, a.dormId));
      if (!att) return;
      const dormStudents = getStudentsInDorm(students, d);

      if (att.isHomeBreak || att.status === "HOME_BREAK") {
        dormStudents.forEach((s) => absentStudentIds.add(s.studentId));
      } else if (att.records && Array.isArray(att.records)) {
        att.records.forEach((rec) => {
          if (rec.status && rec.status !== "PRESENT") {
            absentStudentIds.add(rec.studentId);
          }
        });
      }
    });

    const stats = gradeList.map((g) => {
      const gStudents = students.filter((s) => s.grade === g);
      const total = gStudents.length;
      const male = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length;
      const female = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length;
      
      const outCount = gStudents.filter((s) => absentStudentIds.has(s.studentId)).length;
      const presentCount = Math.max(0, total - outCount);
      const rate = total > 0 ? (presentCount / total) * 100 : 100;

      return {
        grade: g,
        total,
        male,
        female,
        present: presentCount,
        out: outCount,
        rate: Math.min(100, rate)
      };
    });

    const totalMale = stats.reduce((acc, curr) => acc + curr.male, 0);
    const totalFemale = stats.reduce((acc, curr) => acc + curr.female, 0);
    const totalStudents = stats.reduce((acc, curr) => acc + curr.total, 0);
    const totalPresent = stats.reduce((acc, curr) => acc + curr.present, 0);
    const totalOut = stats.reduce((acc, curr) => acc + curr.out, 0);
    const overallRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 100;

    return {
      stats,
      totals: {
        male: totalMale,
        female: totalFemale,
        total: totalStudents,
        present: totalPresent,
        out: totalOut,
        rate: overallRate
      }
    };
  }, [students, dorms, activeAttendanceMap]);

  // 2. Dormitory Statistics (สรุปสถิติข้อมูลแยกตามหอพัก หอพัก 1 - 6) สำหรับวันปัจจุบัน/วันที่เลือก
  const dashboardDormStats = React.useMemo(() => {
    const stats = dorms.map((d) => {
      const isMale = d.type === "male" || d.gender === "male" || d.name?.includes("ชาย") || d.id.includes("1") || d.id.includes("2") || d.id.includes("3");
      const dTotal = countStudentsInDorm(students, d);
      const dPresent = realtimeDormTotals[d.id]?.remaining ?? dTotal;
      const dOut = realtimeDormTotals[d.id]?.out ?? 0;
      const dCapacity = d.capacity || 80;
      const occupancyRate = dTotal > 0 ? (dPresent / dTotal) * 100 : 0;

      return {
        dormId: d.id,
        dormName: d.name,
        type: isMale ? "male" : "female",
        capacity: dCapacity,
        studentCount: dTotal,
        presentCount: dPresent,
        outCount: dOut,
        occupancyRate: Math.min(100, occupancyRate)
      };
    });

    const totalCapacity = stats.reduce((acc, curr) => acc + curr.capacity, 0);
    const totalStudents = stats.reduce((acc, curr) => acc + curr.studentCount, 0);
    const totalPresent = stats.reduce((acc, curr) => acc + curr.presentCount, 0);
    const totalOut = stats.reduce((acc, curr) => acc + curr.outCount, 0);
    const overallOccupancyRate = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

    return {
      stats,
      totals: {
        capacity: totalCapacity,
        total: totalStudents,
        present: totalPresent,
        out: totalOut,
        rate: overallOccupancyRate
      }
    };
  }, [dorms, students, realtimeDormTotals]);

  // Live calculation of reasons breakdown for Doughnut Chart and stat card
  const liveReasonCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      "กลับบ้าน": 0,
      "เข้าค่าย": 0,
      "ป่วย": 0,
      "แข่งทักษะ": 0,
      "แลกเปลี่ยน": 0,
      "อื่นๆ": 0
    };

    let hasLiveRecords = false;

    dorms.forEach((d) => {
      const att = activeAttendanceMap[d.id];
      if (att && att.status === "CHECKED" && att.records) {
        hasLiveRecords = true;
        att.records.forEach((r) => {
          if (r.status === "HOME") counts["กลับบ้าน"]++;
          else if (r.status === "CAMP") counts["เข้าค่าย"]++;
          else if (r.status === "SICK") counts["ป่วย"]++;
          else if (r.status === "SKILL_COMP") counts["แข่งทักษะ"]++;
          else if (r.status === "EXCHANGE") counts["แลกเปลี่ยน"]++;
          else if (r.status === "OTHER") counts["อื่นๆ"]++;
        });
      }
    });

    if (!hasLiveRecords && absentStudentsList.length > 0 && !selectedDashboardDate) {
      absentStudentsList.forEach((s) => {
        if (s.reason && (s.reason.includes("รอบกลับ") || s.reason === "รบ")) return; // Exclude round home
        if (s.reason.includes("กลับบ้าน")) counts["กลับบ้าน"]++;
        else if (s.reason.includes("เข้าค่าย")) counts["เข้าค่าย"]++;
        else if (s.reason.includes("ป่วย")) counts["ป่วย"]++;
        else if (s.reason.includes("แข่งทักษะ")) counts["แข่งทักษะ"]++;
        else if (s.reason.includes("แลกเปลี่ยน")) counts["แลกเปลี่ยน"]++;
        else counts["อื่นๆ"]++;
      });
    }

    return counts;
  }, [dorms, activeAttendanceMap, absentStudentsList, selectedDashboardDate]);

  // Filter dorms for comparison chart based on checkboxes
  const filteredChartDorms = React.useMemo(() => {
    if (selectedDormIdsForChart.length === 0) return dorms;
    return dorms.filter((d) => selectedDormIdsForChart.includes(d.id));
  }, [dorms, selectedDormIdsForChart]);

  // Chart 1: 7-Day Attendance & Home Leaving Projection Chart
  const todayWeekIdx = React.useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // 0=Mon, 1=Tue, ..., 6=Sun
  }, []);

  const weeklyActualOut = React.useMemo(() => {
    const result = [0, 0, 0, 0, 0, 0, 0];
    result[todayWeekIdx] = realtimeGrandTotals.out;
    return result;
  }, [realtimeGrandTotals.out, todayWeekIdx]);

  const weeklyPredictedOut = React.useMemo(() => {
    const result = [0, 0, 0, 0, 0, 0, 0];
    result[todayWeekIdx] = realtimeGrandTotals.out;
    return result;
  }, [realtimeGrandTotals.out, todayWeekIdx]);

  const presentPercentage = realtimeGrandTotals.total > 0
    ? Math.round((realtimeGrandTotals.remaining / realtimeGrandTotals.total) * 100)
    : 0;

  // Calculate actual attendance checking progress
  const totalDorms = dorms.length || 6;
  const checkedDormsCount = dorms.filter(
    (d) => activeAttendanceMap[d.id]?.status === "CHECKED" || activeAttendanceMap[d.id]?.status === "HOME_BREAK"
  ).length;

  // Aggregated Historical Attendance Statistics from Firestore
  const historicalStats = React.useMemo(() => {
    const dateTotalOutMap: Record<string, number> = {};
    const dateDormOutMap: Record<string, Record<string, number>> = {};
    const dayOfWeekTotalMap: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const dormDowMap: Record<string, Record<number, number[]>> = {};

    dorms.forEach((d) => {
      dormDowMap[d.id] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    });

    const dormStudentCounts: Record<string, number> = {};
    dorms.forEach((d) => {
      const dormCount = countStudentsInDorm(students, d);
      dormStudentCounts[d.id] = dormCount > 0 ? dormCount : d.capacity || 80;
    });

    allHistoricalRecords.forEach((att) => {
      if (!att || !att.date) return;
      const dateStr = att.date;
      const dormId = att.dormId;

      let outCount = 0;
      if (att.isHomeBreak || att.status === "HOME_BREAK") {
        outCount = 0; // Exclude round-trip home break
      } else if (att.records && Array.isArray(att.records)) {
        outCount = att.records.filter((r) => r.status !== "PRESENT" && r.status !== "ROUND_HOME").length;
      }

      if (!dateDormOutMap[dateStr]) dateDormOutMap[dateStr] = {};
      dateDormOutMap[dateStr][dormId] = outCount;
    });

    if (activeAttendanceMap) {
      Object.entries(activeAttendanceMap).forEach(([dormId, attVal]) => {
        const att = attVal as DailyAttendance;
        if (!att) return;
        const dateStr = att.date || effectiveDashboardDate;
        let outCount = 0;
        if (att.isHomeBreak || att.status === "HOME_BREAK") {
          outCount = 0; // Exclude round-trip home break
        } else if (att.records && Array.isArray(att.records)) {
          outCount = att.records.filter((r) => r.status !== "PRESENT" && r.status !== "ROUND_HOME").length;
        }
        if (!dateDormOutMap[dateStr]) dateDormOutMap[dateStr] = {};
        dateDormOutMap[dateStr][dormId] = outCount;
      });
    }

    Object.entries(dateDormOutMap).forEach(([dateStr, dormMap]) => {
      let sum = 0;
      Object.values(dormMap).forEach((val) => { sum += val; });
      dateTotalOutMap[dateStr] = sum;

      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const rawDow = d.getDay();
        const dow = rawDow === 0 ? 6 : rawDow - 1;
        dayOfWeekTotalMap[dow].push(sum);

        Object.entries(dormMap).forEach(([dormId, val]) => {
          if (dormDowMap[dormId] && dormDowMap[dormId][dow]) {
            dormDowMap[dormId][dow].push(val);
          }
        });
      }
    });

    const avgDow: number[] = [];
    const maxDow: number[] = [];
    for (let i = 0; i < 7; i++) {
      const vals = dayOfWeekTotalMap[i];
      if (vals.length > 0) {
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        avgDow.push(avg);
        maxDow.push(Math.max(...vals));
      } else {
        avgDow.push(0);
        maxDow.push(0);
      }
    }

    const avgDormDowMap: Record<string, number[]> = {};
    dorms.forEach((dorm) => {
      avgDormDowMap[dorm.id] = [];
      for (let i = 0; i < 7; i++) {
        const vals = dormDowMap[dorm.id]?.[i] || [];
        const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        avgDormDowMap[dorm.id].push(avg);
      }
    });

    return {
      dateTotalOutMap,
      dateDormOutMap,
      dayOfWeekTotalMap,
      avgDow,
      maxDow,
      avgDormDowMap,
      totalRecordedDates: Object.keys(dateTotalOutMap).length
    };
  }, [allHistoricalRecords, activeAttendanceMap, dorms, students, effectiveDashboardDate]);

  // Dynamic Trend Chart Configuration based on selected condition tab
  const trendChartConfig = React.useMemo(() => {
    const dayNamesShort = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
    const now = new Date(effectiveDashboardDate);
    const rawDow = isNaN(now.getTime()) ? 0 : now.getDay();
    const currentDowIdx = rawDow === 0 ? 6 : rawDow - 1;

    if (trendTab === "today") {
      const labels = dorms.map((d) => d.name);
      const actualData = dorms.map((d) => {
        const att = activeAttendanceMap[d.id];
        if (att && att.status === "CHECKED" && att.records) {
          return att.records.filter((r) => r.status !== "PRESENT" && r.status !== "ROUND_HOME").length;
        }
        return 0;
      });
      const predictedData = dorms.map((d) => historicalStats.avgDormDowMap[d.id]?.[currentDowIdx] || 0);

      const actualSum = actualData.reduce((a, b) => a + b, 0);
      const predictedSum = predictedData.reduce((a, b) => a + b, 0);

      return {
        chartType: "bar",
        labels,
        datasets: [
          {
            label: `สถิตินักเรียนออกหอพักจริงวันนี้ (${effectiveDashboardDate.split("-").reverse().join("/")})`,
            data: actualData,
            backgroundColor: "rgba(254, 148, 150, 0.85)",
            borderColor: "#FE9496",
            borderWidth: 1.5,
            borderRadius: 8
          },
          {
            label: "ค่าเฉลี่ยออกหอปกติ (คาดการณ์ประวัติ)",
            data: predictedData,
            backgroundColor: "rgba(160, 90, 255, 0.4)",
            borderColor: "#A05AFF",
            borderWidth: 1.5,
            borderRadius: 8
          }
        ],
        card1Title: "รวมสถิติตามจริงวันนี้",
        card1Val: `${actualSum} คน`,
        card2Title: "รวมคาดการณ์เฉลี่ย",
        card2Val: `${predictedSum} คน`,
        card3Title: "สถานะการเช็คยอด",
        card3Val: `${checkedDormsCount}/${totalDorms} หอพัก`,
        card4Title: "อัตรานักเรียนอยู่หอ",
        card4Val: `${presentPercentage}%`
      };
    }

    if (trendTab === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDowIdx);

      const weekDates: string[] = [];
      const labels: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;
        weekDates.push(dateStr);
        labels.push(`${dayNamesShort[i]} ${day}/${m}`);
      }

      const actualData = weekDates.map((dStr) => {
        if (dStr in historicalStats.dateTotalOutMap) {
          return historicalStats.dateTotalOutMap[dStr];
        }
        if (dStr === effectiveDashboardDate) {
          let sum = 0;
          dorms.forEach((d) => {
            const att = activeAttendanceMap[d.id];
            if (att && att.status === "CHECKED" && att.records) {
              sum += att.records.filter((r) => r.status !== "PRESENT" && r.status !== "ROUND_HOME").length;
            }
          });
          return sum;
        }
        return 0;
      });

      const predictedData = [0, 1, 2, 3, 4, 5, 6].map((i) => historicalStats.avgDow[i] || 0);

      const actualSum = actualData.reduce((a, b) => a + b, 0);
      const predictedSum = predictedData.reduce((a, b) => a + b, 0);

      const maxVal = Math.max(...actualData, ...predictedData);
      let peakIdx = actualData.indexOf(maxVal);
      if (peakIdx === -1) peakIdx = predictedData.indexOf(maxVal);
      const peakDayText = peakIdx >= 0 && maxVal > 0 ? `วัน${dayNamesShort[peakIdx]} (${maxVal} คน)` : "ไม่มีข้อมูล";

      const accuracy = actualSum > 0 || predictedSum > 0 ? "100%" : "0%";

      return {
        chartType: "line",
        labels,
        datasets: [
          {
            label: "สถิตินักเรียนออกหอพัก (ยอดจริง 7 วัน)",
            data: actualData,
            borderColor: "#FE9496",
            backgroundColor: "rgba(254, 148, 150, 0.15)",
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#FE9496",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5
          },
          {
            label: "คาดการณ์ออกหอพัก (อ้างอิงประวัติเฉลี่ย)",
            data: predictedData,
            borderColor: "#A05AFF",
            backgroundColor: "rgba(160, 90, 255, 0.05)",
            borderDash: [6, 6],
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#A05AFF",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5
          }
        ],
        card1Title: "รวมสถิติตามจริง (7 วัน)",
        card1Val: `${actualSum} คน`,
        card2Title: "รวมคาดการณ์ (7 วัน)",
        card2Val: `${predictedSum} คน`,
        card3Title: "วันพีคออกบ้านสูงสุด",
        card3Val: peakDayText,
        card4Title: "ความแม่นยำคาดการณ์",
        card4Val: accuracy
      };
    }

    if (trendTab === "monthly") {
      const weekLabels = ["สัปดาห์ที่ 1", "สัปดาห์ที่ 2", "สัปดาห์ที่ 3", "สัปดาห์ที่ 4 (สัปดาห์นี้)"];
      const actualData = [0, 0, 0, 0];
      const predictedData = [0, 0, 0, 0];

      const weeklyAvgSum = historicalStats.avgDow.reduce((a, b) => a + b, 0);

      for (let w = 0; w < 4; w++) {
        let wActual = 0;
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const daysAgo = (3 - w) * 7 + (6 - dayOffset);
          const d = new Date(now);
          d.setDate(now.getDate() - daysAgo);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${day}`;
          if (dateStr in historicalStats.dateTotalOutMap) {
            wActual += historicalStats.dateTotalOutMap[dateStr];
          }
        }
        actualData[w] = wActual;
        predictedData[w] = weeklyAvgSum;
      }

      const actualSum = actualData.reduce((a, b) => a + b, 0);
      const predictedSum = predictedData.reduce((a, b) => a + b, 0);

      const maxVal = Math.max(...actualData);
      const peakIdx = actualData.indexOf(maxVal);
      const peakWeekText = maxVal > 0 ? `${weekLabels[peakIdx]} (${maxVal} คน)` : "ไม่มีข้อมูล";
      const avgPerWeek = Math.round(actualSum / 4);

      return {
        chartType: "bar",
        labels: weekLabels,
        datasets: [
          {
            label: "ยอดออกหอพักจริง (รายสัปดาห์)",
            data: actualData,
            backgroundColor: "rgba(254, 148, 150, 0.85)",
            borderColor: "#FE9496",
            borderWidth: 1.5,
            borderRadius: 8
          },
          {
            label: "คาดการณ์ออกหอพัก (อ้างอิงประวัติเฉลี่ย)",
            data: predictedData,
            backgroundColor: "rgba(160, 90, 255, 0.4)",
            borderColor: "#A05AFF",
            borderWidth: 1.5,
            borderRadius: 8
          }
        ],
        card1Title: "รวมสถิติตามจริง (4 สัปดาห์)",
        card1Val: `${actualSum} คน`,
        card2Title: "รวมคาดการณ์ (4 สัปดาห์)",
        card2Val: `${predictedSum} คน`,
        card3Title: "สัปดาห์พีคสูงสุด",
        card3Val: peakWeekText,
        card4Title: "เฉลี่ยสัปดาห์ละ",
        card4Val: `${avgPerWeek} คน`
      };
    }

    // "overall"
    const overallLabels = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"];
    const actualData = historicalStats.avgDow;
    const maxData = historicalStats.maxDow;

    const allTimeTotalOut = (Object.values(historicalStats.dateTotalOutMap) as number[]).reduce((a: number, b: number) => a + b, 0);
    const totalRecordedDays = historicalStats.totalRecordedDates;

    const maxVal = Math.max(...actualData);
    const peakIdx = actualData.indexOf(maxVal);
    const peakDayText = maxVal > 0 ? `${overallLabels[peakIdx]} (${maxVal} คน/วัน)` : "ไม่มีข้อมูล";

    const avgDailyOut = totalRecordedDays > 0 ? Math.round(allTimeTotalOut / totalRecordedDays) : 0;

    return {
      chartType: "line",
      labels: overallLabels,
      datasets: [
        {
          label: "เฉลี่ยยอดออกหอพักสะสม (ประวัติทั้งหมด)",
          data: actualData,
          borderColor: "#A05AFF",
          backgroundColor: "rgba(160, 90, 255, 0.2)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#A05AFF",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 6
        },
        {
          label: "สถิติตามจริงสูงสุดที่เคยมี (Peak Rate)",
          data: maxData,
          borderColor: "#FE9496",
          backgroundColor: "rgba(254, 148, 150, 0.05)",
          borderDash: [5, 5],
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#FE9496",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 5
        }
      ],
      card1Title: "ประวัติบันทึกทั้งหมด",
      card1Val: `${totalRecordedDays} วัน`,
      card2Title: "รวมยอดออกหอสะสม",
      card2Val: `${allTimeTotalOut} คน`,
      card3Title: "วันพีคออกหอประจำสัปดาห์",
      card3Val: peakDayText,
      card4Title: "อัตราเฉลี่ยออกหอรวม",
      card4Val: `${avgDailyOut} คน/วัน`
    };
  }, [trendTab, dorms, realtimeDormTotals, historicalStats, effectiveDashboardDate, checkedDormsCount, totalDorms, presentPercentage, realtimeGrandTotals.out]);

  if (isLoading && !reportData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#A05AFF] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-600">กำลังโหลดข้อมูล Dashboard...</span>
        </div>
      </div>
    );
  }

  const safeReportData: DailyReportData = reportData || {
    success: true,
    reportDate: effectiveDashboardDate || getTodayDateString(),
    summaryDate: effectiveDashboardDate || getTodayDateString(),
    date: effectiveDashboardDate || getTodayDateString(),
    dormitories: dorms,
    grades: ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"],
    grandTotals: { total: 0, out: 0, remaining: 0 },
    gradeTotals: {
      "ม.1": { total: 0, out: 0, remaining: 0 },
      "ม.2": { total: 0, out: 0, remaining: 0 },
      "ม.3": { total: 0, out: 0, remaining: 0 },
      "ม.4": { total: 0, out: 0, remaining: 0 },
      "ม.5": { total: 0, out: 0, remaining: 0 },
      "ม.6": { total: 0, out: 0, remaining: 0 }
    },
    dormTotals: {},
    totalMatrix: {},
    outMatrix: {},
    remainingMatrix: {},
    absentStudentsList: []
  };


  const { grandTotals, gradeTotals } = safeReportData;


  // Chart 0: Dormitory Comparison Chart (การจัดวาง layer จากบน ลง ล่าง)
  const dormComparisonChartData = {
    labels: filteredChartDorms.map((d) => d.name),
    datasets: [
      {
        label: "นักเรียนออกหอพัก (คน)",
        data: filteredChartDorms.map((d) => realtimeDormTotals[d.id]?.out || 0),
        backgroundColor: "rgba(254, 148, 150, 0.4)",
        borderColor: "#FE9496",
        pointBackgroundColor: "#FE9496",
        pointBorderColor: "#ffffff",
        borderWidth: 2,
        order: 1, // บนสุด (Top Layer)
      },
      {
        label: "นักเรียนอยู่หอพัก (คน)",
        data: filteredChartDorms.map((d) => realtimeDormTotals[d.id]?.remaining || 0),
        backgroundColor: "rgba(27, 207, 180, 0.35)",
        borderColor: "#1BCFB4",
        pointBackgroundColor: "#1BCFB4",
        pointBorderColor: "#ffffff",
        borderWidth: 2,
        order: 2,
      },
      {
        label: "นักเรียนทั้งหมด (คน)",
        data: filteredChartDorms.map((d) => realtimeDormTotals[d.id]?.total || 0),
        backgroundColor: "rgba(160, 90, 255, 0.3)",
        borderColor: "#A05AFF",
        pointBackgroundColor: "#A05AFF",
        pointBorderColor: "#ffffff",
        borderWidth: 2,
        order: 3,
      },
      {
        label: "ความจุที่รองรับ (คน)",
        data: filteredChartDorms.map((d) => d.capacity || 80),
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "#3B82F6",
        pointBackgroundColor: "#3B82F6",
        pointBorderColor: "#ffffff",
        borderWidth: 2,
        order: 4, // ล่างสุด (Bottom Layer)
      }
    ]
  };

  // Chart 2: Absence Reasons Doughnut Chart
  const doughnutData = {
    labels: Object.keys(liveReasonCounts),
    datasets: [
      {
        data: Object.values(liveReasonCounts),
        backgroundColor: ["#A05AFF", "#1BCFB4", "#FE9496", "#4BCBEB", "#9E58FF"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }
    ]
  };

  // Calculate totals for insight summary
  const actualTotalOutThisWeek = weeklyActualOut.reduce((acc, curr) => acc + curr, 0);
  const predictedTotalOutThisWeek = weeklyPredictedOut.reduce((acc, curr) => acc + curr, 0);

  const maxWeeklyOut = Math.max(...weeklyActualOut, ...weeklyPredictedOut);
  const peakDayIdx = maxWeeklyOut > 0 ? (weeklyActualOut.indexOf(maxWeeklyOut) !== -1 ? weeklyActualOut.indexOf(maxWeeklyOut) : weeklyPredictedOut.indexOf(maxWeeklyOut)) : -1;
  const dayNames = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  const peakDayText = peakDayIdx !== -1 ? `${dayNames[peakDayIdx]} (${maxWeeklyOut} คน)` : "ไม่มีข้อมูล (0 คน)";

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Section Grid: Left = Thai Calendar Picker, Right = 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side (lg:col-span-5 xl:col-span-4): Thai Calendar Picker */}
        <div className="lg:col-span-5 xl:col-span-4">
          <ThaiCalendarPicker
            selectedDate={selectedDashboardDate || effectiveDashboardDate}
            onSelectDate={setSelectedDashboardDate}
            checkedDates={checkedAttendanceDates}
            todayDate={getTodayDateString()}
          />
        </div>

        {/* Right Side (lg:col-span-7 xl:col-span-8): 4 Summary Stat Cards */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between space-y-4">
          {selectedDashboardDate && selectedDashboardDate !== effectiveDashboardDate ? (
            <div className="bg-purple-100/90 border border-purple-300 text-purple-950 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A05AFF] animate-ping" />
                <span>
                  กำลังแสดงข้อมูลสถิติประวัติย้อนหลัง วันที่ {selectedDashboardDate.split("-").reverse().join("/")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDashboardDate("")}
                className="text-[#A05AFF] hover:underline font-extrabold text-[11px] cursor-pointer"
              >
                สลับกลับเป็นยอดล่าสุด
              </button>
            </div>
          ) : (
            <div className="bg-purple-100/90 border border-purple-300 text-purple-950 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    กำลังแสดงข้อมูลการเช็คยอดของคืนวันที่ {effectiveDashboardDate.split("-").reverse().join("/")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-purple-800 font-semibold pl-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span>
                    สรุปยอดนักเรียนออกหอพักวันที่ {getFormattedNextDay(effectiveDashboardDate)} จะแสดงหลังเช็คยอดคืนนี้
                  </span>
                </div>
              </div>
              <span className="text-purple-700 font-semibold text-[11px] shrink-0 self-start sm:self-center">
                {effectiveDashboardDate === getTodayDateString()
                  ? "ข้อมูลการเช็คยอดล่าสุดของวันนี้"
                  : "ข้อมูลการเช็คยอดล่าสุด"}
              </span>
            </div>
          )}

          {/* 4 Sleek Interface Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Card 1: Total Students - Coral/Pink Gradient */}
            <div className="bg-gradient-to-r from-[#FE9496] to-[#ff6b8b] p-5 lg:p-6 rounded-2xl shadow-md text-white relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-extrabold text-white/95 uppercase tracking-wide mb-1.5">นักเรียนทั้งหมด</p>
                  <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{realtimeGrandTotals.total.toLocaleString()}</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-3 text-xs sm:text-sm font-semibold text-white/90 relative z-10 flex items-center gap-1">
                <span>ครอบคลุมนักเรียนหอพัก 1 - 6</span>
              </div>
            </div>

            {/* Card 2: Remaining In Dorm - Cyan/Blue Gradient */}
            <div className="bg-gradient-to-r from-[#4BCBEB] to-[#3699ff] p-5 lg:p-6 rounded-2xl shadow-md text-white relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-extrabold text-white/95 uppercase tracking-wide mb-1.5">มาเรียนปกติ / อยู่หอ</p>
                  <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{realtimeGrandTotals.remaining.toLocaleString()}</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <Bookmark className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-3 text-xs sm:text-sm font-semibold text-white/90 relative z-10">
                <span>{presentPercentage}% ของนักเรียนทั้งหมด</span>
              </div>
            </div>

            {/* Card 3: Out / Absent - Teal/Mint Gradient */}
            <div className="bg-gradient-to-r from-[#1BCFB4] to-[#0d9488] p-5 lg:p-6 rounded-2xl shadow-md text-white relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-extrabold text-white/95 uppercase tracking-wide mb-1.5">ออกหอพัก / ลา</p>
                  <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{realtimeGrandTotals.out.toLocaleString()}</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <Activity className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-3 text-xs sm:text-sm font-semibold text-white/90 relative z-10">
                <span>กลับบ้าน {liveReasonCounts["กลับบ้าน"]} • ป่วย {liveReasonCounts["ป่วย"]} คน</span>
              </div>
            </div>

            {/* Card 4: Dorm Status - Purple Gradient */}
            <div className="bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] p-5 lg:p-6 rounded-2xl shadow-md text-white relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-sm font-extrabold text-white/95 uppercase tracking-wide mb-1.5">
                    สถานะการเช็คยอด
                  </p>
                  <h3 className="text-3xl lg:text-4xl font-black text-white tracking-tight">{checkedDormsCount} / {totalDorms} หอพัก</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-3 text-xs sm:text-sm font-semibold text-white/90 relative z-10">
                <span>
                  {checkedDormsCount === totalDorms
                    ? "ส่งข้อมูลเช็คยอดเรียบร้อยครบทุกหอ"
                    : `เช็คยอดแล้ว ${checkedDormsCount} หอ (เหลืออีก ${totalDorms - checkedDormsCount} หอ)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2 Deep-Dive Summary Tables: สรุปสถิติข้อมูลแยกตามระดับชั้น & สรุปสถิติข้อมูลแยกตามหอพัก (Placed above บันทึกการอบรม) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table 1: สรุปสถิติข้อมูลแยกตามระดับชั้น */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>สรุปสถิติข้อมูลแยกตามระดับชั้น</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">มัธยมศึกษาปีที่ 1 - 6</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200">ระดับชั้น</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-200">ชาย</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-200">หญิง</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-200">รวม</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-200">อยู่</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-200">ออก</th>
                    <th className="py-2.5 px-2.5 text-center">ร้อยละ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardGradeStats.stats.map((g) => (
                    <tr key={g.grade} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-100">{g.grade}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-blue-700 border-r border-slate-100">{g.male}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-pink-700 border-r border-slate-100">{g.female}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900 border-r border-slate-100">{g.total}</td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-emerald-700 border-r border-slate-100">{g.present}</td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-rose-600 border-r border-slate-100">{g.out}</td>
                      <td className="py-2.5 px-2.5 text-center font-extrabold text-purple-700">{g.rate.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td className="py-2.5 px-3 font-black text-slate-900 border-r border-slate-200">รวมทั้งหมด</td>
                    <td className="py-2.5 px-2 text-center font-bold text-blue-800 border-r border-slate-200">{dashboardGradeStats.totals.male}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-pink-800 border-r border-slate-200">{dashboardGradeStats.totals.female}</td>
                    <td className="py-2.5 px-2 text-center font-black text-slate-900 border-r border-slate-200">{dashboardGradeStats.totals.total}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-emerald-800 border-r border-slate-200">{dashboardGradeStats.totals.present}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-rose-700 border-r border-slate-200">{dashboardGradeStats.totals.out}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-purple-800">{dashboardGradeStats.totals.rate.toFixed(0)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Table 2: สรุปสถิติข้อมูลแยกตามหอพัก */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>สรุปสถิติข้อมูลแยกตามหอพัก (Dormitory Breakdown)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">หอพัก 1 - 6 พร้อมอัตราการเข้าพัก</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-100">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-purple-100">ชื่อหอพัก</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ประเภท</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ความจุ</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">นักเรียน</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">อยู่</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ออก</th>
                    <th className="py-2.5 px-3 text-center">อัตราการเข้าพัก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardDormStats.stats.map((d) => (
                    <tr key={d.dormId} className="hover:bg-purple-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-100">{d.dormName}</td>
                      <td className="py-2.5 px-2.5 text-center border-r border-slate-100">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${d.type === "male" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>
                          {d.type === "male" ? "ชาย" : "หญิง"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-slate-600 border-r border-slate-100">{d.capacity}</td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-900 border-r border-slate-100">{d.studentCount}</td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-emerald-700 border-r border-slate-100">{d.presentCount}</td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-rose-600 border-r border-slate-100">{d.outCount}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-14 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full"
                              style={{ width: `${d.occupancyRate}%` }}
                            ></div>
                          </div>
                          <span className="font-extrabold text-slate-800 text-[11px]">{d.occupancyRate.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-purple-100/70 font-bold border-t border-purple-200">
                  <tr>
                    <td className="py-2.5 px-3 font-black text-purple-950 border-r border-purple-200">รวมทั้งหมด</td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-purple-900 border-r border-purple-200">-</td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-slate-700 border-r border-purple-200">{dashboardDormStats.totals.capacity}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-purple-950 border-r border-purple-200">{dashboardDormStats.totals.total}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-emerald-800 border-r border-purple-200">{dashboardDormStats.totals.present}</td>
                    <td className="py-2.5 px-2.5 text-center font-black text-rose-700 border-r border-purple-200">{dashboardDormStats.totals.out}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-14 bg-purple-200/80 rounded-full h-2 overflow-hidden border border-purple-300">
                          <div
                            className="bg-gradient-to-r from-purple-700 to-indigo-700 h-full rounded-full"
                            style={{ width: `${dashboardDormStats.totals.rate}%` }}
                          ></div>
                        </div>
                        <span className="font-black text-purple-950 text-[11px]">{dashboardDormStats.totals.rate.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Notice & Dorm Orientation Notes Banner (Placed right before dormitory statistics) */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#A05AFF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-[#A05AFF]/20 border border-[#A05AFF]/30 rounded-2xl shrink-0 backdrop-blur-md">
              <Megaphone className="w-6 h-6 text-[#1BCFB4]" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#1BCFB4] font-extrabold tracking-wide uppercase">
                  บันทึกการอบรม / แจ้งการหอประจำวัน
                </span>
                {selectedDashboardDate ? (
                  <span className="bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    ประจำวันที่ {selectedDashboardDate.split("-").reverse().join("/")}
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    ประจำวันที่ {effectiveDashboardDate.split("-").reverse().join("/")} {effectiveDashboardDate === getTodayDateString() ? "(วันนี้)" : "(ข้อมูลเมื่อคืน)"}
                  </span>
                )}
              </div>

              {/* Notice Content from Head of Dormitory (เรื่องแจ้งอบรมจากหัวหน้างานหอพัก - ถ้ามีให้แสดงก่อน) */}
              {activeNotice ? (
                <div className="bg-slate-800/90 rounded-2xl p-4 border border-purple-500/40 space-y-2.5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1BCFB4] shrink-0" />
                      <h4 className="font-extrabold text-[#1BCFB4] text-sm">
                        เรื่องแจ้งอบรมจากหัวหน้างานหอพัก
                      </h4>
                    </div>
                    {activeNotice.createdBy && (
                      <span className="text-[11px] text-slate-300 bg-slate-900/80 px-2.5 py-0.5 rounded-md border border-slate-700/60 font-medium">
                        ผู้บันทึก: {activeNotice.createdBy}
                      </span>
                    )}
                  </div>

                  {activeNotice.title && (
                    <p className="text-xs font-extrabold text-white px-1">
                      {activeNotice.title}
                    </p>
                  )}

                  {activeNotice.topics && activeNotice.topics.length > 0 && (
                    <ol className="space-y-1.5 text-xs text-slate-200">
                      {activeNotice.topics.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 font-medium leading-relaxed">
                          <span className="font-extrabold text-[#1BCFB4] shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="break-words">{t}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}

              {/* Dorm Orientation Notes recorded by teachers (แสดงรวมเป็นหอพัก และเรียงตามหอพัก 1-6) */}
              {groupedDormOrientationNotes.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-extrabold text-amber-300 text-xs sm:text-sm">
                      บันทึกการอบรมเพิ่มเติมจากครูประจำหอพัก (จากการเช็คยอด)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    {groupedDormOrientationNotes.map((group) => (
                      <div
                        key={group.dormId}
                        className="bg-slate-800/90 rounded-2xl p-3.5 border border-slate-700/80 space-y-2 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#1BCFB4]" />
                                <span>{group.dormName}</span>
                              </span>
                              <span className="text-[11px] font-semibold text-[#1BCFB4] pl-3.5">
                                แจ้งเรื่องอบรม
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0 self-start">
                              {group.notes.length}
                            </span>
                          </div>

                          <ol className="space-y-1.5 text-slate-200">
                            {group.notes.map((note, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 bg-slate-900/60 p-2 rounded-xl border border-slate-700/40 text-xs font-medium leading-relaxed"
                              >
                                <span className="font-extrabold text-amber-400 shrink-0 select-none">
                                  {idx + 1}.
                                </span>
                                <span className="break-words">{note}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback when neither notice nor orientation notes exist */}
              {!activeNotice && groupedDormOrientationNotes.length === 0 && (
                <p className="text-xs text-slate-400 font-medium">
                  {selectedDashboardDate
                    ? `ไม่มีบันทึกการอบรม หรือเรื่องแจ้งประจำวันสำหรับวันที่ ${selectedDashboardDate.split("-").reverse().join("/")}`
                    : "ไม่มีบันทึกการอบรม หรือเรื่องแจ้งประจำวันในการเช็คยอดล่าสุด"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dormitory Stats & Comparison Chart Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
        {/* Header Section */}
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#A05AFF]" />
            <h3 className="font-extrabold text-slate-900 text-base lg:text-lg">
              สถิตินักเรียนแยกตามหอพัก (หอพัก 1 - 6)
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsDormLayoutModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#A05AFF] hover:bg-[#8E3CFF] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
          >
            <Table className="w-4 h-4" />
            <span>ผังการจัดหอพัก</span>
          </button>
        </div>

        {/* Checkbox Filter Bar & Chart View Toggle on 3 Separate Lines */}
        <div className="space-y-3 bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100/80">
          {/* Line 1: Choose Chart View Mode (Bar / Radar) */}
          <div className="flex items-center justify-between border-b border-purple-100/80 pb-2.5">
            <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
              <span>เลือกโหมดการแสดงผลกราฟ:</span>
            </span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setChartViewMode("bar")}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  chartViewMode === "bar"
                    ? "bg-[#A05AFF] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                กราฟแท่ง
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode("radar")}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  chartViewMode === "radar"
                    ? "bg-[#A05AFF] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                กราฟเรดาร์
              </button>
            </div>
          </div>

          {/* Line 2: Filter Title and "เลือกทั้งหมด" button (without "ยกเลิกทั้งหมด") */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="text-purple-900 font-extrabold flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#A05AFF]" />
              คลิกเลือกหอพักเพื่อเปรียบเทียบในกราฟ:
            </span>
            {selectedDormIdsForChart.length < dorms.length && (
              <button
                type="button"
                onClick={() => setSelectedDormIdsForChart(dorms.map((d) => d.id))}
                className="px-2.5 py-1 text-[11px] font-extrabold bg-purple-200 text-purple-900 rounded-lg hover:bg-purple-300 transition-all cursor-pointer shrink-0"
              >
                เลือกทั้งหมด
              </button>
            )}
          </div>

          {/* Line 3: Checkbox blocks for dormitories */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {dorms.map((d) => {
              const isChecked = selectedDormIdsForChart.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    isChecked
                      ? "bg-white text-purple-900 border-purple-300 shadow-2xs"
                      : "bg-white/60 text-slate-400 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDormIdsForChart([...selectedDormIdsForChart, d.id]);
                      } else {
                        setSelectedDormIdsForChart(selectedDormIdsForChart.filter((id) => id !== d.id));
                      }
                    }}
                    className="rounded text-[#A05AFF] focus:ring-[#A05AFF] w-3.5 h-3.5"
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Left = Dorm Cards (2 cols per row), Right = Comparison Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Side: Dormitories 1 to 6 in 2 columns per row */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dorms.map((dorm) => {
              const stats = realtimeDormTotals[dorm.id] || { remaining: 0, out: 0, total: 0 };
              const att = activeAttendanceMap[dorm.id];
              const isChecked = att?.status === "CHECKED";
              const isHomeBreak = att?.status === "HOME_BREAK";
              const isMale = dorm.gender === "male" || dorm.id.includes("1") || dorm.id.includes("2") || dorm.id.includes("3");

              return (
                <div
                  key={dorm.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isChecked
                      ? "bg-emerald-50/40 border-emerald-200"
                      : isHomeBreak
                      ? "bg-amber-50/40 border-amber-200"
                      : "bg-slate-50/80 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-extrabold text-slate-900 truncate">{dorm.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isMale ? "bg-purple-100 text-purple-700" : "bg-pink-100 text-pink-700"}`}>
                        {isMale ? "หอชาย" : "หอหญิง"}
                      </span>
                    </div>
                    {isChecked ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        เช็คแล้ว
                      </span>
                    ) : isHomeBreak ? (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        รอบกลับบ้าน
                      </span>
                    ) : (
                      <span className="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        รอเช็คยอด
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-1 text-xs border-t border-slate-200/60 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">ความจุที่รองรับ:</span>
                      <span className="text-blue-700 font-black">{dorm.capacity || 80} คน</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">นักเรียนทั้งหมด:</span>
                      <span className="text-purple-700 font-black">{stats.total} คน</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">มาเรียนปกติ / อยู่หอ:</span>
                      <span className="text-teal-700 font-black">{stats.remaining} คน</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">ออกหอพัก / ลา:</span>
                      <span className="text-rose-600 font-black">{stats.out} คน</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Side: Overlay / Comparison Chart */}
          <div className="lg:col-span-6 h-80 w-full flex justify-center items-center p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
            {chartViewMode === "bar" ? (
              <Bar
                data={dormComparisonChartData}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" },
                        usePointStyle: true,
                        boxWidth: 8
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.raw} คน`
                      }
                    }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      grid: { color: "#f1f5f9" },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 10 } }
                    },
                    y: {
                      grid: { display: false },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" } }
                    }
                  }
                }}
              />
            ) : (
              <Radar
                data={dormComparisonChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" },
                        usePointStyle: true,
                        boxWidth: 8
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.raw} คน`
                      }
                    }
                  },
                  scales: {
                    r: {
                      angleLines: { color: "#e2e8f0" },
                      grid: { color: "#f1f5f9" },
                      pointLabels: {
                        font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" },
                        color: "#334155"
                      },
                      ticks: {
                        font: { family: "Sarabun, sans-serif", size: 9 },
                        backdropColor: "transparent"
                      },
                      beginAtZero: true
                    }
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Line / Bar Chart: Summary Stats & Departure Prediction with 4 Filter Conditions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base lg:text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                สรุปสถิติการเช็คยอดประจำวัน (7 วัน) & คาดการณ์การออกหอพัก
              </h3>
            </div>

            {/* Filter Toggle Buttons for 4 Conditions */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setTrendTab("today")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  trendTab === "today"
                    ? "bg-white text-purple-900 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                วันนี้/ปัจจุบัน
              </button>
              <button
                type="button"
                onClick={() => setTrendTab("weekly")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  trendTab === "weekly"
                    ? "bg-white text-purple-900 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                รายสัปดาห์ (7 วัน)
              </button>
              <button
                type="button"
                onClick={() => setTrendTab("monthly")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  trendTab === "monthly"
                    ? "bg-white text-purple-900 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                รายเดือน (4 สัปดาห์)
              </button>
              <button
                type="button"
                onClick={() => setTrendTab("overall")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  trendTab === "overall"
                    ? "bg-white text-purple-900 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                แนวโน้มภาพรวม
              </button>
            </div>
          </div>

          <div className="h-64">
            {trendChartConfig.chartType === "bar" ? (
              <Bar
                data={{
                  labels: trendChartConfig.labels,
                  datasets: trendChartConfig.datasets
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" },
                        usePointStyle: true,
                        boxWidth: 8
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.raw} คน`
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: "#f1f5f9" },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 11 } }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" } }
                    }
                  }
                }}
              />
            ) : (
              <Line
                data={{
                  labels: trendChartConfig.labels,
                  datasets: trendChartConfig.datasets
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" },
                        usePointStyle: true,
                        boxWidth: 8
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.raw} คน`
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: "#f1f5f9" },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 11 } }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" } }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Projection Insights Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 flex items-center justify-between">
            <span className="text-purple-900 font-bold">{trendChartConfig.card1Title}:</span>
            <span className="font-black text-purple-800 bg-purple-200/80 px-2 py-0.5 rounded-md">
              {trendChartConfig.card1Val}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
            <span className="text-purple-900 font-bold">{trendChartConfig.card2Title}:</span>
            <span className="font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
              {trendChartConfig.card2Val}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
            <span className="text-rose-900 font-bold">{trendChartConfig.card3Title}:</span>
            <span className="font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
              {trendChartConfig.card3Val}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100 flex items-center justify-between">
            <span className="text-teal-900 font-bold">{trendChartConfig.card4Title}:</span>
            <span className="font-black text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">
              {trendChartConfig.card4Val}
            </span>
          </div>
        </div>
      </div>

      {/* Full-width Section: สัดส่วนและแนวโน้มสาเหตุการออกหอพัก (Weekly, Monthly, Overall Trends) */}
      <ReasonAnalyticsCard
        liveReasonCounts={liveReasonCounts}
        grandTotals={realtimeGrandTotals}
        todayAttendance={activeAttendanceMap}
        absentStudentsList={absentStudentsList}
        dorms={dorms}
        allHistoricalRecords={allHistoricalRecords}
        effectiveDashboardDate={effectiveDashboardDate}
        students={students}
        realtimeDormTotals={realtimeDormTotals}
      />

      {/* Dormitories 1 - 6 Evening Check Progress Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex flex-wrap items-center gap-2">
              <span>สรุปยอดนักเรียนตามหอพัก (เวลา 20.00 น.)</span>
              {new Date().getHours() >= 20 && (
                <span className="bg-purple-100 text-purple-800 border border-purple-300 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 shadow-2xs animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-[#A05AFF]" />
                  เข้าสู่สถานะเตรียมเช็คยอดแล้ว
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">สถานะการส่งข้อมูลและสถิตินักเรียนแยกตามหอพัก 1 - 6</p>
          </div>
          <button
            onClick={() => onNavigateToCheck(undefined, effectiveDashboardDate)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>ไปที่หน้าเช็คชื่อ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dorms.map((dorm) => {
            const att = activeAttendanceMap[dorm.id];
            const isChecked = att?.status === "CHECKED";
            const isHomeBreak = att?.status === "HOME_BREAK";
            const isTodayChecked = isChecked || isHomeBreak;
            const targetDate = effectiveDashboardDate;

            const currentHour = new Date().getHours();
            const isPrepCheckTime = !isTodayChecked && (currentHour >= 20 || effectiveDashboardDate === getTodayDateString());

            return (
              <div
                key={dorm.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isTodayChecked
                    ? "border-emerald-300 bg-emerald-100/90 text-slate-900 shadow-xs"
                    : isPrepCheckTime
                    ? "border-purple-300 bg-gradient-to-br from-purple-50/90 via-indigo-50/60 to-purple-100/50 text-slate-900 shadow-md ring-1 ring-purple-200/70"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{dorm.name}</h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{dorm.teacherName}</p>
                  </div>
                  {isChecked ? (
                    <span className="bg-emerald-200 text-emerald-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      เช็คแล้ว
                    </span>
                  ) : isHomeBreak ? (
                    <span className="bg-amber-200 text-amber-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                      รอบวันกลับบ้าน
                    </span>
                  ) : isPrepCheckTime ? (
                    <span className="bg-purple-100/90 text-purple-800 border border-purple-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs animate-pulse">
                      <Sparkles className="w-3.5 h-3.5 text-[#A05AFF]" />
                      เตรียมพร้อมเช็คยอด
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      รอเช็คยอด 20.00น.
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-700 border-t border-slate-200/80 pt-2.5 font-medium">
                  <span>ยอดทั้งหมด: <strong className="text-slate-900 font-black">{realtimeDormTotals[dorm.id]?.total || 0}</strong> คน</span>
                  <span>อยู่หอ: <strong className="text-teal-800 font-black">{realtimeDormTotals[dorm.id]?.remaining || 0}</strong> คน</span>
                </div>

                <button
                  onClick={() => onNavigateToCheck(dorm.id, targetDate)}
                  className={`mt-3 w-full py-2.5 px-3 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isTodayChecked
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-2xs"
                      : isPrepCheckTime
                      ? "bg-gradient-to-r from-[#A05AFF] to-[#8e45f0] hover:from-[#8e45f0] hover:to-[#7c32e0] text-white border border-purple-500 shadow-md shadow-[#A05AFF]/30 transform active:scale-98"
                      : "bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-600"
                  }`}
                >
                  {isTodayChecked ? (
                    <>
                      <Eye className="w-4 h-4 text-white" />
                      <span>ดู / แก้ไขการเช็คยอด</span>
                    </>
                  ) : (
                    <span>เช็คยอดหอพักนี้</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: ผังการจัดหอพัก (Dormitory Layout Table) */}
      {isDormLayoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-6xl w-full p-6 shadow-2xl border border-purple-100 space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#A05AFF] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">ผังการจัดหอพัก (Dormitory Layout Statistics)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ตารางแสดงจำนวนนักเรียนแยกตามระดับชั้น/ห้อง และเพศ (ช/ญ) ของแต่ละหอพัก
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentUser && (
                  <button
                    type="button"
                    onClick={handleExportDormLayoutHtml}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    title="ส่งออกผังการจัดหอพักเป็นไฟล์ HTML/CSS สำหรับเปิดดู พิมพ์ และบันทึก (.html)"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-100" />
                    <span>ส่งออกรายงาน / พิมพ์ (HTML/CSS)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsDormLayoutModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Container for HTML Export & Printing */}
            <div id="dorm-layout-printable" className="overflow-y-auto max-h-[68vh] p-2 space-y-3 bg-white rounded-2xl">
              {/* Header Component with mb-3 margin bottom */}
              <div className="border-b border-slate-200 pb-3 mb-3 text-center space-y-1">
                <h1 className="text-lg font-black text-slate-900">
                  ผังการจัดหอพัก (Dormitory Layout Statistics)
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  ตารางแสดงสถิติจำนวนนักเรียนแยกตามระดับชั้น/ห้อง และเพศ (ช/ญ) ของแต่ละหอพัก
                </p>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs bg-white">
              <table className="w-full border-collapse text-xs text-slate-700">
                <thead className="sticky top-0 z-10 text-[11px]">
                  {/* Header Row 1: Dorm Names with Individual Colors */}
                  <tr>
                    {dorms.map((d, dIdx) => {
                      const scheme = DORM_COLOR_SCHEMES[dIdx % DORM_COLOR_SCHEMES.length];
                      return (
                        <th
                          key={d.id}
                          colSpan={2}
                          className={`py-2.5 px-3 text-center border-b border-r ${scheme.headerBg}`}
                        >
                          <div className="font-extrabold text-sm">{d.name}</div>
                        </th>
                      );
                    })}
                  </tr>
                  {/* Header Row 2: Sub-columns (ระดับชั้น, จำนวน) */}
                  <tr className="text-[10px] uppercase tracking-wider font-extrabold">
                    {dorms.flatMap((d, dIdx) => {
                      const scheme = DORM_COLOR_SCHEMES[dIdx % DORM_COLOR_SCHEMES.length];
                      return [
                        <th
                          key={`${d.id}-col1`}
                          className={`py-2 px-3 text-left border-b border-r w-28 ${scheme.subHeaderBg}`}
                        >
                          ระดับชั้น
                        </th>,
                        <th
                          key={`${d.id}-col2`}
                          className={`py-2 px-3 text-center border-b border-r w-16 ${scheme.subHeaderBg}`}
                        >
                          จำนวน
                        </th>
                      ];
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dormLayoutData.maxRows === 0 ? (
                    <tr>
                      <td colSpan={dorms.length * 2} className="py-12 text-center text-slate-400">
                        ไม่พบข้อมูลรายชื่อนักเรียนที่มีระดับชั้นในระบบ
                      </td>
                    </tr>
                  ) : (
                    Array.from({ length: dormLayoutData.maxRows }).map((_, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        {dorms.flatMap((d, dIdx) => {
                          const scheme = DORM_COLOR_SCHEMES[dIdx % DORM_COLOR_SCHEMES.length];
                          const item = dormLayoutData.dormActiveKeysMap[d.id]?.[rIdx];
                          return [
                            <td
                              key={`${d.id}-r${rIdx}-lbl`}
                              className={`py-2 px-3 font-semibold text-slate-800 border-r ${
                                item ? "bg-white" : "bg-slate-50/10 opacity-30"
                              }`}
                            >
                              {item ? item.key : ""}
                            </td>,
                            <td
                              key={`${d.id}-r${rIdx}-val`}
                              className={`py-2 px-3 text-center border-r ${
                                item ? scheme.cellActive : "bg-slate-50/10 opacity-30"
                              }`}
                            >
                              {item ? item.count : ""}
                            </td>
                          ];
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 font-black text-xs shadow-md">
                  <tr>
                    {dorms.flatMap((d, dIdx) => {
                      const scheme = DORM_COLOR_SCHEMES[dIdx % DORM_COLOR_SCHEMES.length];
                      const total = dormLayoutData.dormTotalsMap[d.id] || 0;
                      return [
                        <td key={`${d.id}-tot-lbl`} className={`py-2.5 px-3 border-r ${scheme.footerBg}`}>
                          รวมทั้งหมด
                        </td>,
                        <td key={`${d.id}-tot-val`} className={`py-2.5 px-3 text-center border-r ${scheme.footerBg}`}>
                          {total}
                        </td>
                      ];
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Summary Cards (Outside Table): Gender Totals & School Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Card 1: Total Gender Breakdown */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-sm">
                <div className="text-xs font-black flex items-center justify-between border-b border-slate-700 pb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-100">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>สรุปนักเรียนในหอพักทั้งหมด</span>
                  </span>
                  <span className="bg-purple-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    รวม {dormLayoutData.totalStudents} คน
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-blue-300 font-bold">นักเรียนชาย (ช)</div>
                    <div className="text-sm font-black text-blue-100">{dormLayoutData.totalMale} คน</div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-rose-300 font-bold">นักเรียนหญิง (ญ)</div>
                    <div className="text-sm font-black text-rose-100">{dormLayoutData.totalFemale} คน</div>
                  </div>
                </div>
              </div>

              {/* Card 2: จภ.ชร. Breakdown */}
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2 shadow-xs">
                <div className="text-xs font-extrabold text-purple-950 flex items-center justify-between border-b border-purple-200 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span>นักเรียน จภ.ชร. (เชียงราย)</span>
                  </span>
                  <span className="bg-purple-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    รวม {dormLayoutData.pccCR_Total} คน
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/90 border border-purple-200 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-purple-700 font-bold">ชาย (ช)</div>
                    <div className="text-sm font-black text-purple-900">{dormLayoutData.pccCR_Male} คน</div>
                  </div>
                  <div className="bg-white/90 border border-purple-200 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-purple-700 font-bold">หญิง (ญ)</div>
                    <div className="text-sm font-black text-purple-900">{dormLayoutData.pccCR_Female} คน</div>
                  </div>
                </div>
              </div>

              {/* Card 3: จภ.ลป. Breakdown */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-2 shadow-xs">
                <div className="text-xs font-extrabold text-emerald-950 flex items-center justify-between border-b border-emerald-200 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>นักเรียน จภ.ลป. (ลำปาง)</span>
                  </span>
                  <span className="bg-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    รวม {dormLayoutData.pccLP_Total} คน
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/90 border border-emerald-200 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-emerald-700 font-bold">ชาย (ช)</div>
                    <div className="text-sm font-black text-emerald-900">{dormLayoutData.pccLP_Male} คน</div>
                  </div>
                  <div className="bg-white/90 border border-emerald-200 rounded-xl p-2 text-center">
                    <div className="text-[10px] text-emerald-700 font-bold">หญิง (ญ)</div>
                    <div className="text-sm font-black text-emerald-900">{dormLayoutData.pccLP_Female} คน</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsDormLayoutModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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
