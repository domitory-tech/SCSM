import React, { useState } from "react";
import { Dormitory, DormTeacher, Student, UserProfile } from "../../types";
import { countStudentsInDorm, getDormTeachers, getPositionBadgeStyle, getPositionDotColor } from "../../utils/dormUtils";
import { useUsersQuery } from "../../services/useDormQueries";
import {
  Database,
  Edit,
  Home,
  Phone,
  Plus,
  ShieldCheck,
  User,
  Users,
  UserCheck,
  CheckCircle2,
  BedDouble,
  ExternalLink,
  Info
} from "lucide-react";

interface DormsManagementViewProps {
  dorms: Dormitory[];
  students?: Student[];
  users?: UserProfile[];
  onAddDorm: (data: { name: string; type: "male" | "female" | "mixed"; teacherName: string; teacherPhone: string; capacity: number }) => Promise<void>;
  onUpdateDorm?: (id: string, data: Partial<Dormitory>) => Promise<void>;
  onNavigateToUsers?: () => void;
}

export const DormsManagementView: React.FC<DormsManagementViewProps> = ({
  dorms,
  students = [],
  users: propUsers,
  onAddDorm,
  onUpdateDorm,
  onNavigateToUsers
}) => {
  const { data: queriedUsers = [] } = useUsersQuery();
  const effectiveUsers = propUsers && propUsers.length > 0 ? propUsers : queriedUsers;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDorm, setEditingDorm] = useState<Dormitory | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"male" | "female" | "mixed">("male");
  const [capacity, setCapacity] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalCapacity = dorms.reduce((acc, d) => acc + (d.capacity || 80), 0);
  const totalStudents = students.length;
  const overallOccupancy = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;

  const handleOpenAdd = () => {
    setEditingDorm(null);
    setName("");
    setType("male");
    setCapacity(80);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Dormitory) => {
    setEditingDorm(d);
    setName(d.name);
    setType(d.type);
    setCapacity(d.capacity || 80);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("กรุณาระบุชื่อหอพัก");
      return;
    }

    const currentTargetDorm: Dormitory = editingDorm || {
      id: `temp-${Date.now()}`,
      name,
      type,
      capacity,
      teacherName: "",
      teacherPhone: ""
    };

    const derivedTeachers = getDormTeachers(currentTargetDorm, effectiveUsers);
    const headTeacher = derivedTeachers.find((t) => t.isHead) || derivedTeachers[0];
    const teacherNameSummary =
      derivedTeachers.length > 0
        ? `${headTeacher.name}${derivedTeachers.length > 1 ? ` (และทีมงานอีก ${derivedTeachers.length - 1} ท่าน)` : ""}`
        : "ครูประจำหอพัก";
    const teacherPhoneSummary = headTeacher?.phone || "-";

    setIsSubmitting(true);
    try {
      if (editingDorm && onUpdateDorm) {
        await onUpdateDorm(editingDorm.id, {
          name,
          type,
          teacherName: teacherNameSummary,
          teacherPhone: teacherPhoneSummary,
          capacity
        });
      } else {
        await onAddDorm({
          name,
          type,
          teacherName: teacherNameSummary,
          teacherPhone: teacherPhoneSummary,
          capacity
        });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Panel */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#A05AFF]" />
            <h2 className="text-xl font-black text-gray-900">จัดการข้อมูลหอพักนักเรียน & ทีมครูประจำหอพัก</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>ดึงรายชื่อและตำแหน่งครูประจำหอพักอัตโนมัติจาก <strong>สิทธิ์การเข้าถึงหอพักในระบบผู้ใช้</strong></span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
              <Database className="w-3 h-3 text-[#A05AFF]" /> ดึงจากฐานข้อมูลผู้ใช้ Real-time
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {onNavigateToUsers && (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#A05AFF] font-bold text-xs rounded-xl border border-purple-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>จัดการสิทธิ์ครูหอพักในระบบผู้ใช้</span>
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหอพักใหม่ (Add Dorm)</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1">
            <Home className="w-4 h-4 text-[#A05AFF]" />
            <span>หอพักทั้งหมด</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{dorms.length} <span className="text-xs font-normal text-gray-500">หอ</span></div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1">
            <Users className="w-4 h-4 text-purple-600" />
            <span>นักเรียนทั้งหมดในระบบ</span>
          </div>
          <div className="text-2xl font-black text-purple-700">{totalStudents} <span className="text-xs font-normal text-gray-500">คน</span></div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1">
            <BedDouble className="w-4 h-4 text-emerald-600" />
            <span>ความจุรวมทุกหอ</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{totalCapacity} <span className="text-xs font-normal text-gray-500">ที่</span></div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>อัตราการครองเตียงรวม</span>
          </div>
          <div className="text-2xl font-black text-blue-700">{overallOccupancy.toFixed(1)}%</div>
        </div>
      </div>

      {/* Dormitories Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dorms.map((d) => {
          const displayTeachers: DormTeacher[] = getDormTeachers(d, effectiveUsers);
          const dormStudentCount = countStudentsInDorm(students, d);
          const dormCap = d.capacity || 80;
          const dormOccPercent = dormCap > 0 ? (dormStudentCount / dormCap) * 100 : 0;

          return (
            <div
              key={d.id}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:border-[#A05AFF]/40 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                        d.type === "male"
                          ? "bg-purple-600"
                          : d.type === "female"
                          ? "bg-pink-500"
                          : "bg-amber-600"
                      }`}
                    >
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-base">{d.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            d.type === "male"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : d.type === "female"
                              ? "bg-pink-50 text-pink-700 border border-pink-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {d.type === "male" ? "หอพักชาย" : d.type === "female" ? "หอพักหญิง" : "หอพักรวม"}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ทีมครู {displayTeachers.length} ท่าน
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(d)}
                    className="p-2 text-[#A05AFF] hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                    title="แก้ไขข้อมูลหอพัก"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                {/* Teachers Team List (Derived from Users) */}
                <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                    <span className="text-[11px] font-extrabold text-gray-700 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#A05AFF]" />
                      <span>รายชื่อทีมครูประจำหอพัก ({displayTeachers.length} ท่าน)</span>
                    </span>
                    {onNavigateToUsers && (
                      <button
                        type="button"
                        onClick={onNavigateToUsers}
                        className="text-[10px] font-bold text-[#A05AFF] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>จัดการสิทธิ์</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {displayTeachers.length > 0 ? (
                      displayTeachers.map((t, idx) => {
                        const posLabel = t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก");
                        return (
                          <div
                            key={t.id || idx}
                            className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-gray-100 shadow-2xs hover:bg-purple-50/20 transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${getPositionDotColor(posLabel)}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-gray-800 truncate">{t.name}</span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-md border shrink-0 ${getPositionBadgeStyle(posLabel)}`}
                                  >
                                    {posLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {t.phone && t.phone !== "-" && (
                              <div className="flex items-center gap-1 text-[11px] font-mono font-medium text-gray-500 shrink-0">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{t.phone}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-2.5 text-center text-xs text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                        ยังไม่มีครูที่ได้รับสิทธิ์หอพักนี้
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dorm Capacity & Actual Student Counts */}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-gray-600">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>นักเรียนปัจจุบัน:</span>
                  </span>
                  <span className="font-black text-purple-900 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                    {dormStudentCount} คน
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1.5 font-medium text-gray-500">
                    <BedDouble className="w-4 h-4 text-gray-400" />
                    <span>ความจุที่รองรับ:</span>
                  </span>
                  <span className="font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                    {dormCap} คน
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dormOccPercent > 100
                        ? "bg-red-500"
                        : dormOccPercent > 90
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, dormOccPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                  <span>อัตราการครองเตียง</span>
                  <span className="font-bold text-gray-700">{dormOccPercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Dorm Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#A05AFF]" />
                <span>{editingDorm ? `แก้ไขข้อมูล ${editingDorm.name}` : "เพิ่มหอพักใหม่"}</span>
              </h3>
              <span className="text-xs font-bold text-[#1BCFB4] bg-teal-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Database className="w-3 h-3 text-[#1BCFB4]" /> เชื่อมโยงระบบผู้ใช้
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อหอพัก *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น หอพัก 1 (ชาย)"
                    className="w-full bg-gray-50 border border-gray-300 text-xs rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ประเภทหอพัก</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "male" | "female" | "mixed")}
                    className="w-full bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl p-2.5 outline-none"
                  >
                    <option value="male">1. หอพักชาย</option>
                    <option value="female">2. หอพักหญิง</option>
                    <option value="mixed">3. หอพักรวม</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ความจุที่รองรับนักเรียน (คน)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 80)}
                  className="w-full bg-gray-50 border border-gray-300 text-xs font-bold rounded-xl p-2.5 outline-none"
                />
              </div>

              {/* Automatic User-Derived Teachers Information Panel */}
              {(() => {
                const currentDormForPreview: Dormitory = editingDorm || {
                  id: "preview-dorm",
                  name,
                  type,
                  capacity,
                  teacherName: "",
                  teacherPhone: ""
                };
                const assignedTeachers = getDormTeachers(currentDormForPreview, effectiveUsers);

                return (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#A05AFF]" />
                        <span>ทีมครูประจำหอพัก (ดึงจากบัญชีผู้ใช้ตามสิทธิ์อัตโนมัติ)</span>
                      </label>
                      {onNavigateToUsers && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            onNavigateToUsers();
                          }}
                          className="text-[11px] font-bold text-[#A05AFF] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>จัดการสิทธิ์ผู้ใช้</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2 text-[11px] text-purple-900 font-medium">
                        <Info className="w-4 h-4 text-[#A05AFF] shrink-0 mt-0.5" />
                        <span>
                          ระบบจะดึงรายชื่อ ตำแหน่ง และเบอร์โทรศัพท์ของครูประจำหอพักจาก <strong>หน้าจัดการข้อมูลผู้ใช้/เจ้าหน้าที่</strong> โดยอัตโนมัติตามสิทธิ์การเช็คยอด
                        </span>
                      </div>

                      {assignedTeachers.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {assignedTeachers.map((t, idx) => {
                            const posLabel = t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก");
                            return (
                              <div
                                key={t.id || idx}
                                className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-purple-100 shadow-2xs gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span className="font-bold text-gray-800 truncate">{t.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md border shrink-0 ${getPositionBadgeStyle(posLabel)}`}>
                                    {posLabel}
                                  </span>
                                </div>
                                {t.phone && t.phone !== "-" && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-gray-500 shrink-0">
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    <span>{t.phone}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 text-center text-xs text-purple-800 bg-white/80 rounded-lg border border-purple-200 font-medium">
                          ยังไม่มีครูหอพักที่ได้รับสิทธิ์ในหอพักนี้ กำหนดสิทธิ์ได้ที่หน้า "จัดการผู้ใช้"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] text-white text-xs font-extrabold rounded-xl shadow-md hover:opacity-95 cursor-pointer"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูลหอพัก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
