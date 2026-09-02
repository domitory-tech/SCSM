import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProfile, SystemSettings } from "./types";
import { DEFAULT_SYSTEM_SETTINGS, getTodayDateString } from "./utils/dateUtils";
import { matchStudentToDorm } from "./utils/dormUtils";
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
import { MaintenancePopupModal } from "./components/common/MaintenancePopupModal";
import {
  useAddDormMutation,
  useAddStudentMutation,
  useAllAttendanceRecordsQuery,
  useAttendanceQuery,
  useBatchDeleteStudentsMutation,
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
  useUsersQuery
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

function MainAppContent() {
  const { data: dbSettings } = useSystemSettingsQuery();
  const updateSystemSettingsMutation = useUpdateSystemSettingsMutation();

  // System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem("dorm_system_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SYSTEM_SETTINGS;
  });

  // Sync settings from Firestore when query resolves
  React.useEffect(() => {
    if (dbSettings) {
      setSystemSettings(dbSettings);
      try {
        localStorage.setItem("dorm_system_settings", JSON.stringify(dbSettings));
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
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [targetTabPrompt, setTargetTabPrompt] = useState<string>("");

  // System Maintenance Auto Popup State (Shown 1 time per day)
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);

  // Active check state
  const [selectedDormId, setSelectedDormId] = useState<string>("dorm-1");
  const todayStr = getTodayDateString();
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(todayStr);

  // Auto trigger popup for system maintenance notice (Once per day)
  React.useEffect(() => {
    if (
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
  }, [systemSettings.showMaintenancePopup, systemSettings.maintenanceMessage, todayStr]);

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

  // Mutations
  const addDormMutation = useAddDormMutation();
  const updateDormMutation = useUpdateDormMutation();
  const importStudentsMutation = useImportStudentsMutation();
  const addStudentMutation = useAddStudentMutation();
  const updateStudentMutation = useUpdateStudentMutation();
  const deleteStudentMutation = useDeleteStudentMutation();
  const batchDeleteStudentsMutation = useBatchDeleteStudentsMutation();
  const postNoticeMutation = usePostNoticeMutation();
  const updateNoticeMutation = useUpdateNoticeMutation();
  const deleteNoticeMutation = useDeleteNoticeMutation();
  const saveAttendanceMutation = useSaveAttendanceMutation();
  const exportSheetsMutation = useExportGoogleSheetsMutation();

  // Count unchecked dorms today
  let uncheckedDormsCount = 0;
  if (todayAttendanceAll && typeof todayAttendanceAll === "object" && !("records" in todayAttendanceAll)) {
    Object.values(todayAttendanceAll).forEach((att) => {
      if (att.status === "PENDING") uncheckedDormsCount++;
    });
  }

  // Navigation with 3-Level Permission Check
  const handleSelectTab = (tabId: string) => {
    // Dashboard is open to everyone
    if (tabId === "dashboard") {
      setActiveTab("dashboard");
      return;
    }

    // Require login for other tabs
    if (!currentUser) {
      const tabLabels: Record<string, string> = {
        "dorm-layout": "ผังการจัดหอพัก",
        "student-search": "ค้นหานักเรียน",
        "check-attendance": "เช็คยอดหอพัก (20.00 น.)",
        "notices": "เรื่องแจ้งอบรม",
        "reports": "รายงานสรุปประจำวัน",
        "students": "จัดการรายชื่อนักเรียน",
        "dorms": "จัดการหอพัก",
        "users-db": "จัดการบัญชีผู้ใช้ สิทธิ์ และฐานข้อมูล"
      };
      setTargetTabPrompt(tabLabels[tabId] || tabId);
      setIsLoginModalOpen(true);
      return;
    }

    // Check specific role level rules
    if (tabId === "dorms" && currentUser.roleLevel !== 1 && currentUser.roleLevel !== 2) {
      setTargetTabPrompt("จัดการหอพัก (เฉพาะระดับ 1: ผู้ดูแล หรือ ระดับ 2: เจ้าหน้าที่)");
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

  return (
    <div className="min-h-screen bg-[#f2f4f9] flex flex-col font-sans text-slate-800">
      <Navbar
        currentUser={currentUser}
        systemSettings={systemSettings}
        onOpenSwitchUser={() => {
          setTargetTabPrompt("");
          setIsLoginModalOpen(true);
        }}
        activeTab={activeTab}
        onExportSheetsClick={() => handleSelectTab("reports")}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSelectTab}
          isOpenMobile={isOpenMobile}
          setIsOpenMobile={setIsOpenMobile}
          uncheckedDormsCount={uncheckedDormsCount}
          currentUser={currentUser}
          systemSettings={systemSettings}
          onOpenLogin={() => {
            setTargetTabPrompt("");
            setIsLoginModalOpen(true);
          }}
          onOpenMaintenanceModal={() => setIsMaintenanceModalOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              reportData={reportData}
              isLoading={isLoadingReport || isLoadingDorms}
              dorms={dorms}
              students={students}
              users={users}
              todayAttendance={
                todayAttendanceAll && typeof todayAttendanceAll === "object" && !("records" in todayAttendanceAll)
                  ? (todayAttendanceAll as any)
                  : {}
              }
              latestNotice={notices[0]}
              onNavigateToCheck={handleNavigateToCheck}
              onNavigateToReports={handleNavigateToReports}
              onNavigateToDormLayout={() => handleSelectTab("dorm-layout")}
              currentUser={currentUser}
            />
          )}

          {activeTab === "dorm-layout" && (
            <DormLayoutView
              dorms={dorms}
              students={students}
              users={users}
              currentUser={currentUser}
            />
          )}

          {activeTab === "student-search" && (
            <StudentSearchView
              students={students}
              dorms={dorms}
              attendanceRecords={allAttendanceRecords}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onNavigateToCheck={handleNavigateToCheck}
            />
          )}

          {activeTab === "check-attendance" && (
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
              onReturnToDashboard={() => setActiveTab("dashboard")}
            />
          )}

          {activeTab === "notices" && (
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

          {activeTab === "reports" && (
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

          {activeTab === "students" && (
            <StudentManagementView
              dorms={dorms}
              students={students}
              currentUser={currentUser}
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
            />
          )}

          {activeTab === "dorms" && (
            <DormsManagementView
              dorms={dorms}
              students={students}
              users={users}
              onAddDorm={async (dData) => {
                await addDormMutation.mutateAsync(dData);
              }}
              onUpdateDorm={async (id, dData) => {
                await updateDormMutation.mutateAsync({ id, data: dData });
              }}
              onNavigateToUsers={() => setActiveTab("users-db")}
            />
          )}

          {activeTab === "users-db" && (
            <UserAndDatabaseView
              currentUser={currentUser}
              dorms={dorms}
              systemSettings={systemSettings}
              onUpdateSystemSettings={handleUpdateSystemSettings}
              onDataReset={() => {
                queryClient.invalidateQueries();
              }}
              onUserUpdated={(updatedUser) => {
                setSessionUser(updatedUser);
                setCurrentUser(updatedUser);
              }}
            />
          )}
        </main>
      </div>


      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        targetTabName={targetTabPrompt}
        onLogin={(user) => {
          setSessionUser(user);
          setCurrentUser(user);
          if (user.dormId) setSelectedDormId(user.dormId);
          if (targetTabPrompt) {
            // Attempt to switch to requested tab after login
            if (targetTabPrompt.includes("จัดการหอพัก") && user.roleLevel === 1) setActiveTab("dorms");
            else if (targetTabPrompt.includes("เช็คยอด")) setActiveTab("check-attendance");
            else if (targetTabPrompt.includes("นักเรียน")) setActiveTab("students");
            else if (targetTabPrompt.includes("รายงาน")) setActiveTab("reports");
            else if (targetTabPrompt.includes("อบรม")) setActiveTab("notices");
          }
        }}
        onLogout={() => {
          clearSessionUser();
          setCurrentUser(null);
          setActiveTab("dashboard");
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
