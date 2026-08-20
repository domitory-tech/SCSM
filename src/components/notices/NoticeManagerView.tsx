import React, { useMemo, useState } from "react";
import { Notice } from "../../types";
import { formatThaiFullDate, getTodayDateString } from "../../utils/dateUtils";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  User,
  X
} from "lucide-react";

interface NoticeManagerViewProps {
  notices: Notice[];
  onPostNotice: (data: { date: string; title: string; topics: string[]; createdBy: string }) => Promise<void>;
  onUpdateNotice?: (data: Notice) => Promise<void>;
  onDeleteNotice?: (id: string) => Promise<void>;
  currentUserName: string;
}

type TimeRangeType = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL" | "CUSTOM_DATE";

// Helper functions for date calculations
function isDateInCurrentWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const day = today.getDay();
  const diffToMon = (day + 6) % 7; // days since Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return target >= monday && target <= sunday;
}

function isDateInCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, "0");
  return dateStr.startsWith(`${curY}-${curM}`);
}

export const NoticeManagerView: React.FC<NoticeManagerViewProps> = ({
  notices,
  onPostNotice,
  onUpdateNotice,
  onDeleteNotice,
  currentUserName
}) => {
  const todayStr = getTodayDateString();
  const [date, setDate] = useState<string>(todayStr);
  const [title, setTitle] = useState<string>("");
  const [topics, setTopics] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Mode state
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // Search & Filter state for notices
  const [timeRange, setTimeRange] = useState<TimeRangeType>("ALL");
  const [customDate, setCustomDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Delete confirmation modal state (No password required)
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const handleAddTopic = () => setTopics((prev) => [...prev, ""]);
  const handleUpdateTopic = (index: number, value: string) => {
    setTopics((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };
  const handleRemoveTopic = (index: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  };

  // Start editing a notice
  const handleStartEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setDate(notice.date);
    setTitle(notice.title);
    setTopics(notice.topics && notice.topics.length > 0 ? [...notice.topics] : [""]);
    setSuccessMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingNotice(null);
    setTitle("");
    setTopics([""]);
    setDate(todayStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("กรุณาระบุหัวข้อเรื่องแจ้งอบรม");
      return;
    }

    const filteredTopics = topics.filter((t) => t.trim().length > 0);
    if (filteredTopics.length === 0) {
      alert("กรุณาระบุรายละเอียดเรื่องที่แจ้งอบรมอย่างน้อย 1 รายการ");
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      if (editingNotice && onUpdateNotice) {
        await onUpdateNotice({
          ...editingNotice,
          date,
          title,
          topics: filteredTopics,
          createdBy: currentUserName || editingNotice.createdBy
        });
        setSuccessMsg(`บันทึกการแก้ไขเรื่องแจ้งอบรม "${title}" เรียบร้อยแล้ว!`);
        setEditingNotice(null);
        setTitle("");
        setTopics([""]);
      } else {
        await onPostNotice({
          date,
          title,
          topics: filteredTopics,
          createdBy: currentUserName
        });
        setTitle("");
        setTopics([""]);
        setSuccessMsg("ประกาศเรื่องแจ้งอบรมแก่ครูหอพักทุกหอสำเร็จแล้ว!");
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Notice with Confirmation (Password-free)
  const handleConfirmDelete = async () => {
    if (!noticeToDelete) return;
    if (!onDeleteNotice) {
      alert("ไม่พบฟังก์ชันการลบประกาศ");
      setNoticeToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteNotice(noticeToDelete.id);
      const deletedTitle = noticeToDelete.title;
      // If deleting the currently editing notice, reset edit form
      if (editingNotice?.id === noticeToDelete.id) {
        handleCancelEdit();
      }
      setNoticeToDelete(null);
      setDeleteSuccessMsg(`ลบประกาศ "${deletedTitle}" เรียบร้อยแล้ว`);
      setTimeout(() => setDeleteSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบประกาศ: " + (err.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Counts for filters
  const todayCount = useMemo(() => notices.filter((n) => n.date === todayStr).length, [notices, todayStr]);
  const thisWeekCount = useMemo(() => notices.filter((n) => isDateInCurrentWeek(n.date)).length, [notices]);
  const thisMonthCount = useMemo(() => notices.filter((n) => isDateInCurrentMonth(n.date)).length, [notices]);

  // Filtered & Sorted Notices
  const sortedAndFilteredNotices = useMemo(() => {
    const list = [...notices];
    // Sort by date descending, then by createdAt descending
    list.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return list.filter((n) => {
      // Time Range Filter
      if (timeRange === "TODAY" && n.date !== todayStr) return false;
      if (timeRange === "THIS_WEEK" && !isDateInCurrentWeek(n.date)) return false;
      if (timeRange === "THIS_MONTH" && !isDateInCurrentMonth(n.date)) return false;
      if (timeRange === "CUSTOM_DATE" && customDate && n.date !== customDate) return false;

      // Search query filter (title, author, topics, date)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchAuthor = (n.createdBy || "").toLowerCase().includes(q);
        const matchTopics = n.topics.some((tp) => tp.toLowerCase().includes(q));
        const matchDate = n.date.includes(q);
        return matchTitle || matchAuthor || matchTopics || matchDate;
      }
      return true;
    });
  }, [notices, timeRange, customDate, searchQuery, todayStr]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
            <Megaphone className="w-8 h-8 text-[#1BCFB4]" />
          </div>
          <div>
            <h2 className="text-2xl font-black">เรื่องแจ้งอบรมจากหัวหน้างานหอพัก</h2>
            <p className="text-xs text-purple-100 mt-1">
              หัวหน้างานหอพักแจ้งหัวข้อที่จำเป็นต้องเน้นย้ำแก่นักเรียน ให้ครูประจำหอพักทราบก่อนเวลา 20.00 น.
            </p>
          </div>
        </div>
      </div>

      {/* Delete / Post / Update Notifications */}
      {deleteSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deleteSuccessMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Post / Edit Notice Form (Left Panel) */}
        <div className={`bg-white rounded-2xl p-5 border shadow-xs h-fit space-y-4 transition-all ${
          editingNotice ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"
        }`}>
          {/* Header with Edit Mode indicator */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-extrabold text-gray-800 text-base flex items-center gap-2">
              {editingNotice ? (
                <>
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-900">แก้ไขเรื่องแจ้งอบรม</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-[#A05AFF]" />
                  <span>สร้างเรื่องแจ้งอบรมใหม่</span>
                </>
              )}
            </h3>
            {editingNotice && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                โหมดแก้ไข
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                วันที่แจ้งเรื่อง (ไม่เกินวันนี้)
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={date}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val > todayStr) {
                      alert("⚠️ ไม่สามารถสร้างเรื่องแจ้งอบรมล่วงหน้าเกินวันที่ปัจจุบันได้");
                      setDate(todayStr);
                    } else {
                      setDate(val || todayStr);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer font-bold"
                />
                <div className="bg-pink-50 border border-pink-200 text-pink-800 text-xs font-bold rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                  <span>{formatThaiFullDate(date)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">หัวข้อหลัก (Title)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น เน้นย้ำระเบียบการเข้านอนและการประหยัดไฟ..."
                className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-pink-500 font-medium"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700">รายการเรื่องอบรม (มากกว่า 1 เรื่อง)</label>
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="text-[11px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มรายการ</span>
                </button>
              </div>

              {topics.map((tp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    value={tp}
                    onChange={(e) => handleUpdateTopic(idx, e.target.value)}
                    placeholder={`รายละเอียดข้อที่ ${idx + 1}...`}
                    className="flex-1 bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl p-2 outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  {topics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {successMsg && (
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl animate-fade-in">
                {successMsg}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  editingNotice
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-pink-600 hover:bg-pink-700"
                }`}
              >
                {editingNotice ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>บันทึกการแก้ไขเรื่องแจ้งอบรม</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ส่งประกาศไปยังครูหอพัก 1-6</span>
                  </>
                )}
              </button>

              {editingNotice && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ยกเลิกการแก้ไข (สร้างเรื่องใหม่)</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Existing & Historical Notices Timeline List (Right Panel) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-gray-800 text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-purple-600" />
                  <span>
                    {timeRange === "TODAY"
                      ? "เรื่องแจ้งประกาศวันนี้"
                      : timeRange === "THIS_WEEK"
                      ? "เรื่องแจ้งประกาศสัปดาห์นี้"
                      : timeRange === "THIS_MONTH"
                      ? "เรื่องแจ้งประกาศเดือนนี้"
                      : timeRange === "CUSTOM_DATE" && customDate
                      ? `เรื่องแจ้งประกาศวันที่ ${formatThaiFullDate(customDate)}`
                      : "รายการประกาศย้อนหลังทั้งหมด"}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  เรื่องแจ้งของวันนี้แสดงเป็น<strong className="text-emerald-700">โทนสีเขียว</strong> และเรื่องย้อนหลังแสดงเป็น<strong className="text-orange-700">โทนสีส้ม</strong>
                </p>
              </div>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full w-fit">
                แสดง {sortedAndFilteredNotices.length} รายการ
              </span>
            </div>

            {/* Quick View Modes: วันนี้ , สัปดาห์นี้ , เดือนนี้ , ทั้งหมด */}
            <div className="flex flex-wrap items-center gap-2">
              {/* วันนี้ */}
              <button
                type="button"
                onClick={() => {
                  setTimeRange("TODAY");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  timeRange === "TODAY"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>วันนี้ ({todayCount})</span>
              </button>

              {/* สัปดาห์นี้ */}
              <button
                type="button"
                onClick={() => {
                  setTimeRange("THIS_WEEK");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  timeRange === "THIS_WEEK"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>สัปดาห์นี้ ({thisWeekCount})</span>
              </button>

              {/* เดือนนี้ */}
              <button
                type="button"
                onClick={() => {
                  setTimeRange("THIS_MONTH");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  timeRange === "THIS_MONTH"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>เดือนนี้ ({thisMonthCount})</span>
              </button>

              {/* ทั้งหมด */}
              <button
                type="button"
                onClick={() => {
                  setTimeRange("ALL");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  timeRange === "ALL"
                    ? "bg-gray-800 text-white shadow-xs"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>ทั้งหมด ({notices.length})</span>
              </button>
            </div>

            {/* Filter and Search Bar with Custom Date Picker */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-100">
              {/* Search text */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาหัวข้อ, รายละเอียดเรื่องแจ้ง, ผู้ประกาศ..."
                  className="w-full bg-gray-50 border border-gray-200 text-xs text-gray-800 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* ที่เหลือให้เลือกจากวันที่ (Custom Date) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-600 whitespace-nowrap">เลือกวันที่:</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDate(val);
                    if (val) {
                      setTimeRange("CUSTOM_DATE");
                    } else {
                      setTimeRange("ALL");
                    }
                  }}
                  className={`bg-gray-50 border text-xs rounded-xl px-2.5 py-1.5 outline-none font-bold cursor-pointer transition-colors ${
                    timeRange === "CUSTOM_DATE" && customDate
                      ? "border-orange-400 ring-2 ring-orange-100 text-orange-900"
                      : "border-gray-200 text-gray-700 focus:ring-2 focus:ring-purple-500"
                  }`}
                />
                {customDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDate("");
                      setTimeRange("ALL");
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-xl cursor-pointer"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notices List */}
          {sortedAndFilteredNotices.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center space-y-2">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-gray-500 text-sm font-bold">
                {searchQuery || customDate || timeRange !== "ALL"
                  ? "ไม่พบเรื่องแจ้งอบรมที่ตรงกับเงื่อนไขการค้นหา"
                  : "ยังไม่มีเรื่องแจ้งอบรมที่บันทึกไว้"}
              </p>
              {(searchQuery || customDate || timeRange !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCustomDate("");
                    setTimeRange("ALL");
                  }}
                  className="text-xs font-bold text-pink-600 hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด (แสดงทั้งหมด)
                </button>
              )}
            </div>
          ) : (
            sortedAndFilteredNotices.map((notice) => {
              const isTodayNotice = notice.date === todayStr;
              const isBeingEdited = editingNotice?.id === notice.id;

              return (
                <div
                  key={notice.id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs transition-all space-y-3.5 ${
                    isBeingEdited
                      ? "border-amber-400 ring-2 ring-amber-300 bg-amber-50/20"
                      : isTodayNotice
                      ? "border-emerald-300 ring-2 ring-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/50"
                      : "border-orange-200 hover:border-orange-300 bg-gradient-to-br from-white via-orange-50/15 to-orange-50/40"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Date Badge: Green for Today, Orange for Past */}
                        <span className={`flex items-center gap-1 font-extrabold text-xs px-2.5 py-1 rounded-lg border ${
                          isTodayNotice
                            ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                            : "text-orange-800 bg-orange-50 border-orange-200"
                        }`}>
                          <Calendar className={`w-3.5 h-3.5 ${isTodayNotice ? "text-emerald-600" : "text-orange-600"}`} />
                          {formatThaiFullDate(notice.date)}
                        </span>

                        {/* Status Badge */}
                        {isTodayNotice ? (
                          <span className="text-[11px] font-black text-white bg-emerald-600 px-2.5 py-0.5 rounded-md shadow-2xs">
                            ประกาศวันนี้
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-orange-800 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-md">
                            ประกาศย้อนหลัง
                          </span>
                        )}

                        {isBeingEdited && (
                          <span className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Edit3 className="w-3 h-3" />
                            กำลังแก้ไขรายการนี้
                          </span>
                        )}

                        {/* Author */}
                        <span className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border ${
                          isTodayNotice
                            ? "text-emerald-800 bg-emerald-50/60 border-emerald-100"
                            : "text-orange-800 bg-orange-50/60 border-orange-100"
                        }`}>
                          <User className={`w-3 h-3 ${isTodayNotice ? "text-emerald-600" : "text-orange-600"}`} />
                          ผู้ประกาศ: <strong className={isTodayNotice ? "text-emerald-950" : "text-orange-950"}>{notice.createdBy}</strong>
                        </span>
                      </div>

                      <h4 className={`font-extrabold text-base leading-snug pt-1 ${
                        isTodayNotice ? "text-emerald-950" : "text-gray-900"
                      }`}>
                        {notice.title}
                      </h4>
                    </div>

                    {/* Action Buttons: Edit & Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(notice)}
                        title="แก้ไขเรื่องที่ประกาศ"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                          isTodayNotice
                            ? "text-emerald-800 hover:text-white hover:bg-emerald-600 bg-emerald-100/70 border-emerald-300"
                            : "text-orange-800 hover:text-white hover:bg-orange-600 bg-orange-100/70 border-orange-300"
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>แก้ไข</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNoticeToDelete(notice)}
                        title="ลบประกาศนี้"
                        className="text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบประกาศ</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Topics List */}
                  <div className={`rounded-xl p-3.5 border ${
                    isTodayNotice
                      ? "bg-emerald-50/50 border-emerald-100/80"
                      : "bg-orange-50/40 border-orange-100/80"
                  }`}>
                    <span className={`text-[11px] font-bold uppercase flex items-center gap-1 mb-1.5 ${
                      isTodayNotice ? "text-emerald-700" : "text-orange-700"
                    }`}>
                      <Megaphone className="w-3 h-3" />
                      รายการเรื่องแจ้งอบรม ({notice.topics?.length || 0} ข้อ):
                    </span>
                    <ul className="space-y-1.5 text-xs font-medium">
                      {notice.topics?.map((tp, idx) => (
                        <li key={idx} className={`flex items-start gap-2 p-2 rounded-lg border ${
                          isTodayNotice
                            ? "bg-white/90 border-emerald-100 text-emerald-950"
                            : "bg-white/90 border-orange-100 text-gray-800"
                        }`}>
                          <span className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                            isTodayNotice
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-orange-100 text-orange-800"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 leading-relaxed">{tp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (Password-Free) */}
      {noticeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">ยืนยันการลบเรื่องแจ้งอบรม</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  กล่องยืนยันการลบประกาศ (ไม่ต้องใช้รหัสผ่าน)
                </p>
              </div>
            </div>

            {/* Notice Details Preview */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                <span>วันที่: {formatThaiFullDate(noticeToDelete.date)}</span>
              </div>
              <div className="text-xs text-gray-800">
                <span className="font-bold text-gray-700">หัวข้อ: </span>
                <span className="font-extrabold text-rose-800">{noticeToDelete.title}</span>
              </div>
              <div className="text-[11px] text-gray-600">
                <span>จำนวนรายการเรื่องอบรม: </span>
                <span className="font-bold text-gray-800">{noticeToDelete.topics?.length || 0} รายการ</span>
              </div>
            </div>

            {/* Warning Message */}
            <p className="text-xs text-gray-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบเรื่องแจ้งอบรมนี้? เมื่อลบแล้วข้อมูลจะถูกนำออกจากระบบทันที
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNoticeToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? "กำลังลบ..." : "ยืนยันลบประกาศ"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

