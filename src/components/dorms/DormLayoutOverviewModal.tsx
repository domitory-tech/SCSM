import React from "react";
import { Dormitory, Student, UserProfile } from "../../types";
import { printOrSaveElementAsPdf } from "../../utils/htmlReportExporter";
import { useUsersQuery } from "../../services/useDormQueries";
import { Table, X, Printer, Users } from "lucide-react";

interface DormLayoutOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dorms: Dormitory[];
  students: Student[];
  users?: UserProfile[];
  currentUser?: UserProfile | null;
}

// Distinct color themes per dormitory for table highlighting
export const DORM_OVERVIEW_COLOR_SCHEMES = [
  {
    headerBg: "bg-purple-700 text-white border-purple-800",
    subHeaderBg: "bg-purple-800 text-purple-100 border-purple-900",
    cellBg: "bg-purple-50/20 border-purple-100/60",
    cellActive: "bg-purple-100 text-purple-950 font-extrabold border-purple-200",
    footerBg: "bg-purple-200 text-purple-950 border-purple-300 font-black",
    badgeBg: "bg-purple-600 text-white"
  },
  {
    headerBg: "bg-blue-700 text-white border-blue-800",
    subHeaderBg: "bg-blue-800 text-blue-100 border-blue-900",
    cellBg: "bg-blue-50/20 border-blue-100/60",
    cellActive: "bg-blue-100 text-blue-950 font-extrabold border-blue-200",
    footerBg: "bg-blue-200 text-blue-950 border-blue-300 font-black",
    badgeBg: "bg-blue-600 text-white"
  },
  {
    headerBg: "bg-emerald-700 text-white border-emerald-800",
    subHeaderBg: "bg-emerald-800 text-emerald-100 border-emerald-900",
    cellBg: "bg-emerald-50/20 border-emerald-100/60",
    cellActive: "bg-emerald-100 text-emerald-950 font-extrabold border-emerald-200",
    footerBg: "bg-emerald-200 text-emerald-950 border-emerald-300 font-black",
    badgeBg: "bg-emerald-600 text-white"
  },
  {
    headerBg: "bg-amber-700 text-white border-amber-800",
    subHeaderBg: "bg-amber-800 text-amber-100 border-amber-900",
    cellBg: "bg-amber-50/20 border-amber-100/60",
    cellActive: "bg-amber-100 text-amber-950 font-extrabold border-amber-200",
    footerBg: "bg-amber-200 text-amber-950 border-amber-300 font-black",
    badgeBg: "bg-amber-600 text-white"
  },
  {
    headerBg: "bg-rose-700 text-white border-rose-800",
    subHeaderBg: "bg-rose-800 text-rose-100 border-rose-900",
    cellBg: "bg-rose-50/20 border-rose-100/60",
    cellActive: "bg-rose-100 text-rose-950 font-extrabold border-rose-200",
    footerBg: "bg-rose-200 text-rose-950 border-rose-300 font-black",
    badgeBg: "bg-rose-600 text-white"
  },
  {
    headerBg: "bg-cyan-700 text-white border-cyan-800",
    subHeaderBg: "bg-cyan-800 text-cyan-100 border-cyan-900",
    cellBg: "bg-cyan-50/20 border-cyan-100/60",
    cellActive: "bg-cyan-100 text-cyan-950 font-extrabold border-cyan-200",
    footerBg: "bg-cyan-200 text-cyan-950 border-cyan-300 font-black",
    badgeBg: "bg-cyan-600 text-white"
  },
  {
    headerBg: "bg-indigo-700 text-white border-indigo-800",
    subHeaderBg: "bg-indigo-800 text-indigo-100 border-indigo-900",
    cellBg: "bg-indigo-50/20 border-indigo-100/60",
    cellActive: "bg-indigo-100 text-indigo-950 font-extrabold border-indigo-200",
    footerBg: "bg-indigo-200 text-indigo-950 border-indigo-300 font-black",
    badgeBg: "bg-indigo-600 text-white"
  },
  {
    headerBg: "bg-fuchsia-700 text-white border-fuchsia-800",
    subHeaderBg: "bg-fuchsia-800 text-fuchsia-100 border-fuchsia-900",
    cellBg: "bg-fuchsia-50/20 border-fuchsia-100/60",
    cellActive: "bg-fuchsia-100 text-fuchsia-950 font-extrabold border-fuchsia-200",
    footerBg: "bg-fuchsia-200 text-fuchsia-950 border-fuchsia-300 font-black",
    badgeBg: "bg-fuchsia-600 text-white"
  }
];

