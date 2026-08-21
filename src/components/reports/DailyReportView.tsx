import React, { useState, useRef } from "react";
import { DailyAttendance, DailyReportData, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import { DEFAULT_SYSTEM_SETTINGS, formatThaiFullDate, getTodayDateString } from "../../utils/dateUtils";
import {
  exportDailyReportToExcel,
  GOOGLE_DRIVE_FOLDER_URL
} from "../../utils/excelReportExport";
import {
  exportCombinedDailyReportHtml,
  exportHtmlDocument,
  exportHtmlToPdf,
  exportHtmlTablesToExcel
} from "../../utils/htmlReportExporter";
import { MonthlyReportView } from "./MonthlyReportView";
import { DashboardReportView } from "./DashboardReportView";
import { DormitorySummaryReportView } from "./DormitorySummaryReportView";
import { toPng, toBlob } from "html-to-image";
import {
  BarChart3,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Printer,
  RefreshCw,
  Share2,
  Sparkles,
  X
} from "lucide-react";

interface DailyReportViewProps {
  reportData?: DailyReportData;
  isLoading: boolean;
  selectedReportDate: string;
  setSelectedReportDate: (date: string) => void;
  systemSettings?: SystemSettings;
  onExportGoogleSheets: (reportData: DailyReportData) => Promise<{ spreadsheetUrl?: string; driveFolderUrl?: string; isMockUrl?: boolean; message?: string }>;
  currentUser?: UserProfile | null;
  students?: Student[];
  dorms?: Dormitory[];
  attendanceRecords?: DailyAttendance[];
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  reportData,
  isLoading,
  selectedReportDate,
  setSelectedReportDate,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onExportGoogleSheets,
  currentUser,
  students = [],
  dorms = [],
  attendanceRecords = []
}) => {
  const [reportMode, setReportMode] = useState<"daily" | "dorm-summary" | "monthly" | "dashboard">("dorm-summary");
  const [activeTab, setActiveTab] = useState<"sheet1" | "sheet2" | "sheet3">("sheet1");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<{ url?: string; msg?: string } | null>(null);

  // Capture Screenshot & Line Sharing State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturingSheetKey, setCapturingSheetKey] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedSheetInfo, setCapturedSheetInfo] = useState<{ key: string; title: string; subtitle: string } | null>(null);
  const [copyImageSuccess, setCopyImageSuccess] = useState<boolean>(false);

  // References for each printable sheet
  const sheet1Ref = useRef<HTMLDivElement>(null);
  const sheet2Ref = useRef<HTMLDivElement>(null);
  const sheet3Ref = useRef<HTMLDivElement>(null);

  const handleExportHtml = () => {
    try {
      const dateStr = reportData?.reportDate || selectedReportDate || "latest";
      const formattedDate = formatThaiFullDate(dateStr);
      const fileName = `รายงานสรุปยอดนักเรียนในหอพักประจำวัน_รวม3ใบ_${dateStr}.html`;
      const reportTitle = `รายงานสรุปยอดนักเรียนในหอพักประจำวัน (${formattedDate})`;
      
      exportCombinedDailyReportHtml(
        [
          "daily-report-printable-sheet1",
          "daily-report-printable-sheet2",
          "daily-report-printable-sheet3"
        ],
        fileName,
        reportTitle
      );
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก HTML: " + err.message);
    }
  };

  if (isLoading || !reportData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#A05AFF] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-600">กำลังประมวลผลสรุปรายงาน...</span>
        </div>
      </div>
    );
  }

  const {
    reportDate,
    summaryDate,
    dormitories,
    grades,
    totalMatrix,
    outMatrix,
    remainingMatrix,
    dormTotals,
    gradeTotals,
    grandTotals,
    absentStudentsList,
    headTeacherNotices = [],
    dormTeacherOrientations = []
  } = reportData;

  const formattedReportDateStr = formatThaiFullDate(reportDate);
  const formattedSummaryDateStr = formatThaiFullDate(summaryDate);

  const handleExportSheets = async () => {
    setIsExporting(true);
    setExportResult(null);
    try {
      const res = await onExportGoogleSheets(reportData);
      const targetFolderUrl = res.driveFolderUrl || res.spreadsheetUrl || GOOGLE_DRIVE_FOLDER_URL;
      
      setExportResult({
        url: targetFolderUrl,
        msg: res.message || "ส่งออกรายงานไปยังโฟลเดอร์ Google Drive เรียบร้อยแล้ว!"
      });

      // Automatically open the target Google Drive Folder in a new tab
      window.open(targetFolderUrl, "_blank");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการส่งออก Google Sheets: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const sheetInfoMap: Record<string, { title: string; subtitle: string; tag: string }> = {
    sheet1: {
      title: "ใบที่ 1: ตารางสรุปยอดจำนวนนักเรียน",
      subtitle: `สรุปยอดประจำวัน ${formattedReportDateStr} (ยอดเมื่อคืนนี้ ${formattedSummaryDateStr})`,
      tag: "ใบที่ 1 (ตารางสรุปยอด)"
    },
    sheet2: {
      title: "ใบที่ 2: ใบรายงานเรื่องแจ้งอบรมประจำวัน",
      subtitle: `เรื่องแจ้งอบรมจากหัวหน้างานและครูประจำหอพัก (${formattedSummaryDateStr})`,
      tag: "ใบที่ 2 (เรื่องแจ้งอบรม)"
    },
    sheet3: {
      title: "ใบที่ 3: ตารางรายชื่อนักเรียนออกหอพัก",
      subtitle: `รายชื่อนักเรียนออกหอพักคืนวัน ${formattedSummaryDateStr} (${absentStudentsList.length} คน)`,
      tag: "ใบที่ 3 (รายชื่อออกหอ)"
    }
  };

  // Capture Screenshot for LINE sharing handler
  const handleCaptureSheet = async (sheetKey: "sheet1" | "sheet2" | "sheet3") => {
    if (isCapturing) return;

    try {
      setIsCapturing(true);
      setCapturingSheetKey(sheetKey);
      setActiveTab(sheetKey);

      // Small delay to ensure DOM render & CSS styles are applied
      await new Promise((resolve) => setTimeout(resolve, 180));

      const sheetRefsMap: Record<string, HTMLElement | null> = {
        sheet1: sheet1Ref.current || document.getElementById("daily-report-printable-sheet1"),
        sheet2: sheet2Ref.current || document.getElementById("daily-report-printable-sheet2"),
        sheet3: sheet3Ref.current || document.getElementById("daily-report-printable-sheet3")
      };

      const targetEl = sheetRefsMap[sheetKey];
      if (!targetEl) {
        throw new Error("ไม่พบข้อมูลรายงานของใบที่เลือก");
      }

      // Generate sharp PNG image (pixelRatio 2.5) with skipFonts to avoid remote stylesheet CORS errors
      const dataUrl = await toPng(targetEl, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true,
        skipFonts: true,
        fontEmbedCSS: "",
        filter: (node: any) => {
          if (node.classList && typeof node.classList.contains === "function") {
            return !node.classList.contains("capture-ignore");
          }
          return true;
        }
      });

      setCapturedImageUrl(dataUrl);
      setCapturedSheetInfo({
        key: sheetKey,
        title: sheetInfoMap[sheetKey]?.title || "รายงานสรุปประจำวัน",
        subtitle: sheetInfoMap[sheetKey]?.subtitle || ""
      });
      setShowCaptureModal(true);

      // Auto-copy directly to clipboard for quick Ctrl + V into LINE
      try {
        const blob = await toBlob(targetEl, {
          pixelRatio: 2.5,
          backgroundColor: "#ffffff",
          cacheBust: true,
          skipFonts: true,
          fontEmbedCSS: "",
          filter: (node: any) => {
            if (node.classList && typeof node.classList.contains === "function") {
              return !node.classList.contains("capture-ignore");
            }
            return true;
          }
        });

        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob
            })
          ]);
          setCopyImageSuccess(true);
          setTimeout(() => setCopyImageSuccess(false), 3500);
        }
      } catch (clipErr) {
        console.warn("Direct clipboard copy fallback:", clipErr);
      }
    } catch (error: any) {
      console.error("Failed to capture sheet:", error);
      alert("เกิดข้อผิดพลาดในการแคปหน้าจอ: " + (error.message || "กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setIsCapturing(false);
      setCapturingSheetKey(null);
    }
  };

  // Re-copy image from preview modal
  const handleCopyImageAgain = () => {
    if (!capturedImageUrl) return;
    fetch(capturedImageUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob
            })
          ]);
          setCopyImageSuccess(true);
          setTimeout(() => setCopyImageSuccess(false), 3000);
        } else {
          alert("เบราว์เซอร์นี้ไม่รองรับการคัดลอกรูปภาพโดยตรง กรุณากดปุ่มดาวน์โหลดรูปภาพแทน");
        }
      })
      .catch((e) => console.error(e));
  };

  // User-triggered download of captured image
  const handleDownloadImage = () => {
    if (!capturedImageUrl) return;
    const link = document.createElement("a");
    link.href = capturedImageUrl;
    const sheetTag =
      capturedSheetInfo?.key === "sheet1"
        ? "ใบที่1_ตารางสรุปยอด"
        : capturedSheetInfo?.key === "sheet2"
        ? "ใบที่2_เรื่องแจ้งอบรม"
        : "ใบที่3_รายชื่อออกหอพัก";
    link.download = `รายงานประจำวัน_${sheetTag}_${reportDate || selectedReportDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Report Type Mode Switcher */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-2 print:hidden">
        <button
          onClick={() => setReportMode("dorm-summary")}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
            reportMode === "dorm-summary"
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-200/80 ring-2 ring-purple-400/40 scale-[1.01]"
              : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/70 border border-transparent hover:border-purple-100"
          }`}
        >
          <Building2 className={`w-4 h-4 shrink-0 ${reportMode === "dorm-summary" ? "text-white" : "text-purple-600"}`} />
          <span className="truncate">สรุปยอดนักเรียน</span>
        </button>

        <button
          onClick={() => setReportMode("daily")}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
            reportMode === "daily"
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-200/80 ring-2 ring-purple-400/40 scale-[1.01]"
              : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/70 border border-transparent hover:border-purple-100"
          }`}
        >
          <FileText className={`w-4 h-4 shrink-0 ${reportMode === "daily" ? "text-white" : "text-purple-600"}`} />
          <span className="truncate">สรุปยอดประจำวัน (Daily)</span>
        </button>

        <button
          onClick={() => setReportMode("monthly")}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
            reportMode === "monthly"
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-200/80 ring-2 ring-purple-400/40 scale-[1.01]"
              : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/70 border border-transparent hover:border-purple-100"
          }`}
        >
          <Calendar className={`w-4 h-4 shrink-0 ${reportMode === "monthly" ? "text-white" : "text-purple-600"}`} />
          <span className="truncate">สรุปเช็คยอดประจำเดือน</span>
        </button>

        <button
          onClick={() => setReportMode("dashboard")}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
            reportMode === "dashboard"
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-purple-200/80 ring-2 ring-purple-400/40 scale-[1.01]"
              : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/70 border border-transparent hover:border-purple-100"
          }`}
        >
          <BarChart3 className={`w-4 h-4 shrink-0 ${reportMode === "dashboard" ? "text-white" : "text-purple-600"}`} />
          <span className="truncate">รายงานวิเคราะห์สถิติ</span>
        </button>
      </div>

      {/* Conditional View Rendering based on reportMode */}
      {reportMode === "dashboard" ? (
        <DashboardReportView
          students={students}
          dorms={dorms}
          attendanceRecords={attendanceRecords}
          systemSettings={systemSettings}
          currentUser={currentUser}
          isLoading={isLoading}
        />
      ) : reportMode === "dorm-summary" ? (
        <DormitorySummaryReportView
          students={students}
          dorms={dorms}
          attendanceRecords={attendanceRecords}
          systemSettings={systemSettings}
          currentUser={currentUser}
          isLoading={isLoading}
        />
      ) : reportMode === "monthly" ? (
        <MonthlyReportView
          students={students}
          dorms={dorms}
          attendanceRecords={attendanceRecords}
          systemSettings={systemSettings}
          currentUser={currentUser}
          isLoading={isLoading}
        />
      ) : (
        <>
          {/* Header Toolbar (Hidden when printing) */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4 print:hidden">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase">
                <FileSpreadsheet className="w-4 h-4" />
                <span>รายงานสรุปประจำเช้าวันถัดไป (สำหรับเจ้าหน้าที่สำนักงาน)</span>
              </div>
              <h2 className="text-xl font-black text-gray-900 mt-1">
                รายงานสรุปยอดนักเรียนในหอพักประจำวัน
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                วันที่จัดทำสรุป: <strong>{formattedReportDateStr}</strong> • ยอดเมื่อคืนนี้: <strong>{formattedSummaryDateStr}</strong>
              </p>
            </div>

            {/* New Line: Date Selector & Export Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-gray-700">เลือกวันที่รายงาน:</span>
                <input
                  type="date"
                  value={selectedReportDate}
                  max={getTodayDateString()}
                  onChange={(e) => {
                    const val = e.target.value;
                    const todayStr = getTodayDateString();
                    if (val > todayStr) {
                      alert("⚠️ ไม่สามารถเลือกรายงานเกินวันที่ปัจจุบันได้");
                      setSelectedReportDate(todayStr);
                    } else {
                      setSelectedReportDate(val || todayStr);
                    }
                  }}
                  className="bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-[#A05AFF]"
                />
                <div className="bg-purple-50 border border-purple-200 text-[#A05AFF] text-xs font-extrabold rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-[#A05AFF] shrink-0" />
                  <span>{formatThaiFullDate(selectedReportDate)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* LINE Quick Screenshot Buttons Group */}
                <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-1 gap-1">
                  <div className="flex items-center gap-1 px-2 text-emerald-800 text-[11px] font-extrabold">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>แคปส่ง LINE:</span>
                  </div>
                  <button
                    onClick={() => handleCaptureSheet("sheet1")}
                    disabled={isCapturing}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === "sheet1"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-900 hover:bg-emerald-100 border border-emerald-200"
                    } ${isCapturing && capturingSheetKey === "sheet1" ? "opacity-70 animate-pulse" : ""}`}
                    title="แคปหน้าจอ ใบที่ 1 (ตารางสรุปยอด) คัดลอกลงคลิปบอร์ด ส่งเข้า LINE ได้ทันที"
                  >
                    {isCapturing && capturingSheetKey === "sheet1" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    <span>ใบที่ 1</span>
                  </button>

                  <button
                    onClick={() => handleCaptureSheet("sheet2")}
                    disabled={isCapturing}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === "sheet2"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-900 hover:bg-emerald-100 border border-emerald-200"
                    } ${isCapturing && capturingSheetKey === "sheet2" ? "opacity-70 animate-pulse" : ""}`}
                    title="แคปหน้าจอ ใบที่ 2 (ใบเรื่องแจ้งอบรม) คัดลอกลงคลิปบอร์ด ส่งเข้า LINE ได้ทันที"
                  >
                    {isCapturing && capturingSheetKey === "sheet2" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    <span>ใบที่ 2</span>
                  </button>

                  <button
                    onClick={() => handleCaptureSheet("sheet3")}
                    disabled={isCapturing}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === "sheet3"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-900 hover:bg-emerald-100 border border-emerald-200"
                    } ${isCapturing && capturingSheetKey === "sheet3" ? "opacity-70 animate-pulse" : ""}`}
                    title="แคปหน้าจอ ใบที่ 3 (รายชื่อออกหอพัก) คัดลอกลงคลิปบอร์ด ส่งเข้า LINE ได้ทันที"
                  >
                    {isCapturing && capturingSheetKey === "sheet3" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    <span>ใบที่ 3</span>
                  </button>
                </div>

                {currentUser && (
                  <button
                    onClick={handleExportHtml}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                    title="ส่งออกรายงานทั้ง 3 ใบ (ใบที่ 1, ใบที่ 2, ใบที่ 3) อยู่ในไฟล์ HTML เดียวกัน สะดวกในการเปิดดูและพิมพ์ A4"
                  >
                    <FileCode className="w-4 h-4 text-indigo-200" />
                    <span>ส่งออกรายงาน / พิมพ์ (HTML รวม 3 ใบ)</span>
                  </button>
                )}
              </div>
            </div>
          </div>


      {/* Google Sheets Export Result Banner */}
      {exportResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 flex items-center justify-between gap-4 animate-fade-in print:hidden">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm text-emerald-950">{exportResult.msg}</div>
              <div className="text-xs text-emerald-700 mt-0.5">
                ไฟล์จัดรูปแบบสีสวยงาม คอลัมน์ ม.1-ม.6, แถวหอพัก 1-6 และตารางนักเรียนออกหอพัก พร้อมช่องลงชื่อ
              </div>
            </div>
          </div>
          {exportResult.url && (
            <a
              href={exportResult.url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>เปิดใน Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Sheet Tabs Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab("sheet1")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sheet1"
              ? "bg-pink-600 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          ใบที่ 1. ตารางสรุปยอดจำนวนนักเรียน
        </button>

        <button
          onClick={() => setActiveTab("sheet2")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sheet2"
              ? "bg-pink-600 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          ใบที่ 2. ใบรายงานเรื่องแจ้งอบรมประจำวัน
        </button>

        <button
          onClick={() => setActiveTab("sheet3")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sheet3"
              ? "bg-pink-600 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          ใบที่ 3. ตารางรายชื่อนักเรียนออกหอพัก
        </button>
      </div>

      {/* SHEET 1: ตารางสรุปยอดจำนวนนักเรียน (แบ่ง 2 คอลัมน์ 2 แถว) */}
      {(activeTab === "sheet1" || typeof window !== "undefined") && (
        <div
          id="daily-report-printable-sheet1"
          ref={sheet1Ref}
          className={`bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4 ${activeTab !== "sheet1" ? "hidden print:block" : ""}`}
        >
          {/* Sheet Top Control Banner */}
          <div className="capture-ignore print:hidden flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-pink-600" />
              <span>เอกสารแบบฟอร์ม ใบที่ 1 (ตารางสรุปยอดจำนวนนักเรียน)</span>
            </span>
            <button
              onClick={() => handleCaptureSheet("sheet1")}
              disabled={isCapturing}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>แคปหน้าจอส่ง LINE (ใบที่ 1)</span>
            </button>
          </div>

          {/* Report Header Metadata */}
          <div className="border-b border-gray-200 pb-3 mb-5 text-center space-y-1">
            <h1 className="text-lg font-black text-gray-900">
              รายงานสรุปยอดจำนวนนักเรียนในหอพักประจำวัน
            </h1>
            <p className="text-xs font-bold text-gray-700">
              {systemSettings.schoolNameTh}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[11px] text-gray-700 font-semibold pt-1">
              <span>(สรุปรายงานเช็คยอดประจำวัน <strong className="text-pink-600">{formattedReportDateStr}</strong>)</span>
              <span className="hidden sm:inline">•</span>
              <span>(สรุปนักเรียนอยู่หอพักคืนวัน <strong className="text-purple-600">{formattedSummaryDateStr}</strong>)</span>
            </div>
          </div>

          {/* 2 COLUMNS x 2 ROWS GRID LAYOUT (A4 OPTIMIZED) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4">
            {/* ROW 1 COLUMN 1: Table 1 - จำนวนนักเรียนทั้งหมด */}
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                <span>1. ตารางจำนวนนักเรียนทั้งหมด</span>
              </h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-center text-[10px] sm:text-xs text-gray-800 border-collapse">
                  <thead>
                    <tr className="bg-purple-100 text-purple-900 font-bold border-b border-gray-300">
                      <th className="py-1.5 px-1.5 text-left border-r border-gray-300">หอพัก / ชั้น</th>
                      {grades.map((g) => (
                        <th key={g} className="py-1.5 px-1 border-r border-gray-300">{g}</th>
                      ))}
                      <th className="py-1.5 px-1.5 bg-purple-200 font-black">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dormitories.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-1 px-1.5 text-left font-bold text-gray-900 border-r border-gray-300">{d.name}</td>
                        {grades.map((g) => (
                          <td key={g} className="py-1 px-1 border-r border-gray-300">{totalMatrix[d.id]?.[g] || 0}</td>
                        ))}
                        <td className="py-1 px-1.5 font-bold text-purple-900 bg-purple-50">{dormTotals[d.id]?.total || 0}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-purple-100/70 font-black text-purple-950 border-t-2 border-purple-300">
                      <td className="py-1.5 px-1.5 text-left border-r border-gray-300">รวมทั้งสิ้น</td>
                      {grades.map((g) => (
                        <td key={g} className="py-1.5 px-1 border-r border-gray-300">{gradeTotals[g]?.total || 0}</td>
                      ))}
                      <td className="py-1.5 px-1.5 font-black bg-purple-200">{grandTotals.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 1 COLUMN 2: Table 2 - จำนวนนักเรียนออกหอพัก */}
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                <span>2. ตารางจำนวนนักเรียนออกหอพัก</span>
              </h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-center text-[10px] sm:text-xs text-gray-800 border-collapse">
                  <thead>
                    <tr className="bg-rose-100 text-rose-900 font-bold border-b border-gray-300">
                      <th className="py-1.5 px-1.5 text-left border-r border-gray-300">หอพัก / ชั้น</th>
                      {grades.map((g) => (
                        <th key={g} className="py-1.5 px-1 border-r border-gray-300">{g}</th>
                      ))}
                      <th className="py-1.5 px-1.5 bg-rose-200 font-black">รวมออก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dormitories.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-1 px-1.5 text-left font-bold text-gray-900 border-r border-gray-300">{d.name}</td>
                        {grades.map((g) => (
                          <td key={g} className="py-1 px-1 border-r border-gray-300">{outMatrix[d.id]?.[g] || 0}</td>
                        ))}
                        <td className="py-1 px-1.5 font-bold text-rose-900 bg-rose-50">{dormTotals[d.id]?.out || 0}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-rose-100/70 font-black text-rose-950 border-t-2 border-rose-300">
                      <td className="py-1.5 px-1.5 text-left border-r border-gray-300">รวมทั้งสิ้น</td>
                      {grades.map((g) => (
                        <td key={g} className="py-1.5 px-1 border-r border-gray-300">{gradeTotals[g]?.out || 0}</td>
                      ))}
                      <td className="py-1.5 px-1.5 font-black bg-rose-200">{grandTotals.out}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 2 COLUMN 1: Table 3 - จำนวนนักเรียนคงเหลือแต่ละหอพัก */}
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>3. ตารางจำนวนนักเรียนคงเหลือแต่ละหอพัก</span>
              </h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-center text-[10px] sm:text-xs text-gray-800 border-collapse">
                  <thead>
                    <tr className="bg-emerald-100 text-emerald-900 font-bold border-b border-gray-300">
                      <th className="py-1.5 px-1.5 text-left border-r border-gray-300">หอพัก / ชั้น</th>
                      {grades.map((g) => (
                        <th key={g} className="py-1.5 px-1 border-r border-gray-300">{g}</th>
                      ))}
                      <th className="py-1.5 px-1.5 bg-emerald-200 font-black">คงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dormitories.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="py-1 px-1.5 text-left font-bold text-gray-900 border-r border-gray-300">{d.name}</td>
                        {grades.map((g) => (
                          <td key={g} className="py-1 px-1 border-r border-gray-300">{remainingMatrix[d.id]?.[g] || 0}</td>
                        ))}
                        <td className="py-1 px-1.5 font-bold text-emerald-900 bg-emerald-50">{dormTotals[d.id]?.remaining || 0}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-emerald-100/70 font-black text-emerald-950 border-t-2 border-emerald-300">
                      <td className="py-1.5 px-1.5 text-left border-r border-gray-300">รวมทั้งสิ้น</td>
                      {grades.map((g) => (
                        <td key={g} className="py-1.5 px-1 border-r border-gray-300">{gradeTotals[g]?.remaining || 0}</td>
                      ))}
                      <td className="py-1.5 px-1.5 font-black bg-emerald-200">{grandTotals.remaining}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 2 COLUMN 2: Table 4 - สรุปภาพรวมสถิตินักเรียนทั้งหมดในหอพัก */}
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-xs text-gray-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>4. สรุปภาพรวมสถิตินักเรียนทั้งหมดในหอพัก</span>
              </h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-center text-[10px] sm:text-xs text-gray-800 border-collapse">
                  <thead>
                    <tr className="bg-blue-100 text-blue-900 font-bold border-b border-gray-300">
                      <th className="py-1.5 px-2 text-left border-r border-gray-300">รายการสถิติ</th>
                      <th className="py-1.5 px-2 border-r border-gray-300">จำนวน (คน)</th>
                      <th className="py-1.5 px-2 bg-blue-200 font-black">คิดเป็นร้อยละ (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-left font-bold text-gray-900 border-r border-gray-300">นักเรียนหอพักทั้งหมด</td>
                      <td className="py-2 px-2 font-bold text-gray-900 border-r border-gray-300">{grandTotals.total}</td>
                      <td className="py-2 px-2 font-bold text-blue-900 bg-blue-50">100.00%</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-left font-bold text-emerald-800 border-r border-gray-300">นักเรียนที่อยู่ในหอพัก (ปกติ)</td>
                      <td className="py-2 px-2 font-bold text-emerald-800 border-r border-gray-300">{grandTotals.remaining}</td>
                      <td className="py-2 px-2 font-bold text-emerald-900 bg-emerald-50">
                        {((grandTotals.remaining / (grandTotals.total || 1)) * 100).toFixed(2)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-left font-bold text-rose-800 border-r border-gray-300">นักเรียนออกหอพัก</td>
                      <td className="py-2 px-2 font-bold text-rose-800 border-r border-gray-300">{grandTotals.out}</td>
                      <td className="py-2 px-2 font-bold text-rose-900 bg-rose-50">
                        {((grandTotals.out / (grandTotals.total || 1)) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SIGNATURE SECTION (2 Rows x 2 Columns - No Borders, Spaced below tables) */}
          <div className="pt-6 mt-4">
            {/* 2 แถวว่างก่อน แถวที่ 1 */}
            <div className="h-6"></div>

            <div className="grid grid-cols-2 gap-x-8 text-center text-[11px] text-gray-800">
              {/* Row 1 Col 1: ผู้รายงาน (เจ้าหน้าที่สำนักงาน) */}
              <div className="space-y-1">
                <p className="font-medium text-gray-800">ลงชื่อ.....................................................................</p>
                <p className="text-gray-600 font-medium">(.....................................................)</p>
                <p className="font-bold text-gray-900">ผู้รายงาน (เจ้าหน้าที่สำนักงาน)</p>
              </div>

              {/* Row 1 Col 2: หัวหน้างานหอพัก */}
              <div className="space-y-1">
                <p className="font-medium text-gray-800">ลงชื่อ.....................................................................</p>
                <p className="text-gray-600 font-medium">(.....................................................)</p>
                <p className="font-bold text-gray-900">หัวหน้างานหอพัก</p>
              </div>
            </div>

            {/* 4 แถวว่างก่อน แถวที่ 2 */}
            <div className="h-12"></div>

            <div className="grid grid-cols-2 gap-x-8 text-center text-[11px] text-gray-800">
              {/* Row 2 Col 1: Blank / ปล่อยว่างไว้ */}
              <div></div>

              {/* Row 2 Col 2: รองผู้อำนวยการ */}
              <div className="space-y-1">
                <p className="font-medium text-gray-800">ลงชื่อ.....................................................................</p>
                <p className="text-gray-600 font-medium">(.....................................................)</p>
                <p className="font-bold text-gray-900">รองผู้อำนวยการ</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHEET 2: ใบรายงานเรื่องแจ้งอบรมประจำวัน (แบ่ง 2 คอลัมน์สำหรับ A4 1 หน้า) */}
      {(activeTab === "sheet2" || typeof window !== "undefined") && (
        <div
          id="daily-report-printable-sheet2"
          ref={sheet2Ref}
          className={`bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4 ${activeTab !== "sheet2" ? "hidden print:block" : ""}`}
        >
          {/* Sheet Top Control Banner */}
          <div className="capture-ignore print:hidden flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
              <span>เอกสารแบบฟอร์ม ใบที่ 2 (ใบรายงานเรื่องแจ้งอบรมประจำวัน)</span>
            </span>
            <button
              onClick={() => handleCaptureSheet("sheet2")}
              disabled={isCapturing}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>แคปหน้าจอส่ง LINE (ใบที่ 2)</span>
            </button>
          </div>

          <div className="border-b border-gray-200 pb-3 mb-5 text-center space-y-1">
            <h1 className="text-lg font-black text-gray-900">
              ใบรายงานเรื่องแจ้งอบรมประจำวัน
            </h1>
            <p className="text-xs font-bold text-purple-700">
              สรุปเรื่องแจ้งอบรมเมื่อคืนวัน {formattedSummaryDateStr} (รายงานเช้าวัน {formattedReportDateStr})
            </p>
            <div className="text-[11px] text-gray-500 font-medium">
              {systemSettings.schoolNameTh}
            </div>
          </div>

          {/* 2-COLUMN LAYOUT FOR A4 SINGLE PAGE */}
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
            {/* 1. เรื่องแจ้งอบรมจากหัวหน้างานหอพัก */}
            <div className="space-y-2 bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
              <h3 className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>1. เรื่องแจ้งอบรมจากหัวหน้างานหอพัก</span>
              </h3>
              {headTeacherNotices && headTeacherNotices.length > 0 ? (
                <div className="space-y-2">
                  {headTeacherNotices.map((notice) => (
                    <div key={notice.id} className="bg-white p-2.5 rounded-lg border border-purple-100 shadow-2xs space-y-1">
                      <div className="text-[11px] font-bold text-purple-950 flex items-center justify-between">
                        <span>📌 {notice.title}</span>
                        <span className="text-[9px] text-purple-600 font-normal">โดย: {notice.createdBy}</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-gray-700 space-y-0.5 pl-1">
                        {notice.topics.map((tp, idx) => (
                          <li key={idx} className="font-medium">{tp}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic bg-white p-2.5 rounded-lg border border-purple-100">
                  ไม่มีเรื่องแจ้งอบรมจากหัวหน้างานหอพักในวันนี้
                </p>
              )}
            </div>

            {/* 2. เรื่องที่ครูประจำหอพักอบรมนักเรียน */}
            <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. เรื่องที่ครูประจำหอพักอบรมนักเรียน</span>
              </h3>
              <div className="space-y-2">
                {dormTeacherOrientations && dormTeacherOrientations.length > 0 ? (
                  dormTeacherOrientations.map((orient) => (
                    <div key={orient.dormId} className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between gap-1 border-b border-gray-100 pb-1">
                        <span className="text-[11px] font-extrabold text-gray-900">{orient.dormName}</span>
                        <span className="text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md shrink-0">
                          ครู: <span className="text-purple-950 font-black">{orient.checkedBy || "ครูประจำหอพัก"}</span>
                        </span>
                      </div>
                      {orient.orientationNotes && orient.orientationNotes.length > 0 ? (
                        <ul className="list-disc list-inside text-[11px] text-gray-700 space-y-0.5">
                          {orient.orientationNotes.map((note, idx) => (
                            <li key={idx} className="font-medium">{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">ไม่มีบันทึกเรื่องอบรมประจำวัน</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-gray-500 italic">ไม่มีข้อมูลเรื่องอบรมจากครูประจำหอพัก</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHEET 3: ตารางรายชื่อนักเรียนออกหอพัก */}
      {(activeTab === "sheet3" || typeof window !== "undefined") && (
        <div
          id="daily-report-printable-sheet3"
          ref={sheet3Ref}
          className={`bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4 ${activeTab !== "sheet3" ? "hidden print:block" : ""}`}
        >
          {/* Sheet Top Control Banner */}
          <div className="capture-ignore print:hidden flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-pink-600" />
              <span>เอกสารแบบฟอร์ม ใบที่ 3 (ตารางรายชื่อนักเรียนออกหอพัก)</span>
            </span>
            <button
              onClick={() => handleCaptureSheet("sheet3")}
              disabled={isCapturing}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>แคปหน้าจอส่ง LINE (ใบที่ 3)</span>
            </button>
          </div>

          <div className="border-b border-gray-200 pb-3 mb-5 text-center space-y-1">
            <h1 className="text-lg font-black text-gray-900">
              ตารางรายชื่อนักเรียนออกหอพัก
            </h1>
            <p className="text-xs font-bold text-purple-700">
              รายชื่อนักเรียนออกหอพักคืนวัน {formattedSummaryDateStr}
            </p>
            <div className="text-[11px] text-gray-500 font-medium">
              {systemSettings.schoolNameTh}
            </div>
          </div>

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-[11px] text-gray-800 border-collapse">
              <thead className="bg-pink-100 text-pink-900 font-bold border-b border-gray-300">
                <tr>
                  <th className="py-2 px-3 w-10 text-center border-r border-gray-300">ที่</th>
                  <th className="py-2 px-3 w-24 border-r border-gray-300">รหัสนักเรียน</th>
                  <th className="py-2 px-3 border-r border-gray-300">รายชื่อนักเรียน</th>
                  <th className="py-2 px-3 border-r border-gray-300">ระดับชั้น/ห้อง</th>
                  <th className="py-2 px-3 border-r border-gray-300">หอพัก</th>
                  <th className="py-2 px-3">เหตุผลที่ออกหอพัก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {absentStudentsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">
                      ไม่มีนักเรียนออกหอพักเมื่อคืนนี้ (นักเรียนอยู่หอพักครบทุกคน)
                    </td>
                  </tr>
                ) : (
                  absentStudentsList.map((s) => (
                    <tr key={s.studentId} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-center font-bold text-gray-700 border-r border-gray-300">{s.no}</td>
                      <td className="py-2 px-3 font-mono font-bold text-gray-800 border-r border-gray-300">{s.studentId}</td>
                      <td className="py-2 px-3 font-bold text-gray-900 border-r border-gray-300">{s.fullName}</td>
                      <td className="py-2 px-3 font-semibold text-gray-700 border-r border-gray-300">{s.gradeRoom}</td>
                      <td className="py-2 px-3 font-medium text-pink-700 border-r border-gray-300">{s.dormName}</td>
                      <td className="py-2 px-3 font-bold text-rose-600">{s.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 text-[11px] text-gray-500 flex justify-between items-center">
            <span>รวมนักเรียนออกหอพักทั้งหมด: <strong className="text-gray-900">{absentStudentsList.length}</strong> คน</span>
            <span>ผู้สรุปรายงาน: เจ้าหน้าที่สำนักงาน</span>
          </div>
        </div>
      )}
        </>
      )}

      {/* Screenshot Capture LINE Sharing Modal */}
      {showCaptureModal && capturedImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>แคปภาพรายงานสำหรับส่ง LINE เรียบร้อย!</span>
                  </h3>
                  <p className="text-xs text-emerald-100 font-medium">
                    {capturedSheetInfo?.title} • {capturedSheetInfo?.subtitle}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCaptureModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content / Alert */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
              {/* Copy Success Banner */}
              <div className={`rounded-2xl p-3.5 border transition-all flex items-start gap-3 ${
                copyImageSuccess
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400/30"
                  : "bg-teal-50/90 border-teal-200 text-teal-950"
              }`}>
                <div className={`p-2 rounded-xl shrink-0 ${copyImageSuccess ? "bg-emerald-600 text-white" : "bg-teal-600 text-white"}`}>
                  {copyImageSuccess ? <Check className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-extrabold text-sm">
                    {copyImageSuccess
                      ? "✅ คัดลอกรูปภาพลงคลิปบอร์ดแล้ว (Copied to Clipboard)!"
                      : "💬 พร้อมส่งเข้าแชท LINE ทันที"}
                  </div>
                  <div className="text-gray-700 font-medium leading-relaxed">
                    คุณสามารถสลับไปที่หน้าต่างแชท LINE แล้วกดปุ่มลัด <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-md font-mono text-[11px] font-bold text-gray-800 shadow-2xs">Ctrl + V</kbd> (หรือคลิกขวา &gt; Paste / วาง) เพื่อส่งภาพรายงานได้ทันทีโดยไม่ต้องดาวน์โหลดไฟล์ลงเครื่อง
                  </div>
                </div>
              </div>

              {/* Image Preview Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-gray-600 px-1">
                  <span>ตัวอย่างภาพที่ถูกแคป (ความละเอียดสูง):</span>
                  <span className="text-[11px] text-gray-400">ขนาดภาพคมชัด 2.5x Resolution</span>
                </div>
                <div className="border border-gray-200 rounded-2xl p-2 bg-white shadow-inner max-h-[50vh] overflow-y-auto flex justify-center">
                  <img
                    src={capturedImageUrl}
                    alt={capturedSheetInfo?.title || "Daily Report"}
                    className="max-w-full h-auto rounded-xl shadow-xs object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setShowCaptureModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadImage}
                  className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                  <span>ดาวน์โหลดภาพ (PNG)</span>
                </button>

                <button
                  onClick={handleCopyImageAgain}
                  className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200 rounded-xl transition cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  {copyImageSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>คัดลอกลงคลิปบอร์ดแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกภาพส่ง LINE (Ctrl + V)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

