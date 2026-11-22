import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile, UserRole, Dormitory, Student, Notice, DailyAttendance, SystemSettings, DormPosition, RoleNavigationPermissions, ProfileAvatarItem } from "../../types";
import { NavigationPermissionsTab } from "./NavigationPermissionsTab";
import { DEFAULT_SYSTEM_SETTINGS, formatThaiFullDate, getDirectImageUrl, getTodayDateString, formatThaiMonthString, formatThaiDateRange } from "../../utils/dateUtils";
import { compressImageFile, compressDataUrlIfNeeded } from "../../utils/imageUtils";
import {
  getUserAvatarUrl,
  getDefaultAvatarByGender,
  inferUserGender,
  hasCustomAvatar,
  getGenderLabel
} from "../../utils/avatarUtils";
import { isValidPasswordStrength, sanitizeSafeImageUrl } from "../../utils/security";
import { ThaiDatePicker } from "../common/ThaiDatePicker";
import {
  auth,
  signInWithGoogleAndRefresh,
  getCurrentHostname,
  FIREBASE_PROJECT_ID,
  FIREBASE_DATABASE_ID
} from "../../lib/firebase";
import {
  fetchUsers,
  addUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  fetchProfileAvatars,
  saveProfileAvatarToLibrary,
  deleteProfileAvatarsFromLibrary,
  clearDatabase,
  clearAttendanceDatabase,
  clearStudentsDatabase,
  exportDatabase,
  restoreDatabase,
  exportAttendanceAndNoticesDatabase,
  restoreAttendanceAndNoticesDatabase,
  syncLiveFirebaseDatabase,
  deleteSampleData,
  verifyAuthorizedAdminOrStaffPassword,
  getDisplayedDatabaseSnapshot,
  uploadCurrentDisplayedDatabaseToCloud,
  invalidateFirestoreReadCache,
  DeleteSampleDataOptions
} from "../../services/api";
import {
  Key,
  User,
  Shield,
  ShieldCheck,
  Trash2,
  Edit,
  Plus,
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Lock,
  UserCheck,
  RefreshCw,
  Image as ImageIcon,
  Settings,
  Building2,
  School,
  Home,
  GraduationCap,
  Award,
  Crown,
  Star,
  Save,
  Calendar,
  ChevronDown,
  Server,
  Globe,
  Copy,
  ExternalLink,
  Layers,
  Check,
  Github,
  GitBranch,
  Code2,
  CloudUpload,
  Cloud,
  Loader2,
  X,
  CalendarDays,
  Phone,
  CalendarRange,
  Clock,
  FileText,
  CheckCircle2,
  Filter,
  RotateCcw,
  FileJson,
  ShieldAlert,
  ListFilter,
  Megaphone,
  Bell,
  Eye,
  Wrench,
  PauseCircle,
  PlayCircle
} from "lucide-react";

interface UserAndDatabaseViewProps {
  currentUser: UserProfile | null;
  dorms: Dormitory[];
  students?: Student[];
  notices?: Notice[];
  attendanceRecords?: DailyAttendance[];
  usersList?: UserProfile[];
  systemSettings?: SystemSettings;
  onUpdateSystemSettings?: (settings: SystemSettings) => void;
  onDataReset?: () => void;
  onUserUpdated?: (updatedUser: UserProfile) => void;
}

