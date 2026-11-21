import { Dormitory, SystemSettings, UserProfile } from "../types";
import { StudentComparisonItem } from "./fingerprintCompareUtils";
import { formatThaiMediumDate, getTodayDateString, THAI_DAYS_FULL, THAI_MONTHS } from "./dateUtils";
import { extractDormNumber, isDormMatch } from "./dormUtils";
import { triggerPrintWindow } from "./studentSearchReportExporter";
import { escapeHtml } from "./security";

export type LateReportPrintScope =
  | "LATE_ALL"
  | "LATE_SCANNED"
  | "LATE_NOT_SCANNED"
  | "ALL_FLAGGED"
  | "SELECTED";

export interface LateDormPrintData {
  items: StudentComparisonItem[];
  dorms?: Dormitory[];
  reportDate: string; // YYYY-MM-DD
  attendanceDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  dormFilterLabel: string;
  gradeFilterLabel: string;
  orientation: "portrait" | "landscape";
  scopeLabel?: string;
  currentUser?: UserProfile | null;
  systemSettings?: SystemSettings;
}

export interface DormLateSummaryBucket {
  key: string;
  label: string;
  dormNumber: number;
  count: number;
  lateScannedCount: number;
  lateNotScannedCount: number;
}

/**
 * Computes late-student summary counts ordered strictly from หอพัก 1 -> หอพัก 6 (and any remaining dorms).
 */
export function buildLateDormSummaryByDorm(
  items: StudentComparisonItem[],
  dorms: Dormitory[] = []
): DormLateSummaryBucket[] {
  interface InternalBucket extends DormLateSummaryBucket {
    dorm?: Dormitory;
    numStr: string;
  }

  const buckets: InternalBucket[] = [];

  if (dorms.length > 0) {
    const sortedDorms = [...dorms].sort((a, b) => {
      const numA = parseInt(extractDormNumber(a.name) || extractDormNumber(a.id) || "999", 10);
      const numB = parseInt(extractDormNumber(b.name) || extractDormNumber(b.id) || "999", 10);
      if (numA !== numB) return numA - numB;
      return (a.name || "").localeCompare(b.name || "", "th", { numeric: true });
    });

    sortedDorms.forEach((d) => {
      const numStr = extractDormNumber(d.name) || extractDormNumber(d.id);
      const dormNumber = numStr ? parseInt(numStr, 10) : 999;
      buckets.push({
        key: d.id,
        label: numStr ? `หอพัก ${numStr}` : (d.name || "").trim() || d.id,
        dormNumber,
        numStr,
        dorm: d,
        count: 0,
        lateScannedCount: 0,
        lateNotScannedCount: 0
      });
    });
  } else {
    for (let n = 1; n <= 6; n++) {
      buckets.push({
        key: `dorm-${n}`,
        label: `หอพัก ${n}`,
        dormNumber: n,
        numStr: String(n),
        count: 0,
        lateScannedCount: 0,
        lateNotScannedCount: 0
      });
    }
  }

  const extraMap = new Map<string, InternalBucket>();

  items.forEach((item) => {
    const itemNumStr = extractDormNumber(item.dorm?.name || item.dormName);
    let matched = buckets.find((b) => {
      if (b.dorm && item.dorm && b.dorm.id === item.dorm.id) return true;
      if (b.dorm && isDormMatch(b.dorm, item.dormName)) return true;
      if (b.numStr && itemNumStr && b.numStr === itemNumStr) return true;
      return false;
    });

    if (!matched) {
      const fallbackLabel = (item.dormName || "ไม่ระบุหอพัก").trim();
      let extra = extraMap.get(fallbackLabel);
      if (!extra) {
        const dormNumber = itemNumStr ? parseInt(itemNumStr, 10) : 999;
        extra = {
          key: `extra-${fallbackLabel}`,
          label: itemNumStr ? `หอพัก ${itemNumStr}` : fallbackLabel,
          dormNumber,
          numStr: itemNumStr,
          count: 0,
          lateScannedCount: 0,
          lateNotScannedCount: 0
        };
        extraMap.set(fallbackLabel, extra);
      }
      matched = extra;
    }

    matched.count += 1;
    if (item.punctualityStatus === "LATE_SCANNED") {
      matched.lateScannedCount += 1;
    } else if (item.punctualityStatus === "LATE_NOT_SCANNED") {
      matched.lateNotScannedCount += 1;
    }
  });

  const combined = [...buckets, ...Array.from(extraMap.values())];
  combined.sort((a, b) => {
    if (a.dormNumber !== b.dormNumber) return a.dormNumber - b.dormNumber;
    return a.label.localeCompare(b.label, "th", { numeric: true });
  });

  return combined.map(({ key, label, dormNumber, count, lateScannedCount, lateNotScannedCount }) => ({
    key,
    label,
    dormNumber,
    count,
    lateScannedCount,
    lateNotScannedCount
  }));
}

