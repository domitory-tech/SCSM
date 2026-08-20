import React, { useState, useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  PieChart,
  BarChart2,
  TrendingUp,
  Calendar,
  Home,
  Activity,
  Trophy,
  Globe,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  Award,
  ArrowUpRight,
  Info,
  Tent
} from "lucide-react";
import { DailyAttendance, Dormitory } from "../../types";

interface ReasonAnalyticsCardProps {
  liveReasonCounts: Record<string, number>;
  grandTotals: { total: number; out: number; remaining: number };
  todayAttendance: Record<string, DailyAttendance>;
  absentStudentsList: Array<any>;
  dorms: Dormitory[];
  allHistoricalRecords?: DailyAttendance[];
  effectiveDashboardDate?: string;
  students?: Array<any>;
  realtimeDormTotals?: Record<string, { total: number; out: number; remaining: number }>;
}

type TimeframeMode = "today" | "weekly" | "monthly" | "trends";

export const ReasonAnalyticsCard: React.FC<ReasonAnalyticsCardProps> = ({
  liveReasonCounts,
  grandTotals,
  todayAttendance,
  absentStudentsList,
  dorms,
  allHistoricalRecords = [],
  effectiveDashboardDate,
  students = [],
  realtimeDormTotals = {}
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeMode>("today");

  // Colors mapping for reason categories (Matched with attendance status check colors)
  const reasonColorMap: Record<string, { bg: string; border: string; text: string; badge: string; icon: any }> = {
    "กลับบ้าน": {
      bg: "#F59E0B", // Amber / Orange
      border: "border-amber-200",
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-800",
      icon: Home
    },
    "เข้าค่าย": {
      bg: "#2563EB", // Blue
      border: "border-blue-200",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-800",
      icon: Tent
    },
    "ป่วย": {
      bg: "#F43F5E", // Rose / Red
      border: "border-rose-200",
      text: "text-rose-700",
      badge: "bg-rose-100 text-rose-800",
      icon: Activity
    },
    "แข่งทักษะ": {
      bg: "#8B5CF6", // Purple / Violet
      border: "border-purple-200",
      text: "text-purple-700",
      badge: "bg-purple-100 text-purple-800",
      icon: Trophy
    },
    "แลกเปลี่ยน": {
      bg: "#0EA5E9", // Sky / Cyan
      border: "border-sky-200",
      text: "text-sky-700",
      badge: "bg-sky-100 text-sky-800",
      icon: Globe
    },
    "อื่นๆ": {
      bg: "#64748B", // Slate / Gray
      border: "border-slate-200",
      text: "text-slate-700",
      badge: "bg-slate-100 text-slate-800",
      icon: HelpCircle
    }
  };

  // Process all historical attendance records from Firestore
  const processedHistoricalData = useMemo(() => {
    const dormStudentCounts: Record<string, number> = {};
    dorms.forEach((d) => {
      const dormSts = students ? students.filter((s) => s.dormId === d.id) : [];
      dormStudentCounts[d.id] = dormSts.length > 0 ? dormSts.length : d.capacity || 80;
    });

    // dateStr -> reason -> count
    const dateReasonMap: Record<string, Record<string, number>> = {};
    // dateStr -> dormId -> outCount
    const dateDormOutMap: Record<string, Record<string, number>> = {};

    (allHistoricalRecords || []).forEach((att) => {
      if (!att || !att.date) return;
      const dStr = att.date;
      const dormId = att.dormId;

      if (!dateReasonMap[dStr]) {
        dateReasonMap[dStr] = { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
      }
      if (!dateDormOutMap[dStr]) dateDormOutMap[dStr] = {};

      let dormOut = 0;
      if (att.isHomeBreak || att.status === "HOME_BREAK") {
        // Exclude round-trip home break
      } else if (att.records && Array.isArray(att.records)) {
        att.records.forEach((r) => {
          if (r.status === "HOME") { dateReasonMap[dStr]["กลับบ้าน"]++; dormOut++; }
          else if (r.status === "CAMP") { dateReasonMap[dStr]["เข้าค่าย"]++; dormOut++; }
          else if (r.status === "SICK") { dateReasonMap[dStr]["ป่วย"]++; dormOut++; }
          else if (r.status === "SKILL_COMP") { dateReasonMap[dStr]["แข่งทักษะ"]++; dormOut++; }
          else if (r.status === "EXCHANGE") { dateReasonMap[dStr]["แลกเปลี่ยน"]++; dormOut++; }
          else if (r.status === "OTHER") { dateReasonMap[dStr]["อื่นๆ"]++; dormOut++; }
        });
      }
      dateDormOutMap[dStr][dormId] = (dateDormOutMap[dStr][dormId] || 0) + dormOut;
    });

    // Merge active attendance for effectiveDashboardDate
    const effDate = effectiveDashboardDate || new Date().toISOString().split("T")[0];
    if (todayAttendance) {
      if (!dateReasonMap[effDate]) {
        dateReasonMap[effDate] = { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
      }
      if (!dateDormOutMap[effDate]) dateDormOutMap[effDate] = {};

      dorms.forEach((d) => {
        const att = todayAttendance[d.id];
        if (!att) return;
        let dOut = 0;
        const dReasons = { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
        if (att.isHomeBreak || att.status === "HOME_BREAK") {
          // Exclude round-trip home break
        } else if (att.records && Array.isArray(att.records)) {
          att.records.forEach((r) => {
            if (r.status === "HOME") { dReasons["กลับบ้าน"]++; dOut++; }
            else if (r.status === "CAMP") { dReasons["เข้าค่าย"]++; dOut++; }
            else if (r.status === "SICK") { dReasons["ป่วย"]++; dOut++; }
            else if (r.status === "SKILL_COMP") { dReasons["แข่งทักษะ"]++; dOut++; }
            else if (r.status === "EXCHANGE") { dReasons["แลกเปลี่ยน"]++; dOut++; }
            else if (r.status === "OTHER") { dReasons["อื่นๆ"]++; dOut++; }
          });
        }
        dateDormOutMap[effDate][d.id] = dOut;
      });

      if (liveReasonCounts && (Object.values(liveReasonCounts) as number[]).some((v) => v > 0)) {
        dateReasonMap[effDate] = { ...liveReasonCounts };
      }
    }

    // Day of Week historical averages calculation (0=Mon, 1=Tue, ..., 6=Sun)
    const dowReasonLists: Record<number, Record<string, number[]>> = {
      0: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      1: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      2: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      3: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      4: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      5: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
      6: { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] },
    };

    const dowDormOutLists: Record<string, Record<number, number[]>> = {};
    dorms.forEach((d) => {
      dowDormOutLists[d.id] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    });

    Object.entries(dateReasonMap).forEach(([dStr, rMap]) => {
      const dt = new Date(dStr);
      if (isNaN(dt.getTime())) return;
      const rawDow = dt.getDay();
      const dow = rawDow === 0 ? 6 : rawDow - 1; // 0=Mon..6=Sun

      Object.entries(rMap).forEach(([reason, cnt]) => {
        if (!dowReasonLists[dow]) {
          dowReasonLists[dow] = { "กลับบ้าน": [], "เข้าค่าย": [], "ป่วย": [], "แข่งทักษะ": [], "แลกเปลี่ยน": [], "อื่นๆ": [] };
        }
        if (!dowReasonLists[dow][reason]) {
          dowReasonLists[dow][reason] = [];
        }
        dowReasonLists[dow][reason].push(cnt);
      });

      if (dateDormOutMap[dStr]) {
        Object.entries(dateDormOutMap[dStr]).forEach(([dormId, outCnt]) => {
          if (dowDormOutLists[dormId] && dowDormOutLists[dormId][dow]) {
            dowDormOutLists[dormId][dow].push(outCnt);
          }
        });
      }
    });

    const dowAvgReasons: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 7; i++) {
      dowAvgReasons[i] = { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
      Object.keys(dowAvgReasons[i]).forEach((reason) => {
        const list = dowReasonLists[i]?.[reason] || [];
        if (list.length > 0) {
          dowAvgReasons[i][reason] = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
        }
      });
    }

    const dowDormAvgOut: Record<string, Record<number, number>> = {};
    dorms.forEach((d) => {
      dowDormAvgOut[d.id] = {};
      for (let i = 0; i < 7; i++) {
        const list = dowDormOutLists[d.id][i];
        dowDormAvgOut[d.id][i] = list.length > 0 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
      }
    });

    return {
      dateReasonMap,
      dateDormOutMap,
      dowAvgReasons,
      dowDormAvgOut,
      totalRecordedDates: Object.keys(dateReasonMap).length
    };
  }, [allHistoricalRecords, todayAttendance, dorms, students, effectiveDashboardDate, liveReasonCounts]);

  // Compute 4 Condition Datasets (today, weekly, monthly, trends)
  const activeAnalyticsConfig = useMemo(() => {
    const daysName = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
    const effDate = effectiveDashboardDate || new Date().toISOString().split("T")[0];
    const effDt = new Date(effDate);
    const rawDow = isNaN(effDt.getTime()) ? new Date().getDay() : effDt.getDay();
    const currentDowIdx = rawDow === 0 ? 6 : rawDow - 1; // 0=Mon..6=Sun

    if (timeframe === "today") {
      // 1. วันนี้ / ปัจจุบัน
      const reasonTotals = { ...liveReasonCounts };
      const totalOutSum = Object.values(reasonTotals).reduce((a: number, b: number) => a + b, 0);

      // Bar Chart: Compare Dorm Actual vs Normal Average
      const labels = dorms.map((d) => d.name);
      const actualDormOut = dorms.map((d) => {
        const att = todayAttendance?.[d.id];
        if (att && att.status === "CHECKED" && att.records) {
          return att.records.filter((r) => r.status !== "PRESENT" && r.status !== "ROUND_HOME").length;
        }
        return 0;
      });
      const normalDormOut = dorms.map((d) => processedHistoricalData.dowDormAvgOut[d.id]?.[currentDowIdx] || 0);

      const chartConfig = {
        chartType: "bar" as const,
        isStacked: false,
        labels,
        datasets: [
          {
            label: "ยอดออกตามจริงวันนี้",
            data: actualDormOut,
            backgroundColor: "#A05AFF",
            borderRadius: 6
          },
          {
            label: "ค่าเฉลี่ยปกติ (ย้อนหลัง)",
            data: normalDormOut,
            backgroundColor: "#CBD5E1",
            borderRadius: 6
          }
        ]
      };

      const maxOutVal = Math.max(...actualDormOut, 0);
      const maxOutIdx = actualDormOut.indexOf(maxOutVal);
      const maxDormName = dorms[maxOutIdx]?.name || "หอ 1";

      return {
        reasonTotals,
        totalOutSum,
        chartConfig,
        chartTitle: "เปรียบเทียบสถิตินักเรียนออกหอพักตามจริงรายหอพักกับค่าเฉลี่ยปกติ",
        card1Title: "สาเหตุหลักอันดับ 1 (วันนี้)",
        card2Title: "ยอดออกหอพักรวมวันนี้",
        card3Title: "สาเหตุอันดับ 2 (วันนี้)",
        card4Title: "หอพักที่ออกสูงสุดวันนี้",
        peakText: maxOutVal > 0 ? `${maxDormName} (${maxOutVal} คน)` : "ไม่มีการออกหอ"
      };
    } else if (timeframe === "weekly") {
      // 2. รายสัปดาห์ (7 วัน)
      const mondayDate = new Date(effDt);
      mondayDate.setDate(effDt.getDate() - currentDowIdx);

      const weekDates: string[] = [];
      const weekLabels: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayDate);
        d.setDate(mondayDate.getDate() + i);
        const iso = d.toISOString().split("T")[0];
        weekDates.push(iso);
        const dayNum = d.getDate();
        const monthNum = d.getMonth() + 1;
        weekLabels.push(`${daysName[i]} ${dayNum}/${monthNum}`);
      }

      const homeData: number[] = [];
      const campData: number[] = [];
      const sickData: number[] = [];
      const skillData: number[] = [];
      const exchangeData: number[] = [];
      const otherData: number[] = [];
      const dayTotals: number[] = [];

      weekDates.forEach((dStr) => {
        const rMap = processedHistoricalData.dateReasonMap[dStr] || { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
        homeData.push(rMap["กลับบ้าน"] || 0);
        campData.push(rMap["เข้าค่าย"] || 0);
        sickData.push(rMap["ป่วย"] || 0);
        skillData.push(rMap["แข่งทักษะ"] || 0);
        exchangeData.push(rMap["แลกเปลี่ยน"] || 0);
        otherData.push(rMap["อื่นๆ"] || 0);
        const tot = (Object.values(rMap) as number[]).reduce((a: number, b: number) => a + b, 0);
        dayTotals.push(tot);
      });

      const reasonTotals = {
        "กลับบ้าน": homeData.reduce((a: number, b: number) => a + b, 0),
        "เข้าค่าย": campData.reduce((a: number, b: number) => a + b, 0),
        "ป่วย": sickData.reduce((a: number, b: number) => a + b, 0),
        "แข่งทักษะ": skillData.reduce((a: number, b: number) => a + b, 0),
        "แลกเปลี่ยน": exchangeData.reduce((a: number, b: number) => a + b, 0),
        "อื่นๆ": otherData.reduce((a: number, b: number) => a + b, 0)
      };
      const totalOutSum = (Object.values(reasonTotals) as number[]).reduce((a: number, b: number) => a + b, 0);

      const maxDayVal = Math.max(...dayTotals, 0);
      const maxDayIdx = dayTotals.indexOf(maxDayVal);
      const peakDayText = maxDayVal > 0 ? `${daysName[maxDayIdx]} (${maxDayVal} คน)` : "ไม่มีข้อมูลการออก";

      const chartConfig = {
        chartType: "bar" as const,
        isStacked: true,
        labels: weekLabels,
        datasets: [
          { label: "กลับบ้าน", data: homeData, backgroundColor: "#F59E0B", borderRadius: 4 },
          { label: "เข้าค่าย", data: campData, backgroundColor: "#2563EB", borderRadius: 4 },
          { label: "ป่วย", data: sickData, backgroundColor: "#F43F5E", borderRadius: 4 },
          { label: "แข่งทักษะ", data: skillData, backgroundColor: "#8B5CF6", borderRadius: 4 },
          { label: "แลกเปลี่ยน", data: exchangeData, backgroundColor: "#0EA5E9", borderRadius: 4 },
          { label: "อื่นๆ", data: otherData, backgroundColor: "#64748B", borderRadius: 4 }
        ]
      };

      return {
        reasonTotals,
        totalOutSum,
        chartConfig,
        chartTitle: "กราฟเปรียบเทียบสถิติการออกหอพักแยกตามสาเหตุทั้ง 7 วันประจำสัปดาห์",
        card1Title: "สาเหตุหลักอันดับ 1 (สัปดาห์นี้)",
        card2Title: "ยอดรวมออกหอพัก 7 วัน",
        card3Title: "สาเหตุอันดับ 2 (สัปดาห์นี้)",
        card4Title: "วันพีคออกบ้านสูงสุด",
        peakText: peakDayText
      };
    } else if (timeframe === "monthly") {
      // 3. รายเดือน (4 สัปดาห์)
      const weekLabels = ["สัปดาห์ที่ 1", "สัปดาห์ที่ 2", "สัปดาห์ที่ 3", "สัปดาห์ที่ 4 (ปัจจุบัน)"];

      const endDt = new Date(effDt);
      const weekData = [
        { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 },
        { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 },
        { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 },
        { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 }
      ];

      for (let w = 3; w >= 0; w--) {
        for (let d = 0; d < 7; d++) {
          const checkDt = new Date(endDt);
          checkDt.setDate(endDt.getDate() - ((3 - w) * 7 + d));
          const iso = checkDt.toISOString().split("T")[0];
          const rMap = processedHistoricalData.dateReasonMap[iso];
          if (rMap) {
            Object.keys(weekData[w]).forEach((k) => {
              (weekData[w] as any)[k] += rMap[k] || 0;
            });
          }
        }
      }

      const homeData = weekData.map((w) => w["กลับบ้าน"]);
      const campData = weekData.map((w) => w["เข้าค่าย"]);
      const sickData = weekData.map((w) => w["ป่วย"]);
      const skillData = weekData.map((w) => w["แข่งทักษะ"]);
      const exchangeData = weekData.map((w) => w["แลกเปลี่ยน"]);
      const otherData = weekData.map((w) => w["อื่นๆ"]);

      const reasonTotals = {
        "กลับบ้าน": homeData.reduce((a, b) => a + b, 0),
        "เข้าค่าย": campData.reduce((a, b) => a + b, 0),
        "ป่วย": sickData.reduce((a, b) => a + b, 0),
        "แข่งทักษะ": skillData.reduce((a, b) => a + b, 0),
        "แลกเปลี่ยน": exchangeData.reduce((a, b) => a + b, 0),
        "อื่นๆ": otherData.reduce((a, b) => a + b, 0)
      };
      const totalOutSum = Object.values(reasonTotals).reduce((a, b) => a + b, 0);

      const weekTotals = weekData.map((w) => Object.values(w).reduce((a, b) => a + b, 0));
      const maxWeekVal = Math.max(...weekTotals, 0);
      const maxWeekIdx = weekTotals.indexOf(maxWeekVal);
      const avgWeeklyRate = Math.round(totalOutSum / 4);

      const chartConfig = {
        chartType: "bar" as const,
        isStacked: true,
        labels: weekLabels,
        datasets: [
          { label: "กลับบ้าน", data: homeData, backgroundColor: "#F59E0B", borderRadius: 6 },
          { label: "เข้าค่าย", data: campData, backgroundColor: "#2563EB", borderRadius: 6 },
          { label: "ป่วย", data: sickData, backgroundColor: "#F43F5E", borderRadius: 6 },
          { label: "แข่งทักษะ", data: skillData, backgroundColor: "#8B5CF6", borderRadius: 6 },
          { label: "แลกเปลี่ยน", data: exchangeData, backgroundColor: "#0EA5E9", borderRadius: 6 },
          { label: "อื่นๆ", data: otherData, backgroundColor: "#64748B", borderRadius: 6 }
        ]
      };

      return {
        reasonTotals,
        totalOutSum,
        chartConfig,
        chartTitle: "สรุปยอดรวมและคาดการณ์จำแนกรายสัปดาห์ (4 สัปดาห์)",
        card1Title: "สาเหตุหลักอันดับ 1 (เดือนนี้)",
        card2Title: "ยอดรวมออกหอ 4 สัปดาห์",
        card3Title: "สาเหตุอันดับ 2 (เดือนนี้)",
        card4Title: "อัตราเฉลี่ยต่อสัปดาห์",
        peakText: maxWeekVal > 0 ? `${weekLabels[maxWeekIdx]} (${maxWeekVal} คน) • เฉลี่ย ${avgWeeklyRate} คน/สัปดาห์` : `เฉลี่ย ${avgWeeklyRate} คน/สัปดาห์`
      };
    } else {
      // 4. แนวโน้มภาพรวม (Overall Trends)
      const weekLabels = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
      const homeData: number[] = [];
      const campData: number[] = [];
      const sickData: number[] = [];
      const skillData: number[] = [];
      const exchangeData: number[] = [];
      const otherData: number[] = [];
      const dowTotals: number[] = [];

      for (let i = 0; i < 7; i++) {
        const avgR = processedHistoricalData.dowAvgReasons[i] || { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
        homeData.push(avgR["กลับบ้าน"] || 0);
        campData.push(avgR["เข้าค่าย"] || 0);
        sickData.push(avgR["ป่วย"] || 0);
        skillData.push(avgR["แข่งทักษะ"] || 0);
        exchangeData.push(avgR["แลกเปลี่ยน"] || 0);
        otherData.push(avgR["อื่นๆ"] || 0);
        dowTotals.push((Object.values(avgR) as number[]).reduce((a: number, b: number) => a + b, 0));
      }

      const reasonTotals = { "กลับบ้าน": 0, "เข้าค่าย": 0, "ป่วย": 0, "แข่งทักษะ": 0, "แลกเปลี่ยน": 0, "อื่นๆ": 0 };
      Object.values(processedHistoricalData.dateReasonMap).forEach((rMap) => {
        Object.keys(reasonTotals).forEach((k) => {
          (reasonTotals as any)[k] += rMap[k] || 0;
        });
      });
      const totalOutSum = Object.values(reasonTotals).reduce((a, b) => a + b, 0);

      const maxDowVal = Math.max(...dowTotals, 0);
      const maxDowIdx = dowTotals.indexOf(maxDowVal);
      const peakRateText = maxDowVal > 0 ? `วัน${weekLabels[maxDowIdx]} (Peak Rate ${maxDowVal} คน)` : "ไม่มีสถิติกำหนด";

      const chartConfig = {
        chartType: "bar" as const,
        isStacked: true,
        labels: weekLabels,
        datasets: [
          { label: "กลับบ้าน", data: homeData, backgroundColor: "#F59E0B", borderRadius: 4 },
          { label: "เข้าค่าย", data: campData, backgroundColor: "#2563EB", borderRadius: 4 },
          { label: "ป่วย", data: sickData, backgroundColor: "#F43F5E", borderRadius: 4 },
          { label: "แข่งทักษะ", data: skillData, backgroundColor: "#8B5CF6", borderRadius: 4 },
          { label: "แลกเปลี่ยน", data: exchangeData, backgroundColor: "#0EA5E9", borderRadius: 4 },
          { label: "อื่นๆ", data: otherData, backgroundColor: "#64748B", borderRadius: 4 }
        ]
      };

      return {
        reasonTotals,
        totalOutSum,
        chartConfig,
        chartTitle: "แนวโน้มพฤติกรรมการออกหอพักสะสมตามวันในสัปดาห์ (จันทร์ - อาทิตย์)",
        card1Title: "สาเหตุหลักอันดับ 1 (สะสม)",
        card2Title: "ยอดออกหอสะสมทั้งหมด",
        card3Title: "สาเหตุอันดับ 2 (สะสม)",
        card4Title: "Peak Rate ประจำสัปดาห์",
        peakText: peakRateText
      };
    }
  }, [timeframe, liveReasonCounts, processedHistoricalData, dorms, realtimeDormTotals, effectiveDashboardDate]);

  // Doughnut Chart Data
  const doughnutChartData = useMemo(() => {
    const keys = Object.keys(activeAnalyticsConfig.reasonTotals);
    const values = Object.values(activeAnalyticsConfig.reasonTotals);
    const colors = keys.map((k) => reasonColorMap[k]?.bg || "#94a3b8");

    return {
      labels: keys,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    };
  }, [activeAnalyticsConfig.reasonTotals]);

  // Top Major Reason Analysis
  const topReasonAnalysis = useMemo(() => {
    const entries = (Object.entries(activeAnalyticsConfig.reasonTotals) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const topKey = entries[0]?.[0] || "กลับบ้าน";
    const topCount = entries[0]?.[1] || 0;
    const topPct = activeAnalyticsConfig.totalOutSum > 0 ? ((topCount / activeAnalyticsConfig.totalOutSum) * 100).toFixed(1) : "0.0";

    const secondKey = entries[1]?.[0] || "ป่วย";
    const secondCount = entries[1]?.[1] || 0;
    const secondPct = activeAnalyticsConfig.totalOutSum > 0 ? ((secondCount / activeAnalyticsConfig.totalOutSum) * 100).toFixed(1) : "0.0";

    return {
      topKey,
      topCount,
      topPct,
      secondKey,
      secondCount,
      secondPct,
      rankings: entries
    };
  }, [activeAnalyticsConfig.reasonTotals, activeAnalyticsConfig.totalOutSum]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header & Timeframe Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              สัดส่วนและแนวโน้มสาเหตุการออกหอพัก (4 เงื่อนไข)
            </h3>
          </div>
        </div>

        {/* Timeframe Control Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setTimeframe("today")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              timeframe === "today"
                ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>วันนี้ / ปัจจุบัน</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeframe("weekly")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              timeframe === "weekly"
                ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>รายสัปดาห์ (7 วัน)</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeframe("monthly")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              timeframe === "monthly"
                ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>รายเดือน (4 สัปดาห์)</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeframe("trends")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              timeframe === "trends"
                ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>แนวโน้มภาพรวม</span>
          </button>
        </div>
      </div>

      {/* Highlights / Insight Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Major Reason Card */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-xs relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-15 pointer-events-none">
            <Home className="w-24 h-24" />
          </div>
          <div className="text-[11px] text-purple-100 font-bold flex items-center gap-1 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{activeAnalyticsConfig.card1Title}</span>
          </div>
          <div className="text-xl font-black">{topReasonAnalysis.topKey}</div>
          <div className="mt-2 flex items-baseline justify-between text-xs border-t border-white/20 pt-2">
            <span className="font-medium text-purple-100">คิดเป็นสัดส่วน</span>
            <span className="font-black text-amber-300 text-sm">{topReasonAnalysis.topPct}%</span>
          </div>
          <div className="text-[11px] text-purple-200 mt-0.5">({topReasonAnalysis.topCount} คน)</div>
        </div>

        {/* Total Out Scope Card */}
        <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xs relative overflow-hidden">
          <div className="text-[11px] text-slate-400 font-bold mb-1">
            {activeAnalyticsConfig.card2Title}
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {activeAnalyticsConfig.totalOutSum} <span className="text-xs font-normal text-slate-300">คน</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-800 pt-2 text-slate-300">
            <span>ช่วงเวลาอ้างอิง:</span>
            <span className="font-bold text-slate-200">
              {timeframe === "today" && "วันนี้"}
              {timeframe === "weekly" && "7 วันประจำสัปดาห์"}
              {timeframe === "monthly" && "4 สัปดาห์ล่าสุด"}
              {timeframe === "trends" && "สะสมทั้งหมด"}
            </span>
          </div>
        </div>

        {/* Second Major Reason Card */}
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-rose-950">
          <div className="text-[11px] text-rose-600 font-bold mb-1 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-rose-500" />
            <span>{activeAnalyticsConfig.card3Title}</span>
          </div>
          <div className="text-lg font-black text-rose-900">{topReasonAnalysis.secondKey}</div>
          <div className="mt-2 flex items-baseline justify-between text-xs border-t border-rose-200/60 pt-2">
            <span className="font-medium text-rose-700">สัดส่วน</span>
            <span className="font-bold text-rose-900 text-sm">{topReasonAnalysis.secondPct}%</span>
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">({topReasonAnalysis.secondCount} คน)</div>
        </div>

        {/* Peak Timing / Rate Card */}
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-teal-950 flex flex-col justify-between">
          <div>
            <div className="text-[11px] text-teal-700 font-bold mb-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-600" />
              <span>{activeAnalyticsConfig.card4Title}</span>
            </div>
            <div className="text-sm font-black text-teal-900 leading-snug">{activeAnalyticsConfig.peakText}</div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Doughnut Breakdown Chart */}
        <div className="lg:col-span-5 bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>
                สัดส่วนสาเหตุ ({timeframe === "today" ? "วันนี้" : timeframe === "weekly" ? "รายสัปดาห์" : timeframe === "monthly" ? "รายเดือน" : "แนวโน้มภาพรวม"})
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mb-4">
              สัดส่วนนักเรียนออกหอพักจำแนกตามประเภทเหตุผล
            </p>
          </div>

          <div className="h-56 my-2 flex items-center justify-center relative">
            {activeAnalyticsConfig.totalOutSum > 0 ? (
              <Doughnut
                data={doughnutChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        boxWidth: 10,
                        font: { family: "Sarabun, sans-serif", size: 11 },
                        padding: 12
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <span>นักเรียนอยู่หอครบทุกคน ไม่มีสถิติการออกหอพัก</span>
              </div>
            )}
          </div>

          {/* Detailed Progress Bars */}
          <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
            {topReasonAnalysis.rankings.map(([reason, count]) => {
              const pct = activeAnalyticsConfig.totalOutSum > 0 ? Math.round((count / activeAnalyticsConfig.totalOutSum) * 100) : 0;
              const meta = reasonColorMap[reason] || reasonColorMap["อื่นๆ"];
              const IconComp = meta.icon;

              return (
                <div key={reason} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.bg }} />
                      <IconComp className="w-3.5 h-3.5 text-slate-500" />
                      <span>{reason}</span>
                    </span>
                    <span className="text-slate-900 font-extrabold">
                      {count} คน <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: meta.bg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Bar Chart */}
        <div className="lg:col-span-7 bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <span>{activeAnalyticsConfig.chartTitle}</span>
              </h4>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                {activeAnalyticsConfig.chartConfig.isStacked ? "Stacked Bar" : "Comparative Bar"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              แสดงผลเปรียบเทียบสถิติตามเงื่อนไขที่เลือก
            </p>
          </div>

          <div className="h-72 my-1">
            <Bar
              data={{
                labels: activeAnalyticsConfig.chartConfig.labels,
                datasets: activeAnalyticsConfig.chartConfig.datasets
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                    labels: { boxWidth: 10, font: { family: "Sarabun, sans-serif", size: 11 } }
                  }
                },
                scales: {
                  x: {
                    stacked: activeAnalyticsConfig.chartConfig.isStacked,
                    grid: { display: false },
                    ticks: { font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" } }
                  },
                  y: {
                    stacked: activeAnalyticsConfig.chartConfig.isStacked,
                    beginAtZero: true,
                    grid: { color: "#e2e8f0" },
                    ticks: { font: { family: "Sarabun, sans-serif", size: 11 } }
                  }
                }
              }}
            />
          </div>

          {/* Analytics Summary Insight Box */}
          <div className="mt-3 p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-indigo-900 block">
                บทวิเคราะห์สถิติสาเหตุการออกหอพัก:
              </span>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                {activeAnalyticsConfig.totalOutSum > 0 ? (
                  <>
                    จากข้อมูลจริงในระบบ สถิติการออกหอพักหลักมาจากสาเหตุ <strong className="text-indigo-950">"{topReasonAnalysis.topKey}"</strong> จำนวน <strong className="text-indigo-950">{topReasonAnalysis.topCount} คน</strong> คิดเป็นสัดส่วน <strong className="text-indigo-950">{topReasonAnalysis.topPct}%</strong> ของการลารวมทั้งหมด ({activeAnalyticsConfig.totalOutSum} คน)
                  </>
                ) : (
                  <>
                    ขณะนี้ในฐานข้อมูลยังไม่มีการบันทึกการออกหอพักหรือการลาของนักเรียน (นักเรียนอยู่หอพักครบทุกคน)
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