// Helper for gender abbreviation (ช) or (ญ)
export const getGenderTag = (title: string = "", gender?: string): "(ช)" | "(ญ)" => {
  const t = (title || "").trim();
  if (t.startsWith("ด.ช") || t.startsWith("เด็กชาย") || t === "นาย" || t.startsWith("นาย")) {
    return "(ช)";
  }
  if (t.startsWith("ด.ญ") || t.startsWith("เด็กหญิง") || t === "นาง" || t.startsWith("นาง")) {
    return "(ญ)";
  }
  if (gender === "female") return "(ญ)";
  return "(ช)";
};

// Helper for school classification based on Grade & Room rules:
// ม.1 - ม.3: Rooms 1-4 = จภ.ชร., Room 5 = จภ.ลป.
// ม.4 - ม.6: Rooms 1-6 = จภ.ชร., Room 7 = จภ.ลป.
export const getSchoolByGradeRoom = (grade: string = "", room: string | number = ""): "จภ.ชร." | "จภ.ลป." => {
  const roomNum = parseInt(String(room).replace(/\D/g, ""), 10);
  const gStr = grade.trim();

  if (gStr.includes("1") || gStr.includes("2") || gStr.includes("3")) {
    if (roomNum === 5) return "จภ.ลป.";
    return "จภ.ชร.";
  }
  if (gStr.includes("4") || gStr.includes("5") || gStr.includes("6")) {
    if (roomNum === 7) return "จภ.ลป.";
    return "จภ.ชร.";
  }
  return "จภ.ชร.";
};

