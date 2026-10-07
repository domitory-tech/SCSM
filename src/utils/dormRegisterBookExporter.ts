import { DailyAttendance, Dormitory, Student, SystemSettings } from "../types";
import { formatGradeRoomShort, getDaysInMonth, THAI_DAYS_SHORT, THAI_MONTHS } from "./dateUtils";

// Thai National Fixed Holidays (Month is 1-indexed)
export const THAI_NATIONAL_HOLIDAYS: Record<string, string> = {
  "1-1": "วันขึ้นปีใหม่",
  "4-6": "วันจักรี",
  "4-13": "วันสงกรานต์",
  "4-14": "วันสงกรานต์",
  "4-15": "วันสงกรานต์",
  "5-1": "วันแรงงานแห่งชาติ",
  "5-4": "วันฉัตรมงคล",
  "6-3": "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี",
  "7-28": "วันเฉลิมพระชนมพรรษา ร.10",
  "8-12": "วันแม่แห่งชาติ",
  "10-13": "วันนวมินทรมหาราช",
  "10-23": "วันปิยมหาราช",
  "12-5": "วันพ่อแห่งชาติ",
  "12-10": "วันรัฐธรรมนูญ",
  "12-31": "วันสิ้นปี"
};

/**
 * Returns holiday description if the given date is a Thai national holiday, or null
 */
export function getThaiHolidayInfo(month: number, day: number): string | null {
  const key = `${month}-${day}`;
  return THAI_NATIONAL_HOLIDAYS[key] || null;
}

/**
 * Checks if a given day is a weekend (Saturday/Sunday) or national holiday
 */
export function isWeekendOrHoliday(year: number, month: number, day: number): {
  isHoliday: boolean;
  isWeekend: boolean;
  holidayName: string | null;
  dayOfWeekIndex: number;
  dayOfWeekName: string;
} {
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeekIndex = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
  const holidayName = getThaiHolidayInfo(month, day);
  const isHoliday = isWeekend || Boolean(holidayName);

  return {
    isHoliday,
    isWeekend,
    holidayName,
    dayOfWeekIndex,
    dayOfWeekName: THAI_DAYS_SHORT[dayOfWeekIndex]
  };
}

export interface DormRegisterBookData {
  dorm: Dormitory;
  year: number; // CE e.g. 2026
  month: number; // 1-12 e.g. 10
  students: Student[];
  attendanceRecords?: DailyAttendance[];
  systemSettings?: SystemSettings;
  orientation?: "portrait" | "landscape";
  mode?: "blank" | "filled"; // "blank" = empty boxes for hand marking, "filled" = filled with system records
  studentsPerPage?: number;
}

export const ATTENDANCE_LEGEND_ITEMS = [
  { code: "✓", label: "อยู่หอพัก", desc: "อยู่หอพักตามปกติ" },
  { code: "รบ", label: "รอบกลับบ้าน", desc: "รอบกลับบ้านตามรอบโรงเรียน" },
  { code: "กบ", label: "กลับบ้าน", desc: "กลับบ้านกรณีพิเศษ/ผู้ปกครองรับ" },
  { code: "ค", label: "เข้าค่าย", desc: "เข้าค่ายวิชาการ/ลูกเสือ" },
  { code: "ป", label: "ป่วย", desc: "ป่วย/พักรักษาตัว" },
  { code: "ท", label: "แข่งทักษะ", desc: "เข้าร่วมแข่งขันวิชาการ/ทักษะ" },
  { code: "ลป", label: "แลกเปลี่ยน", desc: "โครงการนักเรียนแลกเปลี่ยน" },
  { code: "ดร", label: "เดินเรียน", desc: "เดินเรียนภายนอก" },
  { code: "ปภ", label: "ปิดภาคเรียน", desc: "ช่วงปิดภาคเรียน" },
  { code: "ยห", label: "ยังไม่เข้าหอพัก", desc: "ยังไม่รายงานตัวเข้าหอพัก" },
  { code: "อ", label: "อื่นๆ", desc: "เหตุผลอื่นๆ ตามที่แจ้ง" }
];

export const ATTENDANCE_CODE_MAPPING: Record<string, string> = {
  PRESENT: "✓",
  ROUND_HOME: "รบ",
  HOME: "กบ",
  CAMP: "ค",
  SICK: "ป",
  SKILL_COMP: "ท",
  EXCHANGE: "ลป",
  WALK_STUDY: "ดร",
  SEMESTER_BREAK: "ปภ",
  NOT_ARRIVED: "ยห",
  OTHER: "อ"
};

/**
 * Helper to extract numeric grade level for sorting (e.g. "ม.1" -> 11, "ป.1" -> 1, "ม.6" -> 16)
 */
