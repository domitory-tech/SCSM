import React, { useState } from "react";
import { Dormitory, DormTeacher } from "../../types";
import { Database, Edit, Home, Phone, Plus, ShieldCheck, Trash2, User, Users, UserCheck } from "lucide-react";

type DormPosition = "ครูประธานหอพัก" | "ครูรองประธานหอพัก" | "ครูหัวหน้าหอพัก" | "ครูประจำหอพัก";

interface DormsManagementViewProps {
  dorms: Dormitory[];
  onAddDorm: (data: { name: string; type: "male" | "female" | "mixed"; teacherName: string; teacherPhone: string; capacity: number; teachers?: DormTeacher[] }) => Promise<void>;
  onUpdateDorm?: (id: string, data: Partial<Dormitory>) => Promise<void>;
  onNavigateToUsers?: () => void;
}

const getPositionBadgeStyle = (pos?: string) => {
  if (!pos) return "bg-emerald-100 text-emerald-800 border-emerald-200 font-medium";
  if (pos.includes("ประธาน") && !pos.includes("รอง")) return "bg-purple-100 text-purple-800 border-purple-200 font-black";
  if (pos.includes("รองประธาน")) return "bg-blue-100 text-blue-800 border-blue-200 font-extrabold";
  if (pos.includes("หัวหน้า")) return "bg-amber-100 text-amber-800 border-amber-200 font-extrabold";
  return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
};

