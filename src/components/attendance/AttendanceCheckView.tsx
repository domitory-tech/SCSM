import React, { useEffect, useState, useMemo } from "react";
import { DailyAttendance, Dormitory, Notice, Student, StudentAttendanceRecord, UserProfile } from "../../types";
import { formatThaiFullDate, formatThaiMediumDate, getPreviousDateString, getTodayDateString } from "../../utils/dateUtils";
import { fetchAttendance } from "../../services/api";

// Helper parsers for sorting grade, room, and student number
const parseGradeNum = (grade: string | undefined): number => {
  if (!grade) return 999;
  const match = grade.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
};

const parseRoomNum = (room: string | number | undefined): number => {
  if (room === undefined || room === null || room === "") return 999;
  const num = parseInt(String(room).replace(/\D/g, ""), 10);
  return isNaN(num) ? 999 : num;
};

const parseStudentNo = (no: string | number | undefined): number => {
  if (no === undefined || no === null || no === "") return 999999;
  const num = parseInt(String(no).replace(/\D/g, ""), 10);
  return isNaN(num) ? 999999 : num;
};
import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Home,
  Loader2,
  Lock,
  Megaphone,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X
} from "lucide-react";

interface AttendanceCheckViewProps {
  dorms: Dormitory[];
  selectedDormId: string;
  onDormChange: (dormId: string) => void;
  students: Student[];
  attendanceData?: DailyAttendance;
  notices: Notice[];
  onSaveAttendance: (payload: Partial<DailyAttendance>) => Promise<void>;
  currentUserName: string;
  currentUser?: UserProfile | null;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  onReturnToDashboard?: () => void;
}

