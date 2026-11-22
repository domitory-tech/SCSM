import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyAttendance, UserProfile, SystemSettings } from "./types";
import { DEFAULT_SYSTEM_SETTINGS, getTodayDateString } from "./utils/dateUtils";
import { matchStudentToDorm } from "./utils/dormUtils";
import { isMenuAccessible, getFirstAccessibleMenuId } from "./utils/permissionUtils";
import { clearSessionUser, getSessionUser, setSessionUser } from "./utils/session";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar } from "./components/layout/Sidebar";
import { LoginModal } from "./components/auth/LoginModal";
import { DashboardView } from "./components/dashboard/DashboardView";
import { AttendanceCheckView } from "./components/attendance/AttendanceCheckView";
import { NoticeManagerView } from "./components/notices/NoticeManagerView";
import { StudentManagementView } from "./components/students/StudentManagementView";
import { StudentSearchView } from "./components/students/StudentSearchView";
import { DailyReportView } from "./components/reports/DailyReportView";
import { DormsManagementView } from "./components/dorms/DormsManagementView";
import { DormLayoutView } from "./components/dorms/DormLayoutView";
import { UserAndDatabaseView } from "./components/users/UserAndDatabaseView";
import { SpecialStatusManagerView } from "./components/attendance/SpecialStatusManagerView";
import { FingerprintCompareView } from "./components/attendance/FingerprintCompareView";
import { MaintenancePopupModal } from "./components/common/MaintenancePopupModal";
import { sanitizeUserForClient, stripDangerousKeys } from "./utils/security";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import {
  auth,
  checkFirebaseConnection,
  ensureFirebaseAuthSession,
  FIREBASE_PROJECT_ID,
  FIRESTORE_PRICING_URL,
  FIRESTORE_QUOTA_UPGRADE_URL,
  FirestoreAccessIssue,
  subscribeFirestoreAccessIssue
} from "./lib/firebase";
import { invalidateFirestoreReadCache } from "./services/api";
import {
  useAddDormMutation,
  useAddStudentMutation,
  useAllAttendanceRecordsQuery,
  useAttendanceQuery,
  useBatchDeleteStudentsMutation,
  useBatchTransferStudentsMutation,
  useBulkHomeBreakMutation,
  useClearStudentsMutation,
  useDailyReportQuery,
  useDeleteNoticeMutation,
  useDeleteStudentMutation,
  useDormsQuery,
  useExportGoogleSheetsMutation,
  useImportStudentsMutation,
  useNoticesQuery,
  usePostNoticeMutation,
  useSaveAttendanceMutation,
  useStudentsQuery,
  useSystemSettingsQuery,
  useUpdateDormMutation,
  useUpdateNoticeMutation,
  useUpdateStudentMutation,
  useUpdateSystemSettingsMutation,
  useUsersQuery,
  useBatchSetAttendanceDateRangeMutation,
  useRealtimePrimaryDatabaseSync
} from "./services/useDormQueries";

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const EMPTY_TODAY_ATTENDANCE: Record<string, DailyAttendance> = {};

