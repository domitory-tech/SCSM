import React from "react";
import { Bar, Doughnut, Line, Radar } from "react-chartjs-2";
import "../charts/ChartSetup";
import { DailyAttendance, DailyReportData, Dormitory, Notice, Student, UserProfile, SystemSettings } from "../../types";
import { useUsersQuery } from "../../services/useDormQueries";
import { fetchAllCheckedAttendanceDates, fetchAttendance, fetchNotices, fetchAllAttendanceRecords } from "../../services/api";
import { getDashboardDefaultDate, getLatestCheckedAttendanceDate, getTodayDateString, detectStudentGender, isDormAttendancePaused, isGradeMatch, normalizeGradeLevel } from "../../utils/dateUtils";
import { matchStudentToDorm, getStudentsInDorm, countStudentsInDorm, isDormMatch, getDormTeachers, isTeacherCheckedBy, getPositionBadgeStyle, getPositionDotColor, getDormType, getDormTypeLabel, getDormTypeBadgeStyle } from "../../utils/dormUtils";
import { formatStudentId } from "../../utils/studentUtils";
import { ThaiCalendarPicker } from "./ThaiCalendarPicker";
import {
  exportDailyReportToExcel,
  GOOGLE_DRIVE_FOLDER_URL
} from "../../utils/excelReportExport";
import { exportHtmlDocument } from "../../utils/htmlReportExporter";
import { ReasonAnalyticsCard } from "./ReasonAnalyticsCard";
import { DormLayoutOverviewModal } from "../dorms/DormLayoutOverviewModal";
import { DormNoticeModal } from "./DormNoticeModal";
import { DormStatsModal } from "./DormStatsModal";
import { AttendanceControlModal } from "./AttendanceControlModal";
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
  Layers,
  PauseCircle,
  PlayCircle,
  Shield,
  ShieldCheck,
  Unlock,
  Lock,
  RefreshCw
} from "lucide-react";

