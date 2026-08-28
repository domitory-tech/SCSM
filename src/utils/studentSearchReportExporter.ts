import { Dormitory, Student, SystemSettings, UserProfile, AttendanceStatus } from "../types";
import { formatThaiFullDate, formatThaiMediumDate, getTodayDateString, formatGradeRoomShort, detectStudentGender } from "./dateUtils";
import { StudentLeaveEvent, SearchConditionMode } from "../components/students/StudentSearchView";

export interface StudentSearchReportData {
  title: string;
  mode: SearchConditionMode;
  students: Array<{
    student: Student;
    dormName: string;
    currentStatus: {
      status: AttendanceStatus;
      isOut: boolean;
      label: string;
      reason?: string;
      date: string;
    };
    leaveCount: number;
    allLeaveCount: number;
    latestLeaveDate?: string;
    latestLeaveReason?: string;
    latestLeaveStatusLabel?: string;
  }>;
  dormName: string;
  gradeFilter: string;
  startDate: string;
  endDate: string;
  stats: {
    total: number;
    currentlyIn: number;
    currentlyOut: number;
    totalLeavesInRange: number;
  };
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  orientation?: "portrait" | "landscape";
}

export interface StudentHistoryReportData {
  student: Student;
  dorm?: Dormitory;
  dormName: string;
  currentStatus: {
    status: AttendanceStatus;
    isOut: boolean;
    label: string;
    reason?: string;
    date: string;
    dormName?: string;
  };
  leaveHistory: StudentLeaveEvent[];
  allLeaveHistory: StudentLeaveEvent[];
  startDate: string;
  endDate: string;
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
}

/**
 * Universal print trigger that works reliably in iframes, new windows, and sandboxes
 */
