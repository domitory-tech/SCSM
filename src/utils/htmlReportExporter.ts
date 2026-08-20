import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { DailyReportData } from "../types";
import { formatThaiFullDate } from "./dateUtils";

/**
 * Exports an HTML element directly to a formatted PDF file using html-to-image & jsPDF.
 * This preserves all HTML/CSS styling, colors, borders, Thai fonts, and signatures.
 */
export async function exportHtmlToPdf(
  elementId: string,
  fileName: string = "รายงานสรุปหอพักประจำวัน.pdf"
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  // Create temporary wrapper container to render full styled document for capture
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = "1000px";
  clone.style.padding = "32px";
  clone.style.backgroundColor = "#ffffff";
  clone.style.position = "absolute";
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.zIndex = "-1000";

  // Ensure all sub-elements are visible (remove hidden print classes)
  const hiddenElements = clone.querySelectorAll(".hidden");
  hiddenElements.forEach((el) => {
    (el as HTMLElement).style.display = "block";
  });

  document.body.appendChild(clone);

  try {
    const imgData = await toPng(clone, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true
    });

    const img = new Image();
    img.src = imgData;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;
    
    let heightLeft = imgHeight;
    const pdf = new jsPDF("p", "mm", "a4");
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(clone);
  }
}

/**
 * Converts styled HTML tables directly into an Excel workbook (.xlsx).
 * This ensures the exported Excel file matches the HTML/CSS table structure.
 */
export function exportHtmlTablesToExcel(
  containerId: string,
  fileName: string = "รายงานสรุปหอพักประจำวัน.xlsx"
): void {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element "${containerId}" not found`);
  }

  const wb = XLSX.utils.book_new();
  const tables = container.querySelectorAll("table");

  if (tables.length === 0) {
    throw new Error("ไม่พบตารางข้อมูลสำหรับส่งออกเป็น Excel");
  }

  tables.forEach((table, idx) => {
    const sheetName = table.getAttribute("data-sheet-name") || `Sheet_${idx + 1}`;
    const ws = XLSX.utils.table_to_sheet(table, { raw: false });
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  });

  XLSX.writeFile(wb, fileName);
}

/**
 * Exports an HTML element directly as a standalone .html file with full CSS styling formatted for A4 printing.
 * Opening this file in any browser displays the exact report layout, colors, tables, and signature blocks formatted for A4 paper.
 */
export function exportHtmlDocument(
  elementId: string,
  fileName: string = "รายงานสรุปหอพักประจำวัน.html",
  orientation: "portrait" | "landscape" = "portrait"
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const isLandscape = orientation === "landscape";
  const pageSize = isLandscape ? "A4 landscape" : "A4 portrait";
  const pageMargin = isLandscape ? "6mm 8mm" : "10mm 12mm";
  const containerWidth = isLandscape ? "297mm" : "210mm";
  const containerMinHeight = isLandscape ? "210mm" : "297mm";
  const containerPadding = isLandscape ? "8mm" : "12mm";

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
      size: ${pageSize};
      margin: ${pageMargin};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 15px;
      color: #0f172a;
    }
    .a4-container {
      width: ${containerWidth};
      max-width: 100%;
      min-height: ${containerMinHeight};
      margin: 0 auto;
      background: white;
      padding: ${containerPadding};
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }
    thead {
      display: table-header-group;
    }
    tbody tr, .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    @media print {
      body {
        background: white !important;
        padding: 0 !important;
      }
      .a4-container {
        width: 100% !important;
        min-height: auto !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="a4-container">
    ${element.innerHTML}
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

/**
 * Combines all 3 Daily Report sheets (ใบที่ 1, ใบที่ 2, ใบที่ 3) into a single standalone HTML document.
 * Each sheet is formatted as an independent A4 portrait page with CSS page-break for seamless printing.
 */
export function exportCombinedDailyReportHtml(
  sheetIds: string[] = [
    "daily-report-printable-sheet1",
    "daily-report-printable-sheet2",
    "daily-report-printable-sheet3"
  ],
  fileName: string = "รายงานสรุปยอดนักเรียนในหอพักประจำวัน_รวม3ใบ.html",
  reportDateTitle: string = "รายงานสรุปยอดนักเรียนในหอพักประจำวัน"
): void {
  const sheetTitles = [
    "ใบที่ 1: ตารางสรุปยอดจำนวนนักเรียน",
    "ใบที่ 2: ใบรายงานเรื่องแจ้งอบรมประจำวัน",
    "ใบที่ 3: ตารางรายชื่อนักเรียนออกหอพัก"
  ];

  const sheetsHtml = sheetIds.map((id, index) => {
    const el = document.getElementById(id);
    if (!el) {
      return `
        <div class="sheet-page" id="sheet-${index + 1}">
          <div class="p-8 text-center text-red-500 font-bold">
            ไม่พบข้อมูลสำหรับ ${sheetTitles[index] || `ใบที่ ${index + 1}`}
          </div>
        </div>
      `;
    }

    return `
      <div class="sheet-page" id="sheet-${index + 1}">
        <div class="sheet-inner">
          ${el.innerHTML}
        </div>
      </div>
    `;
  }).join("\n");

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

    /* Screen Mode Styling */
    @media screen {
      body {
        background-color: #0f172a;
        padding-bottom: 60px;
      }
      .screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      .sheet-container {
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 28px;
      }
      .sheet-page {
        width: 210mm;
        max-width: 100%;
        min-height: 297mm;
        background: #ffffff;
        padding: 28px 32px;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        position: relative;
      }
      .sheet-page::before {
        content: attr(id);
        position: absolute;
        top: -12px;
        left: 24px;
        background: #9333ea;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 10px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    /* Print Mode Styling (A4 Multi-page output) */
    @media print {
      .screen-toolbar {
        display: none !important;
      }
      body {
        background: white !important;
        padding: 0 !important;
      }
      .sheet-container {
        padding: 0 !important;
        display: block !important;
        gap: 0 !important;
      }
      .sheet-page {
        width: 100% !important;
        min-height: auto !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .sheet-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }

    thead {
      display: table-header-group;
    }
    tbody tr, .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
  </style>
</head>
<body>
  <!-- Top Screen Toolbar (Auto-hidden in Print Mode) -->
  <div class="screen-toolbar">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-md">
        3
      </div>
      <div>
        <h1 class="text-white text-sm font-bold leading-tight">${reportDateTitle}</h1>
        <p class="text-slate-400 text-xs font-normal">รวมรายงาน 3 ใบในไฟล์เดียว (ใบที่ 1, ใบที่ 2, ใบที่ 3 - แยกหน้าละ 1 ใบสำหรับพิมพ์ A4)</p>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div class="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
        <a href="#sheet-1" class="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">ใบที่ 1 สรุปยอด</a>
        <a href="#sheet-2" class="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">ใบที่ 2 เรื่องแจ้งอบรม</a>
        <a href="#sheet-3" class="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">ใบที่ 3 รายชื่อออกหอ</a>
      </div>

      <button
        onclick="window.print()"
        class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>พิมพ์ / บันทึก PDF (ครบทั้ง 3 ใบ)</span>
      </button>
    </div>
  </div>

  <!-- Document Pages Container -->
  <div class="sheet-container">
    ${sheetsHtml}
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