function MainAppContent() {
  const [dbConnectionState, setDbConnectionState] = useState<"checking" | "online" | "offline" | "quota_exceeded">(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "checking"
  );
  const [isRetryingConnection, setIsRetryingConnection] = useState<boolean>(false);
  const [firestoreAccessIssue, setFirestoreAccessIssueState] = useState<FirestoreAccessIssue | null>(null);
  const [isAuthBannerDismissed, setIsAuthBannerDismissed] = useState<boolean>(false);

  const { data: dbSettings } = useSystemSettingsQuery(dbConnectionState === "online");
  const updateSystemSettingsMutation = useUpdateSystemSettingsMutation();

  // System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem("dorm_system_settings");
      if (saved) {
        const parsed = stripDangerousKeys(JSON.parse(saved));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { ...DEFAULT_SYSTEM_SETTINGS, ...parsed };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SYSTEM_SETTINGS;
  });

  // Sync settings from central database when query resolves
  React.useEffect(() => {
    if (dbSettings) {
      const cleanSettings = stripDangerousKeys(dbSettings);
      setSystemSettings(cleanSettings);
      try {
        localStorage.setItem("dorm_system_settings", JSON.stringify(cleanSettings));
      } catch (e) {}
    }
  }, [dbSettings]);

  // Update browser tab document title dynamically
  React.useEffect(() => {
    const title = systemSettings.systemTitleTh || systemSettings.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน";
    document.title = title;
  }, [systemSettings.systemTitleTh, systemSettings.systemNameTh]);

  const handleUpdateSystemSettings = async (newSettings: SystemSettings) => {
    setSystemSettings(newSettings);
    try {
      localStorage.setItem("dorm_system_settings", JSON.stringify(newSettings));
    } catch (e) {
      console.error(e);
    }
    await updateSystemSettingsMutation.mutateAsync(newSettings);
  };

  // Current user state (Restored from Session Cookie / sessionStorage so user stays logged in until browser is closed)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getSessionUser());
  const [activeTab, setActiveTab] = useState<string>(() =>
    getFirstAccessibleMenuId(getSessionUser(), systemSettings.navigationPermissions)
  );
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [targetTabPrompt, setTargetTabPrompt] = useState<string>("");
  const [pendingTargetTabId, setPendingTargetTabId] = useState<string>("");

  // System Maintenance Auto Popup State (Shown 1 time per day)
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);

  const verifyDatabaseConnectivity = React.useCallback(async (showSpinner: boolean = false) => {
    if (showSpinner) {
      setIsRetryingConnection(true);
    }
    try {
      await ensureFirebaseAuthSession();
      const status = await checkFirebaseConnection();
      if (status.isConnected) {
        if (status.settings) {
          const cleanSettings = stripDangerousKeys({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...status.settings
          }) as SystemSettings;
          setSystemSettings(cleanSettings);
          try {
            localStorage.setItem("dorm_system_settings", JSON.stringify(cleanSettings));
          } catch {}
          queryClient.setQueryData(["systemSettings"], cleanSettings);
        }
        setDbConnectionState("online");
        if (showSpinner) {
          invalidateFirestoreReadCache();
          queryClient.invalidateQueries();
        }
      } else if (status.quotaExceeded) {
        setDbConnectionState("quota_exceeded");
      } else {
        setDbConnectionState("offline");
      }
    } finally {
      if (showSpinner) {
        setIsRetryingConnection(false);
      }
    }
  }, []);

  React.useEffect(() => {
    verifyDatabaseConnectivity(false);

    const handleOnline = () => {
      verifyDatabaseConnectivity(true);
    };
    const handleOffline = () => {
      setDbConnectionState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubIssue = subscribeFirestoreAccessIssue((issue) => {
      setFirestoreAccessIssueState(issue);
      if (issue?.code === "ANONYMOUS_AUTH_DISABLED") {
        setIsAuthBannerDismissed(false);
      }
      if (issue?.code === "QUOTA_EXCEEDED") {
        setDbConnectionState("quota_exceeded");
      } else if (issue?.code === "OFFLINE") {
        setDbConnectionState("offline");
      }
    });

    let lastUid: string | null | undefined = auth.currentUser?.uid ?? null;
    const unsubAuth = auth.onAuthStateChanged((fbUser) => {
      const nextUid = fbUser ? fbUser.uid : null;
      const upgradedToGoogle = Boolean(fbUser?.emailVerified);
      if (lastUid !== nextUid && upgradedToGoogle) {
        invalidateFirestoreReadCache();
        queryClient.invalidateQueries();
      }
      lastUid = nextUid;
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubIssue();
      unsubAuth();
    };
  }, [verifyDatabaseConnectivity]);

  // Active check state
  const [selectedDormId, setSelectedDormId] = useState<string>("dorm-1");
  const todayStr = getTodayDateString();
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(todayStr);

  // Ensure activeTab is always an accessible menu for the current user/guest
  React.useEffect(() => {
    if (!isMenuAccessible(activeTab, currentUser, systemSettings.navigationPermissions)) {
      const fallbackTab = getFirstAccessibleMenuId(currentUser, systemSettings.navigationPermissions);
      if (fallbackTab !== activeTab) {
        setActiveTab(fallbackTab);
      }
    }
  }, [activeTab, currentUser, systemSettings.navigationPermissions]);

  // Connection & Login Gate Policy:
  // - While checking initial database connectivity, show a centered checking card so no app UI flashes prematurely
  // - If offline or Firestore daily read quota is exceeded, hide ALL system pages and show ONLY a centered message card
  // - If online: follow admin Visitor Access Mode (systemSettings.guestRequiresLogin)
  const isConnectionBlocked = dbConnectionState === "offline" || dbConnectionState === "quota_exceeded";
  const isCheckingInitialConnection = dbConnectionState === "checking";
  const isLoginGateActive =
    !currentUser &&
    dbConnectionState === "online" &&
    Boolean(systemSettings.guestRequiresLogin);
  const canLoadAppData = dbConnectionState === "online" && !isLoginGateActive;

  // Auto trigger popup for system maintenance notice (Once per day, only after entering the app)
  React.useEffect(() => {
    if (
      canLoadAppData &&
      systemSettings.showMaintenancePopup &&
      Boolean(systemSettings.maintenanceMessage?.trim())
    ) {
      try {
        const lastSeenDate = localStorage.getItem("dorm_maintenance_seen_date");
        if (lastSeenDate !== todayStr) {
          setIsMaintenanceModalOpen(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [canLoadAppData, systemSettings.showMaintenancePopup, systemSettings.maintenanceMessage, todayStr]);

  const handleCloseMaintenanceModal = () => {
    try {
      localStorage.setItem("dorm_maintenance_seen_date", todayStr);
    } catch (e) {
      console.error(e);
    }
    setIsMaintenanceModalOpen(false);
  };

  // Active report date state
  const [selectedReportDate, setSelectedReportDate] = useState<string>(todayStr);

  // TanStack Query Hooks
  const { data: dorms = [], isLoading: isLoadingDorms } = useDormsQuery(canLoadAppData);
  const { data: students = [], isLoading: isLoadingStudents } = useStudentsQuery(undefined, canLoadAppData);
  const { data: users = [] } = useUsersQuery(canLoadAppData);
  const { data: notices = [] } = useNoticesQuery(undefined, canLoadAppData);
  const { data: todayAttendanceAll } = useAttendanceQuery(todayStr, undefined, canLoadAppData);
  const { data: singleDormAttendance } = useAttendanceQuery(selectedAttendanceDate, selectedDormId, canLoadAppData);
  const { data: allAttendanceRecords = [] } = useAllAttendanceRecordsQuery(canLoadAppData);
  const { data: reportData, isLoading: isLoadingReport } = useDailyReportQuery(selectedReportDate, canLoadAppData);

  // Maintain live realtime onSnapshot connection to the primary Firestore database
  useRealtimePrimaryDatabaseSync(dbConnectionState === "online" && canLoadAppData);

  // Keep active currentUser synced with latest Firestore/cached user profile (avatarUrl, gender, etc.)
  React.useEffect(() => {
    if (!currentUser || !users || users.length === 0) return;
    const latest = users.find((u) => u.id === currentUser.id);
    if (!latest) return;
    const avatarChanged = (latest.avatarUrl || "") !== (currentUser.avatarUrl || "");
    const genderChanged = latest.gender !== currentUser.gender;
    const nameChanged = latest.name !== currentUser.name;
    if (avatarChanged || genderChanged || nameChanged) {
      const safe = sanitizeUserForClient(latest);
      setCurrentUser(safe);
      setSessionUser(safe);
    }
  }, [users, currentUser]);

  const resolvedTodayAttendance = React.useMemo<Record<string, DailyAttendance>>(() => {
    if (todayAttendanceAll && typeof todayAttendanceAll === "object" && !("records" in todayAttendanceAll)) {
      return todayAttendanceAll as Record<string, DailyAttendance>;
    }
    return EMPTY_TODAY_ATTENDANCE;
  }, [todayAttendanceAll]);

  // Mutations
  const addDormMutation = useAddDormMutation();
  const updateDormMutation = useUpdateDormMutation();
  const importStudentsMutation = useImportStudentsMutation();
  const addStudentMutation = useAddStudentMutation();
  const updateStudentMutation = useUpdateStudentMutation();
  const deleteStudentMutation = useDeleteStudentMutation();
  const batchDeleteStudentsMutation = useBatchDeleteStudentsMutation();
  const clearStudentsMutation = useClearStudentsMutation();
  const batchTransferStudentsMutation = useBatchTransferStudentsMutation();
  const postNoticeMutation = usePostNoticeMutation();
  const updateNoticeMutation = useUpdateNoticeMutation();
  const deleteNoticeMutation = useDeleteNoticeMutation();
  const saveAttendanceMutation = useSaveAttendanceMutation();
  const bulkHomeBreakMutation = useBulkHomeBreakMutation();
  const batchSetDateRangeMutation = useBatchSetAttendanceDateRangeMutation();
  const exportSheetsMutation = useExportGoogleSheetsMutation();

  // Count unchecked dorms today
  let uncheckedDormsCount = 0;
  if (todayAttendanceAll && typeof todayAttendanceAll === "object" && !("records" in todayAttendanceAll)) {
    Object.values(todayAttendanceAll).forEach((att) => {
      if (att.status === "PENDING") uncheckedDormsCount++;
    });
  }

  // Navigation with Dynamic Role-Based Permission Check
  const handleSelectTab = (tabId: string) => {
    // Check if the target tab is accessible for the current user/guest according to configured settings
    const hasAccess = isMenuAccessible(tabId, currentUser, systemSettings.navigationPermissions);

    if (!currentUser) {
      if (hasAccess) {
        setActiveTab(tabId);
        return;
      }
      const tabLabels: Record<string, string> = {
        "dashboard": "ภาพรวมหอพัก",
        "dorm-layout": "ผังการจัดหอพัก",
        "student-search": "ค้นหานักเรียน",
        "check-attendance": "เช็คยอดหอพัก (20.00 น.)",
        "special-status": "กำหนดสถานะพิเศษ",
        "fingerprint-compare": "ลงหอสาย",
        "notices": "เรื่องแจ้งอบรม",
        "reports": "รายงานสรุปประจำวัน",
        "students": "จัดการรายชื่อนักเรียน",
        "dorms": "จัดการหอพัก",
        "users-db": "จัดการบัญชีผู้ใช้ สิทธิ์ และฐานข้อมูล"
      };
      setPendingTargetTabId(tabId);
      setTargetTabPrompt(tabLabels[tabId] || tabId);
      setIsLoginModalOpen(true);
      return;
    }

    // If user is logged in but the menu is not permitted for their role level
    if (!hasAccess) {
      const tabLabels: Record<string, string> = {
        "dashboard": "ภาพรวมหอพัก",
        "dorm-layout": "ผังการจัดหอพัก",
        "student-search": "ค้นหานักเรียน",
        "check-attendance": "เช็คยอดหอพัก",
        "special-status": "กำหนดสถานะพิเศษ",
        "fingerprint-compare": "ลงหอสาย",
        "notices": "เรื่องแจ้งอบรม",
        "reports": "รายงานสรุปประจำวัน",
        "students": "จัดการรายชื่อนักเรียน",
        "dorms": "จัดการหอพัก",
        "users-db": "ตั้งค่าระบบ & ฐานข้อมูล"
      };
      setPendingTargetTabId(tabId);
      setTargetTabPrompt(`${tabLabels[tabId] || tabId} (บัญชีของคุณระดับ ${currentUser.roleLevel} ไม่มีสิทธิ์เข้าถึงเมนูนี้ตามที่ผู้ดูแลระบบกำหนด)`);
      setIsLoginModalOpen(true);
      return;
    }

    setActiveTab(tabId);
  };

  const handleNavigateToCheck = (dormId?: string, date?: string) => {
    if (dormId) setSelectedDormId(dormId);
    if (date) setSelectedAttendanceDate(date);
    handleSelectTab("check-attendance");
  };

  const handleNavigateToReports = () => {
    handleSelectTab("reports");
  };

  if (isCheckingInitialConnection) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f2f4f9] via-purple-50/70 to-teal-50/50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-xl border border-slate-100 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A05AFF] to-[#1BCFB4] text-white flex items-center justify-center shadow-md">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-800">
              {systemSettings.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              กำลังตรวจสอบการเชื่อมต่อฐานข้อมูลกลาง...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // When offline or Firestore quota is exceeded, hide ALL system pages and render ONLY a centered message box
  if (isConnectionBlocked) {
    const isQuota = dbConnectionState === "quota_exceeded";
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f2f4f9] via-purple-50/70 to-teal-50/50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-md w-full p-7 sm:p-8 shadow-2xl border border-slate-200/80 flex flex-col items-center text-center gap-5">
          <div
            className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-md ${
              isQuota
                ? "bg-gradient-to-br from-rose-500 to-red-600"
                : "bg-gradient-to-br from-amber-500 to-orange-500"
            }`}
          >
            {isQuota ? <AlertTriangle className="w-8 h-8" /> : <WifiOff className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {systemSettings.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน"}
            </p>
            <h2 className={`text-lg font-extrabold leading-snug ${isQuota ? "text-rose-950" : "text-slate-900"}`}>
              {isQuota
                ? "โควตาการอ่านข้อมูลฟรีรายวันของ Firestore เต็มแล้ว (Quota exceeded)"
                : "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (Offline)"}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isQuota
                ? "โควตาการใช้งานฟรีรายวันของฐานข้อมูลเต็มชั่วคราว และจะรีเซ็ตใหม่ในวันถัดไป จึงยังไม่สามารถเปิดใช้งานระบบได้ในขณะนี้"
                : "ไม่สามารถเชื่อมต่อฐานข้อมูลกลาง Firestore ได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => verifyDatabaseConnectivity(true)}
            disabled={isRetryingConnection}
            className={`w-full py-3 px-4 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-opacity cursor-pointer disabled:opacity-60 ${
              isQuota
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95"
                : "bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] hover:opacity-95"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRetryingConnection ? "animate-spin" : ""}`} />
            <span>{isRetryingConnection ? "กำลังตรวจสอบการเชื่อมต่อ..." : "ลองเชื่อมต่อใหม่"}</span>
          </button>

          {isQuota && (
            <div className="w-full pt-3 border-t border-slate-100 flex flex-col gap-2 text-xs">
              <a
                href={FIRESTORE_QUOTA_UPGRADE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 font-bold text-rose-700 hover:text-rose-900 underline"
              >
                <span>อัปเกรดฐานข้อมูลใน Firebase Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={FIRESTORE_PRICING_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline"
              >
                <span>ดูรายละเอียดโควตาแผน Spark (Enterprise edition)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If system is offline or guestRequiresLogin is enabled and user is not logged in, render ONLY the centered login box
  if (isLoginGateActive) {
    return (
      <LoginModal
        isOpen={true}
        standalone={true}
        systemSettings={systemSettings}
        dbConnectionState={dbConnectionState}
        onRetryConnection={() => verifyDatabaseConnectivity(true)}
        isRetryingConnection={isRetryingConnection}
        onClose={() => {}}
        currentUser={null}
        onLogin={(user) => {
          setSessionUser(user);
          setCurrentUser(user);
          if (user.dormId) setSelectedDormId(user.dormId);
          setActiveTab(getFirstAccessibleMenuId(user, systemSettings.navigationPermissions));
        }}
        onLogout={() => {
          clearSessionUser();
          setCurrentUser(null);
        }}
      />
    );
  }

  const effectiveTab = isMenuAccessible(activeTab, currentUser, systemSettings.navigationPermissions)
    ? activeTab
    : getFirstAccessibleMenuId(currentUser, systemSettings.navigationPermissions);

  return (
    <div className="min-h-screen lg:h-screen bg-[#f2f4f9] flex flex-col font-sans text-slate-800 lg:overflow-hidden">
      <Navbar
        currentUser={currentUser}
        systemSettings={systemSettings}
        onOpenSwitchUser={() => {
          setPendingTargetTabId("");
          setTargetTabPrompt("");
          setIsLoginModalOpen(true);
        }}
        activeTab={effectiveTab}
        onExportSheetsClick={() => handleSelectTab("reports")}
        onToggleMobileMenu={() => setIsOpenMobile((prev) => !prev)}
        isMobileMenuOpen={isOpenMobile}
        uncheckedDormsCount={uncheckedDormsCount}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden items-stretch">
        <Sidebar
          activeTab={effectiveTab}
          setActiveTab={handleSelectTab}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
          uncheckedDormsCount={uncheckedDormsCount}
          currentUser={currentUser}
          systemSettings={systemSettings}
          onOpenLogin={() => {
            setPendingTargetTabId("");
            setTargetTabPrompt("");
            setIsLoginModalOpen(true);
          }}
          onOpenSwitchUser={() => {
            setPendingTargetTabId("");
            setTargetTabPrompt("");
            setIsLoginModalOpen(true);
          }}
          onOpenMaintenanceModal={() => setIsMaintenanceModalOpen(true)}
        />

        {/* Right Side Column: Main Content Area + Bottom Footer */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#f2f4f9]">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-6">
          {firestoreAccessIssue?.code === "ANONYMOUS_AUTH_DISABLED" &&
            !isAuthBannerDismissed && (
            <div className="mb-5 rounded-2xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-extrabold text-rose-950">
                      ยังไม่ได้เปิดใช้งาน Anonymous Authentication ใน Firebase Console
                    </h3>
                    <p className="text-xs text-rose-900 leading-relaxed">
                      เพื่อให้ครูและเจ้าหน้าที่ทุกคนบันทึกข้อมูล/เช็คยอดลง Firestore ได้ทันทีโดยไม่ต้องมีป๊อปอัป Google กรุณาเข้าไปที่{" "}
                      <span className="font-bold">Firebase Console ({FIREBASE_PROJECT_ID}) &rarr; Authentication &rarr; Sign-in method &rarr; Anonymous &rarr; เปิดใช้งาน (Enable)</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => verifyDatabaseConnectivity(true)}
                    disabled={isRetryingConnection}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingConnection ? "animate-spin" : ""}`} />
                    <span>{isRetryingConnection ? "กำลังเชื่อมต่อ..." : "ลองเชื่อมต่ออีกครั้ง"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuthBannerDismissed(true)}
                    className="p-2 rounded-xl text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    title="ปิดแถบแจ้งเตือนชั่วคราว"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {effectiveTab === "dashboard" && (
            <DashboardView
              reportData={reportData}
              isLoading={isLoadingReport || isLoadingDorms}
              dorms={dorms}
              students={students}
              users={users}
              todayAttendance={resolvedTodayAttendance}
              latestNotice={notices[0]}
              onNavigateToCheck={handleNavigateToCheck}
              onNavigateToReports={handleNavigateToReports}
              onNavigateToDormLayout={() => handleSelectTab("dorm-layout")}
              onNavigateToStudents={() => handleSelectTab("students")}
              onNavigateToSpecialStatus={() => handleSelectTab("special-status")}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              onBulkHomeBreak={async (mode) => {
                await bulkHomeBreakMutation.mutateAsync({
                  targetDate: selectedAttendanceDate || todayStr,
                  dorms,
                  students,
                  operatorName: currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่",
                  mode
                });
              }}
              onBatchSetDateRange={async (payload) => {
                return await batchSetDateRangeMutation.mutateAsync({
                  ...payload,
                  dorms,
                  students,
                  operatorName: currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่"
                });
              }}
            />
          )}

          {effectiveTab === "dorm-layout" && (
            <DormLayoutView
              dorms={dorms}
              students={students}
              users={users}
              currentUser={currentUser}
              systemSettings={systemSettings}
            />
          )}

          {effectiveTab === "student-search" && (
            <StudentSearchView
              students={students}
              dorms={dorms}
              attendanceRecords={allAttendanceRecords}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onNavigateToCheck={handleNavigateToCheck}
            />
          )}

          {effectiveTab === "check-attendance" && (
            <AttendanceCheckView
              dorms={dorms}
              selectedDormId={selectedDormId}
              onDormChange={setSelectedDormId}
              students={students.filter((s) => {
                const currentDorm = dorms.find((d) => d.id === selectedDormId);
                return currentDorm ? matchStudentToDorm(s, currentDorm) : s.dormId === selectedDormId;
              })}
              attendanceData={
                singleDormAttendance && "records" in singleDormAttendance
                  ? (singleDormAttendance as any)
                  : undefined
              }
              notices={notices.filter((n) => n.date === selectedAttendanceDate)}
              onSaveAttendance={async (payload) => {
                await saveAttendanceMutation.mutateAsync(payload);
              }}
              currentUserName={currentUser?.name || "ครูหอพัก"}
              currentUser={currentUser}
              selectedDate={selectedAttendanceDate}
              onDateChange={setSelectedAttendanceDate}
              onReturnToDashboard={() => handleSelectTab("dashboard")}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              onNavigateToStudents={() => handleSelectTab("students")}
              onBulkHomeBreak={async (mode) => {
                await bulkHomeBreakMutation.mutateAsync({
                  targetDate: selectedAttendanceDate || todayStr,
                  dorms,
                  students,
                  operatorName: currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่",
                  mode
                });
              }}
            />
          )}

          {effectiveTab === "special-status" && (
            <SpecialStatusManagerView
              dorms={dorms}
              students={students}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              allAttendanceRecords={allAttendanceRecords}
              onBatchSetDateRange={async (payload) => {
                return await batchSetDateRangeMutation.mutateAsync({
                  ...payload,
                  dorms,
                  students,
                  operatorName: currentUser?.name || "ผู้ดูแล/เจ้าหน้าที่"
                });
              }}
              onNavigateToDashboard={() => handleSelectTab("dashboard")}
              onNavigateToCheck={handleNavigateToCheck}
            />
          )}

          {effectiveTab === "fingerprint-compare" && (
            <FingerprintCompareView
              students={students}
              dorms={dorms}
              attendanceRecords={allAttendanceRecords}
              systemSettings={systemSettings}
              currentUser={currentUser}
              onNavigateToCheck={handleNavigateToCheck}
            />
          )}

          {effectiveTab === "notices" && (
            <NoticeManagerView
              notices={notices}
              onPostNotice={async (data) => {
                await postNoticeMutation.mutateAsync(data);
              }}
              onUpdateNotice={async (data) => {
                await updateNoticeMutation.mutateAsync(data);
              }}
              onDeleteNotice={async (id) => {
                await deleteNoticeMutation.mutateAsync(id);
              }}
              currentUserName={currentUser?.name || "หัวหน้าหอพัก"}
            />
          )}

          {effectiveTab === "reports" && (
            <DailyReportView
              reportData={reportData}
              isLoading={isLoadingReport}
              selectedReportDate={selectedReportDate}
              setSelectedReportDate={setSelectedReportDate}
              systemSettings={systemSettings}
              onExportGoogleSheets={async (rData) => {
                return await exportSheetsMutation.mutateAsync({ reportData: rData });
              }}
              currentUser={currentUser}
              students={students}
              dorms={dorms}
              users={users}
              attendanceRecords={allAttendanceRecords}
            />
          )}

          {effectiveTab === "students" && (
            <StudentManagementView
              dorms={dorms}
              students={students}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              onImportStudents={async (dormId, stds) => {
                await importStudentsMutation.mutateAsync({ dormId, students: stds });
              }}
              onAddStudent={async (stData) => {
                await addStudentMutation.mutateAsync(stData);
              }}
              onUpdateStudent={async (id, stData) => {
                await updateStudentMutation.mutateAsync({ id, data: stData });
              }}
              onDeleteStudent={async (id) => {
                await deleteStudentMutation.mutateAsync(id);
              }}
              onBatchDeleteStudents={async (ids) => {
                await batchDeleteStudentsMutation.mutateAsync(ids);
              }}
              onClearStudents={async (mode, dormId) => {
                await clearStudentsMutation.mutateAsync({ mode, dormId });
              }}
              onBatchTransferDorm={async (studentIds, targetDormId, targetDormRoom) => {
                await batchTransferStudentsMutation.mutateAsync({ studentIds, targetDormId, targetDormRoom });
              }}
            />
          )}

          {effectiveTab === "dorms" && (
            <DormsManagementView
              dorms={dorms}
              students={students}
              users={users}
              attendanceRecords={allAttendanceRecords}
              systemSettings={systemSettings}
              currentUser={currentUser}
              onAddDorm={async (dData) => {
                await addDormMutation.mutateAsync(dData);
              }}
              onUpdateDorm={async (id, dData) => {
                await updateDormMutation.mutateAsync({ id, data: dData });
              }}
              onNavigateToUsers={() => handleSelectTab("users-db")}
            />
          )}

          {effectiveTab === "users-db" && (
            <UserAndDatabaseView
              currentUser={currentUser}
              dorms={dorms}
              students={students}
              notices={notices}
              attendanceRecords={allAttendanceRecords}
              usersList={users}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              onDataReset={() => {
                queryClient.invalidateQueries();
              }}
              onUserUpdated={(updatedUser) => {
                const safeUser = sanitizeUserForClient(updatedUser);
                setSessionUser(safeUser);
                setCurrentUser(safeUser);
              }}
            />
          )}
        </main>
      </div>
    </div>


      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setPendingTargetTabId("");
          setTargetTabPrompt("");
        }}
        currentUser={currentUser}
        targetTabName={targetTabPrompt}
        systemSettings={systemSettings}
        dbConnectionState={dbConnectionState}
        onRetryConnection={() => verifyDatabaseConnectivity(true)}
        isRetryingConnection={isRetryingConnection}
        onLogin={(user) => {
          setSessionUser(user);
          setCurrentUser(user);
          if (user.dormId) setSelectedDormId(user.dormId);
          if (pendingTargetTabId && isMenuAccessible(pendingTargetTabId, user, systemSettings.navigationPermissions)) {
            setActiveTab(pendingTargetTabId);
          } else if (!isMenuAccessible(activeTab, user, systemSettings.navigationPermissions)) {
            setActiveTab(getFirstAccessibleMenuId(user, systemSettings.navigationPermissions));
          }
          setPendingTargetTabId("");
          setTargetTabPrompt("");
        }}
        onLogout={() => {
          clearSessionUser();
          setCurrentUser(null);
          setActiveTab(getFirstAccessibleMenuId(null, systemSettings.navigationPermissions));
          setPendingTargetTabId("");
          setTargetTabPrompt("");
          setIsLoginModalOpen(false);
        }}
      />

      {/* System Maintenance & Notice Auto Popup Modal */}
      <MaintenancePopupModal
        isOpen={isMaintenanceModalOpen}
        onClose={handleCloseMaintenanceModal}
        systemSettings={systemSettings}
        todayStr={todayStr}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainAppContent />
    </QueryClientProvider>
  );
}
