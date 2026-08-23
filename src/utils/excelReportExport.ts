import * as XLSX from "xlsx";
import { DailyReportData, Dormitory, UserProfile } from "../types";
import { formatThaiFullDate } from "./dateUtils";

export const GOOGLE_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg?usp=sharing";
export const GOOGLE_DRIVE_FOLDER_ID = "17hrwt9Dy_liRz9sSte2PKOpO0QYqwcGg";

/**
 * Generates and triggers download of a beautifully formatted Excel (.xlsx) file
 * containing the complete Daily Dormitory Report (Daily Summary, Absent List, Orientations, Signatures).
 */
export function exportDailyReportToExcel(
  reportData: DailyReportData,
  schoolName: string = "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย",
  currentUser?: UserProfile | null
) {
  const wb = XLSX.utils.book_new();

  const formattedReportDateStr = formatThaiFullDate(reportData.reportDate);
  const formattedSummaryDateStr = formatThaiFullDate(reportData.summaryDate);

  const reporterName = currentUser?.name?.trim() || "";
  const reporterPosition =
    currentUser?.dormPosition ||
    (currentUser?.roleLabel ? currentUser.roleLabel.replace(/\s*\(.*?\)/g, "").trim() : "") ||
    "เจ้าหน้าที่สำนักงาน";

  // ==================== SHEET 1: สรุปยอดจำนวนนักเรียน ====================
  const sheet1Data: any[][] = [];

  // Title Block (Matching UI header)
  sheet1Data.push(["รายงานสรุปยอดจำนวนนักเรียนในหอพักประจำวัน"]);
  sheet1Data.push([schoolName]);
  sheet1Data.push([`(สรุปรายงานเช็คยอดประจำวัน  ${formattedReportDateStr} )`]);
  sheet1Data.push([`(สรุปนักเรียนออกหอพักคืนวัน ${formattedSummaryDateStr})`]);
  sheet1Data.push([]); // blank row

  // 1. ตารางจำนวนนักเรียนทั้งหมด
  sheet1Data.push(["1. ตารางจำนวนนักเรียนทั้งหมด"]);
  sheet1Data.push(["หอพัก / ชั้น", ...reportData.grades, "รวม"]);

  reportData.dormitories.forEach((d) => {
    sheet1Data.push([
      d.name,
      ...reportData.grades.map((g) => reportData.totalMatrix[d.id]?.[g] || 0),
      reportData.dormTotals[d.id]?.total || 0
    ]);
  });
  sheet1Data.push([
    "รวมทั้งสิ้น",
    ...reportData.grades.map((g) => reportData.gradeTotals[g]?.total || 0),
    reportData.grandTotals.total
  ]);
  sheet1Data.push([]); // blank row

  // 2. ตารางจำนวนนักเรียนออกหอพัก
  sheet1Data.push(["2. ตารางจำนวนนักเรียนออกหอพัก"]);
  sheet1Data.push(["หอพัก / ชั้น", ...reportData.grades, "รวมออก"]);

  reportData.dormitories.forEach((d) => {
    sheet1Data.push([
      d.name,
      ...reportData.grades.map((g) => reportData.outMatrix[d.id]?.[g] || 0),
      reportData.dormTotals[d.id]?.out || 0
    ]);
  });
  sheet1Data.push([
    "รวมทั้งสิ้น",
    ...reportData.grades.map((g) => reportData.gradeTotals[g]?.out || 0),
    reportData.grandTotals.out
  ]);
  sheet1Data.push([]); // blank row

  // 3. ตารางจำนวนนักเรียนคงเหลือแต่ละหอพัก
  sheet1Data.push(["3. ตารางจำนวนนักเรียนคงเหลือแต่ละหอพัก"]);
  sheet1Data.push(["หอพัก / ชั้น", ...reportData.grades, "คงเหลือ"]);

  reportData.dormitories.forEach((d) => {
    sheet1Data.push([
      d.name,
      ...reportData.grades.map((g) => reportData.remainingMatrix[d.id]?.[g] || 0),
      reportData.dormTotals[d.id]?.remaining || 0
    ]);
  });
  sheet1Data.push([
    "รวมทั้งสิ้น",
    ...reportData.grades.map((g) => reportData.gradeTotals[g]?.remaining || 0),
    reportData.grandTotals.remaining
  ]);
  sheet1Data.push([]); // blank row

  // 4. สรุปภาพรวมสถิตินักเรียนทั้งหมดในหอพัก
  sheet1Data.push(["4. สรุปภาพรวมสถิตินักเรียนทั้งหมดในหอพัก"]);
  sheet1Data.push(["รายการสถิติ", "จำนวน (คน)", "คิดเป็นร้อยละ (%)"]);
  sheet1Data.push(["นักเรียนหอพักทั้งหมด", reportData.grandTotals.total, "100.00%"]);
  sheet1Data.push([
    "นักเรียนที่อยู่ในหอพัก (ปกติ)",
    reportData.grandTotals.remaining,
    `${((reportData.grandTotals.remaining / (reportData.grandTotals.total || 1)) * 100).toFixed(2)}%`
  ]);
  sheet1Data.push([
    "นักเรียนที่ไม่อยู่หอพัก (ออกหอ/ลา/กลับบ้าน/ป่วย)",
    reportData.grandTotals.out,
    `${((reportData.grandTotals.out / (reportData.grandTotals.total || 1)) * 100).toFixed(2)}%`
  ]);
  sheet1Data.push([]); // blank row

  // 5. ช่องลงนามรับรอง
  sheet1Data.push(["5. ช่องลงนามรับรอง"]);
  sheet1Data.push([
    "ลงชื่อ............................................................",
    "",
    "ลงชื่อ............................................................",
    "",
    "ลงชื่อ............................................................"
  ]);
  sheet1Data.push([
    reporterName ? `( ${reporterName} )` : "(.....................................................)",
    "",
    "(.....................................................)",
    "",
    "(.....................................................)"
  ]);
  sheet1Data.push([
    "ตำแหน่ง เจ้าหน้าที่สำนักงาน",
    "",
    "หัวหน้างานหอพัก",
    "",
    "รองผู้อำนวยการ"
  ]);
  sheet1Data.push([
    "ผู้รายงาน",
    "",
    "",
    "",
    ""
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  ws1["!cols"] = [
    { wch: 24 }, // Dorm name / Item
    { wch: 12 }, // M1
    { wch: 12 }, // M2
    { wch: 12 }, // M3
    { wch: 12 }, // M4
    { wch: 12 }, // M5
    { wch: 12 }, // M6
    { wch: 18 }  // Total
  ];

  ws1["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // School name
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, // Dates
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } }, // Table 1 Title
    { s: { r: 13, c: 0 }, e: { r: 13, c: 7 } }, // Table 2 Title
    { s: { r: 22, c: 0 }, e: { r: 22, c: 7 } }, // Table 3 Title
    { s: { r: 31, c: 0 }, e: { r: 31, c: 7 } }, // Table 4 Title
    { s: { r: 37, c: 0 }, e: { r: 37, c: 7 } }  // Section 5 Title
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "1_สรุปยอดนักเรียน");

  // ==================== SHEET 2: รายชื่อนักเรียนออกหอพัก ====================
  const sheet2Data: any[][] = [];
  sheet2Data.push(["ตารางรายชื่อนักเรียนออกหอพัก"]);
  sheet2Data.push([schoolName]);
  sheet2Data.push([`(สรุปรายงานประจำวัน  ${formattedReportDateStr} )`]);
  sheet2Data.push([`(สรุปรายชื่อนักเรียนออกหอพักคืนวัน ${formattedSummaryDateStr})`]);
  sheet2Data.push([]);

  sheet2Data.push(["ที่", "รหัสนักเรียน", "รายชื่อนักเรียน", "ระดับชั้น/ห้อง", "หอพัก", "เหตุผลที่ออกหอพัก"]);

  if (reportData.absentStudentsList.length === 0) {
    sheet2Data.push(["-", "-", "ไม่มีนักเรียนออกหอพักเมื่อคืนนี้ (นักเรียนอยู่หอพักครบทุกคน)", "-", "-", "-"]);
  } else {
    reportData.absentStudentsList.forEach((s) => {
      sheet2Data.push([
        s.no,
        s.studentId,
        s.fullName,
        s.gradeRoom,
        s.dormName,
        s.reason
      ]);
    });
  }
  sheet2Data.push([]);
  sheet2Data.push(["รวมนักเรียนออกหอพักทั้งหมด:", `${reportData.absentStudentsList.length} คน`]);

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2["!cols"] = [
    { wch: 8 },   // ที่
    { wch: 16 },  // รหัสนักเรียน
    { wch: 30 },  // รายชื่อนักเรียน
    { wch: 18 },  // ระดับชั้น/ห้อง
    { wch: 18 },  // หอพัก
    { wch: 38 }   // เหตุผลที่ออกหอพัก
  ];

  ws2["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }
  ];

  XLSX.utils.book_append_sheet(wb, ws2, "2_รายชื่อนักเรียนออกหอพัก");

  // ==================== SHEET 3: เรื่องแจ้งอบรมประจำวัน ====================
  const sheet3Data: any[][] = [];
  sheet3Data.push(["ใบรายงานเรื่องแจ้งอบรมประจำวัน"]);
  sheet3Data.push([schoolName]);
  sheet3Data.push([`(สรุปรายงานอบรมประจำวัน  ${formattedReportDateStr} )`]);
  sheet3Data.push([`(สรุปเรื่องแจ้งอบรมนักเรียนคืนวัน ${formattedSummaryDateStr})`]);
  sheet3Data.push([]);

  if (reportData.headTeacherNotices && reportData.headTeacherNotices.length > 0) {
    sheet3Data.push(["เรื่องแจ้งอบรมจากหัวหน้างานหอพัก"]);
    reportData.headTeacherNotices.forEach((n, idx) => {
      sheet3Data.push([`📌 เรื่อง: ${n.title}`, `โดย: ${n.createdBy || "หัวหน้างานหอพัก"}`]);
      n.topics.forEach((tp) => {
        sheet3Data.push([`   • ${tp}`]);
      });
    });
    sheet3Data.push([]);
  }

  sheet3Data.push(["เรื่องที่ครูประจำหอพักอบรมนักเรียน"]);
  sheet3Data.push(["หอพัก", "ครูผู้บันทึก (ครูประจำหอพัก)", "หัวข้อ / เรื่องที่แจ้งอบรมนักเรียน"]);

  const sortedOrientations = [...(reportData.dormTeacherOrientations || [])].sort((a, b) => {
    const numA = parseInt((a.dormName || a.dormId || "").replace(/\D/g, ""), 10);
    const numB = parseInt((b.dormName || b.dormId || "").replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return (a.dormName || "").localeCompare(b.dormName || "", "th", { numeric: true });
  });

  if (sortedOrientations.length > 0) {
    sortedOrientations.forEach((orient) => {
      const notes =
        orient.orientationNotes && orient.orientationNotes.length > 0
          ? orient.orientationNotes.join("; ")
          : "ไม่มีบันทึกเรื่องอบรม";
      sheet3Data.push([orient.dormName, orient.checkedBy || "ครูประจำหอพัก", notes]);
    });
  } else {
    sheet3Data.push(["-", "-", "ไม่มีข้อมูลเรื่องอบรมจากครูประจำหอพัก"]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 65 }
  ];

  ws3["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }
  ];

  XLSX.utils.book_append_sheet(wb, ws3, "3_เรื่องแจ้งอบรมประจำวัน");

  // Download filename
  const fileName = `รายงานสรุปยอดนักเรียนหอพักประจำวัน_${reportData.reportDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generates an Excel file for the Dormitory Layout Statistics table.
 */
export function exportDormLayoutToExcel(
  dormLayoutData: any,
  dorms: Dormitory[],
  schoolName: string = "โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย"
) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  rows.push([schoolName]);
  rows.push(["ตารางผังการจัดหอพักและสถิติจำนวนนักเรียนแยกชั้น/ห้อง/เพศ (Dormitory Layout Statistics)"]);
  rows.push([`วันที่จัดทำ: ${formatThaiFullDate(new Date().toISOString().split("T")[0])}`]);
  rows.push([]);

  // Summary Row by School and Gender
  rows.push(["สรุปยอดรวมจำแนกตามโรงเรียนและเพศ"]);
  rows.push(["โรงเรียน", "ชาย (คน)", "หญิง (คน)", "รวมทั้งหมด (คน)"]);
  rows.push(["จภ.ชร. (เชียงราย)", dormLayoutData.pccCR_Male || 0, dormLayoutData.pccCR_Female || 0, dormLayoutData.pccCR_Total || 0]);
  rows.push(["จภ.ลป. (ลำปาง)", dormLayoutData.pccLP_Male || 0, dormLayoutData.pccLP_Female || 0, dormLayoutData.pccLP_Total || 0]);
  rows.push(["รวมทั้งสิ้น", dormLayoutData.totalMale || 0, dormLayoutData.totalFemale || 0, dormLayoutData.totalStudents || 0]);
  rows.push([]);

  // Dorm Columns Header Row 1
  const headerDorms: string[] = [];
  dorms.forEach((d) => {
    headerDorms.push(d.name, "");
  });
  rows.push(headerDorms);

  // Header Row 2
  const headerSub: string[] = [];
  dorms.forEach(() => {
    headerSub.push("ระดับชั้น/เพศ", "จำนวน (คน)");
  });
  rows.push(headerSub);

  // Data Rows
  const maxRows = dormLayoutData.maxRows || 0;
  for (let r = 0; r < maxRows; r++) {
    const row: any[] = [];
    dorms.forEach((d) => {
      const activeKeys = dormLayoutData.dormActiveKeysMap[d.id] || [];
      const item = activeKeys[r];
      if (item) {
        row.push(item.key, item.count);
      } else {
        row.push("", "");
      }
    });
    rows.push(row);
  }

  // Footer Totals Row
  const footerRow: any[] = [];
  dorms.forEach((d) => {
    footerRow.push("รวมหอพักนี้", dormLayoutData.dormTotalsMap[d.id] || 0);
  });
  rows.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colsConfig: { wch: number }[] = [];
  dorms.forEach(() => {
    colsConfig.push({ wch: 18 }, { wch: 12 });
  });
  ws["!cols"] = colsConfig;

  XLSX.utils.book_append_sheet(wb, ws, "ผังการจัดหอพัก");
  XLSX.writeFile(wb, `ตารางผังการจัดหอพักและสถิตินักเรียน_${new Date().toISOString().split("T")[0]}.xlsx`);
}

