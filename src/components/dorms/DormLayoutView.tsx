import React, { useState, useMemo } from "react";
import { Dormitory, Student, UserProfile } from "../../types";
import { useUsersQuery } from "../../services/useDormQueries";
import {
  getStudentsInDorm,
  getDormTypeLabel,
  getDormTypeBadgeStyle,
  getDormTeachers,
  getPositionBadgeStyle,
  getPositionDotColor
} from "../../utils/dormUtils";
import { printOrSaveElementAsPdf } from "../../utils/htmlReportExporter";
import { DormLayoutOverviewModal } from "./DormLayoutOverviewModal";
import {
  LayoutGrid,
  Search,
  Printer,
  Building2,
  Users,
  BedDouble,
  Layers,
  Filter,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  Table,
  Phone
} from "lucide-react";

interface DormLayoutViewProps {
  dorms: Dormitory[];
  students: Student[];
  users?: UserProfile[];
  currentUser?: UserProfile | null;
}

// Color schemes matching the existing design system
const DORM_TAB_COLORS: Record<string, { active: string; border: string; badge: string; banner: string }> = {
  purple: {
    active: "bg-purple-700 text-white shadow-md shadow-purple-200",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    banner: "from-purple-800 to-indigo-800"
  },
  blue: {
    active: "bg-blue-700 text-white shadow-md shadow-blue-200",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    banner: "from-blue-800 to-indigo-800"
  },
  emerald: {
    active: "bg-emerald-700 text-white shadow-md shadow-emerald-200",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    banner: "from-emerald-800 to-teal-800"
  },
  amber: {
    active: "bg-amber-600 text-white shadow-md shadow-amber-200",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    banner: "from-amber-700 to-orange-700"
  },
  rose: {
    active: "bg-rose-700 text-white shadow-md shadow-rose-200",
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    banner: "from-rose-800 to-pink-800"
  },
  cyan: {
    active: "bg-cyan-700 text-white shadow-md shadow-cyan-200",
    border: "border-cyan-200",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-300",
    banner: "from-cyan-800 to-blue-800"
  }
};

const COLOR_KEYS = ["purple", "blue", "emerald", "amber", "rose", "cyan"];

// Extract room sorting key (numeric sort for numbers e.g. 101, 102, 201)
function parseRoomNumber(dormRoomStr: string | undefined): number {
  if (!dormRoomStr) return 99999;
  const num = parseInt(dormRoomStr.replace(/\D/g, ""), 10);
  return isNaN(num) ? 99999 : num;
}

// Extract bed sorting key (e.g. 1, 2, 3, "เตียง 1", "1/1")
function parseBedNumber(bedVal: string | number | undefined): number {
  if (bedVal === undefined || bedVal === null || String(bedVal).trim() === "") return 99999;
  const num = parseInt(String(bedVal).replace(/\D/g, ""), 10);
  return isNaN(num) ? 99999 : num;
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

      // Count consecutive students with same bed
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

// Calculate effective Thai horizontal character length (excluding vertical combining tone marks & vowels)
function getThaiHorizontalLength(text: string): number {
  if (!text) return 0;
  return text.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "").length;
}

// Check student name length and return semantic classes for print scaling
// (ในหน้าจอแสดงผลตามปกติ ส่วนในรูปแบบการพิมพ์จะย่อเฉพาะชื่อที่ยาวเกินคอลัมน์)
function getStudentNamePrintClasses(fullName: string, nickname?: string) {
  const nameLen = getThaiHorizontalLength(fullName);
  const nickLen = nickname ? getThaiHorizontalLength(nickname) + 3 : 0;
  const totalLength = nameLen + nickLen;

  if (totalLength > 26) {
    return {
      namePrintClass: "student-name-very-long",
      nicknamePrintClass: "student-nick-very-long"
    };
  } else if (totalLength > 19) {
    return {
      namePrintClass: "student-name-long",
      nicknamePrintClass: "student-nick-long"
    };
  } else {
    return {
      namePrintClass: "student-name-normal",
      nicknamePrintClass: "student-nick-normal"
    };
  }
}

