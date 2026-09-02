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
      cacheBust: true,
      skipFonts: true,
      fontEmbedCSS: ""
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
  printOrSaveElementAsPdf(elementId, fileName.replace(".html", ""), orientation);
}

/**
 * Universal Print & PDF trigger: Opens a dedicated, pristine print preview window
 * with auto-triggered browser Print dialog (where users can choose "Save as PDF" or print directly).
 * Preserves all Thai fonts, background colors, custom borders, and responsive tables without distortion.
 */
export function printOrSaveElementAsPdf(
  elementId: string,
  documentTitle: string = "ผังการจัดหอพัก",
  orientation: "portrait" | "landscape" = "portrait"
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const isLandscape = orientation === "landscape";
  const pageSize = isLandscape ? "A4 landscape" : "A4 portrait";
  const pageMargin = isLandscape ? "8mm 10mm" : "10mm 12mm";
  const containerMaxWidth = isLandscape ? "297mm" : "210mm";

  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: ${pageSize};
      margin: ${pageMargin};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', sans-serif;
      background-color: #0f172a;
      margin: 0;
      padding: 0;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .print-canvas {
      width: 100%;
      max-width: ${containerMaxWidth};
      margin: 24px auto;
      background: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    thead {
      display: table-header-group;
    }
    tbody tr, .break-inside-avoid, [class*="break-inside-avoid"] {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .dorm-rooms-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 16px !important;
    }
    /* ในรูปแบบการพิมพ์: ย่อขนาดเฉพาะชื่อที่ยาวเกินคอลัมน์ ส่วนชื่อความยาวปกติใช้ขนาดปกติ */
    .print-canvas .student-name-normal,
    @media print .student-name-normal {
      font-size: 11.5px !important;
      line-height: 1.3 !important;
    }
    .print-canvas .student-name-long,
    @media print .student-name-long {
      font-size: 10px !important;
      line-height: 1.15 !important;
      letter-spacing: -0.2px !important;
    }
    .print-canvas .student-name-very-long,
    @media print .student-name-very-long {
      font-size: 8.8px !important;
      line-height: 1.1 !important;
      letter-spacing: -0.3px !important;
    }
    .print-canvas .student-nick-normal,
    @media print .student-nick-normal {
      font-size: 9.5px !important;
      padding: 1px 4px !important;
    }
    .print-canvas .student-nick-long,
    @media print .student-nick-long {
      font-size: 8.5px !important;
      padding: 1px 2.5px !important;
    }
    .print-canvas .student-nick-very-long,
    @media print .student-nick-very-long {
      font-size: 7.5px !important;
      padding: 0.5px 2px !important;
    }
    @media print {
      body {
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-canvas {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .dorm-rooms-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 14px !important;
      }
    }
  </style>
</head>
<body>
  <!-- Print Control Bar (Hidden during actual printing/PDF saving) -->
  <div class="print-toolbar">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-md">
        PDF
      </div>
      <div>
        <h1 class="text-white text-sm font-extrabold leading-tight">${documentTitle}</h1>
        <p class="text-slate-400 text-xs font-medium">รูปแบบกระดาษ: ${isLandscape ? "A4 แนวนอน (Landscape)" : "A4 แนวตั้ง (Portrait)"} • ปรับแต่งสีและแบบอักษรสำหรับพิมพ์คมชัด</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        onclick="window.print()"
        class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-lg cursor-pointer transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>พิมพ์ / บันทึกเป็น PDF (Print / Save as PDF)</span>
      </button>

      <button
        onclick="window.close()"
        class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
      >
        ปิดหน้านี้
      </button>
    </div>
  </div>

  <!-- Printable Content Canvas -->
  <div class="print-canvas">
    ${element.innerHTML}
  </div>

  <script>
    // Auto-launch browser print dialog after content loads
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.error("Auto print failed:", e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // 1. Try opening new window/tab for native print
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.focus();
  } else {
    // 2. If popup is blocked by browser sandbox/iframe, use invisible print iframe
    try {
      const existingFrame = document.getElementById("dorm-layout-print-iframe");
      if (existingFrame) {
        document.body.removeChild(existingFrame);
      }
      const iframe = document.createElement("iframe");
      iframe.id = "dorm-layout-print-iframe";
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
      // 3. Fallback: Download HTML file
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
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

