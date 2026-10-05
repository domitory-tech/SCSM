import React, { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Dormitory, Student, UserProfile } from "../../types";
import { matchStudentToDorm, findDormForStudent, countStudentsInDorm } from "../../utils/dormUtils";
import { deleteSampleData } from "../../services/api";

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
  Download,
  Edit,
  FileSpreadsheet,
  Filter,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  PauseCircle,
  PlayCircle,
  ArrowRightLeft,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Home,
  Check
} from "lucide-react";
import { SystemSettings } from "../../types";

interface StudentManagementViewProps {
  dorms: Dormitory[];
  students: Student[];
  onImportStudents: (dormId: string, students: Partial<Student>[]) => Promise<void>;
  onAddStudent: (student: Partial<Student>) => Promise<void>;
  onUpdateStudent?: (id: string, student: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onBatchDeleteStudents?: (ids: string[]) => Promise<void>;
  onClearStudents?: (mode: "BY_DORM" | "ALL", dormId?: string) => Promise<void>;
  onBatchTransferDorm?: (studentIds: string[], targetDormId: string, targetDormRoom?: string) => Promise<void>;
  currentUser?: UserProfile | null;
  systemSettings?: SystemSettings;
  onUpdateSystemSettings?: (settings: SystemSettings) => Promise<void> | void;
}

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({
  dorms,
  students,
  onImportStudents,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBatchDeleteStudents,
  onClearStudents,
  onBatchTransferDorm,
  currentUser,
  systemSettings,
  onUpdateSystemSettings
}) => {
  const [selectedDormFilter, setSelectedDormFilter] = useState<string>("ALL");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Batch Selection & Deletion Modal State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [studentsToDelete, setStudentsToDelete] = useState<Student[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>("");
  const [deletePasswordError, setDeletePasswordError] = useState<string>("");

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"EXCEL" | "PASTE">("EXCEL");
  const [importDormId, setImportDormId] = useState<string>(dorms[0]?.id || "dorm-1");
  const [pasteText, setPasteText] = useState<string>("");
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [previewStudents, setPreviewStudents] = useState<Partial<Student>[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    dormId: dorms[0]?.id || "dorm-1",
    no: 1,
    studentId: "",
    title: "นาย",
    firstName: "",
    lastName: "",
    nickname: "",
    grade: "ม.1",
    room: 1,
    dormRoom: "101",
    dormBed: "1"
  });

  const isAdmin = currentUser?.roleLevel === 1;
  const isStaff = currentUser?.roleLevel === 2;
  const canManagePause = isAdmin || isStaff;

  // Attendance Pause modal states
  const [isPauseModalOpen, setIsPauseModalOpen] = useState<boolean>(false);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>(
    systemSettings?.attendancePauseReason || "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
  );
  const [isSavingPause, setIsSavingPause] = useState<boolean>(false);

  // Clear All Students modal states
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);
  const [clearAllPassword, setClearAllPassword] = useState<string>("");
  const [clearAllPasswordError, setClearAllPasswordError] = useState<string>("");
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);

  // Clear Dorm Students modal states
  const [isClearDormModalOpen, setIsClearDormModalOpen] = useState<boolean>(false);
  const [clearDormPassword, setClearDormPassword] = useState<string>("");
  const [clearDormPasswordError, setClearDormPasswordError] = useState<string>("");
  const [isClearingDorm, setIsClearingDorm] = useState<boolean>(false);

  // Batch Transfer Students modal states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [targetTransferDormId, setTargetTransferDormId] = useState<string>(dorms[0]?.id || "dorm-1");
  const [targetTransferRoom, setTargetTransferRoom] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Toggle Attendance Pause
  const handleToggleAttendancePause = async (pause: boolean) => {
    if (!onUpdateSystemSettings) return;
    setIsSavingPause(true);
    try {
      const now = new Date();
      const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
      const timeStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} น.`;

      const newSettings: SystemSettings = {
        ...(systemSettings || {} as any),
        isAttendancePaused: pause,
        attendancePauseReason: pauseReasonInput.trim() || "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่",
        attendancePausedAt: pause ? timeStr : "",
        attendancePausedBy: pause ? (currentUser?.name || "ผู้ดูแลระบบ") : ""
      };
      await onUpdateSystemSettings(newSettings);
      setIsPauseModalOpen(false);
      alert(pause ? "หยุดการเช็คยอดนักเรียนชั่วคราวเรียบร้อยแล้ว" : "เปิดระบบให้เช็คยอดตามปกติเรียบร้อยแล้ว");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการปรับสถานะ: " + (err?.message || err));
    } finally {
      setIsSavingPause(false);
    }
  };

  // Helper password validator
  const verifyAdminOrStaffPassword = (enteredPassword: string): boolean => {
    const validPasswords = ["123456"];
    if (currentUser?.password) {
      validPasswords.push(currentUser.password);
    }
    return validPasswords.includes(enteredPassword.trim()) || enteredPassword.trim() === "123456";
  };

  // Handle Download Excel Template
  const handleDownloadExcelTemplate = () => {
    const headers = ["เลขที่", "รหัสนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อเล่น", "ระดับชั้น", "ห้อง", "ห้องพักหอ", "เตียง"];
    const sampleRows = [
      [1, "66001", "นาย", "กิตติพงษ์", "สุขเจริญ", "กิต", "ม.1", 1, "101", "1"],
      [2, "66002", "นาย", "ชินวัตร", "งามศิลป์", "บาส", "ม.1", 1, "101", "1"],
      [3, "66003", "นางสาว", "ศิริพร", "ใจดี", "พลอย", "ม.4", 2, "201", "1"],
      [4, "66004", "ด.ช.", "ภานุวัฒน์", "ยอดแก้ว", "นุ", "ม.2", 1, "103", "2"]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "แบบฟอร์มนำเข้านักเรียนหอพัก.xlsx");
  };

  // Handle Export Current Students List to Excel
  const handleExportCurrentStudentsToExcel = () => {
    if (filteredStudents.length === 0) {
      alert("ไม่มีข้อมูลนักเรียนสำหรับส่งออก");
      return;
    }

    const exportData = filteredStudents.map((s) => {
      const dormObj = dorms.find((d) => d.id === s.dormId);
      return {
        "เลขที่": s.no,
        "รหัสนักเรียน": s.studentId,
        "คำนำหน้า": s.title,
        "ชื่อ": s.firstName,
        "นามสกุล": s.lastName,
        "ชื่อเล่น": s.nickname || "-",
        "ระดับชั้น": s.grade,
        "ห้อง": s.room,
        "หอพัก": dormObj?.name || s.dormId,
        "ห้องพักหอ": s.dormRoom,
        "เตียง": s.dormBed || "-"
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 16 },
      { wch: 12 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, `รายชื่อนักเรียนหอพัก_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Handle Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!json || json.length === 0) {
          alert("ไฟล์ว่างเปล่าหรือไม่พบข้อมูลในไฟล์ Excel");
          return;
        }

        let headerRowIndex = -1;
        let headerRowCols: string[] = [];
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const rowCols = (json[i] || []).map((c) => String(c ?? "").trim());
          const rowStr = rowCols.join(" ");
          if (rowStr.includes("ชื่อ") || rowStr.includes("รหัส") || rowStr.includes("เลขที่")) {
            headerRowIndex = i;
            headerRowCols = rowCols;
            break;
          }
        }

        const findColIdx = (keywords: string[]) =>
          headerRowCols.findIndex((col) => {
            const clean = col.toLowerCase().replace(/\s+/g, "");
            return keywords.some((k) => clean.includes(k.toLowerCase().replace(/\s+/g, "")));
          });

        const colIdxNo = findColIdx(["เลขที่", "ลำดับ", "no"]);
        const colIdxId = findColIdx(["รหัส", "studentid"]);
        const colIdxTitle = findColIdx(["คำนำหน้า", "คำนำ", "title", "prefix"]);
        const colIdxFirst = findColIdx(["ชื่อจริง", "ชื่อ"]);
        const colIdxLast = findColIdx(["นามสกุล", "สกุล"]);
        const colIdxNick = findColIdx(["ชื่อเล่น", "เล่น", "nickname"]);
        const colIdxGrade = findColIdx(["ระดับชั้น", "ชั้น", "grade"]);
        const colIdxRoom = findColIdx(["ห้องเรียน", "ห้อง", "room"]);
        const colIdxDorm = findColIdx(["หอพัก", "หอ", "dorm"]);
        const colIdxDormRoom = findColIdx(["ห้องพักหอ", "ห้องพัก", "ห้องหอ", "dormroom"]);
        const colIdxBed = findColIdx(["เตียง", "bed"]);

        const rowsToProcess = headerRowIndex >= 0 ? json.slice(headerRowIndex + 1) : json;
        const parsed: Partial<Student>[] = [];

        rowsToProcess.forEach((row, idx) => {
          if (!row || row.length === 0) return;
          const colStr = row.map((cell) => String(cell ?? "").trim());
          if (colStr.every((c) => c === "")) return;
          if (colStr[0].includes("เลขที่") || colStr[1]?.includes("รหัส")) return;

          let no = (colIdxNo >= 0 && colStr[colIdxNo] ? parseInt(colStr[colIdxNo]) : 0) || parseInt(colStr[0]) || idx + 1;
          let studentId = (colIdxId >= 0 && colStr[colIdxId]) ? colStr[colIdxId] : (colStr[1] || `${Date.now() + idx}`);
          let title = (colIdxTitle >= 0 && colStr[colIdxTitle]) ? colStr[colIdxTitle] : (colStr[2] || "นาย");
          let firstName = (colIdxFirst >= 0 && colStr[colIdxFirst]) ? colStr[colIdxFirst] : (colStr[3] || "");
          let lastName = (colIdxLast >= 0 && colStr[colIdxLast]) ? colStr[colIdxLast] : (colStr[4] || "");
          let nickname = (colIdxNick >= 0 && colStr[colIdxNick]) ? colStr[colIdxNick] : "";
          let grade = (colIdxGrade >= 0 && colStr[colIdxGrade]) ? colStr[colIdxGrade] : "";
          let room = (colIdxRoom >= 0 && colStr[colIdxRoom] ? parseInt(colStr[colIdxRoom]) : 0) || 1;
          let dormRoom = (colIdxDormRoom >= 0 && colStr[colIdxDormRoom]) ? colStr[colIdxDormRoom] : "101";
          let dormBed = (colIdxBed >= 0 && colStr[colIdxBed]) ? colStr[colIdxBed] : "";

          // Auto-detect dormitory from column if present
          let matchedDormId = importDormId;
          if (colIdxDorm >= 0 && colStr[colIdxDorm]) {
            const rawDorm = colStr[colIdxDorm].trim();
            const matched = dorms.find((d) =>
              d.id === rawDorm ||
              d.name.toLowerCase() === rawDorm.toLowerCase() ||
              d.name.includes(rawDorm) ||
              rawDorm.includes(d.name) ||
              (rawDorm.match(/\d+/) && d.name.includes(rawDorm.match(/\d+/)![0]))
            );
            if (matched) {
              matchedDormId = matched.id;
            }
          }

          // Fallback legacy positional layout if header wasn't detailed
          if (!grade && colStr.length >= 6) {
            if (headerRowCols.length === 0 || colIdxGrade < 0) {
              nickname = colStr[5] || "";
              grade = colStr[6] || colStr[5] || "ม.1";
              room = parseInt(colStr[7]) || parseInt(colStr[6]) || 1;
              dormRoom = colStr[8] || colStr[7] || "101";
              dormBed = colStr[9] || colStr[8] || "";
            }
          }
          if (!grade) grade = "ม.1";

          if (!lastName && firstName.includes(" ")) {
            const parts = firstName.split(/\s+/);
            firstName = parts[0];
            lastName = parts.slice(1).join(" ");
          }

          if (firstName) {
            parsed.push({
              no,
              studentId,
              title,
              firstName,
              lastName,
              nickname,
              grade,
              room,
              dormId: matchedDormId,
              dormRoom,
              dormBed
            });
          }
        });

        if (parsed.length === 0) {
          alert("ไม่พบรูปแบบรายชื่อนักเรียนที่ถูกต้องในไฟล์ Excel กรุณาใช้ไฟล์แบบฟอร์มตัวอย่าง");
          return;
        }

        setPreviewStudents(parsed);
        setExcelFileName(file.name);
      } catch (err: any) {
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Text Paste Parsing to Preview
  const handleParsePasteText = () => {
    if (!pasteText.trim()) {
      alert("กรุณาวางข้อมูลรายชื่อนักเรียนก่อนทำรายการ");
      return;
    }

    const lines = pasteText.trim().split("\n");
    const parsed: Partial<Student>[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      if (parts.length >= 4) {
        if (parts[0].includes("เลขที่") || parts[1]?.includes("รหัส")) return;

        let no = parseInt(parts[0]) || idx + 1;
        let studentId = parts[1] || `${Date.now() + idx}`;
        let title = parts[2] || "นาย";
        let firstName = parts[3] || "";
        let lastName = parts[4] || "";
        let nickname = "";
        let grade = "ม.1";
        let room = 1;
        let dormRoom = "101";
        let dormBed = "";
        let matchedDormId = importDormId;

        if (parts.length >= 10) {
          nickname = parts[5] || "";
          grade = parts[6] || "ม.1";
          room = parseInt(parts[7]) || 1;
          const dormPart = parts[8] || "";
          const matched = dorms.find((d) => d.id === dormPart || d.name.includes(dormPart) || (dormPart.match(/\d+/) && d.name.includes(dormPart.match(/\d+/)![0])));
          if (matched) matchedDormId = matched.id;
          dormRoom = parts[9] || "101";
          dormBed = parts[10] ? parts[10].trim() : "";
        } else if (parts.length >= 9) {
          nickname = parts[5] || "";
          grade = parts[6] || "ม.1";
          room = parseInt(parts[7]) || 1;
          dormRoom = parts[8] || "101";
          dormBed = parts[9] ? parts[9].trim() : "";
        } else {
          nickname = "";
          grade = parts[5] || "ม.1";
          room = parseInt(parts[6]) || 1;
          dormRoom = parts[7] || "101";
          dormBed = parts[8] ? parts[8].trim() : "";
        }

        if (!lastName && firstName.includes(" ")) {
          const p = firstName.split(/\s+/);
          firstName = p[0];
          lastName = p.slice(1).join(" ");
        }

        parsed.push({
          no,
          studentId,
          title,
          firstName,
          lastName,
          nickname,
          grade,
          room,
          dormId: matchedDormId,
          dormRoom,
          dormBed
        });
      }
    });

    if (parsed.length === 0) {
      alert("ไม่พบรูปแบบข้อมูลที่ถูกต้อง กรุณาตรวจสอบคอลัมน์ข้อมูล");
      return;
    }

    setPreviewStudents(parsed);
  };

  // Confirm Import parsed students
  const handleConfirmImport = async () => {
    if (previewStudents.length === 0) {
      alert("ไม่มีรายชื่อนักเรียนที่จะนำเข้า");
      return;
    }

    setIsImporting(true);
    try {
      // Group by student's assigned dormId if available, or fall back to importDormId
      const dormGroups = new Map<string, Partial<Student>[]>();
      previewStudents.forEach((s) => {
        const dId = s.dormId || importDormId;
        if (!dormGroups.has(dId)) {
          dormGroups.set(dId, []);
        }
        dormGroups.get(dId)!.push(s);
      });

      for (const [dId, stds] of dormGroups.entries()) {
        await onImportStudents(dId, stds);
      }

      const dormNames = Array.from(dormGroups.keys())
        .map((dId) => dorms.find((d) => d.id === dId)?.name || dId)
        .join(", ");

      alert(`นำเข้าข้อมูลนักเรียนจำนวน ${previewStudents.length} คน เข้าสู่ (${dormNames}) เรียบร้อยแล้ว`);
      
      // Reset modal state
      setPasteText("");
      setPreviewStudents([]);
      setExcelFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsImportModalOpen(false);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการนำเข้า: " + (err.message || err));
    } finally {
      setIsImporting(false);
    }
  };

  // Handler: Execute Clear All Students across all dorms
  const handleConfirmClearAllStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearAllPassword.trim()) {
      setClearAllPasswordError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
      return;
    }
    if (!verifyAdminOrStaffPassword(clearAllPassword)) {
      setClearAllPasswordError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      return;
    }

    setIsClearingAll(true);
    try {
      if (onClearStudents) {
        await onClearStudents("ALL");
      } else {
        await deleteSampleData({ target: "STUDENTS" });
      }
      setSelectedStudentIds([]);
      setIsClearAllModalOpen(false);
      setClearAllPassword("");
      setClearAllPasswordError("");
      alert("ล้างรายชื่อนักเรียนทุกหอพักเรียบร้อยแล้ว ท่านสามารถนำเข้ารายชื่อชุดใหม่ได้ทันที");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการล้างข้อมูล: " + (err?.message || err));
    } finally {
      setIsClearingAll(false);
    }
  };

  // Handler: Execute Clear Students in Selected Dorm
  const handleConfirmClearDormStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDormPassword.trim()) {
      setClearDormPasswordError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
      return;
    }
    if (!verifyAdminOrStaffPassword(clearDormPassword)) {
      setClearDormPasswordError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      return;
    }

    setIsClearingDorm(true);
    try {
      if (onClearStudents) {
        await onClearStudents("BY_DORM", selectedDormFilter);
      } else {
        const targetStudents = students.filter((s) => s.dormId === selectedDormFilter);
        if (onBatchDeleteStudents && targetStudents.length > 0) {
          await onBatchDeleteStudents(targetStudents.map((s) => s.id));
        }
      }
      setSelectedStudentIds([]);
      setIsClearDormModalOpen(false);
      setClearDormPassword("");
      setClearDormPasswordError("");
      const dormName = dorms.find((d) => d.id === selectedDormFilter)?.name || selectedDormFilter;
      alert(`ล้างรายชื่อนักเรียนใน${dormName} เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการล้างข้อมูล: " + (err?.message || err));
    } finally {
      setIsClearingDorm(false);
    }
  };

  // Handler: Execute Batch Transfer Students to Another Dorm
  const handleConfirmTransferStudents = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsTransferring(true);
    try {
      if (onBatchTransferDorm) {
        await onBatchTransferDorm(selectedStudentIds, targetTransferDormId, targetTransferRoom.trim() || undefined);
      } else if (onUpdateStudent) {
        for (const id of selectedStudentIds) {
          await onUpdateStudent(id, {
            dormId: targetTransferDormId,
            ...(targetTransferRoom.trim() ? { dormRoom: targetTransferRoom.trim() } : {})
          });
        }
      }
      const targetDormName = dorms.find((d) => d.id === targetTransferDormId)?.name || targetTransferDormId;
      alert(`ย้ายหอพักนักเรียนจำนวน ${selectedStudentIds.length} คน ไปยัง${targetDormName} สำเร็จเรียบร้อยแล้ว`);
      setSelectedStudentIds([]);
      setIsTransferModalOpen(false);
      setTargetTransferRoom("");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการย้ายหอพัก: " + (err?.message || err));
    } finally {
      setIsTransferring(false);
    }
  };

  // Add / Edit Single Student Handler
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.firstName || !newStudent.lastName || !newStudent.studentId) {
      alert("กรุณากรอกรหัสนักเรียน ชื่อ และนามสกุลให้ครบถ้วน");
      return;
    }

    try {
      if (editingStudent && onUpdateStudent) {
        await onUpdateStudent(editingStudent.id, newStudent);
        alert("อัปเดตข้อมูลนักเรียนสำเร็จ");
      } else {
        await onAddStudent(newStudent);
        alert("เพิ่มข้อมูลนักเรียนสำเร็จ");
      }
      setIsAddModalOpen(false);
      setEditingStudent(null);
      setNewStudent({
        dormId: dorms[0]?.id || "dorm-1",
        no: 1,
        studentId: "",
        title: "นาย",
        firstName: "",
        lastName: "",
        nickname: "",
        grade: "ม.1",
        room: 1,
        dormRoom: "101"
      });
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  // Helper to format class key uniformly (e.g. "ม.1/1", "ม.2/3")
  const formatClassKey = (grade?: string, room?: string | number): string => {
    if (!grade) return "";
    const cleanGrade = grade.trim();
    if (cleanGrade.includes("/")) {
      return cleanGrade;
    }
    if (room !== undefined && room !== null && String(room).trim() !== "") {
      return `${cleanGrade}/${String(room).trim()}`;
    }
    return cleanGrade;
  };

  // Generate all unique grade/room combinations that ACTUALLY exist in the database based on the selected scope
  const gradeRoomOptions = useMemo(() => {
    const targetDorm = selectedDormFilter === "ALL" ? null : dorms.find((d) => d.id === selectedDormFilter);
    const targetStudents =
      selectedDormFilter === "ALL"
        ? students
        : targetDorm
        ? students.filter((s) => matchStudentToDorm(s, targetDorm))
        : students.filter((s) => s.dormId === selectedDormFilter);

    const classCountMap = new Map<string, number>();

    // Extract ONLY from students that actually exist in the database
    targetStudents.forEach((s) => {
      if (s.grade && s.grade.trim()) {
        const classKey = formatClassKey(s.grade, s.room);
        if (classKey) {
          classCountMap.set(classKey, (classCountMap.get(classKey) || 0) + 1);
        }
      }
    });

    const sortedClasses = Array.from(classCountMap.keys()).sort((a, b) => {
      const partsA = a.split("/");
      const partsB = b.split("/");
      const gradeA = parseGradeNum(partsA[0]);
      const gradeB = parseGradeNum(partsB[0]);
      if (gradeA !== gradeB) return gradeA - gradeB;
      const roomA = partsA[1] ? parseRoomNum(partsA[1]) : 0;
      const roomB = partsB[1] ? parseRoomNum(partsB[1]) : 0;
      return roomA - roomB;
    });

    return sortedClasses.map((cls) => ({
      value: cls,
      label: `${cls} (${classCountMap.get(cls)} คน)`,
      count: classCountMap.get(cls) || 0
    }));
  }, [students, selectedDormFilter, dorms]);

  // Synchronize and validate selectedClassFilter when options or dorm change
  useEffect(() => {
    if (
      selectedClassFilter !== "ALL" &&
      !gradeRoomOptions.some((opt) => opt.value === selectedClassFilter)
    ) {
      setSelectedClassFilter("ALL");
    }
  }, [gradeRoomOptions, selectedClassFilter]);

  // Filter & Sort students
  const filteredStudents = useMemo(() => {
    const targetDorm = selectedDormFilter === "ALL" ? null : dorms.find((d) => d.id === selectedDormFilter);

    const result = students.filter((s) => {
      if (selectedDormFilter !== "ALL") {
        if (targetDorm) {
          if (!matchStudentToDorm(s, targetDorm)) return false;
        } else if (s.dormId !== selectedDormFilter) {
          return false;
        }
      }

      // Class / Room filter (matches formatted class key e.g. "ม.1/1" or raw grade)
      if (selectedClassFilter !== "ALL") {
        const studentClassStr = formatClassKey(s.grade, s.room);
        if (studentClassStr !== selectedClassFilter && s.grade?.trim() !== selectedClassFilter) {
          return false;
        }
      }

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const name = `${s.title || ""}${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
        const nickname = (s.nickname || "").toLowerCase();
        const dormObj = findDormForStudent(s, dorms) || dorms.find((d) => d.id === s.dormId);
        const dormName = (dormObj?.name || s.dormId || "").toLowerCase();
        const roomStr = `${s.grade}/${s.room}`.toLowerCase();
        const dormRoom = (s.dormRoom || "").toLowerCase();
        return (
          name.includes(q) ||
          nickname.includes(q) ||
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          dormName.includes(q) ||
          roomStr.includes(q) ||
          dormRoom.includes(q)
        );
      }
      return true;
    });

    // เรียงลำดับจากน้อยไปหามาก: 1) ระดับชั้น 2) ห้อง 3) เลขที่ 4) รหัสนักเรียน
    return result.sort((a, b) => {
      // 1. ระดับชั้น (Grade: ม.1 < ม.2 < ... < ม.6)
      const gradeA = parseGradeNum(a.grade);
      const gradeB = parseGradeNum(b.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;

      // 2. ห้อง (Room: 1 < 2 < 3 ... < 7)
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
  }, [students, selectedDormFilter, selectedClassFilter, searchQuery, dorms]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Attendance Checking Status Banner & Pause/Resume Controller */}
      <div
        className={`p-4 rounded-2xl border transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
          systemSettings?.isAttendancePaused
            ? "bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-rose-300"
            : "bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-emerald-300"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              systemSettings?.isAttendancePaused
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                : "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
            }`}
          >
            {systemSettings?.isAttendancePaused ? (
              <PauseCircle className="w-6 h-6 animate-pulse" />
            ) : (
              <PlayCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border tracking-wider ${
                  systemSettings?.isAttendancePaused
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {systemSettings?.isAttendancePaused
                  ? "⛔ ระบบหยุดการเช็คยอดชั่วคราว"
                  : "🟢 ระบบเปิดให้เช็คยอดตามปกติ"}
              </span>
              {systemSettings?.isAttendancePaused && systemSettings?.attendancePausedAt && (
                <span className="text-[11px] font-bold text-slate-500">
                  (หยุดเมื่อ: {systemSettings.attendancePausedAt}{systemSettings.attendancePausedBy ? ` โดย ${systemSettings.attendancePausedBy}` : ""})
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-1">
              {systemSettings?.isAttendancePaused
                ? systemSettings?.attendancePauseReason ||
                  "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
                : "ครูประจำหอพักสามารถเข้าทำการเช็คยอดนักเรียนรอบ 20.00 น. ได้ตามปกติ (หากต้องการลบหรือนำเข้ารายชื่อชุดใหม่ แนะนำให้กดหยุดการเช็คยอดก่อน)"}
            </p>
          </div>
        </div>

        {canManagePause && (
          <div className="flex items-center gap-2 shrink-0">
            {systemSettings?.isAttendancePaused ? (
              <button
                type="button"
                onClick={() => handleToggleAttendancePause(false)}
                disabled={isSavingPause}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="เปิดระบบให้ครูหอพักเช็คยอดนักเรียนได้ตามปกติ"
              >
                <PlayCircle className="w-4 h-4" />
                <span>{isSavingPause ? "กำลังเปิดระบบ..." : "เปิดระบบเช็คยอดตามปกติ"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPauseReasonInput(
                    systemSettings?.attendancePauseReason ||
                      "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
                  );
                  setIsPauseModalOpen(true);
                }}
                disabled={isSavingPause}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                title="หยุดการเช็คยอดนักเรียนชั่วคราวเพื่อดำเนินการลบ/นำเข้ารายชื่อชุดใหม่"
              >
                <PauseCircle className="w-4 h-4" />
                <span>หยุดการเช็คยอดชั่วคราว</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Header & Controls Panel */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
        {/* Title Row */}
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#A05AFF]" />
            <span>จัดการรายชื่อนักเรียนหอพัก</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            นำเข้าและจัดเก็บรหัสนักเรียน คำนำหน้า ชื่อ นามสกุล ระดับชั้น/ห้อง แยกรายหอพัก (หอ 1 - 6)
          </p>
        </div>

        {/* Action Controls Container */}
        <div className="space-y-3.5 pt-1 border-t border-gray-100">
          {/* Row 1: Action buttons ("ส่งออก Excel", "นำเข้านักเรียนจำนวนมาก", "เพิ่มนักเรียนใหม่", "ล้างรายชื่อทั้งหมด") */}
          <div className="flex flex-wrap items-center gap-2.5 pb-3 border-b border-gray-100">
            <button
              onClick={handleExportCurrentStudentsToExcel}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-300/80 shadow-2xs"
              title="ส่งออกรายชื่อนักเรียนเป็นไฟล์ Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              onClick={() => {
                setPreviewStudents([]);
                setExcelFileName(null);
                setPasteText("");
                setIsImportModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>นำเข้านักเรียนจำนวนมาก</span>
            </button>

            <button
              onClick={() => {
                setEditingStudent(null);
                setNewStudent({
                  dormId: dorms[0]?.id || "dorm-1",
                  no: (students.length || 0) + 1,
                  studentId: "",
                  title: "นาย",
                  firstName: "",
                  lastName: "",
                  grade: "ม.1",
                  room: 1,
                  dormRoom: "101"
                });
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มนักเรียนใหม่</span>
            </button>

            {/* Clear All Students Button */}
            {canManagePause && (
              <button
                type="button"
                onClick={() => {
                  setClearAllPassword("");
                  setClearAllPasswordError("");
                  setIsClearAllModalOpen(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                title="ล้างรายชื่อนักเรียนทุกหอพัก เพื่อเตรียมนำเข้ารายชื่อชุดใหม่"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>ล้างรายชื่อทั้งหมด ({students.length} คน)</span>
              </button>
            )}

            {/* Clear Dorm Students Button (When filtered) */}
            {canManagePause && selectedDormFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => {
                  setClearDormPassword("");
                  setClearDormPasswordError("");
                  setIsClearDormModalOpen(true);
                }}
                className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                title={`ล้างรายชื่อนักเรียนเฉพาะ${dorms.find((d) => d.id === selectedDormFilter)?.name || selectedDormFilter}`}
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>ล้างรายชื่อในหอพักนี้ ({filteredStudents.length} คน)</span>
              </button>
            )}

            <button
              onClick={async () => {
                if (window.confirm("ยืนยันการลบข้อมูลตัวอย่างนักเรียนทั้งหมดออกจากระบบหรือไม่?\n(การกระทำนี้จะล้างรายชื่อนักเรียน เพื่อให้ท่านนำเข้าข้อมูลจริงได้อย่างสะอาดเรียบร้อย)")) {
                  try {
                    const res = await deleteSampleData({ target: "STUDENTS" });
                    alert(res.message || "ลบข้อมูลตัวอย่างนักเรียนเรียบร้อยแล้ว");
                    window.location.reload();
                  } catch (e: any) {
                    alert("เกิดข้อผิดพลาด: " + (e?.message || e));
                  }
                }
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium text-xs rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="ล้างข้อมูลตัวอย่างที่แถมมากับระบบ"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>ล้างข้อมูลตัวอย่าง</span>
            </button>
          </div>

          {/* Row 2: Filters & Search */}
          <div className="flex flex-wrap items-center gap-3.5 pb-3 border-b border-gray-100">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">เลือกหอพัก</label>
              <select
                value={selectedDormFilter}
                onChange={(e) => {
                  setSelectedDormFilter(e.target.value);
                  setSelectedClassFilter("ALL");
                }}
                className="bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-pink-500"
              >
                <option value="ALL">ทุกหอพัก (รวม {students.length} คน)</option>
                {dorms.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({countStudentsInDorm(students, d)} คน)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">ระดับชั้น / ห้อง</label>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-pink-500 min-w-[190px]"
              >
                <option value="ALL">
                  {selectedDormFilter === "ALL"
                    ? `ทุกระดับชั้น/ห้อง (${gradeRoomOptions.length} ห้องในระบบ)`
                    : `ทุกระดับชั้น/ห้อง (${gradeRoomOptions.length} ห้องในหอนี้)`}
                </option>
                {gradeRoomOptions.length > 0 ? (
                  gradeRoomOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                ) : (
                  <option disabled>ไม่มีข้อมูลห้องในฐานข้อมูล</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">ค้นหา</label>
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ชื่อ, รหัสนักเรียน..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 3 (บรรทัดใหม่): "จำนวนทั้งหมด:" ชิดซ้าย และ "ลบรายชื่อนักเรียนที่เลือก" ชิดขวา */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
            <div className="flex items-center">
              <span className="text-xs font-extrabold px-3.5 py-2 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl inline-block shadow-2xs">
                จำนวนทั้งหมด: {filteredStudents.length} คน
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {/* Batch Transfer Dormitory Button */}
              {selectedStudentIds.length > 0 && canManagePause && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetTransferDormId(dorms[0]?.id || "dorm-1");
                    setTargetTransferRoom("");
                    setIsTransferModalOpen(true);
                  }}
                  className="px-4 py-2 font-bold text-xs rounded-xl shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="ย้ายหอพักนักเรียนที่เลือกไปยังหอพักอื่น"
                >
                  <ArrowRightLeft className="w-4 h-4 text-white" />
                  <span>ย้ายหอพักนักเรียนที่เลือก ({selectedStudentIds.length} คน)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (selectedStudentIds.length === 0) {
                    alert("กรุณาทำเครื่องหมายเลือกรายชื่อนักเรียนในตารางที่ต้องการลบก่อน");
                    return;
                  }
                  const selected = students.filter((s) => selectedStudentIds.includes(s.id));
                  setStudentsToDelete(selected);
                  setDeletePassword("");
                  setDeletePasswordError("");
                  setIsDeleteModalOpen(true);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedStudentIds.length > 0
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 shadow-md"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300/80"
                }`}
                title={selectedStudentIds.length === 0 ? "เลือกนักเรียนในตารางก่อนเพื่อลบ" : "ลบรายชื่อนักเรียนที่เลือก"}
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>
                  {selectedStudentIds.length > 0
                    ? `ลบรายชื่อนักเรียนที่เลือก (${selectedStudentIds.length} คน)`
                    : "ลบรายชื่อนักเรียนที่เลือก"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-100/80 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredStudents.length > 0 &&
                      filteredStudents.every((s) => selectedStudentIds.includes(s.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allFilteredIds = filteredStudents.map((s) => s.id);
                        setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...allFilteredIds])));
                      } else {
                        const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
                        setSelectedStudentIds(selectedStudentIds.filter((id) => !filteredIdSet.has(id)));
                      }
                    }}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                    title="เลือกทั้งหมด"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                <th className="py-3 px-4">รหัสนักเรียน</th>
                <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                <th className="py-3 px-3">ชื่อเล่น</th>
                <th className="py-3 px-4">ระดับชั้น/ห้อง</th>
                <th className="py-3 px-4">หอพัก</th>
                <th className="py-3 px-4">ห้องหอ</th>
                <th className="py-3 px-3 text-center">เตียง</th>
                <th className="py-3 px-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>ไม่พบรายชื่อนักเรียนในเงื่อนไขการค้นหานี้</span>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const dormObj = dorms.find((d) => d.id === s.dormId);
                  const isSelected = selectedStudentIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-purple-50/50 transition-colors ${
                        isSelected ? "bg-purple-50/80" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds([...selectedStudentIds, s.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter((id) => id !== s.id));
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-800">{s.no}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-700">{s.studentId}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {s.title}{s.firstName} {s.lastName}
                      </td>
                      <td className="py-3 px-3">
                        {s.nickname ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            {s.nickname}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-700">
                        {s.grade}/{s.room}
                      </td>
                      <td className="py-3 px-4 font-medium text-pink-600">
                        {dormObj?.name || s.dormId}
                      </td>
                      <td className="py-3 px-4 text-gray-600">ห้อง {s.dormRoom}</td>
                      <td className="py-3 px-3 text-center font-bold text-purple-800">
                        {s.dormBed ? `เตียง ${s.dormBed}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingStudent(s);
                              setNewStudent(s);
                              setIsAddModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
                            title="แก้ไขข้อมูลนักเรียน"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {(currentUser?.roleLevel === 1 || currentUser?.roleLevel === 2) && (
                            <button
                              onClick={() => {
                                setStudentsToDelete([s]);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="ลบรายชื่อ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Import Excel (.xlsx / .csv) & Batch Paste */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <span>นำเข้าข้อมูลนักเรียน (Excel / *.xlsx)</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dorm Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                เลือกหอพักปลายทางที่ต้องการนำเข้าข้อมูล
              </label>
              <select
                value={importDormId}
                onChange={(e) => setImportDormId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {dorms.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setImportMode("EXCEL");
                  setPreviewStudents([]);
                }}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  importMode === "EXCEL"
                    ? "bg-white text-emerald-700 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>อัปโหลดไฟล์ Excel (*.xlsx, *.xls)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportMode("PASTE");
                  setPreviewStudents([]);
                }}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  importMode === "PASTE"
                    ? "bg-white text-purple-700 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span>วางข้อความจากตาราง (Copy-Paste)</span>
              </button>
            </div>

            {/* EXCEL MODE */}
            {importMode === "EXCEL" && (
              <div className="space-y-4">
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>ดาวน์โหลดไฟล์แบบฟอร์มตัวอย่าง (Excel Template)</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        ใช้โครงสร้างคอลัมน์: เลขที่ | รหัสนักเรียน | คำนำหน้า | ชื่อ | นามสกุล | ชั้น | ห้อง | ห้องพักหอ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      ดาวน์โหลดแบบฟอร์ม .xlsx
                    </button>
                  </div>
                </div>

                {/* File Upload Box */}
                <div className="border-2 border-dashed border-emerald-300 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="excel-file-upload"
                  />
                  <label
                    htmlFor="excel-file-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {excelFileName ? `ไฟล์ที่เลือก: ${excelFileName}` : "คลิกที่นี่เพื่อเลือกไฟล์ Excel (*.xlsx, *.xls, *.csv)"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      รองรับไฟล์ตาราง Microsoft Excel ทุกเวอร์ชัน
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* PASTE MODE */}
            {importMode === "PASTE" && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  คัดลอกตารางจาก Excel แล้ววางลงในช่องนี้:
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`1\t66001\tนาย\tกิตติพงษ์\tสุขเจริญ\tม.1\t1\t101\n2\t66002\tนาย\tชินวัตร\tงามศิลป์\tม.1\t1\t102`}
                  className="w-full bg-gray-50 border border-gray-300 font-mono text-xs text-gray-800 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={handleParsePasteText}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  ประมวลผลข้อความ
                </button>
              </div>
            )}

            {/* PREVIEW TABLE */}
            {previewStudents.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ตัวอย่างข้อมูลที่ถอดรหัสได้ ({previewStudents.length} คน)</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    โปรดตรวจสอบก่อนกด ยืนยันการนำเข้า
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50">
                  <table className="w-full text-left text-[11px] text-slate-700">
                    <thead className="bg-slate-200 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">รหัสนักเรียน</th>
                        <th className="p-2">ชื่อ - นามสกุล</th>
                        <th className="p-2">ชื่อเล่น</th>
                        <th className="p-2">ระดับชั้น</th>
                        <th className="p-2">หอพัก</th>
                        <th className="p-2">ห้องหอ</th>
                        <th className="p-2 text-center">เตียง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewStudents.slice(0, 30).map((st, idx) => {
                        const targetDorm = dorms.find((d) => d.id === st.dormId) || dorms.find((d) => d.id === importDormId);
                        return (
                          <tr key={idx} className="hover:bg-white">
                            <td className="p-2 text-center font-bold text-slate-500">{st.no || idx + 1}</td>
                            <td className="p-2 font-mono font-bold">{st.studentId}</td>
                            <td className="p-2 font-bold">{st.title}{st.firstName} {st.lastName}</td>
                            <td className="p-2 font-bold text-purple-700">{st.nickname || "-"}</td>
                            <td className="p-2">{st.grade}/{st.room}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                                {targetDorm?.name || st.dormId || "หอพัก"}
                              </span>
                            </td>
                            <td className="p-2">ห้อง {st.dormRoom}</td>
                            <td className="p-2 text-center font-bold text-purple-800">{st.dormBed ? `เตียง ${st.dormBed}` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {previewStudents.length > 30 && (
                    <div className="p-2 text-center text-[10px] text-slate-500 font-bold bg-slate-100">
                      และอีก {previewStudents.length - 30} รายการ...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isImporting || previewStudents.length === 0}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  previewStudents.length > 0
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isImporting ? "กำลังบันทึกนำเข้า..." : `ยืนยันนำเข้า (${previewStudents.length} รายการ)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Single Student */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-pink-600" />
              <span>{editingStudent ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มนักเรียนใหม่"}</span>
            </h3>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">เลือกหอพัก</label>
                <select
                  value={newStudent.dormId}
                  onChange={(e) => setNewStudent({ ...newStudent, dormId: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl p-2.5 outline-none"
                >
                  {dorms.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">เลขที่</label>
                  <input
                    type="number"
                    value={newStudent.no || 1}
                    onChange={(e) => setNewStudent({ ...newStudent, no: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">รหัสนักเรียน</label>
                  <input
                    type="text"
                    value={newStudent.studentId || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    placeholder="66xxx"
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">คำนำหน้า</label>
                  <select
                    value={newStudent.title}
                    onChange={(e) => setNewStudent({ ...newStudent, title: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อ</label>
                  <input
                    type="text"
                    value={newStudent.firstName || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">นามสกุล</label>
                  <input
                    type="text"
                    value={newStudent.lastName || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ชื่อเล่น <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                  </label>
                  <input
                    type="text"
                    value={newStudent.nickname || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, nickname: e.target.value })}
                    placeholder="เช่น บาส, กิต"
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ห้องในหอพัก</label>
                  <input
                    type="text"
                    value={newStudent.dormRoom || "101"}
                    onChange={(e) => setNewStudent({ ...newStudent, dormRoom: e.target.value })}
                    placeholder="เช่น 101"
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">เตียง</label>
                  <input
                    type="text"
                    value={newStudent.dormBed || ""}
                    onChange={(e) => setNewStudent({ ...newStudent, dormBed: e.target.value })}
                    placeholder="เช่น 1, 2, 3"
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ระดับชั้น</label>
                  <select
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  >
                    <option value="ม.1">ม.1</option>
                    <option value="ม.2">ม.2</option>
                    <option value="ม.3">ม.3</option>
                    <option value="ม.4">ม.4</option>
                    <option value="ม.5">ม.5</option>
                    <option value="ม.6">ม.6</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ห้องเรียน</label>
                  <input
                    type="number"
                    value={newStudent.room || 1}
                    onChange={(e) => setNewStudent({ ...newStudent, room: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmation Dialog for Deleting Student(s) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-5">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ยืนยันการลบข้อมูลนักเรียน</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  โปรดตรวจสอบข้อมูลก่อนยืนยัน การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
              <p className="font-bold">
                {studentsToDelete.length === 1
                  ? `ต้องการลบรายชื่อ: ${studentsToDelete[0].title}${studentsToDelete[0].firstName} ${studentsToDelete[0].lastName} (รหัส: ${studentsToDelete[0].studentId})`
                  : `ต้องการลบรายชื่อนักเรียนที่เลือกทั้งหมดจำนวน ${studentsToDelete.length} คน`}
              </p>
              {studentsToDelete.length > 1 && (
                <div className="max-h-32 overflow-y-auto bg-white/80 p-2.5 rounded-xl border border-rose-200 text-[11px] space-y-1">
                  {studentsToDelete.slice(0, 10).map((st) => (
                    <div key={st.id} className="flex justify-between font-medium">
                      <span>
                        • {st.title}{st.firstName} {st.lastName}
                      </span>
                      <span className="text-rose-500">
                        ({st.grade}/{st.room})
                      </span>
                    </div>
                  ))}
                  {studentsToDelete.length > 10 && (
                    <div className="text-slate-500 font-bold text-center pt-1">
                      ...และอีก {studentsToDelete.length - 10} คน
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Password verification input */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!deletePassword.trim()) {
                  setDeletePasswordError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
                  return;
                }

                const validPasswords = ["123456"];
                if (currentUser?.password) {
                  validPasswords.push(currentUser.password);
                }

                const isPasswordValid =
                  validPasswords.includes(deletePassword.trim()) ||
                  deletePassword.trim() === "123456";

                if (!isPasswordValid) {
                  setDeletePasswordError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
                  return;
                }

                if (studentsToDelete.length === 0) return;
                setIsDeleting(true);
                try {
                  if (studentsToDelete.length === 1) {
                    await onDeleteStudent(studentsToDelete[0].id);
                  } else if (onBatchDeleteStudents) {
                    await onBatchDeleteStudents(studentsToDelete.map((s) => s.id));
                  } else {
                    for (const st of studentsToDelete) {
                      await onDeleteStudent(st.id);
                    }
                  }
                  const deletedIdSet = new Set(studentsToDelete.map((s) => s.id));
                  setSelectedStudentIds((prev) => prev.filter((id) => !deletedIdSet.has(id)));
                  setIsDeleteModalOpen(false);
                  setStudentsToDelete([]);
                  setDeletePassword("");
                  setDeletePasswordError("");
                } catch (err: any) {
                  alert("เกิดข้อผิดพลาดในการลบข้อมูล: " + (err.message || err));
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="space-y-4"
            >
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>ยืนยันรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeletePasswordError("");
                  }}
                  placeholder="กรอกรหัสผ่านเพื่อยืนยันการลบ (เช่น 123456)..."
                  className="w-full bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 outline-none shadow-2xs"
                  autoFocus
                />
                {deletePasswordError && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{deletePasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setStudentsToDelete([]);
                    setDeletePassword("");
                    setDeletePasswordError("");
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || !deletePassword.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? "กำลังลบข้อมูล..." : "ยืนยันการลบ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Attendance Pause Configuration Modal */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <PauseCircle className="w-6 h-6 text-rose-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">หยุดการเช็คยอดนักเรียนชั่วคราว</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เพื่อทำการลบหรือนำเข้ารายชื่อนักเรียนชุดใหม่
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ผลของการหยุดการเช็คยอด:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                <li>ครูประจำหอพักจะไม่สามารถบันทึกยอดการเช็คชื่อได้ในระหว่างนี้ เพื่อป้องกันข้อมูลคลาดเคลื่อน</li>
                <li>ระบบจะแสดงแถบแจ้งเตือนในหน้าเช็คยอดและหน้าภาพรวม (Dashboard)</li>
                <li>เมื่อดำเนินการลบหรือนำเข้ารายชื่อเสร็จสิ้น ท่านสามารถกด <strong>"เปิดระบบเช็คยอดตามปกติ"</strong> ได้ทันที</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                ข้อความแจ้งเตือน / เหตุผลในการหยุดเช็คยอด:
              </label>
              <textarea
                rows={3}
                value={pauseReasonInput}
                onChange={(e) => setPauseReasonInput(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่..."
                className="w-full bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-xl p-3 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingPause}
                onClick={() => handleToggleAttendancePause(true)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <PauseCircle className="w-4 h-4" />
                <span>{isSavingPause ? "กำลังบันทึก..." : "ยืนยันหยุดการเช็คยอด"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Clear ALL Students across all dorms */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ล้างรายชื่อนักเรียนทั้งหมด</h3>
                <p className="text-xs text-rose-600 font-bold mt-0.5">
                  คำเตือน: รายชื่อนักเรียนทุกหอพักรวม {students.length} คน จะถูกลบ
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-3">
              <p className="font-semibold leading-relaxed">
                การกระทำนี้จะล้างข้อมูลนักเรียนออกจากฐานข้อมูลทุกหอพัก เพื่อให้ท่านสามารถนำเข้ารายชื่อนักเรียนชุดใหม่ได้อย่างสะอาดเรียบร้อย
              </p>

              {/* Quick backup button before clearing */}
              <div className="pt-1 border-t border-rose-200/60">
                <button
                  type="button"
                  onClick={handleExportCurrentStudentsToExcel}
                  className="w-full py-2 px-3 bg-white hover:bg-rose-100/50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-300 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (Excel) ก่อนล้างข้อมูล</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmClearAllStudents} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>ยืนยันรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="password"
                  value={clearAllPassword}
                  onChange={(e) => {
                    setClearAllPassword(e.target.value);
                    setClearAllPasswordError("");
                  }}
                  placeholder="กรอกรหัสผ่านเพื่อยืนยัน (เช่น 123456)..."
                  className="w-full bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 outline-none shadow-2xs"
                  autoFocus
                />
                {clearAllPasswordError && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{clearAllPasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={() => {
                    setIsClearAllModalOpen(false);
                    setClearAllPassword("");
                    setClearAllPasswordError("");
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isClearingAll || !clearAllPassword.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearingAll ? "กำลังล้างข้อมูล..." : `ยืนยันล้างทั้งหมด (${students.length} คน)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Clear Students in Selected Dorm */}
      {isClearDormModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-orange-200 space-y-4">
            <div className="flex items-center gap-3 text-orange-600 border-b border-orange-100 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  ล้างรายชื่อเฉพาะ{dorms.find((d) => d.id === selectedDormFilter)?.name || selectedDormFilter}
                </h3>
                <p className="text-xs text-orange-600 font-bold mt-0.5">
                  นักเรียนในหอพักนี้จำนวน {filteredStudents.length} คน จะถูกลบ
                </p>
              </div>
            </div>

            <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 text-xs text-orange-900 space-y-3">
              <p className="font-semibold leading-relaxed">
                การกระทำนี้จะลบเฉพาะนักเรียนใน{dorms.find((d) => d.id === selectedDormFilter)?.name} โดยไม่กระทบหอพักอื่น เพื่อให้ท่านนำเข้ารายชื่อนักเรียนใหม่ของหอพักนี้
              </p>

              {/* Quick backup button before clearing */}
              <div className="pt-1 border-t border-orange-200/60">
                <button
                  type="button"
                  onClick={handleExportCurrentStudentsToExcel}
                  className="w-full py-2 px-3 bg-white hover:bg-orange-100/50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-300 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (Excel) ก่อนลบ</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmClearDormStudents} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>ยืนยันรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="password"
                  value={clearDormPassword}
                  onChange={(e) => {
                    setClearDormPassword(e.target.value);
                    setClearDormPasswordError("");
                  }}
                  placeholder="กรอกรหัสผ่านเพื่อยืนยัน (เช่น 123456)..."
                  className="w-full bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none shadow-2xs"
                  autoFocus
                />
                {clearDormPasswordError && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{clearDormPasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={isClearingDorm}
                  onClick={() => {
                    setIsClearDormModalOpen(false);
                    setClearDormPassword("");
                    setClearDormPasswordError("");
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isClearingDorm || !clearDormPassword.trim()}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearingDorm ? "กำลังลบ..." : `ยืนยันลบ (${filteredStudents.length} คน)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Batch Transfer Students to Another Dormitory */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-4">
            <div className="flex items-center gap-3 text-indigo-600 border-b border-indigo-100 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ย้ายหอพักนักเรียนที่เลือก</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกหอพักปลายทางที่ต้องการย้ายนักเรียนจำนวน {selectedStudentIds.length} คน
                </p>
              </div>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 space-y-2">
              <p className="font-bold">
                นักเรียนที่เลือกจะถูกเปลี่ยนสังกัดหอพักทันที:
              </p>
              <div className="max-h-28 overflow-y-auto bg-white/80 p-2.5 rounded-xl border border-indigo-200 text-[11px] space-y-1">
                {students
                  .filter((s) => selectedStudentIds.includes(s.id))
                  .slice(0, 10)
                  .map((st) => (
                    <div key={st.id} className="flex justify-between font-medium">
                      <span>• {st.title}{st.firstName} {st.lastName}</span>
                      <span className="text-indigo-600 font-bold">{st.grade}/{st.room}</span>
                    </div>
                  ))}
                {selectedStudentIds.length > 10 && (
                  <div className="text-slate-500 font-bold text-center pt-1">
                    ...และอีก {selectedStudentIds.length - 10} คน
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>เลือกหอพักปลายทาง <span className="text-rose-500">*</span></span>
                </label>
                <select
                  value={targetTransferDormId}
                  onChange={(e) => setTargetTransferDormId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {dorms.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({countStudentsInDorm(students, d)} คน)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  ห้องพักหอใหม่ (ไม่บังคับระบุ):
                </label>
                <input
                  type="text"
                  value={targetTransferRoom}
                  onChange={(e) => setTargetTransferRoom(e.target.value)}
                  placeholder="เช่น 101, 202 (หากไม่ระบุจะคงห้องเดิมไว้)..."
                  className="w-full bg-slate-50 border border-slate-300 text-xs text-slate-800 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isTransferring}
                onClick={handleConfirmTransferStudents}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{isTransferring ? "กำลังย้ายหอพัก..." : `ยืนยันย้าย (${selectedStudentIds.length} คน)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

