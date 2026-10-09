import { Dormitory, DormTeacher, Student, SystemSettings, UserProfile } from "../types";
import { formatThaiFullDate, getDirectImageUrl } from "./dateUtils";
import {
  getDormTeachers,
  getDormTypeLabel,
  getPositionBadgeStyle,
  getPositionDotColor,
  matchStudentToDorm
} from "./dormUtils";

export interface DormLayoutRoomGroup {
  roomName: string;
  roomKey: string;
  students: Student[];
}

export interface DormLayoutDormData {
  dorm: Dormitory;
  teachers: DormTeacher[];
  totalStudents: number;
  roomCount: number;
  roomGroups: DormLayoutRoomGroup[];
  gradeSummary: Record<string, number>;
}

export interface DormLayoutPrintOptions {
  dormsData: DormLayoutDormData[];
  systemSettings?: SystemSettings;
  orientation?: "portrait" | "landscape";
  currentUser?: UserProfile | null;
  documentTitle?: string;
}

// Bed row item interface for rowSpan handling
interface BedRowItem {
  student: Student;
  bedLabel: string;
  isFirstInBed: boolean;
  bedRowSpan: number;
  bedGroupIndex: number;
}

// Group students in a room by bed number (sorted 1 to N, merging rows if sharing bed)
function getRoomBedRows(studentsInRoom: Student[]): BedRowItem[] {
  const mapped = studentsInRoom.map((st, idx) => {
    let bedStr = "";
    const raw = (st.dormBed ?? (st as any).bed ?? "").toString().trim();
    if (raw) {
      bedStr = raw.startsWith("เตียง") ? raw : `เตียง ${raw}`;
    } else {
      bedStr = `เตียง ${idx + 1}`;
    }
    return {
      student: st,
      bedLabel: bedStr
    };
  });

  const result: BedRowItem[] = [];
  let currentBed = "";
  let groupCounter = 0;

  for (let i = 0; i < mapped.length; i++) {
    const item = mapped[i];
    if (i === 0 || item.bedLabel !== currentBed) {
      currentBed = item.bedLabel;
      groupCounter++;

      let span = 1;
      while (i + span < mapped.length && mapped[i + span].bedLabel === currentBed) {
        span++;
      }

      result.push({
        student: item.student,
        bedLabel: item.bedLabel,
        isFirstInBed: true,
        bedRowSpan: span,
        bedGroupIndex: groupCounter
      });
    } else {
      result.push({
        student: item.student,
        bedLabel: item.bedLabel,
        isFirstInBed: false,
        bedRowSpan: 0,
        bedGroupIndex: groupCounter
      });
    }
  }

  return result;
}

/**
 * Generates the complete, standalone print-optimized HTML for Dormitory Bedroom Layout (ผังการจัดห้องนอน).
 * Requirements:
 * - Page 1: ชื่อหอพัก ข้อมูลหอพัก ข้อมูลครูหอพักทั้งหมด และข้อมูลที่เกี่ยวข้อง (Cover/Master Page with page-break-after)
 * - Page 2+: แสดงตารางห้องนอน บน A4 แสดงจำนวน 2 คอลัมน์ต่อ 1 แถว (2 Columns per Row)
 * - รองรับทั้งแนวตั้ง (Portrait) และ แนวนอน (Landscape)
 */
