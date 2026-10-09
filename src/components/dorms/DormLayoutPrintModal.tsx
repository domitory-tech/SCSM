import React, { useState, useMemo } from "react";
import { Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  DormLayoutDormData,
  DormLayoutRoomGroup,
  triggerPrintDormLayout,
  downloadDormLayoutHtml
} from "../../utils/dormLayoutPrintExporter";
import { getDormTeachers, getDormTypeLabel, matchStudentToDorm } from "../../utils/dormUtils";
import { formatThaiFullDate } from "../../utils/dateUtils";
import {
  Printer,
  Download,
  X,
  FileText,
  Building2,
  Users,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Layers
} from "lucide-react";

interface DormLayoutPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  dorms: Dormitory[];
  students: Student[];
  users?: UserProfile[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  initialSelectedDormId?: string;
}

// Bed row item interface for rowSpan handling
interface BedRowItem {
  student: Student;
  bedLabel: string;
  isFirstInBed: boolean;
  bedRowSpan: number;
  bedGroupIndex: number;
}

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

export const DormLayoutPrintModal: React.FC<DormLayoutPrintModalProps> = ({
  isOpen,
  onClose,
  dorms,
  students,
  users = [],
  systemSettings,
  currentUser,
  initialSelectedDormId
}) => {
  // Selected Dorm Filter for printing: specific dorm ID or "ALL"
  const [printDormId, setPrintDormId] = useState<string>(() => {
    if (initialSelectedDormId && initialSelectedDormId !== "ALL") return initialSelectedDormId;
    return dorms[0]?.id || "";
  });

  // Selected Print Orientation: "portrait" (แนวตั้ง) or "landscape" (แนวนอน)
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  // Active preview tab: "page1" (หน้าแรก ข้อมูลหอพัก & ครู) or "page2" (หน้าที่ 2 ตารางห้องนอน 2 คอลัมน์ต่อแถว)
  const [previewTab, setPreviewTab] = useState<"page1" | "page2">("page1");

  // Sync print dorm ID when initial changes
  React.useEffect(() => {
    if (initialSelectedDormId) {
      setPrintDormId(initialSelectedDormId);
    }
  }, [initialSelectedDormId]);

  // Selected dorms to print
  const targetDorms = useMemo(() => {
    if (printDormId === "ALL") return dorms;
    const found = dorms.find((d) => d.id === printDormId);
    return found ? [found] : dorms;
  }, [dorms, printDormId]);

  // Build compiled dorms data for printing
  const compiledDormsData: DormLayoutDormData[] = useMemo(() => {
    return targetDorms.map((dorm) => {
      const dormStudents = students.filter((s) => matchStudentToDorm(s, dorm));
      const teachers = getDormTeachers(dorm, users);

      // Group students by dorm room
      const roomGroupsMap: Record<string, Student[]> = {};
      const gradeSummary: Record<string, number> = {};

      dormStudents.forEach((st) => {
        const rKey = (st.dormRoom || "ยังไม่ระบุห้อง").trim();
        if (!roomGroupsMap[rKey]) {
          roomGroupsMap[rKey] = [];
        }
        roomGroupsMap[rKey].push(st);

        const g = st.grade || "ไม่ระบุ";
        gradeSummary[g] = (gradeSummary[g] || 0) + 1;
      });

      // Sort rooms numerically/alphabetically
      const sortedRoomKeys = Object.keys(roomGroupsMap).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10);
        const numB = parseInt(b.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return a.localeCompare(b, "th", { numeric: true });
      });

      const roomGroups: DormLayoutRoomGroup[] = sortedRoomKeys.map((rKey) => {
        const sts = roomGroupsMap[rKey];
        // Sort students within room by bed number
        const sortedSts = [...sts].sort((a, b) => {
          const bedA = parseInt(String(a.dormBed ?? (a as any).bed ?? "9999").replace(/\D/g, "") || "9999", 10);
          const bedB = parseInt(String(b.dormBed ?? (b as any).bed ?? "9999").replace(/\D/g, "") || "9999", 10);
          if (bedA !== bedB) return bedA - bedB;
          return (a.firstName || "").localeCompare(b.firstName || "", "th");
        });

        return {
          roomName: rKey,
          roomKey: rKey,
          students: sortedSts
        };
      });

      return {
        dorm,
        teachers,
        totalStudents: dormStudents.length,
        roomCount: roomGroups.length,
        roomGroups,
        gradeSummary
      };
    });
  }, [targetDorms, students, users]);

  // First dorm data for modal preview
  const previewDormData = compiledDormsData[0];
  const dormNameLabel = printDormId === "ALL" ? "ทุกหอพัก" : previewDormData?.dorm.name || "หอพัก";

  const handlePrint = () => {
    triggerPrintDormLayout({
      dormsData: compiledDormsData,
      systemSettings,
      orientation,
      currentUser,
      documentTitle: `ผังการจัดห้องนอน_${dormNameLabel}`
    });
  };

  const handleDownloadHtml = () => {
    downloadDormLayoutHtml({
      dormsData: compiledDormsData,
      systemSettings,
      orientation,
      currentUser,
      documentTitle: `ผังการจัดห้องนอน_${dormNameLabel}`
    });
  };

  const schoolName = systemSettings?.schoolNameTh || "โรงเรียนพิจิตรปัญญานุกูล";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-purple-200 font-bold border border-white/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>ตั้งค่าการพิมพ์ผังการจัดห้องนอน</span>
                <span className="text-[10px] bg-purple-500/40 text-purple-200 px-2.5 py-0.5 rounded-full font-bold border border-purple-400/30">
                  มาตรฐาน A4
                </span>
              </h2>
              <p className="text-xs text-purple-200/90 font-medium">
                หน้าแรกพิมพ์ข้อมูลหอพัก & ครูหอพักทั้งหมด • หน้าที่ 2 เป็นต้นไปแสดงตาราง 2 คอลัมน์ต่อแถว
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Options Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {/* 1. Select Dorm */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">เลือกหอพัก:</span>
              <select
                value={printDormId}
                onChange={(e) => setPrintDormId(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                {dorms.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({getDormTypeLabel(d, true)})
                  </option>
                ))}
                <option value="ALL">🏢 ทุกหอพัก (พิมพ์ครบทั้ง {dorms.length} หอ)</option>
              </select>
            </div>

            {/* 2. Orientation Selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">ทิศทางกระดาษ A4:</span>
              <div className="flex rounded-xl bg-slate-200/80 p-0.5 border border-slate-300 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    orientation === "portrait"
                      ? "bg-white text-purple-900 shadow-xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>แนวตั้ง (Portrait)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    orientation === "landscape"
                      ? "bg-white text-purple-900 shadow-xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>แนวนอน (Landscape)</span>
                </button>
              </div>
            </div>

            {/* 3. 2-Columns indicator */}
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>แสดง 2 คอลัมน์ต่อ 1 แถว</span>
            </span>
          </div>

          {/* Preview Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded-xl border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPreviewTab("page1")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                previewTab === "page1"
                  ? "bg-purple-700 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ดูตัวอย่าง: หน้าแรก (ข้อมูลหอพัก & ครู)
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("page2")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                previewTab === "page2"
                  ? "bg-purple-700 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ดูตัวอย่าง: หน้าที่ 2+ (ตาราง 2 คอลัมน์)
            </button>
          </div>
        </div>

        {/* Modal Body: A4 Sheet Live Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          {previewDormData ? (
            <div
              className={`bg-white rounded-md shadow-xl border border-slate-300 p-6 md:p-8 select-text transition-all ${
                orientation === "landscape" ? "w-[980px] min-h-[640px]" : "w-[780px] min-h-[960px]"
              }`}
            >
              {previewTab === "page1" ? (
                /* PREVIEW OF PAGE 1: DORM & TEACHERS COVER */
                <div className="space-y-5 animate-fade-in">
                  {/* Header */}
                  <div className="text-center pb-3 border-b-2 border-purple-900">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{schoolName}</div>
                    <div className="text-xs text-purple-700 font-bold mt-0.5">
                      งานหอพัก • กลุ่มบริหารกิจการนักเรียน
                    </div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1.5">
                      ผังการจัดห้องนอน {previewDormData.dorm.name}
                    </h1>
                    <div className="text-[11px] text-slate-400 mt-1">
                      ข้อมูล ณ {formatThaiFullDate(new Date().toISOString().split("T")[0])}
                    </div>
                  </div>

                  {/* Section 1: ข้อมูลหอพัก */}
                  <div className="border border-purple-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-purple-50 px-3 py-2 border-b border-purple-200 font-black text-xs text-purple-950 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-700" />
                        <span>ข้อมูลทั่วไปของหอพัก</span>
                      </span>
                      <span className="text-[11px] font-bold text-purple-700">
                        {previewDormData.dorm.name}
                      </span>
                    </div>
                    <div className="p-3 bg-white">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                          <div className="text-[10px] text-purple-700 font-bold">นักเรียนปัจจุบัน</div>
                          <div className="text-base font-black text-purple-800">
                            {previewDormData.totalStudents} คน
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                          <div className="text-[10px] text-emerald-700 font-bold">จำนวนห้องนอน</div>
                          <div className="text-base font-black text-emerald-800">
                            {previewDormData.roomCount} ห้อง
                          </div>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                          <div className="text-[10px] text-indigo-700 font-bold">เตียงที่ใช้</div>
                          <div className="text-base font-black text-indigo-800">
                            {previewDormData.totalStudents} เตียง
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-dashed border-slate-200 text-xs text-slate-600">
                        <div>
                          <strong className="text-slate-700">ประเภทหอพัก:</strong> {getDormTypeLabel(previewDormData.dorm, true)}
                        </div>
                        <div>
                          <strong className="text-slate-700">เตียงที่ใช้:</strong>{" "}
                          <span className="text-purple-700 font-bold">{previewDormData.totalStudents} เตียง</span>
                        </div>
                        <div>
                          <strong className="text-slate-700">เฉลี่ยต่อห้อง:</strong>{" "}
                          {previewDormData.roomCount > 0
                            ? (previewDormData.totalStudents / previewDormData.roomCount).toFixed(1)
                            : "0"}{" "}
                          คน/ห้อง
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: คณะครูประจำหอพัก ทั้งหมด */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 font-black text-xs text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-700" />
                        <span>คณะครูประจำหอพัก ทั้งหมด ({previewDormData.teachers.length} ท่าน)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        ดึงข้อมูลเชื่อมโยงจากระบบผู้ใช้
                      </span>
                    </div>
                    <div className="bg-white overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="py-2 px-3 text-center w-12">ลำดับ</th>
                            <th className="py-2 px-3">ชื่อ - สกุล ครูหอพัก</th>
                            <th className="py-2 px-3">ตำแหน่งประจำหอพัก</th>
                            <th className="py-2 px-3 text-center">เบอร์โทรศัพท์</th>
                            <th className="py-2 px-3 text-center">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewDormData.teachers.map((t, idx) => (
                            <tr key={t.id || idx}>
                              <td className="py-2 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">{t.name}</td>
                              <td className="py-2 px-3">
                                <span className="inline-block bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก")}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-sky-700">
                                {t.phone && t.phone !== "-" ? t.phone : "-"}
                              </td>
                              <td className="py-2 px-3 text-center text-[10px] font-bold text-emerald-700">
                                ปฏิบัติหน้าที่
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: สรุปสถิตินักเรียน & ข้อมูลห้องนอน */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden p-3 bg-slate-50">
                    <div className="font-bold text-xs text-slate-700 mb-2">
                      สรุปจำนวนนักเรียนแยกตามระดับชั้น:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(previewDormData.gradeSummary).map(([g, count]) => (
                        <div key={g} className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-center shadow-2xs">
                          <div className="text-[10px] text-slate-500 font-bold">ชั้น {g}</div>
                          <div className="text-sm font-black text-slate-800">{count} คน</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-slate-400 pt-2">
                    - หน้า 1: ข้อมูลสรุปประจำหอพัก (ตารางห้องนอนจะเริ่มแสดงตั้งแต่หน้าที่ 2 เป็นต้นไป) -
                  </div>
                </div>
              ) : (
                /* PREVIEW OF PAGE 2+: BEDROOM TABLES 2 COLUMNS PER ROW */
                <div className="space-y-4 animate-fade-in">
                  <div className="pb-2 border-b-2 border-slate-900 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-purple-800 text-sm">ผังการจัดห้องนอน</strong> :{" "}
                      <span className="font-bold text-slate-900">{previewDormData.dorm.name}</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      แสดง 2 คอลัมน์ต่อ 1 แถว • รวม {previewDormData.roomCount} ห้องนอน
                    </div>
                  </div>

                  {/* 2-Columns Grid of Bedrooms */}
                  <div className="grid grid-cols-2 gap-3">
                    {previewDormData.roomGroups.map((rg) => {
                      const bedRows = getRoomBedRows(rg.students);

                      return (
                        <div
                          key={rg.roomKey}
                          className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col justify-between"
                        >
                          <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs">
                            <span className="font-black text-cyan-200">🛏️ {rg.roomName}</span>
                            <span className="bg-purple-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {rg.students.length} คน
                            </span>
                          </div>

                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] font-bold">
                                <th className="py-1 px-2 text-center w-28 border-r border-slate-200">เตียง</th>
                                <th className="py-1 px-2 border-r border-slate-200">ชื่อ - สกุล</th>
                                <th className="py-1 px-1 text-center w-12">ชั้น/ห้อง</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {bedRows.map((rowItem, rIdx) => {
                                const st = rowItem.student;
                                const fullName = `${st.title || ""}${st.firstName} ${st.lastName}`.trim();
                                const nickname = st.nickname ? `(${st.nickname})` : "";
                                const gradeRoom = st.room ? `${st.grade}/${st.room}` : st.grade || "-";

                                return (
                                  <tr key={st.id || rIdx} className="hover:bg-slate-50 text-[11px]">
                                    {rowItem.isFirstInBed && (
                                      <td
                                        rowSpan={rowItem.bedRowSpan}
                                        className="py-1 px-2 text-center font-bold text-slate-800 bg-slate-50/70 border-r border-b border-slate-200 align-middle text-[11px] w-28"
                                      >
                                        <div>{rowItem.bedLabel}</div>
                                        {rowItem.bedRowSpan > 1 && (
                                          <span className="text-[9px] text-purple-700 font-bold bg-purple-100 px-1 py-0.5 rounded whitespace-nowrap block mt-0.5">
                                            (เตียงคู่ {rowItem.bedRowSpan})
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    <td className="py-1 px-2 text-slate-800 border-r border-slate-100 truncate">
                                      <span className="font-semibold">{fullName}</span>{" "}
                                      <span className="text-[9.5px] text-purple-700 font-bold">{nickname}</span>
                                    </td>
                                    <td className="py-1 px-1 text-center font-bold text-purple-900 text-[10px]">
                                      {gradeRoom}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          <div className="bg-slate-50 px-2 py-1 border-t border-slate-200 text-[9.5px] text-slate-500 flex justify-between">
                            <span>รวมในห้อง</span>
                            <span className="font-bold text-slate-700">{rg.students.length} คน</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">ไม่พบข้อมูลสำหรับพิมพ์</div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            จะทำการพิมพ์: <strong>{dormNameLabel}</strong> • จำนวน <strong>{compiledDormsData.length} หอพัก</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="ดาวน์โหลดไฟล์ HTML พร้อมพิมพ์สำหรับบันทึกเก็บไว้"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>ดาวน์โหลด HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black shadow-lg shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์เอกสาร A4 (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
