import { SystemSettings, UserProfile } from "../types";
import { formatThaiFullDate } from "./dateUtils";

export interface DormitorySummaryExportData {
  dormId: string;
  dormName: string;
  dormType: "male" | "female" | "all";
  reportDate: string;
  dateText: string;
  systemSettings: SystemSettings;
  currentUser?: UserProfile | null;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  presentCount: number;
  presentPercent: number;
  outCount: number;
  outPercent: number;
  reasons: Array<{
    index: number;
    label: string;
    count: number;
    percentOfOut: number;
    percentOfTotal: number;
    color: string;
  }>;
  gradeStats: Array<{
    grade: string;
    male: number;
    female: number;
    total: number;
    present: number;
    out: number;
    rate: number;
  }>;
  absentList: Array<{
    index: number;
    studentNo?: number;
    studentId: string;
    fullName: string;
    gradeRoom: string;
    reason: string;
    statusLabel: string;
  }>;
  isHomeBreak?: boolean;
  orientationNotes?: string;
}

export function generateDormitorySummaryHtml(data: DormitorySummaryExportData): string {
  const {
    dormName,
    dormType,
    dateText,
    systemSettings,
    currentUser,
    totalStudents,
    maleStudents,
    femaleStudents,
    presentCount,
    presentPercent,
    outCount,
    outPercent,
    reasons,
    gradeStats,
    absentList,
    isHomeBreak,
    orientationNotes
  } = data;

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";
  const systemTitle = systemSettings?.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน";
  const logoUrl = systemSettings?.schoolLogoUrl;

  const reasonListHtml = reasons.length > 0
    ? reasons.map((r) => `
        <div class="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-black text-[10px] flex items-center justify-center">${r.index}</span>
            <span class="font-bold text-slate-800">${r.label}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-extrabold text-slate-900">${r.count} <span class="font-normal text-slate-500 text-[11px]">คน</span></span>
            <span class="text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">คิดเป็นร้อยละ ${r.percentOfTotal.toFixed(1)}%</span>
          </div>
        </div>
      `).join("")
    : `<div class="text-xs text-slate-400 py-2 italic text-center">ไม่มีนักเรียนออกหอพักในวันที่สรุปยอด</div>`;

  const gradeTableRows = gradeStats.map((g, idx) => `
    <tr class="${idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}">
      <td class="py-1.5 px-3 font-bold text-slate-800 border-r border-slate-200">${g.grade}</td>
      <td class="py-1.5 px-2.5 text-center text-blue-700 font-semibold border-r border-slate-200">${g.male}</td>
      <td class="py-1.5 px-2.5 text-center text-pink-700 font-semibold border-r border-slate-200">${g.female}</td>
      <td class="py-1.5 px-2.5 text-center font-bold text-slate-900 border-r border-slate-200">${g.total}</td>
      <td class="py-1.5 px-2.5 text-center font-bold text-emerald-700 border-r border-slate-200">${g.present}</td>
      <td class="py-1.5 px-2.5 text-center font-bold text-rose-600 border-r border-slate-200">${g.out}</td>
      <td class="py-1.5 px-2.5 text-center font-extrabold text-purple-700">${g.rate.toFixed(0)}%</td>
    </tr>
  `).join("");

  const absentListRows = absentList.map((st) => `
    <tr class="hover:bg-slate-50 text-xs">
      <td class="py-2 px-2.5 text-center font-semibold text-slate-500 border-r border-slate-200">${st.index}</td>
      <td class="py-2 px-2.5 text-center font-semibold text-slate-600 border-r border-slate-200">${st.studentNo ?? "-"}</td>
      <td class="py-2 px-2.5 text-center font-mono font-bold text-purple-900 border-r border-slate-200">${st.studentId}</td>
      <td class="py-2 px-3 font-bold text-slate-900 border-r border-slate-200">${st.fullName}</td>
      <td class="py-2 px-2.5 text-center text-slate-700 border-r border-slate-200">${st.gradeRoom}</td>
      <td class="py-2 px-3 font-medium text-slate-800 border-r border-slate-200">${st.reason}</td>
      <td class="py-2 px-2.5 text-center">
        <span class="inline-block px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          ${st.statusLabel}
        </span>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>รายงานสรุปรายหอพัก_${dormName}_${data.reportDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-page {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 14mm 16mm;
      margin: 10mm auto;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
      border-radius: 4px;
    }
    @media print {
      body { background: white; margin: 0; padding: 0; }
      .report-page {
        width: 100%;
        min-height: 100vh;
        margin: 0;
        padding: 10mm 12mm;
        box-shadow: none;
        page-break-after: always;
        border-radius: 0;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="p-4 sm:p-8">
  <!-- Print Controls Bar -->
  <div class="no-print max-w-[210mm] mx-auto mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
      <div>
        <h4 class="text-sm font-bold text-slate-800">รายงานสรุปรายหอพัก (${dormName})</h4>
        <p class="text-xs text-slate-500">พร้อมสำหรับการพิมพ์กระดาษ A4 หรือบันทึกเป็น PDF</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="window.print()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow cursor-pointer transition">
        🖨️ สั่งพิมพ์เอกสาร (Print / PDF)
      </button>
      <button onclick="window.close()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer">
        ปิดหน้าต่าง
      </button>
    </div>
  </div>

  <!-- A4 Printable Sheet -->
  <div class="report-page">
    <!-- Header -->
    <div class="border-b-2 border-purple-600 pb-3 mb-4 flex items-start gap-4">
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="w-14 h-14 object-contain shrink-0" />` : ""}
      <div class="flex-1">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-extrabold uppercase mb-1">
          <span>Dormitory Daily Summary Report</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 tracking-tight">รายงานสรุปรายหอพัก (${dormName})</h1>
        <p class="text-sm text-purple-800 font-bold mt-0.5">ประจำวัน: ${dateText}</p>
        <p class="text-[11px] text-slate-500 font-medium">${schoolName} • ${systemTitle}</p>
      </div>
      <div class="text-right text-xs">
        <div class="px-2.5 py-1 rounded-md text-[11px] font-extrabold ${dormType === "male" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"} inline-block">
          ${dormType === "male" ? "หอพักนักเรียนชาย" : dormType === "female" ? "หอพักนักเรียนหญิง" : "หอพักนักเรียน"}
        </div>
        ${currentUser ? `<div class="text-[10px] text-slate-400 mt-1">ผู้จัดทำ: ${currentUser.name}</div>` : ""}
      </div>
    </div>

    <!-- Main Summary Block: ตามรูปแบบที่ต้องการ -->
    <div class="bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/50 border border-purple-200 rounded-2xl p-6 mb-6 shadow-xs">
      <div class="text-sm font-black text-purple-950 mb-4 flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-purple-600"></span>
        <span>รายละเอียดสรุปยอดประจำวันของ ${dormName}</span>
      </div>

      <!-- Section 1: ข้อมูลนักเรียนในหอพัก -->
      <div class="space-y-2.5 text-xs text-slate-800 pb-4 border-b border-purple-200/80">
        <div class="flex items-center justify-between font-black text-sm text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-purple-100 shadow-2xs">
          <span class="flex items-center gap-2">
            <span>นักเรียนในหอพัก</span>
          </span>
          <span class="text-purple-700 font-black text-base">${totalStudents} <span class="text-xs font-normal text-slate-500">คน</span></span>
        </div>
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <div class="flex items-center justify-between px-4 py-2 rounded-xl bg-blue-50/80 border border-blue-100">
            <span class="flex items-center gap-1.5 text-blue-950 font-bold">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>นักเรียนชาย จำนวน</span>
            </span>
            <span class="font-black text-blue-800">${maleStudents} <span class="text-[11px] font-normal text-blue-600">คน</span></span>
          </div>
          <div class="flex items-center justify-between px-4 py-2 rounded-xl bg-pink-50/80 border border-pink-100">
            <span class="flex items-center gap-1.5 text-pink-950 font-bold">
              <span class="w-2 h-2 rounded-full bg-pink-500"></span>
              <span>นักเรียนหญิง จำนวน</span>
            </span>
            <span class="font-black text-pink-800">${femaleStudents} <span class="text-[11px] font-normal text-pink-600">คน</span></span>
          </div>
        </div>
      </div>

      <!-- Section 2: นักเรียนอยู่หอพัก / ออกหอพัก -->
      <div class="space-y-2.5 text-xs text-slate-800 py-4 border-b border-purple-200/80">
        <div class="flex items-center justify-between bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200">
          <span class="font-extrabold text-emerald-950 text-sm">นักเรียนอยู่หอพัก จำนวน</span>
          <div class="flex items-center gap-3">
            <span class="font-black text-emerald-800 text-base">${presentCount} <span class="text-xs font-normal text-emerald-600">คน</span></span>
            <span class="text-xs font-black text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-300">คิดเป็นร้อยละ ${presentPercent.toFixed(1)}%</span>
          </div>
        </div>
        <div class="flex items-center justify-between bg-rose-50 px-4 py-3 rounded-xl border border-rose-200">
          <span class="font-extrabold text-rose-950 text-sm">นักเรียนออกหอพัก จำนวน</span>
          <div class="flex items-center gap-3">
            <span class="font-black text-rose-800 text-base">${outCount} <span class="text-xs font-normal text-rose-600">คน</span></span>
            <span class="text-xs font-black text-rose-800 bg-rose-100/90 px-2.5 py-1 rounded-lg border border-rose-300">คิดเป็นร้อยละ ${outPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <!-- Section 3: สาเหตุที่ออกหอพัก -->
      <div class="pt-4">
        <div class="font-black text-slate-900 text-xs mb-3 px-1">สาเหตุที่ออกหอพัก (รวม ${outCount} คน)</div>
        <div class="space-y-2">
          ${reasonListHtml}
        </div>
      </div>
    </div>

    <!-- Section 4: ตารางสถิติแยกตามระดับชั้น (ม.1 - ม.6) -->
    <div class="mb-5">
      <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span>สรุปสถิติข้อมูลแยกตามระดับชั้นภายใน ${dormName}</span>
      </h3>
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
            <tr>
              <th class="py-2 px-3 border-r border-slate-200">ระดับชั้น</th>
              <th class="py-2 px-2.5 text-center border-r border-slate-200">ชาย</th>
              <th class="py-2 px-2.5 text-center border-r border-slate-200">หญิง</th>
              <th class="py-2 px-2.5 text-center border-r border-slate-200">รวม</th>
              <th class="py-2 px-2.5 text-center border-r border-slate-200">อยู่</th>
              <th class="py-2 px-2.5 text-center border-r border-slate-200">ออก</th>
              <th class="py-2 px-2.5 text-center">ร้อยละ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${gradeTableRows}
          </tbody>
          <tfoot class="bg-slate-100 font-bold border-t border-slate-200">
            <tr>
              <td class="py-2 px-3 font-black text-slate-900 border-r border-slate-200">รวมทั้งหมด</td>
              <td class="py-2 px-2.5 text-center font-bold text-blue-800 border-r border-slate-200">${maleStudents}</td>
              <td class="py-2 px-2.5 text-center font-bold text-pink-800 border-r border-slate-200">${femaleStudents}</td>
              <td class="py-2 px-2.5 text-center font-black text-slate-900 border-r border-slate-200">${totalStudents}</td>
              <td class="py-2 px-2.5 text-center font-black text-emerald-800 border-r border-slate-200">${presentCount}</td>
              <td class="py-2 px-2.5 text-center font-black text-rose-700 border-r border-slate-200">${outCount}</td>
              <td class="py-2 px-2.5 text-center font-black text-purple-800">${presentPercent.toFixed(0)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Section 5: รายชื่อนักเรียนที่ออกหอพัก (ถ้ามี) -->
    ${absentList.length > 0 ? `
      <div>
        <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>บัญชีรายชื่อนักเรียนที่มีการออกหอพัก (${absentList.length} คน)</span>
        </h3>
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th class="py-2 px-2.5 text-center border-r border-slate-200 w-10">ลำดับ</th>
                <th class="py-2 px-2.5 text-center border-r border-slate-200 w-12">เลขที่</th>
                <th class="py-2 px-2.5 text-center border-r border-slate-200 w-20">รหัสนักเรียน</th>
                <th class="py-2 px-3 border-r border-slate-200">ชื่อ - สกุล</th>
                <th class="py-2 px-2.5 text-center border-r border-slate-200 w-24">ชั้น/ห้อง</th>
                <th class="py-2 px-3 border-r border-slate-200">สาเหตุการออกหอพัก</th>
                <th class="py-2 px-2.5 text-center w-24">สถานะ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${absentListRows}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs font-bold text-emerald-800">
        ✓ นักเรียนในหอพักอยู่ครบทุกคน (ไม่มีรายการออกหอพักในวันที่เลือก)
      </div>
    `}
  </div>
</body>
</html>`;
}

export function exportDormitoryReportHtmlDocument(data: DormitorySummaryExportData) {
  const htmlContent = generateDormitorySummaryHtml(data);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWin = window.open(url, "_blank");
  if (printWin) {
    printWin.focus();
  } else {
    // If pop-up blocked, trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = `รายงานสรุปรายหอพัก_${data.dormName}_${data.reportDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