export function generateDormLayoutPrintHtml(options: DormLayoutPrintOptions): string {
  const {
    dormsData,
    systemSettings,
    orientation = "portrait",
    documentTitle = "ผังการจัดห้องนอนนักเรียน"
  } = options;

  const isLandscape = orientation === "landscape";
  const todayText = formatThaiFullDate(new Date().toISOString().split("T")[0]);
  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";
  const schoolAcronym = systemSettings?.schoolAcronymTh ? `(${systemSettings.schoolAcronymTh})` : "";
  const schoolLogoUrl = systemSettings?.schoolLogoUrl ? getDirectImageUrl(systemSettings.schoolLogoUrl) : "";

  // Render each dormitory section
  const dormsHtml = dormsData.map((dData, dormIdx) => {
    const { dorm, teachers, totalStudents, roomCount, roomGroups, gradeSummary } = dData;
    const dormTypeTh = getDormTypeLabel(dorm, true);
    const capacity = dorm.capacity || 80;
    const occupancyRate = capacity > 0 ? ((totalStudents / capacity) * 100).toFixed(1) : "0.0";
    const availableBeds = Math.max(0, capacity - totalStudents);

    // Grade summary entries sorted
    const sortedGrades = Object.entries(gradeSummary).sort(([a], [b]) =>
      a.localeCompare(b, "th", { numeric: true })
    );

    // PAGE 1: Master Summary / Cover Page
    const page1Html = `
      <div class="print-page page-first ${isLandscape ? "page-landscape" : "page-portrait"}">
        <!-- School & Document Header -->
        <div class="header-container" style="border-bottom: 2px solid #6b21a8; padding-bottom: 12px; margin-bottom: 16px; text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px;">
            ${
              schoolLogoUrl
                ? `<img src="${schoolLogoUrl}" alt="School Logo" style="width: 48px; height: 48px; object-fit: contain;" />`
                : `<div style="width: 44px; height: 44px; border-radius: 12px; background: #6b21a8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px;">หอ</div>`
            }
            <div style="text-align: left;">
              <div style="font-size: 14px; font-weight: 800; color: #1e1b4b; line-height: 1.2;">
                ${schoolName}
              </div>
              <div style="font-size: 12px; color: #6b21a8; font-weight: 700;">
                งานหอพัก • กลุ่มบริหารกิจการนักเรียน
              </div>
            </div>
          </div>
          
          <h1 style="font-size: 20px; font-weight: 900; color: #1e1b4b; margin: 4px 0 2px 0; letter-spacing: -0.3px;">
            ผังการจัดห้องนอน ${dorm.name}
          </h1>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 3px;">
            ข้อมูล ณ ${todayText}
          </div>
        </div>

        <!-- Section 1: ข้อมูลหอพัก (Dormitory Information) -->
        <div class="section-box" style="margin-bottom: 16px;">
          <div class="section-title" style="font-size: 13px; font-weight: 800; color: #581c87; background: #faf5ff; border: 1px solid #e9d5ff; padding: 6px 12px; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: space-between;">
            <span>🏢 ข้อมูลทั่วไปของหอพัก</span>
            <span style="font-size: 11px; font-weight: 700; color: #7e22ce;">รหัสหอพัก: ${dorm.id}</span>
          </div>
          <div style="border: 1px solid #e9d5ff; border-top: none; padding: 12px; border-radius: 0 0 8px 8px; background: #ffffff;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
              <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px 4px;">
                <div style="font-size: 10.5px; color: #7e22ce; font-weight: 700;">นักเรียนปัจจุบัน</div>
                <div style="font-size: 19px; font-weight: 900; color: #6b21a8; margin-top: 2px;">${totalStudents} <span style="font-size: 11px; font-weight: 600;">คน</span></div>
              </div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 4px;">
                <div style="font-size: 10.5px; color: #166534; font-weight: 700;">จำนวนห้องนอน</div>
                <div style="font-size: 19px; font-weight: 900; color: #15803d; margin-top: 2px;">${roomCount} <span style="font-size: 11px; font-weight: 600;">ห้อง</span></div>
              </div>
              <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 4px;">
                <div style="font-size: 10.5px; color: #4338ca; font-weight: 700;">เตียงที่ใช้</div>
                <div style="font-size: 19px; font-weight: 900; color: #3730a3; margin-top: 2px;">${totalStudents} <span style="font-size: 11px; font-weight: 600;">เตียง</span></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 11px; color: #475569;">
              <div><strong>ประเภทหอพัก:</strong> ${dormTypeTh}</div>
              <div><strong>เตียงที่ใช้:</strong> <span style="color: #4338ca; font-weight: 700;">${totalStudents} เตียง</span></div>
              <div><strong>เฉลี่ยต่อห้อง:</strong> ${(roomCount > 0 ? (totalStudents / roomCount).toFixed(1) : "0")} คน/ห้อง</div>
            </div>
          </div>
        </div>

        <!-- Section 2: ข้อมูลคณะครูประจำหอพัก ทั้งหมด (All Dorm Teachers) -->
        <div class="section-box" style="margin-bottom: 16px;">
          <div class="section-title" style="font-size: 13px; font-weight: 800; color: #1e1b4b; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: space-between;">
            <span>👥 คณะครูประจำหอพัก ทั้งหมด (${teachers.length} ท่าน)</span>
            <span style="font-size: 10.5px; color: #64748b; font-weight: 600;">ข้อมูลเชื่อมโยงจากระบบผู้ใช้</span>
          </div>
          <div style="border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; background: #ffffff;">
            ${
              teachers.length === 0
                ? `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">ยังไม่มีข้อมูลครูประจำหอพักในระบบ</div>`
                : `
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                  <thead>
                    <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                      <th style="padding: 6px 10px; width: 45px; text-align: center;">ลำดับ</th>
                      <th style="padding: 6px 12px;">ชื่อ - สกุล ครูหอพัก</th>
                      <th style="padding: 6px 12px; width: 170px;">ตำแหน่งประจำหอพัก</th>
                      <th style="padding: 6px 12px; width: 130px; text-align: center;">เบอร์โทรศัพท์ติดต่อ</th>
                      <th style="padding: 6px 12px; width: 100px; text-align: center;">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${teachers
                      .map((t, tIdx) => {
                        const isHead = t.isHead || (t.position && t.position.includes("ประธาน"));
                        const posLabel = t.position || (isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก");
                        const phone = t.phone && t.phone !== "-" ? t.phone : "-";
                        return `
                        <tr style="border-bottom: 1px solid #f1f5f9; ${isHead ? "background: #faf5ff;" : ""}">
                          <td style="padding: 6px 10px; text-align: center; font-weight: 700; color: #64748b;">${tIdx + 1}</td>
                          <td style="padding: 6px 12px; font-weight: 700; color: #0f172a;">${t.name}</td>
                          <td style="padding: 6px 12px;">
                            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; ${
                              isHead ? "background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe;" : "background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;"
                            }">
                              ${posLabel}
                            </span>
                          </td>
                          <td style="padding: 6px 12px; text-align: center; font-family: monospace; font-weight: 700; color: #0284c7;">${phone}</td>
                          <td style="padding: 6px 12px; text-align: center;">
                            <span style="font-size: 9.5px; font-weight: 700; color: #166534; background: #dcfce7; padding: 1.5px 6px; border-radius: 4px;">ปฏิบัติหน้าที่</span>
                          </td>
                        </tr>
                      `;
                      })
                      .join("")}
                  </tbody>
                </table>
              `
            }
          </div>
        </div>

        <!-- Section 3: ข้อมูลที่เกี่ยวข้อง (สรุปสถิตินักเรียน & ข้อมูลห้องนอน) -->
        <div class="section-box" style="margin-bottom: 16px;">
          <div class="section-title" style="font-size: 13px; font-weight: 800; color: #1e1b4b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 8px 8px 0 0;">
            📊 ข้อมูลที่เกี่ยวข้อง: สรุปจำนวนนักเรียนแยกตามระดับชั้น
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 10px 12px; background: #ffffff;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${
                sortedGrades.length === 0
                  ? `<div style="color: #94a3b8; font-size: 11px;">ไม่มีข้อมูลสถิติระดับชั้น</div>`
                  : sortedGrades
                      .map(([grade, count]) => {
                        const pct = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : "0.0";
                        return `
                        <div style="flex: 1 1 100px; min-width: 90px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 700; color: #475569;">ชั้น ${grade}</div>
                          <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin: 1px 0;">${count} <span style="font-size: 9.5px; font-weight: 600; color: #64748b;">คน</span></div>
                          <div style="font-size: 9px; color: #7e22ce; font-weight: 600;">(${pct}%)</div>
                        </div>
                      `;
                      })
                      .join("")
              }
            </div>

            <!-- List of rooms summary preview -->
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; font-size: 10.5px; color: #475569;">
              <div style="font-weight: 700; margin-bottom: 4px; color: #334155;">รายชื่อห้องนอนทั้งหมดในหอพัก (${roomCount} ห้อง):</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 10px;">
                ${roomGroups
                  .map((rg) => `
                    <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                      ${rg.roomName} <strong>(${rg.students.length} คน)</strong>
                    </span>
                  `)
                  .join("")}
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8;">
          - หน้า 1: ข้อมูลสรุปประจำหอพัก (ผังห้องนอนจะเริ่มตั้งแต่หน้าที่ 2 เป็นต้นไป) -
        </div>
      </div>
    `;

    // PAGE 2 ONWARDS: Bedroom Tables in 2 Columns per Row
    // Group rooms in 2-column grid inside page container
    const roomsHtml = roomGroups.map((rg) => {
      const bedRows = getRoomBedRows(rg.students);

      const tableRowsHtml = bedRows
        .map((rowItem, rIdx) => {
          const st = rowItem.student;
          const fullName = `${st.title || ""}${st.firstName} ${st.lastName}`.trim();
          const nickname = st.nickname ? `(${st.nickname})` : "";
          const gradeRoom = st.room ? `${st.grade}/${st.room}` : st.grade || "-";
          const isEven = rIdx % 2 === 0;

          return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${isEven ? "#ffffff" : "#fbfbfe"};">
              ${
                rowItem.isFirstInBed
                  ? `
                  <td rowspan="${rowItem.bedRowSpan}" style="padding: 4px 6px; text-align: center; font-weight: 800; font-size: 11px; color: #1e1b4b; background: ${
                      rowItem.bedGroupIndex % 2 === 0 ? "#faf5ff" : "#f8fafc"
                    }; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; vertical-align: middle; width: 125px;">
                    <div>${rowItem.bedLabel}</div>
                    ${
                      rowItem.bedRowSpan > 1
                        ? `<div style="font-size: 8.5px; color: #7e22ce; font-weight: 700; margin-top: 1px;">(เตียงคู่ ${rowItem.bedRowSpan})</div>`
                        : ""
                    }
                  </td>
                `
                  : ""
              }
              <td style="padding: 3px 6px; font-size: 11px; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <span style="font-weight: 600;">${fullName}</span>
                ${nickname ? `<span style="font-size: 9.5px; font-weight: 700; color: #7e22ce; margin-left: 3px;">${nickname}</span>` : ""}
              </td>
              <td style="padding: 3px 4px; text-align: center; font-weight: 700; font-size: 10px; color: #581c87; width: 58px; white-space: nowrap;">
                <span style="background: #f5f3ff; border: 1px solid #ddd6fe; padding: 1px 4px; border-radius: 4px;">${gradeRoom}</span>
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <div class="room-card" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column;">
          <!-- Room Header -->
          <div style="background: #0f172a; color: #ffffff; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 12px; font-weight: 900; color: #a5f3fc; display: flex; align-items: center; gap: 4px;">
              <span>🛏️ ${rg.roomName}</span>
            </div>
            <div style="font-size: 10px; font-weight: 800; background: #7e22ce; color: #ffffff; padding: 1.5px 8px; border-radius: 12px;">
              ${rg.students.length} คน
            </div>
          </div>

          <!-- Room Table (เตียง, ชื่อ-สกุล, ชั้น/ห้อง) -->
          <div style="flex: 1; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-size: 10px; font-weight: 800; color: #334155;">
                  <th style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; width: 125px;">เตียง</th>
                  <th style="padding: 4px 6px; text-align: left; border-right: 1px solid #e2e8f0;">ชื่อ - สกุล นักเรียน</th>
                  <th style="padding: 4px 4px; text-align: center; width: 52px;">ชั้น/ห้อง</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Room Footer -->
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 3px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #64748b;">
            <span>รวมในห้อง</span>
            <span style="font-weight: 800; color: #0f172a;">${rg.students.length} คน</span>
          </div>
        </div>
      `;
    }).join("");

    const page2PlusHtml = `
      <div class="print-page page-rooms ${isLandscape ? "page-landscape" : "page-portrait"}">
        <!-- Page Header on Page 2+ -->
        <div class="rooms-page-header" style="border-bottom: 1.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <div>
            <strong style="color: #6b21a8; font-size: 13px;">ผังการจัดห้องนอน</strong> : <span style="font-weight: 800; font-size: 13px; color: #0f172a;">${dorm.name}</span> (${dormTypeTh})
          </div>
          <div style="color: #475569; font-size: 10px;">
            ${schoolName} • รวม ${roomCount} ห้องนอน (${totalStudents} คน)
          </div>
        </div>

        <!-- 2 Columns per Row Bedroom Grid -->
        <div class="rooms-grid-2col" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
          ${roomsHtml}
        </div>
      </div>
    `;

    return `
      <div class="dorm-print-package" style="${dormIdx < dormsData.length - 1 ? "page-break-after: always; break-after: page;" : ""}">
        ${page1Html}
        ${page2PlusHtml}
      </div>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 ${isLandscape ? "landscape" : "portrait"};
      margin: ${isLandscape ? "8mm 10mm" : "10mm 8mm"};
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

    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #1e1b4b;
      color: white;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .preview-canvas {
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .print-page {
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      padding: 28px 24px;
      margin: 0 auto;
    }

    .page-portrait {
      width: 210mm;
      min-height: 297mm;
    }

    .page-landscape {
      width: 297mm;
      min-height: 210mm;
    }

    /* Force Page Break after Page 1 (Master Summary Page) */
    .page-first {
      page-break-after: always !important;
      break-after: page !important;
    }

    /* 2 Columns per Row Grid */
    .rooms-grid-2col {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
    }

    .room-card {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    @media print {
      body {
        background-color: #ffffff !important;
      }

      .screen-toolbar {
        display: none !important;
      }

      .preview-canvas {
        padding: 0 !important;
        display: block !important;
        gap: 0 !important;
      }

      .print-page {
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        min-height: auto !important;
      }

      .page-first {
        page-break-after: always !important;
        break-after: page !important;
      }

      .rooms-grid-2col {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }
    }
  </style>
</head>
<body>
  <!-- Floating Screen Toolbar -->
  <div class="screen-toolbar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 32px; height: 32px; border-radius: 8px; background: #a855f7; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px;">
        🖨️
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 800; line-height: 1.2;">${documentTitle}</div>
        <div style="font-size: 10.5px; color: #cbd5e1;">
          รูปแบบ: ${isLandscape ? "A4 แนวนอน (Landscape)" : "A4 แนวตั้ง (Portrait)"} • หน้าแรกพิมพ์ข้อมูลหอพัก & ครูทั้งหมด • หน้าที่ 2+ แสดง 2 คอลัมน์ต่อแถว
        </div>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 8px;">
      <button
        onclick="window.print()"
        style="padding: 7px 18px; background: linear-gradient(to right, #9333ea, #7c3aed); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"
      >
        🖨️ สั่งพิมพ์เอกสาร A4 (Print)
      </button>
      <button
        onclick="window.close()"
        style="padding: 7px 14px; background: #334155; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;"
      >
        ปิดหน้าต่าง
      </button>
    </div>
  </div>

  <!-- Document Pages Container -->
  <div class="preview-canvas">
    ${dormsHtml}
  </div>

  <script>
    // Auto-focus print dialog on window open if supported
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
        } catch (e) {}
      }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Universal print trigger for Dormitory Bedroom Layout
 */
export function triggerPrintDormLayout(options: DormLayoutPrintOptions) {
  const htmlContent = generateDormLayoutPrintHtml(options);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // 1. Try window.open
  const printWin = window.open(url, "_blank");
  if (printWin) {
    printWin.focus();
  } else {
    // 2. If popup blocked, use invisible iframe
    try {
      const existingFrame = document.getElementById("direct-print-frame-dorm-layout");
      if (existingFrame) {
        document.body.removeChild(existingFrame);
      }
      const iframe = document.createElement("iframe");
      iframe.id = "direct-print-frame-dorm-layout";
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
      link.download = `${options.documentTitle || "ผังการจัดห้องนอน"}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

/**
 * Standalone HTML file download trigger
 */
export function downloadDormLayoutHtml(options: DormLayoutPrintOptions) {
  const htmlContent = generateDormLayoutPrintHtml(options);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${options.documentTitle || "ผังการจัดห้องนอน"}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