export const DormLayoutOverviewModal: React.FC<DormLayoutOverviewModalProps> = ({
  isOpen,
  onClose,
  dorms,
  students,
  users,
  currentUser
}) => {
  const { data: queriedUsers = [] } = useUsersQuery();
  const effectiveUsers = users && users.length > 0 ? users : queriedUsers;

  // Compute dormitory layout statistics by Grade/Room and Gender (ช)/(ญ)
  const dormLayoutData = React.useMemo(() => {
    const countsByDormAndKey: Record<string, Record<string, number>> = {};
    const dormTotalsMap: Record<string, number> = {};
    const keyTotalMap: Record<string, number> = {};

    let totalMale = 0;
    let totalFemale = 0;
    let pccCR_Male = 0;
    let pccCR_Female = 0;
    let pccLP_Male = 0;
    let pccLP_Female = 0;

    dorms.forEach((d) => {
      countsByDormAndKey[d.id] = {};
      dormTotalsMap[d.id] = 0;
    });

    students.forEach((st) => {
      if (!st.dormId) return;

      const gTag = getGenderTag(st.title, st.gender);
      const isMale = gTag === "(ช)";

      if (isMale) totalMale++;
      else totalFemale++;

      // School determination
      const school = getSchoolByGradeRoom(st.grade, st.room);
      if (school === "จภ.ลป.") {
        if (isMale) pccLP_Male++;
        else pccLP_Female++;
      } else {
        if (isMale) pccCR_Male++;
        else pccCR_Female++;
      }

      const gradeRoomStr = st.room ? `${st.grade}/${st.room}` : st.grade;
      const key = `${gradeRoomStr} ${gTag}`;

      if (!countsByDormAndKey[st.dormId]) {
        countsByDormAndKey[st.dormId] = {};
      }
      countsByDormAndKey[st.dormId][key] = (countsByDormAndKey[st.dormId][key] || 0) + 1;
      dormTotalsMap[st.dormId] = (dormTotalsMap[st.dormId] || 0) + 1;
      keyTotalMap[key] = (keyTotalMap[key] || 0) + 1;
    });

    // KEEP ONLY keys where total students across ALL dorms > 0
    const keysWithStudents = Object.keys(keyTotalMap).filter((k) => keyTotalMap[k] > 0);

    const sortedKeys = keysWithStudents.sort((a, b) => {
      const isAMale = a.includes("(ช)");
      const isBMale = b.includes("(ช)");
      if (isAMale && !isBMale) return -1;
      if (!isAMale && isBMale) return 1;
      return a.localeCompare(b, "th", { numeric: true });
    });

    // For each dorm, extract only those keys where countsByDormAndKey[d.id][key] > 0
    const dormActiveKeysMap: Record<string, { key: string; count: number }[]> = {};
    let maxRows = 0;

    dorms.forEach((d) => {
      const activeKeysForDorm = sortedKeys
        .filter((k) => (countsByDormAndKey[d.id]?.[k] || 0) > 0)
        .map((k) => ({ key: k, count: countsByDormAndKey[d.id][k] }));
      dormActiveKeysMap[d.id] = activeKeysForDorm;
      if (activeKeysForDorm.length > maxRows) {
        maxRows = activeKeysForDorm.length;
      }
    });

    return {
      countsByDormAndKey,
      dormTotalsMap,
      sortedKeys,
      dormActiveKeysMap,
      maxRows,
      totalMale,
      totalFemale,
      totalStudents: totalMale + totalFemale,
      pccCR_Male,
      pccCR_Female,
      pccCR_Total: pccCR_Male + pccCR_Female,
      pccLP_Male,
      pccLP_Female,
      pccLP_Total: pccLP_Male + pccLP_Female
    };
  }, [dorms, students]);

  const handlePrintPdf = () => {
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      printOrSaveElementAsPdf(
        "dorm-layout-printable",
        `ผังการจัดหอพักรวม_${dateStr}`,
        "landscape"
      );
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการพิมพ์/บันทึก PDF: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-6xl w-full p-6 shadow-2xl border border-purple-100 space-y-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#A05AFF] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                ผังการจัดหอพักรวม (Dormitory Layout Statistics Matrix)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ตารางแสดงจำนวนนักเรียนแยกตามระดับชั้น/ห้อง และเพศ (ช/ญ) ของแต่ละหอพัก
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="พิมพ์เอกสาร หรือ บันทึกเป็นไฟล์ PDF (A4 แนวนอน)"
            >
              <Printer className="w-4 h-4 text-indigo-100" />
              <span>พิมพ์ / บันทึก PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Container for HTML Export & Printing */}
        <div
          id="dorm-layout-printable"
          className="overflow-y-auto max-h-[70vh] p-2 space-y-3 bg-white rounded-2xl"
        >
          {/* Header Component */}
          <div className="border-b border-slate-200 pb-3 mb-3 text-center space-y-1">
            <h1 className="text-lg font-black text-slate-900">
              ผังการจัดหอพักรวม (Dormitory Layout Statistics)
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              ตารางแสดงสถิติจำนวนนักเรียนแยกตามระดับชั้น/ห้อง และเพศ (ช/ญ) ของแต่ละหอพัก
            </p>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs bg-white">
            <table className="w-full border-collapse text-xs text-slate-700">
              <thead className="sticky top-0 z-10 text-[11px]">
                {/* Header Row 1: Dorm Names with Individual Colors */}
                <tr>
                  {dorms.map((d, dIdx) => {
                    const scheme =
                      DORM_OVERVIEW_COLOR_SCHEMES[dIdx % DORM_OVERVIEW_COLOR_SCHEMES.length];
                    return (
                      <th
                        key={d.id}
                        colSpan={2}
                        className={`py-3 px-3 text-center border-b border-r ${scheme.headerBg}`}
                      >
                        <div className="font-extrabold text-sm sm:text-base">{d.name}</div>
                      </th>
                    );
                  })}
                </tr>
                {/* Header Row 2: Sub-columns (ระดับชั้น, จำนวน) */}
                <tr className="text-[10px] uppercase tracking-wider font-extrabold">
                  {dorms.flatMap((d, dIdx) => {
                    const scheme =
                      DORM_OVERVIEW_COLOR_SCHEMES[dIdx % DORM_OVERVIEW_COLOR_SCHEMES.length];
                    return [
                      <th
                        key={`${d.id}-col1`}
                        className={`py-2 px-3 text-left border-b border-r w-28 ${scheme.subHeaderBg}`}
                      >
                        ระดับชั้น
                      </th>,
                      <th
                        key={`${d.id}-col2`}
                        className={`py-2 px-3 text-center border-b border-r w-16 ${scheme.subHeaderBg}`}
                      >
                        จำนวน
                      </th>
                    ];
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dormLayoutData.maxRows === 0 ? (
                  <tr>
                    <td
                      colSpan={dorms.length * 2}
                      className="py-12 text-center text-slate-400 font-medium"
                    >
                      ไม่พบข้อมูลรายชื่อนักเรียนที่มีระดับชั้นในระบบ
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: dormLayoutData.maxRows }).map((_, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                      {dorms.flatMap((d, dIdx) => {
                        const scheme =
                          DORM_OVERVIEW_COLOR_SCHEMES[dIdx % DORM_OVERVIEW_COLOR_SCHEMES.length];
                        const item = dormLayoutData.dormActiveKeysMap[d.id]?.[rIdx];
                        return [
                          <td
                            key={`${d.id}-r${rIdx}-lbl`}
                            className={`py-2 px-3 font-semibold text-slate-800 border-r ${
                              item ? "bg-white" : "bg-slate-50/10 opacity-30"
                            }`}
                          >
                            {item ? item.key : ""}
                          </td>,
                          <td
                            key={`${d.id}-r${rIdx}-val`}
                            className={`py-2 px-3 text-center border-r ${
                              item ? scheme.cellActive : "bg-slate-50/10 opacity-30"
                            }`}
                          >
                            {item ? item.count : ""}
                          </td>
                        ];
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 font-black text-xs shadow-md">
                <tr>
                  {dorms.flatMap((d, dIdx) => {
                    const scheme =
                      DORM_OVERVIEW_COLOR_SCHEMES[dIdx % DORM_OVERVIEW_COLOR_SCHEMES.length];
                    const total = dormLayoutData.dormTotalsMap[d.id] || 0;
                    return [
                      <td
                        key={`${d.id}-tot-lbl`}
                        className={`py-2.5 px-3 border-r ${scheme.footerBg}`}
                      >
                        รวมทั้งหมด
                      </td>,
                      <td
                        key={`${d.id}-tot-val`}
                        className={`py-2.5 px-3 text-center border-r ${scheme.footerBg}`}
                      >
                        {total}
                      </td>
                    ];
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom Summary Cards (Outside Table): Gender Totals & School Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Card 1: Total Gender Breakdown */}
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-sm">
              <div className="text-xs font-black flex items-center justify-between border-b border-slate-700 pb-1.5">
                <span className="flex items-center gap-1.5 text-slate-100">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>สรุปนักเรียนในหอพักทั้งหมด</span>
                </span>
                <span className="bg-purple-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  รวม {dormLayoutData.totalStudents} คน
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-blue-300 font-bold">นักเรียนชาย (ช)</div>
                  <div className="text-sm font-black text-blue-100">
                    {dormLayoutData.totalMale} คน
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-rose-300 font-bold">นักเรียนหญิง (ญ)</div>
                  <div className="text-sm font-black text-rose-100">
                    {dormLayoutData.totalFemale} คน
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: จภ.ชร. Breakdown */}
            <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2 shadow-xs">
              <div className="text-xs font-extrabold text-purple-950 flex items-center justify-between border-b border-purple-200 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>นักเรียน จภ.ชร. (เชียงราย)</span>
                </span>
                <span className="bg-purple-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  รวม {dormLayoutData.pccCR_Total} คน
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/90 border border-purple-200 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-purple-700 font-bold">ชาย (ช)</div>
                  <div className="text-sm font-black text-purple-900">
                    {dormLayoutData.pccCR_Male} คน
                  </div>
                </div>
                <div className="bg-white/90 border border-purple-200 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-purple-700 font-bold">หญิง (ญ)</div>
                  <div className="text-sm font-black text-purple-900">
                    {dormLayoutData.pccCR_Female} คน
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: จภ.ลป. Breakdown */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 space-y-2 shadow-xs">
              <div className="text-xs font-extrabold text-emerald-950 flex items-center justify-between border-b border-emerald-200 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>นักเรียน จภ.ลป. (ลำปาง)</span>
                </span>
                <span className="bg-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  รวม {dormLayoutData.pccLP_Total} คน
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-emerald-700 font-bold">ชาย (ช)</div>
                  <div className="text-sm font-black text-emerald-900">
                    {dormLayoutData.pccLP_Male} คน
                  </div>
                </div>
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-2 text-center">
                  <div className="text-[10px] text-emerald-700 font-bold">หญิง (ญ)</div>
                  <div className="text-sm font-black text-emerald-900">
                    {dormLayoutData.pccLP_Female} คน
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