export function extractGradeNumber(gradeStr?: string): number {
  if (!gradeStr) return 999;
  const match = String(gradeStr).match(/\d+/);
  if (!match) return 999;
  const num = parseInt(match[0], 10);
  if (String(gradeStr).includes("ป.")) {
    return num;
  }
  return num + 10;
}

export function extractRoomNumber(roomVal?: number | string): number {
  if (roomVal === undefined || roomVal === null || roomVal === "") return 999;
  const match = String(roomVal).match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

export function extractNoNumber(noVal?: number): number {
  if (noVal === undefined || noVal === null || isNaN(noVal)) return 9999;
  return Number(noVal);
}

/**
 * Sorts students from low to high: Grade/Room first, then Student No.
 * เรียงจากน้อยไปหามาก: ชั้น/ห้อง ตามด้วยเลขที่
 */
export function compareStudentByGradeRoomAndNo(a: Student, b: Student): number {
  // 1. Grade level (ม.1 < ม.2 < ... < ม.6)
  const gradeA = extractGradeNumber(a.grade);
  const gradeB = extractGradeNumber(b.grade);
  if (gradeA !== gradeB) {
    return gradeA - gradeB;
  }

  // 2. Room number (/1 < /2 < /3)
  const roomA = extractRoomNumber(a.room);
  const roomB = extractRoomNumber(b.room);
  if (roomA !== roomB) {
    return roomA - roomB;
  }

  // 3. Student No. (เลขที่ 1 < 2 < 3 ...)
  const noA = extractNoNumber(a.no);
  const noB = extractNoNumber(b.no);
  if (noA !== noB) {
    return noA - noB;
  }

  const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim();
  const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim();
  return nameA.localeCompare(nameB, "th");
}

/**
 * Triggers print via invisible iframe or new window or direct print
 */
export function triggerPrintDormBook(htmlContent: string, fileName: string = "สมุดเช็คยอดนักเรียนประจำเดือน") {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const printWin = window.open(url, "_blank");
  if (printWin) {
    printWin.focus();
  } else {
    try {
      const existingFrame = document.getElementById("direct-print-frame-dorm");
      if (existingFrame) {
        document.body.removeChild(existingFrame);
      }
      const iframe = document.createElement("iframe");
      iframe.id = "direct-print-frame-dorm";
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
 * Exports Dorm Attendance Register Book as a complete, standalone, print-optimized HTML document.
 */
export function exportDormRegisterBookHtml(data: DormRegisterBookData): string {
  const {
    dorm,
    year,
    month,
    students,
    attendanceRecords = [],
    systemSettings,
    orientation = "landscape",
    mode = "blank",
    studentsPerPage = orientation === "landscape" ? 22 : 28
  } = data;

  const yearBE = year + 543;
  const monthName = THAI_MONTHS[month - 1] || "";
  const daysInMonth = getDaysInMonth(year, month);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";
  const teacherName = dorm.teacherName || "-";
  const dormTypeLabel = dorm.type === "male" ? "หอพักชาย" : dorm.type === "female" ? "หอพักหญิง" : "หอพักรวม";

  // Build daily attendance lookup map if mode is "filled"
  // Map: studentId -> dayNumber -> code
  const studentDailyCodes: Record<string, Record<number, string>> = {};
  if (mode === "filled" && attendanceRecords.length > 0) {
    const monthStr = String(month).padStart(2, "0");
    const yearMonthPrefix = `${year}-${monthStr}-`;

    attendanceRecords.forEach((att) => {
      if (!att.date || !att.date.startsWith(yearMonthPrefix)) return;
      // Match dorm
      if (att.dormId && att.dormId !== dorm.id && !att.dormId.includes(dorm.name)) return;

      const dayNum = parseInt(att.date.split("-")[2], 10);
      if (isNaN(dayNum)) return;

      if (att.records && Array.isArray(att.records)) {
        att.records.forEach((rec) => {
          if (!studentDailyCodes[rec.studentId]) {
            studentDailyCodes[rec.studentId] = {};
          }
          const mappedCode = ATTENDANCE_CODE_MAPPING[rec.status] || (rec.status ? "✓" : "");
          studentDailyCodes[rec.studentId][dayNum] = mappedCode;
        });
      }
    });
  }

  // Sort students from low to high: Grade/Room first, then Student No.
  const sortedStudents = [...students].sort(compareStudentByGradeRoomAndNo);

  // Chunk students into pages
  const chunks: Student[][] = [];
  if (sortedStudents.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < sortedStudents.length; i += studentsPerPage) {
      chunks.push(sortedStudents.slice(i, i + studentsPerPage));
    }
  }

  const totalPages = chunks.length;
  const isLandscape = orientation === "landscape";

  const pagesHtml = chunks.map((chunk, pageIndex) => {
    const isLastPage = pageIndex === totalPages - 1;

    // Student rows HTML
    const studentRowsHtml = chunk.length === 0
      ? `<tr><td colspan="${daysInMonth + 4}" style="padding: 24px; text-align: center; color: #64748b; font-size: 12px; border: 1px solid #cbd5e1;">ไม่มีข้อมูลนักเรียนในหอพักนี้</td></tr>`
      : chunk.map((std, idx) => {
          const rowNo = pageIndex * studentsPerPage + idx + 1;
          const fullName = `${std.title || ""}${std.firstName || ""} ${std.lastName || ""}`.trim();
          const nickname = std.nickname ? `(${std.nickname})` : "-";
          const gradeRoom = formatGradeRoomShort(std.grade, std.room);
          const bgTr = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

          const dayCells = daysArray.map((day) => {
            const dayInfo = isWeekendOrHoliday(year, month, day);
            const holidayBg = dayInfo.isHoliday ? "background-color: #fef2f2;" : "";
            const weekendBorder = dayInfo.isHoliday ? "border-color: #fca5a5;" : "border-color: #cbd5e1;";

            let cellContent = "";
            let cellStyle = "";

            if (mode === "filled") {
              const code = studentDailyCodes[std.studentId]?.[day] || "";
              if (code === "✓") {
                cellContent = "✓";
                cellStyle = "color: #059669; font-weight: bold; font-size: 11px;";
              } else if (code === "รบ") {
                cellContent = "รบ";
                cellStyle = "color: #b45309; font-weight: bold; font-size: 9.5px; background-color: #fef08a;";
              } else if (code) {
                cellContent = code;
                cellStyle = "color: #b91c1c; font-weight: bold; font-size: 9.5px;";
              }
            }

            return `<td style="border: 1px solid #cbd5e1; ${weekendBorder} ${holidayBg} ${cellStyle} text-align: center; padding: 2px 1px; width: ${isLandscape ? "24px" : "18px"}; height: 22px; font-family: Sarabun, sans-serif;">${cellContent}</td>`;
          }).join("");

          return `
            <tr style="background-color: ${bgTr};">
              <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: 600; font-size: 11px; padding: 3px 2px; color: #1e293b;">${std.no || rowNo}</td>
              <td style="border: 1px solid #cbd5e1; text-align: left; font-size: 11px; padding: 3px 6px; white-space: nowrap; color: #0f172a; font-weight: 500;">${fullName}</td>
              <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; padding: 3px 4px; white-space: nowrap; color: #475569;">${nickname}</td>
              <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10.5px; padding: 3px 4px; white-space: nowrap; color: #475569; font-weight: 600;">${gradeRoom}</td>
              ${dayCells}
            </tr>
          `;
        }).join("");

    // Table Header Days
    const dayNumbersHtml = daysArray.map((day) => {
      const dayInfo = isWeekendOrHoliday(year, month, day);
      const bg = dayInfo.isHoliday ? "background-color: #fee2e2; color: #b91c1c;" : "background-color: #f1f5f9; color: #334155;";
      return `<th style="border: 1px solid #94a3b8; ${bg} font-size: 10px; font-weight: bold; text-align: center; padding: 2px 0; width: ${isLandscape ? "24px" : "18px"};">${day}</th>`;
    }).join("");

    const dayNamesHtml = daysArray.map((day) => {
      const dayInfo = isWeekendOrHoliday(year, month, day);
      const bg = dayInfo.isHoliday ? "background-color: #fee2e2; color: #b91c1c;" : "background-color: #f8fafc; color: #64748b;";
      return `<th style="border: 1px solid #94a3b8; ${bg} font-size: 8.5px; font-weight: normal; text-align: center; padding: 1px 0;">${dayInfo.dayOfWeekName}</th>`;
    }).join("");

    return `
      <div class="page-container ${isLandscape ? "page-landscape" : "page-portrait"}" style="${!isLastPage ? "page-break-after: always; break-after: page;" : ""}">
        <!-- Header Section -->
        <div class="page-header" style="text-align: center; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: bold; color: #475569;">${schoolName}</div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 2px 0 4px 0;">
            สมุดเช็คยอดนักเรียนประจำเดือน เดือน${monthName} พ.ศ. ${yearBE}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #334155; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px;">
            <div><strong>หอพัก:</strong> ${dorm.name} (${dormTypeLabel})</div>
            <div><strong>ครูประจำหอพัก:</strong> ${teacherName}</div>
            <div><strong>นักเรียนทั้งหมด:</strong> ${sortedStudents.length} คน</div>
            <div><strong>หน้า:</strong> ${pageIndex + 1} / ${totalPages}</div>
          </div>
        </div>

        <!-- Main Roster Table -->
        <table class="roster-table" style="width: 100%; border-collapse: collapse; font-family: Sarabun, sans-serif;">
          <thead>
            <tr>
              <th rowspan="2" style="border: 1px solid #94a3b8; background-color: #e2e8f0; font-size: 10.5px; font-weight: bold; width: 32px; text-align: center; padding: 3px 2px;">เลขที่</th>
              <th rowspan="2" style="border: 1px solid #94a3b8; background-color: #e2e8f0; font-size: 10.5px; font-weight: bold; text-align: center; padding: 3px 6px; width: ${isLandscape ? "170px" : "130px"};">ชื่อ - สกุล นักเรียน</th>
              <th rowspan="2" style="border: 1px solid #94a3b8; background-color: #e2e8f0; font-size: 10.5px; font-weight: bold; width: 50px; text-align: center; padding: 3px 4px;">ชื่อเล่น</th>
              <th rowspan="2" style="border: 1px solid #94a3b8; background-color: #e2e8f0; font-size: 10.5px; font-weight: bold; width: 50px; text-align: center; padding: 3px 4px;">ชั้น/ห้อง</th>
              <th colspan="${daysInMonth}" style="border: 1px solid #94a3b8; background-color: #e2e8f0; font-size: 10.5px; font-weight: bold; text-align: center; padding: 2px;">วันที่ 1 - สิ้นเดือน (ไฮไลท์สีวันหยุด/เสาร์-อาทิตย์)</th>
            </tr>
            <tr>
              ${dayNumbersHtml}
            </tr>
            <tr style="height: 14px;">
              <th colspan="4" style="border: 1px solid #cbd5e1; background-color: #f1f5f9; font-size: 8.5px; text-align: right; padding-right: 6px; color: #64748b;">วันในสัปดาห์:</th>
              ${dayNamesHtml}
            </tr>
          </thead>
          <tbody>
            ${studentRowsHtml}
          </tbody>
        </table>

        <!-- Footer Legend -->
        <div class="page-footer" style="margin-top: 8px;">
          <!-- Legend Box -->
          <div style="border: 1px solid #94a3b8; background-color: #f8fafc; border-radius: 4px; padding: 5px 8px; font-size: 9.5px; line-height: 1.4; color: #1e293b;">
            <div style="font-weight: bold; margin-bottom: 2px; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
              <span>คำอธิบายสัญลักษณ์และอักษรย่อ:</span>
              <span style="font-size: 8.5px; font-weight: normal; color: #b91c1c;">(ช่องสีชมพู/แดงอ่อน = วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px 14px;">
              <span><strong>✓</strong> = อยู่หอพัก</span>
              <span><strong>รบ</strong> = รอบกลับบ้าน</span>
              <span><strong>กบ</strong> = กลับบ้าน</span>
              <span><strong>ค</strong> = เข้าค่าย</span>
              <span><strong>ป</strong> = ป่วย</span>
              <span><strong>ท</strong> = แข่งทักษะ</span>
              <span><strong>ลป</strong> = แลกเปลี่ยน</span>
              <span><strong>ดร</strong> = เดินเรียน</span>
              <span><strong>ปภ</strong> = ปิดภาคเรียน</span>
              <span><strong>ยห</strong> = ยังไม่เข้าหอพัก</span>
              <span><strong>อ</strong> = อื่นๆ</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>สมุดเช็คยอดนักเรียน_${dorm.name}_เดือน${monthName}_${yearBE}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 ${isLandscape ? "landscape" : "portrait"};
      margin: 8mm 6mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      color: #0f172a;
    }

    .page-container {
      background-color: #ffffff;
      margin: 0 auto 16px auto;
      padding: 10mm 8mm;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .page-landscape {
      width: 297mm;
      min-height: 210mm;
    }

    .page-portrait {
      width: 210mm;
      min-height: 297mm;
    }

    .roster-table {
      border-collapse: collapse;
      width: 100%;
    }

    .roster-table th, .roster-table td {
      border: 1px solid #cbd5e1;
    }

    @media print {
      body {
        background-color: #ffffff !important;
      }

      .page-container {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: auto !important;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 12px; right: 16px; z-index: 9999; display: flex; gap: 8px;">
    <button onclick="window.print()" style="padding: 8px 16px; background-color: #a05aff; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
      🖨️ สั่งพิมพ์เอกสาร (Print A4)
    </button>
  </div>
  ${pagesHtml}
</body>
</html>`;
}
