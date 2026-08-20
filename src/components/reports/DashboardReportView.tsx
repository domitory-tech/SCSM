import React, { useState, useMemo } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  DEFAULT_SYSTEM_SETTINGS,
  detectStudentGender,
  formatGradeRoomFullTitle,
  formatThaiFullDate,
  formatThaiMediumDate,
  formatThaiMonthYear,
  getTodayDateString,
  THAI_DAYS_FULL,
  THAI_DAYS_SHORT,
  THAI_MONTHS
} from "../../utils/dateUtils";
import {
  exportDashboardReportHtml,
  DashboardReportExportData
} from "../../utils/dashboardReportExporter";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCode,
  FileText,
  Filter,
  Layers,
  PieChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users
} from "lucide-react";

interface DashboardReportViewProps {
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  isLoading?: boolean;
}

type PeriodType = "daily" | "weekly" | "monthly";

const REASON_CONFIGS: Record<string, { label: string; color: string; bg: string; text: string }> = {
  ROUND_HOME: { label: "รอบกลับบ้าน", color: "#64748b", bg: "bg-slate-100", text: "text-slate-700" },
  HOME: { label: "กลับบ้าน", color: "#f97316", bg: "bg-orange-100", text: "text-orange-700" },
  CAMP: { label: "เข้าค่าย", color: "#1d4ed8", bg: "bg-blue-100", text: "text-blue-700" },
  SICK: { label: "ป่วย/รักษา", color: "#f43f5e", bg: "bg-rose-100", text: "text-rose-700" },
  SKILL_COMP: { label: "แข่งขันทักษะ", color: "#a855f7", bg: "bg-purple-100", text: "text-purple-700" },
  EXCHANGE: { label: "แลกเปลี่ยน", color: "#0ea5e9", bg: "bg-sky-100", text: "text-sky-700" },
  OTHER: { label: "อื่นๆ/กิจธุระ", color: "#d97706", bg: "bg-amber-100", text: "text-amber-700" }
};