export const AttendanceCheckView: React.FC<AttendanceCheckViewProps> = ({
  dorms,
  selectedDormId,
  onDormChange,
  students,
  attendanceData,
  notices,
  onSaveAttendance,
  currentUserName,
  currentUser,
  selectedDate: selectedDateProp,
  onDateChange,
  onReturnToDashboard
}) => {
  const todayStr = getTodayDateString();
  const [internalSelectedDate, setInternalSelectedDate] = useState<string>(todayStr);
  const selectedDate = selectedDateProp || internalSelectedDate;

  const setSelectedDate = (newDate: string) => {
    setInternalSelectedDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Editing Permissions Logic:
  // Level 1 (Admin) & Level 2 (Staff) can edit anytime
  // Level 3 (Teacher) can edit ONLY if selectedDate === todayStr
  const isToday = selectedDate === todayStr;
  const isAdminOrStaff = Boolean(currentUser && (currentUser.roleLevel === 1 || currentUser.roleLevel === 2));
  const canEditAttendance = Boolean(currentUser && (isAdminOrStaff || (currentUser.roleLevel === 3 && isToday)));

  const [isHomeBreak, setIsHomeBreak] = useState<boolean>(false);
  const [classRoomFilter, setClassRoomFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const availableClassRooms = React.useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade && s.room !== undefined && s.room !== null) {
        const gradeStr = String(s.grade).startsWith("ม.") ? String(s.grade) : `ม.${s.grade}`;
        set.add(`${gradeStr}/${s.room}`);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  }, [students]);

  // Records map: studentId -> StudentAttendanceRecord
  const [recordsMap, setRecordsMap] = useState<Record<string, StudentAttendanceRecord>>({});
  // Orientation notes array
  const [orientationNotes, setOrientationNotes] = useState<string[]>([""]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isCopyingYesterday, setIsCopyingYesterday] = useState<boolean>(false);
  const [copyNoticeMsg, setCopyNoticeMsg] = useState<{ type: "success" | "warning" | "info"; text: string } | null>(null);

  // Active notices for current selected date
  const activeDateNotices = useMemo(() => {
    return notices.filter((n) => n.date === selectedDate && n.topics && n.topics.length > 0);
  }, [notices, selectedDate]);

  // Head teacher notices auto popup states
  const [isAutoNoticePopupOpen, setIsAutoNoticePopupOpen] = useState<boolean>(false);
  const [hasDismissedPopupToday, setHasDismissedPopupToday] = useState<boolean>(false);

  // Auto trigger popup on page entry when today has head teacher notices
  useEffect(() => {
    if (isToday && activeDateNotices.length > 0 && !hasDismissedPopupToday) {
      setIsAutoNoticePopupOpen(true);
    } else if (!isToday) {
      // If date is changed to a past/future date, close popup immediately and show normal view
      setIsAutoNoticePopupOpen(false);
    }
  }, [isToday, activeDateNotices.length, hasDismissedPopupToday]);

  const accessibleDorms = React.useMemo(() => {
    if (!currentUser) return dorms;
    if (currentUser.roleLevel === 1) return dorms;
    if (currentUser.allowedDormIds && currentUser.allowedDormIds.length > 0) {
      return dorms.filter((d) => currentUser.allowedDormIds?.includes(d.id));
    }
    if (currentUser.dormId) {
      return dorms.filter((d) => d.id === currentUser.dormId);
    }
    return dorms;
  }, [dorms, currentUser]);

  // Auto enforce assigned dorms for user
  useEffect(() => {
    if (accessibleDorms.length > 0) {
      const hasAccess = accessibleDorms.some((d) => d.id === selectedDormId);
      if (!hasAccess) {
        onDormChange(accessibleDorms[0].id);
      }
    }
  }, [accessibleDorms, selectedDormId, onDormChange]);

  // Initialize records from existing attendanceData or default to all PRESENT (ไม่ต้องดึงรายชื่อเมื่อวานมาแสดงอัตโนมัติ)
  useEffect(() => {
    if (attendanceData && attendanceData.records && attendanceData.records.length > 0) {
      setIsHomeBreak(attendanceData.isHomeBreak || false);
      if (attendanceData.teacherOrientationNotes && attendanceData.teacherOrientationNotes.length > 0) {
        setOrientationNotes(attendanceData.teacherOrientationNotes);
      } else {
        setOrientationNotes([""]);
      }

      const map: Record<string, StudentAttendanceRecord> = {};
      attendanceData.records?.forEach((rec) => {
        map[rec.studentId] = rec;
      });

      // Default missing students to PRESENT
      students.forEach((s) => {
        if (!map[s.studentId]) {
          map[s.studentId] = { studentId: s.studentId, status: "PRESENT" };
        }
      });
      setRecordsMap(map);
    } else {
      setIsHomeBreak(false);
      // เรื่องที่อบรมให้ครูหอพักกรอกใหม่สำหรับวันนี้
      setOrientationNotes([""]);

      // กำหนดให้นักเรียนทุกคนเริ่มต้นเป็น "อยู่หอพัก" (PRESENT) ตามปกติ
      const map: Record<string, StudentAttendanceRecord> = {};
      students.forEach((s) => {
        map[s.studentId] = { studentId: s.studentId, status: "PRESENT" };
      });
      setRecordsMap(map);
    }
  }, [attendanceData, students, selectedDormId, selectedDate]);

  const currentDorm = dorms.find((d) => d.id === selectedDormId) || dorms[0];

  // Toggle Home Break Mode
  const handleToggleHomeBreak = () => {
    const nextState = !isHomeBreak;
    setIsHomeBreak(nextState);

    const updated: Record<string, StudentAttendanceRecord> = {};
    if (nextState) {
      // โหมดวันรอบกลับบ้าน เปิดอยู่ -> สถานะการเช็คยอดนักเรียนทุกคนเป็น "รอบกลับบ้าน" (ROUND_HOME)
      students.forEach((s) => {
        updated[s.studentId] = { studentId: s.studentId, status: "ROUND_HOME", reason: "รอบกลับบ้าน" };
      });
    } else {
      // โหมด ปิด (วันปกติ) -> สถานะการเช็คยอดนักเรียนทุกคนเป็น "อยู่หอพัก" (PRESENT)
      students.forEach((s) => {
        updated[s.studentId] = { studentId: s.studentId, status: "PRESENT", reason: "" };
      });
    }
    setRecordsMap(updated);
  };

  // Mark all students present ("อยู่หอพัก")
  const handleMarkAllPresent = () => {
    const updated: Record<string, StudentAttendanceRecord> = {};
    students.forEach((s) => {
      updated[s.studentId] = { studentId: s.studentId, status: "PRESENT", reason: "" };
    });
    setRecordsMap(updated);
  };

  // Mark all students home ("กลับบ้าน")
  const handleMarkAllHome = () => {
    const updated: Record<string, StudentAttendanceRecord> = {};
    students.forEach((s) => {
      updated[s.studentId] = { studentId: s.studentId, status: "HOME", reason: "กลับบ้าน" };
    });
    setRecordsMap(updated);
  };

  // Copy students who were marked out/home from previous day (เมื่อวาน)
  const handleCopyYesterdayOutStudents = async () => {
    if (!canEditAttendance) {
      alert("ท่านไม่มีสิทธิ์แก้ไขการเช็คยอดย้อนหลัง");
      return;
    }

    setIsCopyingYesterday(true);
    setCopyNoticeMsg(null);

    try {
      const prevDateStr = getPreviousDateString(selectedDate);
      const prevAttendance = await fetchAttendance(prevDateStr, selectedDormId);

      let prevRecords: StudentAttendanceRecord[] = [];
      let prevIsHomeBreak = false;

      if (prevAttendance && typeof prevAttendance === "object" && "records" in prevAttendance) {
        const attRec = prevAttendance as DailyAttendance;
        prevRecords = Array.isArray(attRec.records) ? attRec.records : [];
        prevIsHomeBreak = Boolean(attRec.isHomeBreak);
      }

      if (prevRecords.length === 0 && !prevIsHomeBreak) {
        setCopyNoticeMsg({
          type: "warning",
          text: `ไม่พบข้อมูลการเช็คยอดของวันที่ ${formatThaiFullDate(prevDateStr, false)} ในหอพักนี้`
        });
        setIsCopyingYesterday(false);
        return;
      }

      // Build map of previous day's out statuses
      const outStatusesMap = new Map<string, { status: StudentAttendanceRecord["status"]; reason?: string }>();
      let copiedCount = 0;

      prevRecords.forEach((r) => {
        // If student was NOT present (i.e. HOME, ROUND_HOME, CAMP, SICK, SKILL_COMP, EXCHANGE, OTHER)
        if (r.status !== "PRESENT") {
          outStatusesMap.set(r.studentId, {
            status: r.status,
            reason:
              r.reason ||
              (r.status === "HOME"
                ? "กลับบ้าน"
                : r.status === "ROUND_HOME"
                ? "รอบกลับบ้าน"
                : r.status === "CAMP"
                ? "เข้าค่าย"
                : "")
          });
          copiedCount++;
        }
      });

      // If yesterday was Home Break and had no individual records, or if homebreak
      if (prevIsHomeBreak && copiedCount === 0) {
        students.forEach((s) => {
          outStatusesMap.set(s.studentId, { status: "ROUND_HOME", reason: "รอบกลับบ้าน" });
          copiedCount++;
        });
      }

      // Update current recordsMap:
      // For students in this dorm: if they were out yesterday, assign their out status and reason; otherwise, default to PRESENT
      const newRecordsMap: Record<string, StudentAttendanceRecord> = {};
      students.forEach((s) => {
        const prevOut = outStatusesMap.get(s.studentId);
        if (prevOut) {
          newRecordsMap[s.studentId] = {
            studentId: s.studentId,
            status: prevOut.status,
            reason: prevOut.reason || ""
          };
        } else {
          newRecordsMap[s.studentId] = {
            studentId: s.studentId,
            status: "PRESENT",
            reason: ""
          };
        }
      });

      setRecordsMap(newRecordsMap);

      if (copiedCount > 0) {
        setCopyNoticeMsg({
          type: "success",
          text: `คัดลอกรายชื่อนักเรียนที่ออกบ้านจากวันที่ ${formatThaiFullDate(prevDateStr, false)} เรียบร้อยแล้ว (พบนักเรียนออกหอพัก ${copiedCount} คน)`
        });
      } else {
        setCopyNoticeMsg({
          type: "info",
          text: `ในวันที่ ${formatThaiFullDate(prevDateStr, false)} นักเรียนในหอพักนี้อยู่ครบทุกคน (ไม่มีนักเรียนออกบ้าน)`
        });
      }
    } catch (err: any) {
      console.error("Error copying yesterday out students:", err);
      setCopyNoticeMsg({
        type: "warning",
        text: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err?.message || "ไม่สามารถเชื่อมต่อได้"}`
      });
    } finally {
      setIsCopyingYesterday(false);
    }
  };

  // Change individual status
  const handleStatusChange = (
    studentId: string,
    status: StudentAttendanceRecord["status"],
    reason?: string
  ) => {
    setRecordsMap((prev) => ({
      ...prev,
      [studentId]: {
        studentId,
        status,
        reason: reason !== undefined ? reason : prev[studentId]?.reason || ""
      }
    }));
  };

  // Orientation notes helpers
  const handleAddNoteField = () => {
    setOrientationNotes((prev) => [...prev, ""]);
  };

  const handleUpdateNote = (index: number, val: string) => {
    setOrientationNotes((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveNote = (index: number) => {
    setOrientationNotes((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler - opens confirmation modal
  const handleSave = () => {
    if (!canEditAttendance) {
      alert("ท่านไม่มีสิทธิ์แก้ไขการเช็คยอดย้อนหลัง (สิทธิ์แก้ไขย้อนหลังเฉพาะผู้ดูแล/เจ้าหน้าที่ หรือครูหอพักในวันที่ปัจจุบันเท่านั้น)");
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Perform actual save after confirmation
  const executeSave = async () => {
    if (!canEditAttendance) {
      alert("ท่านไม่มีสิทธิ์แก้ไขการเช็คยอดย้อนหลัง");
      return;
    }
    setIsConfirmModalOpen(false);
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const payload: Partial<DailyAttendance> = {
        date: selectedDate,
        dormId: selectedDormId,
        isHomeBreak,
        checkedBy: currentUserName,
        teacherOrientationNotes: orientationNotes.filter((n) => n.trim().length > 0),
        records: Object.values(recordsMap)
      };

      await onSaveAttendance(payload);
      setSaveSuccessMsg("บันทึกการเช็คยอดสำเร็จเรียบร้อยแล้ว กำลังกลับไปหน้าภาพรวม...");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        if (onReturnToDashboard) {
          onReturnToDashboard();
        }
      }, 1000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter & Sort students: เรียงจากน้อยไปหามาก: 1) ระดับชั้น 2) ห้อง 3) เลขที่ 4) รหัสนักเรียน
  const filteredStudents = useMemo(() => {
    const list = students.filter((s) => {
      if (classRoomFilter !== "ALL") {
        const gradeStr = String(s.grade).startsWith("ม.") ? String(s.grade) : `ม.${s.grade}`;
        const studentClassRoom = `${gradeStr}/${s.room}`;
        if (studentClassRoom !== classRoomFilter) return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const fullName = `${s.title}${s.firstName} ${s.lastName}`.toLowerCase();
        const nickname = (s.nickname || "").toLowerCase();
        return (
          fullName.includes(q) ||
          nickname.includes(q) ||
          s.studentId.includes(q) ||
          `ม.${s.grade}`.includes(q) ||
          `ห้อง ${s.room}`.includes(q) ||
          `${s.grade}/${s.room}`.includes(q)
        );
      }
      return true;
    });

    return list.sort((a, b) => {
      // 1. ระดับชั้น (Grade: ม.1 < ม.2 < ... < ม.6)
      const gradeA = parseGradeNum(a.grade);
      const gradeB = parseGradeNum(b.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;

      // 2. ห้อง (Room: 1 < 2 < 3 ...)
      const roomA = parseRoomNum(a.room);
      const roomB = parseRoomNum(b.room);
      if (roomA !== roomB) return roomA - roomB;

      // 3. เลขที่ (No: 1 < 2 < 3 ...)
      const noA = parseStudentNo(a.no);
      const noB = parseStudentNo(b.no);
      if (noA !== noB) return noA - noB;

      // 4. รหัสนักเรียน (Student ID)
      return (a.studentId || "").localeCompare(b.studentId || "", "th", { numeric: true });
    });
  }, [students, classRoomFilter, searchQuery]);

  // Calculate summary stats for current view
  const presentCount = (Object.values(recordsMap) as StudentAttendanceRecord[]).filter((r) => r.status === "PRESENT").length;
  const absentCount = (Object.values(recordsMap) as StudentAttendanceRecord[]).filter((r) => r.status !== "PRESENT").length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#A05AFF] uppercase tracking-wide">
              <Clock className="w-4 h-4" />
              <span>การเช็คยอดประจำวันเวลา 20.00 น.</span>
            </div>
            <h2 className="text-xl font-black text-gray-900 mt-1">
              เช็ครายชื่อนักเรียน {currentDorm?.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ครูผู้เช็คยอด: <strong className="text-gray-800">{currentDorm?.teacherName}</strong> • ความจุหอพัก: {currentDorm?.capacity} คน
            </p>
          </div>

          {/* Controls: Dorm Selector, Date Picker, Home Break Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Dorm Selector */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                {accessibleDorms.length === 1 ? "หอพักที่รับผิดชอบ" : "เลือกหอพัก"}
              </label>
              {accessibleDorms.length === 1 ? (
                <div className="bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{accessibleDorms[0]?.name || "หอพักของคุณ"}</span>
                </div>
              ) : (
                <select
                  value={selectedDormId}
                  onChange={(e) => onDormChange(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none cursor-pointer"
                >
                  {accessibleDorms.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                วันที่เช็คยอด (เลือกย้อนหลังได้ ไม่เกินวันนี้)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val > todayStr) {
                      alert("⚠️ ไม่สามารถเช็คยอดเกินวันที่ปัจจุบันได้");
                      setSelectedDate(todayStr);
                    } else {
                      setSelectedDate(val || todayStr);
                    }
                  }}
                  className="bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none cursor-pointer"
                />
                <div className="bg-pink-50 border border-pink-200 text-pink-800 text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-xs">
                  <Calendar className="w-4 h-4 text-pink-600 shrink-0" />
                  <span>{formatThaiFullDate(selectedDate)}</span>
                </div>
              </div>
            </div>

            {/* Home Break Toggle */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">โหมดรอบวันกลับบ้าน</label>
              <button
                type="button"
                onClick={handleToggleHomeBreak}
                disabled={!canEditAttendance}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isHomeBreak
                    ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/50"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>{isHomeBreak ? "วันรอบกลับบ้าน (เปิดอยู่)" : "ปิด (วันปกติ)"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-3.5 text-indigo-950 flex items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>เงื่อนไขการแก้ไข:</strong> ครูหอพักสามารถกลับมาแก้ไขยอดของวันนี้ ({formatThaiFullDate(todayStr)}) ได้ตลอดเวลาภายในวันนี้ก่อนเวลา 24.00 น. (00.00 น.) หากขึ้นวันใหม่แล้วจะไม่สามารถแก้ไขย้อนหลังได้
          </span>
        </div>
      </div>

      {/* Head Notice Alert Banner */}
      {activeDateNotices.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-950 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
            <div className="flex items-center gap-2 font-black text-sm text-amber-900">
              <Megaphone className="w-5 h-5 text-amber-600 shrink-0" />
              <span>เรื่องแจ้งเน้นย้ำจากหัวหน้างานหอพัก ({formatThaiFullDate(selectedDate)})</span>
              {isToday && (
                <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                  วันนี้
                </span>
              )}
            </div>
            {isToday && (
              <button
                type="button"
                onClick={() => setIsAutoNoticePopupOpen(true)}
                className="self-start sm:self-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>เปิดดูการแจ้งเตือน (Popup)</span>
              </button>
            )}
          </div>
          <div className="text-xs space-y-2.5">
            {activeDateNotices.map((n) => (
              <div key={n.id} className="bg-white/90 rounded-xl p-3.5 border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-amber-100 pb-1.5">
                  <strong className="text-amber-950 font-bold text-sm flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{n.title}</span>
                  </strong>
                  {n.createdBy && (
                    <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-md">
                      ผู้แจ้ง: {n.createdBy}
                    </span>
                  )}
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium pl-1">
                  {n.topics.map((tp, idx) => (
                    <li key={idx} className="leading-relaxed">{tp}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Orientation Notes Section (บันทึกเรื่องที่อบรมนักเรียนประจำวัน) */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-800 text-sm">
                  บันทึกเรื่องที่ครูประจำหอพักอบรมนักเรียนในวันนี้
                </h3>
                {orientationNotes.filter((n) => n.trim().length > 0).length > 0 ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md">
                    ✓ ระบุแล้ว {orientationNotes.filter((n) => n.trim().length > 0).length} เรื่อง
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-md flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    ต้องระบุอย่างน้อย 1 เรื่อง
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">ระบุหัวข้อหรือเรื่องที่ได้อบรมสั่งสอนนักเรียน (บันทึกได้มากกว่า 1 เรื่อง)</p>
            </div>
          </div>
          {canEditAttendance && (
            <button
              type="button"
              onClick={handleAddNoteField}
              className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหัวข้ออบรม</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {orientationNotes.map((note, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-600 w-6 text-center">{index + 1}.</span>
              <input
                type="text"
                value={note}
                disabled={!canEditAttendance}
                onChange={(e) => handleUpdateNote(index, e.target.value)}
                placeholder={`ระบุเรื่องที่อบรมนักเรียน เรื่องที่ ${index + 1}...`}
                className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white text-xs text-gray-800 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
              />
              {orientationNotes.length > 1 && canEditAttendance && (
                <button
                  type="button"
                  onClick={() => handleRemoveNote(index)}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Attendance List Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Action Header Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3">
          {/* Row 1: Search Box & Counter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ, รหัส, เลขที่, ห้อง..."
                className="w-full bg-white border border-gray-300 text-xs text-gray-800 rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-3.5 py-2 rounded-xl whitespace-nowrap shadow-2xs self-start sm:self-auto">
              <span className="text-emerald-600">อยู่หอ {presentCount}</span> / <span className="text-rose-600">ออกหอพัก {absentCount}</span>
            </div>
          </div>

          {/* Row 2: Quick Action Buttons & Combined Grade/Room Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-gray-200/70">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quick Mark All Present */}
              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={isHomeBreak || !canEditAttendance || isCopyingYesterday}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>อยู่ครบทุกคน</span>
              </button>

              {/* Quick Mark All Home (Orange Button) */}
              <button
                type="button"
                onClick={handleMarkAllHome}
                disabled={isHomeBreak || !canEditAttendance || isCopyingYesterday}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserMinus className="w-4 h-4" />
                <span>กลับบ้านทุกคน</span>
              </button>

              {/* Copy Yesterday Out Students Button */}
              <button
                type="button"
                onClick={handleCopyYesterdayOutStudents}
                disabled={isHomeBreak || !canEditAttendance || isCopyingYesterday}
                title={`คัดลอกรายชื่อนักเรียนที่ออกบ้านจากวันที่ ${formatThaiMediumDate(getPreviousDateString(selectedDate))} ของหอพักนี้`}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isCopyingYesterday ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>คัดลอกรายชื่อนักเรียนออกบ้าน</span>
              </button>
            </div>

            {/* Combined Class & Room Filter */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-gray-600 shrink-0">ระดับชั้น/ห้อง:</span>
              <select
                value={classRoomFilter}
                onChange={(e) => setClassRoomFilter(e.target.value)}
                className="bg-white border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-purple-500 min-w-[130px]"
              >
                <option value="ALL">ทั้งหมด</option>
                {availableClassRooms.map((cr) => (
                  <option key={cr} value={cr}>
                    {cr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Copy Yesterday Out Students Result Alert */}
        {copyNoticeMsg && (
          <div
            className={`p-3.5 border-b flex items-center justify-between gap-3 text-xs animate-fade-in ${
              copyNoticeMsg.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : copyNoticeMsg.type === "warning"
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : "bg-blue-50 text-blue-900 border-blue-200"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {copyNoticeMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{copyNoticeMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setCopyNoticeMsg(null)}
              className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded-md hover:bg-black/5 cursor-pointer transition-colors"
            >
              ปิด
            </button>
          </div>
        )}

        {/* If Home Break Mode Active Notice */}
        {isHomeBreak && (
          <div className="p-4 bg-amber-50 text-amber-900 border-b border-amber-200 flex items-center gap-3">
            <Home className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <strong className="font-bold">โหมดรอบวันกลับบ้านกำลังเปิดใช้งาน:</strong> นักเรียนทุกสังกัดหอพักถือว่ากลับบ้านโดยอัตโนมัติ ไม่จำเป็นต้องเช็ครายชื่อรายคน
            </div>
          </div>
        )}

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-100/80 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">เลขที่</th>
                <th className="py-3 px-4">รหัส / ชื่อ - นามสกุล</th>
                <th className="py-3 px-3">ชื่อเล่น</th>
                <th className="py-3 px-4">ระดับชั้น/ห้อง</th>
                <th className="py-3 px-4">ห้องหอ</th>
                <th className="py-3 px-4 min-w-[220px]">สถานะการเช็คยอด</th>
                <th className="py-3 px-4">เหตุผล/หมายเหตุเพิ่มเติม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                    ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const rec = recordsMap[student.studentId] || { studentId: student.studentId, status: "PRESENT" };
                  const isPresent = rec.status === "PRESENT";

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        !isPresent && !isHomeBreak ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-gray-900 text-center">{student.no}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-sm">
                          {student.title}{student.firstName} {student.lastName}
                        </div>
                        <div className="text-[10px] text-gray-400">รหัส: {student.studentId}</div>
                      </td>
                      <td className="py-3 px-3">
                        {student.nickname ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            {student.nickname}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-700">
                        {student.grade}/{student.room}
                      </td>
                      <td className="py-3 px-4 font-medium text-purple-700">
                        ห้อง {student.dormRoom}
                      </td>

                      {/* Status Select Box */}
                      <td className="py-3 px-4">
                        <select
                          disabled={isHomeBreak || !canEditAttendance}
                          value={rec.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as StudentAttendanceRecord["status"];
                            handleStatusChange(
                              student.studentId,
                              newStatus,
                              newStatus === "OTHER" ? rec.reason : ""
                            );
                          }}
                          className={`w-full max-w-[210px] font-bold text-xs rounded-xl px-3 py-2 border outline-none transition-all shadow-2xs disabled:opacity-75 disabled:cursor-not-allowed ${
                            rec.status === "ROUND_HOME"
                              ? "bg-slate-100 border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-400"
                              : rec.status === "PRESENT"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                              : rec.status === "HOME"
                              ? "bg-amber-50 border-amber-300 text-amber-800 focus:ring-2 focus:ring-amber-500"
                              : rec.status === "CAMP"
                              ? "bg-blue-50 border-blue-300 text-blue-800 focus:ring-2 focus:ring-blue-500"
                              : rec.status === "SICK"
                              ? "bg-rose-50 border-rose-300 text-rose-800 focus:ring-2 focus:ring-rose-500"
                              : rec.status === "SKILL_COMP"
                              ? "bg-purple-50 border-purple-300 text-purple-800 focus:ring-2 focus:ring-purple-500"
                              : rec.status === "EXCHANGE"
                              ? "bg-sky-50 border-sky-300 text-sky-800 focus:ring-2 focus:ring-sky-500"
                              : "bg-amber-950/10 border-amber-900/30 text-amber-950 focus:ring-2 focus:ring-amber-900"
                          }`}
                        >
                          <option value="ROUND_HOME" className="bg-white text-gray-800 font-medium">รอบกลับบ้าน</option>
                          <option value="PRESENT" className="bg-white text-gray-800 font-medium">อยู่หอพัก</option>
                          <option value="HOME" className="bg-white text-gray-800 font-medium">กลับบ้าน</option>
                          <option value="CAMP" className="bg-white text-gray-800 font-medium">เข้าค่าย</option>
                          <option value="SICK" className="bg-white text-gray-800 font-medium">ป่วย</option>
                          <option value="SKILL_COMP" className="bg-white text-gray-800 font-medium">แข่งทักษะ</option>
                          <option value="EXCHANGE" className="bg-white text-gray-800 font-medium">แลกเปลี่ยน</option>
                          <option value="OTHER" className="bg-white text-gray-800 font-medium">อื่น</option>
                        </select>
                      </td>

                      {/* Reason / Detail Input - Only for OTHER status */}
                      <td className="py-3 px-4">
                        {rec.status === "OTHER" && !isHomeBreak ? (
                          <input
                            type="text"
                            value={rec.reason || ""}
                            disabled={!canEditAttendance}
                            onChange={(e) =>
                              handleStatusChange(student.studentId, rec.status, e.target.value)
                            }
                            placeholder="ระบุเหตุผลเพิ่มเติม..."
                            className="w-full bg-white border border-purple-300 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                          />
                        ) : (
                          <span className="text-gray-300 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Bar with Save Button & Notification */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            {saveSuccessMsg ? (
              <span className="font-bold text-emerald-600 flex items-center gap-1.5 animate-bounce">
                <CheckCircle2 className="w-4 h-4" />
                {saveSuccessMsg}
              </span>
            ) : !canEditAttendance ? (
              <span className="text-amber-700 font-medium">
                ขณะนี้อยู่ในโหมดดูข้อมูลย้อนหลัง ไม่สามารถแก้ไขการเช็คยอดได้
              </span>
            ) : (
              <span>ระบบจะบันทึกผลไปยังฐานข้อมูลและอัปเดตรายงานสรุปทันที</span>
            )}
          </div>

          {!canEditAttendance ? (
            <div className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>โหมดดูข้อมูลย้อนหลัง (เฉพาะผู้ดูแล/เจ้าหน้าที่ หรือครูหอพักในวันที่ปัจจุบันเท่านั้นที่สามารถแก้ไขได้)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกการเช็คยอดประจำวัน</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Save Confirmation Alert Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 space-y-4 p-5">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold">
                <CheckCircle2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">
                  ยืนยันการบันทึกการเช็คยอดประจำวัน
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {currentDorm?.name} • วันที่ {selectedDate}
                </p>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">อยู่หอพัก</span>
                <span className="text-xl font-black text-emerald-800">{presentCount} คน</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">ออกหอพัก / ลา / ป่วย</span>
                <span className="text-xl font-black text-rose-800">{absentCount} คน</span>
              </div>
            </div>

            {/* Check Orientation Notes Validation */}
            {(() => {
              const validNotes = orientationNotes.filter((n) => n.trim().length > 0);
              if (validNotes.length === 0) {
                return (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-extrabold text-amber-950 block text-sm">
                        ⚠️ ยังไม่ได้ระบุ "เรื่องที่อบรมนักเรียนในวันนี้"
                      </strong>
                      <span className="text-amber-800 leading-relaxed block mt-0.5">
                        ระบบกำหนดให้ระบุอย่างน้อย 1 เรื่องที่ครูประจำหอพักได้อบรมสั่งสอนนักเรียนในวันนี้ คุณต้องการยืนยันการบันทึกโดยไม่มีเรื่องแจ้งอบรมหรือไม่?
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-purple-950">
                    <BookOpen className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>เรื่องที่ครูประจำหอพักอบรมนักเรียนในวันนี้ ({validNotes.length} เรื่อง):</span>
                  </div>
                  <ol className="list-decimal list-inside text-purple-900 font-medium space-y-1 pl-1">
                    {validNotes.map((note, idx) => (
                      <li key={idx} className="leading-relaxed">{note}</li>
                    ))}
                  </ol>
                </div>
              );
            })()}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                กลับไปแก้ไข
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-5 py-2 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-90 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>ยืนยันบันทึกข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Popup: Head Teacher Notices Modal (แสดงเตือนก่อนเช็คยอดเมื่อมีประกาศประจำวัน) */}
      {isAutoNoticePopupOpen && isToday && activeDateNotices.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-amber-400 space-y-5 animate-scale-up relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-orange-400/20 rounded-full blur-2xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Megaphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                      ⚡ เรื่องแจ้งเน้นย้ำด่วน
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                      {formatThaiFullDate(todayStr)}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-gray-900 mt-1">
                    เรื่องแจ้งเน้นย้ำจากหัวหน้างานหอพัก
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAutoNoticePopupOpen(false);
                  setHasDismissedPopupToday(true);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notice Items List */}
            <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1">
              {activeDateNotices.map((n) => (
                <div key={n.id} className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
                    <h4 className="font-black text-sm text-amber-950 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{n.title}</span>
                    </h4>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2.5 py-0.5 rounded-full">
                      ผู้แจ้ง: {n.createdBy || "หัวหน้างานหอพัก"}
                    </span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {n.topics.map((topic, tIdx) => (
                      <div
                        key={tIdx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-white/95 border border-amber-200/80 text-amber-950 font-semibold text-xs leading-relaxed shadow-2xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {tIdx + 1}
                        </span>
                        <span className="flex-1">{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Teacher Guidance Note */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-700 text-xs leading-relaxed">
              <span className="text-amber-500 text-lg leading-none shrink-0 mt-0.5">💡</span>
              <div>
                <strong>คำแนะนำสำหรับครูประจำหอพัก:</strong> โปรดนำหัวข้อที่ได้รับแจ้งเน้นย้ำไปอบรมสั่งสอนนักเรียนในหอพักประจำวันนี้ และบันทึกผลการอบรมในส่วน <em>"บันทึกเรื่องที่ครูประจำหอพักอบรมนักเรียน"</em> ก่อนกดยืนยันบันทึกยอด
              </div>
            </div>

            {/* Modal Primary Action Button */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsAutoNoticePopupOpen(false);
                  setHasDismissedPopupToday(true);
                }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>รับทราบเรื่องแจ้งอบรม (เริ่มเช็คยอดนักเรียน)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