export function triggerPrintWindow(htmlContent: string, fileName: string = "เอกสารรายงาน") {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  // Method 1: Try window.open
  const printWin = window.open(url, "_blank");
  if (printWin) {
    printWin.focus();
  } else {
    // Method 2: If popup blocked, create invisible iframe to trigger print
    try {
      const existingFrame = document.getElementById("direct-print-frame");
      if (existingFrame) {
        document.body.removeChild(existingFrame);
      }
      const iframe = document.createElement("iframe");
      iframe.id = "direct-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Iframe print error", e);
          }
        }, 500);
      };
    } catch (e) {
      // Fallback: Download file
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

/**
 * Generate Search & Leave Summary Report HTML
 */
export function generateStudentSearchReportHtml(data: StudentSearchReportData): string {
  const {
    title,
    mode,
    students,
    dormName,
    gradeFilter,
    startDate,
    endDate,
    stats,
    systemSettings,
    currentUser,
    orientation = "landscape"
  } = data;

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย";
  const systemTitle = systemSettings?.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน";
  const logoUrl = systemSettings?.schoolLogoUrl;
  const todayStr = getTodayDateString();
  const printTimeStr = new Date().toLocaleTimeString("th-TH");

  const tableRowsHtml = students
    .map((item, idx) => {
      const s = item.student;
      const isOut = item.currentStatus.isOut;
      return `
        <tr class="${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}">
          <td class="p-2 text-center border border-slate-300 font-mono">${idx + 1}</td>
          <td class="p-2 text-center border border-slate-300 font-mono font-bold">${s.studentId}</td>
          <td class="p-2 border border-slate-300 font-bold text-slate-900">
            ${s.title || ""}${s.firstName} ${s.lastName} ${s.nickname ? `<span class="text-slate-500 font-normal">(${s.nickname})</span>` : ""}
          </td>
          <td class="p-2 text-center border border-slate-300 font-medium">
            ${formatGradeRoomShort(s.grade, s.room)} ${s.no ? `<span class="text-slate-400 font-mono">(#${s.no})</span>` : ""}
          </td>
          <td class="p-2 border border-slate-300">${item.dormName}</td>
          <td class="p-2 text-center border border-slate-300 font-bold">${s.dormRoom || "101"}</td>
          <td class="p-2 text-center border border-slate-300 font-bold">
            <span class="${isOut ? "text-rose-700 font-extrabold" : "text-emerald-700"}">
              ${item.currentStatus.label}
            </span>
          </td>
          <td class="p-2 text-center border border-slate-300 font-mono font-bold ${item.leaveCount > 0 ? "text-purple-700" : "text-slate-400"}">
            ${item.leaveCount}
          </td>
          <td class="p-2 border border-slate-300 text-[10px]">
            ${
              item.latestLeaveDate
                ? `<div>
                    <span class="font-bold text-slate-800">${formatThaiMediumDate(item.latestLeaveDate)}</span>
                    <span class="text-slate-600">(${item.latestLeaveStatusLabel})</span>
                    ${item.latestLeaveReason ? `<div class="text-slate-500 mt-0.5">เหตุผล: ${item.latestLeaveReason}</div>` : ""}
                  </div>`
                : `<span class="text-slate-400">-</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${schoolName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      font-family: "Sarabun", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h1, h2, h3, h4, .font-prompt {
      font-family: "Prompt", "Sarabun", sans-serif;
    }
    @page {
      size: A4 ${orientation};
      margin: 8mm 10mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-container {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body class="bg-slate-100 min-h-screen p-4 sm:p-8">
  <!-- Top Floating Controls for Screen View -->
  <div class="no-print max-w-${orientation === "landscape" ? "5xl" : "4xl"} mx-auto mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-lg">
        🖨️
      </div>
      <div>
        <h2 class="text-sm font-bold">${title}</h2>
        <p class="text-xs text-slate-400">${schoolName} • จัดทำเมื่อ ${formatThaiMediumDate(todayStr)} ${printTimeStr}</p>
      </div>
    </div>
    <div class="flex items-center gap-2.5">
      <button onclick="window.print()" class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer">
        <span>สั่งพิมพ์ (Print / PDF)</span>
      </button>
      <button onclick="window.close()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer">
        ปิดหน้าต่าง
      </button>
    </div>
  </div>

  <!-- A4 Printable Sheet -->
  <div class="page-container bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200 text-slate-900 mx-auto max-w-${orientation === "landscape" ? "5xl" : "4xl"}">
    <!-- Header -->
    <div class="text-center space-y-2 border-b-2 border-slate-900 pb-5 mb-5">
      <div class="flex items-center justify-center gap-3">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="w-14 h-14 object-contain" />` : ""}
        <div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900">${schoolName}</h1>
          <p class="text-xs sm:text-sm font-semibold text-slate-600">${systemTitle}</p>
        </div>
      </div>
      <h2 class="text-base sm:text-lg font-black text-purple-900 mt-2">${title}</h2>
      
      <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 pt-1 font-medium">
        <span class="bg-slate-100 px-2.5 py-0.5 rounded-md font-bold text-slate-700">หอพัก: ${dormName}</span>
        <span>•</span>
        <span class="bg-slate-100 px-2.5 py-0.5 rounded-md font-bold text-slate-700">ระดับชั้น: ${gradeFilter === "ALL" ? "ทุกระดับชั้น" : gradeFilter}</span>
        <span>•</span>
        <span>ช่วงวันที่: <strong class="text-slate-800">${formatThaiMediumDate(startDate)}</strong> ถึง <strong class="text-slate-800">${formatThaiMediumDate(endDate)}</strong></span>
      </div>
    </div>

    <!-- KPI Summary Block -->
    <div class="grid grid-cols-4 gap-3 mb-5 text-center text-xs">
      <div class="bg-purple-50/70 p-3 rounded-xl border border-purple-200">
        <div class="text-purple-700 font-bold">นักเรียนในรายงาน</div>
        <div class="text-lg font-black text-purple-950 mt-0.5">${stats.total.toLocaleString()} คน</div>
      </div>
      <div class="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
        <div class="text-emerald-700 font-bold">อยู่ในหอพัก (ปกติ)</div>
        <div class="text-lg font-black text-emerald-950 mt-0.5">${stats.currentlyIn.toLocaleString()} คน</div>
      </div>
      <div class="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
        <div class="text-rose-700 font-bold">ออกหอพัก (ปัจจุบัน)</div>
        <div class="text-lg font-black text-rose-950 mt-0.5">${stats.currentlyOut.toLocaleString()} คน</div>
      </div>
      <div class="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
        <div class="text-amber-700 font-bold">ครั้งที่ออกหอรวม</div>
        <div class="text-lg font-black text-amber-950 mt-0.5">${stats.totalLeavesInRange.toLocaleString()} ครั้ง</div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="overflow-x-auto mb-8">
      <table class="w-full text-left text-[11px] border-collapse border border-slate-300">
        <thead>
          <tr class="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-800">
            <th class="p-2 text-center w-8 border border-slate-300">#</th>
            <th class="p-2 text-center border border-slate-300 w-20">รหัสนักเรียน</th>
            <th class="p-2 border border-slate-300">ชื่อ - นามสกุล (ชื่อเล่น)</th>
            <th class="p-2 text-center border border-slate-300 w-24">ชั้น/ห้อง (เลขที่)</th>
            <th class="p-2 border border-slate-300 w-28">หอพัก</th>
            <th class="p-2 text-center border border-slate-300 w-14">ห้อง</th>
            <th class="p-2 text-center border border-slate-300 w-24">สถานะ</th>
            <th class="p-2 text-center border border-slate-300 w-16">ออกหอ</th>
            <th class="p-2 border border-slate-300">ประวัติการออกล่าสุด / เหตุผล</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${tableRowsHtml || `<tr><td colspan="9" class="p-6 text-center text-slate-400 font-bold">ไม่พบข้อมูลตามเงื่อนไขที่ระบุ</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Sign-off Block -->
    <div class="pt-6 border-t-2 border-slate-300 flex items-start justify-between text-xs text-slate-700">
      <div class="space-y-1">
        <div><strong>ผู้จัดทำรายงาน:</strong> ${currentUser?.name || "เจ้าหน้าที่หอพัก"}</div>
        <div><strong>ตำแหน่ง:</strong> ${currentUser?.roleLabel || currentUser?.roleCategoryName || "ครูประจำหอพัก"}</div>
        <div class="text-slate-400 text-[10px]">
          พิมพ์เมื่อ: ${formatThaiFullDate(todayStr)} เวลา ${printTimeStr} น.
        </div>
      </div>
      <div class="text-center space-y-3 min-w-[220px]">
        <div>ลงชื่อ ........................................................................</div>
        <div class="font-bold text-slate-800">( ........................................................................ )</div>
        <div class="text-[11px] text-slate-500">ครูประจำหอพัก / หัวหน้างานหอพักนักเรียน</div>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog after document is ready
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {}
      }, 500);
    });
  </script>
</body>
</html>`;
}

/**
 * Generate Individual Student History Report HTML
 */
export function generateStudentHistoryReportHtml(data: StudentHistoryReportData): string {
  const {
    student,
    dorm,
    dormName,
    currentStatus,
    leaveHistory,
    allLeaveHistory,
    startDate,
    endDate,
    systemSettings,
    currentUser
  } = data;

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย";
  const systemTitle = systemSettings?.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน";
  const logoUrl = systemSettings?.schoolLogoUrl;
  const todayStr = getTodayDateString();
  const printTimeStr = new Date().toLocaleTimeString("th-TH");
  const genderLabel = detectStudentGender(student.title, student.firstName, student.gender) === "male" ? "ชาย" : "หญิง";

  const historyRowsHtml = allLeaveHistory
    .map((ev, idx) => `
      <tr class="${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}">
        <td class="p-2.5 text-center border border-slate-300 font-mono font-bold text-slate-600">${idx + 1}</td>
        <td class="p-2.5 text-center border border-slate-300 font-bold text-slate-900">${formatThaiFullDate(ev.date)}</td>
        <td class="p-2.5 text-center border border-slate-300 font-bold">
          <span class="inline-block px-2.5 py-0.5 rounded-md text-xs ${ev.statusColor.bg} border ${ev.statusColor.border}">
            ${ev.statusLabel}
          </span>
        </td>
        <td class="p-2.5 border border-slate-300 text-slate-800">
          ${ev.reason ? `<span>${ev.reason}</span>` : `<span class="text-slate-400">-</span>`}
        </td>
        <td class="p-2.5 border border-slate-300 text-slate-700">${ev.dormName}</td>
        <td class="p-2.5 text-center border border-slate-300 text-slate-500 text-[11px]">${ev.checkedBy || "-"}</td>
      </tr>
    `)
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ประวัติการออกหอพัก_${student.studentId}_${student.firstName}_${student.lastName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      font-family: "Sarabun", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    h1, h2, h3, h4, .font-prompt {
      font-family: "Prompt", "Sarabun", sans-serif;
    }
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-container {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body class="bg-slate-100 min-h-screen p-4 sm:p-8">
  <!-- Screen Floating Action Bar -->
  <div class="no-print max-w-4xl mx-auto mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-lg">
        🎓
      </div>
      <div>
        <h2 class="text-sm font-bold">เอกสารประวัติการออกหอพัก: ${student.title || ""}${student.firstName} ${student.lastName}</h2>
        <p class="text-xs text-slate-400">รหัสนักเรียน: ${student.studentId} • หอพัก: ${dormName}</p>
      </div>
    </div>
    <div class="flex items-center gap-2.5">
      <button onclick="window.print()" class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer">
        <span>สั่งพิมพ์ (Print / PDF)</span>
      </button>
      <button onclick="window.close()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer">
        ปิดหน้าต่าง
      </button>
    </div>
  </div>

  <!-- A4 Printable Sheet -->
  <div class="page-container bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200 text-slate-900 mx-auto max-w-4xl">
    <!-- School Header -->
    <div class="border-b-2 border-slate-900 pb-5 mb-6 text-center">
      <div class="flex items-center justify-center gap-3">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="w-14 h-14 object-contain" />` : ""}
        <div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900">${schoolName}</h1>
          <p class="text-xs sm:text-sm font-semibold text-slate-600">${systemTitle}</p>
        </div>
      </div>
      <h2 class="text-lg font-black text-purple-900 mt-2">
        เอกสารรายงานประวัติการเข้าพักและสถิติการออกหอพักนักเรียนรายบุคคล
      </h2>
      <p class="text-xs text-slate-500 font-medium mt-0.5">
        ข้อมูล ณ วันที่ ${formatThaiFullDate(todayStr)} เวลา ${printTimeStr} น.
      </p>
    </div>

    <!-- Student Profile Card -->
    <div class="bg-gradient-to-br from-purple-50/60 to-indigo-50/40 p-5 rounded-2xl border border-purple-200 mb-6">
      <div class="text-xs font-black text-purple-900 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
        <span>ข้อมูลส่วนตัวและสถานะหอพัก</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
        <div>
          <span class="text-slate-500 font-medium">ชื่อ-นามสกุล:</span>
          <div class="font-extrabold text-slate-900 text-sm mt-0.5">
            ${student.title || ""}${student.firstName} ${student.lastName}
            ${student.nickname ? `<span class="text-purple-700 font-normal">(${student.nickname})</span>` : ""}
          </div>
        </div>
        <div>
          <span class="text-slate-500 font-medium">รหัสนักเรียน:</span>
          <div class="font-mono font-bold text-slate-800 text-sm mt-0.5">${student.studentId}</div>
        </div>
        <div>
          <span class="text-slate-500 font-medium">เพศ:</span>
          <div class="font-bold text-slate-800 text-sm mt-0.5">${genderLabel}</div>
        </div>
        <div>
          <span class="text-slate-500 font-medium">ระดับชั้น / ห้องเรียน:</span>
          <div class="font-bold text-slate-800 mt-0.5">
            ชั้น ${formatGradeRoomShort(student.grade, student.room)} ${student.no ? `เลขที่ ${student.no}` : ""}
          </div>
        </div>
        <div>
          <span class="text-slate-500 font-medium">หอพักที่สังกัด:</span>
          <div class="font-bold text-purple-900 mt-0.5">${dormName}</div>
        </div>
        <div>
          <span class="text-slate-500 font-medium">ห้องพัก:</span>
          <div class="font-bold text-slate-800 mt-0.5">ห้อง ${student.dormRoom || "101"}</div>
        </div>
      </div>

      <!-- Current Status Banner inside Profile Card -->
      <div class="mt-4 pt-3 border-t border-purple-200/80 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-600">สถานะปัจจุบัน:</span>
          <span class="px-3 py-1 rounded-lg text-xs font-extrabold ${
            currentStatus.isOut ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
          }">
            ${currentStatus.isOut ? `ออกหอพัก (${currentStatus.label})` : "อยู่ในหอพัก (ปกติ)"}
          </span>
          ${currentStatus.reason ? `<span class="text-xs text-rose-700 font-medium">• เหตุผล: ${currentStatus.reason}</span>` : ""}
        </div>
        <div class="text-[11px] text-slate-400">
          บันทึกล่าสุด: ${formatThaiMediumDate(currentStatus.date)}
        </div>
      </div>
    </div>

    <!-- Summary Stats Counters -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-center">
        <div class="text-xs font-bold text-purple-700">ออกหอพักในช่วงการค้นหา (${startDate} ถึง ${endDate})</div>
        <div class="text-2xl font-black text-purple-950 mt-1">${leaveHistory.length} <span class="text-xs font-normal">ครั้ง</span></div>
      </div>
      <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 text-center">
        <div class="text-xs font-bold text-indigo-700">ออกหอพักทั้งหมดตลอดปีการศึกษา</div>
        <div class="text-2xl font-black text-indigo-950 mt-1">${allLeaveHistory.length} <span class="text-xs font-normal">ครั้ง</span></div>
      </div>
    </div>

    <!-- Detailed Leave Records Table -->
    <div class="space-y-2 mb-8">
      <div class="text-xs font-black text-slate-800 flex items-center justify-between pb-1">
        <span>รายการบันทึกการออกหอพักทั้งหมด (${allLeaveHistory.length} รายการ)</span>
        <span class="text-[11px] text-slate-500 font-normal">เรียงลำดับจากวันที่ล่าสุด</span>
      </div>

      <table class="w-full text-left text-xs border-collapse border border-slate-300">
        <thead>
          <tr class="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-800">
            <th class="p-2.5 text-center border border-slate-300 w-10">ลำดับ</th>
            <th class="p-2.5 text-center border border-slate-300 w-36">วันที่ออกหอพัก</th>
            <th class="p-2.5 text-center border border-slate-300 w-32">ประเภทการออก</th>
            <th class="p-2.5 border border-slate-300">เหตุผลความจำเป็น</th>
            <th class="p-2.5 border border-slate-300 w-28">หอพัก</th>
            <th class="p-2.5 text-center border border-slate-300 w-28">ผู้บันทึก</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${historyRowsHtml || `<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold">ไม่พบประวัติการออกหอพัก นักเรียนอยู่ประจำหอพักสม่ำเสมอ</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Sign-off Block -->
    <div class="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-700">
      <div class="space-y-1">
        <div><strong>ผู้จัดทำรายงาน:</strong> ${currentUser?.name || "เจ้าหน้าที่หอพัก"}</div>
        <div><strong>สังกัด:</strong> ${dormName}</div>
        <div class="text-slate-400 text-[10px] pt-1">
          พิมพ์เมื่อ: ${formatThaiFullDate(todayStr)} เวลา ${printTimeStr} น.
        </div>
      </div>
      <div class="text-center space-y-3">
        <div>ลงชื่อ ........................................................................</div>
        <div class="font-bold text-slate-800">( ........................................................................ )</div>
        <div class="text-[11px] text-slate-500">ครูประจำหอพัก / หัวหน้างานหอพักนักเรียน</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {}
      }, 500);
    });
  </script>
</body>
</html>`;
}

export function printStudentSearchReport(data: StudentSearchReportData) {
  const html = generateStudentSearchReportHtml(data);
  triggerPrintWindow(html, `รายงานค้นหานักเรียน_${data.startDate}_ถึง_${data.endDate}`);
}

export function printIndividualStudentHistory(data: StudentHistoryReportData) {
  const html = generateStudentHistoryReportHtml(data);
  triggerPrintWindow(html, `ประวัติการออกหอ_${data.student.studentId}_${data.student.firstName}`);
}