/**
 * Formats YYYY-MM-DD safely (timezone-independent) into:
 * "ประจำวันศุกร์ ที่ 13 เดือนพฤศจิกายน พ.ศ. 2569"
 */
export function formatThaiOfficialLateHeaderDate(dateStr?: string): string {
  if (!dateStr) {
    return "ประจำวัน................ ที่........ เดือน.................. พ.ศ. ............";
  }
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return "ประจำวัน................ ที่........ เดือน.................. พ.ศ. ............";
  }
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) {
    return "ประจำวัน................ ที่........ เดือน.................. พ.ศ. ............";
  }

  const dayFull = THAI_DAYS_FULL[dt.getDay()] || "วัน...";
  const dayOfMonth = dt.getDate();
  const monthName = THAI_MONTHS[dt.getMonth()] || "";
  const yearBE = dt.getFullYear() + 543;

  return `ประจำ${dayFull} ที่ ${dayOfMonth} เดือน${monthName} พ.ศ. ${yearBE}`;
}

/**
 * Generates standalone A4 HTML for printing the Late Dormitory Students Report.
 */
export function generateLateDormReportHtml(data: LateDormPrintData): string {
  const {
    items: rawItems,
    dorms = [],
    reportDate,
    startTime,
    endTime,
    dormFilterLabel,
    gradeFilterLabel,
    orientation
  } = data;

  const items = rawItems.filter(
    (item) =>
      !(
        item.dormStatus === "QUARANTINE" &&
        (!item.hasScanned ||
          item.punctualityStatus === "LATE_SCANNED" ||
          item.punctualityStatus === "LATE_NOT_SCANNED" ||
          item.punctualityStatus === "QUARANTINE_EXEMPT")
      )
  );

  const isLandscape = orientation === "landscape";
  const isPortrait = !isLandscape;
  const schoolName = "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย";
  const departmentName = "กลุ่มบริหารกิจการนักเรียน";
  const reportTitle = "สรุปรายงานนักเรียนลงหอพักสาย";
  const headerDateLine = formatThaiOfficialLateHeaderDate(reportDate);

  const todayStr = getTodayDateString();
  const printTimeStr = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const lateScannedCount = items.filter((i) => i.punctualityStatus === "LATE_SCANNED").length;
  const lateNotScannedCount = items.filter((i) => i.punctualityStatus === "LATE_NOT_SCANNED").length;
  const earlyCount = items.filter((i) => i.punctualityStatus === "EARLY").length;

  const dormSummary = buildLateDormSummaryByDorm(items, dorms);

  const thNoCls = isPortrait
    ? "border border-slate-400 px-1 py-2 text-center w-[5%]"
    : "border border-slate-400 px-2 py-2.5 text-center w-[5%]";
  const thIdCls = isPortrait
    ? "border border-slate-400 px-1 py-2 text-center w-[9%] text-[10px] tracking-tight whitespace-nowrap"
    : "border border-slate-400 px-2.5 py-2.5 text-center w-[12%]";
  const thNameCls = isPortrait
    ? "border border-slate-400 px-2 py-2 text-left w-[26%]"
    : "border border-slate-400 px-3 py-2.5 text-left w-[26%]";
  const thGradeCls = isPortrait
    ? "border border-slate-400 px-1.5 py-2 text-center w-[10%]"
    : "border border-slate-400 px-2.5 py-2.5 text-center w-[10%]";
  const thDormCls = isPortrait
    ? "border border-slate-400 px-2 py-2 text-left w-[15%]"
    : "border border-slate-400 px-2.5 py-2.5 text-left w-[15%]";
  const thTimeCls = isPortrait
    ? "border border-slate-400 px-1.5 py-2 text-center w-[12%]"
    : "border border-slate-400 px-2.5 py-2.5 text-center w-[12%]";
  const thResultCls = isPortrait
    ? "border border-slate-400 px-2 py-2 text-left w-[23%]"
    : "border border-slate-400 px-3 py-2.5 text-left w-[20%]";

  const tdNoCls = isPortrait
    ? "border border-slate-400 px-1 py-1.5 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap"
    : "border border-slate-400 px-2 py-2 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap";
  const tdIdCls = isPortrait
    ? "border border-slate-400 px-1 py-1.5 text-center font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap text-[10px] tracking-tight"
    : "border border-slate-400 px-2.5 py-2 text-center font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap";
  const tdNameCls = isPortrait
    ? "border border-slate-400 px-2 py-1.5 font-semibold text-slate-900"
    : "border border-slate-400 px-3 py-2 font-semibold text-slate-900";
  const tdGradeCls = isPortrait
    ? "border border-slate-400 px-1.5 py-1.5 text-center tabular-nums font-medium text-slate-800 whitespace-nowrap"
    : "border border-slate-400 px-2.5 py-2 text-center tabular-nums font-medium text-slate-800 whitespace-nowrap";
  const tdDormCls = isPortrait
    ? "border border-slate-400 px-2 py-1.5 text-slate-800"
    : "border border-slate-400 px-2.5 py-2 text-slate-800";

  const rowsHtml =
    items.length > 0
      ? items
          .map((item, idx) => {
            const scanTimeText =
              item.hasScanned && item.scannerInfo
                ? item.scannerInfo.earliestTime
                  ? `${item.scannerInfo.earliestTime} น.`
                  : "ไม่ระบุเวลา"
                : "ไม่พบการสแกน";

            const isNotScanned = item.punctualityStatus === "LATE_NOT_SCANNED";
            const isLateScanned = item.punctualityStatus === "LATE_SCANNED";

            const resultColorCls = isNotScanned
              ? "text-rose-700 font-bold"
              : isLateScanned
              ? "text-orange-700 font-bold"
              : "text-sky-700 font-bold";

            const scanColorCls = item.hasScanned
              ? "text-slate-900 font-semibold"
              : "text-rose-600 font-medium";

            const tdTimeCls = isPortrait
              ? `border border-slate-400 px-1.5 py-1.5 text-center font-mono tabular-nums whitespace-nowrap ${scanColorCls}`
              : `border border-slate-400 px-2.5 py-2 text-center font-mono tabular-nums whitespace-nowrap ${scanColorCls}`;
            const tdResultCls = isPortrait
              ? `border border-slate-400 px-2 py-1.5 tabular-nums ${resultColorCls}`
              : `border border-slate-400 px-3 py-2 tabular-nums ${resultColorCls}`;

            return `
              <tr class="${idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}">
                <td class="${tdNoCls}">${idx + 1}</td>
                <td class="${tdIdCls}">${escapeHtml(item.formattedId)}</td>
                <td class="${tdNameCls}">${escapeHtml(item.fullName)}</td>
                <td class="${tdGradeCls}">${escapeHtml(item.gradeRoom)}</td>
                <td class="${tdDormCls}">${escapeHtml(item.dormName)}</td>
                <td class="${tdTimeCls}">${escapeHtml(scanTimeText)}</td>
                <td class="${tdResultCls}">${escapeHtml(item.punctualityLabel)}</td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="7" class="border border-slate-400 px-4 py-8 text-center text-slate-500 font-semibold">
            ไม่พบรายชื่อนักเรียนลงหอพักสายตามเงื่อนไขที่เลือก
          </td>
        </tr>
      `;

  const dormSummaryHeadersHtml = dormSummary
    .map(
      (d) =>
        `<th class="border border-slate-400 px-2 py-2 text-center font-extrabold text-slate-900 bg-slate-100">${escapeHtml(
          d.label
        )}</th>`
    )
    .join("");

  const dormSummaryCellsHtml = dormSummary
    .map(
      (d) =>
        `<td class="border border-slate-400 px-2 py-2 text-center tabular-nums">
          <div class="font-extrabold text-sm ${d.count > 0 ? "text-slate-900" : "text-slate-400"}">${d.count} คน</div>
          ${
            d.count > 0
              ? `<div class="text-[10px] text-slate-500 mt-0.5">สแกนสาย ${d.lateScannedCount} · ไม่สแกน ${d.lateNotScannedCount}</div>`
              : ""
          }
        </td>`
    )
    .join("");

  const filterNotes: string[] = [];
  if (dormFilterLabel && dormFilterLabel !== "ทุกหอพัก") {
    filterNotes.push(`หอพัก: ${dormFilterLabel}`);
  }
  if (gradeFilterLabel && gradeFilterLabel !== "ทุกระดับชั้น") {
    filterNotes.push(`ระดับชั้น: ${gradeFilterLabel}`);
  }
  filterNotes.push(`ช่วงเวลาที่กำหนด: ${startTime} – ${endTime} น.`);

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${reportTitle} - ${schoolName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * {
      box-sizing: border-box;
      font-family: "Sarabun", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 ${orientation};
      margin: ${isLandscape ? "10mm 12mm" : "12mm 12mm"};
    }
    body {
      margin: 0;
      padding: 20px;
      background-color: #e2e8f0;
      color: #0f172a;
    }
    .paper-sheet {
      width: 100%;
      max-width: ${isLandscape ? "297mm" : "210mm"};
      min-height: ${isLandscape ? "190mm" : "270mm"};
      margin: 0 auto;
      background: #ffffff;
      padding: ${isLandscape ? "12mm 14mm" : "14mm 12mm"};
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    }
    thead {
      display: table-header-group;
    }
    tr, .summary-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
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
      .paper-sheet {
        max-width: 100% !important;
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Screen Floating Toolbar -->
  <div class="no-print mx-auto mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-xl" style="max-width: ${isLandscape ? "297mm" : "210mm"};">
    <div>
      <div class="text-sm font-extrabold">${reportTitle}</div>
      <div class="text-xs text-slate-300">
        ตั้งค่าหน้ากระดาษ: ${isLandscape ? "A4 แนวนอน (Landscape)" : "A4 แนวตั้ง (Portrait)"} · จำนวน ${items.length} คน
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick="window.print()"
        class="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-extrabold text-white shadow transition-colors cursor-pointer"
      >
        สั่งพิมพ์ / บันทึก PDF
      </button>
      <button
        onclick="window.close()"
        class="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
      >
        ปิดหน้าต่าง
      </button>
    </div>
  </div>

  <!-- A4 Printable Document -->
  <div class="paper-sheet">
    <!-- Report Header -->
    <div class="text-center pb-3.5 mb-4 border-b-2 border-slate-800 space-y-1">
      <h1 class="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
        ${schoolName}
      </h1>
      <h2 class="text-base font-bold text-slate-800 leading-snug">
        ${departmentName}
      </h2>
      <h3 class="text-base font-extrabold text-slate-900 leading-snug">
        ${reportTitle}
      </h3>
      <p class="text-sm font-semibold text-slate-800 pt-0.5">
        ${escapeHtml(headerDateLine)}
      </p>
      <p class="text-[11px] text-slate-500 pt-0.5">
        ${escapeHtml(filterNotes.join(" · "))}
      </p>
    </div>

    <!-- Late Students Table -->
    <table class="w-full border-collapse text-xs">
      <thead>
        <tr class="bg-slate-100 text-slate-900 font-extrabold">
          <th class="${thNoCls}">ที่</th>
          <th class="${thIdCls}">รหัสนักเรียน</th>
          <th class="${thNameCls}">ชื่อ - นามสกุล</th>
          <th class="${thGradeCls}">ชั้น/ห้อง</th>
          <th class="${thDormCls}">หอพัก</th>
          <th class="${thTimeCls}">เวลาสแกนนิ้ว</th>
          <th class="${thResultCls}">ผลการตรวจเวลา</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Dormitory Summary Table (Sorted Dorm 1 -> Dorm 6) -->
    <div class="mt-5 summary-block">
      <div class="text-xs font-extrabold text-slate-900 mb-2">
        สรุปจำนวนนักเรียนลงหอพักสาย (เรียงตามหอพัก)
      </div>
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr>
            ${dormSummaryHeadersHtml}
            <th class="border border-slate-400 px-2 py-2 text-center font-extrabold text-slate-900 bg-slate-200">
              รวมทั้งหมด
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-white">
            ${dormSummaryCellsHtml}
            <td class="border border-slate-400 px-2 py-2 text-center tabular-nums bg-slate-50">
              <div class="font-black text-sm text-slate-900">${items.length} คน</div>
              <div class="text-[10px] text-slate-600 mt-0.5">
                ${
                  earlyCount === 0
                    ? `สแกนสาย ${lateScannedCount} · ไม่สแกน ${lateNotScannedCount}`
                    : `สแกนสาย ${lateScannedCount} · ไม่สแกน ${lateNotScannedCount} · ก่อนเวลา ${earlyCount}`
                }
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-2 text-right text-[11px] text-slate-500">
        พิมพ์เมื่อ: ${formatThaiMediumDate(todayStr)} เวลา ${printTimeStr} น.
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

/**
 * Opens the standalone printable HTML window/iframe and triggers browser print dialog.
 */
export function printLateDormReport(data: LateDormPrintData): void {
  const html = generateLateDormReportHtml(data);
  const fileDate = data.reportDate || data.attendanceDate || getTodayDateString();
  triggerPrintWindow(html, `สรุปรายงานนักเรียนลงหอพักสาย_${fileDate}`);
}
