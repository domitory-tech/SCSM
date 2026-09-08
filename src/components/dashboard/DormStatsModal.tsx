import React from "react";
import { Bar, Radar } from "react-chartjs-2";
import "../charts/ChartSetup";
import { Dormitory, DailyAttendance } from "../../types";
import { CheckCircle2, Filter, X, BarChart2, Calendar, Users } from "lucide-react";

interface DormStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dorms: Dormitory[];
  realtimeDormTotals: Record<string, { remaining: number; out: number; total: number }>;
  activeAttendanceMap: Record<string, DailyAttendance>;
  selectedDormIdsForChart: string[];
  setSelectedDormIdsForChart: React.Dispatch<React.SetStateAction<string[]>>;
  chartViewMode: "bar" | "radar";
  setChartViewMode: React.Dispatch<React.SetStateAction<"bar" | "radar">>;
  dormComparisonChartData: any;
  selectedDashboardDate: string;
  effectiveDashboardDate: string;
}

export const DormStatsModal: React.FC<DormStatsModalProps> = ({
  isOpen,
  onClose,
  dorms,
  realtimeDormTotals,
  activeAttendanceMap,
  selectedDormIdsForChart,
  setSelectedDormIdsForChart,
  chartViewMode,
  setChartViewMode,
  dormComparisonChartData,
  selectedDashboardDate,
  effectiveDashboardDate,
}) => {
  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const displayDateStr = selectedDashboardDate
    ? selectedDashboardDate.split("-").reverse().join("/")
    : effectiveDashboardDate.split("-").reverse().join("/");

  // Calculate modal summary totals
  const totalCapacity = dorms.reduce((sum, d) => sum + (d.capacity || 80), 0);
  const totalStudents = dorms.reduce((sum, d) => sum + (realtimeDormTotals[d.id]?.total || 0), 0);
  const totalRemaining = dorms.reduce((sum, d) => sum + (realtimeDormTotals[d.id]?.remaining || 0), 0);
  const totalOut = dorms.reduce((sum, d) => sum + (realtimeDormTotals[d.id]?.out || 0), 0);

  return (
    <div
      id="dorm-stats-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="dorm-stats-modal-dialog"
        className="bg-white text-slate-900 w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#A05AFF]/15 border border-[#A05AFF]/30 flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-[#A05AFF]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg truncate">
                  สถิตินักเรียนแยกตามหอพัก (หอพัก 1 - 6)
                </h3>
                <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3 text-purple-600" />
                  ประจำวันที่ {displayDateStr}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                สถิติจำนวนนักเรียน ความจุที่รองรับ และกราฟเปรียบเทียบข้อมูลหอพัก 1 - 6
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Controls Bar: Mode Toggle & Dormitory Filter Checkboxes */}
          <div className="space-y-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-100/80">
            {/* Line 1: Choose Chart View Mode (Bar / Radar) */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100/80 pb-2.5">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <span>เลือกโหมดการแสดงผลกราฟ:</span>
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setChartViewMode("bar")}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    chartViewMode === "bar"
                      ? "bg-[#A05AFF] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  กราฟแท่ง
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode("radar")}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    chartViewMode === "radar"
                      ? "bg-[#A05AFF] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  กราฟเรดาร์
                </button>
              </div>
            </div>

            {/* Line 2: Filter Title and "เลือกทั้งหมด" button */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <span className="text-purple-900 font-extrabold flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#A05AFF]" />
                คลิกเลือกหอพักเพื่อเปรียบเทียบในกราฟ:
              </span>
              {selectedDormIdsForChart.length < dorms.length && (
                <button
                  type="button"
                  onClick={() => setSelectedDormIdsForChart(dorms.map((d) => d.id))}
                  className="px-2.5 py-1 text-[11px] font-extrabold bg-purple-200 text-purple-900 rounded-lg hover:bg-purple-300 transition-all cursor-pointer shrink-0"
                >
                  เลือกทั้งหมด
                </button>
              )}
            </div>

            {/* Line 3: Checkbox blocks for dormitories */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {dorms.map((d) => {
                const isChecked = selectedDormIdsForChart.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      isChecked
                        ? "bg-white text-purple-900 border-purple-300 shadow-2xs"
                        : "bg-white/60 text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDormIdsForChart([...selectedDormIdsForChart, d.id]);
                        } else {
                          setSelectedDormIdsForChart(
                            selectedDormIdsForChart.filter((id) => id !== d.id)
                          );
                        }
                      }}
                      className="rounded text-[#A05AFF] focus:ring-[#A05AFF] w-3.5 h-3.5 cursor-pointer"
                    />
                    {d.name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Main Grid: Left = 6 Dormitory Cards, Right = Comparison Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Side: Dormitories 1 to 6 in 2 columns */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {dorms.map((dorm) => {
                const stats = realtimeDormTotals[dorm.id] || { remaining: 0, out: 0, total: 0 };
                const att = activeAttendanceMap[dorm.id];
                const isChecked = att?.status === "CHECKED";
                const isHomeBreak = att?.status === "HOME_BREAK";
                const isMale =
                  dorm.gender === "male" ||
                  dorm.id.includes("1") ||
                  dorm.id.includes("2") ||
                  dorm.id.includes("3");

                return (
                  <div
                    key={dorm.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isChecked
                        ? "bg-emerald-50/40 border-emerald-200"
                        : isHomeBreak
                        ? "bg-amber-50/40 border-amber-200"
                        : "bg-slate-50/80 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {dorm.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                            isMale ? "bg-purple-100 text-purple-700" : "bg-pink-100 text-pink-700"
                          }`}
                        >
                          {isMale ? "หอชาย" : "หอหญิง"}
                        </span>
                      </div>
                      {isChecked ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          เช็คแล้ว
                        </span>
                      ) : isHomeBreak ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          รอบกลับบ้าน
                        </span>
                      ) : (
                        <span className="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          รอเช็คยอด
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 space-y-1 text-xs border-t border-slate-200/60 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">ความจุที่รองรับ:</span>
                        <span className="text-blue-700 font-black">{dorm.capacity || 80} คน</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">นักเรียนทั้งหมด:</span>
                        <span className="text-purple-700 font-black">{stats.total} คน</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">มาเรียนปกติ / อยู่หอ:</span>
                        <span className="text-teal-700 font-black">{stats.remaining} คน</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">ออกหอพัก / ลา:</span>
                        <span className="text-rose-600 font-black">{stats.out} คน</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Side: Overlay / Comparison Chart */}
            <div className="lg:col-span-6 h-88 sm:h-96 w-full flex justify-center items-center p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80">
              {chartViewMode === "bar" ? (
                <Bar
                  data={dormComparisonChartData}
                  options={{
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" },
                          usePointStyle: true,
                          boxWidth: 8,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => ` ${context.dataset.label}: ${context.raw} คน`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        grid: { color: "#f1f5f9" },
                        ticks: { font: { family: "Sarabun, sans-serif", size: 10 } },
                      },
                      y: {
                        grid: { display: false },
                        ticks: { font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" } },
                      },
                    },
                  }}
                />
              ) : (
                <Radar
                  data={dormComparisonChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          font: { family: "Sarabun, sans-serif", size: 11, weight: "bold" },
                          usePointStyle: true,
                          boxWidth: 8,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => ` ${context.dataset.label}: ${context.raw} คน`,
                        },
                      },
                    },
                    scales: {
                      r: {
                        angleLines: { color: "#e2e8f0" },
                        grid: { color: "#f1f5f9" },
                        pointLabels: {
                          font: { family: "Sarabun, sans-serif", size: 10, weight: "bold" },
                          color: "#334155",
                        },
                        ticks: {
                          font: { family: "Sarabun, sans-serif", size: 9 },
                          backdropColor: "transparent",
                        },
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Summary & Close button */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <span>
              ความจุรวม: <strong className="text-blue-700 font-bold">{totalCapacity}</strong> คน
            </span>
            <span>
              นักเรียนทั้งหมด: <strong className="text-purple-700 font-bold">{totalStudents}</strong> คน
            </span>
            <span>
              อยู่หอ: <strong className="text-emerald-700 font-bold">{totalRemaining}</strong> คน
            </span>
            <span>
              ออกหอ: <strong className="text-rose-600 font-bold">{totalOut}</strong> คน
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
