import * as XLSX from "xlsx";
import { Student, SystemSettings } from "../types";
import { formatGradeRoomFullTitle, formatThaiMonthYear, getDaysInMonth, THAI_MONTHS, THAI_DAYS_SHORT } from "./dateUtils";

export interface MonthlyRoomData {
  grade: string;
  room: number | string;
  roomKey: string; // e.g. "ม.1/1"
  fullTitle: string; // e.g. "มัธยมศึกษาปีที่ 1/1"
  students: Student[];
  // studentId -> dateDay (1..daysInMonth) -> status string ("PRESENT" | "ROUND_HOME" | "HOME" | "SICK" | "SKILL_COMP" | "EXCHANGE" | "OTHER" | "NONE")
  attendanceMap: Record<string, Record<number, { status: string; label: string; code: string; color: string }>>;
  // dateDay (1..daysInMonth) -> stats
  dayStats: Record<number, { total: number; present: number; out: number }>;
  // studentId -> total out days
  studentOutTotals: Record<string, number>;
  totalStudents: number;
}

/**
 * Generates and downloads a standalone HTML file formatted in A4 Landscape
 * containing ALL classrooms and grade levels for the entire school.
 * Each classroom is separated with a clean CSS page break (1 page per classroom).
 */
export function exportAllMonthlyReportsHtml(
  roomsData: MonthlyRoomData[],
  year: number,
  month: number,
  schoolName: string = "โรงเรียนพิจิตรปัญญานุกูล",
  fileName?: string
): void {
  const daysInMonth = getDaysInMonth(year, month);
  const monthTitle = formatThaiMonthYear(year, month);
  const actualFileName = fileName || `รายงานสรุปเช็คยอดนักเรียน_ทุกระดับชั้น_${THAI_MONTHS[month - 1]}_${year + 543}.html`;
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const pagesHtml = roomsData.map((roomData, roomIdx) => {
    const isLast = roomIdx === roomsData.length - 1;

    // Build Student Rows
    const studentRowsHtml = roomData.students.length === 0
      ? `<tr><td colspan="${daysInMonth + 3}" style="border:1px solid #cbd5e1; padding:16px; text-align:center; color:#94a3b8;">ไม่มีรายชื่อนักเรียนในห้องนี้</td></tr>`
      : roomData.students.map((student, sIdx) => {
          const outCount = roomData.studentOutTotals[student.studentId] || 0;
          const bgStyle = sIdx % 2 === 0 ? "background-color: #ffffff;" : "background-color: #f8fafc;";

          const daysCellsHtml = daysArray.map((d) => {
            const att = roomData.attendanceMap[student.studentId]?.[d];
            const code = att?.code || "-";
            const isCheckmark = code === "✓";
            const isRoundHome = code === "รบ";

            let bgStyleCell = "";
            let colorStyle = "color: #94a3b8; font-size: 10px;";
            if (isRoundHome) {
              bgStyleCell = "background-color: #fef08a;";
              colorStyle = "color: #78350f; font-weight: 800; font-size: 10px;";
            } else if (isCheckmark) {
              colorStyle = "color: #059669; font-weight: 800; font-size: 12px;";
            } else if (code === "กบ") {
              colorStyle = "color: #c2410c; font-weight: 800; font-size: 10px;";
            } else if (code === "ค") {
              colorStyle = "color: #1d4ed8; font-weight: 800; font-size: 10px;";
            } else if (code === "ป") {
              colorStyle = "color: #e11d48; font-weight: 800; font-size: 10px;";
            } else if (code === "ท") {
              colorStyle = "color: #7e22ce; font-weight: 800; font-size: 10px;";
            } else if (code === "ลป") {
              colorStyle = "color: #0284c7; font-weight: 800; font-size: 10px;";
            } else if (code === "อ") {
              colorStyle = "color: #78350f; font-weight: 800; font-size: 10px;";
            }

            return `<td style="border:1px solid #cbd5e1; padding:2px 1px; text-align:center; line-height:1; ${bgStyleCell} ${colorStyle}">${code}</td>`;
          }).join("");

          return `
            <tr style="${bgStyle}">
              <td style="border:1px solid #cbd5e1; padding:3px 2px; text-align:center; font-weight:bold; color:#334155;">${student.no || sIdx + 1}</td>
              <td style="border:1px solid #cbd5e1; padding:3px 6px; text-align:left; font-weight:500; color:#0f172a; white-space:nowrap;">${student.title || ""}${student.firstName} ${student.lastName}</td>
              ${daysCellsHtml}
              <td style="border:1px solid #cbd5e1; padding:3px 2px; text-align:center; font-weight:bold; color:#581c87; background-color:#faf5ff;">
                ${outCount > 0 ? `<span style="padding:1px 4px; border-radius:4px; background-color:#f3e8ff; color:#6b21a8; font-size:9.5px; font-weight:bold;">${outCount} วัน</span>` : `<span style="color:#94a3b8; font-weight:normal;">0</span>`}
              </td>
            </tr>
          `;
        }).join("");

    // Build Header Days Row
    const headerDaysHtml = daysArray.map((d) => {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = THAI_DAYS_SHORT[dateObj.getDay()];
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const thBg = isWeekend ? "background-color:#fef3c7; color:#78350f;" : "background-color:#f1f5f9; color:#1e293b;";
      return `
        <th style="border:1px solid #94a3b8; padding:2px 1px; text-align:center; min-width:20px; ${thBg}">
          <div style="font-size:10px; line-height:1;">${d}</div>
          <div style="font-size:8px; font-weight:normal; color:#64748b; line-height:1; margin-top:2px;">${dayOfWeek}</div>
        </th>
      `;
    }).join("");

    // Summary Rows
    const totalRowCells = daysArray.map((d) => {
      return `<td style="border:1px solid #94a3b8; padding:2px 1px; text-align:center; font-size:9.5px;">${roomData.dayStats[d]?.total || roomData.totalStudents}</td>`;
    }).join("");

    const presentRowCells = daysArray.map((d) => {
      const val = roomData.dayStats[d]?.present;
      return `<td style="border:1px solid #94a3b8; padding:2px 1px; text-align:center; font-size:9.5px; color:#047857; font-weight:bold;">${val > 0 ? val : "-"}</td>`;
    }).join("");

    const outRowCells = daysArray.map((d) => {
      const val = roomData.dayStats[d]?.out;
      return `<td style="border:1px solid #94a3b8; padding:2px 1px; text-align:center; font-size:9.5px; color:#be123c; font-weight:bold;">${val > 0 ? val : "-"}</td>`;
    }).join("");

    return `
      <div class="monthly-print-page" style="${isLast ? 'page-break-after:auto; break-after:auto;' : ''}">
        <!-- Header -->
        <div style="text-align:center; margin-bottom:10px; padding-bottom:6px;">
          <h1 style="font-size:16px; font-weight:800; color:#0f172a; margin:0 0 2px 0;">${schoolName}</h1>
          <h2 style="font-size:13px; font-weight:700; color:#1e293b; margin:0 0 4px 0;">สรุปเช็คยอดนักเรียนประจำเดือน ${monthTitle}</h2>
          <div style="display:inline-block; padding:2px 12px; background-color:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; font-size:11.5px; font-weight:700; color:#0f172a;">
            นักเรียนระดับชั้น ${roomData.fullTitle} (จำนวน ${roomData.totalStudents} คน)
          </div>
        </div>

        <!-- Table -->
        <div style="flex:1; overflow-x:auto;">
          <table style="width:100%; font-size:10px; border-collapse:collapse; border:1px solid #94a3b8;">
            <thead>
              <tr style="background-color:#f1f5f9; color:#0f172a; font-weight:bold;">
                <th style="border:1px solid #94a3b8; padding:4px 2px; width:28px; text-align:center;">เลขที่</th>
                <th style="border:1px solid #94a3b8; padding:4px 6px; min-width:130px; text-align:left;">ชื่อ - สกุล นักเรียน</th>
                ${headerDaysHtml}
                <th style="border:1px solid #94a3b8; padding:4px 4px; min-width:75px; text-align:center; background-color:#faf5ff; color:#4a044e; font-weight:800; line-height:1.2;">
                  สรุปนักเรียน<br>ออกหอพัก/วัน
                </th>
              </tr>
            </thead>
            <tbody>
              ${studentRowsHtml}

              <!-- Summary Rows -->
              <tr style="background-color:#f1f5f9; font-weight:bold; color:#0f172a; border-top:2px solid #64748b;">
                <td colspan="2" style="border:1px solid #94a3b8; padding:3px 6px; text-align:right; font-weight:800;">รวมนักเรียนทั้งหมด (คน)</td>
                ${totalRowCells}
                <td style="border:1px solid #94a3b8; padding:3px 2px; text-align:center; font-weight:800; background-color:#f3e8ff; color:#4a044e;">${roomData.totalStudents}</td>
              </tr>
              <tr style="background-color:#ecfdf5; font-weight:bold; color:#064e3b;">
                <td colspan="2" style="border:1px solid #94a3b8; padding:3px 6px; text-align:right; font-weight:800; color:#065f46;">อยู่หอพัก (คน)</td>
                ${presentRowCells}
                <td style="border:1px solid #94a3b8; padding:3px 2px; text-align:center; font-weight:800; color:#065f46;">-</td>
              </tr>
              <tr style="background-color:#fff1f2; font-weight:bold; color:#881337;">
                <td colspan="2" style="border:1px solid #94a3b8; padding:3px 6px; text-align:right; font-weight:800; color:#9f1239;">ออกหอพัก (คน)</td>
                ${outRowCells}
                <td style="border:1px solid #94a3b8; padding:3px 2px; text-align:center; font-weight:800; color:#9f1239;">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Legend -->
        <div style="margin-top:10px; padding-top:6px; page-break-inside:avoid; break-inside:avoid;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px; font-size:9.5px; color:#334155; background-color:#f8fafc; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;">
            <span style="font-weight:800; color:#0f172a;">คำอธิบายสัญลักษณ์และอักษรย่อ:</span>
            <span><strong style="color:#059669; font-size:11px;">✓</strong> = อยู่หอพัก</span>
            <span><strong style="color:#78350f; background-color:#fef08a; padding:1px 4px; border-radius:3px; border:1px solid #fde047;">รบ</strong> = รอบกลับบ้าน (สีเหลือง)</span>
            <span><strong style="color:#c2410c;">กบ</strong> = กลับบ้าน (สีส้ม)</span>
            <span><strong style="color:#1d4ed8;">ค</strong> = เข้าค่าย (สีน้ำเงิน)</span>
            <span><strong style="color:#e11d48;">ป</strong> = ป่วย (สีแดง)</span>
            <span><strong style="color:#7e22ce;">ท</strong> = แข่งทักษะ (สีม่วง)</span>
            <span><strong style="color:#0284c7;">ลป</strong> = แลกเปลี่ยน (สีฟ้า)</span>
            <span><strong style="color:#78350f;">อ</strong> = อื่นๆ (สีน้ำตาล)</span>
          </div>
        </div>
      </div>
    `;
  }).join("\n");

  const htmlDocument = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actualFileName.replace(".html", "")}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 8mm 8mm 20mm; /* 20mm left margin for binding */
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
      padding: 16px;
      color: #0f172a;
    }
    .monthly-print-page {
      width: 285mm;
      min-height: 194mm;
      margin: 0 auto 20px auto;
      background: #ffffff;
      padding: 8mm 10mm 8mm 18mm;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .monthly-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    @media print {
      body {
        background: transparent !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .monthly-print-page {
        width: 100% !important;
        min-height: 100% !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        outline: none !important;
        background: transparent !important;
      }
    }
  </style>
</head>
<body>
  <div style="max-width:297mm; margin:0 auto;">
    ${pagesHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = actualFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a standalone HTML file formatted in A4 Landscape
 * Each classroom is separated with a clean CSS page break (1 page per classroom).
 */
export function exportMonthlyReportHtmlDocument(
  containerId: string,
  fileName: string = "รายงานสรุปเช็คยอดนักเรียนประจำเดือน.html"
): void {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`ไม่พบองค์ประกอบรายงาน id "${containerId}"`);
  }

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
      size: A4 landscape;
      /* Top, Right, Bottom, Left (Left 20mm for binding / punching holes) */
      margin: 8mm 8mm 8mm 20mm;
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
      padding: 16px;
      color: #0f172a;
    }
    .monthly-print-page {
      width: 285mm;
      min-height: 194mm;
      margin: 0 auto 20px auto;
      background: white;
      padding: 8mm 10mm 8mm 18mm; /* Left 18mm padding on screen preview for binding */
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .monthly-print-page:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #94a3b8;
      text-align: center;
      padding: 2px 1px;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    @media print {
      body {
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .monthly-print-page {
        width: 100% !important;
        min-height: 100% !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        outline: none !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="max-w-[297mm] mx-auto">
    ${container.innerHTML}
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
 * Export Monthly Report data to Excel with individual sheets per classroom
 */
export function exportMonthlyReportToExcel(
  roomsData: MonthlyRoomData[],
  year: number,
  month: number,
  schoolName: string = "โรงเรียนพิจิตรปัญญานุกูล",
  fileName?: string
): void {
  const wb = XLSX.utils.book_new();
  const daysInMonth = getDaysInMonth(year, month);
  const monthTitle = formatThaiMonthYear(year, month);
  const actualFileName = fileName || `รายงานสรุปเช็คยอดนักเรียน_${THAI_MONTHS[month - 1]}_${year + 543}.xlsx`;

  roomsData.forEach((roomData) => {
    const rows: any[][] = [];

    // Header row 1: School Name
    rows.push([schoolName]);
    // Header row 2: Report Title
    rows.push([`สรุปเช็คยอดนักเรียนประจำเดือน ${monthTitle}`]);
    // Header row 3: Class Room Title
    rows.push([`นักเรียนระดับชั้น ${roomData.fullTitle}`]);
    rows.push([]); // Empty row

    // Table Header Row 1: Columns
    const headerCols: string[] = ["เลขที่", "ชื่อ - สกุล"];
    for (let d = 1; d <= daysInMonth; d++) {
      headerCols.push(d.toString());
    }
    headerCols.push("สรุปนักเรียนออกหอพัก/วัน");
    rows.push(headerCols);

    // Student rows
    roomData.students.forEach((student) => {
      const studentName = `${student.title || ""}${student.firstName} ${student.lastName}`;
      const row: (string | number)[] = [student.no, studentName];

      for (let d = 1; d <= daysInMonth; d++) {
        const att = roomData.attendanceMap[student.studentId]?.[d];
        if (!att || att.status === "NONE") {
          row.push("-");
        } else if (att.status === "PRESENT") {
          row.push("✓");
        } else {
          row.push(att.code); // รบ, กบ, ป, ท, ลป, อ
        }
      }

      const outCount = roomData.studentOutTotals[student.studentId] || 0;
      row.push(outCount);
      rows.push(row);
    });

    // Summary Rows
    // Total Students Row
    const totalRow: (string | number)[] = ["", "นักเรียนทั้งหมด"];
    for (let d = 1; d <= daysInMonth; d++) {
      totalRow.push(roomData.dayStats[d]?.total || roomData.totalStudents);
    }
    totalRow.push(roomData.totalStudents);
    rows.push(totalRow);

    // Present Row
    const presentRow: (string | number)[] = ["", "อยู่หอพัก (คน)"];
    for (let d = 1; d <= daysInMonth; d++) {
      presentRow.push(roomData.dayStats[d]?.present ?? "-");
    }
    presentRow.push("");
    rows.push(presentRow);

    // Out Row
    const outRow: (string | number)[] = ["", "ออกหอพัก (คน)"];
    for (let d = 1; d <= daysInMonth; d++) {
      outRow.push(roomData.dayStats[d]?.out ?? "-");
    }
    outRow.push("");
    rows.push(outRow);

    // Legend Row
    rows.push([]);
    rows.push(["คำอธิบายสัญลักษณ์และอักษรย่อ:"]);
    rows.push(["✓", "อยู่หอพัก", "รบ", "รอบกลับบ้าน", "กบ", "กลับบ้าน", "ค", "เข้าค่าย", "ป", "ป่วย", "ท", "แข่งทักษะ", "ลป", "แลกเปลี่ยน", "อ", "อื่นๆ"]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    const colWidths = [{ wch: 6 }, { wch: 25 }];
    for (let d = 1; d <= daysInMonth; d++) {
      colWidths.push({ wch: 4 });
    }
    colWidths.push({ wch: 24 });
    ws["!cols"] = colWidths;

    // Sheet Name: sanitize to max 31 chars
    const sheetName = roomData.roomKey.replace("/", "-").substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, actualFileName);
}