export const UserAndDatabaseView: React.FC<UserAndDatabaseViewProps> = ({
  currentUser,
  dorms,
  students = [],
  notices = [],
  attendanceRecords = [],
  usersList = [],
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onUpdateSystemSettings,
  onDataReset,
  onUserUpdated
}) => {
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.roleLevel === 1;
  const isStaff = currentUser?.roleLevel === 2;
  const canAccessSettings = isAdmin || isStaff;

  const [activeTab, setActiveTab] = useState<"SYSTEM_SETTINGS" | "MANAGE_USERS" | "PERMISSIONS" | "CHANGE_PASSWORD" | "CHANGE_PROFILE" | "DATABASE">(
    canAccessSettings ? "SYSTEM_SETTINGS" : "CHANGE_PASSWORD"
  );

  useEffect(() => {
    if (!canAccessSettings && (activeTab === "SYSTEM_SETTINGS" || activeTab === "MANAGE_USERS" || activeTab === "PERMISSIONS" || activeTab === "DATABASE")) {
      setActiveTab("CHANGE_PASSWORD");
    }
    if (!isAdmin && activeTab === "PERMISSIONS") {
      setActiveTab("SYSTEM_SETTINGS");
    }
  }, [canAccessSettings, isAdmin, activeTab]);

  // System Settings Form State
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(systemSettings);

  // Clear Attendance State & Handlers
  const [clearDate, setClearDate] = useState<string>(getTodayDateString());
  const [clearDormIdForDate, setClearDormIdForDate] = useState<string>("ALL");
  const [clearDormIdForAll, setClearDormIdForAll] = useState<string>("ALL");
  const [isClearingAttendance, setIsClearingAttendance] = useState<boolean>(false);

  // ATTENDANCE & NOTICES DATABASE MANAGEMENT SUITE (1. สำรอง 2. กู้คืน 3. ล้างประวัติ)
  const [attendanceDbSubTab, setAttendanceDbSubTab] = useState<"BACKUP" | "RESTORE" | "CLEAR">("BACKUP");

  // 1. สำรองข้อมูลการเช็คยอด + เรื่องอบรม
  const [attBackupMode, setAttBackupMode] = useState<"DATE" | "MONTH" | "RANGE" | "ALL">("ALL");
  const [attBackupDate, setAttBackupDate] = useState<string>(getTodayDateString());
  const [attBackupMonth, setAttBackupMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attBackupStartDate, setAttBackupStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attBackupEndDate, setAttBackupEndDate] = useState<string>(getTodayDateString());
  const [attBackupDormId, setAttBackupDormId] = useState<string>("ALL");
  const [attBackupIncludeNotices, setAttBackupIncludeNotices] = useState<boolean>(true);
  const [isExportingAttendance, setIsExportingAttendance] = useState<boolean>(false);

  // 2. กู้คืนข้อมูลการเช็คยอด + เรื่องอบรม
  const [attRestoreFile, setAttRestoreFile] = useState<File | null>(null);
  const [attRestoreParsedData, setAttRestoreParsedData] = useState<any | null>(null);
  const [attRestoreAnalysis, setAttRestoreAnalysis] = useState<{
    totalAttendance: number;
    totalNotices: number;
    dates: string[];
    minDate: string;
    maxDate: string;
    dorms: string[];
    exportedAt?: string;
    backupType?: string;
  } | null>(null);
  const [attRestoreMode, setAttRestoreMode] = useState<"ALL" | "DATE" | "MONTH" | "RANGE">("ALL");
  const [attRestoreDate, setAttRestoreDate] = useState<string>(getTodayDateString());
  const [attRestoreMonth, setAttRestoreMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attRestoreStartDate, setAttRestoreStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attRestoreEndDate, setAttRestoreEndDate] = useState<string>(getTodayDateString());
  const [attRestoreDormId, setAttRestoreDormId] = useState<string>("ALL");
  const [attRestoreStrategy, setAttRestoreStrategy] = useState<"UPSERT" | "REPLACE">("UPSERT");
  const [isRestoringAttendance, setIsRestoringAttendance] = useState<boolean>(false);

  // 3. ล้างประวัติการเช็คยอด + เรื่องอบรม (เลือกตามวันที่, เดือน, ช่วงเวลา, ทั้งหมด)
  const [attClearMode, setAttClearMode] = useState<"BY_DATE" | "BY_MONTH" | "BY_RANGE" | "ALL">("BY_DATE");
  const [attClearDate, setAttClearDate] = useState<string>(getTodayDateString());
  const [attClearMonth, setAttClearMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attClearStartDate, setAttClearStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attClearEndDate, setAttClearEndDate] = useState<string>(getTodayDateString());
  const [attClearDormId, setAttClearDormId] = useState<string>("ALL");
  const [attClearIncludeNotices, setAttClearIncludeNotices] = useState<boolean>(true);

  const handleClearAttendanceByDate = () => {
    if (!clearDate) {
      showNotification("error", "กรุณาระบุวันที่ที่ต้องการล้างข้อมูล");
      return;
    }
    triggerDbActionWithAuth("CLEAR_ATTENDANCE_DATE");
  };

  const handleClearAttendanceAll = () => {
    triggerDbActionWithAuth("CLEAR_ATTENDANCE_ALL");
  };

  const handleAttendanceRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const rawAttendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
        const rawNotices = Array.isArray(parsed.notices) ? parsed.notices : [];

        if (rawAttendance.length === 0 && rawNotices.length === 0) {
          showNotification("error", "ไฟล์นี้ไม่มีข้อมูลการเช็คยอด หรือเรื่องแจ้งอบรม");
          setAttRestoreParsedData(null);
          setAttRestoreAnalysis(null);
          return;
        }

        const dateSet = new Set<string>();
        const dormSet = new Set<string>();
        rawAttendance.forEach((item: any) => {
          if (item.date) dateSet.add(item.date);
          if (item.dormId) dormSet.add(item.dormId);
        });
        rawNotices.forEach((item: any) => {
          if (item.date) dateSet.add(item.date);
        });

        const sortedDates = Array.from(dateSet).sort();
        const minDate = sortedDates[0] || "";
        const maxDate = sortedDates[sortedDates.length - 1] || "";

        setAttRestoreParsedData(parsed);
        setAttRestoreAnalysis({
          totalAttendance: rawAttendance.length,
          totalNotices: rawNotices.length,
          dates: sortedDates,
          minDate,
          maxDate,
          dorms: Array.from(dormSet),
          exportedAt: parsed.exportedAt,
          backupType: parsed.backupType || "FULL_OR_CUSTOM"
        });

        if (sortedDates.length > 0) {
          setAttRestoreDate(sortedDates[sortedDates.length - 1]);
          setAttRestoreMonth(sortedDates[sortedDates.length - 1].slice(0, 7));
          setAttRestoreStartDate(sortedDates[0]);
          setAttRestoreEndDate(sortedDates[sortedDates.length - 1]);
        }

        showNotification(
          "success",
          `อ่านไฟล์สำเร็จ: พบประวัติเช็คยอด ${rawAttendance.length} รายการ, เรื่องแจ้งอบรม ${rawNotices.length} รายการ`
        );
      } catch (err: any) {
        showNotification("error", "ไฟล์ไม่ถูกต้องตามรูปแบบ JSON หรือข้อมูลเสียหาย");
        setAttRestoreParsedData(null);
        setAttRestoreAnalysis(null);
      }
    };
    reader.readAsText(file);
  };

  const executeExportAttendance = async () => {
    setIsExportingAttendance(true);
    try {
      const data = await exportAttendanceAndNoticesDatabase({
        mode: attBackupMode,
        date: attBackupDate,
        month: attBackupMonth,
        startDate: attBackupStartDate,
        endDate: attBackupEndDate,
        dormId: attBackupDormId,
        includeNotices: attBackupIncludeNotices
      });

      const dateSuffix =
        attBackupMode === "DATE"
          ? attBackupDate
          : attBackupMode === "MONTH"
          ? attBackupMonth
          : attBackupMode === "RANGE"
          ? `${attBackupStartDate}_to_${attBackupEndDate}`
          : "ALL";
      const dormSuffix = attBackupDormId === "ALL" ? "AllDorms" : `Dorm_${attBackupDormId}`;
      const fileName = `attendance_backup_${dateSuffix}_${dormSuffix}_${new Date().getTime()}.json`;

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification(
        "success",
        `สำรองข้อมูลสำเร็จ: เช็คยอด ${data.totalAttendance} รายการ, เรื่องแจ้งอบรม ${data.totalNotices} รายการ`
      );
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการสำรองข้อมูล");
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const executeRestoreAttendance = async () => {
    if (!attRestoreParsedData) {
      showNotification("error", "กรุณาเลือกไฟล์สำรองข้อมูลก่อน");
      return;
    }

    setIsRestoringAttendance(true);
    try {
      const res = await restoreAttendanceAndNoticesDatabase({
        data: attRestoreParsedData,
        mode: attRestoreMode,
        date: attRestoreDate,
        month: attRestoreMonth,
        startDate: attRestoreStartDate,
        endDate: attRestoreEndDate,
        dormId: attRestoreDormId,
        restoreStrategy: attRestoreStrategy
      });

      showNotification("success", (res as any).message || "กู้คืนข้อมูลการเช็คยอดสำเร็จเรียบร้อยแล้ว");
      if (onDataReset) onDataReset();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการกู้คืนข้อมูล");
    } finally {
      setIsRestoringAttendance(false);
    }
  };

  const executeClearAttendanceGranular = async () => {
    setIsClearingAttendance(true);
    try {
      const res = await clearAttendanceDatabase({
        mode: attClearMode,
        date: attClearDate,
        month: attClearMonth,
        startDate: attClearStartDate,
        endDate: attClearEndDate,
        dormId: attClearDormId,
        clearNotices: attClearIncludeNotices
      });

      showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดสำเร็จเรียบร้อยแล้ว");
      if (onDataReset) onDataReset();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
    } finally {
      setIsClearingAttendance(false);
    }
  };

  useEffect(() => {
    setSettingsForm(systemSettings);
  }, [systemSettings]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Change & Profile Picture Form State
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>(currentUser?.id || "");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() =>
    currentUser?.avatarUrl?.trim() ? currentUser.avatarUrl.trim() : ""
  );
  const [selectedGender, setSelectedGender] = useState<"male" | "female">(() =>
    inferUserGender(currentUser, dorms)
  );
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>("");

  // Manage Users Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // User Form Data
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    gender: "male" as "male" | "female",
    roleLevel: 2, // 1 = Admin, 2 = Staff, 3 = Teacher, 4 = Guest/Visitor
    roleCategory: "STAFF" as "ADMIN" | "STAFF" | "DORM_TEACHER" | "GUEST",
    dormId: "",
    dormPosition: "ครูประจำหอพัก" as DormPosition,
    allowedDormIds: [] as string[],
    avatarUrl: "",
    password: ""
  });

  // Firestore Profile Avatar Sync State
  const [isSavingProfileAvatar, setIsSavingProfileAvatar] = useState<boolean>(false);
  const [firestoreAvatars, setFirestoreAvatars] = useState<ProfileAvatarItem[]>([]);
  const [isLoadingFirestoreAvatars, setIsLoadingFirestoreAvatars] = useState<boolean>(false);
  const [isUploadingGalleryAvatars, setIsUploadingGalleryAvatars] = useState<boolean>(false);
  const [isDeletingGalleryAvatars, setIsDeletingGalleryAvatars] = useState<boolean>(false);
  const [selectedGalleryKeys, setSelectedGalleryKeys] = useState<string[]>([]);
  const [pendingDeleteGalleryItems, setPendingDeleteGalleryItems] = useState<Array<{
    key: string;
    id?: string;
    imageUrl: string;
    label: string;
    usedByNames: string[];
  }> | null>(null);

  // Local File Selection State for Firestore Profile Picture Storage
  const [profileSelectedFile, setProfileSelectedFile] = useState<File | null>(null);
  const [profileFilePreview, setProfileFilePreview] = useState<string | null>(null);

  const [modalSelectedFile, setModalSelectedFile] = useState<File | null>(null);
  const [modalFilePreview, setModalFilePreview] = useState<string | null>(null);

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: "PROFILE" | "MODAL") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showNotification("error", "ไฟล์รูปภาพมีขนาดใหญ่เกิน 20 MB โปรดเลือกไฟล์ขนาดเล็กกว่า");
      e.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (target === "PROFILE") {
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileSelectedFile(file);
      setProfileFilePreview(previewUrl);
      setSelectedAvatar(previewUrl);
      setCustomAvatarUrl("");
      showNotification("success", `เลือกรูปภาพ "${file.name}" สำเร็จ! กด 'บันทึกรูปโปรไฟล์ลง Firestore' เพื่อบันทึก`);
    } else {
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalSelectedFile(file);
      setModalFilePreview(previewUrl);
      setFormData((prev) => ({ ...prev, avatarUrl: previewUrl }));
      showNotification("success", `เลือกรูปภาพ "${file.name}" สำเร็จ! กด 'บันทึก' เพื่อบันทึกข้อมูล`);
    }
    e.target.value = "";
  };

  const clearSelectedFile = (target: "PROFILE" | "MODAL") => {
    if (target === "PROFILE") {
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileSelectedFile(null);
      setProfileFilePreview(null);
      setSelectedAvatar("");
      setCustomAvatarUrl("");
    } else {
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalSelectedFile(null);
      setModalFilePreview(null);
      setFormData((prev) => ({ ...prev, avatarUrl: "" }));
    }
  };

  // Password confirmation for DB & Attendance clearance actions
  const [dbAuthModalOpen, setDbAuthModalOpen] = useState<boolean>(false);
  const [dbAuthAction, setDbAuthAction] = useState<
    | "EXPORT"
    | "IMPORT"
    | "CLEAR"
    | "CLEAR_ATTENDANCE_DATE"
    | "CLEAR_ATTENDANCE_ALL"
    | "CLEAR_ATTENDANCE_GRANULAR"
    | "RESTORE_ATTENDANCE_NOTICES"
    | "CLEAR_STUDENTS_DORM"
    | "CLEAR_STUDENTS_ALL"
    | "DELETE_USER"
    | null
  >(null);

  const [targetUserToDelete, setTargetUserToDelete] = useState<UserProfile | null>(null);
  const [clearStudentsDormId, setClearStudentsDormId] = useState<string>("dorm-1");
  const [isClearingStudents, setIsClearingStudents] = useState<boolean>(false);
  const [pendingImportJson, setPendingImportJson] = useState<any>(null);
  const [adminAuthPassword, setAdminAuthPassword] = useState<string>("");
  const [adminAuthError, setAdminAuthError] = useState<string>("");

  // Sample data purge states
  const [isDeleteSampleModalOpen, setIsDeleteSampleModalOpen] = useState<boolean>(false);
  const [sampleDataTarget, setSampleDataTarget] = useState<"ALL" | "STUDENTS" | "DORMS" | "USERS" | "ATTENDANCE_NOTICES">("ALL");
  const [keepAdminAccount, setKeepAdminAccount] = useState<boolean>(true);
  const [isDeletingSampleData, setIsDeletingSampleData] = useState<boolean>(false);
  const [sampleAuthPassword, setSampleAuthPassword] = useState<string>("");
  const [sampleAuthError, setSampleAuthError] = useState<string>("");

  const handleExecuteDeleteSampleData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleAuthPassword.trim()) {
      setSampleAuthError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
      return;
    }

    if (!isAdmin && !isStaff) {
      setSampleAuthError("เฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ดำเนินการ");
      return;
    }

    const isPasswordCorrect = await verifyAuthorizedAdminOrStaffPassword(
      sampleAuthPassword,
      currentUser,
      users
    );

    if (!isPasswordCorrect) {
      setSampleAuthError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      return;
    }

    setIsDeletingSampleData(true);
    try {
      const res = await deleteSampleData({
        target: sampleDataTarget,
        keepAdminAccount
      });
      showNotification("success", res.message || "ลบข้อมูลตัวอย่างสำเร็จเรียบร้อยแล้ว");
      setIsDeleteSampleModalOpen(false);
      setSampleAuthPassword("");
      setSampleAuthError("");
      if (onDataReset) onDataReset();
      await loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบข้อมูลตัวอย่าง");
    } finally {
      setIsDeletingSampleData(false);
    }
  };

  // Central database sync & upload states
  const [isInitializingDefaultDb, setIsInitializingDefaultDb] = useState<boolean>(false);
  const [isUploadingCurrentDb, setIsUploadingCurrentDb] = useState<boolean>(false);
  const [firebaseAuthEmail, setFirebaseAuthEmail] = useState<string>(() => auth.currentUser?.email || "");
  const [uploadCloudResult, setUploadCloudResult] = useState<{
    message: string;
    uploadedCounts: {
      dorms: number;
      students: number;
      users: number;
      notices: number;
      attendance: number;
      attendanceDates: number;
    };
    verifiedCloudCounts: {
      dorms: number;
      students: number;
      users: number;
      notices: number;
      attendance: number;
    };
  } | null>(null);
  const [uploadCloudError, setUploadCloudError] = useState<string | null>(null);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((fbUser) => {
      setFirebaseAuthEmail(fbUser?.emailVerified && fbUser.email ? fbUser.email : "");
    });
    return () => unsubscribe();
  }, []);

  const displayedSnapshot = React.useMemo(
    () =>
      getDisplayedDatabaseSnapshot({
        dorms,
        students,
        users: usersList && usersList.length > 0 ? usersList : undefined,
        notices,
        attendance: attendanceRecords,
        systemSettings: settingsForm
      }),
    [dorms, students, usersList, notices, attendanceRecords, settingsForm]
  );

  const displayedAttendanceDatesCount = React.useMemo(
    () => new Set(displayedSnapshot.attendance.map((a) => a.date).filter(Boolean)).size,
    [displayedSnapshot.attendance]
  );

  const handleGoogleSignInForDb = async () => {
    setUploadCloudError(null);
    const fbUser = await signInWithGoogleAndRefresh();
    setFirebaseAuthEmail(fbUser.email || "");
    invalidateFirestoreReadCache();
    await queryClient.invalidateQueries();
    return fbUser;
  };

  const handleUploadDisplayedDatabase = async () => {
    setUploadCloudError(null);
    setUploadCloudResult(null);

    try {
      if (!auth.currentUser || !auth.currentUser.emailVerified) {
        await handleGoogleSignInForDb();
      }
    } catch (authErr: any) {
      const hostname = getCurrentHostname();
      const errMsg =
        authErr?.code === "auth/unauthorized-domain"
          ? `โดเมน "${hostname}" ยังไม่ได้รับอนุญาตใน Firebase Authentication — กรุณาไปที่ Firebase Console โปรเจกต์ ${FIREBASE_PROJECT_ID} -> Authentication -> Settings -> Authorized domains แล้วเพิ่ม "${hostname}"`
          : authErr?.code === "auth/popup-closed-by-user"
          ? "ยกเลิกการเข้าสู่ระบบด้วย Google กรุณากดอัพโหลดและเลือกบัญชีผู้ดูแลระบบ (domitory@pcccr.ac.th)"
          : authErr?.message || "ไม่สามารถยืนยันตัวตนด้วยบัญชี Google ได้";
      setUploadCloudError(errMsg);
      showNotification("error", errMsg);
      return;
    }

    setIsUploadingCurrentDb(true);
    try {
      const res = await uploadCurrentDisplayedDatabaseToCloud({
        dorms,
        students,
        users: usersList && usersList.length > 0 ? usersList : users,
        notices,
        attendance: attendanceRecords,
        systemSettings: settingsForm
      });
      setUploadCloudResult({
        message: res.message,
        uploadedCounts: res.uploadedCounts,
        verifiedCloudCounts: res.verifiedCloudCounts
      });
      invalidateFirestoreReadCache();
      await queryClient.invalidateQueries();
      showNotification("success", res.message);
      if (onDataReset) onDataReset();
      await loadUsersList();
    } catch (err: any) {
      const rawMsg = String(err?.message || err || "");
      const friendlyMsg = rawMsg.includes("permission-denied") || rawMsg.includes("Missing or insufficient permissions")
        ? "ไม่มีสิทธิ์เขียนลงฐานข้อมูล กรุณาเข้าสู่ระบบ Google ด้วยบัญชีผู้ดูแลระบบ (domitory@pcccr.ac.th)"
        : rawMsg || "เกิดข้อผิดพลาดในการอัพโหลดฐานข้อมูลลง Firestore";
      setUploadCloudError(friendlyMsg);
      showNotification("error", friendlyMsg);
    } finally {
      setIsUploadingCurrentDb(false);
    }
  };

  const handleInitializeDefaultDb = async () => {
    setIsInitializingDefaultDb(true);
    try {
      const res = await syncLiveFirebaseDatabase();
      invalidateFirestoreReadCache();
      await queryClient.invalidateQueries();
      showNotification(res.success ? "success" : "error", res.message || "ซิงค์ข้อมูลจากฐานข้อมูลกลางสำเร็จ");
      if (onDataReset) onDataReset();
      loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการซิงค์ข้อมูลจากฐานข้อมูลกลาง");
    } finally {
      setIsInitializingDefaultDb(false);
    }
  };

  // Load users list
  const loadUsersList = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Helper to determine the primary dorm numeric index for a user
  const getUserDormIndex = (u: UserProfile, dormsList: Dormitory[]): number => {
    if (u.roleLevel === 1 || u.roleLevel === 2) return 0;

    const dormIdsToCheck: string[] = [];
    if (u.dormId) dormIdsToCheck.push(u.dormId);
    if (u.allowedDormIds) {
      u.allowedDormIds.forEach((id) => {
        if (!dormIdsToCheck.includes(id)) dormIdsToCheck.push(id);
      });
    }

    if (dormIdsToCheck.length === 0) return 99;

    let minIndex = 99;
    for (const id of dormIdsToCheck) {
      const idx = dormsList.findIndex((d) => d.id === id);
      if (idx !== -1) {
        if (idx + 1 < minIndex) minIndex = idx + 1;
      } else {
        const match = id.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (val < minIndex) minIndex = val;
        }
      }
    }

    return minIndex;
  };

  // Sort users by roleLevel ascending (1 -> 2 -> 3), then by dorm scope (หอพัก 1 -> 6), then by name
  const sortedUsers = React.useMemo(() => {
    return [...users].sort((a, b) => {
      // 1. Primary: Role Level (1 -> 2 -> 3)
      if (a.roleLevel !== b.roleLevel) {
        return a.roleLevel - b.roleLevel;
      }

      // 2. Secondary: Dormitory scope (หอพัก 1 -> หอพัก 6)
      const dormIdxA = getUserDormIndex(a, dorms);
      const dormIdxB = getUserDormIndex(b, dorms);
      if (dormIdxA !== dormIdxB) {
        return dormIdxA - dormIdxB;
      }

      // 3. Tertiary: User name
      return a.name.localeCompare(b.name, "th");
    });
  }, [users, dorms]);

  const loadFirestoreAvatars = async () => {
    setIsLoadingFirestoreAvatars(true);
    try {
      const items = await fetchProfileAvatars();
      setFirestoreAvatars(items);
    } catch (err) {
      console.error("Error loading Firestore avatars:", err);
    } finally {
      setIsLoadingFirestoreAvatars(false);
    }
  };

  // Unified list of ALL custom profile images currently stored in Firestore (/profile_avatars + /users)
  const allFirestoreGalleryImages = React.useMemo(() => {
    const byUrl = new Map<
      string,
      {
        key: string;
        id?: string;
        imageUrl: string;
        label: string;
        uploadedAt?: string;
        source: "LIBRARY" | "USER_PROFILE";
        usedByNames: string[];
      }
    >();

    firestoreAvatars.forEach((item) => {
      const url = item.imageUrl?.trim();
      if (!url) return;
      if (!byUrl.has(url)) {
        byUrl.set(url, {
          key: item.id,
          id: item.id,
          imageUrl: url,
          label: item.label || "รูปใน Firestore",
          uploadedAt: item.uploadedAt,
          source: "LIBRARY",
          usedByNames: []
        });
      }
    });

    const knownUsersMap = new Map<string, UserProfile>();
    [...(usersList || []), ...users].forEach((u) => {
      if (u?.id) knownUsersMap.set(u.id, u);
    });

    knownUsersMap.forEach((u) => {
      if (!hasCustomAvatar(u)) return;
      const url = String(u.avatarUrl || "").trim();
      if (!url) return;
      const existing = byUrl.get(url);
      if (existing) {
        if (!existing.usedByNames.includes(u.name)) {
          existing.usedByNames.push(u.name);
        }
      } else {
        byUrl.set(url, {
          key: `user-avatar-${u.id}`,
          imageUrl: url,
          label: u.name,
          source: "USER_PROFILE",
          usedByNames: [u.name]
        });
      }
    });

    return Array.from(byUrl.values());
  }, [firestoreAvatars, users, usersList]);

  useEffect(() => {
    loadUsersList();
    loadFirestoreAvatars();
  }, []);

  useEffect(() => {
    if (activeTab === "CHANGE_PROFILE") {
      loadFirestoreAvatars();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentUser) {
      setSelectedTargetUserId(currentUser.id);
      setSelectedAvatar(currentUser.avatarUrl?.trim() ? currentUser.avatarUrl.trim() : "");
      setSelectedGender(inferUserGender(currentUser, dorms));
    }
  }, [currentUser, dorms]);

  const showNotification = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Trigger Password Auth Modal before any DB or clearance action
  const triggerDbActionWithAuth = (
    action:
      | "EXPORT"
      | "IMPORT"
      | "CLEAR"
      | "CLEAR_ATTENDANCE_DATE"
      | "CLEAR_ATTENDANCE_ALL"
      | "CLEAR_ATTENDANCE_GRANULAR"
      | "RESTORE_ATTENDANCE_NOTICES"
      | "CLEAR_STUDENTS_DORM"
      | "CLEAR_STUDENTS_ALL"
      | "DELETE_USER",
    extraData?: any
  ) => {
    setDbAuthAction(action);
    if (action === "IMPORT" && extraData) {
      setPendingImportJson(extraData);
    }
    setAdminAuthPassword("");
    setAdminAuthError("");
    setDbAuthModalOpen(true);
  };

  const handleVerifyAdminPassAndExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthPassword.trim()) {
      setAdminAuthError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
      return;
    }

    if (!isAdmin && !isStaff) {
      setAdminAuthError("เฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ดำเนินการ");
      return;
    }

    const isPasswordCorrect = await verifyAuthorizedAdminOrStaffPassword(
      adminAuthPassword,
      currentUser,
      users
    );

    if (!isPasswordCorrect) {
      setAdminAuthError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      return;
    }

    // Password is valid
    setDbAuthModalOpen(false);
    setAdminAuthError("");

    if (dbAuthAction === "EXPORT") {
      await executeExportDb();
    } else if (dbAuthAction === "IMPORT" && pendingImportJson) {
      await executeImportDb(pendingImportJson);
      setPendingImportJson(null);
    } else if (dbAuthAction === "CLEAR") {
      try {
        await clearDatabase();
        showNotification("success", "ล้างฐานข้อมูลทั้งหมดสำเร็จเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message);
      }
    } else if (dbAuthAction === "RESTORE_ATTENDANCE_NOTICES") {
      await executeRestoreAttendance();
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_GRANULAR") {
      await executeClearAttendanceGranular();
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_DATE") {
      setIsClearingAttendance(true);
      try {
        const res = await clearAttendanceDatabase({
          mode: "BY_DATE",
          date: clearDate,
          dormId: clearDormIdForDate
        });
        showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดประจำวันที่เลือกเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
      } finally {
        setIsClearingAttendance(false);
      }
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_ALL") {
      setIsClearingAttendance(true);
      try {
        const res = await clearAttendanceDatabase({
          mode: "ALL",
          dormId: clearDormIdForAll
        });
        showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดทั้งหมดเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
      } finally {
        setIsClearingAttendance(false);
      }
    } else if (dbAuthAction === "CLEAR_STUDENTS_DORM") {
      setIsClearingStudents(true);
      try {
        const res = await clearStudentsDatabase({
          mode: "BY_DORM",
          dormId: clearStudentsDormId
        });
        showNotification("success", (res as any).message || "ลบรายชื่อนักเรียนในหอพักเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบรายชื่อนักเรียน");
      } finally {
        setIsClearingStudents(false);
      }
    } else if (dbAuthAction === "CLEAR_STUDENTS_ALL") {
      setIsClearingStudents(true);
      try {
        const res = await clearStudentsDatabase({
          mode: "ALL"
        });
        showNotification("success", (res as any).message || "ลบรายชื่อนักเรียนทุกหอพักเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบรายชื่อนักเรียน");
      } finally {
        setIsClearingStudents(false);
      }
    } else if (dbAuthAction === "DELETE_USER" && targetUserToDelete) {
      try {
        await deleteUser(targetUserToDelete.id);
        showNotification("success", `ลบบัญชีผู้ใช้ ${targetUserToDelete.name} เรียบร้อยแล้ว`);
        setTargetUserToDelete(null);
        queryClient.invalidateQueries({ queryKey: ["users"] });
        queryClient.invalidateQueries({ queryKey: ["dorms"] });
        queryClient.invalidateQueries({ queryKey: ["dailyReport"] });
        loadUsersList();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้");
      }
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPasswordStrength(newPassword)) {
      showNotification("error", "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification("error", "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
    if (!targetUser) return;

    if (!isAdmin && targetUser.hasPassword && !oldPassword.trim()) {
      showNotification("error", "กรุณากรอกรหัสผ่านเดิมเพื่อยืนยัน");
      return;
    }

    try {
      await changeUserPassword(targetUser.id, {
        oldPassword,
        newPassword,
        isAdminOverride: isAdmin
      });

      showNotification("success", `เปลี่ยนรหัสผ่านสำหรับ ${targetUser.name} สำเร็จแล้ว!`);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    }
  };

  const ensureFirestoreAuthForProfileWrite = async (): Promise<void> => {
    if (!auth.currentUser || !auth.currentUser.emailVerified) {
      const fbUser = await signInWithGoogleAndRefresh();
      setFirebaseAuthEmail(fbUser.email || "");
    }
  };

  // Profile Avatar Save Handler (Stored on Firestore)
  const handleSaveProfileAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
    if (!targetUser) return;

    setIsSavingProfileAvatar(true);
    try {
      let updatedAvatar = customAvatarUrl.trim()
        ? sanitizeSafeImageUrl(customAvatarUrl.trim())
        : selectedAvatar;

      if (customAvatarUrl.trim() && !updatedAvatar) {
        showNotification("error", "URL รูปภาพไม่ถูกต้อง (ต้องขึ้นต้นด้วย https:// หรือไฟล์ภาพที่ปลอดภัย)");
        return;
      }

      if (profileSelectedFile) {
        const compressed = await compressImageFile(profileSelectedFile, 240, 240, 0.82, 45000);
        if (!compressed) {
          showNotification("error", "ไม่สามารถบีบอัดไฟล์รูปภาพได้ กรุณาลองเลือกไฟล์อื่น");
          return;
        }
        updatedAvatar = compressed;
      } else if (updatedAvatar) {
        const normalized = getDirectImageUrl(updatedAvatar) || updatedAvatar;
        updatedAvatar = await compressDataUrlIfNeeded(normalized, 240, 240, 0.82, 45000);
      } else {
        updatedAvatar = "";
      }

      await ensureFirestoreAuthForProfileWrite();
      const updatedUser = await updateUser(
        targetUser.id,
        { avatarUrl: updatedAvatar, gender: selectedGender },
        { requireCloudSync: true, baseUser: targetUser }
      );

      if (updatedAvatar) {
        try {
          await saveProfileAvatarToLibrary({
            imageUrl: updatedAvatar,
            label: profileSelectedFile?.name || targetUser.name,
            uploadedBy: currentUser?.name
          });
        } catch (galleryErr) {
          console.warn("Saved user profile picture; library record skipped:", galleryErr);
        }
      }

      if (currentUser && targetUser.id === currentUser.id && onUserUpdated) {
        onUserUpdated({ ...currentUser, ...updatedUser, avatarUrl: updatedAvatar, gender: selectedGender });
      }

      setSelectedAvatar(updatedAvatar);
      setCustomAvatarUrl("");
      setProfileSelectedFile(null);
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileFilePreview(null);
      invalidateFirestoreReadCache("users");
      invalidateFirestoreReadCache("profile_avatars");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await Promise.all([loadUsersList(), loadFirestoreAvatars()]);
      showNotification("success", `บันทึกรูปโปรไฟล์สำหรับ ${targetUser.name} ลง Firestore สำเร็จแล้ว!`);
    } catch (err: any) {
      const rawMsg = String(err?.message || err || "");
      const friendlyMsg =
        rawMsg.includes("permission-denied") || rawMsg.includes("Missing or insufficient permissions")
          ? "ไม่มีสิทธิ์เขียนลง Firestore กรุณาเชื่อมต่อบัญชี Google ผู้ดูแลระบบ (domitory@pcccr.ac.th)"
          : rawMsg || "เกิดข้อผิดพลาดในการบันทึกรูปโปรไฟล์ลง Firestore";
      showNotification("error", friendlyMsg);
    } finally {
      setIsSavingProfileAvatar(false);
    }
  };

  // Upload one or multiple images directly into Firestore Profile Avatars Gallery
  const handleGalleryUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((f) => f.size <= 20 * 1024 * 1024);
    if (validFiles.length < files.length) {
      showNotification("error", "บางไฟล์มีขนาดเกิน 20 MB จึงถูกข้ามอัตโนมัติ");
    }
    if (validFiles.length === 0) return;

    setIsUploadingGalleryAvatars(true);
    try {
      await ensureFirestoreAuthForProfileWrite();
      let uploadedCount = 0;
      let lastUploadedUrl = "";

      for (const file of validFiles) {
        const compressed = await compressImageFile(file, 240, 240, 0.82, 45000);
        if (!compressed) continue;
        const saved = await saveProfileAvatarToLibrary({
          imageUrl: compressed,
          label: file.name,
          uploadedBy: currentUser?.name
        });
        uploadedCount++;
        lastUploadedUrl = saved.imageUrl;
      }

      if (uploadedCount === 0) {
        showNotification("error", "ไม่สามารถประมวลผลไฟล์รูปภาพที่เลือกได้");
        return;
      }

      if (uploadedCount === 1 && lastUploadedUrl) {
        if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
        setProfileSelectedFile(null);
        setProfileFilePreview(null);
        setCustomAvatarUrl("");
        setSelectedAvatar(lastUploadedUrl);
      }

      invalidateFirestoreReadCache("profile_avatars");
      await loadFirestoreAvatars();
      showNotification(
        "success",
        `อัปโหลดรูปภาพเข้าคลัง Firestore สำเร็จ ${uploadedCount} รูป!`
      );
    } catch (err: any) {
      const rawMsg = String(err?.message || err || "");
      const friendlyMsg =
        rawMsg.includes("permission-denied") || rawMsg.includes("Missing or insufficient permissions")
          ? "ไม่มีสิทธิ์อัปโหลดรูปเข้า Firestore กรุณาเชื่อมต่อบัญชี Google ผู้ดูแลระบบ (domitory@pcccr.ac.th)"
          : rawMsg || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพเข้า Firestore";
      showNotification("error", friendlyMsg);
    } finally {
      setIsUploadingGalleryAvatars(false);
    }
  };

  // Toggle selection checkbox for batch deleting images in Firestore Gallery (Level 1 & 2 only)
  const toggleGalleryKeySelection = (key: string) => {
    if (!isAdmin && !isStaff) return;
    setSelectedGalleryKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Confirm & execute deletion of selected image(s) from Firestore (Level 1 & 2 only)
  const handleConfirmDeleteGalleryItems = async () => {
    if (!isAdmin && !isStaff) {
      setPendingDeleteGalleryItems(null);
      showNotification("error", "เฉพาะสิทธิ์ระดับ 1 และระดับ 2 เท่านั้นที่สามารถลบรูปภาพใน Firestore ได้");
      return;
    }
    if (!pendingDeleteGalleryItems || pendingDeleteGalleryItems.length === 0) return;
    setIsDeletingGalleryAvatars(true);
    try {
      await ensureFirestoreAuthForProfileWrite();
      const knownUsers = Array.from(
        new Map([...(usersList || []), ...users].map((u) => [u.id, u])).values()
      );
      const deletedUrls = new Set(pendingDeleteGalleryItems.map((i) => i.imageUrl.trim()));
      const deletedKeys = new Set(pendingDeleteGalleryItems.map((i) => i.key));

      const res = await deleteProfileAvatarsFromLibrary(
        pendingDeleteGalleryItems.map((item) => ({ id: item.id, imageUrl: item.imageUrl })),
        knownUsers
      );

      if (deletedUrls.has(selectedAvatar.trim())) {
        setSelectedAvatar("");
      }
      if (currentUser && currentUser.avatarUrl && deletedUrls.has(currentUser.avatarUrl.trim()) && onUserUpdated) {
        onUserUpdated({ ...currentUser, avatarUrl: "" });
      }

      setSelectedGalleryKeys((prev) => prev.filter((k) => !deletedKeys.has(k)));
      setPendingDeleteGalleryItems(null);
      invalidateFirestoreReadCache("profile_avatars");
      invalidateFirestoreReadCache("users");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await Promise.all([loadFirestoreAvatars(), loadUsersList()]);

      showNotification(
        "success",
        `ลบรูปภาพออกจาก Firestore สำเร็จ ${pendingDeleteGalleryItems.length} รูป${
          res.clearedUsers > 0 ? ` (รีเซ็ตรูปโปรไฟล์ผู้ใช้ ${res.clearedUsers} บัญชีกลับเป็นรูปตัวอย่างตามเพศ)` : ""
        }`
      );
    } catch (err: any) {
      const rawMsg = String(err?.message || err || "");
      const friendlyMsg =
        rawMsg.includes("permission-denied") || rawMsg.includes("Missing or insufficient permissions")
          ? "ไม่มีสิทธิ์ลบรูปภาพบน Firestore กรุณาเชื่อมต่อบัญชี Google ผู้ดูแลระบบ (domitory@pcccr.ac.th)"
          : rawMsg || "เกิดข้อผิดพลาดในการลบรูปภาพออกจาก Firestore";
      showNotification("error", friendlyMsg);
    } finally {
      setIsDeletingGalleryAvatars(false);
    }
  };

  // Profile Avatar Delete Handler (Clears avatar on Firestore so system falls back to gender sample avatar)
  const handleDeleteProfileAvatar = async () => {
    const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
    if (!targetUser) return;

    const hasSavedCloudAvatar = hasCustomAvatar(targetUser);
    if (!hasSavedCloudAvatar) {
      clearSelectedFile("PROFILE");
      showNotification(
        "success",
        `ล้างรูปที่เลือกเรียบร้อยแล้ว ระบบจะใช้รูปตัวอย่างระบบ (${getGenderLabel(selectedGender)})`
      );
      return;
    }

    setIsSavingProfileAvatar(true);
    try {
      await ensureFirestoreAuthForProfileWrite();
      const updatedUser = await updateUser(
        targetUser.id,
        { avatarUrl: "", gender: selectedGender },
        { requireCloudSync: true, baseUser: targetUser }
      );

      if (currentUser && targetUser.id === currentUser.id && onUserUpdated) {
        onUserUpdated({ ...currentUser, ...updatedUser, avatarUrl: "", gender: selectedGender });
      }

      clearSelectedFile("PROFILE");
      invalidateFirestoreReadCache("users");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await Promise.all([loadUsersList(), loadFirestoreAvatars()]);
      showNotification(
        "success",
        `ลบรูปโปรไฟล์ของ ${targetUser.name} ออกจาก Firestore สำเร็จแล้ว (แสดงรูปตัวอย่าง${getGenderLabel(selectedGender)}แทน)`
      );
    } catch (err: any) {
      const rawMsg = String(err?.message || err || "");
      const friendlyMsg =
        rawMsg.includes("permission-denied") || rawMsg.includes("Missing or insufficient permissions")
          ? "ไม่มีสิทธิ์ลบรูปโปรไฟล์บน Firestore กรุณาเชื่อมต่อบัญชี Google ผู้ดูแลระบบ (domitory@pcccr.ac.th)"
          : rawMsg || "เกิดข้อผิดพลาดในการลบรูปโปรไฟล์ออกจาก Firestore";
      showNotification("error", friendlyMsg);
    } finally {
      setIsSavingProfileAvatar(false);
    }
  };

  // Add / Edit User Handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    const trimmedPhone = formData.phone.trim();
    if (!trimmedName || trimmedName.length > 120) {
      showNotification("error", "กรุณาระบุชื่อ-นามสกุล (ไม่เกิน 120 ตัวอักษร)");
      return;
    }
    if (trimmedPhone.length > 30) {
      showNotification("error", "เบอร์โทรศัพท์ยาวเกินกำหนด");
      return;
    }
    const rawPasswordInput = formData.password.trim();
    if (rawPasswordInput && !isValidPasswordStrength(rawPasswordInput)) {
      showNotification("error", "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (!isAdmin && isStaff && (Number(formData.roleLevel) === 1 || Number(formData.roleLevel) === 2)) {
      showNotification("error", "สิทธิ์เจ้าหน้าที่สามารถเพิ่มหรือแก้ไขได้เฉพาะสิทธิ์ครูหอพัก (ระดับ 3) หรือผู้เยี่ยมชมเท่านั้น");
      return;
    }

    let roleCategoryName = "ครูหอพัก";
    let roleLabel = formData.dormPosition || "ครูประจำหอพัก";
    let role: UserRole = formData.dormPosition === "ครูประธานหอพัก" ? "HEAD_TEACHER" : "DORM_TEACHER";

    const level = Number(formData.roleLevel);
    if (level === 1) {
      roleCategoryName = "ผู้ดูแล";
      roleLabel = "ผู้ดูแลระบบ";
      role = "SYSTEM_ADMIN";
    } else if (level === 2) {
      roleCategoryName = "เจ้าหน้าที่";
      roleLabel = "เจ้าหน้าที่ส่วนกลาง";
      role = "ADMIN_OFFICER";
    } else if (level === 4) {
      roleCategoryName = "ผู้เยี่ยมชม";
      roleLabel = "ผู้เยี่ยมชมระบบ (Visitor)";
      role = "GUEST";
    }

    let processedAvatarUrl = "";
    if (modalSelectedFile) {
      const compressed = await compressImageFile(modalSelectedFile, 240, 240, 0.82, 45000);
      if (compressed) {
        processedAvatarUrl = compressed;
      }
    } else if (formData.avatarUrl && formData.avatarUrl.trim()) {
      const safe = sanitizeSafeImageUrl(getDirectImageUrl(formData.avatarUrl.trim()) || formData.avatarUrl.trim());
      if (!safe) {
        showNotification("error", "URL รูปภาพไม่ถูกต้อง (ต้องขึ้นต้นด้วย https:// หรือไฟล์ภาพที่ปลอดภัย)");
        return;
      }
      processedAvatarUrl = await compressDataUrlIfNeeded(safe, 240, 240, 0.82, 45000);
    }

    try {
      const syncToCloud = Boolean(auth.currentUser && auth.currentUser.emailVerified);
      if (editingUser) {
        const payload: Partial<UserProfile> & { password?: string } = {
          name: trimmedName,
          phone: trimmedPhone,
          gender: formData.gender,
          roleLevel: level as any,
          roleCategory: formData.roleCategory,
          roleCategoryName,
          roleLabel,
          role,
          dormId: formData.dormId || "",
          dormPosition: formData.dormPosition,
          allowedDormIds: formData.allowedDormIds,
          avatarUrl: processedAvatarUrl,
          ...(rawPasswordInput ? { password: rawPasswordInput } : {})
        };

        const updated = await updateUser(editingUser.id, payload, {
          requireCloudSync: syncToCloud,
          baseUser: editingUser
        });
        showNotification("success", `อัปเดตข้อมูลผู้ใช้ ${trimmedName} สำเร็จแล้ว`);

        if (currentUser && currentUser.id === editingUser.id && onUserUpdated) {
          onUserUpdated({ ...currentUser, ...updated });
        }
      } else {
        await addUser(
          {
            name: trimmedName,
            phone: trimmedPhone,
            gender: formData.gender,
            roleLevel: level as any,
            roleCategory: formData.roleCategory,
            roleCategoryName,
            roleLabel,
            role,
            dormId: formData.dormId || "",
            dormPosition: formData.dormPosition,
            allowedDormIds: formData.allowedDormIds,
            avatarUrl: processedAvatarUrl,
            ...(rawPasswordInput ? { password: rawPasswordInput } : {})
          },
          { requireCloudSync: syncToCloud }
        );
        showNotification("success", `เพิ่มผู้ใช้งานใหม่ ${trimmedName} สำเร็จแล้ว`);
      }

      setIsAddUserModalOpen(false);
      setEditingUser(null);
      setModalSelectedFile(null);
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalFilePreview(null);
      invalidateFirestoreReadCache("users");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
      queryClient.invalidateQueries({ queryKey: ["dailyReport"] });
      await loadUsersList();
    } catch (err: any) {
      console.error("Error saving user:", err);
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้");
    }
  };

  const handleDeleteUserClick = (user: UserProfile) => {
    // 1. Cannot delete current logged-in user
    if (currentUser && user.id === currentUser.id) {
      showNotification("error", "ผู้ที่เข้าสู่ระบบไม่สามารถลบบัญชีของตนเองได้");
      return;
    }

    // 2. Cannot delete last Level 1 Admin
    const level1AdminsCount = users.filter((u) => u.roleLevel === 1).length;
    if (user.roleLevel === 1 && level1AdminsCount <= 1) {
      showNotification("error", "ไม่สามารถลบผู้ดูแลระดับ 1 ได้ เนื่องจากต้องมีผู้ดูแลระดับ 1 อย่างน้อย 1 คนในระบบ");
      return;
    }

    // 3. Staff (Level 2) cannot delete Admin (Level 1) or Staff (Level 2) users
    if (isStaff && (user.roleLevel === 1 || user.roleLevel === 2)) {
      showNotification("error", "สิทธิ์เจ้าหน้าที่ไม่สามารถลบบัญชีผู้ดูแลหรือเจ้าหน้าที่ได้");
      return;
    }

    // 3. Confirm deletion via admin password auth modal
    setTargetUserToDelete(user);
    triggerDbActionWithAuth("DELETE_USER");
  };

  // Database Handlers
  const executeExportDb = async () => {
    try {
      const data = await exportDatabase();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pccc_dorm_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      showNotification("success", "ส่งออกไฟล์สำรองข้อมูล (JSON) สำเร็จแล้ว");
    } catch (err: any) {
      showNotification("error", "เกิดข้อผิดพลาดในการส่งออกข้อมูล: " + err.message);
    }
  };

  const handleExportDb = () => {
    triggerDbActionWithAuth("EXPORT");
  };

  const executeImportDb = async (json: any) => {
    try {
      await restoreDatabase(json);
      showNotification("success", "นำเข้าและกู้คืนฐานข้อมูลสำเร็จแล้ว!");
      if (onDataReset) onDataReset();
      loadUsersList();
    } catch (err: any) {
      showNotification("error", "ไฟล์ไม่ถูกต้องหรือเกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        triggerDbActionWithAuth("IMPORT", json);
      } catch (err: any) {
        showNotification("error", "ไฟล์ JSON ไม่ถูกต้อง: " + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = "";
  };

  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.schoolNameTh.trim() || !settingsForm.systemNameTh.trim()) {
      showNotification("error", "กรุณาระบุชื่อโรงเรียนและชื่อระบบ (ภาษาไทย)");
      return;
    }
    if (onUpdateSystemSettings) {
      onUpdateSystemSettings(settingsForm);
    }
    showNotification("success", "บันทึกการตั้งค่าระบบสำเร็จแล้ว ข้อมูลทั้งหมดถูกอัปเดตเรียบร้อย");
  };

  const handleSetTodayUpdateDate = () => {
    const todayFormatted = formatThaiFullDate(new Date().toISOString().split("T")[0]);
    setSettingsForm((prev) => ({
      ...prev,
      lastUpdatedDate: todayFormatted
    }));
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Row 1: Title & Role Info */}
        <div className="p-6 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A05AFF] to-[#1BCFB4] text-white flex items-center justify-center shadow-md shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                ตั้งค่าระบบ บัญชีผู้ใช้ สิทธิ์ และฐานข้อมูล
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                ระดับสิทธิ์ปัจจุบัน: <strong className="text-[#A05AFF] font-bold">{currentUser?.roleCategoryName || "ผู้เยี่ยมชม"}</strong> (ระดับ {currentUser?.roleLevel || "Guest"})
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Mobile Dropdown Selector (< md screens) */}
        <div className="md:hidden px-4 py-3 bg-slate-50 border-t border-gray-200">
          <label htmlFor="settings-tab-select" className="sr-only">เลือกแท็ประบบ</label>
          <div className="relative">
            <select
              id="settings-tab-select"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-10 text-xs font-bold text-gray-800 shadow-xs focus:ring-2 focus:ring-[#A05AFF] focus:border-[#A05AFF] appearance-none cursor-pointer"
            >
              {(isAdmin || isStaff) && <option value="SYSTEM_SETTINGS">1. การตั้งค่าระบบ (System Configuration)</option>}
              {(isAdmin || isStaff) && <option value="MANAGE_USERS">2. จัดการเจ้าหน้าที่ & ผู้ใช้</option>}
              {isAdmin && <option value="PERMISSIONS">3. การอนุญาตเข้าถึง (Access Control - เฉพาะ Admin)</option>}
              <option value="CHANGE_PASSWORD">{isAdmin ? "4. เปลี่ยนรหัสผ่าน" : (isStaff ? "3. เปลี่ยนรหัสผ่าน" : "1. เปลี่ยนรหัสผ่าน")}</option>
              <option value="CHANGE_PROFILE">{isAdmin ? "5. เปลี่ยนรูปโปรไฟล์" : (isStaff ? "4. เปลี่ยนรูปโปรไฟล์" : "2. เปลี่ยนรูปโปรไฟล์")}</option>
              {(isAdmin || isStaff) && <option value="DATABASE">{isAdmin ? "6. จัดการฐานข้อมูล" : "5. จัดการฐานข้อมูล"}</option>}
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A05AFF]">
              {activeTab === "SYSTEM_SETTINGS" && <Settings className="w-4 h-4" />}
              {activeTab === "MANAGE_USERS" && <UserCheck className="w-4 h-4" />}
              {activeTab === "PERMISSIONS" && <ShieldCheck className="w-4 h-4 text-[#A05AFF]" />}
              {activeTab === "CHANGE_PASSWORD" && <Key className="w-4 h-4" />}
              {activeTab === "CHANGE_PROFILE" && <ImageIcon className="w-4 h-4" />}
              {activeTab === "DATABASE" && <Database className="w-4 h-4" />}
            </div>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Row 2: Tablet & Desktop Tab Bar Navigation (>= md screens) */}
        <div className="hidden md:flex bg-slate-50/80 px-4 lg:px-6 border-t border-gray-200 overflow-x-auto scrollbar-none gap-1 lg:gap-2 pt-2">
          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("SYSTEM_SETTINGS")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "SYSTEM_SETTINGS"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>
                <span className="hidden xl:inline">1. การตั้งค่าระบบ (System Configuration)</span>
                <span className="xl:hidden">1. การตั้งค่าระบบ</span>
              </span>
            </button>
          )}

          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("MANAGE_USERS")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "MANAGE_USERS"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>2. จัดการเจ้าหน้าที่ & ผู้ใช้</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab("PERMISSIONS")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "PERMISSIONS"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#A05AFF]" />
              <span className="flex items-center gap-1.5">
                <span>3. การอนุญาตเข้าถึง</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded">
                  Admin
                </span>
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("CHANGE_PASSWORD")}
            className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "CHANGE_PASSWORD"
                ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
            }`}
          >
            <Key className="w-4 h-4 shrink-0" />
            <span>{isAdmin ? "4. เปลี่ยนรหัสผ่าน" : (isStaff ? "3. เปลี่ยนรหัสผ่าน" : "1. เปลี่ยนรหัสผ่าน")}</span>
          </button>

          <button
            onClick={() => setActiveTab("CHANGE_PROFILE")}
            className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "CHANGE_PROFILE"
                ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span>{isAdmin ? "5. เปลี่ยนรูปโปรไฟล์" : (isStaff ? "4. เปลี่ยนรูปโปรไฟล์" : "2. เปลี่ยนรูปโปรไฟล์")}</span>
          </button>

          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("DATABASE")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "DATABASE"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>{isAdmin ? "6. จัดการฐานข้อมูล" : "5. จัดการฐานข้อมูล"}</span>
            </button>
          )}
        </div>

        {/* Main Tab Content Area Inside Frame */}
        <div className="p-6 border-t border-gray-100">
        {/* Global Notification Banner */}
        {msg && (
          <div
            className={`p-4 mb-6 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {msg.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* TAB 1: System Settings (การตั้งค่าระบบ - ผู้ดูแล และ เจ้าหน้าที่ เท่านั้น) */}
        {activeTab === "SYSTEM_SETTINGS" && (isAdmin || isStaff) && (
          <div className="space-y-8 max-w-4xl mx-auto">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#A05AFF]" />
                <span>การตั้งค่าระบบ (System Configuration)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                กำหนดชื่อโรงเรียน Logo ระบบ ชื่อระบบ Icon และวันที่อัปเดตข้อมูลล่าสุด
              </p>
            </div>
            <span className="text-xs font-bold text-[#1BCFB4] bg-[#1BCFB4]/10 px-3 py-1 rounded-xl border border-[#1BCFB4]/20">
              Live Preview Active
            </span>
          </div>

          <form onSubmit={handleSaveSystemSettings} className="space-y-8">
            {/* 1. School Name Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <School className="w-4 h-4 text-[#A05AFF]" />
                <span>1. ตั้งค่าชื่อโรงเรียน & ตัวย่อ (School Name & Acronym)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อโรงเรียน (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolNameTh}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolNameTh: e.target.value })}
                    placeholder="เช่น โรงเรียนพิจิตรปัญญานุกูล"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตัวย่อชื่อโรงเรียน (ภาษาไทย)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolAcronymTh || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolAcronymTh: e.target.value })}
                    placeholder="เช่น พ.จ.ป."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อโรงเรียน (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolNameEn}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolNameEn: e.target.value })}
                    placeholder="เช่น Pichit Panyanukul School"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตัวย่อชื่อโรงเรียน (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolAcronymEn || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolAcronymEn: e.target.value })}
                    placeholder="เช่น PCCC"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>
            </div>

            {/* 2. School Logo Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#A05AFF]" />
                <span>2. ตั้งค่า Logo โรงเรียน (School Logo)</span>
              </h4>

              {/* Custom Logo Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex flex-wrap items-center justify-between gap-1">
                  <span>วาง URL Link รูปภาพ Logo หรือลิงก์แชร์จาก Google Drive:</span>
                  <span className="text-[11px] text-[#A05AFF] font-bold">
                    {settingsForm.schoolLogoUrl && settingsForm.schoolLogoUrl.includes("drive.google.com")
                      ? "✓ ตรวจพบลิงก์ Google Drive (แปลงเป็นรูปภาพอัตโนมัติ)"
                      : "แสดงตัวอย่างรูปภาพทันที"}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settingsForm.schoolLogoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Auto convert Google Drive link directly into stored setting if desired or keep clean
                      setSettingsForm({ ...settingsForm, schoolLogoUrl: val });
                    }}
                    placeholder="https://drive.google.com/file/d/... หรือ https://example.com/logo.png"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                  {settingsForm.schoolLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, schoolLogoUrl: "" })}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      ล้าง URL
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 <strong>คำแนะนำสำหรับ Google Drive:</strong> คัดลอกลิงก์รับลิงก์ที่แชร์ได้ (Share Link) จาก Google Drive มาวางได้ทันที เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-purple-700">https://drive.google.com/file/d/xxxx/view?usp=sharing</code>
                </p>
              </div>

              {/* Instant Live Logo Preview Card */}
              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-purple-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#A05AFF]" />
                    <span>ตัวอย่าง Logo แบบ Real-Time (Live Preview & Scaling)</span>
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                    แสดงผลในระบบทันที
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Large Logo Display */}
                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl border-2 border-[#A05AFF]/30 overflow-hidden bg-white shadow-xs flex items-center justify-center shrink-0 p-1">
                      {settingsForm.schoolLogoUrl ? (
                        <img
                          src={getDirectImageUrl(settingsForm.schoolLogoUrl)}
                          alt="School Logo Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                            const errDiv = (e.target as HTMLElement).nextElementSibling;
                            if (errDiv) errDiv.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`flex flex-col items-center justify-center text-center p-1 ${settingsForm.schoolLogoUrl ? "hidden" : ""}`}>
                        <Building2 className="w-6 h-6 text-slate-400" />
                        <span className="text-[9px] text-rose-500 font-bold mt-1">ยังไม่มี URL Logo</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-800 truncate">
                        {settingsForm.schoolNameTh || "ชื่อโรงเรียน"}
                      </div>
                      {settingsForm.schoolAcronymTh && (
                        <div className="text-[11px] font-extrabold text-[#A05AFF] mt-0.5">
                          ตัวย่อ: {settingsForm.schoolAcronymTh} {settingsForm.schoolAcronymEn ? `(${settingsForm.schoolAcronymEn})` : ""}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono truncate mt-1" title={getDirectImageUrl(settingsForm.schoolLogoUrl)}>
                        {settingsForm.schoolLogoUrl.includes("drive.google.com")
                          ? "✓ แปลงจาก Google Drive แล้ว"
                          : settingsForm.schoolLogoUrl || "กรุณาวาง URL รูปภาพ"}
                      </div>
                    </div>
                  </div>

                  {/* UI Context Simulation */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ตัวอย่างการแสดงผลในเมนูระบบ (Sidebar Preview)
                    </div>
                    <div className="flex items-center gap-2.5 bg-slate-800 p-2 rounded-lg border border-slate-700">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center p-0.5 border border-purple-200/50">
                        {settingsForm.schoolLogoUrl ? (
                          <img
                            src={getDirectImageUrl(settingsForm.schoolLogoUrl)}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-black text-white truncate">
                          {settingsForm.systemNameTh || "ระบบบริหารหอพัก"}
                        </div>
                        <div className="text-[9px] text-purple-300 font-bold truncate">
                          {settingsForm.schoolNameTh} {settingsForm.schoolAcronymTh ? `(${settingsForm.schoolAcronymTh})` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. System Name & Title Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#A05AFF]" />
                <span>3. ตั้งชื่อระบบ (System Name) & Title ของระบบ (System Title)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งชื่อระบบ (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemNameTh}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemNameTh: e.target.value })}
                    placeholder="เช่น ระบบบริหารจัดการหอพักนักเรียน"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งชื่อระบบ (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemNameEn}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemNameEn: e.target.value })}
                    placeholder="เช่น Student Dormitory Management System"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>ตั้งค่า Title ของระบบ (Document / Browser Tab Title - ภาษาไทย)</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemTitleTh || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemTitleTh: e.target.value })}
                    placeholder="เช่น ระบบบริหารจัดการหอพักนักเรียน - โรงเรียนพิจิตรปัญญานุกูล"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 ข้อความนี้จะใช้เป็น Title ของหน้าเว็บที่จะแสดงบนแท็บเบราว์เซอร์ (Browser Tab Title)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งค่า Title ของระบบ (Document / Browser Tab Title - ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemTitleEn || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemTitleEn: e.target.value })}
                    placeholder="เช่น Student Dormitory Management System - Pichit Panyanukul School"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>
            </div>

            {/* 4. System Icon Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#A05AFF]" />
                <span>4. ตั้งค่า Icon ระบบ (System Icon)</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  เลือกไอคอนระบบ แบบตัวอย่างให้เลือก:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[
                    { id: "building", icon: Building2, label: "อาคาร" },
                    { id: "school", icon: School, label: "โรงเรียน" },
                    { id: "home", icon: Home, label: "หอพัก" },
                    { id: "shield", icon: Shield, label: "โล่เกราะ" },
                    { id: "grad", icon: GraduationCap, label: "การศึกษา" },
                    { id: "award", icon: Award, label: "รางวัล" },
                    { id: "crown", icon: Crown, label: "มงกุฎ" },
                    { id: "star", icon: Star, label: "ดาว" }
                  ].map((ic) => {
                    const IconComp = ic.icon;
                    const isSelected = settingsForm.systemIcon === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, systemIcon: ic.id })}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 bg-white ${
                          isSelected
                            ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/30 bg-[#A05AFF]/10 text-[#A05AFF]"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{ic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หรือ วาง URL Link รูปภาพไอคอนระบบ:
                </label>
                <input
                  type="text"
                  value={settingsForm.systemIcon.startsWith("http") ? settingsForm.systemIcon : ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, systemIcon: e.target.value || "building" })}
                  placeholder="https://example.com/icon.png"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                />
              </div>
            </div>

            {/* 5. System Maintenance & Announcement to Users */}
            <div className="space-y-5 bg-gradient-to-br from-amber-50/70 via-orange-50/50 to-amber-50/80 p-5 rounded-2xl border-2 border-amber-300 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
                <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>5. กล่องข้อความแจ้งการปรับปรุงระบบแก่ผู้ใช้ (System Maintenance & Notice)</span>
                </h4>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  📢 ประกาศ & ปรับปรุงระบบ
                </span>
              </div>

              {/* Attendance Pause Switch Card (ทุกหอพัก & แยกตามหอพัก) */}
              <div className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
                settingsForm.isAttendancePaused || (Array.isArray(settingsForm.pausedDormIds) && settingsForm.pausedDormIds.length > 0)
                  ? "bg-rose-50/80 border-rose-400 shadow-xs"
                  : "bg-white border-amber-200"
              }`}>
                {/* 1. Global Pause (ทุกหอพัก) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200/60 pb-3.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      settingsForm.isAttendancePaused
                        ? "bg-rose-500 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {settingsForm.isAttendancePaused ? (
                        <PauseCircle className="w-5 h-5 animate-pulse" />
                      ) : (
                        <PlayCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black ${settingsForm.isAttendancePaused ? "text-rose-900" : "text-slate-800"}`}>
                          1. หยุดการเช็คยอดชั่วคราว "ทุกหอพัก" (Pause All Dorms)
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          settingsForm.isAttendancePaused
                            ? "bg-rose-200 text-rose-800 font-black"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {settingsForm.isAttendancePaused ? "สถานะ: ปิดเช็คยอดทุกหอ" : "สถานะ: เปิดปกติ"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-medium">
                        เมื่อเปิดตัวเลือกนี้ ครูประจำหอพักทุกหอจะไม่สามารถบันทึกการเช็คยอดได้ ใช้เมื่อต้องการ <strong>ปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่</strong>
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 self-start sm:self-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={settingsForm.isAttendancePaused ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const now = new Date();
                        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
                        const timeStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} น.`;

                        setSettingsForm({
                          ...settingsForm,
                          isAttendancePaused: checked,
                          attendancePausedAt: checked ? timeStr : undefined,
                          attendancePausedBy: checked ? currentUser?.name || "ผู้ดูแลระบบ" : undefined,
                          pausedDormIds: checked ? (settingsForm.pausedDormIds || []) : []
                        });
                      }}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-800">
                      {settingsForm.isAttendancePaused ? "หยุดทุกหอพัก" : "เปิดเช็คปกติทุกหอ"}
                    </span>
                  </label>
                </div>

                {/* 2. Per-Dormitory Pause (แยกตามหอพัก) */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>2. หยุดการเช็คยอดชั่วคราว "แยกตามหอพัก" (หอพัก 1 - 6)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {settingsForm.isAttendancePaused ? "(กำลังหยุดทุกหอพักอยู่)" : `หยุดเฉพาะ: ${settingsForm.pausedDormIds?.length || 0} หอพัก`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {dorms.map((dorm) => {
                      const isPausedIndividually = Array.isArray(settingsForm.pausedDormIds) && settingsForm.pausedDormIds.includes(dorm.id);
                      const isDormEffectivelyPaused = Boolean(settingsForm.isAttendancePaused || isPausedIndividually);

                      return (
                        <div
                          key={dorm.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isDormEffectivelyPaused
                              ? "bg-rose-100/70 border-rose-300 text-rose-950 font-bold"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-black block truncate">{dorm.name}</span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {isDormEffectivelyPaused ? "⛔ หยุดเช็คยอด" : "🟢 เปิดเช็คปกติ"}
                            </span>
                          </div>

                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isDormEffectivelyPaused}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const currentList = Array.isArray(settingsForm.pausedDormIds) ? [...settingsForm.pausedDormIds] : [];
                                let nextList: string[];

                                if (settingsForm.isAttendancePaused) {
                                  // Switch off global pause and pause all others except this one if unchecked
                                  if (!checked) {
                                    nextList = dorms.map((d) => d.id).filter((id) => id !== dorm.id);
                                  } else {
                                    nextList = dorms.map((d) => d.id);
                                  }
                                } else {
                                  if (checked) {
                                    nextList = Array.from(new Set([...currentList, dorm.id]));
                                  } else {
                                    nextList = currentList.filter((id) => id !== dorm.id);
                                  }
                                }

                                const now = new Date();
                                const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
                                const timeStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} น.`;

                                setSettingsForm({
                                  ...settingsForm,
                                  isAttendancePaused: false,
                                  pausedDormIds: nextList,
                                  attendancePausedAt: nextList.length > 0 ? timeStr : undefined,
                                  attendancePausedBy: nextList.length > 0 ? currentUser?.name || "ผู้ดูแลระบบ" : undefined
                                });
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pause Reason Field */}
                {(settingsForm.isAttendancePaused || (Array.isArray(settingsForm.pausedDormIds) && settingsForm.pausedDormIds.length > 0)) && (
                  <div className="pt-3 border-t border-rose-200">
                    <label className="block text-xs font-bold text-rose-950 mb-1">
                      ระบุเหตุผลในการหยุดเช็คยอด (แสดงในแถบแจ้งเตือน):
                    </label>
                    <input
                      type="text"
                      value={settingsForm.attendancePauseReason || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, attendancePauseReason: e.target.value })}
                      placeholder="เช่น ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่"
                      className="w-full bg-white border border-rose-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Toggles Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Toggle 1: Auto Popup */}
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  settingsForm.showMaintenancePopup
                    ? "bg-amber-100/70 border-amber-500 shadow-xs"
                    : "bg-white border-amber-200 hover:border-amber-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={settingsForm.showMaintenancePopup ?? false}
                    onChange={(e) => setSettingsForm({ ...settingsForm, showMaintenancePopup: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>เปิดแสดง Auto Popup แจ้งการปรับปรุง</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed font-medium">
                      เมื่อผู้ใช้เข้าสู่ระบบจะแสดงหน้าต่าง Popup แจ้งเตือน <strong>วันละ 1 ครั้งต่อคน</strong>
                    </p>
                  </div>
                </label>

                {/* Toggle 2: Sidebar Box */}
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  settingsForm.showMaintenanceBox
                    ? "bg-amber-100/70 border-amber-500 shadow-xs"
                    : "bg-white border-amber-200 hover:border-amber-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={settingsForm.showMaintenanceBox ?? false}
                    onChange={(e) => setSettingsForm({ ...settingsForm, showMaintenanceBox: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>เปิดแสดงกล่องข้อความปรับปรุงระบบที่เมนูข้าง</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed font-medium">
                      แสดงกล่องข้อความที่แถบเมนูด้านข้าง <strong>ต่อจากกล่องเช็คยอดเวลา 20.00 น.</strong>
                    </p>
                  </div>
                </label>
              </div>

              {/* Maintenance Title */}
              <div>
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  หัวข้อแจ้งการปรับปรุงระบบ / หัวข้อประกาศ:
                </label>
                <input
                  type="text"
                  value={settingsForm.maintenanceTitle ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceTitle: e.target.value })}
                  placeholder="เช่น แจ้งการปรับปรุงระบบหอพักประจำสัปดาห์, ประกาศสำคัญถึงครูประจำหอพัก"
                  className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Maintenance Message Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-amber-950">
                    กล่องข้อความสำหรับแจ้งการปรับปรุงระบบแก่ผู้ใช้:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-800 font-semibold">
                      {(settingsForm.maintenanceMessage || "").length} ตัวอักษร
                    </span>
                    {settingsForm.maintenanceMessage && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, maintenanceMessage: "" })}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                      >
                        ล้างข้อความ
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={settingsForm.maintenanceMessage ?? ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMessage: e.target.value })}
                  placeholder="พิมพ์ข้อความรายละเอียดการปรับปรุงระบบ เช่น:
