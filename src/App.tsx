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
import { AlertTriangle, Check, Copy, Database, LogIn, RefreshCw, X } from "lucide-react";
import {
  auth,
  subscribeFirestoreAccessIssue,
  signInWithGoogleAndRefresh,
  getCurrentHostname,
  FIREBASE_PROJECT_ID,
  FIREBASE_DATABASE_ID,
  FirestoreAccessIssue
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
  useBatchSetAttendanceDateRangeMutation
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
  const { data: dbSettings } = useSystemSettingsQuery();
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

  // Firestore Access Issue Banner State (only visible when Firestore access is actively blocked)
  const [accessIssue, setAccessIssue] = useState<FirestoreAccessIssue | null>(null);
  const [dismissedIssueKey, setDismissedIssueKey] = useState<string | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState<boolean>(false);
  const [cloudConnectError, setCloudConnectError] = useState<string | null>(null);
  const [copiedDomainHost, setCopiedDomainHost] = useState<boolean>(false);

  React.useEffect(() => {
    const unsubIssue = subscribeFirestoreAccessIssue((issue) => {
      setAccessIssue(issue);
      if (!issue) {
        setCloudConnectError(null);
      }
    });

    let lastUid: string | null | undefined = undefined;
    const unsubAuth = auth.onAuthStateChanged((fbUser) => {
      const nextUid = fbUser?.emailVerified ? fbUser.uid : null;
      if ((lastUid !== undefined && lastUid !== nextUid) || (lastUid === undefined && nextUid !== null)) {
        invalidateFirestoreReadCache();
        queryClient.invalidateQueries();
      }
      lastUid = nextUid;
    });

    return () => {
      unsubIssue();
      unsubAuth();
    };
  }, []);

  const handleConnectFirestoreGoogle = async () => {
    setIsConnectingCloud(true);
    setCloudConnectError(null);
    try {
      await signInWithGoogleAndRefresh();
      invalidateFirestoreReadCache();
      await queryClient.invalidateQueries();
      setDismissedIssueKey(null);
    } catch (err: any) {
      setCloudConnectError(err?.message || "ไม่สามารถเชื่อมต่อบัญชี Google ได้");
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const handleRetryFirestoreSync = async () => {
    setCloudConnectError(null);
    invalidateFirestoreReadCache();
    await queryClient.invalidateQueries();
  };

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

  // Auto trigger popup for system maintenance notice (Once per day, only after entering the app)
  const isLoginGateActive = Boolean(systemSettings.guestRequiresLogin) && !currentUser;
  React.useEffect(() => {
    if (
      !isLoginGateActive &&
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
  }, [isLoginGateActive, systemSettings.showMaintenancePopup, systemSettings.maintenanceMessage, todayStr]);

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
  const { data: dorms = [], isLoading: isLoadingDorms } = useDormsQuery();
  const { data: students = [], isLoading: isLoadingStudents } = useStudentsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: notices = [] } = useNoticesQuery();
  const { data: todayAttendanceAll } = useAttendanceQuery(todayStr);
  const { data: singleDormAttendance } = useAttendanceQuery(selectedAttendanceDate, selectedDormId);
  const { data: allAttendanceRecords = [] } = useAllAttendanceRecordsQuery();
  const { data: reportData, isLoading: isLoadingReport } = useDailyReportQuery(selectedReportDate);

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

  // If guestRequiresLogin is enabled and user is not logged in, render ONLY the centered login box
  if (isLoginGateActive) {
    return (
      <LoginModal
        isOpen={true}
        standalone={true}
        systemSettings={systemSettings}
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
          {accessIssue &&
            dismissedIssueKey !== `${accessIssue.code}:${accessIssue.hostname || ""}` && (
              <div className="mb-5 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      {accessIssue.code === "UNAUTHORIZED_DOMAIN" ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-amber-950">
                          {accessIssue.code === "UNAUTHORIZED_DOMAIN"
                            ? "โดเมนนี้ยังไม่ได้รับอนุญาตให้เชื่อมต่อ Firebase Authentication"
                            : accessIssue.code === "AUTH_REQUIRED"
                            ? "ยังไม่ได้เชื่อมต่อฐานข้อมูล Firestore (ต้องยืนยันตัวตนด้วย Google)"
                            : accessIssue.code === "PERMISSION_DENIED"
                            ? "บัญชี Google ปัจจุบันไม่มีสิทธิ์อ่าน/เขียนข้อมูลบางส่วนบน Firestore"
                            : "ไม่สามารถเชื่อมต่อฐานข้อมูล Firestore ได้ชั่วคราว"}
                        </h3>
                        {getCurrentHostname() && (
                          <span className="text-[11px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                            {getCurrentHostname()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        {cloudConnectError || accessIssue.message}
                      </p>

                      {accessIssue.code === "UNAUTHORIZED_DOMAIN" && (
                        <div className="mt-2 p-3 rounded-xl bg-white border border-amber-200 text-xs text-slate-700 space-y-1.5">
                          <div className="font-bold text-slate-900">
                            วิธีแก้ไขเพื่อให้ระบบบน GitHub Pages เรียกใช้ฐานข้อมูล Firestore ได้:
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                            <li>
                              เปิด Firebase Console โปรเจกต์{" "}
                              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">
                                {FIREBASE_PROJECT_ID}
                              </code>{" "}
                              (ฐานข้อมูล{" "}
                              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">
                                {FIREBASE_DATABASE_ID}
                              </code>
                              )
                            </li>
                            <li>
                              ไปที่เมนู <strong>Authentication &rarr; Settings &rarr; Authorized domains &rarr; Add domain</strong>
                            </li>
                            <li className="flex flex-wrap items-center gap-1.5">
                              <span>เพิ่มโดเมน:</span>
                              <code className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded font-mono font-bold">
                                {accessIssue.hostname || getCurrentHostname()}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  const host = accessIssue.hostname || getCurrentHostname();
                                  if (host && navigator.clipboard) {
                                    navigator.clipboard.writeText(host);
                                    setCopiedDomainHost(true);
                                    setTimeout(() => setCopiedDomainHost(false), 2000);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
                              >
                                {copiedDomainHost ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedDomainHost ? "คัดลอกแล้ว" : "คัดลอกโดเมน"}</span>
                              </button>
                            </li>
                          </ol>
                        </div>
                      )}

                      {accessIssue.code === "AUTH_REQUIRED" && (
                        <p className="text-[11px] text-amber-800">
                          ฐานข้อมูลกลางปกป้องข้อมูลนักเรียนด้วยการยืนยันตัวตน Google (หากเปิดบน GitHub Pages หรืออุปกรณ์ใหม่ กรุณากดเชื่อมต่อ Google หรือหากพบแจ้งเตือน Unauthorized Domain ให้เพิ่มโดเมนของ GitHub Pages ใน Firebase Console)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleConnectFirestoreGoogle}
                      disabled={isConnectingCloud}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>
                        {isConnectingCloud
                          ? "กำลังเชื่อมต่อ Google..."
                          : "เชื่อมต่อฐานข้อมูล Firestore (Google)"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRetryFirestoreSync}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>ลองโหลดใหม่</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedIssueKey(`${accessIssue.code}:${accessIssue.hostname || ""}`)
                      }
                      aria-label="ปิดการแจ้งเตือนนี้"
                      className="p-2 rounded-xl bg-white/80 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
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
