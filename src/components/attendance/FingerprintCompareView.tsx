import React, { useEffect, useMemo, useState } from "react";
import { DailyAttendance, Dormitory, Student, SystemSettings, UserProfile } from "../../types";
import {
  compareFingerprintWithDorm,
  ComparisonCategory,
  downloadScannerSampleTemplate,
  extractScannerRows,
  formatIsoToThaiSlash,
  ParsedScannerTable,
  parseScannerPastedText,
  PunctualityStatus,
  StudentComparisonItem
} from "../../utils/fingerprintCompareUtils";
import { formatThaiFullDate, formatThaiMediumDate, getPreviousDateString, getTodayDateString } from "../../utils/dateUtils";
import { extractDormNumber } from "../../utils/dormUtils";
import {
  buildLateDormSummaryByDorm,
  formatThaiOfficialLateHeaderDate,
  LateReportPrintScope,
  printLateDormReport
} from "../../utils/lateReportPrintExporter";
import { ThaiDatePicker } from "../common/ThaiDatePicker";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Download,
  Fingerprint,
  HelpCircle,
  Printer,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  Users,
  UserX,
  X
} from "lucide-react";

interface FingerprintCompareViewProps {
  students: Student[];
  dorms: Dormitory[];
  attendanceRecords: DailyAttendance[];
  systemSettings?: SystemSettings;
  currentUser?: UserProfile | null;
  onNavigateToCheck?: (dormId?: string, date?: string) => void;
}

type ResultTabKey =
  | "ALL"
  | "EARLY"
  | "LATE_SCANNED"
  | "LATE_NOT_SCANNED"
  | "OUT_ALL"
  | "OUT_BUT_SCANNED"
  | "UNCHECKED"
  | "UNMATCHED";