- ระบบจะทำการปรับปรุงฐานข้อมูลและอัปเดตระบบเช็คยอด
- เพิ่มความเสถียรในการส่งรายงานประจำวัน
- ครูหอพักสามารถบันทึกข้อมูลและใช้งานได้ตามปกติ"
                  className="w-full bg-white border border-amber-300 rounded-xl p-3.5 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed shadow-inner"
                />

                {/* Quick Templates */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>ข้อความตัวอย่าง:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsForm({
                        ...settingsForm,
                        maintenanceTitle: "แจ้งการปรับปรุงและอัปเดตระบบหอพัก",
                        maintenanceMessage: `เรียน คุณครูประจำหอพักและผู้ใช้งานทุกท่าน\nระบบบริหารจัดการหอพักนักเรียนได้รับการอัปเดตเพื่อเพิ่มความเสถียรและความแม่นยำในการเช็คยอดและรายงานผล\n- สามารถเช็คยอดและแนบหลักฐานได้อย่างรวดเร็ว\n- หากพบปัญหาในการใช้งานกรุณาติดต่อผู้ดูแลระบบ`,
                        showMaintenanceBox: true,
                        showMaintenancePopup: true
                      });
                    }}
                    className="text-[10px] bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    + ข้อความอัปเดตระบบทั่วไป
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsForm({
                        ...settingsForm,
                        maintenanceTitle: "แจ้งกำหนดการปิดปรับปรุงระบบชั่วคราว",
                        maintenanceMessage: `ระบบจะมีการปิดปรับปรุงฐานข้อมูลชั่วคราวเพื่อสำรองข้อมูลและเพิ่มประสิทธิภาพ\n- ขอความกรุณาครูประจำหอพักบันทึกเช็คยอดให้เรียบร้อยก่อนเวลา 21.00 น.\n- ระบบจะเปิดให้บริการตามปกติหลังการปรับปรุงเสร็จสิ้น`,
                        showMaintenanceBox: true,
                        showMaintenancePopup: true
                      });
                    }}
                    className="text-[10px] bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    + ข้อความแจ้งปิดปรับปรุงชั่วคราว
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
                      const timeStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} น.`;

                      setSettingsForm({
                        ...settingsForm,
                        isAttendancePaused: true,
                        attendancePausedAt: timeStr,
                        attendancePausedBy: currentUser?.name || "ผู้ดูแลระบบ",
                        attendancePauseReason: "ระบบปิดการเช็คยอดชั่วคราว เพื่อปรับปรุงข้อมูลรายชื่อนักเรียน ย้ายหอพัก และนำเข้านักเรียนใหม่",
                        maintenanceTitle: "แจ้งหยุดการเช็คยอดเพื่อปรับปรุงรายชื่อและย้ายหอพัก",
                        maintenanceMessage: `เรียน ครูประจำหอพักและผู้เกี่ยวข้องทุกท่าน\nระบบขอหยุดการเช็คยอดนักเรียนชั่วคราว เพื่อดำเนินการ:\n1. ลบรายชื่อนักเรียนเดิมที่จบการศึกษาหรือย้ายออก\n2. บันทึกการย้ายหอพักของนักเรียนเดิม\n3. นำเข้าข้อมูลรายชื่อนักเรียนชุดใหม่เข้าสู่ระบบ\nขอความกรุณาครูประจำหอพักงดการเช็คยอดจนกว่าระบบจะเปิดให้บริการตามปกติ`,
                        showMaintenanceBox: true,
                        showMaintenancePopup: true
                      });
                    }}
                    className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    + แจ้งหยุดเช็คยอด (ย้ายหอ/นักเรียนใหม่)
                  </button>
                </div>
              </div>

              {/* Real-time Preview */}
              {(settingsForm.maintenanceMessage || settingsForm.maintenanceTitle) && (
                <div className="p-4 bg-white/90 rounded-2xl border border-amber-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-amber-600" />
                      <span>ตัวอย่างการแสดงผลในระบบ (Live Preview)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {settingsForm.showMaintenancePopup && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                          Popup: เปิด
                        </span>
                      )}
                      {settingsForm.showMaintenanceBox && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                          เมนูข้าง: เปิด
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Preview Sidebar Box */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        1. กล่องข้อความที่เมนูข้าง (Sidebar Box)
                      </span>
                      <div className="p-3 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/15 rounded-2xl border border-amber-400/40 space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 font-black text-amber-950 text-xs">
                          <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{settingsForm.maintenanceTitle || "แจ้งการปรับปรุงระบบ"}</span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed whitespace-pre-line font-medium">
                          {settingsForm.maintenanceMessage || "ไม่มีข้อความ"}
                        </p>
                      </div>
                    </div>

                    {/* Preview Popup Card */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        2. หน้าต่าง Auto Popup (เมื่อเข้าสู่ระบบ)
                      </span>
                      <div className="p-3.5 bg-white rounded-2xl border-2 border-amber-400 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-xs font-black text-gray-900 truncate">
                              {settingsForm.maintenanceTitle || "แจ้งการปรับปรุงระบบ"}
                            </span>
                          </div>
                          <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            วันละ 1 ครั้ง
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-line">
                          {settingsForm.maintenanceMessage || "ไม่มีข้อความ"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-95 text-white font-extrabold text-sm rounded-xl shadow-md shadow-[#A05AFF]/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกการตั้งค่าระบบ</span>
              </button>
            </div>
          </form>
        </div>
      )}


      {/* TAB: Change Password */}
      {activeTab === "CHANGE_PASSWORD" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#A05AFF]" />
              <span>{isAdmin ? "4. เปลี่ยนรหัสผ่าน (Change Password)" : (isStaff ? "3. เปลี่ยนรหัสผ่าน (Change Password)" : "1. เปลี่ยนรหัสผ่าน (Change Password)")}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin
                ? "สิทธิ์ Admin: สามารถเลือกเปลี่ยนรหัสผ่านให้บัญชีผู้ใช้ทุกคนได้ทันทีโดยไม่ต้องยืนยันรหัสเดิม"
                : "สิทธิ์เจ้าหน้าที่ / ครูหอพัก: ยืนยันรหัสผ่านเดิมเพื่อตั้งรหัสผ่านใหม่"}
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            {/* Admin Select Target User */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  เลือกผู้ใช้งานที่ต้องการเปลี่ยนรหัสผ่าน:
                </label>
                <select
                  value={selectedTargetUserId}
                  onChange={(e) => setSelectedTargetUserId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-[#A05AFF]"
                >
                  {sortedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleCategoryName} - ระดับ {u.roleLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target User Info Badge */}
            <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <img
                src={getUserAvatarUrl(users.find((u) => u.id === selectedTargetUserId) || currentUser, dorms)}
                alt="Target User"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-[#A05AFF]/30 border-2 border-white shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-800">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.name}
                </div>
                <div className="text-[11px] text-[#A05AFF] font-bold">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.roleCategoryName} (ระดับ {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.roleLevel})
                </div>
              </div>
            </div>

            {/* Old Password (Not required for Admin) */}
            {!isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รหัสผ่านเดิม <span className="text-rose-500">* (จำเป็นต้องระบุ)</span>
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="ป้อนรหัสผ่านเดิม..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>
            )}

            {/* New Password & Confirm */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ตั้งรหัสผ่านใหม่..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] text-white font-black text-sm rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Key className="w-5 h-5" />
              <span>บันทึกการเปลี่ยนรหัสผ่าน</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: Change Profile Picture */}
      {activeTab === "CHANGE_PROFILE" && (() => {
        const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
        const activeCustomUrl = customAvatarUrl.trim();
        const hasPendingOrSavedAvatar = Boolean(
          profileFilePreview || activeCustomUrl || selectedAvatar.trim()
        );
        const displayedAvatarSrc = profileFilePreview
          ? profileFilePreview
          : activeCustomUrl
          ? (sanitizeSafeImageUrl(activeCustomUrl) || getDefaultAvatarByGender(selectedGender))
          : selectedAvatar.trim()
          ? (sanitizeSafeImageUrl(getDirectImageUrl(selectedAvatar.trim()) || selectedAvatar.trim()) || getDefaultAvatarByGender(selectedGender))
          : getDefaultAvatarByGender(selectedGender);

        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#A05AFF]" />
                  <span>{isAdmin ? "5. เปลี่ยนรูปโปรไฟล์ (Change Profile Picture)" : (isStaff ? "4. เปลี่ยนรูปโปรไฟล์ (Change Profile Picture)" : "2. เปลี่ยนรูปโปรไฟล์ (Change Profile Picture)")}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  อัปโหลดและเก็บรูปโปรไฟล์ไว้บนฐานข้อมูลกลาง (Firestore) หากไม่มีรูปโปรไฟล์ระบบจะใช้รูปตัวอย่างแยกตามเพศอัตโนมัติ
                </p>
              </div>

              <div className="shrink-0">
                {firebaseAuthEmail ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[180px]">Firestore: {firebaseAuthEmail}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await handleGoogleSignInForDb();
                        showNotification("success", "เชื่อมต่อบัญชี Google สำหรับบันทึก Firestore สำเร็จ");
                      } catch (err: any) {
                        showNotification("error", err?.message || "ไม่สามารถเชื่อมต่อ Google ได้");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-600" />
                    <span>เชื่อมต่อ Google เพื่อซิงค์ Firestore</span>
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProfileAvatar} className="space-y-5">
              {/* Admin Select Target User */}
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    เลือกผู้ใช้งานที่ต้องการเปลี่ยนรูปโปรไฟล์:
                  </label>
                  <select
                    value={selectedTargetUserId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedTargetUserId(nextId);
                      const sel = users.find((u) => u.id === nextId);
                      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
                      setProfileSelectedFile(null);
                      setProfileFilePreview(null);
                      setCustomAvatarUrl("");
                      if (sel) {
                        setSelectedAvatar(sel.avatarUrl?.trim() ? sel.avatarUrl.trim() : "");
                        setSelectedGender(inferUserGender(sel, dorms));
                      }
                    }}
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  >
                    {sortedUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.roleCategoryName} - ระดับ {u.roleLevel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Profile Picture Display Box (กล่องแสดงรูปโปรไฟล์) */}
              <div className="bg-gradient-to-br from-slate-50 via-white to-purple-50/50 p-5 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  {/* Large Profile Showcase Box */}
                  <div className="flex flex-col items-center gap-2.5 shrink-0">
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-white p-1.5 border-2 border-[#A05AFF]/30 shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={displayedAvatarSrc}
                        alt={targetUser?.name || "Profile Picture"}
                        className="w-full h-full rounded-xl object-cover"
                      />
                      <span
                        className={`absolute bottom-2 left-2 right-2 text-center text-[10px] font-extrabold px-2 py-0.5 rounded-lg backdrop-blur-xs shadow-xs ${
                          hasPendingOrSavedAvatar
                            ? "bg-[#A05AFF]/90 text-white"
                            : selectedGender === "female"
                            ? "bg-pink-600/85 text-white"
                            : "bg-blue-600/85 text-white"
                        }`}
                      >
                        {hasPendingOrSavedAvatar
                          ? (profileSelectedFile ? "รูปใหม่ (รอบันทึก)" : "รูปโปรไฟล์ Firestore")
                          : `ตัวอย่างระบบ (${getGenderLabel(selectedGender)})`}
                      </span>
                    </div>
                  </div>

                  {/* User Details + Gender + Upload / Delete Buttons */}
                  <div className="flex-1 min-w-0 w-full space-y-4 text-center sm:text-left">
                    <div>
                      <div className="text-base font-black text-slate-900 truncate">
                        {targetUser?.name}
                      </div>
                      <div className="text-xs text-[#A05AFF] font-bold mt-0.5">
                        {targetUser?.roleCategoryName} (ระดับ {targetUser?.roleLevel})
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {hasPendingOrSavedAvatar
                          ? "กำลังใช้รูปโปรไฟล์ที่กำหนดเอง (จัดเก็บใน Firestore)"
                          : `ยังไม่มีรูปโปรไฟล์ — ระบบแสดงรูปตัวอย่าง${getGenderLabel(selectedGender)}ให้อัตโนมัติ`}
                      </p>
                    </div>

                    {/* Gender Selector for System Default Avatar */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        เพศผู้ใช้ (ใช้กำหนดรูปตัวอย่างจากระบบเมื่อไม่มีรูปโปรไฟล์):
                      </label>
                      <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedGender("male")}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            selectedGender === "male"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                          }`}
                        >
                          ชาย (Male)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedGender("female")}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            selectedGender === "female"
                              ? "bg-pink-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                          }`}
                        >
                          หญิง (Female)
                        </button>
                      </div>
                    </div>

                    {/* Upload & Delete Action Buttons */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                      <label
                        className={`px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all flex items-center gap-1.5 ${
                          isSavingProfileAvatar ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{hasPendingOrSavedAvatar ? "เปลี่ยนรูปภาพจากเครื่อง" : "อัปโหลดรูปโปรไฟล์"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLocalFileSelect(e, "PROFILE")}
                          disabled={isSavingProfileAvatar}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleDeleteProfileAvatar}
                        disabled={isSavingProfileAvatar || !hasPendingOrSavedAvatar}
                        className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                          hasPendingOrSavedAvatar && !isSavingProfileAvatar
                            ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer shadow-2xs"
                            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        }`}
                        title={
                          hasPendingOrSavedAvatar
                            ? "ลบรูปโปรไฟล์และกลับไปใช้รูปตัวอย่างตามเพศ"
                            : "ยังไม่มีรูปโปรไฟล์ให้ลบ"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูปโปรไฟล์</span>
                      </button>
                    </div>

                    {profileSelectedFile && (
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-blue-200 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="font-semibold text-slate-700 truncate">ไฟล์ที่เลือก: {profileSelectedFile.name}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold shrink-0">
                            พร้อมบันทึกลง Firestore
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
                            setProfileSelectedFile(null);
                            setProfileFilePreview(null);
                            setSelectedAvatar(targetUser?.avatarUrl?.trim() ? targetUser.avatarUrl.trim() : "");
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="ยกเลิกไฟล์ที่เลือก"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gender Fallback Visual Preview Strip */}
                <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] font-bold text-slate-600">
                    รูปตัวอย่างจากระบบแยกตามเพศ (แสดงอัตโนมัติเมื่อไม่มีรูปโปรไฟล์):
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold ${
                        selectedGender === "male"
                          ? "bg-blue-50 border-blue-200 text-blue-800"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      <img src={getDefaultAvatarByGender("male")} alt="รูปตัวอย่างเพศชาย" className="w-7 h-7 rounded-full object-cover" />
                      <span>เพศชาย</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold ${
                        selectedGender === "female"
                          ? "bg-pink-50 border-pink-200 text-pink-800"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      <img src={getDefaultAvatarByGender("female")} alt="รูปตัวอย่างเพศหญิง" className="w-7 h-7 rounded-full object-cover" />
                      <span>เพศหญิง</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  หรือวางลิงก์รูปภาพ HTTPS URL (ทางเลือก):
                </label>
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => {
                    setCustomAvatarUrl(e.target.value);
                    if (profileSelectedFile) {
                      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
                      setProfileSelectedFile(null);
                      setProfileFilePreview(null);
                    }
                  }}
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingProfileAvatar}
                className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] text-white font-black text-sm rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSavingProfileAvatar ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังบันทึกลง Firestore...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>บันทึกรูปโปรไฟล์ลง Firestore</span>
                  </>
                )}
              </button>
            </form>

            {/* Firestore Profile Pictures Gallery (แสดงรูปทั้งหมดที่มีอยู่ใน Firestore พร้อมอัปโหลดและเลือกลบ) */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#A05AFF]" />
                    <span>รูปภาพทั้งหมดที่มีอยู่ใน Firestore</span>
                    <span className="text-[11px] font-extrabold bg-purple-100 text-[#A05AFF] px-2 py-0.5 rounded-lg">
                      {allFirestoreGalleryImages.length} รูป
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isAdmin || isStaff
                      ? "คลิกที่รูปเพื่อเลือกใช้เป็นรูปโปรไฟล์ หรือติ๊กเลือกหลายรูปเพื่อลบออกจากฐานข้อมูล Firestore"
                      : "คลิกที่รูปเพื่อเลือกใช้เป็นรูปโปรไฟล์ของคุณ"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold rounded-xl cursor-pointer shadow-xs transition-all inline-flex items-center gap-1.5 ${
                      isUploadingGalleryAvatars ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {isUploadingGalleryAvatars ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploadingGalleryAvatars ? "กำลังอัปโหลด..." : "อัปโหลดเข้าคลัง Firestore"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryUploadFiles}
                      disabled={isUploadingGalleryAvatars}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      invalidateFirestoreReadCache("profile_avatars");
                      loadFirestoreAvatars();
                    }}
                    disabled={isLoadingFirestoreAvatars}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                    title="รีเฟรชรายการรูปภาพจาก Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFirestoreAvatars ? "animate-spin" : ""}`} />
                    <span>รีเฟรช</span>
                  </button>
                </div>
              </div>

              {/* Selection & Batch Delete Action Bar (Visible strictly to Level 1 & Level 2) */}
              {(isAdmin || isStaff) && allFirestoreGalleryImages.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedGalleryKeys.length === allFirestoreGalleryImages.length) {
                          setSelectedGalleryKeys([]);
                        } else {
                          setSelectedGalleryKeys(allFirestoreGalleryImages.map((item) => item.key));
                        }
                      }}
                      className="text-[11px] font-bold text-slate-700 hover:text-[#A05AFF] px-2.5 py-1 rounded-lg bg-white border border-slate-200 transition-colors cursor-pointer"
                    >
                      {selectedGalleryKeys.length === allFirestoreGalleryImages.length
                        ? "ยกเลิกเลือกทั้งหมด"
                        : "เลือกทั้งหมด"}
                    </button>
                    {selectedGalleryKeys.length > 0 && (
                      <span className="text-[11px] font-bold text-[#A05AFF]">
                        เลือกแล้ว {selectedGalleryKeys.length} รูป
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={selectedGalleryKeys.length === 0 || isDeletingGalleryAvatars}
                    onClick={() => {
                      const itemsToDelete = allFirestoreGalleryImages.filter((item) =>
                        selectedGalleryKeys.includes(item.key)
                      );
                      if (itemsToDelete.length > 0) {
                        setPendingDeleteGalleryItems(itemsToDelete);
                      }
                    }}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all inline-flex items-center gap-1.5 ${
                      selectedGalleryKeys.length > 0 && !isDeletingGalleryAvatars
                        ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 cursor-pointer shadow-xs"
                        : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบรูปที่เลือก ({selectedGalleryKeys.length})</span>
                  </button>
                </div>
              )}

              {/* Gallery Grid */}
              {isLoadingFirestoreAvatars && allFirestoreGalleryImages.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-[#A05AFF]" />
                  <span>กำลังโหลดรูปภาพทั้งหมดจาก Firestore...</span>
                </div>
              ) : allFirestoreGalleryImages.length === 0 ? (
                <div className="py-10 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-700">
                    ยังไม่มีรูปภาพโปรไฟล์ที่บันทึกอยู่ใน Firestore
                  </div>
                  <p className="text-[11px] text-slate-500">
                    กดปุ่ม &ldquo;อัปโหลดเข้าคลัง Firestore&rdquo; ด้านบน หรืออัปโหลดรูปโปรไฟล์เพื่อเริ่มสร้างคลังรูปภาพ
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {allFirestoreGalleryImages.map((item) => {
                    const isChecked = selectedGalleryKeys.includes(item.key);
                    const isActiveForTarget =
                      !profileFilePreview &&
                      !customAvatarUrl.trim() &&
                      selectedAvatar.trim() === item.imageUrl;

                    return (
                      <div
                        key={item.key}
                        className={`group relative rounded-2xl border-2 p-2 bg-white transition-all flex flex-col gap-2 ${
                          isActiveForTarget
                            ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/20 bg-purple-50/30 shadow-sm"
                            : isChecked
                            ? "border-rose-400 bg-rose-50/30"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        {/* Top Bar: Checkbox + Individual Delete Button (Level 1 & Level 2 only) */}
                        {(isAdmin || isStaff) && (
                          <div className="flex items-center justify-between gap-1">
                            <label
                              className="inline-flex items-center gap-1 cursor-pointer select-none"
                              title="ติ๊กเพื่อเลือกลบรูปภาพ"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleGalleryKeySelection(item.key)}
                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                              />
                              <span className="text-[10px] font-bold text-slate-500">เลือก</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => setPendingDeleteGalleryItems([item])}
                              disabled={isDeletingGalleryAvatars}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="ลบรูปนี้ออกจาก Firestore"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Clickable Image Thumbnail to Select as Profile Avatar */}
                        <button
                          type="button"
                          onClick={() => {
                            if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
                            setProfileSelectedFile(null);
                            setProfileFilePreview(null);
                            setCustomAvatarUrl("");
                            setSelectedAvatar(item.imageUrl);
                            showNotification(
                              "success",
                              `เลือกรูป "${item.label}" แล้ว กด 'บันทึกรูปโปรไฟล์ลง Firestore' เพื่อใช้งาน`
                            );
                          }}
                          className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer focus:outline-none"
                          title="คลิกเพื่อใช้รูปนี้เป็นรูปโปรไฟล์"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          {isActiveForTarget && (
                            <span className="absolute top-1.5 right-1.5 bg-[#A05AFF] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs inline-flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              <span>เลือกอยู่</span>
                            </span>
                          )}
                        </button>

                        {/* Footer Info */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-[11px] font-bold text-slate-800 truncate" title={item.label}>
                            {item.label}
                          </div>
                          {item.usedByNames.length > 0 ? (
                            <div
                              className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md truncate"
                              title={`ใช้อยู่โดย: ${item.usedByNames.join(", ")}`}
                            >
                              ใช้อยู่: {item.usedByNames[0]}
                              {item.usedByNames.length > 1 ? ` +${item.usedByNames.length - 1}` : ""}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-medium truncate">
                              คลังรูป Firestore
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* In-UI Confirmation Modal for Deleting Images from Firestore (Level 1 & Level 2 only) */}
            {(isAdmin || isStaff) && pendingDeleteGalleryItems && pendingDeleteGalleryItems.length > 0 && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-900">
                        ยืนยันการลบรูปภาพออกจาก Firestore
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        คุณต้องการลบรูปภาพจำนวน{" "}
                        <span className="font-black text-rose-600">{pendingDeleteGalleryItems.length}</span>{" "}
                        รูปออกจากฐานข้อมูลกลางอย่างถาวรใช่หรือไม่?
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {pendingDeleteGalleryItems.map((imgItem) => (
                      <div key={imgItem.key} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0">
                        <img src={imgItem.imageUrl} alt={imgItem.label} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>

                  {pendingDeleteGalleryItems.some((i) => i.usedByNames.length > 0) && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold">
                      หมายเหตุ: รูปบางรูปกำลังถูกใช้งานอยู่โดย{" "}
                      {Array.from(new Set(pendingDeleteGalleryItems.flatMap((i) => i.usedByNames))).join(", ")}{" "}
                      เมื่อลบแล้วบัญชีดังกล่าวจะเปลี่ยนกลับไปใช้รูปตัวอย่างตามเพศอัตโนมัติ
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isDeletingGalleryAvatars}
                      onClick={() => setPendingDeleteGalleryItems(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingGalleryAvatars}
                      onClick={handleConfirmDeleteGalleryItems}
                      className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isDeletingGalleryAvatars ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังลบ...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ยืนยันลบรูปออกจาก Firestore</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 2: Manage Staff & Users (Admin & Staff) */}
      {activeTab === "MANAGE_USERS" && (isAdmin || isStaff) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#A05AFF]" />
                <span>2. จัดการเจ้าหน้าที่ & ผู้ใช้</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAdmin
                  ? "สามารถ เพิ่ม ลบ แก้ไข เจ้าหน้าที่ (Level 2), ครูหอพัก (Level 3) และผู้เยี่ยมชม (Level 4) พร้อมจัดการรูปโปรไฟล์บน Firestore"
                  : "สิทธิ์เจ้าหน้าที่ (Level 2) สามารถ เพิ่ม ลบ แก้ไข บัญชีผู้ใช้ครูหอพัก (Level 3) และผู้เยี่ยมชม (Level 4) พร้อมจัดการรูปโปรไฟล์บน Firestore"}
              </p>
            </div>

            <button
              onClick={() => {
                setEditingUser(null);
                setModalSelectedFile(null);
                if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
                setModalFilePreview(null);
                setFormData({
                  name: "",
                  phone: "",
                  gender: "male",
                  roleLevel: isStaff ? 3 : 2,
                  roleCategory: isStaff ? "DORM_TEACHER" : "STAFF",
                  dormId: "",
                  dormPosition: "ครูประจำหอพัก",
                  allowedDormIds: [],
                  avatarUrl: "",
                  password: ""
                });
                setIsAddUserModalOpen(true);
              }}
              className="bg-[#A05AFF] hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isStaff ? "เพิ่มครูหอพักใหม่" : "เพิ่มผู้ใช้/เจ้าหน้าที่ใหม่"}</span>
            </button>

            <button
              onClick={() => {
                setSampleDataTarget("USERS");
                setSampleAuthPassword("");
                setSampleAuthError("");
                setIsDeleteSampleModalOpen(true);
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              title="ลบข้อมูลบัญชีผู้ใช้ตัวอย่าง"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>ลบข้อมูลตัวอย่างผู้ใช้</span>
            </button>
          </div>

          {/* Users List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">รูปไอคอน</th>
                  <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4">ระดับสิทธิ์ (Role Level)</th>
                  <th className="py-3 px-4">สิทธิ์เข้าถึง / หอพักที่เช็ครายชื่อได้</th>
                  <th className="py-3 px-4">สถานะรหัสผ่าน</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedUsers.map((u) => {
                  const dorm = dorms.find((d) => d.id === u.dormId);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <img
                          src={getUserAvatarUrl(u, dorms)}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 mx-auto"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{u.name}</span>
                          {u.phone && u.phone.trim() && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <Phone className="w-2.5 h-2.5" />
                              {u.phone}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>
                            {u.roleLevel === 1
                              ? "ผู้ดูแล"
                              : u.roleLevel === 2
                              ? "เจ้าหน้าที่"
                              : u.roleLevel === 4
                              ? "ผู้เยี่ยมชม"
                              : "ครูหอพัก"}
                          </span>
                          {u.dormPosition && u.roleLevel !== 4 && (
                            <span className="text-purple-600 font-bold">• {u.dormPosition}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            u.roleLevel === 1
                              ? "bg-purple-100 text-purple-800"
                              : u.roleLevel === 2
                              ? "bg-cyan-100 text-cyan-800"
                              : u.roleLevel === 4
                              ? "bg-slate-100 text-slate-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          ระดับ {u.roleLevel} ({u.roleCategoryName})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {u.roleLevel === 4 ? (
                          <span className="text-slate-500 text-xs">ผู้เยี่ยมชม (สิทธิ์ดูตามเมนูที่กำหนด)</span>
                        ) : u.allowedDormIds && u.allowedDormIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.allowedDormIds.map((dId) => {
                              const dObj = dorms.find((d) => d.id === dId);
                              return (
                                <span
                                  key={dId}
                                  className="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-200"
                                >
                                  {dObj ? dObj.name : dId}
                                </span>
                              );
                            })}
                          </div>
                        ) : dorm ? (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                            {dorm.name}
                          </span>
                        ) : u.roleLevel === 3 ? (
                          <span className="text-rose-500 font-bold text-xs">ยังไม่กำหนดหอพัก</span>
                        ) : (
                          <span className="text-gray-500 text-xs">ทุกหอพัก (สิทธิ์ส่วนกลาง)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.hasPassword ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Lock className="w-3 h-3" />
                            <span>ตั้งค่าแล้ว (เข้ารหัส)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>รอตั้งรหัสผ่านครั้งแรก</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(() => {
                            const isStaffRestricted = isStaff && (u.roleLevel === 1 || u.roleLevel === 2);
                            return (
                              <button
                                onClick={() => {
                                  if (isStaffRestricted) {
                                    showNotification("error", "เจ้าหน้าที่ไม่สามารถแก้ไขข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้");
                                    return;
                                  }
                                  setEditingUser(u);
                                  setModalSelectedFile(null);
                                  if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
                                  setModalFilePreview(null);
                                  setFormData({
                                    name: u.name,
                                    phone: u.phone || "",
                                    gender: inferUserGender(u, dorms),
                                    roleLevel: u.roleLevel,
                                    roleCategory: u.roleCategory,
                                    dormId: u.dormId || "",
                                    dormPosition: u.dormPosition || "ครูประจำหอพัก",
                                    allowedDormIds: u.allowedDormIds || (u.dormId ? [u.dormId] : []),
                                    avatarUrl: u.avatarUrl?.trim() ? u.avatarUrl.trim() : "",
                                    password: ""
                                  });
                                  setIsAddUserModalOpen(true);
                                }}
                                disabled={isStaffRestricted}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isStaffRestricted
                                    ? "text-gray-300 bg-gray-100 cursor-not-allowed"
                                    : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                                }`}
                                title={isStaffRestricted ? "เจ้าหน้าที่ไม่สามารถแก้ไขข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้" : "แก้ไขข้อมูล"}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            );
                          })()}

                          {(() => {
                            const isSelf = Boolean(currentUser && u.id === currentUser.id);
                            const level1AdminsCount = users.filter((usr) => usr.roleLevel === 1).length;
                            const isLastLevel1Admin = u.roleLevel === 1 && level1AdminsCount <= 1;
                            const isStaffRestricted = isStaff && (u.roleLevel === 1 || u.roleLevel === 2);
                            const isDeleteDisabled = isSelf || isLastLevel1Admin || isStaffRestricted;

                            let disabledTooltip = "ลบบัญชีผู้ใช้";
                            if (isSelf) {
                              disabledTooltip = "ผู้ที่เข้าสู่ระบบไม่สามารถลบบัญชีของตนเองได้";
                            } else if (isLastLevel1Admin) {
                              disabledTooltip = "ไม่สามารถลบได้ เนื่องจากเป็นผู้ดูแลระดับ 1 คนสุดท้าย";
                            } else if (isStaffRestricted) {
                              disabledTooltip = "เจ้าหน้าที่ไม่สามารถลบข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้";
                            }

                            return (
                              <button
                                onClick={() => handleDeleteUserClick(u)}
                                disabled={isDeleteDisabled}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isDeleteDisabled
                                    ? "text-gray-300 bg-gray-100 cursor-not-allowed"
                                    : "text-rose-600 hover:bg-rose-50 cursor-pointer"
                                }`}
                                title={disabledTooltip}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Access Permissions / Navigation Role Access Control (Admin Level 1 Only) */}
      {activeTab === "PERMISSIONS" && isAdmin && (
        <NavigationPermissionsTab
          systemSettings={settingsForm}
          isAdmin={isAdmin}
          showNotification={showNotification}
          onSavePermissions={(newPerms: RoleNavigationPermissions, guestRequiresLogin: boolean) => {
            const updated: SystemSettings = {
              ...settingsForm,
              navigationPermissions: newPerms,
              guestRequiresLogin
            };
            setSettingsForm(updated);
            if (onUpdateSystemSettings) {
              onUpdateSystemSettings(updated);
            }
          }}
        />
      )}

      {/* TAB: Database Management (Admin & Staff) */}
      {activeTab === "DATABASE" && (isAdmin || isStaff) && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-[#A05AFF]" />
                <span>{isAdmin ? "6. จัดการฐานข้อมูล" : "5. จัดการฐานข้อมูล"}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                สำรองข้อมูล กู้คืนฐานข้อมูลจากไฟล์ JSON และจัดการล้างข้อมูลในระบบ
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Upload Currently Displayed Dataset to Primary Cloud Database (Firestore) */}
                <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 space-y-4 md:col-span-3 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CloudUpload className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-gray-900 text-sm md:text-base flex flex-wrap items-center gap-2">
                          <span>อัพโหลดฐานข้อมูลชุดที่แสดงอยู่ตอนนี้ลงฐานข้อมูลกลาง (Firestore)</span>
                          {firebaseAuthEmail ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                              ✓ Google Auth: {firebaseAuthEmail}
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                              ต้องยืนยันสิทธิ์ Google (domitory@pcccr.ac.th) เพื่อเขียนข้อมูล
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          อัพโหลดข้อมูลทั้งหมดที่แสดงอยู่ในระบบตอนนี้เข้าสู่ Firestore โดยเรียงลำดับความสมบูรณ์ของข้อมูลหอพัก บัญชีผู้ใช้ นักเรียน เรื่องแจ้งอบรม และบันทึกการเช็คยอดนักเรียนทั้งหมด
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleUploadDisplayedDatabase}
                        disabled={isUploadingCurrentDb}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
                      >
                        {isUploadingCurrentDb ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังอัพโหลดลง Firestore...</span>
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-4 h-4" />
                            <span>อัพโหลดชุดข้อมูลปัจจุบันลงฐานข้อมูล</span>
                          </>
                        )}
                      </button>
                      {firebaseAuthEmail && firebaseAuthEmail.toLowerCase() !== "domitory@pcccr.ac.th" && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await handleGoogleSignInForDb();
                            } catch (e: any) {
                              const msg = e?.message || "เปลี่ยนบัญชี Google ไม่สำเร็จ";
                              setUploadCloudError(msg);
                              showNotification("error", msg);
                            }
                          }}
                          className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          สลับบัญชี Google
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Currently Displayed Dataset Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="p-3 rounded-xl bg-purple-50 border-2 border-purple-200">
                      <div className="text-[11px] font-bold text-purple-800">ข้อมูลเช็คยอดนักเรียน</div>
                      <div className="text-lg font-black text-purple-900 mt-0.5">
                        {displayedSnapshot.attendance.length} <span className="text-xs font-bold">รายการ</span>
                      </div>
                      <div className="text-[10px] font-semibold text-purple-700">
                        ครอบคลุม {displayedAttendanceDatesCount} วัน
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500">รายชื่อนักเรียน</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {displayedSnapshot.students.length} <span className="text-xs font-bold">คน</span>
                      </div>
                      <div className="text-[10px] text-slate-500">ทุกหอพัก</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500">หอพักนักเรียน</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {displayedSnapshot.dorms.length} <span className="text-xs font-bold">แห่ง</span>
                      </div>
                      <div className="text-[10px] text-slate-500">โครงสร้างหอพัก</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500">เรื่องแจ้งอบรม</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {displayedSnapshot.notices.length} <span className="text-xs font-bold">เรื่อง</span>
                      </div>
                      <div className="text-[10px] text-slate-500">ประกาศประจำวัน</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500">บัญชีผู้ใช้งาน</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {displayedSnapshot.users.length} <span className="text-xs font-bold">บัญชี</span>
                      </div>
                      <div className="text-[10px] text-slate-500">สิทธิ์การเข้าถึง</div>
                    </div>
                  </div>

                  {uploadCloudError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{uploadCloudError}</span>
                    </div>
                  )}

                  {uploadCloudResult && (
                    <div className="p-3.5 rounded-xl bg-emerald-100/70 border border-emerald-300 text-xs text-emerald-950 space-y-1">
                      <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{uploadCloudResult.message}</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 font-semibold">
                        ตรวจสอบยอดบน Firestore จริงแล้ว: เช็คยอดนักเรียน {uploadCloudResult.verifiedCloudCounts.attendance} รายการ • นักเรียน {uploadCloudResult.verifiedCloudCounts.students} คน • หอพัก {uploadCloudResult.verifiedCloudCounts.dorms} แห่ง • เรื่องแจ้งอบรม {uploadCloudResult.verifiedCloudCounts.notices} เรื่อง • ผู้ใช้ {uploadCloudResult.verifiedCloudCounts.users} บัญชี
                      </div>
                    </div>
                  )}
                </div>

              {/* Backup Export */}
              <div className="p-5 rounded-2xl border border-purple-100 bg-purple-50/50 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">สำรองข้อมูลระบบ (Export Backup)</h4>
                  <p className="text-xs text-gray-500 mt-1">ดาวน์โหลดไฟล์ JSON เก็บไว้เป็นสำรองข้อมูลฉุกเฉิน (รวมข้อมูลหอพัก, รายชื่อครูผู้ดูแลหอพัก, รายชื่อนักเรียน และประวัติการเช็คยอด)</p>
                </div>
                <button
                  onClick={handleExportDb}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์ JSON</span>
                </button>
              </div>

              {/* Restore Import */}
              <div className="p-5 rounded-2xl border border-cyan-100 bg-cyan-50/50 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">กู้คืนฐานข้อมูล (Restore Import)</h4>
                  <p className="text-xs text-gray-500 mt-1">นำเข้าไฟล์ JSON เพื่อกู้คืนข้อมูลหอพัก รายชื่อครูผู้ดูแล นักเรียน และประวัติการเช็คยอด</p>
                </div>
                <label className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center">
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์ JSON เพื่อนำเข้า</span>
                  <input type="file" accept=".json" onChange={handleImportDb} className="hidden" />
                </label>
              </div>

              {/* Dedicated Delete Sample Data Card */}
              <div className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/60 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-md">
                    ลบข้อมูลตัวอย่าง
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">ลบข้อมูลตัวอย่าง (Purge Sample Data)</h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    ล้างข้อมูลตัวอย่างนักเรียน, ข้อมูลหอพักตัวอย่าง, บัญชีผู้ใช้ตัวอย่าง และข้อมูลเช็คยอดตัวอย่าง ออกจากฐานข้อมูล
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSampleDataTarget("ALL");
                    setSampleAuthPassword("");
                    setSampleAuthError("");
                    setIsDeleteSampleModalOpen(true);
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>เปิดหน้าต่างลบข้อมูลตัวอย่าง</span>
                </button>
              </div>

              {/* Clear Database (Admin Only) */}
              {isAdmin ? (
                <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-900 text-sm">ล้างฐานข้อมูลทั้งหมด (Clear DB)</h4>
                    <p className="text-xs text-rose-600 mt-1">
                      ล้างข้อมูลหอพัก, รายชื่อครูผู้ดูแลหอพัก, รายชื่อนักเรียน, ประวัติการเช็คยอด และข้อความแจ้งอบรมทั้งหมด
                    </p>
                  </div>
                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR")}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ล้างฐานข้อมูลทั้งหมด</span>
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 space-y-2 opacity-60">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <h4 className="font-bold text-gray-700 text-sm">ล้างฐานข้อมูลระบบ</h4>
                  <p className="text-xs text-gray-400">เฉพาะผู้ดูแลระบบ (Admin Level 1) เท่านั้นที่ล้างข้อมูลได้</p>
                </div>
              )}
            </div>

            {/* SECTION: บริหารจัดการฐานข้อมูลการเช็คยอด & เรื่องแจ้งอบรม (Backup, Restore, Clear) */}
            <div className="bg-white border-2 border-[#A05AFF]/30 rounded-2xl p-5 md:p-6 space-y-6 mt-6 shadow-sm">
              <div className="border-b border-[#A05AFF]/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#A05AFF] to-[#7B2CBF] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-base md:text-lg flex flex-wrap items-center gap-2">
                      <span>จัดการข้อมูลการเช็คยอด & เรื่องแจ้งอบรม</span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-200">
                        เฉพาะเจ้าหน้าที่ / ผู้ดูแล
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      สำรองข้อมูล, กู้คืนข้อมูล และล้างประวัติการเช็คยอด & เรื่องอบรมนักเรียน (เลือกตามวันที่, เดือน, ช่วงเวลา หรือทั้งหมด)
                    </p>
                  </div>
                </div>

                {/* Sub-tab Pills Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start md:self-auto">
                  <button
                    onClick={() => setAttendanceDbSubTab("BACKUP")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "BACKUP"
                        ? "bg-[#A05AFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>1. สำรองข้อมูล</span>
                  </button>
                  <button
                    onClick={() => setAttendanceDbSubTab("RESTORE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "RESTORE"
                        ? "bg-[#A05AFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>2. กู้คืนข้อมูล</span>
                  </button>
                  <button
                    onClick={() => setAttendanceDbSubTab("CLEAR")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "CLEAR"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>3. ล้างประวัติ</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: 1. สำรองข้อมูลการเช็คยอด + เรื่องอบรม */}
              {attendanceDbSubTab === "BACKUP" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-purple-900 text-sm">
                        1. สำรองข้อมูลการเช็คยอด + เรื่องแจ้งอบรม (Backup Attendance & Notices)
                      </h5>
                      <p className="text-slate-600 leading-relaxed">
                        ส่งออกไฟล์ JSON เพื่อสำรองบันทึกการเช็คยอดประจำวัน รายการสถานะนักเรียน (ออกหอพัก/ลา/ป่วย/หนีหอพัก) พร้อมเรื่องแจ้งอบรมจากหัวหน้างานหอพัก
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      เลือกรูปแบบการสำรองข้อมูล <span className="text-purple-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("DATE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "DATE"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>ตามวันที่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("MONTH")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "MONTH"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>ตามเดือน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("RANGE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "RANGE"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarRange className="w-4 h-4" />
                        <span>ตามช่วงเวลา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("ALL")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "ALL"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>ทั้งหมดในระบบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {attBackupMode === "DATE" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-backup-date" className="block text-xs font-bold text-slate-700">
                          ระบุวันที่ที่ต้องการสำรองข้อมูล <span className="text-purple-600">*</span>
                        </label>
                        <div className="max-w-md">
                          <ThaiDatePicker
                            value={attBackupDate}
                            max={getTodayDateString()}
                            onChange={(val) => setAttBackupDate(val)}
                          />
                        </div>
                      </div>
                    )}

                    {attBackupMode === "MONTH" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-backup-month" className="block text-xs font-bold text-slate-700">
                          ระบุเดือนที่ต้องการสำรองข้อมูล <span className="text-purple-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-backup-month"
                            type="month"
                            value={attBackupMonth}
                            onChange={(e) => setAttBackupMonth(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none"
                          />
                          <div className="bg-purple-100/80 text-purple-900 border border-purple-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-[#A05AFF]" />
                            <span>{formatThaiMonthString(attBackupMonth)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attBackupMode === "RANGE" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            ตั้งแต่วันที่ <span className="text-purple-600">*</span>
                          </label>
                          <ThaiDatePicker
                            value={attBackupStartDate}
                            onChange={(val) => {
                              setAttBackupStartDate(val);
                              if (val > attBackupEndDate) setAttBackupEndDate(val);
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            ถึงวันที่ <span className="text-purple-600">*</span>
                          </label>
                          <ThaiDatePicker
                            value={attBackupEndDate}
                            min={attBackupStartDate}
                            onChange={(val) => setAttBackupEndDate(val)}
                          />
                        </div>
                      </>
                    )}

                    {attBackupMode === "ALL" && (
                      <div className="md:col-span-2 bg-purple-50 text-purple-900 border border-purple-200 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>ระบบจะส่งออกประวัติการเช็คยอดและเรื่องอบรมย้อนหลังทั้งหมดที่บันทึกไว้ในฐานข้อมูล</span>
                      </div>
                    )}

                    {/* Dorm Select */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="att-backup-dorm-select" className="block text-xs font-bold text-slate-700">
                        เลือกหอพักที่ต้องการสำรองข้อมูล
                      </label>
                      <select
                        id="att-backup-dorm-select"
                        value={attBackupDormId}
                        onChange={(e) => setAttBackupDormId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none cursor-pointer"
                      >
                        <option value="ALL">-- สำรองข้อมูลทุกหอพัก (All Dormitories) --</option>
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.teacherName ? `(${d.teacherName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Include Notices Checkbox */}
                    <div className="md:col-span-2 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={attBackupIncludeNotices}
                          onChange={(e) => setAttBackupIncludeNotices(e.target.checked)}
                          className="w-4 h-4 text-[#A05AFF] rounded border-slate-300 focus:ring-[#A05AFF] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          รวมข้อมูลเรื่องแจ้งอบรมนักเรียนจากหัวหน้างานหอพัก (Orientation Notices)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={executeExportAttendance}
                    disabled={isExportingAttendance}
                    className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#7B2CBF] hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isExportingAttendance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังรวบรวมและสร้างไฟล์สำรองข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลดไฟล์สำรองข้อมูลการเช็คยอด + เรื่องอบรม (JSON)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TAB 2: 2. กู้คืนข้อมูลการเช็คยอด + เรื่องอบรม */}
              {attendanceDbSubTab === "RESTORE" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-200 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-indigo-900 text-sm">
                        2. กู้คืนข้อมูลการเช็คยอด + เรื่องแจ้งอบรม (Restore Attendance & Notices)
                      </h5>
                      <p className="text-slate-600 leading-relaxed">
                        นำเข้าไฟล์สำรองข้อมูล JSON เพื่อกู้คืนประวัติการเช็คยอดและเรื่องแจ้งอบรมนักเรียน สามารถเลือกนำเข้าทั้งหมด หรือเลือกเฉพาะวันที่/เดือน/ช่วงเวลาได้
                      </p>
                    </div>
                  </div>

                  {/* File Upload Box */}
                  <div className="bg-slate-50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-5 text-center transition-all">
                    <input
                      id="att-restore-file-input"
                      type="file"
                      accept=".json"
                      onChange={handleAttendanceRestoreFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="att-restore-file-input"
                      className="flex flex-col items-center justify-center cursor-pointer gap-2"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                        <FileJson className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs md:text-sm font-extrabold text-indigo-700 hover:underline">
                          คลิกเพื่อเลือกไฟล์สำรองข้อมูล (.json)
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          รองรับไฟล์สำรองการเช็คยอดเฉพาะส่วน หรือไฟล์สำรองฐานข้อมูลรวมทั้งหมด
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* File Analysis Card */}
                  {attRestoreAnalysis && (
                    <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                        <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>พบข้อมูลในไฟล์สำรอง: {attRestoreFile?.name}</span>
                        </div>
                        {attRestoreAnalysis.exportedAt && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-medium">
                            ส่งออกเมื่อ: {new Date(attRestoreAnalysis.exportedAt).toLocaleDateString("th-TH")}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">ประวัติการเช็คยอด</span>
                          <strong className="text-base font-black text-indigo-600">
                            {attRestoreAnalysis.totalAttendance} รายการ
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">เรื่องแจ้งอบรม</span>
                          <strong className="text-base font-black text-purple-600">
                            {attRestoreAnalysis.totalNotices} เรื่อง
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">จำนวนวันที่บันทึก</span>
                          <strong className="text-base font-black text-slate-800">
                            {attRestoreAnalysis.dates.length} วัน
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">ช่วงวันที่ในไฟล์</span>
                          <strong className="text-[11px] font-bold text-slate-700 block truncate">
                            {attRestoreAnalysis.minDate} ถึง {attRestoreAnalysis.maxDate}
                          </strong>
                        </div>
                      </div>

                      {/* Selective Scope */}
                      <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold text-slate-800">
                          เลือกขอบเขตข้อมูลที่ต้องการกู้คืน <span className="text-indigo-600">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("ALL")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "ALL"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            🌐 ทั้งหมดในไฟล์
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("DATE")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "DATE"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            📅 เฉพาะวันที่
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("MONTH")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "MONTH"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            🗓️ เฉพาะเดือน
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("RANGE")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "RANGE"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            ↔️ ตามช่วงเวลา
                          </button>
                        </div>

                        {attRestoreMode === "DATE" && (
                          <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                            <label className="block text-[11px] font-bold text-slate-700">เลือกวันที่จากไฟล์</label>
                            <select
                              value={attRestoreDate}
                              onChange={(e) => setAttRestoreDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                            >
                              {attRestoreAnalysis.dates.map((d) => (
                                <option key={d} value={d}>
                                  {formatThaiFullDate(d)} ({d})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {attRestoreMode === "MONTH" && (
                          <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                            <label className="block text-[11px] font-bold text-slate-700">ระบุเดือนที่ต้องการกู้คืน</label>
                            <input
                              type="month"
                              value={attRestoreMonth}
                              onChange={(e) => setAttRestoreMonth(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>
                        )}

                        {attRestoreMode === "RANGE" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-indigo-100">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">ตั้งแต่วันที่</label>
                              <ThaiDatePicker
                                value={attRestoreStartDate}
                                onChange={(val) => {
                                  setAttRestoreStartDate(val);
                                  if (val > attRestoreEndDate) setAttRestoreEndDate(val);
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">ถึงวันที่</label>
                              <ThaiDatePicker
                                value={attRestoreEndDate}
                                min={attRestoreStartDate}
                                onChange={(val) => setAttRestoreEndDate(val)}
                              />
                            </div>
                          </div>
                        )}

                        {/* Dorm Filter */}
                        <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                          <label className="block text-[11px] font-bold text-slate-700">เลือกหอพักที่ต้องการกู้คืน</label>
                          <select
                            value={attRestoreDormId}
                            onChange={(e) => setAttRestoreDormId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                          >
                            <option value="ALL">-- กู้คืนทุกหอพัก (All Dormitories) --</option>
                            {dorms.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} {d.teacherName ? `(${d.teacherName})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Restore Strategy */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-xs font-bold text-slate-800">รูปแบบการเขียนข้อมูลลงระบบ</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                              attRestoreStrategy === "UPSERT" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 bg-white"
                            }`}>
                              <input
                                type="radio"
                                name="restoreStrategy"
                                value="UPSERT"
                                checked={attRestoreStrategy === "UPSERT"}
                                onChange={() => setAttRestoreStrategy("UPSERT")}
                                className="mt-0.5 text-indigo-600"
                              />
                              <div>
                                <strong className="text-xs font-bold text-slate-900 block">เพิ่มและอัปเดตทับ (Merge / Upsert)</strong>
                                <span className="text-[11px] text-slate-500 leading-tight block">
                                  เพิ่มข้อมูลใหม่และเขียนทับเฉพาะวันที่ตรงกัน ข้อมูลวันอื่นคงเดิมไว้ (แนะนำ)
                                </span>
                              </div>
                            </label>

                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                              attRestoreStrategy === "REPLACE" ? "border-amber-600 bg-amber-50/50" : "border-slate-200 bg-white"
                            }`}>
                              <input
                                type="radio"
                                name="restoreStrategy"
                                value="REPLACE"
                                checked={attRestoreStrategy === "REPLACE"}
                                onChange={() => setAttRestoreStrategy("REPLACE")}
                                className="mt-0.5 text-amber-600"
                              />
                              <div>
                                <strong className="text-xs font-bold text-amber-900 block">ล้างข้อมูลเดิมก่อนแล้วแทนที่ (Clean & Replace)</strong>
                                <span className="text-[11px] text-amber-700 leading-tight block">
                                  ล้างประวัติเดิมในขอบเขตที่เลือกออกก่อน แล้วแทนที่ด้วยข้อมูลจากไฟล์
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Execute Restore Button with Auth */}
                      <button
                        onClick={() => triggerDbActionWithAuth("RESTORE_ATTENDANCE_NOTICES")}
                        disabled={isRestoringAttendance}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isRestoringAttendance ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังกู้คืนข้อมูลลงสู่ฐานข้อมูล...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>ยืนยันกู้คืนข้อมูลการเช็คยอด & เรื่องแจ้งอบรม (ต้องใส่รหัสผ่าน)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: 3. ล้างประวัติการเช็คยอด + เรื่องอบรม (เลือกตามวันที่, เดือน, ช่วงเวลา, ทั้งหมด) */}
              {attendanceDbSubTab === "CLEAR" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-rose-900 text-sm">
                        3. ล้างประวัติการเช็คยอด + เรื่องแจ้งอบรม (Clear Attendance History)
                      </h5>
                      <p className="text-rose-700 leading-relaxed">
                        ล้างประวัติการเช็คยอดรายวัน ข้อมูลนักเรียนออกหอพัก/ลา/ป่วย และเรื่องแจ้งอบรมนักเรียน โดยเลือกตามวันที่, ตามเดือน, ตามช่วงเวลา หรือทั้งหมด
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      เลือกรูปแบบการล้างข้อมูล <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_DATE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_DATE"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>ตามวันที่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_MONTH")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_MONTH"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>ตามเดือน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_RANGE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_RANGE"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarRange className="w-4 h-4" />
                        <span>ตามช่วงเวลา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("ALL")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "ALL"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>ทั้งหมดในระบบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {attClearMode === "BY_DATE" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-clear-date" className="block text-xs font-bold text-slate-700">
                          ระบุวันที่ที่ต้องการล้างข้อมูล <span className="text-rose-600">*</span>
                        </label>
                        <div className="max-w-md">
                          <ThaiDatePicker
                            value={attClearDate}
                            max={getTodayDateString()}
                            onChange={(val) => setAttClearDate(val)}
                          />
                        </div>
                      </div>
                    )}

                    {attClearMode === "BY_MONTH" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-clear-month" className="block text-xs font-bold text-slate-700">
                          ระบุเดือนที่ต้องการล้างข้อมูล <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-clear-month"
                            type="month"
                            value={attClearMonth}
                            onChange={(e) => setAttClearMonth(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <div className="bg-rose-100/80 text-rose-900 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-rose-600" />
                            <span>{formatThaiMonthString(attClearMonth)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attClearMode === "BY_RANGE" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            ตั้งแต่วันที่ <span className="text-rose-600">*</span>
                          </label>
                          <ThaiDatePicker
                            value={attClearStartDate}
                            onChange={(val) => {
                              setAttClearStartDate(val);
                              if (val > attClearEndDate) setAttClearEndDate(val);
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700">
                            ถึงวันที่ <span className="text-rose-600">*</span>
                          </label>
                          <ThaiDatePicker
                            value={attClearEndDate}
                            min={attClearStartDate}
                            onChange={(val) => setAttClearEndDate(val)}
                          />
                        </div>
                      </>
                    )}

                    {attClearMode === "ALL" && (
                      <div className="md:col-span-2 bg-rose-100 text-rose-950 border border-rose-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>คำเตือน: ระบบจะลบประวัติการเช็คยอดทั้งหมดทุกวันที่เคยบันทึกไว้ในระบบ</span>
                      </div>
                    )}

                    {/* Dorm Select */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="att-clear-dorm-select" className="block text-xs font-bold text-slate-700">
                        เลือกหอพักที่จะล้างข้อมูล
                      </label>
                      <select
                        id="att-clear-dorm-select"
                        value={attClearDormId}
                        onChange={(e) => setAttClearDormId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                      >
                        <option value="ALL">-- ล้างทุกหอพัก (All Dormitories) --</option>
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.teacherName ? `(${d.teacherName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Include Notices Checkbox */}
                    <div className="md:col-span-2 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={attClearIncludeNotices}
                          onChange={(e) => setAttClearIncludeNotices(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          ล้างเรื่องแจ้งอบรมนักเรียนจากหัวหน้างานหอพักในช่วงเวลาที่เลือกด้วย
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Summary Warning */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      การล้างข้อมูลนี้จะลบรายการเช็คยอดและสถานะนักเรียนออกหอพักอย่างถาวร ต้องยืนยันรหัสผ่านก่อนดำเนินการ
                    </span>
                  </div>

                  {/* Clear Button with Auth */}
                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_ATTENDANCE_GRANULAR")}
                    disabled={isClearingAttendance}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isClearingAttendance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังล้างข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>
                          {attClearMode === "BY_DATE"
                            ? `ล้างข้อมูลเช็คยอดประจำวันที่ ${formatThaiFullDate(attClearDate)}`
                            : attClearMode === "BY_MONTH"
                            ? `ล้างข้อมูลเช็คยอดประจำเดือน ${formatThaiMonthString(attClearMonth)}`
                            : attClearMode === "BY_RANGE"
                            ? `ล้างข้อมูลเช็คยอดช่วง ${formatThaiDateRange(attClearStartDate, attClearEndDate)}`
                            : "ล้างข้อมูลเช็คยอดทั้งหมดทุกวัน"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* NEW SECTION: ลบรายชื่อนักเรียนในหอพัก (Clear Student Records) */}
            <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-6 space-y-6 mt-6">
              <div className="border-b border-rose-200/80 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base flex flex-wrap items-center gap-2">
                      <span>ลบรายชื่อนักเรียนในหอพัก</span>
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200">
                        ต้องยืนยันรหัสผ่าน
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      ลบข้อมูลรายชื่อนักเรียนระบุหอพัก (เลือกทีละ 1 หอพัก) หรือ ลบรายชื่อนักเรียนทุกหอพัก
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. ลบรายชื่อนักเรียนเลือกทีละ 1 หอพัก */}
                <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm border-b border-rose-100 pb-2">
                      <Building2 className="w-4 h-4 text-rose-600" />
                      <span>1. ลบรายชื่อนักเรียน (ระบุเลือกทีละ 1 หอพัก)</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ลบรายชื่อนักเรียนทั้งหมดเฉพาะหอพักที่เลือก ออกจากฐานข้อมูล
                    </p>

                    <div>
                      <label htmlFor="clear-students-dorm-select" className="block text-xs font-bold text-slate-700 mb-1">
                        เลือกหอพักที่จะลบรายชื่อนักเรียน <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="clear-students-dorm-select"
                        value={clearStudentsDormId}
                        onChange={(e) => setClearStudentsDormId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                      >
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.teacherName ? `(${d.teacherName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_STUDENTS_DORM")}
                    disabled={isClearingStudents}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {isClearingStudents
                        ? "กำลังลบข้อมูล..."
                        : `ลบรายชื่อนักเรียนใน ${dorms.find((d) => d.id === clearStudentsDormId)?.name || clearStudentsDormId}`}
                    </span>
                  </button>
                </div>

                {/* 2. ลบรายชื่อนักเรียนทุกหอพัก */}
                <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm border-b border-rose-100 pb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>2. ลบรายชื่อนักเรียนทุกหอพัก (ลบนักเรียนทั้งหมด)</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ลบรายชื่อนักเรียนทุกหอพักรวมทั้งระบบออกจากฐานข้อมูล (ใช้เมื่อต้องการตั้งต้นปีการศึกษาใหม่)
                    </p>

                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium leading-relaxed">
                      ⚠️ คำเตือน: รายชื่อนักเรียนทั้งหมดในทุกหอพักจะถูกลบถาวร กรุณายืนยันรหัสผ่านเพื่อดำเนินการ
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_STUDENTS_ALL")}
                    disabled={isClearingStudents}
                    className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isClearingStudents ? "กำลังลบข้อมูล..." : "ลบรายชื่อนักเรียนทุกหอพัก (ลบทั้งหมด)"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 5: การตรวจสอบและซิงค์ข้อมูลจากฐานข้อมูลกลาง */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 space-y-6 mt-6 shadow-xl border border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base flex flex-wrap items-center gap-2">
                      <span>5. ซิงค์ & ตรวจสอบข้อมูลจากฐานข้อมูลกลาง (Live Database Sync)</span>
                      <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                        Live Database Connected
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      ซิงค์และดึงข้อมูลล่าสุดจากฐานข้อมูลกลางระบบเพื่ออัปเดตข้อมูลหอพัก นักเรียน และการเช็คยอด
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 relative z-10">
                {/* Live Data Sync Card */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>ซิงค์และดึงข้อมูลล่าสุดจากฐานข้อมูลกลาง (Sync Live Data)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      กดปุ่มด้านล่างเพื่อดึงข้อมูลล่าสุดทั้งหมดจากฐานข้อมูลกลางระบบมาอัปเดตหน้าจอทันที
                    </p>
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] text-slate-300 space-y-1 font-mono">
                      <div className="text-emerald-400 font-bold">✓ Synchronized Collections:</div>
                      <div>• dorms (ข้อมูลหอพัก)</div>
                      <div>• students (รายชื่อนักเรียน)</div>
                      <div>• users (บัญชีผู้ใช้งานแบบไม่เปิดเผยรหัสผ่าน)</div>
                      <div>• attendance & notices (การเช็คยอด & เรื่องแจ้งอบรม)</div>
                    </div>
                  </div>

                  <button
                    onClick={handleInitializeDefaultDb}
                    disabled={isInitializingDefaultDb}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isInitializingDefaultDb ? "animate-spin" : ""}`} />
                    <span>{isInitializingDefaultDb ? "กำลังดึงข้อมูลล่าสุด..." : "ซิงค์ & ดึงข้อมูลล่าสุดจากฐานข้อมูลกลาง"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* NEW SECTION 6: การส่งออกและเชื่อมต่อซอร์สโค้ดกับ GitHub (Export to GitHub & Git Repo) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 space-y-6 mt-6 shadow-xl border border-slate-700/50 relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 border border-slate-600/50 shadow-inner">
                    <Github className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base flex flex-wrap items-center gap-2">
                      <span>6. ส่งออกและแสดงระบบบน GitHub (Export to GitHub & Repository Guide)</span>
                      <span className="bg-slate-700 text-slate-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-600">
                        Source Code & Version Control
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      สามารถส่งออกซอร์สโค้ดของระบบทั้งหมดเพื่อนำไปสร้าง Repository บน GitHub หรือนำไปปรับแต่งต่อบนเครื่องคอมพิวเตอร์ของคุณ
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Export Options */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      <span>ส่งออกซอร์สโค้ด (Export to GitHub / Download ZIP)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      คุณสามารถดาวน์โหลดหรือส่งออกแอปพลิเคชันนี้ผ่านเมนู <strong className="text-amber-300">Settings</strong> ของ AI Studio หรือใช้คำสั่ง Git เพื่อเชื่อมต่อไปยัง GitHub Repository ของคุณ
                    </p>
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] text-slate-300 space-y-1 font-mono">
                      <div className="text-emerald-400 font-bold">✓ Included Files for GitHub & Firebase:</div>
                      <div>• /src & firebase-applet-config.json (Project: {FIREBASE_PROJECT_ID})</div>
                      <div>• Firebase Database ID: {FIREBASE_DATABASE_ID}</div>
                      <div className="text-amber-300 font-sans pt-1">
                        * สำคัญสำหรับ GitHub Pages: ต้องเพิ่มโดเมน <code className="bg-black/60 px-1 rounded">&lt;username&gt;.github.io</code> ใน Firebase Authentication &rarr; Settings &rarr; Authorized domains
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsGithubModalOpen(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md border border-slate-600 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Github className="w-4 h-4 text-amber-300" />
                    <span>คำแนะนำวิธีนำโครงการขึ้น GitHub Repository</span>
                  </button>
                </div>

                {/* Git Quick Push Guide */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <GitBranch className="w-4 h-4 text-amber-400" />
                      <span>คำสั่ง Terminal สำหรับ Push ขึ้น GitHub</span>
                    </div>
                    <div className="bg-black/60 p-3 rounded-xl border border-white/10 text-[11px] font-mono text-emerald-300 space-y-1">
                      <div>git init</div>
                      <div>git add .</div>
                      <div>git commit -m "Initial commit - Student Counting System"</div>
                      <div>git branch -M main</div>
                      <div>git remote add origin https://github.com/your-user/repo.git</div>
                      <div>git push -u origin main</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`);
                      showNotification("success", "คัดลอกชุดคำสั่ง Git สำหรับ Push ขึ้น GitHub เรียบร้อยแล้ว");
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกคำสั่ง Git Push All</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

      {/* Add / Edit User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-up">
            <h3 className="text-base font-bold text-gray-900">
              {editingUser ? "แก้ไขข้อมูลผู้ใช้/เจ้าหน้าที่" : "เพิ่มผู้ใช้/เจ้าหน้าที่ใหม่"}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อ - นามสกุล *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น ครูสมชาย ใจดี"
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>เบอร์โทรศัพท์ติดต่อ</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none font-mono focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ระดับสิทธิ์ (Level)</label>
                  <select
                    value={formData.roleLevel}
                    onChange={(e) => {
                      const level = Number(e.target.value);
                      let category: "ADMIN" | "STAFF" | "DORM_TEACHER" | "GUEST" = "STAFF";
                      if (level === 1) category = "ADMIN";
                      else if (level === 3) category = "DORM_TEACHER";
                      else if (level === 4) category = "GUEST";
                      setFormData({ ...formData, roleLevel: level, roleCategory: category });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value={1} disabled={isStaff}>ระดับ 1 - ผู้ดูแล (Admin) {isStaff ? "(เฉพาะผู้ดูแลเท่านั้น)" : ""}</option>
                    <option value={2} disabled={isStaff}>ระดับ 2 - เจ้าหน้าที่ (Staff) {isStaff ? "(เฉพาะผู้ดูแลเท่านั้น)" : ""}</option>
                    <option value={3}>ระดับ 3 - ครูหอพัก (Teacher)</option>
                    <option value={4}>ระดับ 4 - ผู้เยี่ยมชม (Visitor / Guest)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {editingUser ? "กำหนดรหัสผ่านใหม่ (ไม่บังคับ)" : "รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "เว้นว่างไว้หากไม่เปลี่ยน..." : "อย่างน้อย 6 ตัวอักษร หรือเว้นว่างให้ผู้ใช้ตั้งเอง"}
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>

              {formData.roleLevel === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ตำแหน่งประจำหอพัก</label>
                    <select
                      value={formData.dormPosition || "ครูประจำหอพัก"}
                      onChange={(e) => setFormData({ ...formData, dormPosition: e.target.value as any })}
                      className="w-full bg-gray-50 border border-gray-300 text-xs text-purple-900 font-extrabold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    >
                      <option value="ครูประธานหอพัก">1. ครูประธานหอพัก</option>
                      <option value="ครูรองประธานหอพัก">2. ครูรองประธานหอพัก</option>
                      <option value="ครูหัวหน้าหอพัก">3. ครูหัวหน้าหอพัก</option>
                      <option value="ครูประจำหอพัก">4. ครูประจำหอพัก</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">หอพักที่รับผิดชอบหลัก</label>
                    <select
                      value={formData.dormId}
                      onChange={(e) => {
                        const dId = e.target.value;
                        let updatedAllowed = formData.allowedDormIds;
                        if (dId && !updatedAllowed.includes(dId)) {
                          updatedAllowed = [...updatedAllowed, dId];
                        }
                        setFormData({ ...formData, dormId: dId, allowedDormIds: updatedAllowed });
                      }}
                      className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none font-bold"
                    >
                      <option value="">-- ยังไม่กำหนดหอพัก --</option>
                      {dorms.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Multi-Dorm Access Selection (Hidden for Level 4 Visitor) */}
              {formData.roleLevel !== 4 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#A05AFF]" />
                  <span>สิทธิ์การเช็ครายชื่อนักเรียนในหอพัก ( Allowed Dormitories )</span>
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  กำหนดหอพักที่ผู้ใช้ท่านนี้มีสิทธิ์เลือกเช็คยอดนักเรียนได้ในระบบ
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <label className="flex items-center gap-2 pb-2 border-b border-gray-200 text-xs font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dorms.length > 0 && formData.allowedDormIds.length === dorms.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, allowedDormIds: dorms.map((d) => d.id) });
                        } else {
                          setFormData({ ...formData, allowedDormIds: [] });
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>อนุญาตให้เช็คยอดได้ทุกหอพัก ( All Dormitories )</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {dorms.map((d) => {
                      const isChecked = formData.allowedDormIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-purple-100 border-purple-300 text-purple-900"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let updated: string[];
                              if (e.target.checked) {
                                updated = [...formData.allowedDormIds, d.id];
                              } else {
                                updated = formData.allowedDormIds.filter((id) => id !== d.id);
                              }
                              setFormData({ ...formData, allowedDormIds: updated });
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}

              {/* Gender Selector & Profile Picture Box */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    เพศผู้ใช้ (ใช้แสดงรูปโปรไฟล์ตัวอย่างจากระบบเมื่อไม่มีรูปภาพ)
                  </label>
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "male" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formData.gender === "male"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-white/70"
                      }`}
                    >
                      ชาย (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "female" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formData.gender === "female"
                          ? "bg-pink-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-white/70"
                      }`}
                    >
                      หญิง (Female)
                    </button>
                  </div>
                </div>

                {/* Profile Picture Display Box inside Modal */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">กล่องแสดงรูปโปรไฟล์ (เก็บบน Firestore)</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      (modalFilePreview || formData.avatarUrl.trim())
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {(modalFilePreview || formData.avatarUrl.trim())
                        ? "มีรูปโปรไฟล์"
                        : `ตัวอย่างระบบ (${getGenderLabel(formData.gender)})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <img
                      src={
                        modalFilePreview ||
                        (formData.avatarUrl.trim()
                          ? (sanitizeSafeImageUrl(getDirectImageUrl(formData.avatarUrl.trim()) || formData.avatarUrl.trim()) || getDefaultAvatarByGender(formData.gender))
                          : getDefaultAvatarByGender(formData.gender))
                      }
                      alt="Current Avatar"
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#A05AFF]/30 border-2 border-white shadow-xs shrink-0 bg-white"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{(modalFilePreview || formData.avatarUrl.trim()) ? "เปลี่ยนรูปภาพ" : "เลือกรูปจากเครื่อง"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLocalFileSelect(e, "MODAL")}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => clearSelectedFile("MODAL")}
                          disabled={!modalFilePreview && !formData.avatarUrl.trim()}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border inline-flex items-center gap-1 transition-all ${
                            (modalFilePreview || formData.avatarUrl.trim())
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer"
                              : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบรูป</span>
                        </button>
                      </div>

                      <input
                        type="url"
                        value={modalSelectedFile ? "" : formData.avatarUrl}
                        onChange={(e) => {
                          if (modalSelectedFile) {
                            if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
                            setModalSelectedFile(null);
                            setModalFilePreview(null);
                          }
                          setFormData({ ...formData, avatarUrl: e.target.value });
                        }}
                        placeholder="หรือวาง URL รูปภาพ HTTPS (ไม่บังคับ)..."
                        className="w-full bg-white border border-slate-300 text-[11px] text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-[#A05AFF] outline-none"
                      />
                    </div>
                  </div>

                  {modalSelectedFile && (
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-blue-200 text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <span className="font-semibold text-slate-700 truncate">รูปที่เลือก: {modalSelectedFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => clearSelectedFile("MODAL")}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded-md transition-colors cursor-pointer shrink-0"
                        title="ยกเลิกไฟล์ที่เลือก"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#A05AFF] hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Authentication Confirmation Modal for DB & Attendance Actions */}
      {dbAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-purple-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#A05AFF] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  ยืนยันรหัสผ่านเพื่อดำเนินการ (Password Required)
                </h3>
                <p className="text-xs text-purple-700 font-bold mt-0.5">
                  {dbAuthAction === "EXPORT" && "การสำรองข้อมูลระบบ (Export Backup)"}
                  {dbAuthAction === "IMPORT" && "การกู้คืนฐานข้อมูล (Restore Import)"}
                  {dbAuthAction === "CLEAR" && "การล้างฐานข้อมูลระบบทั้งหมด (Clear DB)"}
                  {dbAuthAction === "CLEAR_ATTENDANCE_DATE" && `ล้างข้อมูลเช็คยอด ประจำวันที่ ${clearDate}`}
                  {dbAuthAction === "CLEAR_ATTENDANCE_ALL" && "ล้างข้อมูลเช็คยอดทั้งหมด (ทุกวันย้อนหลัง)"}
                  {dbAuthAction === "CLEAR_STUDENTS_DORM" && "ลบรายชื่อนักเรียนในหอพัก"}
                  {dbAuthAction === "CLEAR_STUDENTS_ALL" && "ลบรายชื่อนักเรียนทุกหอพัก"}
                  {dbAuthAction === "DELETE_USER" && `ลบบัญชีผู้ใช้ "${targetUserToDelete?.name}"`}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {dbAuthAction === "DELETE_USER"
                ? `คุณกำลังจะลบบัญชีผู้ใช้ "${targetUserToDelete?.name}" ออกจากระบบ กรุณากรอกรหัสผ่านผู้ดูแลระบบเพื่อยืนยันการลบ`
                : "กรุณากรอกรหัสผ่านของ เจ้าหน้าที่ หรือ ผู้ดูแลระบบ เพื่อยืนยันความปลอดภัยก่อนดำเนินการ"}
            </p>

            <form onSubmit={handleVerifyAdminPassAndExecute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  กรอกรหัสผ่านยืนยัน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminAuthPassword}
                    onChange={(e) => {
                      setAdminAuthPassword(e.target.value);
                      setAdminAuthError("");
                    }}
                    placeholder="ป้อนรหัสผ่านเจ้าหน้าที่ / ผู้ดูแล..."
                    className="w-full bg-purple-50/50 border border-purple-300 text-sm font-bold text-gray-900 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    autoFocus
                    required
                  />
                  <Lock className="w-4 h-4 text-purple-400 absolute right-3 top-3" />
                </div>
                {adminAuthError && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{adminAuthError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setDbAuthModalOpen(false);
                    setPendingImportJson(null);
                    setTargetUserToDelete(null);
                    setAdminAuthPassword("");
                    setAdminAuthError("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] text-white font-black text-xs rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>ยืนยันข้อมูล & ดำเนินการ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Sample Data Custom Modal */}
      {isDeleteSampleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-400 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    ลบข้อมูลตัวอย่าง (Purge Sample Data)
                  </h3>
                  <p className="text-xs text-amber-700 font-bold mt-0.5">
                    เลือกรายการข้อมูลตัวอย่างที่ต้องการล้างออกจากระบบ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteSampleModalOpen(false);
                  setSampleAuthPassword("");
                  setSampleAuthError("");
                }}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteDeleteSampleData} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  เลือกหมวดหมู่ข้อมูลตัวอย่างที่ต้องการลบ:
                </label>

                <div className="space-y-2 text-xs">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sampleDataTarget === "ALL"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sampleDataTarget"
                      value="ALL"
                      checked={sampleDataTarget === "ALL"}
                      onChange={() => setSampleDataTarget("ALL")}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold flex items-center gap-1.5">
                        <span>🔥 ลบข้อมูลตัวอย่างทั้งหมดในระบบ (All Data)</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">แนะนำ</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-normal">
                        ล้างข้อมูลนักเรียนตัวอย่าง, หอพักตัวอย่าง, บัญชีผู้ใช้ตัวอย่าง, ประวัติเช็คยอด และเรื่องแจ้งอบรม
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sampleDataTarget === "STUDENTS"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sampleDataTarget"
                      value="STUDENTS"
                      checked={sampleDataTarget === "STUDENTS"}
                      onChange={() => setSampleDataTarget("STUDENTS")}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold">🎓 ลบเฉพาะข้อมูลนักเรียนตัวอย่าง (Students Only)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-normal">
                        ล้างรายชื่อนักเรียนตัวอย่างทุกหอพัก เพื่อเตรียมนำเข้าไฟล์ Excel ข้อมูลจริง
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sampleDataTarget === "USERS"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sampleDataTarget"
                      value="USERS"
                      checked={sampleDataTarget === "USERS"}
                      onChange={() => setSampleDataTarget("USERS")}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold">👥 ลบเฉพาะบัญชีผู้ใช้ตัวอย่าง (Users Only)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-normal">
                        ล้างรายชื่อครูหอพักและเจ้าหน้าที่ตัวอย่าง
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sampleDataTarget === "DORMS"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sampleDataTarget"
                      value="DORMS"
                      checked={sampleDataTarget === "DORMS"}
                      onChange={() => setSampleDataTarget("DORMS")}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold">🏢 ลบเฉพาะข้อมูลหอพักตัวอย่าง (Dormitories Only)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-normal">
                        ล้างข้อมูลหอพักตัวอย่างเพื่อตั้งค่าหอพักจริง
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sampleDataTarget === "ATTENDANCE_NOTICES"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sampleDataTarget"
                      value="ATTENDANCE_NOTICES"
                      checked={sampleDataTarget === "ATTENDANCE_NOTICES"}
                      onChange={() => setSampleDataTarget("ATTENDANCE_NOTICES")}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-extrabold">📋 ลบข้อมูลเช็คยอด & เรื่องแจ้งอบรมตัวอย่าง (Attendance & Notices)</div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-normal">
                        ล้างบันทึกการเช็คยอดและข้อความแจ้งอบรมตัวอย่างทั้งหมด
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {(sampleDataTarget === "ALL" || sampleDataTarget === "USERS") && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepAdminAccount}
                      onChange={(e) => setKeepAdminAccount(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>คงบัญชีผู้ดูแลระบบ (Admin Level 1) ไว้ เพื่อให้ใช้งานระบบต่อได้ทันที</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  กรอกรหัสผ่านเพื่อยืนยันความปลอดภัย <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={sampleAuthPassword}
                    onChange={(e) => {
                      setSampleAuthPassword(e.target.value);
                      setSampleAuthError("");
                    }}
                    placeholder="ป้อนรหัสผ่านเจ้าหน้าที่ / ผู้ดูแล..."
                    className="w-full bg-amber-50/50 border border-amber-300 text-sm font-bold text-gray-900 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <Lock className="w-4 h-4 text-amber-500 absolute right-3 top-3" />
                </div>
                {sampleAuthError && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{sampleAuthError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteSampleModalOpen(false);
                    setSampleAuthPassword("");
                    setSampleAuthError("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isDeletingSampleData}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isDeletingSampleData ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังลบข้อมูลตัวอย่าง...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>ยืนยันการลบข้อมูลตัวอย่าง</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Export & Repository Modal */}
      {isGithubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-700 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 border border-slate-600">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    ขั้นตอนการนำโครงการระบบเช็คยอดนักเรียนหอพักขึ้น GitHub
                  </h3>
                  <p className="text-xs text-amber-300 font-medium">
                    Exporting & Publishing Source Code to GitHub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGithubModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>วิธีแก้ปัญหา "หน้าขาว" และ "เชื่อมต่อฐานข้อมูล Firestore ไม่ได้" บน GitHub Pages</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  <strong className="text-amber-300">✓ 1. การแสดงผลหน้าเว็บ:</strong> ตั้งค่า <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-300">base: './'</code> ใน <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-300">vite.config.ts</code> และเพิ่มไฟล์ <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">public/404.html</code>, <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">.nojekyll</code> แล้ว<br />
                  <strong className="text-emerald-300">✓ 2. GitHub Actions:</strong> ตั้งค่า Repository <strong className="text-white">Settings &rarr; Pages &rarr; Source</strong> เป็น <strong className="text-amber-300">"GitHub Actions"</strong><br />
                  <strong className="text-emerald-300">✓ 3. การเชื่อมต่อฐานข้อมูล Firestore บน GitHub Pages:</strong> ผู้เยี่ยมชมสามารถเปิดเข้าชมและดึงข้อมูลจากฐานข้อมูลกลาง Firestore ได้ทันทีโดยไม่ต้องเชื่อมต่อบัญชี Google (หากต้องการบันทึก/อัพโหลดข้อมูลระดับผู้ดูแลระบบ จึงใช้การยืนยันสิทธิ์ผู้ดูแลระบบ <code className="bg-black/50 px-1 rounded text-white">domitory@pcccr.ac.th</code> และเพิ่มโดเมน GitHub Pages ใน Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains)
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>วิธีที่ 1: ใช้ฟังก์ชัน Export บน AI Studio (แนะนำวิธีที่ง่ายที่สุด)</span>
                </div>
                <p className="text-slate-300">
                  คลิกที่เมนู <strong className="text-white bg-slate-700 px-2 py-0.5 rounded">Settings / Export</strong> ตรงมุมบนหรือเมนูตั้งค่าของระบบ AI Studio แล้วเลือก <strong className="text-amber-300">"Export to GitHub"</strong> ระบบจะสร้าง Repository บนบัญชี GitHub ของคุณโดยอัตโนมัติ
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-white text-sm">วิธีที่ 2: ดาวน์โหลดไฟล์ ZIP และ Push ขึ้น GitHub ผ่าน Terminal</div>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
                  <li>ดาวน์โหลดไฟล์โครงการเป็น ZIP แล้วแตกไฟล์ลงบนคอมพิวเตอร์ของคุณ</li>
                  <li>
                    เปิดเว็บไซต์ <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">GitHub Create New Repository</a> และสร้าง Repository ใหม่
                  </li>
                  <li>เปิด Terminal หรือ Command Prompt ในโฟลเดอร์โครงการ แล้วพิมพ์คำสั่งดังนี้:</li>
                </ol>
              </div>

              <div className="bg-black/70 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">คำสั่ง Git Terminal (Command Line)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`);
                      showNotification("success", "คัดลอกคำสั่ง Git เรียบร้อยแล้ว");
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>คัดลอกคำสั่งทั้งหมด</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950 p-3 rounded-lg border border-white/5 overflow-x-auto leading-relaxed">
{`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`}</pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsGithubModalOpen(false)}
                className="px-5 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                เข้าใจแล้ว และ ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
