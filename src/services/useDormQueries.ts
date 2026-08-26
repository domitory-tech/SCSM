import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDorm,
  addStudent,
  addUser,
  batchDeleteStudents,
  deleteNotice,
  deleteSampleData,
  DeleteSampleDataOptions,
  deleteStudent,
  deleteUser,
  exportToGoogleSheets,
  fetchAllAttendanceRecords,
  fetchAttendance,
  fetchDailyReport,
  fetchDorms,
  fetchNotices,
  fetchStudents,
  fetchSystemSettings,
  fetchUsers,
  importStudents,
  postNotice,
  saveAttendance,
  updateDorm,
  updateNotice,
  updateStudent,
  updateSystemSettings,
  updateUser
} from "./api";
import { DailyAttendance, DailyReportData, Dormitory, Student, SystemSettings, UserProfile } from "../types";

export function recordLastDbSave() {
  try {
    const now = new Date();
    const thaiMonths = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543;
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const timeStr = `${day} ${month} ${year} เวลา ${hours}:${minutes}:${seconds} น.`;
    localStorage.setItem("dorm_last_db_save", timeStr);
  } catch (e) {
    console.error(e);
  }
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useAddUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUser,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
    }
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserProfile> }) => updateUser(id, data),
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
    }
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
    }
  });
}

export function useDormsQuery() {
  return useQuery({
    queryKey: ["dorms"],
    queryFn: fetchDorms,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAddDormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addDorm,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
    }
  });
}

export function useUpdateDormMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Dormitory> & { assignedTeacherId?: string } }) =>
      updateDorm(id, data),
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
    }
  });
}

export function useStudentsQuery(params?: { dormId?: string; grade?: string; room?: number }) {
  return useQuery({
    queryKey: ["students", params],
    queryFn: () => fetchStudents(params),
    staleTime: 1000 * 60 * 2,
  });
}

export function useImportStudentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dormId, students }: { dormId: string; students: Partial<Student>[] }) =>
      importStudents(dormId, students),
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dailyReport"] });
    }
  });
}

export function useAddStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addStudent,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  });
}

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) =>
      updateStudent(id, data),
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  });
}

export function useDeleteStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  });
}

export function useBatchDeleteStudentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchDeleteStudents,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  });
}

export function useNoticesQuery(date?: string) {
  return useQuery({
    queryKey: ["notices", date],
    queryFn: () => fetchNotices(date),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function usePostNoticeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postNotice,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    }
  });
}

export function useUpdateNoticeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotice,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    }
  });
}

export function useDeleteNoticeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    }
  });
}

export function useAttendanceQuery(date: string, dormId?: string) {
  return useQuery({
    queryKey: ["attendance", date, dormId],
    queryFn: () => fetchAttendance(date, dormId),
    staleTime: 1000 * 15, // 15 seconds
  });
}

export function useAllAttendanceRecordsQuery() {
  return useQuery({
    queryKey: ["allAttendanceRecords"],
    queryFn: fetchAllAttendanceRecords,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useSaveAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAttendance,
    onSuccess: (_, variables) => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["allAttendanceRecords"] });
      queryClient.invalidateQueries({ queryKey: ["dailyReport"] });
    }
  });
}

export function useDailyReportQuery(date?: string) {
  return useQuery({
    queryKey: ["dailyReport", date],
    queryFn: () => fetchDailyReport(date),
    staleTime: 1000 * 30,
  });
}

export function useExportGoogleSheetsMutation() {
  return useMutation({
    mutationFn: ({ reportData, accessToken }: { reportData: DailyReportData; accessToken?: string }) =>
      exportToGoogleSheets(reportData, accessToken)
  });
}

export function useSystemSettingsQuery() {
  return useQuery({
    queryKey: ["systemSettings"],
    queryFn: fetchSystemSettings,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useUpdateSystemSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    }
  });
}

export function useDeleteSampleDataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: DeleteSampleDataOptions) => deleteSampleData(options),
    onSuccess: () => {
      recordLastDbSave();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dorms"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["allAttendanceRecords"] });
      queryClient.invalidateQueries({ queryKey: ["dailyReport"] });
    }
  });
}

