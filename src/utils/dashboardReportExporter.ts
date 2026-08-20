import { SystemSettings } from "../types";
import { formatThaiFullDate, formatThaiMonthYear } from "./dateUtils";

export interface DashboardReportExportData {
  periodType: "daily" | "weekly" | "monthly";
  periodTitle: string;
  dateRangeText: string;
  filterDormName: string;
  filterGradeName: string;
  systemSettings: SystemSettings;
  kpis: {
    totalStudents: number;
    maleStudents: number;
    femaleStudents: number;
    avgPresent: number;
    avgOut: number;
    attendanceRate: number;
    totalAbsenceRecords: number;
    checkInCompletionRate: number;
    totalDorms: number;
  };
  reasonStats: Array<{
    status: string;
    label: string;
    count: number;
    percent: number;
    color: string;
  }>;
  dormStats: Array<{
    dormId: string;
    dormName: string;
    type: string;
    capacity: number;
    studentCount: number;
    presentCount: number;
    outCount: number;
    occupancyRate: number;
    checkedDays: number;
  }>;
  gradeStats: Array<{
    grade: string;
    total: number;
    male: number;
    female: number;
    present: number;
    out: number;
    rate: number;
  }>;
  dailyTimeline: Array<{
    date: string;
    displayDate: string;
    dayName: string;
    present: number;
    out: number;
    total: number;
    rate: number;
    subText?: string;
  }>;
  absentList: Array<{
    date: string;
    studentId: string;
    fullName: string;
    gradeRoom: string;
    dormName: string;
    reason: string;
    statusLabel: string;
  }>;
  insights: string[];
  signatories?: {
    creator: string;
    headTeacher: string;
    deputyDirector: string;
  };
}

/**
 * Generates and downloads a standalone, beautifully styled HTML/CSS dashboard report.
 * Supports A4 portrait printing and instant viewing with rich vector charts.
 */
