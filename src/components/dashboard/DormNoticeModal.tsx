import React from "react";
import { Notice } from "../../types";
import { Megaphone, Bookmark, X, Calendar, Sparkles } from "lucide-react";

interface DormNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDashboardDate: string;
  effectiveDashboardDate: string;
  activeNotice: Notice | null;
  groupedDormOrientationNotes: {
    dormId: string;
    dormName: string;
    notes: string[];
  }[];
}

export const DormNoticeModal: React.FC<DormNoticeModalProps> = ({
  isOpen,
  onClose,
  selectedDashboardDate,
  effectiveDashboardDate,
  activeNotice,
  groupedDormOrientationNotes,
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

  const totalOrientationNotesCount = groupedDormOrientationNotes.reduce(
    (sum, g) => sum + g.notes.length,
    0
  );

  return (
    <div
      id="dorm-notice-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="dorm-notice-modal-dialog"
        className="bg-slate-900 text-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden relative"
      >
        {/* Decorative gradient glow */}
        <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-[#A05AFF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-72 h-72 bg-[#1BCFB4]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 relative z-10 flex items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 sm:p-3 bg-[#A05AFF]/20 border border-[#A05AFF]/40 rounded-2xl shrink-0 backdrop-blur-md">
              <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-[#1BCFB4]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                  บันทึกการอบรม / แจ้งการหอประจำวัน
                </h3>
                <span className="bg-purple-500/25 text-purple-200 border border-purple-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3 text-purple-300" />
                  ประจำวันที่ {displayDateStr}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                เรื่องแจ้งอบรมจากหัวหน้างานหอพัก และบันทึกเพิ่มเติมจากครูประจำหอพัก (หอ 1 - 6)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 relative z-10">
          {/* Section 1: Notice from Head of Dormitory */}
          {activeNotice ? (
            <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-purple-500/40 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1BCFB4] shrink-0" />
                  <h4 className="font-extrabold text-[#1BCFB4] text-sm sm:text-base">
                    เรื่องแจ้งอบรมจากหัวหน้างานหอพัก
                  </h4>
                </div>
                {activeNotice.createdBy && (
                  <span className="text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-semibold">
                    ผู้บันทึก: {activeNotice.createdBy}
                  </span>
                )}
              </div>

              {activeNotice.title && (
                <p className="text-sm font-extrabold text-white px-1">
                  {activeNotice.title}
                </p>
              )}

              {activeNotice.topics && activeNotice.topics.length > 0 ? (
                <ol className="space-y-2 text-xs sm:text-sm text-slate-200">
                  {activeNotice.topics.map((topic, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 bg-slate-900/70 p-3 rounded-xl border border-slate-700/50 font-medium leading-relaxed"
                    >
                      <span className="font-extrabold text-[#1BCFB4] shrink-0 min-w-[20px]">
                        {idx + 1}.
                      </span>
                      <span className="break-words flex-1">{topic}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-slate-400 italic">ไม่มีหัวข้อเรื่องแจ้งเพิ่มเติม</p>
              )}
            </div>
          ) : null}

          {/* Section 2: Dorm Orientation Notes recorded by teachers */}
          {groupedDormOrientationNotes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
                  <h4 className="font-extrabold text-amber-300 text-sm sm:text-base">
                    บันทึกการอบรมเพิ่มเติมจากครูประจำหอพัก (จากการเช็คยอด)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  รวม {totalOrientationNotesCount} รายการ
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedDormOrientationNotes.map((group) => (
                  <div
                    key={group.dormId}
                    className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-2.5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#1BCFB4]" />
                          <span className="font-extrabold text-white text-xs sm:text-sm">
                            {group.dormName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                          {group.notes.length} รายการ
                        </span>
                      </div>

                      <ol className="space-y-1.5 text-slate-200">
                        {group.notes.map((note, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40 text-xs font-medium leading-relaxed"
                          >
                            <span className="font-extrabold text-amber-400 shrink-0 select-none">
                              {idx + 1}.
                            </span>
                            <span className="break-words">{note}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Fallback when neither notice nor orientation notes exist */}
          {!activeNotice && groupedDormOrientationNotes.length === 0 && (
            <div className="py-12 px-4 text-center space-y-3 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700">
              <Megaphone className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">
                  ไม่มีบันทึกการอบรม หรือเรื่องแจ้งประจำวัน
                </p>
                <p className="text-xs text-slate-500">
                  สำหรับวันที่ {displayDateStr} ไม่พบข้อมูลเรื่องแจ้งจากหัวหน้างานหอพัก หรือบันทึกจากครูประจำหอพัก
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 relative z-10 flex items-center justify-end gap-2 bg-slate-900/95">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