export const DormLayoutView: React.FC<DormLayoutViewProps> = ({
  dorms,
  students,
  users,
  currentUser
}) => {
  const { data: queriedUsers = [] } = useUsersQuery();
  const effectiveUsers = users && users.length > 0 ? users : queriedUsers;

  // Selected Dorm Filter (defaults to 1 dormitory for fast processing performance)
  const [selectedDormId, setSelectedDormId] = useState<string>(() => {
    if (currentUser?.dormId && dorms.some((d) => d.id === currentUser.dormId)) {
      return currentUser.dormId;
    }
    return dorms.length > 0 ? dorms[0].id : "";
  });

  // Sync initial dorm selection once dorms list is loaded/updated
  React.useEffect(() => {
    if (!selectedDormId && dorms.length > 0) {
      const initialId =
        currentUser?.dormId && dorms.some((d) => d.id === currentUser.dormId)
          ? currentUser.dormId
          : dorms[0].id;
      setSelectedDormId(initialId);
    }
  }, [dorms, currentUser?.dormId, selectedDormId]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("ALL");
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState<boolean>(false);

  // Filter available dorms list
  const activeDorms = useMemo(() => {
    if (selectedDormId === "ALL") return dorms;
    return dorms.filter((d) => d.id === selectedDormId);
  }, [dorms, selectedDormId]);

  // Group students by dormitory and then by dormRoom
  const dormsRoomData = useMemo(() => {
    return activeDorms.map((dorm, dIdx) => {
      const dormStudents = getStudentsInDorm(students, dorm);
      
      // Group by room
      const roomGroupsMap: Record<string, Student[]> = {};
      dormStudents.forEach((st) => {
        const rawRoom = (st.dormRoom || "").trim();
        const roomName = rawRoom ? `ห้อง ${rawRoom}` : "ไม่ระบุห้องนอน";
        if (!roomGroupsMap[roomName]) {
          roomGroupsMap[roomName] = [];
        }
        roomGroupsMap[roomName].push(st);
      });

      // Filter by search query or grade filter if set
      const filteredRoomGroups: { roomName: string; roomKey: string; students: Student[] }[] = [];

      // Sort room names naturally
      const sortedRoomKeys = Object.keys(roomGroupsMap).sort((a, b) => {
        const numA = parseRoomNumber(a);
        const numB = parseRoomNumber(b);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b, "th", { numeric: true });
      });

      sortedRoomKeys.forEach((rKey) => {
        let roomSts = roomGroupsMap[rKey];

        // Search query filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          roomSts = roomSts.filter(
            (st) =>
              `${st.title || ""}${st.firstName || ""} ${st.lastName || ""}`.toLowerCase().includes(q) ||
              (st.studentId || "").toLowerCase().includes(q) ||
              (st.grade || "").toLowerCase().includes(q) ||
              String(st.room || "").includes(q) ||
              (st.dormRoom || "").toLowerCase().includes(q) ||
              String(st.dormBed || "").toLowerCase().includes(q) ||
              rKey.toLowerCase().includes(q)
          );
        }

        // Grade filtering
        if (selectedGradeFilter !== "ALL") {
          roomSts = roomSts.filter((st) => st.grade === selectedGradeFilter);
        }

        if (roomSts.length > 0) {
          // Sort students within room:
          // 1. Bed number from 1 downwards
          // 2. Grade, Room, StudentNo, Name
          const sortedSts = [...roomSts].sort((a, b) => {
            const bedA = parseBedNumber(a.dormBed ?? (a as any).bed);
            const bedB = parseBedNumber(b.dormBed ?? (b as any).bed);
            if (bedA !== bedB) return bedA - bedB;

            const gradeA = parseInt(a.grade.replace(/\D/g, "") || "0", 10);
            const gradeB = parseInt(b.grade.replace(/\D/g, "") || "0", 10);
            if (gradeA !== gradeB) return gradeA - gradeB;

            const roomA = typeof a.room === "number" ? a.room : parseInt(String(a.room || "0"), 10);
            const roomB = typeof b.room === "number" ? b.room : parseInt(String(b.room || "0"), 10);
            if (roomA !== roomB) return roomA - roomB;

            const noA = typeof a.no === "number" ? a.no : 0;
            const noB = typeof b.no === "number" ? b.no : 0;
            if (noA !== noB) return noA - noB;

            return a.firstName.localeCompare(b.firstName, "th");
          });

          filteredRoomGroups.push({
            roomName: rKey,
            roomKey: rKey,
            students: sortedSts
          });
        }
      });

      const totalStudentsInDorm = dormStudents.length;
      const totalFilteredStudents = filteredRoomGroups.reduce((acc, rg) => acc + rg.students.length, 0);

      const colorKey = COLOR_KEYS[dIdx % COLOR_KEYS.length];
      const colorScheme = DORM_TAB_COLORS[colorKey] || DORM_TAB_COLORS.purple;
      const teachers = getDormTeachers(dorm, effectiveUsers);

      return {
        dorm,
        teachers,
        colorScheme,
        totalStudents: totalStudentsInDorm,
        filteredStudentsCount: totalFilteredStudents,
        roomCount: filteredRoomGroups.length,
        roomGroups: filteredRoomGroups
      };
    });
  }, [activeDorms, students, effectiveUsers, searchQuery, selectedGradeFilter]);

  // All distinct grades for filter
  const availableGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    students.forEach((s) => {
      if (s.grade) gradesSet.add(s.grade);
    });
    return Array.from(gradesSet).sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  }, [students]);

  // Grand totals across active dorms
  const grandStats = useMemo(() => {
    let totalSt = 0;
    let totalRooms = 0;
    dormsRoomData.forEach((d) => {
      totalSt += d.filteredStudentsCount;
      totalRooms += d.roomCount;
    });
    return { totalSt, totalRooms };
  }, [dormsRoomData]);

  // Print / PDF export handler (A4 Portrait, 2-column layout)
  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      const today = new Date().toISOString().split("T")[0];
      const dormLabel = selectedDormId === "ALL" ? "ทุกหอพัก" : dorms.find((d) => d.id === selectedDormId)?.name || "หอพัก";
      printOrSaveElementAsPdf(
        "dorm-layout-table-export-container",
        `ผังการจัดห้องนอน_${dormLabel}_${today}`,
        "portrait"
      );
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการพิมพ์/บันทึก PDF: " + err.message);
    } finally {
      setTimeout(() => {
        setIsExportingPdf(false);
      }, 600);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-[#A05AFF] via-[#8E3CFF] to-[#6c28d9] rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-purple-500/15 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 pointer-events-none blur-2xl" />
        <div className="absolute left-1/3 top-0 w-48 h-48 rounded-full bg-white/5 pointer-events-none blur-xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/30">
              <BedDouble className="w-4 h-4 text-purple-200" />
              <span>ผังการจัดห้องนอนนักเรียนแยกตามหอพัก</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>ผังการจัดหอพัก</span>
              <span className="text-sm font-semibold bg-white/20 text-purple-100 px-3 py-0.5 rounded-full backdrop-blur-xs">
                {dorms.length} หอพัก
              </span>
            </h2>
            <p className="text-purple-100 text-xs sm:text-sm max-w-2xl font-normal leading-relaxed">
              ตารางผังห้องนอนนักเรียน แยกตามหอพัก พร้อมรายละเอียดชื่อ-สกุล และระดับชั้น/ห้อง ไฮไลท์สีสลับแถวเพื่อความชัดเจนในการตรวจสอบ
            </p>
          </div>

          {/* Action Buttons: Popup Overview & Print/Save PDF */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsOverviewModalOpen(true)}
              className="px-4 py-2.5 bg-[#1BCFB4] hover:bg-[#16ba9f] text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white/40 active:scale-95"
              title="เปิดดูผังการจัดหอพักรวม (ตารางสถิติสรุปจำนวนนักเรียนแยกตามระดับชั้น/ห้อง และเพศของแต่ละหอพัก)"
            >
              <Table className="w-4 h-4 text-slate-950" />
              <span>ผังการจัดหอพักรวม (POPUP)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-5 py-2.5 bg-white hover:bg-purple-50 text-purple-900 font-black text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 border border-white/60"
              title="พิมพ์เอกสาร หรือ บันทึกเป็นไฟล์ PDF คุณภาพสูง (A4)"
            >
              <Printer className="w-4 h-4 text-purple-700" />
              <span>{isExportingPdf ? "กำลังเปิดหน้าต่างพิมพ์..." : "พิมพ์ / บันทึก PDF"}</span>
            </button>
          </div>
        </div>

        {/* Mini stats counters in header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/20 text-white">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/15">
            <div className="text-[11px] text-purple-200 font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>หอพักที่แสดง</span>
            </div>
            <div className="text-xl font-black mt-1">
              {activeDorms.length} <span className="text-xs font-normal text-purple-200">หอพัก</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/15">
            <div className="text-[11px] text-purple-200 font-semibold flex items-center gap-1.5">
              <BedDouble className="w-3.5 h-3.5" />
              <span>จำนวนห้องนอนรวม</span>
            </div>
            <div className="text-xl font-black mt-1">
              {grandStats.totalRooms} <span className="text-xs font-normal text-purple-200">ห้อง</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/15">
            <div className="text-[11px] text-purple-200 font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>นักเรียนในผังทั้งหมด</span>
            </div>
            <div className="text-xl font-black mt-1">
              {grandStats.totalSt} <span className="text-xs font-normal text-purple-200">คน</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/15">
            <div className="text-[11px] text-purple-200 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>สถานะสิทธิ์การเข้าถึง</span>
            </div>
            <div className="text-sm font-black mt-1.5 text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 inline" />
              <span>เปิดสิทธิ์ทุกคน</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Navigation Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* Dormitory Selection Dropdown */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#A05AFF]" />
              <span>เลือกหอพักที่ต้องการดูผัง</span>
            </label>
            <div className="relative">
              <select
                value={selectedDormId}
                onChange={(e) => setSelectedDormId(e.target.value)}
                className="w-full py-2.5 pl-3.5 pr-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#A05AFF] focus:bg-white transition-all cursor-pointer shadow-2xs appearance-none"
              >
                <option value="ALL">🏢 ทุกหอพัก (ทั้งหมด {dorms.length} หอพัก)</option>
                {dorms.map((dorm) => {
                  const count = getStudentsInDorm(students, dorm).length;
                  const typeLabel = getDormTypeLabel(dorm, false);
                  return (
                    <option key={dorm.id} value={dorm.id}>
                      {dorm.name} ({typeLabel}) — {count} คน
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Grade filter */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#A05AFF]" />
              <span>ระดับชั้น</span>
            </label>
            <div className="relative">
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="w-full py-2.5 pl-3.5 pr-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#A05AFF] focus:bg-white transition-all cursor-pointer shadow-2xs appearance-none"
              >
                <option value="ALL">ทุกระดับชั้น (ม.1 - ม.6)</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    ระดับชั้น {g}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Search box */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-[#A05AFF]" />
              <span>ค้นหาด่วน</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ-สกุล, เลขห้องนอน (เช่น 101), รหัสนักเรียน..."
                className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#A05AFF] focus:bg-white transition-all font-medium shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full cursor-pointer"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Dormitory Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>เลือกหอพัก:</span>
          </span>
          {dorms.map((dorm) => {
            const isSelected = selectedDormId === dorm.id;
            const count = getStudentsInDorm(students, dorm).length;
            return (
              <button
                key={dorm.id}
                type="button"
                onClick={() => setSelectedDormId(dorm.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? "bg-[#A05AFF] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{dorm.name}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                    isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  {count} คน
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedDormId("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              selectedDormId === "ALL"
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <span>🏢 ทุกหอพัก ({dorms.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Printable / Exportable Dormitory Room Tables Area */}
      <div id="dorm-layout-table-export-container" className="space-y-8 bg-transparent">
        {dormsRoomData.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">ไม่พบข้อมูลหอพัก</h3>
            <p className="text-xs text-slate-400">กรุณาตรวจสอบการตั้งค่าหอพักในระบบ</p>
          </div>
        ) : (
          dormsRoomData.map(({ dorm, teachers, colorScheme, totalStudents, filteredStudentsCount, roomCount, roomGroups }) => {
            return (
              <div
                key={dorm.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden break-inside-avoid"
              >
                {/* Dormitory Card Header Banner */}
                <div className={`p-4 lg:p-5 bg-gradient-to-r ${colorScheme.banner} text-white flex flex-col gap-2.5`}>
                  {/* Row 1: Dorm Name & Type */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-black text-white shrink-0 border border-white/20 shadow-inner">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg lg:text-xl text-white tracking-tight">{dorm.name}</h3>
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs border border-white/30 text-white">
                        {getDormTypeLabel(dorm, true)}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: ห้องนอน และนักเรียน (อยู่ 1 บรรทัดถัดมา) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-white/20 backdrop-blur-xs text-white text-xs font-extrabold px-3 py-1 rounded-xl border border-white/25 flex items-center gap-1.5 shadow-xs">
                      <BedDouble className="w-3.5 h-3.5 text-white/90" />
                      <span>{roomCount} ห้องนอน</span>
                    </span>
                    <span className="bg-white text-slate-900 text-xs font-black px-3.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>{filteredStudentsCount} นักเรียน</span>
                    </span>
                  </div>

                  {/* Row 3: คณะครูประจำหอพัก (อยู่ 1 บรรทัด) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/15">
                    <span className="text-xs text-white/90 font-bold flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5 text-white/90" />
                      <span>คณะครูประจำหอพัก:</span>
                    </span>
                    {teachers && teachers.length > 0 ? (
                      teachers.map((t, tIdx) => (
                        <div
                          key={t.id || tIdx}
                          className="inline-flex items-center gap-1.5 bg-black/25 hover:bg-black/35 backdrop-blur-xs border border-white/25 px-2.5 py-1 rounded-xl text-xs text-white transition-all shadow-xs"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${getPositionDotColor(t.position)}`} />
                          <span className="font-bold">{t.name}</span>
                          <span className="text-[10px] bg-white/20 text-white font-extrabold px-1.5 py-0.2 rounded-md shrink-0">
                            {t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก")}
                          </span>
                          {t.phone && t.phone !== "-" && (
                            <a
                              href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}
                              className="text-[11px] font-mono font-bold text-emerald-200 bg-emerald-900/50 hover:bg-emerald-900/70 px-1.5 py-0.5 rounded-md border border-emerald-400/40 flex items-center gap-1 transition-colors"
                              title="โทรติดต่อครูหอพัก"
                            >
                              <Phone className="w-2.5 h-2.5 text-emerald-300" />
                              <span>{t.phone}</span>
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-white/70 italic">ยังไม่มีข้อมูลครูที่เพิ่มในหอพักนี้</span>
                    )}
                  </div>
                </div>

                  {/* Content: Tables Grid for each Room in Dorm (2 Columns for A4 Portrait) */}
                <div className="p-4 lg:p-6 bg-slate-50/70 space-y-6">
                  {roomGroups.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-semibold">
                        ไม่พบข้อมูลห้องนอนหรือนักเรียนในหอพักนี้ที่ตรงกับเงื่อนไขการค้นหา
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 dorm-rooms-grid">
                      {roomGroups.map((rg) => {
                        const bedRows = getRoomBedRows(rg.students);

                        return (
                          <div
                            key={rg.roomKey}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow break-inside-avoid"
                          >
                            {/* Room Header: แถวที่ 1 เลขห้องนอน */}
                            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-2 font-black text-sm sm:text-base text-purple-200">
                                <BedDouble className="w-4 h-4 text-[#1BCFB4]" />
                                <span>{rg.roomName}</span>
                              </div>
                              <span className="bg-[#A05AFF] text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                                {rg.students.length} คน
                              </span>
                            </div>

                            {/* Table:
                                คอลัม 1: เตียง (เรียงเตียง 1 ลงล่าง รวมแถวเมื่อนอนเตียงเดียวกัน)
                                คอลัม 2: ชื่อ-สกุลนักเรียน
                                คอลัม 3: ชั้น/ห้อง
                                ปรับขนาดอักษรพอดีคอลัมน์ และงดใช้ scrollbar โดยใช้ table-fixed
                            */}
                            <div className="w-full overflow-hidden flex-1">
                              <table className="w-full table-fixed text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 text-xs">
                                    <th className="w-[20%] py-2 px-1.5 text-center border-r border-slate-200 text-slate-800 whitespace-nowrap">
                                      เตียง
                                    </th>
                                    <th className="w-[58%] py-2 px-2.5 border-r border-slate-200 text-slate-800">
                                      ชื่อ-สกุลนักเรียน
                                    </th>
                                    <th className="w-[22%] py-2 px-1 text-center text-slate-800 whitespace-nowrap">
                                      ชั้น/ห้อง
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {bedRows.map((rowItem, rIdx) => {
                                    const st = rowItem.student;
                                    const fullName = `${st.title || ""}${st.firstName} ${st.lastName}`.trim();
                                    const gradeRoom = st.room ? `${st.grade}/${st.room}` : st.grade || "-";
                                    const isEvenRow = rIdx % 2 === 0;
                                    const rowBg = isEvenRow ? "bg-white" : "bg-purple-50/40";
                                    const isEvenBedGroup = rowItem.bedGroupIndex % 2 === 1;
                                    const bedBg = isEvenBedGroup ? "bg-purple-50/90" : "bg-slate-50";
                                    
                                    // Check name length and apply semantic print scaling classes
                                    const printClasses = getStudentNamePrintClasses(fullName, st.nickname);

                                    return (
                                      <tr
                                        key={st.id || `${rg.roomKey}-${rIdx}`}
                                        className={`${rowBg} hover:bg-purple-100/40 transition-colors`}
                                      >
                                        {/* คอลัม 1: เตียง (รวมแถวเมื่อนอนเตียงเดียวกัน) */}
                                        {rowItem.isFirstInBed && (
                                          <td
                                            rowSpan={rowItem.bedRowSpan}
                                            className={`py-2 px-1 text-center font-bold text-xs text-slate-800 border-r border-b border-slate-200 ${bedBg} align-middle`}
                                          >
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                              <span className="whitespace-nowrap font-bold text-slate-900 text-xs">
                                                {rowItem.bedLabel}
                                              </span>
                                              {rowItem.bedRowSpan > 1 && (
                                                <span className="text-[9px] text-purple-700 font-bold bg-purple-200/90 px-1 py-0.2 rounded whitespace-nowrap">
                                                  (เตียงคู่ {rowItem.bedRowSpan})
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        )}

                                        {/* คอลัม 2: ชื่อ-สกุลนักเรียน (หน้าจอแสดงผลตามปกติ ย่อเฉพาะในรูปแบบการพิมพ์เมื่อชื่อยาวเกินคอลัมน์) */}
                                        <td className="py-2 px-2.5 text-slate-800 border-r border-slate-100 overflow-hidden">
                                          <div className="flex items-center justify-between gap-1.5 overflow-hidden">
                                            <span 
                                              className={`truncate text-xs sm:text-[13px] font-semibold text-slate-800 ${printClasses.namePrintClass}`} 
                                              title={fullName}
                                            >
                                              {fullName}
                                            </span>
                                            {st.nickname && (
                                              <span className={`text-[10px] sm:text-xs font-bold text-purple-700 bg-purple-100/90 rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap ${printClasses.nicknamePrintClass}`}>
                                                ({st.nickname})
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* คอลัม 3: ชั้น/ห้อง */}
                                        <td className="py-2 px-1 text-center font-bold text-purple-900 text-xs">
                                          <span className="inline-block bg-white border border-purple-200/80 px-2 py-0.5 rounded shadow-2xs font-extrabold text-[11px]">
                                            {gradeRoom}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Room Footer Total */}
                            <div className="bg-slate-50 px-3.5 py-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
                              <span>รวมในห้อง</span>
                              <span className="font-bold text-slate-800">{rg.students.length} คน</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dormitory Card Bottom Summary */}
                <div className="p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1BCFB4]" />
                    <span>ข้อมูลอัปเดตจากฐานข้อมูลนักเรียนระบบหอพัก</span>
                  </div>
                  <div className="font-bold text-slate-700">
                    รวมทั้งสิ้น {totalStudents} คน ({roomCount} ห้องนอน)
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Overview Matrix Popup Modal */}
      <DormLayoutOverviewModal
        isOpen={isOverviewModalOpen}
        onClose={() => setIsOverviewModalOpen(false)}
        dorms={dorms}
        students={students}
        users={effectiveUsers}
        currentUser={currentUser}
      />
    </div>
  );
};