export function exportDashboardReportHtml(
  data: DashboardReportExportData,
  fileName: string = "รายงานแดชบอร์ดวิเคราะห์สถิติหอพัก.html"
): void {
  const {
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
    insights
  } = data;

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";
  const systemTitle = systemSettings?.systemTitleTh || "ระบบบริหารจัดการหอพักนักเรียน";

  // Build timeline bar chart in pure SVG
  const isMonthlyMode = periodTitle.includes("เดือน");
  const maxTimelineTotal = Math.max(...dailyTimeline.map((d) => d.total || 1), 1);
  const stepX = 72;
  const timelineSvgBars = dailyTimeline.map((item, idx) => {
    const presentH = Math.round((item.present / maxTimelineTotal) * 85);
    const outH = Math.min(85, Math.max(item.out > 0 ? 5 : 0, Math.round((item.out / maxTimelineTotal) * 85)));
    const x = 30 + idx * stepX;
    return `
      <g class="bar-group">
        <text x="${x + 20}" y="123" text-anchor="middle" font-size="8.5" fill="#64748b" font-weight="600">${item.displayDate}</text>
        <text x="${x + 20}" y="137" text-anchor="middle" font-size="9" fill="#6b21a8" font-weight="700">${item.dayName}</text>
        
        <!-- Out Bar (Red/Orange) -->
        <rect x="${x + 5}" y="${105 - outH}" width="13" height="${outH}" fill="#f43f5e" rx="3" />
        <text x="${x + 11}" y="${Math.max(100 - outH, 14)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#e11d48">${item.out > 0 ? item.out : ""}</text>
        
        <!-- Present Bar (Emerald/Purple) -->
        <rect x="${x + 22}" y="${105 - presentH}" width="13" height="${presentH}" fill="#10b981" rx="3" />
        <text x="${x + 28}" y="${Math.max(100 - presentH, 14)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#047857">${item.present > 0 ? item.present : ""}</text>
      </g>
    `;
  }).join("");

  const timelineSvgWidth = Math.max(540, 50 + dailyTimeline.length * stepX);

  // Build reason breakdown rows
  const reasonRowsHtml = reasonStats.map((r) => `
    <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${r.color};"></span>
        <span class="font-semibold text-slate-700">${r.label}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-bold text-slate-900">${r.count} คน</span>
        <span class="text-[11px] font-semibold text-slate-500 w-12 text-right">${r.percent.toFixed(1)}%</span>
      </div>
    </div>
  `).join("");

  // Build dorm table rows
  const dormTableRowsHtml = dormStats.map((d, i) => `
    <tr class="${i % 2 === 0 ? "bg-white" : "bg-slate-50/70"} hover:bg-purple-50/50">
      <td class="py-2 px-3 font-bold text-slate-800 border-r border-slate-200">${d.dormName}</td>
      <td class="py-2 px-3 text-center text-slate-600 border-r border-slate-200 font-medium">
        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${d.type === "male" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}">
          ${d.type === "male" ? "ชาย" : d.type === "female" ? "หญิง" : "รวม"}
        </span>
      </td>
      <td class="py-2 px-3 text-center font-bold text-slate-700 border-r border-slate-200">${d.capacity}</td>
      <td class="py-2 px-3 text-center font-bold text-slate-900 border-r border-slate-200">${d.studentCount}</td>
      <td class="py-2 px-3 text-center font-bold text-emerald-700 border-r border-slate-200">${d.presentCount}</td>
      <td class="py-2 px-3 text-center font-bold text-rose-600 border-r border-slate-200">${d.outCount}</td>
      <td class="py-2 px-3 text-center border-r border-slate-200">
        <div class="flex items-center justify-center gap-1.5">
          <div class="w-12 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full" style="width: ${Math.min(d.occupancyRate, 100)}%;"></div>
          </div>
          <span class="font-extrabold text-xs text-slate-800">${d.occupancyRate.toFixed(1)}%</span>
        </div>
      </td>
      <td class="py-2 px-3 text-center text-xs font-semibold text-slate-600">${d.checkedDays} วัน</td>
    </tr>
  `).join("");

  // Build grade table rows
  const gradeTableRowsHtml = gradeStats.map((g, i) => `
    <tr class="${i % 2 === 0 ? "bg-white" : "bg-slate-50/70"}">
      <td class="py-2 px-3 font-bold text-slate-800 border-r border-slate-200">${g.grade}</td>
      <td class="py-2 px-3 text-center font-semibold text-blue-700 border-r border-slate-200">${g.male}</td>
      <td class="py-2 px-3 text-center font-semibold text-pink-700 border-r border-slate-200">${g.female}</td>
      <td class="py-2 px-3 text-center font-bold text-slate-900 border-r border-slate-200">${g.total}</td>
      <td class="py-2 px-3 text-center font-bold text-emerald-700 border-r border-slate-200">${g.present}</td>
      <td class="py-2 px-3 text-center font-bold text-rose-600 border-r border-slate-200">${g.out}</td>
      <td class="py-2 px-3 text-center font-extrabold text-xs text-purple-700">${g.rate.toFixed(1)}%</td>
    </tr>
  `).join("");

  // Build insights list
  const insightsHtml = insights.map((item) => `
    <li class="flex items-start gap-2 text-xs text-slate-700">
      <span class="text-purple-600 font-bold mt-0.5">•</span>
      <span>${item}</span>
    </li>
  `).join("");

  // Build absent list rows (up to 30 items)
  const absentRowsHtml = absentList.length === 0 ? `
    <tr>
      <td colspan="7" class="py-4 text-center text-slate-400 text-xs font-medium">
        ไม่มีข้อมูลนักเรียนออกหอพักในช่วงเวลานี้ (นักเรียนอยู่ครบทุกคน)
      </td>
    </tr>
  ` : absentList.slice(0, 35).map((a, i) => `
    <tr class="${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} text-xs">
      <td class="py-1.5 px-2.5 text-center font-medium text-slate-500 border-r border-slate-200">${i + 1}</td>
      <td class="py-1.5 px-2.5 text-center font-medium text-slate-700 border-r border-slate-200">${a.date}</td>
      <td class="py-1.5 px-2.5 font-mono font-bold text-slate-800 border-r border-slate-200">${a.studentId}</td>
      <td class="py-1.5 px-2.5 font-bold text-slate-900 border-r border-slate-200">${a.fullName}</td>
      <td class="py-1.5 px-2.5 text-center text-slate-700 border-r border-slate-200">${a.gradeRoom}</td>
      <td class="py-1.5 px-2.5 text-center text-purple-700 font-semibold border-r border-slate-200">${a.dormName}</td>
      <td class="py-1.5 px-2.5 font-bold text-rose-600">${a.reason || a.statusLabel}</td>
    </tr>
  `).join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName.replace(".html", "")}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', sans-serif;
      background-color: #0f172a;
      margin: 0;
      padding: 0;
      color: #0f172a;
    }
    @media screen {
      .screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .page-wrapper {
        padding: 24px 16px 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }
      .report-page {
        width: 210mm;
        max-width: 100%;
        min-height: 297mm;
        background: #ffffff;
        padding: 28px 32px;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35);
      }
    }
    @media print {
      .screen-toolbar {
        display: none !important;
      }
      body {
        background: white !important;
        padding: 0 !important;
      }
      .page-wrapper {
        padding: 0 !important;
        display: block !important;
      }
      .report-page {
        width: 100% !important;
        min-height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        page-break-after: always;
        break-after: page;
      }
      .report-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    thead {
      display: table-header-group;
    }
    tbody tr, .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <!-- Top Screen Toolbar -->
  <div class="screen-toolbar">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
        📊
      </div>
      <div>
        <h1 class="text-white text-sm font-bold leading-tight">รายงานแดชบอร์ดวิเคราะห์สถิติหอพัก (${periodTitle})</h1>
        <p class="text-slate-400 text-xs font-normal">${dateRangeText} • ${schoolName}</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button
        onclick="window.print()"
        class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>พิมพ์รายงาน / บันทึก PDF (A4)</span>
      </button>
    </div>
  </div>

  <!-- Page Wrapper -->
  <div class="page-wrapper">
    <!-- PAGE 1: Overview Dashboard & Statistical Breakdown -->
    <div class="report-page">
      <!-- Report Header -->
      <div class="border-b-2 border-purple-600 pb-3 mb-4">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-extrabold uppercase mb-1">
          <span>Dormitory Statistical & Analytics Dashboard</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight">รายงานวิเคราะห์สถิติ & สรุปข้อมูลหอพักนักเรียน</h1>
        <p class="text-sm text-purple-800 font-bold mt-1">${periodTitle}</p>
        <p class="text-[11px] text-slate-500 font-medium mt-0.5">${schoolName} • ${systemTitle}</p>
      </div>

      <!-- KPI Executive Summary Cards (4 Cards Grid) -->
      <div class="grid grid-cols-4 gap-2.5 mb-4">
        <div class="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
          <div class="text-[11px] font-bold text-purple-900">นักเรียนทั้งหมดในระบบ</div>
          <div class="text-2xl font-black text-purple-700 mt-0.5">${kpis.totalStudents} <span class="text-xs font-semibold text-purple-500">คน</span></div>
          <div class="text-[10px] text-purple-600 font-medium mt-0.5">ชาย ${kpis.maleStudents} • หญิง ${kpis.femaleStudents} คน</div>
        </div>

        <div class="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
          <div class="text-[11px] font-bold text-emerald-900">ยอดนักเรียนอยู่หอพักเฉลี่ย</div>
          <div class="text-2xl font-black text-emerald-700 mt-0.5">${kpis.avgPresent} <span class="text-xs font-semibold text-emerald-500">คน</span></div>
          <div class="text-[10px] text-emerald-600 font-medium mt-0.5">คิดเป็น ${(100 - (kpis.totalStudents > 0 ? (kpis.avgOut / kpis.totalStudents) * 100 : 0)).toFixed(1)}% ของยอดรวม</div>
        </div>

        <div class="p-3 bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-xl">
          <div class="text-[11px] font-bold text-rose-900">ยอดออกหอพักเฉลี่ย</div>
          <div class="text-2xl font-black text-rose-600 mt-0.5">${kpis.avgOut} <span class="text-xs font-semibold text-rose-400">คน</span></div>
          <div class="text-[10px] text-rose-500 font-medium mt-0.5">บันทึกสะสม ${kpis.totalAbsenceRecords} รายการ</div>
        </div>

        <div class="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
          <div class="text-[11px] font-bold text-amber-900">อัตราการเข้าพักเฉลี่ย</div>
          <div class="text-2xl font-black text-amber-700 mt-0.5">${kpis.attendanceRate.toFixed(1)}%</div>
          <div class="text-[10px] text-amber-600 font-medium mt-0.5">ความครบถ้วนเช็คชื่อ ${kpis.checkInCompletionRate.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Charts & Visual Section (2 Columns) -->
      <div class="grid grid-cols-12 gap-3 mb-4">
        <!-- Daily Timeline Trend Chart (7 cols) -->
        <div class="col-span-7 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs font-bold text-slate-800">📊 แนวโน้มการอยู่หอพักเทียบกับการออกหอพัก ${periodTitle.includes("เดือน") ? "(รวมวันจันทร์ - อาทิตย์)" : `(${periodTitle})`}</h2>
            <div class="flex items-center gap-2 text-[10px]">
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span> อยู่หอ</span>
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-rose-500 rounded-xs"></span> ออกหอ</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <svg viewBox="0 0 ${timelineSvgWidth} 145" class="w-full h-36">
              <!-- Background Grid Lines -->
              <line x1="20" y1="105" x2="${timelineSvgWidth - 10}" y2="105" stroke="#cbd5e1" stroke-width="1" />
              <line x1="20" y1="60" x2="${timelineSvgWidth - 10}" y2="60" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1" />
              <line x1="20" y1="15" x2="${timelineSvgWidth - 10}" y2="15" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1" />
              ${timelineSvgBars}
            </svg>
          </div>
        </div>

        <!-- Reason Breakdown (5 cols) -->
        <div class="col-span-5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
          <div>
            <h2 class="text-xs font-bold text-slate-800 mb-2">🎯 สัดส่วนจำแนกตามสาเหตุการออกหอพัก</h2>
            <div class="space-y-1">
              ${reasonRowsHtml}
            </div>
          </div>
          <div class="text-[10px] text-slate-400 text-right mt-2">
            รวมรายการออกหอพัก: <strong>${kpis.totalAbsenceRecords}</strong> คน-ครั้ง
          </div>
        </div>
      </div>

      <!-- Table: Dormitory Summary Matrix -->
      <div class="mb-4">
        <h2 class="text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
          <span>🏢 สรุปสถิติข้อมูลแยกตามหอพัก (Dormitory Breakdown)</span>
          <span class="text-[10px] text-slate-500 font-normal">เรียงตามหมายเลขหอพัก 1 - 6</span>
        </h2>
        <table class="text-xs border border-slate-300 rounded-lg overflow-hidden">
          <thead class="bg-purple-700 text-white font-bold">
            <tr>
              <th class="py-2 px-3 text-left border-r border-purple-600">ชื่อหอพัก</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-16">ประเภท</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-16">ความจุ</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-20">นักเรียนรวม</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-20">อยู่เฉลี่ย</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-20">ออกเฉลี่ย</th>
              <th class="py-2 px-3 text-center border-r border-purple-600 w-28">อัตราการเข้าพัก</th>
              <th class="py-2 px-3 text-center w-20">เช็คชื่อ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${dormTableRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Table: Grade Level Matrix -->
      <div class="mb-4">
        <h2 class="text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
          <span>🎓 สรุปสถิติข้อมูลแยกตามระดับชั้น (Grade Breakdown)</span>
          <span class="text-[10px] text-slate-500 font-normal">มัธยมศึกษาปีที่ 1 - 6</span>
        </h2>
        <table class="text-xs border border-slate-300 rounded-lg overflow-hidden">
          <thead class="bg-slate-800 text-white font-bold">
            <tr>
              <th class="py-2 px-3 text-left border-r border-slate-700">ระดับชั้น</th>
              <th class="py-2 px-3 text-center border-r border-slate-700 w-16">ชาย</th>
              <th class="py-2 px-3 text-center border-r border-slate-700 w-16">หญิง</th>
              <th class="py-2 px-3 text-center border-r border-slate-700 w-20">รวม</th>
              <th class="py-2 px-3 text-center border-r border-slate-700 w-24">อยู่เฉลี่ย</th>
              <th class="py-2 px-3 text-center border-r border-slate-700 w-24">ออกเฉลี่ย</th>
              <th class="py-2 px-3 text-center w-28">อัตราการอยู่หอพัก</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${gradeTableRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Automated Insights & Observations -->
      <div class="p-3 bg-purple-50/70 border border-purple-200 rounded-xl mb-4">
        <h2 class="text-xs font-bold text-purple-900 mb-1.5 flex items-center gap-1.5">
          <span>💡 บทวิเคราะห์และข้อค้นพบจากข้อมูล (Automated Insights)</span>
        </h2>
        <ul class="space-y-1">
          ${insightsHtml}
        </ul>
      </div>
    </div>

    <!-- PAGE 2: Detailed Absence Records Log (If there are absent students) -->
    ${absentList.length > 0 ? `
    <div class="report-page">
      <div class="border-b border-slate-300 pb-2 mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-base font-black text-slate-900">บัญชีรายชื่อนักเรียนที่มีการออกหอพัก (${periodTitle})</h2>
          <p class="text-xs text-purple-700 font-bold">${dateRangeText}</p>
        </div>
        <div class="text-right text-xs text-slate-500">
          แสดงรายการ <strong class="text-slate-900">${Math.min(absentList.length, 35)}</strong> จากทั้งหมด <strong>${absentList.length}</strong> รายการ
        </div>
      </div>

      <table class="text-xs border border-slate-300 rounded-lg overflow-hidden mb-6">
        <thead class="bg-pink-700 text-white font-bold">
          <tr>
            <th class="py-2 px-2.5 text-center border-r border-pink-600 w-10">ที่</th>
            <th class="py-2 px-2.5 text-center border-r border-pink-600 w-24">วันที่</th>
            <th class="py-2 px-2.5 text-center border-r border-pink-600 w-24">รหัสนักเรียน</th>
            <th class="py-2 px-2.5 text-left border-r border-pink-600">ชื่อ - นามสกุล</th>
            <th class="py-2 px-2.5 text-center border-r border-pink-600 w-24">ชั้น/ห้อง</th>
            <th class="py-2 px-2.5 text-center border-r border-pink-600 w-28">หอพัก</th>
            <th class="py-2 px-2.5 text-left w-36">เหตุผล/สถานะ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${absentRowsHtml}
        </tbody>
      </table>

      <div class="text-[11px] text-slate-500 text-right">
        เอกสารแนบท้ายรายงานแดชบอร์ดสถิติหอพัก • ${schoolName}
      </div>
    </div>
    ` : ""}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