export const DashboardReportView: React.FC<DashboardReportViewProps> = ({
  students = [],
  dorms = [],
  attendanceRecords = [],
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  currentUser,
  isLoading = false
}) => {
  const todayStr = getTodayDateString();
  const currentDate = new Date();

  // Period Type State
  const [periodType, setPeriodType] = useState<PeriodType>("weekly");

  // Selection States
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Filter States
  const [filterDormId, setFilterDormId] = useState<string>("ALL");
  const [filterGrade, setFilterGrade] = useState<string>("ALL");

  // 1. Calculate Date Range based on Period Type
  const { dateList, periodTitle, dateRangeText } = useMemo(() => {
    if (periodType === "daily") {
      const formatted = formatThaiFullDate(selectedDate);
      return {
        dateList: [selectedDate],
        periodTitle: `ประจำวัน ${formatThaiMediumDate(selectedDate)}`,
        dateRangeText: formatted
      };
    }

    if (periodType === "weekly") {
      // Calculate 7 days ending or surrounding the selected date
      const base = new Date(selectedDate);
      // Let's get Monday of this week
      const day = base.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(base);
      monday.setDate(base.getDate() + diffToMonday);

      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dt = String(d.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${dt}`);
      }

      const startText = formatThaiFullDate(dates[0]);
      const endText = formatThaiFullDate(dates[6]);
      return {
        dateList: dates,
        periodTitle: `รายสัปดาห์ ${startText} - ${endText}`,
        dateRangeText: `${startText} - ${endText}`
      };
    }

    // Monthly
    const daysCount = new Date(selectedYear, selectedMonth, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= daysCount; d++) {
      const mStr = String(selectedMonth).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      dates.push(`${selectedYear}-${mStr}-${dStr}`);
    }

    const monthTitle = formatThaiMonthYear(selectedYear, selectedMonth);
    return {
      dateList: dates,
      periodTitle: `รายเดือน (${monthTitle})`,
      dateRangeText: `${monthTitle} (1 - ${daysCount} ${THAI_MONTHS[selectedMonth - 1]})`
    };
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  // 2. Filter Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterDormId !== "ALL" && s.dormId !== filterDormId) return false;
      if (filterGrade !== "ALL" && s.grade !== filterGrade) return false;
      return true;
    });
  }, [students, filterDormId, filterGrade]);

  const totalRegistered = filteredStudents.length;
  const maleCount = filteredStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length;
  const femaleCount = filteredStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length;

  // 3. Process Attendance Records in the Date Range
  const {
    kpis,
    reasonStats,
    dormStats,
    gradeStats,
    dailyTimeline,
    absentList,
    insights
  } = useMemo(() => {
    const studentMap = new Map<string, Student>();
    students.forEach((s) => studentMap.set(s.studentId, s));

    const dormMap = new Map<string, Dormitory>();
    dorms.forEach((d) => dormMap.set(d.id, d));

    // Filter attendance records in our target date range
    const targetDatesSet = new Set(dateList);
    const relevantAttendance = attendanceRecords.filter((att) => targetDatesSet.has(att.date));

    // Absence aggregation
    const reasonCountMap: Record<string, number> = {
      ROUND_HOME: 0,
      HOME: 0,
      CAMP: 0,
      SICK: 0,
      SKILL_COMP: 0,
      EXCHANGE: 0,
      OTHER: 0
    };

    const fullAbsentList: Array<{
      date: string;
      studentId: string;
      studentNo?: number;
      fullName: string;
      gradeRoom: string;
      dormName: string;
      dormId: string;
      grade: string;
      room?: number;
      reason: string;
      status: string;
      statusLabel: string;
    }> = [];

    // Daily breakdown mapping
    const dateStatsMap: Record<string, { present: number; out: number; total: number }> = {};
    dateList.forEach((d) => {
      dateStatsMap[d] = { present: 0, out: 0, total: 0 };
    });

    // Dorm breakdown mapping
    const dormStatMap: Record<
      string,
      {
        dormId: string;
        dormName: string;
        type: string;
        capacity: number;
        studentCount: number;
        presentSum: number;
        outSum: number;
        checkedDays: number;
      }
    > = {};

    dorms.forEach((d) => {
      const dormStudents = students.filter((s) => s.dormId === d.id);
      dormStatMap[d.id] = {
        dormId: d.id,
        dormName: d.name,
        type: d.type,
        capacity: d.capacity,
        studentCount: dormStudents.length,
        presentSum: 0,
        outSum: 0,
        checkedDays: 0
      };
    });

    // Grade breakdown mapping (ม.1 - ม.6)
    const gradeList = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
    const gradeStatMap: Record<
      string,
      {
        grade: string;
        total: number;
        male: number;
        female: number;
        presentSum: number;
        outSum: number;
        daysCounted: number;
      }
    > = {};

    gradeList.forEach((g) => {
      const gStudents = students.filter((s) => s.grade === g);
      gradeStatMap[g] = {
        grade: g,
        total: gStudents.length,
        male: gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "male").length,
        female: gStudents.filter((s) => detectStudentGender(s.title, s.firstName, s.gender) === "female").length,
        presentSum: 0,
        outSum: 0,
        daysCounted: 0
      };
    });

    // Process each relevant attendance entry
    relevantAttendance.forEach((att) => {
      const dorm = dormMap.get(att.dormId);
      const isHomeBreak = att.isHomeBreak || att.status === "HOME_BREAK";
      const dormStudents = students.filter((s) => s.dormId === att.dormId);
      const totalInDorm = dormStudents.length;

      if (dormStatMap[att.dormId]) {
        dormStatMap[att.dormId].checkedDays += 1;
      }

      let absentInDorm = 0;

      if (isHomeBreak) {
        // All students in this dorm are ROUND_HOME
        absentInDorm = totalInDorm;
        reasonCountMap.ROUND_HOME += totalInDorm;

        dormStudents.forEach((s) => {
          if (
            (filterDormId === "ALL" || s.dormId === filterDormId) &&
            (filterGrade === "ALL" || s.grade === filterGrade)
          ) {
            fullAbsentList.push({
              date: att.date,
              studentId: s.studentId,
              studentNo: s.no,
              fullName: `${s.title}${s.firstName} ${s.lastName}`,
              gradeRoom: formatGradeRoomFullTitle(s.grade, s.room),
              dormName: dorm?.name || s.dormId,
              dormId: s.dormId,
              grade: s.grade,
              room: s.room,
              reason: "รอบกลับบ้านตามปฏิทินโรงเรียน",
              status: "ROUND_HOME",
              statusLabel: "รอบกลับบ้าน"
            });
          }
        });
      } else if (att.records && Array.isArray(att.records)) {
        att.records.forEach((rec) => {
          const s = studentMap.get(rec.studentId);
          if (!s) return;

          if (rec.status && rec.status !== "PRESENT") {
            absentInDorm += 1;
            const st = rec.status in reasonCountMap ? rec.status : "OTHER";
            reasonCountMap[st] = (reasonCountMap[st] || 0) + 1;

            if (
              (filterDormId === "ALL" || s.dormId === filterDormId) &&
              (filterGrade === "ALL" || s.grade === filterGrade)
            ) {
              fullAbsentList.push({
                date: att.date,
                studentId: s.studentId,
                studentNo: s.no,
                fullName: `${s.title}${s.firstName} ${s.lastName}`,
                gradeRoom: formatGradeRoomFullTitle(s.grade, s.room),
                dormName: dorm?.name || s.dormId,
                dormId: s.dormId,
                grade: s.grade,
                room: s.room,
                reason: rec.reason || rec.note || REASON_CONFIGS[rec.status]?.label || "ไม่ระบุสาเหตุ",
                status: rec.status,
                statusLabel: REASON_CONFIGS[rec.status]?.label || "ออกหอพัก"
              });
            }
          }
        });
      }

      const presentInDorm = Math.max(0, totalInDorm - absentInDorm);

      if (dormStatMap[att.dormId]) {
        dormStatMap[att.dormId].presentSum += presentInDorm;
        dormStatMap[att.dormId].outSum += absentInDorm;
      }

      if (dateStatsMap[att.date]) {
        dateStatsMap[att.date].present += presentInDorm;
        dateStatsMap[att.date].out += absentInDorm;
        dateStatsMap[att.date].total += totalInDorm;
      }
    });

    // Helper to get grade weight for ascending sort
    const getGradeWeight = (g: string) => {
      if (g.includes("1")) return 1;
      if (g.includes("2")) return 2;
      if (g.includes("3")) return 3;
      if (g.includes("4")) return 4;
      if (g.includes("5")) return 5;
      if (g.includes("6")) return 6;
      return 99;
    };

    // Sort absence table: Dormitory -> Grade / Room -> Student Number (ascending)
    fullAbsentList.sort((a, b) => {
      // 1. Sort by Dormitory name/id
      const dormComp = (a.dormName || "").localeCompare(b.dormName || "", "th", { numeric: true });
      if (dormComp !== 0) return dormComp;

      // 2. Sort by Grade
      const gradeA = getGradeWeight(a.grade || "");
      const gradeB = getGradeWeight(b.grade || "");
      if (gradeA !== gradeB) return gradeA - gradeB;

      // 3. Sort by Room
      const roomA = a.room || 0;
      const roomB = b.room || 0;
      if (roomA !== roomB) return roomA - roomB;

      // 4. Sort by Student Number (เลขที่)
      const noA = a.studentNo ?? 9999;
      const noB = b.studentNo ?? 9999;
      if (noA !== noB) return noA - noB;

      // 5. Fallback: Student ID / Date
      const idComp = (a.studentId || "").localeCompare(b.studentId || "", "th", { numeric: true });
      if (idComp !== 0) return idComp;
      return (a.date || "").localeCompare(b.date || "");
    });

    // Populate Grade Stats present/out estimates
    const totalDays = Math.max(dateList.length, 1);
    gradeList.forEach((g) => {
      const gAbsents = fullAbsentList.filter((a) => a.grade === g).length;
      const gTotal = gradeStatMap[g].total;
      const avgOut = Math.round(gAbsents / totalDays);
      const avgPresent = Math.max(0, gTotal - avgOut);
      gradeStatMap[g].outSum = avgOut;
      gradeStatMap[g].presentSum = avgPresent;
    });

    // Build timeline array
    let dailyTimeline: Array<{
      date: string;
      displayDate: string;
      dayName: string;
      present: number;
      out: number;
      total: number;
      rate: number;
      subText?: string;
    }> = [];

    if (periodType === "monthly") {
      const monthNameThai = THAI_MONTHS[selectedMonth - 1] || "";
      // Group and sum all days of the month by Day of Week (Monday -> Sunday)
      const dayOfWeekDefs = [
        { dayIndex: 1, dayName: "วันจันทร์" },
        { dayIndex: 2, dayName: "วันอังคาร" },
        { dayIndex: 3, dayName: "วันพุธ" },
        { dayIndex: 4, dayName: "วันพฤหัสบดี" },
        { dayIndex: 5, dayName: "วันศุกร์" },
        { dayIndex: 6, dayName: "วันเสาร์" },
        { dayIndex: 0, dayName: "วันอาทิตย์" }
      ];

      dailyTimeline = dayOfWeekDefs.map((dow) => {
        const matchingDates = dateList.filter((dStr) => {
          const dObj = new Date(dStr);
          return dObj.getDay() === dow.dayIndex;
        });

        const weekCount = Math.max(matchingDates.length, 1);
        let sumOut = 0;

        matchingDates.forEach((dStr) => {
          const st = dateStatsMap[dStr] || { present: 0, out: 0, total: 0 };
          sumOut += st.out;
        });

        const avgOut = Math.round(sumOut / weekCount);
        const avgPresent = Math.max(0, totalRegistered - avgOut);
        const rate = totalRegistered > 0 ? ((totalRegistered - avgOut) / totalRegistered) * 100 : 100;

        return {
          date: `dow-${dow.dayIndex}`,
          displayDate: `เดือน${monthNameThai}`,
          dayName: dow.dayName,
          present: totalRegistered,
          out: sumOut,
          total: totalRegistered,
          rate,
          subText: `(เฉลี่ย ${avgPresent} / ${avgOut} คนต่อวัน)`
        };
      });
    } else {
      dailyTimeline = dateList.map((dStr) => {
        const dObj = new Date(dStr);
        const dayFull = THAI_DAYS_FULL[dObj.getDay()] || "";
        const dayNum = dObj.getDate();
        const monthName = THAI_MONTHS[dObj.getMonth()] || "";
        const st = dateStatsMap[dStr] || { present: 0, out: 0, total: 0 };
        const tot = st.total > 0 ? st.total : totalRegistered;
        const present = st.present > 0 || st.out > 0 ? st.present : tot;
        const rate = tot > 0 ? (present / tot) * 100 : 100;

        return {
          date: dStr,
          displayDate: `วันที่ ${dayNum} เดือน${monthName}`,
          dayName: dayFull,
          present,
          out: st.out,
          total: tot,
          rate
        };
      });
    }

    // Compute Overall KPIs
    const totalAbsenceRecords = fullAbsentList.length;
    const avgOutPerDay = Math.round(totalAbsenceRecords / totalDays);
    const avgPresentPerDay = Math.max(0, totalRegistered - avgOutPerDay);
    const attendanceRate = totalRegistered > 0 ? (avgPresentPerDay / totalRegistered) * 100 : 100;

    // Check-in completion rate
    const totalPossibleChecks = dorms.length * totalDays;
    const totalActualChecks = relevantAttendance.length;
    const checkInCompletionRate =
      totalPossibleChecks > 0 ? Math.min(100, (totalActualChecks / totalPossibleChecks) * 100) : 100;

    // Build Reason Breakdown Array
    const totalReasons = Object.values(reasonCountMap).reduce((a, b) => a + b, 0) || 1;
    const reasonStats = Object.entries(reasonCountMap).map(([status, count]) => {
      const cfg = REASON_CONFIGS[status] || { label: status, color: "#64748b" };
      return {
        status,
        label: cfg.label,
        count,
        percent: (count / totalReasons) * 100,
        color: cfg.color
      };
    });

    // Build Dorm Stats Array
    const dormStats = Object.values(dormStatMap).map((d) => {
      const days = Math.max(d.checkedDays, 1);
      const avgPresent = Math.round(d.presentSum / days);
      const avgOut = Math.round(d.outSum / days);
      const occupancyRate = d.studentCount > 0 ? (avgPresent / d.studentCount) * 100 : 0;

      return {
        dormId: d.dormId,
        dormName: d.dormName,
        type: d.type,
        capacity: d.capacity,
        studentCount: d.studentCount,
        presentCount: avgPresent,
        outCount: avgOut,
        occupancyRate: Math.min(100, occupancyRate),
        checkedDays: d.checkedDays
      };
    });

    // Build Grade Stats Array
    const gradeStats = Object.values(gradeStatMap).map((g) => {
      const rate = g.total > 0 ? (g.presentSum / g.total) * 100 : 100;
      return {
        grade: g.grade,
        total: g.total,
        male: g.male,
        female: g.female,
        present: g.presentSum,
        out: g.outSum,
        rate: Math.min(100, rate)
      };
    });

    // Generate Automated Insights
    const insights: string[] = [];
    if (totalRegistered > 0) {
      insights.push(
        `นักเรียนทั้งหมดในระบบ ${totalRegistered} คน (นักเรียนชาย ${maleCount} คน / นักเรียนหญิง ${femaleCount} คน) สัดส่วนเฉลี่ย ${((maleCount / totalRegistered) * 100).toFixed(0)}% ต่อ ${((femaleCount / totalRegistered) * 100).toFixed(0)}%`
      );
      insights.push(
        `อัตราการเข้าพักเฉลี่ยในช่วง ${periodTitle} อยู่ที่ ${attendanceRate.toFixed(1)}% (มีนักเรียนอยู่หอพักเฉลี่ย ${avgPresentPerDay} คน/วัน)`
      );

      // Best Dorm
      const sortedDorms = [...dormStats].sort((a, b) => b.occupancyRate - a.occupancyRate);
      if (sortedDorms.length > 0 && sortedDorms[0].studentCount > 0) {
        insights.push(
          `หอพักที่มีอัตราการเข้าพักเฉลี่ยสูงสุด คือ ${sortedDorms[0].dormName} (${sortedDorms[0].occupancyRate.toFixed(1)}%)`
        );
      }

      // Top Reason
      const sortedReasons = [...reasonStats].sort((a, b) => b.count - a.count);
      if (sortedReasons.length > 0 && sortedReasons[0].count > 0) {
        insights.push(
          `สาเหตุหลักของการออกหอพักในช่วงเวลานี้ คือ "${sortedReasons[0].label}" จำนวน ${sortedReasons[0].count} คน-ครั้ง (${sortedReasons[0].percent.toFixed(1)}%)`
        );
      }

      insights.push(
        `ความครบถ้วนในการบันทึกและส่งรายงานของครูหอพัก คิดเป็น ${checkInCompletionRate.toFixed(1)}% ของรอบเวลาทั้งหมด`
      );
    } else {
      insights.push("ยังไม่มีข้อมูลนักเรียนในระบบ");
    }

    return {
      kpis: {
        totalStudents: totalRegistered,
        maleStudents: maleCount,
        femaleStudents: femaleCount,
        avgPresent: avgPresentPerDay,
        avgOut: avgOutPerDay,
        attendanceRate,
        totalAbsenceRecords,
        checkInCompletionRate,
        totalDorms: dorms.length
      },
      reasonStats,
      dormStats,
      gradeStats,
      dailyTimeline,
      absentList: fullAbsentList,
      insights
    };
  }, [
    students,
    dorms,
    attendanceRecords,
    dateList,
    totalRegistered,
    maleCount,
    femaleCount,
    filterDormId,
    filterGrade,
    periodTitle
  ]);

  // Handler for Standalone HTML/CSS Export
  const handleExportHtml = () => {
    try {
      const dormObj = dorms.find((d) => d.id === filterDormId);
      const filterDormName = filterDormId === "ALL" ? "ทุกหอพัก (หอพัก 1 - 6)" : dormObj?.name || filterDormId;
      const filterGradeName = filterGrade === "ALL" ? "ทุกระดับชั้น (ม.1 - ม.6)" : filterGrade;

      const dateSuffix =
        periodType === "daily"
          ? selectedDate
          : periodType === "weekly"
          ? `${dateList[0]}_ถึง_${dateList[dateList.length - 1]}`
          : `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      const fileName = `รายงานแดชบอร์ดสถิติหอพัก_${periodType}_${dateSuffix}.html`;

      const exportData: DashboardReportExportData = {
        periodType,
        periodTitle,
        dateRangeText,
        filterDormName,
        filterGradeName,
        systemSettings,
        kpis,
        reasonStats,
        dormStats,
        gradeStats,
        dailyTimeline,
        absentList,
        insights,
        signatories: {
          creator: currentUser?.name || "เจ้าหน้าที่สำนักงาน",
          headTeacher: "ครูหัวหน้างานหอพัก",
          deputyDirector: "รองผู้อำนวยการกลุ่มบริหารงานบุคคล"
        }
      };

      exportDashboardReportHtml(exportData, fileName);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการส่งออกรายงาน: " + err.message);
    }
  };

  const selectedDormLabel = filterDormId === "ALL" ? "ทุกหอพัก" : dorms.find((d) => d.id === filterDormId)?.name || filterDormId;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Top Configuration Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-purple-600 uppercase tracking-wide">
              <Sparkles className="w-4 h-4" />
              <span>Statistical & Analytical Intelligence Dashboard</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              รายงานวิเคราะห์สถิติ & แดชบอร์ดหอพักนักเรียน
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              วิเคราะห์ข้อมูลเชิงลึกจากฐานข้อมูล ({periodTitle}) • {dateRangeText}
            </p>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportHtml}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-purple-200"
              title="ส่งออกรายงานแดชบอร์ดรูปแบบ HTML/CSS สำหรับพิมพ์ A4 หรือเปิดดูในเบราว์เซอร์"
            >
              <FileCode className="w-4 h-4 text-purple-200" />
              <span>ส่งออกรายงาน / พิมพ์ (HTML/CSS)</span>
            </button>
          </div>
        </div>

        {/* Period Selector & Filter Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          {/* Period Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPeriodType("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                periodType === "daily"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ประจำวัน (Daily)
            </button>
            <button
              onClick={() => setPeriodType("weekly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                periodType === "weekly"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              รายสัปดาห์ (Weekly)
            </button>
            <button
              onClick={() => setPeriodType("monthly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                periodType === "monthly"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              รายเดือน (Monthly)
            </button>
          </div>

          {/* Date Picker according to Period */}
          <div className="flex flex-wrap items-center gap-2.5">
            {periodType === "daily" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">เลือกวันที่:</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={getTodayDateString()}
                  onChange={(e) => setSelectedDate(e.target.value || todayStr)}
                  className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            {periodType === "weekly" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">เลือกวันในสัปดาห์:</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={getTodayDateString()}
                  onChange={(e) => setSelectedDate(e.target.value || todayStr)}
                  className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                  {dateRangeText}
                </span>
              </div>
            )}

            {periodType === "monthly" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">เลือกเดือน/ปี:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {THAI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y + 543}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter Dorm */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-xs font-bold text-slate-700">หอพัก:</span>
              <select
                value={filterDormId}
                onChange={(e) => setFilterDormId(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">ทุกหอพัก</option>
                {dorms.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Grade */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">ระดับชั้น:</span>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">ทุกระดับชั้น</option>
                {["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">นักเรียนในระบบ</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900">
              {kpis.totalStudents} <span className="text-sm font-bold text-slate-400">คน</span>
            </div>
            <div className="text-xs font-semibold text-purple-600 mt-1 flex items-center gap-1.5">
              <span>ชาย {kpis.maleStudents}</span>
              <span>•</span>
              <span>หญิง {kpis.femaleStudents} คน</span>
            </div>
          </div>
        </div>

        {/* Present Average */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">อยู่หอพักเฉลี่ย</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-700">
              {kpis.avgPresent} <span className="text-sm font-bold text-emerald-500">คน/วัน</span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>คิดเป็น {kpis.attendanceRate.toFixed(1)}% ของยอดรวม</span>
            </div>
          </div>
        </div>

        {/* Absent Average */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ออกหอพัก/ลาพักเฉลี่ย</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <UserMinus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-rose-600">
              {kpis.avgOut} <span className="text-sm font-bold text-rose-400">คน/วัน</span>
            </div>
            <div className="text-xs font-semibold text-rose-500 mt-1 flex items-center gap-1">
              <span>สะสม {kpis.totalAbsenceRecords} คน-ครั้ง</span>
            </div>
          </div>
        </div>

        {/* Check-In Compliance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">อัตราการส่งรายงาน</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-amber-700">
              {kpis.checkInCompletionRate.toFixed(1)}%
            </div>
            <div className="text-xs font-semibold text-amber-600 mt-1">
              <span>การบันทึกข้อมูลของครูหอพัก</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Timeline Trends Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>
                    {periodType === "monthly"
                      ? "แนวโน้มการอยู่หอพักเทียบกับการออกหอพัก (รายเดือน - รวมวันจันทร์ ถึง อาทิตย์)"
                      : `แนวโน้มการอยู่หอพักเทียบกับการออกหอพัก (${periodTitle})`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {periodType === "monthly"
                    ? "นำข้อมูลในแต่ละวันของแต่ละสัปดาห์ตลอดทั้งเดือนมารวมกัน แสดงวันจันทร์ ถึง วันอาทิตย์"
                    : "แสดงจำนวนนักเรียนที่อยู่หอพักและนักเรียนที่ออกหอพักในแต่ละวัน"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-3 h-3 rounded-md bg-emerald-500"></span> อยู่หอ
                </span>
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-3 h-3 rounded-md bg-rose-500"></span> ออกหอ
                </span>
              </div>
            </div>

            {/* Visual SVG Timeline */}
            <div className="space-y-3 pt-2">
              {dailyTimeline.map((item) => {
                const total = Math.max(item.total, 1);
                const presentPct = Math.min(100, (item.present / total) * 100);
                const outPct = Math.min(100, (item.out / total) * 100);

                return (
                  <div key={item.date} className="space-y-1.5 p-2.5 rounded-xl hover:bg-purple-50/50 transition-colors border border-transparent hover:border-purple-100">
                    <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="min-w-[76px] text-purple-900 font-extrabold">{item.dayName}</span>
                        <span className="text-slate-600 font-semibold">{item.displayDate}</span>
                      </div>
                      
                      {periodType === "monthly" ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-800 font-bold">นักเรียน {item.present} คน</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-rose-600 font-bold">ออกหอพัก {item.out} คน</span>
                          {item.subText && (
                            <span className="text-slate-500 font-medium text-[11px] hidden sm:inline ml-1">{item.subText}</span>
                          )}
                          <span className="text-purple-700 font-extrabold min-w-[36px] text-right">{presentPct.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-emerald-700 font-bold">อยู่หอพัก {item.present} คน</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-rose-600 font-bold">ออกหอพัก {item.out} คน</span>
                          <span className="text-purple-700 font-extrabold min-w-[36px] text-right">{presentPct.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>

                    <div className="h-3 bg-slate-100 rounded-full flex overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all"
                        style={{ width: `${presentPct}%` }}
                        title={`อยู่หอพัก: ${presentPct.toFixed(1)}%`}
                      ></div>
                      {outPct > 0 && (
                        <div
                          className="bg-gradient-to-r from-rose-500 to-orange-500 h-full rounded-full transition-all ml-0.5"
                          style={{ width: `${outPct}%` }}
                          title={`ออกหอพัก: ${item.out} คน (${outPct.toFixed(1)}%)`}
                        ></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Absence Cause Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-600" />
                  <span>สัดส่วนจำแนกตามสาเหตุการออกหอพัก</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">จำแนกตามสถานะและเหตุผลที่บันทึกในระบบ</p>
              </div>
            </div>

            {/* Reason Progress List */}
            <div className="space-y-3">
              {reasonStats.map((r) => (
                <div key={r.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }}></span>
                      <span>{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900">{r.count} คน</span>
                      <span className="text-slate-400 font-semibold text-[11px]">({r.percent.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${r.percent}%`, backgroundColor: r.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>รวมรายการออกหอพักสะสม:</span>
            <strong className="text-slate-900 text-sm font-extrabold">{kpis.totalAbsenceRecords} คน-ครั้ง</strong>
          </div>
        </div>
      </div>

      {/* 4. Automated Insights Card */}
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white rounded-2xl p-5 shadow-md">
        <div className="flex items-center gap-2 text-xs font-extrabold text-purple-300 uppercase tracking-wide mb-2">
          <Sparkles className="w-4 h-4 text-purple-300" />
          <span>Automated Statistical Observations & Insights</span>
        </div>
        <h3 className="text-base font-black text-white mb-3">บทวิเคราะห์และข้อค้นพบจากข้อมูลเชิงระบบ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((item, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/40 text-purple-200 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs text-purple-100 font-medium leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Deep-Dive Tables: Dormitory & Grade Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dormitory Breakdown Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>สรุปสถิติข้อมูลแยกตามหอพัก (Dormitory Breakdown)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">หอพัก 1 - 6 พร้อมอัตราการเข้าพักเฉลี่ย</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-100">
                <tr>
                  <th className="py-2.5 px-3 border-r border-purple-100">ชื่อหอพัก</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ประเภท</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ความจุ</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">นักเรียน</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">อยู่เฉลี่ย</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-purple-100 w-16">ออกเฉลี่ย</th>
                  <th className="py-2.5 px-3 text-center">อัตราการเข้าพัก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dormStats.map((d) => (
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
            </table>
          </div>
        </div>

        {/* Grade Breakdown Table (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>สรุปสถิติข้อมูลแยกตามระดับชั้น</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">มัธยมศึกษาปีที่ 1 - 6</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
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
                {gradeStats.map((g) => (
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
            </table>
          </div>
        </div>
      </div>

      {/* 6. Absence Records Log Table */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-rose-600" />
              <span>บันทึกประวัติการออกหอพักของนักเรียนในช่วงนี้</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              แสดงข้อมูล {absentList.length} รายการ (ตามเงื่อนไข: {selectedDormLabel})
            </p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-pink-50 text-pink-900 font-bold border-b border-pink-100 sticky top-0 bg-pink-50 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-pink-100 w-12">ที่</th>
                  <th className="py-2.5 px-3 text-center border-r border-pink-100 w-28">วันที่</th>
                  <th className="py-2.5 px-3 border-r border-pink-100 w-28">รหัสนักเรียน</th>
                  <th className="py-2.5 px-3 border-r border-pink-100">ชื่อ - นามสกุล</th>
                  <th className="py-2.5 px-3 text-center border-r border-pink-100 w-28">ระดับชั้น/ห้อง</th>
                  <th className="py-2.5 px-3 text-center border-r border-pink-100 w-28">หอพัก</th>
                  <th className="py-2.5 px-3 text-left w-48">เหตุผล/สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {absentList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      ไม่มีรายการออกหอพักในช่วงเวลานี้ (นักเรียนอยู่หอพักครบทุกคน)
                    </td>
                  </tr>
                ) : (
                  absentList.map((a, i) => (
                    <tr key={`${a.studentId}_${a.date}_${i}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium border-r border-slate-100">{i + 1}</td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700 border-r border-slate-100">{a.date}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 border-r border-slate-100">{a.studentId}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-100">{a.fullName}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700 border-r border-slate-100">{a.gradeRoom}</td>
                      <td className="py-2.5 px-3 text-center text-purple-700 font-bold border-r border-slate-100">{a.dormName}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-600">{a.reason || a.statusLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