export const FingerprintCompareView: React.FC<FingerprintCompareViewProps> = ({
  students,
  dorms,
  attendanceRecords,
  systemSettings,
  currentUser,
  onNavigateToCheck
}) => {
  const todayStr = getTodayDateString();

  // Pasted table text & error
  const [pasteText, setPasteText] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");

  // Parsed table & column mapping
  const [parsedTable, setParsedTable] = useState<ParsedScannerTable | null>(null);
  const [colMapping, setColMapping] = useState<{
    idCol: number;
    nameCol: number;
    lastNameCol: number;
    dateCol: number;
    timeCol: number;
  }>({ idCol: 0, nameCol: 1, lastNameCol: -1, dateCol: 2, timeCol: -1 });
  const [showColumnMapper, setShowColumnMapper] = useState<boolean>(false);

  // Date, Scan Time Window & Filters
  const [scanDateFilter, setScanDateFilter] = useState<string>("ALL");
  const [attendanceDate, setAttendanceDate] = useState<string>(getPreviousDateString(todayStr));
  const [startTime, setStartTime] = useState<string>("06:00");
  const [endTime, setEndTime] = useState<string>("07:00");
  const [dormFilter, setDormFilter] = useState<string>("ALL");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [activeResultTab, setActiveResultTab] = useState<ResultTabKey>("ALL");

  // Print Preview Modal State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");
  const [printScope, setPrintScope] = useState<LateReportPrintScope>("LATE_ALL");
  const [printReportDate, setPrintReportDate] = useState<string>(todayStr);
  const [printError, setPrintError] = useState<string>("");

  // Extract structured rows from parsed table using current mapping
  const scannerRows = useMemo(() => {
    if (!parsedTable) return [];
    return extractScannerRows(parsedTable, colMapping);
  }, [parsedTable, colMapping]);

  // Unique scan dates found in uploaded file
  const availableScanDates = useMemo(() => {
    const countsMap = new Map<string, number>();
    scannerRows.forEach((r) => {
      if (r.isoDate) {
        countsMap.set(r.isoDate, (countsMap.get(r.isoDate) || 0) + 1);
      }
    });
    return Array.from(countsMap.entries())
      .map(([isoDate, count]) => ({ isoDate, count }))
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [scannerRows]);

  // Most frequent (primary) scan date found in the uploaded/pasted file
  const primaryScanDate = useMemo(() => {
    if (availableScanDates.length === 0) return "";
    const countsMap = new Map<string, number>();
    scannerRows.forEach((r) => {
      if (r.isoDate) {
        countsMap.set(r.isoDate, (countsMap.get(r.isoDate) || 0) + 1);
      }
    });
    const sorted = Array.from(countsMap.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].localeCompare(a[0]);
    });
    return sorted[0]?.[0] || "";
  }, [scannerRows, availableScanDates.length]);

  // Effective scan date from file used across report views
  const effectiveFileScanDate = useMemo(() => {
    if (scanDateFilter !== "ALL") return scanDateFilter;
    return primaryScanDate || availableScanDates[0]?.isoDate || "";
  }, [scanDateFilter, primaryScanDate, availableScanDates]);

  // Keep report header date synced to the file's fingerprint scan date
  useEffect(() => {
    if (effectiveFileScanDate) {
      setPrintReportDate(effectiveFileScanDate);
    }
  }, [effectiveFileScanDate]);

  // Apply table result helper
  const applyParsedTable = (table: ParsedScannerTable) => {
    setParsedTable(table);
    setColMapping(table.detectedColumns);
    setParseError("");

    const extracted = extractScannerRows(table, table.detectedColumns);
    const dateCounts = new Map<string, number>();
    extracted.forEach((r) => {
      if (r.isoDate) {
        dateCounts.set(r.isoDate, (dateCounts.get(r.isoDate) || 0) + 1);
      }
    });

    const sortedDates = Array.from(dateCounts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].localeCompare(a[0]);
    });
    if (sortedDates.length > 0) {
      const primaryDate = sortedDates[0][0];
      setScanDateFilter(primaryDate);
      // เทียบผลเช็คยอดของคืนก่อนหน้า (-1 วัน) โดยอัตโนมัติ เช่น สแกน 14/11/2569 -> เทียบคืน 13/11/2569
      setAttendanceDate(getPreviousDateString(primaryDate));
      setPrintReportDate(primaryDate);
    } else {
      setScanDateFilter("ALL");
      setPrintReportDate(todayStr);
    }

    setActiveResultTab("ALL");
  };

  const handleParsePasted = () => {
    if (!pasteText.trim()) {
      setParseError("กรุณาวางข้อมูลรายชื่อจากระบบสแกนลายนิ้วมือก่อนกดประมวลผล");
      return;
    }
    setParseError("");
    try {
      const table = parseScannerPastedText(pasteText);
      if (table.rows.length === 0) {
        throw new Error("ไม่พบแถวข้อมูลที่สามารถอ่านได้");
      }
      applyParsedTable(table);
    } catch (err: any) {
      setParseError(err?.message || "ไม่สามารถอ่านข้อมูลที่วางได้");
    }
  };

  const handleResetData = () => {
    setParsedTable(null);
    setPasteText("");
    setParseError("");
    setShowColumnMapper(false);
  };

  // Perform Comparison
  const comparison = useMemo(() => {
    return compareFingerprintWithDorm({
      scannerRows,
      scanDateFilter,
      attendanceDate,
      startTime,
      endTime,
      hasTimeColumn: colMapping.timeCol >= 0,
      students,
      dorms,
      attendanceRecords,
      dormFilter,
      gradeFilter
    });
  }, [
    scannerRows,
    scanDateFilter,
    attendanceDate,
    startTime,
    endTime,
    colMapping.timeCol,
    students,
    dorms,
    attendanceRecords,
    dormFilter,
    gradeFilter
  ]);

  const checkedDormsCount = useMemo(
    () => comparison.dormCheckStatus.filter((d) => d.isChecked).length,
    [comparison.dormCheckStatus]
  );

  const uncheckedDormsList = useMemo(
    () => comparison.dormCheckStatus.filter((d) => !d.isChecked),
    [comparison.dormCheckStatus]
  );

  // Filter items by active tab
  const filteredItems = useMemo(() => {
    return comparison.items.filter((item) => {
      if (
        activeResultTab === "ALL" &&
        (item.isDormOut ||
          (item.punctualityStatus !== "EARLY" &&
            item.punctualityStatus !== "LATE_SCANNED" &&
            item.punctualityStatus !== "LATE_NOT_SCANNED"))
      ) {
        return false;
      }
      if (
        activeResultTab === "LATE_NOT_SCANNED" &&
        (item.isDormOut || item.punctualityStatus !== "LATE_NOT_SCANNED")
      ) {
        return false;
      }
      if (
        activeResultTab === "LATE_SCANNED" &&
        (item.isDormOut || item.punctualityStatus !== "LATE_SCANNED")
      ) {
        return false;
      }
      if (activeResultTab === "EARLY" && (item.isDormOut || item.punctualityStatus !== "EARLY")) {
        return false;
      }
      if (activeResultTab === "OUT_ALL" && !item.isDormOut) return false;
      if (activeResultTab === "OUT_BUT_SCANNED" && item.category !== "OUT_BUT_SCANNED") return false;
      if (
        activeResultTab === "UNCHECKED" &&
        item.category !== "UNCHECKED_SCANNED" &&
        item.category !== "UNCHECKED_NOT_SCANNED"
      ) {
        return false;
      }

      return true;
    });
  }, [comparison.items, activeResultTab]);

  const filteredUnmatched = comparison.unmatchedScannerRows;

  const dormFilterLabel = useMemo(() => {
    if (dormFilter === "ALL") return "ทุกหอพัก";
    return dorms.find((d) => d.id === dormFilter)?.name || "ทุกหอพัก";
  }, [dormFilter, dorms]);

  const gradeFilterLabel = useMemo(() => {
    return gradeFilter === "ALL" ? "ทุกระดับชั้น" : gradeFilter;
  }, [gradeFilter]);

  // Items shown inside the Late Dormitory Print Report (sorted by Dorm 1 -> Dorm 6)
  const printItems = useMemo(() => {
    const filtered = comparison.items.filter((item) => {
      if (item.isDormOut) return false;
      switch (printScope) {
        case "LATE_SCANNED":
          return item.punctualityStatus === "LATE_SCANNED";
        case "LATE_NOT_SCANNED":
          return item.punctualityStatus === "LATE_NOT_SCANNED";
        case "ALL_FLAGGED":
          return (
            item.punctualityStatus === "EARLY" ||
            item.punctualityStatus === "LATE_SCANNED" ||
            item.punctualityStatus === "LATE_NOT_SCANNED"
          );
        case "LATE_ALL":
        default:
          return (
            item.punctualityStatus === "LATE_SCANNED" ||
            item.punctualityStatus === "LATE_NOT_SCANNED"
          );
      }
    });

    return [...filtered].sort((a, b) => {
      const numA = parseInt(extractDormNumber(a.dorm?.name || a.dormName) || "999", 10);
      const numB = parseInt(extractDormNumber(b.dorm?.name || b.dormName) || "999", 10);
      if (numA !== numB) return numA - numB;
      const dormCmp = a.dormName.localeCompare(b.dormName, "th", { numeric: true });
      if (dormCmp !== 0) return dormCmp;
      const gradeCmp = a.gradeRoom.localeCompare(b.gradeRoom, "th", { numeric: true });
      if (gradeCmp !== 0) return gradeCmp;
      return a.formattedId.localeCompare(b.formattedId);
    });
  }, [comparison.items, printScope]);

  const printDormSummary = useMemo(
    () => buildLateDormSummaryByDorm(printItems, dorms),
    [printItems, dorms]
  );

  const printLateScannedTotal = useMemo(
    () => printItems.filter((i) => i.punctualityStatus === "LATE_SCANNED").length,
    [printItems]
  );
  const printLateNotScannedTotal = useMemo(
    () => printItems.filter((i) => i.punctualityStatus === "LATE_NOT_SCANNED").length,
    [printItems]
  );
  const printEarlyTotal = useMemo(
    () => printItems.filter((i) => i.punctualityStatus === "EARLY").length,
    [printItems]
  );

  const handleOpenPrintPreview = () => {
    setPrintError("");
    const defaultDate = effectiveFileScanDate || todayStr;
    setPrintReportDate(defaultDate);

    if (activeResultTab === "LATE_SCANNED") {
      setPrintScope("LATE_SCANNED");
    } else if (activeResultTab === "LATE_NOT_SCANNED") {
      setPrintScope("LATE_NOT_SCANNED");
    } else {
      setPrintScope("LATE_ALL");
    }
    setIsPrintPreviewOpen(true);
  };

  const handleExecutePrint = () => {
    try {
      setPrintError("");
      printLateDormReport({
        items: printItems,
        dorms,
        reportDate: printReportDate,
        attendanceDate,
        startTime,
        endTime,
        dormFilterLabel,
        gradeFilterLabel,
        orientation: printOrientation,
        currentUser,
        systemSettings
      });
    } catch (err: any) {
      setPrintError("ไม่สามารถเปิดหน้าต่างพิมพ์ได้: " + (err?.message || err));
    }
  };

  const renderPunctualityStatus = (item: StudentComparisonItem) => {
    if (item.category === "OUT_BUT_SCANNED") {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            แจ้งออกหอ แต่พบสแกนนิ้ว ({item.scannerInfo?.earliestTime || "-"} น.)
          </span>
          <div className="text-[11px] text-amber-700 font-medium">{item.punctualityLabel}</div>
        </div>
      );
    }

    const status: PunctualityStatus = item.punctualityStatus;
    switch (status) {
      case "LATE_NOT_SCANNED":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <UserX className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-slate-500">{item.punctualityDetail}</div>
          </div>
        );
      case "LATE_SCANNED":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200 tabular-nums">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-orange-700 tabular-nums">{item.punctualityDetail}</div>
          </div>
        );
      case "EARLY":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 tabular-nums">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-sky-700 tabular-nums">{item.punctualityDetail}</div>
          </div>
        );
      case "ON_TIME":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-slate-500 tabular-nums">{item.punctualityDetail}</div>
          </div>
        );
      case "OUT_OF_DORM":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <UserMinus className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-slate-500">{item.punctualityDetail}</div>
          </div>
        );
      case "SCANNED_NO_TIME":
        return (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <Fingerprint className="w-3.5 h-3.5 shrink-0" />
              {item.punctualityLabel}
            </span>
            <div className="text-[11px] text-slate-500">{item.punctualityDetail}</div>
          </div>
        );
    }
  };

  const renderCategoryText = (category: ComparisonCategory) => {
    switch (category) {
      case "PRESENT_NOT_SCANNED":
      case "PRESENT_SCANNED":
        return "อยู่หอพัก";
      case "OUT_CONFIRMED":
        return "ออกหอพัก";
      case "OUT_BUT_SCANNED":
        return "แจ้งออกหอ แต่สแกน";
      case "UNCHECKED_SCANNED":
      case "UNCHECKED_NOT_SCANNED":
        return "ยังไม่เช็คยอดหอ";
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                ลงหอสาย
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                นำเข้าข้อมูลสแกนลายนิ้วมือ (ใช้ 5 ตัวท้ายของรหัส เช่น M-69-M-06068 → 06068) เพื่อตรวจสอบนักเรียนที่สแกนก่อนเวลา สาย และออกหอพัก
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadScannerSampleTemplate(students)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Step 1: Paste Fingerprint Scanner Data */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
            1. นำเข้าข้อมูลจากระบบสแกนลายนิ้วมือ
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-0.5">
            <span>คัดลอกข้อมูลจาก Excel หรือระบบสแกนนิ้วมาวาง</span>
            <span aria-hidden="true">·</span>
            <span>ตัดเทียบ 5 ตัวท้ายอัตโนมัติ (เช่น M-69-M-06068 → 06068)</span>
            <span aria-hidden="true">·</span>
            <span>สแกน 14/11/2569 → เทียบยอดเช็คหอคืน 13/11/2569</span>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={`วางข้อมูลที่คัดลอกมาจาก Excel หรือระบบสแกนลายนิ้วมือ เช่น:\nรหัสนักเรียน\tชื่อ-นามสกุล\tวันที่สแกน\tเวลาสแกน\nM-69-M-06068\tจิโรจน์ มูลอัง\t14/11/2569\t06:45`}
            className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3.5 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              รองรับข้อมูลคั่นด้วย Tab (ก๊อปจาก Excel), Comma (,) หรือ Semicolon (;)
            </span>
            <button
              type="button"
              onClick={handleParsePasted}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>ประมวลผลข้อมูลที่วาง</span>
            </button>
          </div>
        </div>

        {parseError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Controls & Column Mapping when parsedTable exists */}
        {parsedTable && (
          <div className="pt-2 space-y-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-bold text-slate-800">คอลัมน์ที่ตรวจพบ:</span>
                <span>
                  รหัสนักเรียน = <strong>{parsedTable.headers[colMapping.idCol] || `คอลัมน์ ${colMapping.idCol + 1}`}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  ชื่อ-นามสกุล ={" "}
                  <strong>
                    {parsedTable.headers[colMapping.nameCol] || `คอลัมน์ ${colMapping.nameCol + 1}`}
                    {colMapping.lastNameCol >= 0 ? ` + ${parsedTable.headers[colMapping.lastNameCol]}` : ""}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  วันที่สแกน = <strong>{parsedTable.headers[colMapping.dateCol] || `คอลัมน์ ${colMapping.dateCol + 1}`}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  เวลาสแกน ={" "}
                  <strong>
                    {colMapping.timeCol >= 0
                      ? parsedTable.headers[colMapping.timeCol] || `คอลัมน์ ${colMapping.timeCol + 1}`
                      : "อ่านจากช่องวันที่ / ไม่มี"}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowColumnMapper((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showColumnMapper ? "ซ่อนการตั้งค่าคอลัมน์" : "ปรับคอลัมน์เอง"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างข้อมูล</span>
                </button>
              </div>
            </div>

            {showColumnMapper && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คอลัมน์รหัสนักเรียน</label>
                  <select
                    value={colMapping.idCol}
                    onChange={(e) => setColMapping((prev) => ({ ...prev, idCol: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    {parsedTable.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คอลัมน์ชื่อ (หรือชื่อ-สกุล)</label>
                  <select
                    value={colMapping.nameCol}
                    onChange={(e) => setColMapping((prev) => ({ ...prev, nameCol: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value={-1}>-- ไม่ระบุ --</option>
                    {parsedTable.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คอลัมน์นามสกุล (ถ้าแยกช่อง)</label>
                  <select
                    value={colMapping.lastNameCol}
                    onChange={(e) => setColMapping((prev) => ({ ...prev, lastNameCol: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value={-1}>-- ไม่มี / รวมอยู่ในช่องชื่อแล้ว --</option>
                    {parsedTable.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คอลัมน์วันที่สแกน</label>
                  <select
                    value={colMapping.dateCol}
                    onChange={(e) => {
                      const nextDateCol = Number(e.target.value);
                      const nextMapping = { ...colMapping, dateCol: nextDateCol };
                      setColMapping(nextMapping);
                      if (parsedTable) {
                        const extracted = extractScannerRows(parsedTable, nextMapping);
                        const dateCounts = new Map<string, number>();
                        extracted.forEach((r) => {
                          if (r.isoDate) {
                            dateCounts.set(r.isoDate, (dateCounts.get(r.isoDate) || 0) + 1);
                          }
                        });
                        const sortedDates = Array.from(dateCounts.entries()).sort((a, b) => {
                          if (b[1] !== a[1]) return b[1] - a[1];
                          return b[0].localeCompare(a[0]);
                        });
                        if (sortedDates.length > 0) {
                          const primaryDate = sortedDates[0][0];
                          setScanDateFilter(primaryDate);
                          setAttendanceDate(getPreviousDateString(primaryDate));
                          setPrintReportDate(primaryDate);
                        } else {
                          setScanDateFilter("ALL");
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value={-1}>-- ไม่ระบุ --</option>
                    {parsedTable.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">คอลัมน์เวลาสแกน</label>
                  <select
                    value={colMapping.timeCol}
                    onChange={(e) => setColMapping((prev) => ({ ...prev, timeCol: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value={-1}>-- รวมอยู่ในวันที่ / ไม่มี --</option>
                    {parsedTable.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Comparison Date, Time Window & Filters (2 Rows) */}
            <div className="space-y-4 pt-2">
              {/* แถวแรก: วันที่สแกนลายนิ้วมือ (จากไฟล์), เทียบเช็คยอดคืนวันที่, ช่วงเวลาสแกนที่กำหนด (น.) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Scan Date Filter from File */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    วันที่สแกนลายนิ้วมือ (จากไฟล์)
                  </label>
                  <select
                    value={scanDateFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setScanDateFilter(val);
                      if (val !== "ALL") {
                        setAttendanceDate(getPreviousDateString(val));
                        setPrintReportDate(val);
                      } else if (primaryScanDate) {
                        setPrintReportDate(primaryScanDate);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">ทุกวันในไฟล์ ({scannerRows.length} รายการ)</option>
                    {availableScanDates.map((d) => (
                      <option key={d.isoDate} value={d.isoDate}>
                        {formatIsoToThaiSlash(d.isoDate)} ({formatThaiMediumDate(d.isoDate)}) · {d.count} รายการ
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Dorm Attendance Date to Compare Against */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เทียบเช็คยอดคืนวันที่
                  </label>
                  <ThaiDatePicker
                    value={attendanceDate}
                    onChange={setAttendanceDate}
                    showQuickButtons={true}
                  />
                </div>

                {/* 3. Allowed Scan Time Window */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">ช่วงเวลาสแกนที่กำหนด (น.)</label>
                    {(startTime !== "06:00" || endTime !== "07:00") && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime("06:00");
                          setEndTime("07:00");
                        }}
                        className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                      >
                        ค่าเริ่มต้น 06:00-07:00
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value || "06:00")}
                      aria-label="เวลาเริ่มต้น"
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-slate-400">–</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value || "07:00")}
                      aria-label="เวลาสิ้นสุด"
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* แถวที่ 2: กรองตามหอพัก, กรองตามระดับชั้น */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 4. Dormitory Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">กรองตามหอพัก</label>
                  <select
                    value={dormFilter}
                    onChange={(e) => setDormFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">ทุกหอพัก ({dorms.length} หอพัก)</option>
                    {dorms.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Grade Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">กรองตามระดับชั้น</label>
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ALL">ทุกระดับชั้น (ม.1 – ม.6)</option>
                    {["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dorm Attendance Status Warning if any dorm hasn't checked on attendanceDate */}
      {parsedTable && uncheckedDormsList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-950 space-y-0.5">
              <div className="font-extrabold">
                คืนวันที่ {formatThaiMediumDate(attendanceDate)} มีหอพักเช็คยอดแล้ว {checkedDormsCount}/{dorms.length} หอพัก
              </div>
              <div className="text-amber-800">
                หอพักที่ยังไม่ได้เช็คยอด:{" "}
                <span className="font-bold">{uncheckedDormsList.map((d) => d.dorm.name).join(", ")}</span>{" "}
                — สามารถเลือกหรือเปลี่ยนวันที่เทียบเช็คยอดหอพักด้านบนได้
              </div>
            </div>
          </div>
          {onNavigateToCheck && uncheckedDormsList[0] && (
            <button
              type="button"
              onClick={() => onNavigateToCheck(uncheckedDormsList[0].dorm.id, attendanceDate)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0 whitespace-nowrap self-start sm:self-center"
            >
              <span>ไปเช็คยอดหอพัก</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Results Area */}
      {parsedTable ? (
        <div id="fingerprint-compare-printable-area" className="space-y-6">
          {/* Print Header (Hidden on screen, visible on print) */}
          <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4 space-y-0.5">
            <h2 className="text-lg font-black text-slate-900">
              โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย
            </h2>
            <p className="text-sm font-bold text-slate-800">กลุ่มบริหารกิจการนักเรียน</p>
            <p className="text-sm font-extrabold text-slate-900">สรุปรายงานนักเรียนลงหอพักสาย</p>
            <p className="text-xs font-semibold text-slate-700 tabular-nums">
              {formatThaiOfficialLateHeaderDate(effectiveFileScanDate || todayStr)}
            </p>
          </div>

          {/* 4 KPI Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveResultTab("EARLY")}
              className={`text-left bg-white rounded-2xl border p-5 transition-colors cursor-pointer ${
                activeResultTab === "EARLY"
                  ? "border-sky-400 ring-2 ring-sky-100"
                  : "border-slate-200 hover:border-sky-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">สแกนก่อนเวลา (ก่อน {startTime} น.)</span>
                <Clock className="w-4 h-4 text-sky-600 shrink-0" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-700 tabular-nums">
                  {comparison.counts.earlyCount}
                </span>
                <span className="text-xs font-bold text-slate-500">คน</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                แสดงเวลาที่สแกนจริงก่อน {startTime} น.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveResultTab("LATE_SCANNED")}
              className={`text-left bg-white rounded-2xl border p-5 transition-colors cursor-pointer ${
                activeResultTab === "LATE_SCANNED"
                  ? "border-orange-400 ring-2 ring-orange-100"
                  : "border-slate-200 hover:border-orange-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">สาย (เวลาที่เกินมา)</span>
                <Clock className="w-4 h-4 text-orange-600 shrink-0" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-orange-600 tabular-nums">
                  {comparison.counts.lateScannedCount}
                </span>
                <span className="text-xs font-bold text-slate-500">คน</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                สแกนหลังเวลา {endTime} น.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveResultTab("LATE_NOT_SCANNED")}
              className={`text-left bg-white rounded-2xl border p-5 transition-colors cursor-pointer ${
                activeResultTab === "LATE_NOT_SCANNED"
                  ? "border-rose-400 ring-2 ring-rose-100"
                  : "border-slate-200 hover:border-rose-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">สาย (ไม่สแกน)</span>
                <UserX className="w-4 h-4 text-rose-600 shrink-0" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-600 tabular-nums">
                  {comparison.counts.lateNotScannedCount}
                </span>
                <span className="text-xs font-bold text-slate-500">คน</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                ไม่พบเวลาสแกนนิ้วในรายการที่นำเข้า
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveResultTab("OUT_ALL")}
              className={`text-left bg-white rounded-2xl border p-5 transition-colors cursor-pointer ${
                activeResultTab === "OUT_ALL" || activeResultTab === "OUT_BUT_SCANNED"
                  ? "border-indigo-400 ring-2 ring-indigo-100"
                  : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">นักเรียนออกหอพัก (แยกแสดงเฉพาะ)</span>
                <UserMinus className="w-4 h-4 text-indigo-600 shrink-0" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-700 tabular-nums">
                  {comparison.counts.dormOutTotal}
                </span>
                <span className="text-xs font-bold text-slate-500">คน</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                ไม่สแกน {comparison.counts.outConfirmed} · สแกนนิ้ว {comparison.counts.outButScanned} · นอกระบบ {comparison.counts.unmatchedCount}
              </div>
            </button>
          </div>

          {/* Results Table Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Context Summary Strip */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 tabular-nums">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  วันที่สแกนนิ้ว:{" "}
                  <strong className="text-slate-900">
                    {scanDateFilter === "ALL" ? "ทุกวันในไฟล์" : formatIsoToThaiSlash(scanDateFilter)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  เทียบยอดเช็คหอคืนวันที่:{" "}
                  <strong className="text-purple-800">{formatIsoToThaiSlash(attendanceDate)}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  กำหนดเวลาสแกน:{" "}
                  <strong className="text-slate-900">
                    {startTime} – {endTime} น.
                  </strong>
                </span>
              </div>
              <div>
                แสดงเฉพาะ ก่อนเวลา / สาย(เวลา) / สาย(ไม่สแกน) <strong className="text-slate-900">{comparison.counts.flaggedCount}</strong> คน · แยกออกหอพัก <strong className="text-indigo-700">{comparison.counts.dormOutTotal}</strong> คน
              </div>
            </div>

            {/* Toolbar: Tabs + Search + Export/Print */}
            <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Segmented Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl print:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "ALL"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ก่อนเวลา &amp; สายทั้งหมด ({comparison.counts.flaggedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("EARLY")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "EARLY"
                        ? "bg-white text-sky-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ก่อนเวลา ({comparison.counts.earlyCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("LATE_SCANNED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "LATE_SCANNED"
                        ? "bg-white text-orange-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    สาย (เวลา) ({comparison.counts.lateScannedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("LATE_NOT_SCANNED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "LATE_NOT_SCANNED"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    สาย (ไม่สแกน) ({comparison.counts.lateNotScannedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("OUT_ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "OUT_ALL"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ออกหอพัก ({comparison.counts.dormOutTotal})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("OUT_BUT_SCANNED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "OUT_BUT_SCANNED"
                        ? "bg-white text-amber-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    แจ้งออกแต่สแกน ({comparison.counts.outButScanned})
                  </button>

                  {(comparison.counts.uncheckedScanned > 0 || comparison.counts.uncheckedNotScanned > 0) && (
                    <button
                      type="button"
                      onClick={() => setActiveResultTab("UNCHECKED")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                        activeResultTab === "UNCHECKED"
                          ? "bg-white text-sky-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      หอพักยังไม่เช็คยอด ({comparison.counts.uncheckedScanned + comparison.counts.uncheckedNotScanned})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveResultTab("UNMATCHED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeResultTab === "UNMATCHED"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ไม่อยู่ในระบบหอ ({comparison.counts.unmatchedCount})
                  </button>
                </div>

                {/* Actions: Print */}
                <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenPrintPreview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์รายงาน</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {activeResultTab === "UNMATCHED" ? (
              <div className="overflow-x-auto">
                {filteredUnmatched.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <div className="text-sm font-extrabold text-slate-800">
                      รายชื่อจากไฟล์สแกนนิ้วจับคู่กับนักเรียนในระบบหอพักได้ครบทุกรายการ
                    </div>
                    <p className="text-xs text-slate-500">
                      ไม่มีรหัสหรือรายชื่อที่ไม่พบในฐานข้อมูลหอพัก
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-700">
                        <th className="py-3 px-4 w-14 text-center">#</th>
                        <th className="py-3 px-4">รหัสจากเครื่องสแกน</th>
                        <th className="py-3 px-4">รหัส 5 หลักที่แยกได้</th>
                        <th className="py-3 px-4">ชื่อ - นามสกุล (ในไฟล์)</th>
                        <th className="py-3 px-4">วันที่สแกน</th>
                        <th className="py-3 px-4">เวลาสแกน / จำนวนครั้ง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {filteredUnmatched.map((u, idx) => (
                        <tr key={`${u.rawId}-${idx}`} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-800 tabular-nums">
                            {u.rawId || "-"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-purple-700 font-bold tabular-nums">
                            {u.normalizedCode || "-"}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{u.rawName || "-"}</td>
                          <td className="py-2.5 px-4 text-slate-700 tabular-nums">
                            {u.isoDate ? `${formatIsoToThaiSlash(u.isoDate)} (${formatThaiMediumDate(u.isoDate)})` : u.rawDate || "-"}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-mono text-xs tabular-nums">
                            {u.scanTimes.length > 0 ? u.scanTimes.join(", ") : "-"} ({u.scanCount} ครั้ง)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {filteredItems.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <div className="text-sm font-extrabold text-slate-800">
                      {activeResultTab === "ALL"
                        ? "ไม่พบนักเรียนที่สแกนก่อนเวลา หรือมาสายในรายการที่นำเข้า"
                        : activeResultTab === "LATE_NOT_SCANNED" || activeResultTab === "LATE_SCANNED"
                        ? "ไม่พบนักเรียนที่มาสายในรายการนี้"
                        : activeResultTab === "EARLY"
                        ? "ไม่พบนักเรียนที่สแกนนิ้วก่อนเวลา"
                        : activeResultTab === "OUT_ALL"
                        ? "ไม่พบนักเรียนที่ออกหอพักในคืนวันที่เลือก"
                        : activeResultTab === "OUT_BUT_SCANNED"
                        ? "ไม่พบข้อมูลขัดแย้งระหว่างการแจ้งออกหอพักและการสแกนนิ้ว"
                        : "ไม่พบรายการที่ตรงตามเงื่อนไข"}
                    </div>
                    <p className="text-xs text-slate-500">
                      ลองเปลี่ยนแท็บตัวกรอง ช่วงเวลาสแกน หรือวันที่เช็คยอดหอพักด้านบน
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-700">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">รหัสนักเรียน</th>
                        <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                        <th className="py-3 px-4">ชั้น/ห้อง</th>
                        <th className="py-3 px-4">หอพัก / ห้องพัก</th>
                        <th className="py-3 px-4">สถานะหอพัก</th>
                        <th className="py-3 px-4">เวลาสแกนนิ้ว</th>
                        <th className="py-3 px-4">ผลการตรวจเวลา &amp; เปรียบเทียบ ({startTime}–{endTime} น.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {filteredItems.map((item, idx) => (
                        <tr key={item.student.id || item.formattedId} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-mono tabular-nums">
                            <div className="font-bold text-slate-900">{item.formattedId}</div>
                            {item.scannerInfo?.rawId && item.scannerInfo.rawId !== item.formattedId && (
                              <div className="text-[11px] text-slate-500">{item.scannerInfo.rawId}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">
                              {item.fullName}
                              {item.student.nickname ? (
                                <span className="text-slate-500 font-medium ml-1">({item.student.nickname})</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-700 whitespace-nowrap tabular-nums">
                            {item.gradeRoom}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{item.dormName}</span>
                            </div>
                            {item.student.dormRoom && (
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                ห้อง {item.student.dormRoom}
                                {item.student.dormBed ? ` · เตียง ${item.student.dormBed}` : ""}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-800">{item.dormStatusLabel}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.dormReason && item.dormReason !== item.dormStatusLabel
                                ? item.dormReason
                                : renderCategoryText(item.category)}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 tabular-nums">
                            {item.hasScanned && item.scannerInfo ? (
                              <div>
                                <div className="font-bold text-slate-900 font-mono">
                                  {item.scannerInfo.earliestTime ? `${item.scannerInfo.earliestTime} น.` : "ไม่ระบุเวลา"}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {item.scannerInfo.scanDates.map(formatIsoToThaiSlash).join(", ")}
                                  {item.scannerInfo.scanCount > 1
                                    ? ` · ${item.scannerInfo.scanCount} ครั้ง (${item.scannerInfo.scanTimes.join(", ")})`
                                    : ""}
                                </div>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-semibold text-xs">ไม่พบการสแกน</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {renderPunctualityStatus(item)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty / Ready State before upload */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            พร้อมเปรียบเทียบรายชื่อนักเรียนในระบบ {students.length} คน
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            กรุณาวางข้อมูลจากระบบสแกนลายนิ้วมือในช่องด้านบน
            ระบบจะตัดใช้รหัส 5 ตัวสุดท้ายอัตโนมัติ (เช่น M-69-M-06068 → 06068)
            เทียบกับยอดเช็คหอพัก (เช่น สแกน 14/11/2569 เทียบคืน 13/11/2569)
            แยกแสดงนักเรียนที่ออกหอพักไว้ต่างหาก และตรวจสอบการสแกนก่อนเวลา สาย (เวลาที่เกินมา) และสาย (ไม่สแกน)
          </p>
        </div>
      )}

      {/* Print Preview Modal: หน้าพิมพ์รายงานนักเรียนลงหอพักสาย */}
      {isPrintPreviewOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ตัวอย่างการพิมพ์รายงานนักเรียนลงหอพักสาย"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Top Bar */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-purple-300 shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black leading-tight">
                    หน้าพิมพ์รายงานนักเรียนลงหอพักสาย
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตั้งค่าหน้ากระดาษ: {printOrientation === "portrait" ? "A4 แนวตั้ง (Portrait)" : "A4 แนวนอน (Landscape)"} · แสดง {printItems.length} คน
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Page Orientation Selector */}
                <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 text-xs">
                  <span className="text-[11px] text-slate-300 font-semibold px-2 hidden sm:inline">
                    หน้ากระดาษ:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("portrait")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      printOrientation === "portrait"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    แนวตั้ง
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("landscape")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      printOrientation === "landscape"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    แนวนอน
                  </button>
                </div>

                {/* Execute Print Button */}
                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>สั่งพิมพ์ / PDF</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  aria-label="ปิดหน้าต่างพิมพ์"
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Secondary Print Settings Strip: Scope + Header Date */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 mr-1">รายชื่อในรายงาน:</span>
                <button
                  type="button"
                  onClick={() => setPrintScope("LATE_ALL")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                    printScope === "LATE_ALL"
                      ? "bg-purple-600 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  ลงหอพักสายทั้งหมด ({comparison.counts.lateTotalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintScope("LATE_SCANNED")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                    printScope === "LATE_SCANNED"
                      ? "bg-orange-600 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  สาย (สแกนหลังเวลา) ({comparison.counts.lateScannedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintScope("LATE_NOT_SCANNED")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                    printScope === "LATE_NOT_SCANNED"
                      ? "bg-rose-600 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  สาย (ไม่สแกน) ({comparison.counts.lateNotScannedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintScope("ALL_FLAGGED")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                    printScope === "ALL_FLAGGED"
                      ? "bg-slate-800 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  ก่อนเวลา &amp; สายทั้งหมด ({comparison.counts.flaggedCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                  วันที่ในรายงาน (ตามวันที่สแกน):
                </label>
                <div className="w-44">
                  <ThaiDatePicker
                    value={printReportDate}
                    onChange={setPrintReportDate}
                    showQuickButtons={false}
                  />
                </div>
                {effectiveFileScanDate && printReportDate !== effectiveFileScanDate && (
                  <button
                    type="button"
                    onClick={() => setPrintReportDate(effectiveFileScanDate)}
                    className="text-[11px] font-bold text-purple-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    ใช้ตามไฟล์สแกน ({formatIsoToThaiSlash(effectiveFileScanDate)})
                  </button>
                )}
              </div>
            </div>

            {printError && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{printError}</span>
              </div>
            )}

            {/* Printable A4 Paper Preview Area */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-200/75 flex-1">
              <div
                className={`bg-white p-6 sm:p-10 rounded-xl shadow-md border border-slate-300 text-slate-900 mx-auto transition-all ${
                  printOrientation === "landscape" ? "max-w-[1060px]" : "max-w-[760px]"
                }`}
              >
                {/* Official 4-Line Report Header */}
                <div className="text-center pb-3.5 mb-4 border-b-2 border-slate-800 space-y-1">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                    โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย
                  </h2>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">
                    กลุ่มบริหารกิจการนักเรียน
                  </h3>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                    สรุปรายงานนักเรียนลงหอพักสาย
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 pt-0.5">
                    {formatThaiOfficialLateHeaderDate(printReportDate)}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-0.5 tabular-nums">
                    {dormFilter !== "ALL" ? `หอพัก: ${dormFilterLabel} · ` : ""}
                    {gradeFilter !== "ALL" ? `ระดับชั้น: ${gradeFilterLabel} · ` : ""}
                    ช่วงเวลาที่กำหนด: {startTime} – {endTime} น.
                  </p>
                </div>

                {/* Late Dormitory Students Table (7 Columns with ที่ first, compact ID on portrait) */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-extrabold">
                        <th
                          className={`border border-slate-400 text-center w-[5%] ${
                            printOrientation === "portrait" ? "px-1 py-2" : "px-2 py-2.5"
                          }`}
                        >
                          ที่
                        </th>
                        <th
                          className={`border border-slate-400 text-center whitespace-nowrap ${
                            printOrientation === "portrait"
                              ? "px-1 py-2 w-[9%] text-[10px] tracking-tight"
                              : "px-2.5 py-2.5 w-[12%]"
                          }`}
                        >
                          รหัสนักเรียน
                        </th>
                        <th
                          className={`border border-slate-400 text-left w-[26%] ${
                            printOrientation === "portrait" ? "px-2 py-2" : "px-3 py-2.5"
                          }`}
                        >
                          ชื่อ - นามสกุล
                        </th>
                        <th
                          className={`border border-slate-400 text-center w-[10%] ${
                            printOrientation === "portrait" ? "px-1.5 py-2" : "px-2.5 py-2.5"
                          }`}
                        >
                          ชั้น/ห้อง
                        </th>
                        <th
                          className={`border border-slate-400 text-left w-[15%] ${
                            printOrientation === "portrait" ? "px-2 py-2" : "px-2.5 py-2.5"
                          }`}
                        >
                          หอพัก
                        </th>
                        <th
                          className={`border border-slate-400 text-center w-[12%] ${
                            printOrientation === "portrait" ? "px-1.5 py-2" : "px-2.5 py-2.5"
                          }`}
                        >
                          เวลาสแกนนิ้ว
                        </th>
                        <th
                          className={`border border-slate-400 text-left ${
                            printOrientation === "portrait"
                              ? "px-2 py-2 w-[23%]"
                              : "px-3 py-2.5 w-[20%]"
                          }`}
                        >
                          ผลการตรวจเวลา
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {printItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="border border-slate-400 px-4 py-8 text-center text-slate-500 font-semibold"
                          >
                            ไม่พบรายชื่อนักเรียนลงหอพักสายตามเงื่อนไขที่เลือก
                          </td>
                        </tr>
                      ) : (
                        printItems.map((item, idx) => {
                          const scanTimeText =
                            item.hasScanned && item.scannerInfo
                              ? item.scannerInfo.earliestTime
                                ? `${item.scannerInfo.earliestTime} น.`
                                : "ไม่ระบุเวลา"
                              : "ไม่พบการสแกน";

                          const isNotScanned = item.punctualityStatus === "LATE_NOT_SCANNED";
                          const isLateScanned = item.punctualityStatus === "LATE_SCANNED";
                          const isPortrait = printOrientation === "portrait";

                          return (
                            <tr
                              key={item.student.id || `${item.formattedId}-${idx}`}
                              className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}
                            >
                              <td
                                className={`border border-slate-400 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap ${
                                  isPortrait ? "px-1 py-1.5" : "px-2 py-2"
                                }`}
                              >
                                {idx + 1}
                              </td>
                              <td
                                className={`border border-slate-400 text-center font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap ${
                                  isPortrait ? "px-1 py-1.5 text-[10px] tracking-tight" : "px-2.5 py-2"
                                }`}
                              >
                                {item.formattedId}
                              </td>
                              <td
                                className={`border border-slate-400 font-semibold text-slate-900 ${
                                  isPortrait ? "px-2 py-1.5" : "px-3 py-2"
                                }`}
                              >
                                {item.fullName}
                              </td>
                              <td
                                className={`border border-slate-400 text-center tabular-nums font-medium text-slate-800 whitespace-nowrap ${
                                  isPortrait ? "px-1.5 py-1.5" : "px-2.5 py-2"
                                }`}
                              >
                                {item.gradeRoom}
                              </td>
                              <td
                                className={`border border-slate-400 text-slate-800 ${
                                  isPortrait ? "px-2 py-1.5" : "px-2.5 py-2"
                                }`}
                              >
                                {item.dormName}
                              </td>
                              <td
                                className={`border border-slate-400 text-center font-mono tabular-nums whitespace-nowrap ${
                                  isPortrait ? "px-1.5 py-1.5" : "px-2.5 py-2"
                                } ${
                                  item.hasScanned
                                    ? "text-slate-900 font-semibold"
                                    : "text-rose-600 font-medium"
                                }`}
                              >
                                {scanTimeText}
                              </td>
                              <td
                                className={`border border-slate-400 tabular-nums font-bold ${
                                  isPortrait ? "px-2 py-1.5" : "px-3 py-2"
                                } ${
                                  isNotScanned
                                    ? "text-rose-700"
                                    : isLateScanned
                                    ? "text-orange-700"
                                    : "text-sky-700"
                                }`}
                              >
                                {item.punctualityLabel}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Dormitory Summary Table (Sorted Dorm 1 -> Dorm 6) */}
                <div className="mt-5">
                  <div className="text-xs font-extrabold text-slate-900 mb-2">
                    สรุปจำนวนนักเรียนลงหอพักสาย (เรียงตามหอพัก)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          {printDormSummary.map((d) => (
                            <th
                              key={d.key}
                              className="border border-slate-400 px-2 py-2 text-center font-extrabold text-slate-900 bg-slate-100"
                            >
                              {d.label}
                            </th>
                          ))}
                          <th className="border border-slate-400 px-2 py-2 text-center font-extrabold text-slate-900 bg-slate-200">
                            รวมทั้งหมด
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          {printDormSummary.map((d) => (
                            <td
                              key={d.key}
                              className="border border-slate-400 px-2 py-2 text-center tabular-nums"
                            >
                              <div
                                className={`font-extrabold text-sm ${
                                  d.count > 0 ? "text-slate-900" : "text-slate-400"
                                }`}
                              >
                                {d.count} คน
                              </div>
                              {d.count > 0 && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  สแกนสาย {d.lateScannedCount} · ไม่สแกน {d.lateNotScannedCount}
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="border border-slate-400 px-2 py-2 text-center tabular-nums bg-slate-50">
                            <div className="font-black text-sm text-slate-900">
                              {printItems.length} คน
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              {printEarlyTotal === 0
                                ? `สแกนสาย ${printLateScannedTotal} · ไม่สแกน ${printLateNotScannedTotal}`
                                : `สแกนสาย ${printLateScannedTotal} · ไม่สแกน ${printLateNotScannedTotal} · ก่อนเวลา ${printEarlyTotal}`}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      รูปแบบหน้ากระดาษ: {printOrientation === "portrait" ? "A4 แนวตั้ง" : "A4 แนวนอน"}
                    </span>
                    <span>รวมนักเรียนลงหอพักสายทั้งหมด {printItems.length} คน</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