export const DormsManagementView: React.FC<DormsManagementViewProps> = ({
  dorms,
  onAddDorm,
  onUpdateDorm,
  onNavigateToUsers
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDorm, setEditingDorm] = useState<Dormitory | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"male" | "female" | "mixed">("male");
  const [capacity, setCapacity] = useState(80);
  const [teachers, setTeachers] = useState<DormTeacher[]>([
    { name: "", phone: "", position: "ครูประธานหอพัก", isHead: true },
    { name: "", phone: "", position: "ครูประจำหอพัก", isHead: false }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingDorm(null);
    setName("");
    setType("male");
    setCapacity(80);
    setTeachers([
      { name: "", phone: "", position: "ครูประธานหอพัก", isHead: true },
      { name: "", phone: "", position: "ครูประจำหอพัก", isHead: false }
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Dormitory) => {
    setEditingDorm(d);
    setName(d.name);
    setType(d.type);
    setCapacity(d.capacity || 80);

    if (d.teachers && d.teachers.length > 0) {
      setTeachers(d.teachers.map((t) => ({ ...t })));
    } else {
      setTeachers([
        { name: d.teacherName || "", phone: d.teacherPhone || "", position: "ครูประธานหอพัก", isHead: true }
      ]);
    }
    setIsModalOpen(true);
  };

  const handleAddTeacherRow = () => {
    if (teachers.length >= 8) {
      alert("จำกัดทีมครูไม่เกิน 8 ท่านต่อหอพัก");
      return;
    }
    setTeachers([...teachers, { name: "", phone: "", position: "ครูประจำหอพัก", isHead: false }]);
  };

  const handleRemoveTeacherRow = (index: number) => {
    if (teachers.length <= 1) {
      alert("หอพักต้องมีครูประจำหอพักอย่างน้อย 1 ท่าน");
      return;
    }
    const updated = teachers.filter((_, i) => i !== index);
    setTeachers(updated);
  };

  const handleTeacherChange = (index: number, field: keyof DormTeacher, value: any) => {
    const updated = [...teachers];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "isHead" && value === true) {
      updated.forEach((t, i) => {
        if (i !== index) t.isHead = false;
      });
    }
    setTeachers(updated);
  };

  const handleTeacherPositionChange = (index: number, position: string, isHead: boolean) => {
    const updated = [...teachers];
    updated[index] = { ...updated[index], position, isHead };
    if (isHead) {
      updated.forEach((t, i) => {
        if (i !== index) t.isHead = false;
      });
    }
    setTeachers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("กรุณาระบุชื่อหอพัก");
      return;
    }

    const validTeachers = teachers.filter((t) => t.name.trim().length > 0);
    if (validTeachers.length === 0) {
      alert("กรุณาระบุชื่อครูประจำหอพักอย่างน้อย 1 ท่าน");
      return;
    }

    const headTeacher = validTeachers.find((t) => t.isHead || t.position === "ครูประธานหอพัก") || validTeachers[0];
    const teacherNameSummary = `${headTeacher.name} ${validTeachers.length > 1 ? `(และทีมงานอีก ${validTeachers.length - 1} ท่าน)` : ""}`;
    const teacherPhoneSummary = headTeacher.phone || validTeachers[0].phone || "-";

    setIsSubmitting(true);
    try {
      if (editingDorm && onUpdateDorm) {
        await onUpdateDorm(editingDorm.id, {
          name,
          type,
          teacherName: teacherNameSummary,
          teacherPhone: teacherPhoneSummary,
          capacity,
          teachers: validTeachers
        });
      } else {
        await onAddDorm({
          name,
          type,
          teacherName: teacherNameSummary,
          teacherPhone: teacherPhoneSummary,
          capacity,
          teachers: validTeachers
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
            <span>ดึงข้อมูลและอ้างอิงสิทธิ์ครูหอพักจาก <strong>ระบบผู้ดูแล (User Management)</strong> ในฐานข้อมูลปัจจุบัน</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
              <Database className="w-3 h-3 text-[#A05AFF]" /> ฐานข้อมูลหลัก
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหอพักใหม่ (Add Dorm)</span>
          </button>
        </div>
      </div>

      {/* Dormitories Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dorms.map((d) => {
          const displayTeachers: DormTeacher[] =
            d.teachers && d.teachers.length > 0
              ? d.teachers
              : [{ name: d.teacherName || "ยังไม่ได้ระบุครู", phone: d.teacherPhone, isHead: true, position: "ครูประธานหอพัก" }];

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
                    title="แก้ไขข้อมูลหอพัก & ทีมครู"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                {/* Teachers Team List */}
                <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                    <span className="text-[11px] font-extrabold text-gray-700 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#A05AFF]" />
                      <span>รายชื่อทีมครูประจำหอพัก ({displayTeachers.length} ท่าน)</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {displayTeachers.map((t, idx) => {
                      const posLabel = t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก");
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-gray-100 shadow-2xs hover:bg-purple-50/20 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
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
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-100 pt-3">
                <span className="flex items-center gap-1.5 font-bold">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>ความจุที่รองรับ:</span>
                </span>
                <span className="font-black text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
                  {d.capacity || 80} คน
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Dorm Modal with Teacher Management */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#A05AFF]" />
                <span>{editingDorm ? `แก้ไขข้อมูล ${editingDorm.name}` : "เพิ่มหอพักใหม่"}</span>
              </h3>
              <span className="text-xs font-bold text-[#1BCFB4] bg-teal-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Database className="w-3 h-3 text-[#1BCFB4]" /> เชื่อมระบบผู้ดูแล
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

              {/* Manual Teacher Details Editor */}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#A05AFF]" />
                    <span>รายชื่อทีมครูประจำหอพัก (ข้อมูลแสดงผล) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTeacherRow}
                    className="text-[11px] font-bold text-[#A05AFF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มครู</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {teachers.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                          <span>ครูผู้ดูแลท่านที่ {idx + 1}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${getPositionBadgeStyle(t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก"))}`}>
                            {t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก")}
                          </span>
                        </span>
                        <div className="flex items-center gap-3">
                          {teachers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTeacherRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-0.5">ตำแหน่งในหอพัก</label>
                          <select
                            value={t.position || (t.isHead ? "ครูประธานหอพัก" : "ครูประจำหอพัก")}
                            onChange={(e) => {
                              const pos = e.target.value;
                              const isHead = pos === "ครูประธานหอพัก" || pos === "ประธานหอพัก";
                              handleTeacherPositionChange(idx, pos, isHead);
                            }}
                            className="bg-white border border-gray-300 text-xs font-bold rounded-lg p-2 outline-none w-full"
                          >
                            <option value="ครูประธานหอพัก">1. ครูประธานหอพัก</option>
                            <option value="ครูรองประธานหอพัก">2. ครูรองประธานหอพัก</option>
                            <option value="ครูหัวหน้าหอพัก">3. ครูหัวหน้าหอพัก</option>
                            <option value="ครูประจำหอพัก">4. ครูประจำหอพัก</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-0.5">ชื่อ-นามสกุล</label>
                          <input
                            type="text"
                            value={t.name}
                            onChange={(e) => handleTeacherChange(idx, "name", e.target.value)}
                            placeholder="ชื่อ-นามสกุลครู..."
                            className="bg-white border border-gray-300 text-xs font-bold rounded-lg p-2 outline-none w-full"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-0.5">เบอร์โทรศัพท์</label>
                          <input
                            type="text"
                            value={t.phone || ""}
                            onChange={(e) => handleTeacherChange(idx, "phone", e.target.value)}
                            placeholder="08x-xxx-xxxx"
                            className="bg-white border border-gray-300 text-xs rounded-lg p-2 outline-none font-mono w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูลหอพัก & ครู"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