interface DashboardViewProps {
  reportData?: DailyReportData;
  isLoading: boolean;
  dorms?: Dormitory[];
  students?: Student[];
  users?: UserProfile[];
  todayAttendance?: Record<string, DailyAttendance>;
  latestNotice?: Notice;
  onNavigateToCheck: (dormId?: string, date?: string) => void;
  onNavigateToReports: () => void;
  onNavigateToDormLayout?: () => void;
  onNavigateToStudents?: () => void;
  currentUser?: UserProfile | null;
  systemSettings?: SystemSettings;
  onUpdateSystemSettings?: (settings: SystemSettings) => Promise<void> | void;
  onBulkHomeBreak?: (mode: "SET_HOME_BREAK" | "REVERT_NORMAL") => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportData,
  isLoading,
  dorms = [],
  students = [],
  users = [],
  todayAttendance = {},
  latestNotice,
  onNavigateToCheck,
  onNavigateToReports,
  onNavigateToDormLayout,
  onNavigateToStudents,
  currentUser,
  systemSettings,
  onUpdateSystemSettings,
  onBulkHomeBreak
}) => {
  const { data: queriedUsers = [] } = useUsersQuery();
  const effectiveUsers = users && users.length > 0 ? users : queriedUsers;

  const [selectedDormIdsForChart, setSelectedDormIdsForChart] = React.useState<string[]>([]);
  const [chartViewMode, setChartViewMode] = React.useState<"bar" | "radar">("bar");
  const [isDormLayoutModalOpen, setIsDormLayoutModalOpen] = React.useState<boolean>(false);
  const [isNoticesModalOpen, setIsNoticesModalOpen] = React.useState<boolean>(false);
  const [isDormStatsModalOpen, setIsDormStatsModalOpen] = React.useState<boolean>(false);
  const [isControlModalOpen, setIsControlModalOpen] = React.useState<boolean>(false);
  const [controlModalInitialTab, setControlModalInitialTab] = React.useState<"PAUSE_RESUME" | "HOME_BREAK">("PAUSE_RESUME");

  // Dorm filter state for the Grade Statistics table (allowing user to view grade breakdown per dorm or all)
  const [gradeStatsDormFilter, setGradeStatsDormFilter] = React.useState<string>("ALL");

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

  // Categorize checked dates, semester break dates, and home break dates for ThaiCalendarPicker
  const { checkedDatesList, semesterBreakDatesList, homeBreakDatesList } = React.useMemo(() => {
    const checked = new Set<string>(checkedAttendanceDates);
    const semBreak = new Set<string>();
    const homeBreak = new Set<string>();

    const allRecs: DailyAttendance[] = [...allHistoricalRecords];
    if (todayAttendance) {
      Object.values(todayAttendance).forEach((a) => {
        if (a) allRecs.push(a);
      });
    }

    const dateMap = new Map<string, DailyAttendance[]>();
    allRecs.forEach((r) => {
      if (!r || !r.date) return;
      const list = dateMap.get(r.date) || [];
      list.push(r);
      dateMap.set(r.date, list);
    });

    dateMap.forEach((recs, dateStr) => {
      const hasAnyCheck = recs.some(
        (r) =>
          r.status === "CHECKED" ||
          r.status === "HOME_BREAK" ||
          r.status === "SEMESTER_BREAK" ||
          (r.records && r.records.length > 0)
      );
      if (hasAnyCheck) checked.add(dateStr);

      const isSemBreak = recs.some((r) => {
        if (r.status === "SEMESTER_BREAK") return true;
        if (r.records && r.records.some((rec) => rec.status === "SEMESTER_BREAK")) return true;
        return false;
      });
      if (isSemBreak) {
        semBreak.add(dateStr);
      }

      const isHmBreak = recs.some((r) => r.isHomeBreak || r.status === "HOME_BREAK");
      if (isHmBreak && !isSemBreak) {
        homeBreak.add(dateStr);
      }
    });

    return {
      checkedDatesList: Array.from(checked),
      semesterBreakDatesList: Array.from(semBreak),
      homeBreakDatesList: Array.from(homeBreak)
    };
  }, [checkedAttendanceDates, allHistoricalRecords, todayAttendance]);

  // Latest checked attendance date (หน้าภาพรวมหอพัก ให้แสดงข้อมูลของการเช็คยอดล่าสุด)
  const latestCheckedDate = React.useMemo(() => {
    return getLatestCheckedAttendanceDate(checkedDatesList, todayAttendance);
  }, [checkedDatesList, todayAttendance]);

  const effectiveDashboardDate = selectedDashboardDate || latestCheckedDate;

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

  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const handleRefreshAttendance = React.useCallback(async () => {
    if (!effectiveDashboardDate) return;
    setIsRefreshing(true);
    try {
      const [attRes, noticeRes] = await Promise.all([
        fetchAttendance(effectiveDashboardDate),
        fetchNotices(effectiveDashboardDate)
      ]);
      if (attRes && typeof attRes === "object" && !("records" in attRes)) {
        setHistoricalAttendanceMap(attRes as Record<string, DailyAttendance>);
      } else if (attRes && "records" in attRes) {
        const rec = attRes as DailyAttendance;
        setHistoricalAttendanceMap({ [rec.dormId]: rec });
      }
      if (Array.isArray(noticeRes)) {
        setDateNotices(noticeRes);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [effectiveDashboardDate]);

  // Active attendance map: When viewing today, prioritize todayAttendance prop (realtime Firestore/cache sync) merged with historical map
  const activeAttendanceMap = React.useMemo(() => {
    const isToday = effectiveDashboardDate === getTodayDateString();
    if (isToday) {
      // Prioritize live todayAttendance prop, fallback to historicalAttendanceMap if present
      const merged: Record<string, DailyAttendance> = {
        ...(historicalAttendanceMap || {}),
        ...(todayAttendance || {})
      };
      return merged;
    }
    if (historicalAttendanceMap !== null) {
      return historicalAttendanceMap;
    }
    return {};
  }, [historicalAttendanceMap, todayAttendance, effectiveDashboardDate]);

  // Check if effective dashboard date is in semester break
  const isSemesterBreakForEffectiveDate = React.useMemo(() => {
    if (semesterBreakDatesList.includes(effectiveDashboardDate)) return true;
    if (activeAttendanceMap) {
      return Object.values(activeAttendanceMap).some((att) => {
        if (!att) return false;
        if (att.status === "SEMESTER_BREAK") return true;
        if (att.records && att.records.some((r) => r.status === "SEMESTER_BREAK")) return true;
        return false;
      });
    }
    return false;
  }, [effectiveDashboardDate, semesterBreakDatesList, activeAttendanceMap]);

  // Check if effective dashboard date is in home break
  const isHomeBreakForEffectiveDate = React.useMemo(() => {
    if (isSemesterBreakForEffectiveDate) return false;
    if (homeBreakDatesList.includes(effectiveDashboardDate)) return true;
    if (activeAttendanceMap) {
      return Object.values(activeAttendanceMap).some((att) => {
        if (!att) return false;
        if (att.isHomeBreak || att.status === "HOME_BREAK") return true;
        if (att.records && att.records.length > 0 && att.records.every((r) => r.status === "ROUND_HOME")) return true;
        return false;
      });
    }
    return false;
  }, [effectiveDashboardDate, homeBreakDatesList, activeAttendanceMap, isSemesterBreakForEffectiveDate]);

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
    const result: Record<
      string,
      {
        total: number;
        out: number;
        remaining: number;
        status: "CHECKED" | "HOME_BREAK" | "SEMESTER_BREAK" | "PENDING";
        statusLabel: string;
        statusBadge: string;
      }
    > = {};

    dorms.forEach((d) => {
      const dormStudents = getStudentsInDorm(students, d);
      const totalCount = dormStudents.length;
      const att = activeAttendanceMap[d.id] || Object.values(activeAttendanceMap).find((a) => a && isDormMatch(d, a.dormId));

      let outCount = 0;
      let status: "CHECKED" | "HOME_BREAK" | "SEMESTER_BREAK" | "PENDING" = "PENDING";
      let statusLabel = "รอเช็คยอด";
      let statusBadge = "bg-slate-100 text-slate-600 border border-slate-200";

      if (att && (att.isHomeBreak || att.status === "HOME_BREAK")) {
        outCount = totalCount;
        status = "HOME_BREAK";
        statusLabel = "รอบกลับบ้าน";
        statusBadge = "bg-amber-100 text-amber-800 border border-amber-300";
      } else if (att && att.status === "SEMESTER_BREAK") {
        outCount = totalCount;
        status = "SEMESTER_BREAK";
        statusLabel = "ปิดภาคเรียน";
        statusBadge = "bg-neutral-800 text-amber-300 border border-neutral-700";
      } else if (att && (att.status === "CHECKED" || (Array.isArray(att.records) && att.records.length > 0))) {
        status = "CHECKED";
        statusLabel = "เช็คแล้ว";
        statusBadge = "bg-emerald-100 text-emerald-800 border border-emerald-300";

        if (Array.isArray(att.records)) {
          const absentSidSet = new Set<string>();
          att.records.forEach((r) => {
            if (r.status && r.status !== "PRESENT") {
              const sid = (r.studentId || "").trim();
              if (sid) {
                absentSidSet.add(sid);
                absentSidSet.add(formatStudentId(sid));
                absentSidSet.add(sid.replace(/^0+/, ""));
              }
            }
          });

          let matchedAbsent = dormStudents.filter((s) => {
            const sid = (s.studentId || "").trim();
            const fSid = formatStudentId(sid);
            const rawSid = sid.replace(/^0+/, "");
            return (
              absentSidSet.has(sid) ||
              absentSidSet.has(fSid) ||
              absentSidSet.has(rawSid) ||
              absentSidSet.has(s.id)
            );
          }).length;

          const totalAbsentRecords = att.records.filter((r) => r.status && r.status !== "PRESENT").length;
          // Ensure outCount accurately reflects actual absent records from the real-time check
          outCount = Math.max(matchedAbsent, Math.min(totalCount, totalAbsentRecords));
        }
      }

      result[d.id] = {
        total: totalCount,
        out: outCount,
        remaining: Math.max(0, totalCount - outCount),
        status,
        statusLabel,
        statusBadge
      };
    });

    return result;
  }, [dorms, students, activeAttendanceMap]);

  // Calculation of grand totals across all dorms - perfectly reconciled with individual dorms and grades
  const realtimeGrandTotals = React.useMemo(() => {
    let out = 0;
    let remaining = 0;
    let total = 0;

    Object.values(realtimeDormTotals).forEach((st: any) => {
      out += Number(st?.out || 0);
      remaining += Number(st?.remaining || 0);
      total += Number(st?.total || 0);
    });

    if (total === 0 && students.length > 0) {
      total = students.length;
      remaining = Math.max(0, total - out);
    }

    return { total, out, remaining };
  }, [students.length, realtimeDormTotals]);

  // 1. Grade Statistics (สรุปสถิติข้อมูลแยกตามระดับชั้น ม.1 - ม.6) สำหรับวันปัจจุบัน/วันที่เลือก
  const dashboardGradeStats = React.useMemo(() => {
    const baseGrades = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];

    // Filter students by selected dorm if specified
    const targetDorm = gradeStatsDormFilter === "ALL" ? null : dorms.find((d) => d.id === gradeStatsDormFilter);
    const relevantStudents = targetDorm
      ? getStudentsInDorm(students, targetDorm)
      : students;

    // Detect if relevantStudents contain extra grade categories
    const extraGrades = new Set<string>();
    relevantStudents.forEach((s) => {
      const norm = normalizeGradeLevel(s.grade);
      if (norm && !baseGrades.includes(norm)) {
        extraGrades.add(norm);
      } else if (!norm && s.grade && String(s.grade).trim()) {
        const raw = String(s.grade).trim();
        if (!baseGrades.some((bg) => isGradeMatch(raw, bg))) {
          extraGrades.add(raw);
        }
      }
    });

    const gradeList = [...baseGrades, ...Array.from(extraGrades)];

    // Track absent students by student unique id for the active dashboard date
    // Guaranteed 100% mathematical consistency with realtimeDormTotals and the actual check!
    const absentStudentIds = new Set<string>();

    dorms.forEach((d) => {
      if (targetDorm && d.id !== targetDorm.id && !isDormMatch(targetDorm, d.id)) return;
      const dormStudents = getStudentsInDorm(students, d);
      const att = activeAttendanceMap[d.id] || Object.values(activeAttendanceMap).find((a) => a && isDormMatch(d, a.dormId));
      if (!att) return;

      if (att.isHomeBreak || att.status === "HOME_BREAK" || (att.status === "SEMESTER_BREAK" && (!att.records || att.records.length === 0))) {
        dormStudents.forEach((s) => {
          absentStudentIds.add(s.id);
          absentStudentIds.add(s.studentId);
          absentStudentIds.add(formatStudentId(s.studentId));
        });
      } else if (att.records && Array.isArray(att.records)) {
        const absentRecords = att.records.filter((r) => r.status && r.status !== "PRESENT");
        const matchedStudentIdsInDorm = new Set<string>();

        absentRecords.forEach((rec) => {
          const recSid = (rec.studentId || "").trim();
          const recFormatted = formatStudentId(recSid);
          const recRaw = recSid.replace(/^0+/, "");
          const recName = (rec.studentName || "").trim().toLowerCase();

          // Find matching student in this dorm
          const s = dormStudents.find((st) => {
            if (matchedStudentIdsInDorm.has(st.id)) return false;
            const stSid = (st.studentId || "").trim();
            if (stSid === recSid || st.id === recSid) return true;
            if (recFormatted && formatStudentId(stSid) === recFormatted) return true;
            if (recRaw && stSid.replace(/^0+/, "") === recRaw) return true;
            if (recName) {
              const fullName = `${st.title}${st.firstName} ${st.lastName}`.trim().toLowerCase();
              const firstLast = `${st.firstName} ${st.lastName}`.trim().toLowerCase();
              if (fullName === recName || firstLast === recName) return true;
            }
            return false;
          });

          if (s) {
            matchedStudentIdsInDorm.add(s.id);
            absentStudentIds.add(s.id);
            absentStudentIds.add(s.studentId);
            absentStudentIds.add(formatStudentId(s.studentId));
          }
        });

        // If there are unmatched absent records in the attendance check, allocate them to remaining dorm students
        // so that grade totals will exactly reconcile with dorm totals!
        if (absentRecords.length > matchedStudentIdsInDorm.size) {
          const remainingStudents = dormStudents.filter((st) => !matchedStudentIdsInDorm.has(st.id));
          const deficit = absentRecords.length - matchedStudentIdsInDorm.size;
          for (let i = 0; i < Math.min(deficit, remainingStudents.length); i++) {
            const s = remainingStudents[i];
            matchedStudentIdsInDorm.add(s.id);
            absentStudentIds.add(s.id);
            absentStudentIds.add(s.studentId);
            absentStudentIds.add(formatStudentId(s.studentId));
          }
        }
      }
    });

    const stats = gradeList.map((g) => {
      const gStudents = relevantStudents.filter((s) => isGradeMatch(s.grade, g));
      const total = gStudents.length;
      const male = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length;
      const female = gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length;
      
      const outCount = gStudents.filter((s) => absentStudentIds.has(s.id) || absentStudentIds.has(s.studentId) || absentStudentIds.has(formatStudentId(s.studentId))).length;
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
  }, [students, dorms, activeAttendanceMap, gradeStatsDormFilter]);

  // 2. Dormitory Statistics (สรุปสถิติข้อมูลแยกตามหอพัก หอพัก 1 - 6) สำหรับวันปัจจุบัน/วันที่เลือก
  const dashboardDormStats = React.useMemo(() => {
    const stats = dorms.map((d) => {
      const dormType = getDormType(d);
      const dTotal = countStudentsInDorm(students, d);
      const dPresent = realtimeDormTotals[d.id]?.remaining ?? dTotal;
      const dOut = realtimeDormTotals[d.id]?.out ?? 0;
      const dCapacity = d.capacity || 80;
      const occupancyRate = dTotal > 0 ? (dPresent / dTotal) * 100 : 0;
      const checkStatus = realtimeDormTotals[d.id]?.status || "PENDING";
      const checkStatusLabel = realtimeDormTotals[d.id]?.statusLabel || "รอเช็คยอด";
      const checkStatusBadge = realtimeDormTotals[d.id]?.statusBadge || "bg-slate-100 text-slate-600 border border-slate-200";

      return {
        dormId: d.id,
        dormName: d.name,
        type: dormType,
        dormTypeBadge: getDormTypeBadgeStyle(d),
        dormTypeLabel: getDormTypeLabel(d, false),
        capacity: dCapacity,
        studentCount: dTotal,
        presentCount: dPresent,
        outCount: dOut,
        occupancyRate: Math.min(100, occupancyRate),
        checkStatus,
        checkStatusLabel,
        checkStatusBadge
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
      "เดินเรียน": 0,
      "ปิดภาคเรียน": 0,
      "ยังไม่เข้าหอพัก": 0,
      "อื่นๆ": 0
    };

    let hasLiveRecords = false;

    dorms.forEach((d) => {
      const att = activeAttendanceMap[d.id];
      if (att && (att.status === "CHECKED" || att.status === "SEMESTER_BREAK") && att.records) {
        hasLiveRecords = true;
        att.records.forEach((r) => {
          if (r.status === "HOME") counts["กลับบ้าน"]++;
          else if (r.status === "CAMP") counts["เข้าค่าย"]++;
          else if (r.status === "SICK") counts["ป่วย"]++;
          else if (r.status === "SKILL_COMP") counts["แข่งทักษะ"]++;
          else if (r.status === "EXCHANGE") counts["แลกเปลี่ยน"]++;
          else if (r.status === "WALK_STUDY") counts["เดินเรียน"]++;
          else if (r.status === "SEMESTER_BREAK") counts["ปิดภาคเรียน"]++;
          else if (r.status === "NOT_ARRIVED") counts["ยังไม่เข้าหอพัก"]++;
          else if (r.status === "OTHER") counts["อื่นๆ"]++;
        });
      } else if (att && att.status === "SEMESTER_BREAK") {
        hasLiveRecords = true;
        const dCount = countStudentsInDorm(students, d);
        counts["ปิดภาคเรียน"] += dCount;
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
        else if (s.reason.includes("เดินเรียน")) counts["เดินเรียน"]++;
        else if (s.reason.includes("ปิดภาคเรียน")) counts["ปิดภาคเรียน"]++;
        else if (s.reason.includes("ยังไม่เข้า")) counts["ยังไม่เข้าหอพัก"]++;
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
    (d) =>
      activeAttendanceMap[d.id]?.status === "CHECKED" ||
      activeAttendanceMap[d.id]?.status === "HOME_BREAK" ||
      activeAttendanceMap[d.id]?.status === "SEMESTER_BREAK" ||
      (activeAttendanceMap[d.id]?.records && activeAttendanceMap[d.id]?.records.length > 0)
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
      const prevWeekDates: string[] = [];
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

        // Previous week date (7 days earlier)
        const prevD = new Date(d);
        prevD.setDate(d.getDate() - 7);
        const py = prevD.getFullYear();
        const pm = String(prevD.getMonth() + 1).padStart(2, "0");
        const pday = String(prevD.getDate()).padStart(2, "0");
        prevWeekDates.push(`${py}-${pm}-${pday}`);
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

      // Previous week actual departure data
      const prevWeekActualData = prevWeekDates.map((dStr) => {
        if (dStr in historicalStats.dateTotalOutMap) {
          return historicalStats.dateTotalOutMap[dStr];
        }
        return 0;
      });

      const predictedData = [0, 1, 2, 3, 4, 5, 6].map((i) => historicalStats.avgDow[i] || 0);

      const actualSum = actualData.reduce((a, b) => a + b, 0);
      const prevWeekSum = prevWeekActualData.reduce((a, b) => a + b, 0);
      const predictedSum = predictedData.reduce((a, b) => a + b, 0);

      const maxVal = Math.max(...actualData, ...prevWeekActualData, ...predictedData);
      let peakIdx = actualData.indexOf(maxVal);
      if (peakIdx === -1) peakIdx = predictedData.indexOf(maxVal);
      const peakDayText = peakIdx >= 0 && maxVal > 0 ? `วัน${dayNamesShort[peakIdx]} (${maxVal} คน)` : "ไม่มีข้อมูล";

      return {
        chartType: "line",
        labels,
        datasets: [
          {
            label: "สถิตินักเรียนออกหอพัก (ยอดจริงสัปดาห์นี้)",
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
            label: "นักเรียนออกสัปดาห์ที่แล้ว (ยอดจริง)",
            data: prevWeekActualData,
            borderColor: "#0284C7",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            borderDash: [4, 4],
            tension: 0.35,
            fill: false,
            pointBackgroundColor: "#0284C7",
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
            fill: false,
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
        card4Title: "ออกจริงสัปดาห์ที่แล้ว",
        card4Val: `${prevWeekSum} คน`
      };
    }

    if (trendTab === "monthly") {
      const weekLabels = ["สัปดาห์ที่ 1", "สัปดาห์ที่ 2", "สัปดาห์ที่ 3", "สัปดาห์ที่ 4 (สัปดาห์นี้)"];
      const actualData = [0, 0, 0, 0];
      const prevMonthActualData = [0, 0, 0, 0];
      const predictedData = [0, 0, 0, 0];

      const weeklyAvgSum = historicalStats.avgDow.reduce((a, b) => a + b, 0);

      for (let w = 0; w < 4; w++) {
        // Current month 4 weeks (w: 0 = สัปดาห์ที่ 1, 1 = สัปดาห์ที่ 2, 2 = สัปดาห์ที่ 3, 3 = สัปดาห์ที่ 4)
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

        // Previous month 4 weeks (28 days earlier)
        let wPrevActual = 0;
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const daysAgo = (3 - w) * 7 + (6 - dayOffset) + 28;
          const d = new Date(now);
          d.setDate(now.getDate() - daysAgo);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${day}`;
          if (dateStr in historicalStats.dateTotalOutMap) {
            wPrevActual += historicalStats.dateTotalOutMap[dateStr];
          }
        }
        prevMonthActualData[w] = wPrevActual;
      }

      const actualSum = actualData.reduce((a, b) => a + b, 0);
      const prevMonthSum = prevMonthActualData.reduce((a, b) => a + b, 0);
      const predictedSum = predictedData.reduce((a, b) => a + b, 0);

      const maxVal = Math.max(...actualData, ...prevMonthActualData, ...predictedData);
      let peakIdx = actualData.indexOf(maxVal);
      if (peakIdx === -1) peakIdx = prevMonthActualData.indexOf(maxVal);
      if (peakIdx === -1) peakIdx = predictedData.indexOf(maxVal);
      const peakWeekText = peakIdx >= 0 && maxVal > 0 ? `${weekLabels[peakIdx]} (${maxVal} คน)` : "ไม่มีข้อมูล";

      return {
        chartType: "line",
        labels: weekLabels,
        datasets: [
          {
            label: "สถิตินักเรียนออกหอพัก (ยอดจริงเดือนนี้)",
            data: actualData,
            borderColor: "#FE9496",
            backgroundColor: "rgba(254, 148, 150, 0.15)",
            tension: 0.35,
            fill: false,
            pointBackgroundColor: "#FE9496",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5
          },
          {
            label: "นักเรียนออกเดือนที่ผ่านมา (ยอดจริง)",
            data: prevMonthActualData,
            borderColor: "#0284C7",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            borderDash: [4, 4],
            tension: 0.35,
            fill: false,
            pointBackgroundColor: "#0284C7",
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
            fill: false,
            pointBackgroundColor: "#A05AFF",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5
          }
        ],
        card1Title: "รวมสถิติตามจริง (4 สัปดาห์นี้)",
        card1Val: `${actualSum} คน`,
        card2Title: "รวมคาดการณ์ (4 สัปดาห์)",
        card2Val: `${predictedSum} คน`,
        card3Title: "สัปดาห์พีคสูงสุด",
        card3Val: peakWeekText,
        card4Title: "ออกจริงเดือนที่ผ่านมา",
        card4Val: `${prevMonthSum} คน`
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
      {/* Attendance Check Paused Notice Banner (Global or Per-Dorm) */}
      {(systemSettings?.isAttendancePaused || (Array.isArray(systemSettings?.pausedDormIds) && systemSettings.pausedDormIds.length > 0)) && (
        <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-rose-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PauseCircle className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-white text-rose-700 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {systemSettings.isAttendancePaused ? "⛔ ระบบหยุดการเช็คยอดชั่วคราวทุกหอพัก" : `⚠️ ระบบหยุดการเช็คยอดชั่วคราว ${systemSettings.pausedDormIds?.length} หอพัก`}
                </span>
                {systemSettings.attendancePausedAt && (
                  <span className="text-[11px] text-white/90">
                    (หยุดเมื่อ: {systemSettings.attendancePausedAt}{systemSettings.attendancePausedBy ? ` โดย ${systemSettings.attendancePausedBy}` : ""})
                  </span>
                )}
              </div>
              <p className="text-sm font-bold mt-1 text-white">
                {systemSettings.attendancePauseReason || "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"}
              </p>
              <p className="text-xs text-rose-100 mt-0.5">
                {systemSettings.isAttendancePaused
                  ? "กำลังอยู่ในช่วงปรับปรุงข้อมูลนักเรียนและการย้ายหอพัก ครูประจำหอพักไม่ต้องทำการเช็คยอดจนกว่าจะเปิดระบบอีกครั้ง"
                  : `หอพักที่หยุดเช็คยอดชั่วคราว: ${dorms.filter((d) => systemSettings.pausedDormIds?.includes(d.id)).map((d) => d.name).join(", ")} (หอพักอื่นยังเช็คยอดได้ตามปกติ)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {currentUser && (currentUser.roleLevel === 1 || currentUser.roleLevel === 2) && (
              <button
                type="button"
                onClick={() => {
                  setControlModalInitialTab("PAUSE_RESUME");
                  setIsControlModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900/80 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>ควบคุมระบบเช็คยอด</span>
              </button>
            )}
            {onNavigateToStudents && (currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2) && (
              <button
                type="button"
                onClick={onNavigateToStudents}
                className="px-3.5 py-2 bg-white text-rose-700 hover:bg-rose-50 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>จัดการรายชื่อนักเรียน</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Section Grid: Left = Thai Calendar Picker, Right = 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side (lg:col-span-5 xl:col-span-4): Thai Calendar Picker */}
        <div className="lg:col-span-5 xl:col-span-4">
          <ThaiCalendarPicker
            selectedDate={selectedDashboardDate}
            effectiveDate={effectiveDashboardDate}
            onSelectDate={setSelectedDashboardDate}
            checkedDates={checkedDatesList}
            semesterBreakDates={semesterBreakDatesList}
            homeBreakDates={homeBreakDatesList}
            todayDate={getTodayDateString()}
            disableUnchecked={true}
          />
        </div>

        {/* Right Side (lg:col-span-7 xl:col-span-8): 4 Summary Stat Cards */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between space-y-4">
          {/* Semester Break Notice Banner */}
          {isSemesterBreakForEffectiveDate && (
            <div className="bg-neutral-900 border border-neutral-800 text-white px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 text-amber-400 border border-neutral-700 flex items-center justify-center shrink-0 shadow-inner">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-neutral-100">สถานะการเช็คยอด: ปิดภาคเรียน</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                      ปิดภาคเรียน
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                    ระบบบันทึกสถานะปิดภาคเรียนสำหรับนักเรียนในหอพัก และส่งต่อสถานะอัตโนมัติจนกว่าจะมีการเปลี่ยนสถานะการเช็คยอดเมื่อเปิดภาคเรียน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToCheck(undefined, effectiveDashboardDate)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-extrabold text-xs rounded-xl shadow-xs shrink-0 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>ปรับเปลี่ยนสถานะ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Home Break Notice Banner */}
          {isHomeBreakForEffectiveDate && !isSemesterBreakForEffectiveDate && (
            <div className="bg-amber-950 border border-amber-800 text-white px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-900 text-amber-300 border border-amber-700 flex items-center justify-center shrink-0 shadow-inner">
                  <Home className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-amber-100">สถานะการเช็คยอด: รอบกลับบ้าน</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                      รอบกลับบ้าน
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                    ระบบบันทึกสถานะรอบกลับบ้านสำหรับนักเรียนในหอพัก และส่งต่อสถานะอัตโนมัติจนกว่าจะมีการเปลี่ยนสถานะการเช็คยอดเมื่อนักเรียนกลับเข้าหอพัก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToCheck(undefined, effectiveDashboardDate)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-extrabold text-xs rounded-xl shadow-xs shrink-0 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>ปรับเปลี่ยนสถานะ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {selectedDashboardDate ? (
            <div className="bg-purple-100/90 border border-purple-300 text-purple-950 px-4 py-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A05AFF] animate-ping shrink-0" />
                <span>
                  กำลังแสดงข้อมูลสถิติประวัติย้อนหลัง วันที่ {selectedDashboardDate.split("-").reverse().join("/")}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRefreshAttendance}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-900 font-extrabold text-[11px] rounded-lg border border-purple-200 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  title="รีเฟรชข้อมูลเช็คยอด"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span>รีเฟรช</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDashboardDate("")}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                  title="สลับกลับเป็นผลการเช็คยอดล่าสุด"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>สลับกลับเป็นยอดล่าสุด</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-purple-100/90 border border-purple-300 text-purple-950 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    กำลังแสดงข้อมูลการเช็คยอดล่าสุด ประจำวันที่ {effectiveDashboardDate.split("-").reverse().join("/")}
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                    ยอดล่าสุด
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-purple-800 font-semibold pl-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span>
                    สรุปยอดนักเรียนออกหอพักวันที่ {getFormattedNextDay(effectiveDashboardDate)} จะแสดงหลังเช็คยอดคืนนี้
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={handleRefreshAttendance}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-900 font-extrabold text-[11px] rounded-lg border border-purple-200 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  title="รีเฟรชข้อมูลเช็คยอด"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span>รีเฟรชยอดจริง</span>
                </button>
                <span className="text-purple-700 font-semibold text-[11px]">
                  {effectiveDashboardDate === getTodayDateString()
                    ? "ข้อมูลการเช็คยอดล่าสุดของวันนี้"
                    : "ข้อมูลการเช็คยอดล่าสุด"}
                </span>
              </div>
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
                {liveReasonCounts["ปิดภาคเรียน"] > 0 ? (
                  <span>ปิดภาคเรียน {liveReasonCounts["ปิดภาคเรียน"]} • กลับบ้าน {liveReasonCounts["กลับบ้าน"]} คน</span>
                ) : (
                  <span>กลับบ้าน {liveReasonCounts["กลับบ้าน"]} • ป่วย {liveReasonCounts["ป่วย"]} คน</span>
                )}
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
                  {isSemesterBreakForEffectiveDate
                    ? `สถานะ: ปิดภาคเรียน (${checkedDormsCount} / ${totalDorms} หอพัก)`
                    : checkedDormsCount === totalDorms
                    ? "ส่งข้อมูลเช็คยอดเรียบร้อยครบทุกหอ"
                    : `เช็คยอดแล้ว ${checkedDormsCount} หอ (เหลืออีก ${totalDorms - checkedDormsCount} หอ)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Popup Action Buttons Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Button 1: บันทึกการอบรม / แจ้งการหอประจำวัน */}
        <button
          type="button"
          onClick={() => setIsNoticesModalOpen(true)}
          className="group relative bg-white hover:bg-slate-50/90 p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all text-left flex items-center justify-between gap-3 cursor-pointer overflow-hidden"
          title="เปิดดูบันทึกการอบรม / แจ้งการหอประจำวัน (Popup)"
        >
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] opacity-80" />
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 group-hover:bg-purple-100 text-[#A05AFF] border border-purple-100 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <Megaphone className="w-6 h-6 text-[#A05AFF]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm truncate">
                  บันทึกการอบรม / แจ้งการหอ
                </span>
                {(activeNotice || groupedDormOrientationNotes.length > 0) ? (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {(activeNotice ? 1 : 0) + groupedDormOrientationNotes.reduce((sum, g) => sum + g.notes.length, 0)} เรื่อง
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    ไม่มีเรื่องแจ้ง
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                เรื่องแจ้งหัวหน้าหอพัก & บันทึกครู
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-purple-50 group-hover:bg-[#A05AFF] text-[#A05AFF] group-hover:text-white rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 shadow-2xs">
            <Eye className="w-3.5 h-3.5" />
            <span>ดู Popup</span>
          </span>
        </button>

        {/* Button 2: สถิตินักเรียนแยกตามหอพัก (หอพัก 1 - 6) */}
        <button
          type="button"
          onClick={() => setIsDormStatsModalOpen(true)}
          className="group relative bg-white hover:bg-slate-50/90 p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all text-left flex items-center justify-between gap-3 cursor-pointer overflow-hidden"
          title="เปิดดูสถิตินักเรียนแยกตามหอพัก 1 - 6 (Popup)"
        >
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#1BCFB4] to-[#4BCBEB] opacity-80" />
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 group-hover:bg-teal-100 text-[#1BCFB4] border border-teal-100 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <Activity className="w-6 h-6 text-[#1BCFB4]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm truncate">
                  สถิตินักเรียนแยกตามหอพัก
                </span>
                <span className="bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                  หอ 1 - 6
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                สถิติความจุ และกราฟเปรียบเทียบ
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-teal-50 group-hover:bg-[#1BCFB4] text-teal-700 group-hover:text-white rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 shadow-2xs">
            <Eye className="w-3.5 h-3.5" />
            <span>ดู Popup</span>
          </span>
        </button>

        {/* Button 3: ผังการจัดหอพัก (แยกเดี่ยวออกมาอย่างชัดเจน) */}
        <button
          type="button"
          onClick={() => setIsDormLayoutModalOpen(true)}
          className="group relative bg-white hover:bg-slate-50/90 p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all text-left flex items-center justify-between gap-3 cursor-pointer overflow-hidden"
          title="เปิดดูผังการจัดหอพักรวม (Popup)"
        >
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#4BCBEB] to-[#FE9496] opacity-80" />
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
              <Table className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm truncate">
                  ผังการจัดหอพัก
                </span>
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                  ผังห้องพัก
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                ผังนักเรียนแยกตามระดับชั้นและห้อง
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 shadow-2xs">
            <Eye className="w-3.5 h-3.5" />
            <span>ดู Popup</span>
          </span>
        </button>
      </div>

      {/* 2 Deep-Dive Summary Tables: สรุปสถิติข้อมูลแยกตามระดับชั้น & สรุปสถิติข้อมูลแยกตามหอพัก (Placed above บันทึกการอบรม) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table 1: สรุปสถิติข้อมูลแยกตามระดับชั้น */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>
                      สรุปสถิติข้อมูลแยกตามระดับชั้น
                      {gradeStatsDormFilter !== "ALL" && (
                        <span className="text-purple-700 ml-1">
                          ({dorms.find((d) => d.id === gradeStatsDormFilter)?.name || gradeStatsDormFilter})
                        </span>
                      )}
                    </span>
                  </h3>
                  <span className="bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>ยอดจริง</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {gradeStatsDormFilter === "ALL"
                    ? `จำแนก ม.1 - ม.6 (รวมทุกหอพัก) • ข้อมูล ณ ${effectiveDashboardDate.split("-").reverse().join("/")}`
                    : `จำแนก ม.1 - ม.6 เฉพาะ ${dorms.find((d) => d.id === gradeStatsDormFilter)?.name || ""} • ข้อมูล ณ ${effectiveDashboardDate.split("-").reverse().join("/")}`}
                </p>
              </div>

              {/* Dormitory filter selector */}
              <div className="flex items-center gap-1.5">
                <select
                  value={gradeStatsDormFilter}
                  onChange={(e) => setGradeStatsDormFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer shadow-2xs"
                  aria-label="เลือกหอพักสำหรับสถิติแยกตามระดับชั้น"
                >
                  <option value="ALL">ทุกหอพัก (รวมทั้งโรงเรียน)</option>
                  {dorms.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
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
                    <tr key={g.grade} className="hover:bg-slate-50 transition-colors">
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>สรุปสถิติข้อมูลแยกตามหอพัก (Dormitory Breakdown)</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  สถิติตามการเช็คยอดจริง หอพัก 1 - 6 ประจำวันที่ {effectiveDashboardDate.split("-").reverse().join("/")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToCheck(undefined, effectiveDashboardDate)}
                className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="ไปยังหน้าเช็คยอดหอพัก"
              >
                <span>เช็คยอดหอพัก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
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
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-100">
                        <button
                          type="button"
                          onClick={() => onNavigateToCheck(d.dormId, effectiveDashboardDate)}
                          className="hover:text-purple-700 hover:underline text-left cursor-pointer"
                          title={`เปิดเช็คยอด ${d.dormName}`}
                        >
                          {d.dormName}
                        </button>
                      </td>
                      <td className="py-2.5 px-2.5 text-center border-r border-slate-100">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${d.dormTypeBadge}`}>
                          {d.dormTypeLabel}
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
          <div className="p-2.5 rounded-xl bg-sky-50/80 border border-sky-200 flex items-center justify-between">
            <span className="text-sky-900 font-bold">{trendChartConfig.card4Title}:</span>
            <span className="font-black text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded-md">
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
              <span>สรุปยอดนักเรียนตามหอพัก</span>
              {new Date().getHours() >= 20 && (
                <span className="bg-purple-100 text-purple-800 border border-purple-300 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 shadow-2xs animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-[#A05AFF]" />
                  เข้าสู่สถานะเตรียมเช็คยอดแล้ว
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">สถานะการส่งข้อมูลและสถิตินักเรียนแยกตามหอพัก 1 - 6 (รอบเวลา 20.00 น.)</p>
          </div>
          <button
            onClick={() => onNavigateToCheck(undefined, effectiveDashboardDate)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>ไปที่หน้าเช็คชื่อ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Admin & Staff Action Toolbar: Bulk Home Break & Pause/Resume Controls */}
        {currentUser && (currentUser.roleLevel === 1 || currentUser.roleLevel === 2) && (
          <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <Shield className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-xs sm:text-sm text-white">
                    ศูนย์ควบคุมการเช็คยอด (สิทธิ์ผู้ดูแล / เจ้าหน้าที่)
                  </span>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.2 rounded-full uppercase tracking-wider">
                    คลิกเดียวทุกหอพัก
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  เปลี่ยนสถานะทุกหอพักเป็นรอบกลับบ้าน หรือควบคุมการหยุด/เปิดระบบเช็คยอด (ทุกหอ & แยกหอ)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
              {/* Button 1: สถานะรอบกลับบ้าน ทุกหอพัก */}
              <button
                type="button"
                onClick={() => {
                  setControlModalInitialTab("HOME_BREAK");
                  setIsControlModalOpen(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  dorms.length > 0 && dorms.every((d) => activeAttendanceMap[d.id]?.isHomeBreak || activeAttendanceMap[d.id]?.status === "HOME_BREAK")
                    ? "bg-amber-500 text-slate-950 ring-2 ring-amber-300 font-black shadow-amber-500/20"
                    : dorms.some((d) => activeAttendanceMap[d.id]?.isHomeBreak || activeAttendanceMap[d.id]?.status === "HOME_BREAK")
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                }`}
                title="คลิกเดียวเปลี่ยนสถานะทุกหอพักเป็นรอบกลับบ้าน"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>
                  {dorms.length > 0 && dorms.every((d) => activeAttendanceMap[d.id]?.isHomeBreak || activeAttendanceMap[d.id]?.status === "HOME_BREAK")
                    ? "✓ รอบกลับบ้านครบทุกหอแล้ว"
                    : dorms.filter((d) => activeAttendanceMap[d.id]?.isHomeBreak || activeAttendanceMap[d.id]?.status === "HOME_BREAK").length > 0
                    ? `รอบกลับบ้าน (${dorms.filter((d) => activeAttendanceMap[d.id]?.isHomeBreak || activeAttendanceMap[d.id]?.status === "HOME_BREAK").length}/${dorms.length} หอ)`
                    : "รอบกลับบ้านทุกหอพัก"}
                </span>
              </button>

              {/* Button 2: หยุด / เปิด เช็คยอดชั่วคราว */}
              <button
                type="button"
                onClick={() => {
                  setControlModalInitialTab("PAUSE_RESUME");
                  setIsControlModalOpen(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                  systemSettings?.isAttendancePaused
                    ? "bg-rose-600 text-white border-rose-400 animate-pulse"
                    : Array.isArray(systemSettings?.pausedDormIds) && systemSettings.pausedDormIds.length > 0
                    ? "bg-amber-600 text-white border-amber-400"
                    : "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                }`}
                title="หยุดเช็คยอดชั่วคราว หรือเปิดระบบ (ทุกหอ & แยกหอ)"
              >
                {systemSettings?.isAttendancePaused ? (
                  <PauseCircle className="w-4 h-4 shrink-0 text-white" />
                ) : Array.isArray(systemSettings?.pausedDormIds) && systemSettings.pausedDormIds.length > 0 ? (
                  <PauseCircle className="w-4 h-4 shrink-0 text-amber-300" />
                ) : (
                  <PlayCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>
                  {systemSettings?.isAttendancePaused
                    ? "⛔ หยุดเช็คยอดทุกหอพัก"
                    : Array.isArray(systemSettings?.pausedDormIds) && systemSettings.pausedDormIds.length > 0
                    ? `⚠️ หยุดเช็ค ${systemSettings.pausedDormIds.length} หอพัก`
                    : "หยุด/เปิดระบบเช็คยอด"}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {dorms.map((dorm) => {
            const att =
              activeAttendanceMap[dorm.id] ||
              Object.values(activeAttendanceMap).find((a) => a && isDormMatch(dorm, a.dormId));
            const isChecked = att?.status === "CHECKED";
            const isHomeBreak = att?.status === "HOME_BREAK" || att?.isHomeBreak;
            const isTodayChecked = isChecked || isHomeBreak;
            const targetDate = effectiveDashboardDate;
            const checkedBy = att?.checkedBy;
            const checkedAt = att?.checkedAt;

            const isDormPaused = isDormAttendancePaused(dorm.id, systemSettings);

            const dormTeachers = getDormTeachers(dorm, effectiveUsers);
            const anyTeacherMatched = Boolean(checkedBy && dormTeachers.some((t) => isTeacherCheckedBy(t.name, checkedBy)));

            const currentHour = new Date().getHours();
            const isPrepCheckTime = !isTodayChecked && (currentHour >= 20 || effectiveDashboardDate === getTodayDateString());

            return (
              <div
                key={dorm.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                  isDormPaused
                    ? "border-rose-300 bg-rose-50/70 text-slate-900 shadow-2xs"
                    : isTodayChecked
                    ? "border-emerald-300 bg-emerald-50/70 text-slate-900 shadow-sm"
                    : isPrepCheckTime
                    ? "border-purple-300 bg-gradient-to-br from-purple-50/90 via-indigo-50/60 to-purple-100/50 text-slate-900 shadow-md ring-1 ring-purple-200/70"
                    : "border-slate-200 bg-slate-50/60 shadow-2xs"
                }`}
              >
                <div>
                  {/* Dormitory Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-base">{dorm.name}</h4>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${getDormTypeBadgeStyle(dorm)}`}>
                          {getDormTypeLabel(dorm, true)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        ความจุ {dorm.capacity || 80} คน
                      </p>
                    </div>

                    {isDormPaused ? (
                      <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs shrink-0 animate-pulse">
                        <PauseCircle className="w-3.5 h-3.5 text-rose-700" />
                        <span>หยุดเช็คยอดชั่วคราว</span>
                      </span>
                    ) : isChecked ? (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>เช็คแล้ว</span>
                      </span>
                    ) : isHomeBreak ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>รอบวันกลับบ้าน</span>
                      </span>
                    ) : isPrepCheckTime ? (
                      <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs animate-pulse shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-[#A05AFF]" />
                        <span>เตรียมพร้อมเช็คยอด</span>
                      </span>
                    ) : (
                      <span className="bg-slate-200/80 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>รอเช็คยอด 20.00น.</span>
                      </span>
                    )}
                  </div>

                  {/* Teachers Section: Display ALL teachers and highlight the checker */}
                  <div className="mt-3.5 bg-white/95 rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold pb-1.5 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>คณะครูประจำหอพัก ({dormTeachers.length} ท่าน)</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dormTeachers.length === 0 && (!isTodayChecked || !checkedBy) && (
                        <div className="p-2.5 text-center text-xs text-slate-400 italic bg-slate-50/80 rounded-xl border border-dashed border-slate-200 font-medium">
                          ยังไม่มีข้อมูลครูที่เพิ่มในหอพักนี้
                        </div>
                      )}
                      {dormTeachers.map((teacher, tIdx) => {
                        const isChecker = isTodayChecked && isTeacherCheckedBy(teacher.name, checkedBy);
                        return (
                          <div
                            key={teacher.id || tIdx}
                            className={`px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2 ${
                              isChecker
                                ? "bg-gradient-to-r from-emerald-100/90 via-teal-100/80 to-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-200/80"
                                : "bg-slate-50/80 border border-slate-200/70 text-slate-700 font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isChecker ? (
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                  <UserCheck className="w-3 h-3 text-white" />
                                </span>
                              ) : (
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getPositionDotColor(teacher.position)}`} />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`truncate ${isChecker ? "text-emerald-950 font-black text-xs" : "text-slate-800 text-xs"}`}>
                                    {teacher.name}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 border ${getPositionBadgeStyle(teacher.position)}`}>
                                    {teacher.position || (teacher.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก")}
                                  </span>
                                </div>
                                {teacher.phone && teacher.phone !== "-" && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    โทร: {teacher.phone}
                                  </p>
                                )}
                              </div>
                            </div>

                            {isChecker && (
                              <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs shrink-0 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>ผู้เช็คยอด</span>
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* If checked by a teacher or staff not in the dorm's configured teacher list */}
                      {isTodayChecked && checkedBy && !anyTeacherMatched && (
                        <div className="px-2.5 py-2 rounded-xl text-xs bg-gradient-to-r from-emerald-100/90 via-teal-100/80 to-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-200/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <UserCheck className="w-3 h-3 text-white" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-emerald-950 font-black text-xs">{checkedBy}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-200 text-emerald-900 border border-emerald-300 shrink-0">
                                  ผู้เช็คยอด (ส่วนกลาง/เช็คแทน)
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ผู้เช็คยอด</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Counts Breakdown */}
                  <div className="mt-3.5 flex items-center justify-between text-xs text-slate-700 bg-white/70 rounded-xl px-3 py-2 border border-slate-200/80 font-medium">
                    <span>ยอดทั้งหมด: <strong className="text-slate-900 font-black">{realtimeDormTotals[dorm.id]?.total || 0}</strong> คน</span>
                    <span>อยู่หอ: <strong className="text-emerald-800 font-black">{realtimeDormTotals[dorm.id]?.remaining || 0}</strong> คน</span>
                    <span>ออกหอ: <strong className="text-rose-700 font-black">{realtimeDormTotals[dorm.id]?.out || 0}</strong> คน</span>
                  </div>
                </div>

                {/* Navigation / Action Button */}
                <button
                  onClick={() => onNavigateToCheck(dorm.id, targetDate)}
                  className={`mt-4 w-full py-2.5 px-3 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isDormPaused
                      ? "bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 shadow-2xs"
                      : isTodayChecked
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-2xs"
                      : isPrepCheckTime
                      ? "bg-gradient-to-r from-[#A05AFF] to-[#8e45f0] hover:from-[#8e45f0] hover:to-[#7c32e0] text-white border border-purple-500 shadow-md shadow-[#A05AFF]/30 transform active:scale-98"
                      : "bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-600"
                  }`}
                >
                  {isDormPaused ? (
                    <>
                      <PauseCircle className="w-4 h-4 text-rose-700" />
                      <span>{currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2 ? "จัดการ / ตรวจสอบหอพักนี้" : "ดูข้อมูล (หยุดเช็คยอดชั่วคราว)"}</span>
                    </>
                  ) : isTodayChecked ? (
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

      {/* Modal 1: บันทึกการอบรม / แจ้งการหอประจำวัน */}
      <DormNoticeModal
        isOpen={isNoticesModalOpen}
        onClose={() => setIsNoticesModalOpen(false)}
        selectedDashboardDate={selectedDashboardDate}
        effectiveDashboardDate={effectiveDashboardDate}
        activeNotice={activeNotice}
        groupedDormOrientationNotes={groupedDormOrientationNotes}
      />

      {/* Modal 2: สถิตินักเรียนแยกตามหอพัก (หอพัก 1 - 6) */}
      <DormStatsModal
        isOpen={isDormStatsModalOpen}
        onClose={() => setIsDormStatsModalOpen(false)}
        dorms={dorms}
        realtimeDormTotals={realtimeDormTotals}
        activeAttendanceMap={activeAttendanceMap}
        selectedDormIdsForChart={selectedDormIdsForChart}
        setSelectedDormIdsForChart={setSelectedDormIdsForChart}
        chartViewMode={chartViewMode}
        setChartViewMode={setChartViewMode}
        dormComparisonChartData={dormComparisonChartData}
        selectedDashboardDate={selectedDashboardDate}
        effectiveDashboardDate={effectiveDashboardDate}
      />

      {/* Modal 3: ผังการจัดหอพัก (Dormitory Layout Table) */}
      <DormLayoutOverviewModal
        isOpen={isDormLayoutModalOpen}
        onClose={() => setIsDormLayoutModalOpen(false)}
        dorms={dorms}
        students={students}
        users={effectiveUsers}
        currentUser={currentUser}
      />

      {/* Modal 4: แผงควบคุมระบบการหยุดเช็คยอดชั่วคราว และเปิดระบบ (ทุกหอ & แยกหอ) และรอบกลับบ้านทุกหอพัก */}
      {systemSettings && onUpdateSystemSettings && onBulkHomeBreak && (
        <AttendanceControlModal
          isOpen={isControlModalOpen}
          onClose={() => setIsControlModalOpen(false)}
          dorms={dorms}
          students={students}
          systemSettings={systemSettings}
          onUpdateSystemSettings={onUpdateSystemSettings}
          currentUser={currentUser}
          selectedDate={effectiveDashboardDate}
          activeAttendanceMap={activeAttendanceMap}
          onBulkHomeBreak={onBulkHomeBreak}
          initialTab={controlModalInitialTab}
        />
      )}
    </div>
  );
};
