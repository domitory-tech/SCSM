import React, { useState, useEffect } from "react";
import { UserProfile } from "../../types";
import { fetchUsers } from "../../services/api";
import {
  ShieldCheck,
  User,
  Building2,
  KeyRound,
  Lock,
  LogIn,
  X,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  targetTabName?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  currentUser,
  onLogout,
  targetTabName
}) => {
  const [loginMode, setLoginMode] = useState<"SELECT" | "DIRECT">("SELECT");
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Direct login form fields
  const [directUsername, setDirectUsername] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directRoleLevel, setDirectRoleLevel] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingUsers(true);
      fetchUsers()
        .then((users) => {
          if (users && users.length > 0) {
            setUsersList(users);
            const firstUser = users.find((u) => u.roleLevel === selectedLevel) || users[0];
            if (firstUser) {
              setSelectedUserId(firstUser.id);
              setSelectedLevel(firstUser.roleLevel as 1 | 2 | 3);
            }
          } else {
            setUsersList([]);
            setLoginMode("DIRECT");
          }
        })
        .catch((err) => {
          console.warn("fetchUsers error in LoginModal:", err);
          setUsersList([]);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter users strictly by selected Role Level (ระดับสิทธิ์ 1, 2, 3)
  const filteredUsers = usersList.filter((u) => u.roleLevel === selectedLevel);
  const activeUserToLogin =
    usersList.find((u) => u.id === selectedUserId) || filteredUsers[0];

  const handleLevelSelect = (level: 1 | 2 | 3) => {
    setSelectedLevel(level);
    setPassword("");
    setLoginError(null);
    const firstUserOfLevel = usersList.find((u) => u.roleLevel === level);
    if (firstUserOfLevel) {
      setSelectedUserId(firstUserOfLevel.id);
    }
  };

  const handleConfirmSelectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUserToLogin) {
      setLoginError("กรุณาเลือกบัญชีผู้ใช้งานที่ต้องการเข้าสู่ระบบ");
      return;
    }
    const validPassword = activeUserToLogin?.password || "123456";
    if (!password || password.trim() !== validPassword) {
      setLoginError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    setLoginError(null);
    onLogin(activeUserToLogin);
    setPassword("");
    onClose();
  };

  const handleConfirmDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const uname = directUsername.trim();
    const pwd = directPassword.trim();

    if (!uname) {
      setLoginError("กรุณากรอกชื่อผู้ใช้งาน หรือชื่อ-นามสกุล");
      return;
    }
    if (!pwd) {
      setLoginError("กรุณากรอกรหัสผ่าน");
      return;
    }

    // Check if matches an existing user in Firestore
    const matchedUser = usersList.find(
      (u) =>
        u.name.toLowerCase() === uname.toLowerCase() ||
        u.id.toLowerCase() === uname.toLowerCase()
    );

    if (matchedUser) {
      const validPassword = matchedUser.password || "123456";
      if (pwd !== validPassword) {
        setLoginError("รหัสผ่านไม่ถูกต้อง");
        return;
      }
      setLoginError(null);
      onLogin(matchedUser);
      onClose();
      return;
    }

    // Direct Login as Admin/Staff/Teacher with chosen role level
    const roleCategory: UserProfile["roleCategory"] =
      directRoleLevel === 1 ? "ADMIN" : directRoleLevel === 2 ? "STAFF" : "DORM_TEACHER";
    const roleCategoryName = directRoleLevel === 1 ? "ผู้ดูแล" : directRoleLevel === 2 ? "เจ้าหน้าที่" : "ครูหอพัก";
    const roleLabel =
      directRoleLevel === 1
        ? "ผู้ดูแลระบบ (Admin)"
        : directRoleLevel === 2
        ? "เจ้าหน้าที่สำนักงาน (Staff)"
        : "ครูประจำหอพัก (Dorm Teacher)";

    const role: UserProfile["role"] =
      directRoleLevel === 1 ? "SYSTEM_ADMIN" : directRoleLevel === 2 ? "ADMIN_OFFICER" : "DORM_TEACHER";

    const newUserProfile: UserProfile = {
      id: `user-${Date.now()}`,
      name: uname,
      role,
      roleLevel: directRoleLevel,
      roleCategory,
      roleCategoryName,
      roleLabel,
      password: pwd,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uname)}`
    };

    setLoginError(null);
    onLogin(newUserProfile);
    onClose();
  };

  const getLevelBadgeText = (level: number) => {
    if (level === 1) return "ระดับสิทธิ์ 1 - ผู้ดูแลระบบ (Admin)";
    if (level === 2) return "ระดับสิทธิ์ 2 - เจ้าหน้าที่ (Staff)";
    return "ระดับสิทธิ์ 3 - ครูประจำหอพัก (Dorm Teacher)";
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-[#A05AFF] via-[#9E58FF] to-[#1BCFB4] text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                <span>เข้าสู่ระบบ (Authentication)</span>
                <Sparkles className="w-4 h-4 text-amber-200" />
              </h3>
              <p className="text-xs text-purple-100 mt-0.5 font-medium">
                เข้าสู่ระบบด้วยบัญชีจริงในฐานข้อมูล Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message when user is redirected to login from protected tab */}
        {targetTabName && !currentUser && (
          <div className="mx-6 mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800 font-medium">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              ต้องเข้าสู่ระบบก่อนเพื่อใช้งานเมนู <strong className="text-amber-900">{targetTabName}</strong> (ส่วน <strong className="text-[#A05AFF]">แผงควบคุม Dashboard</strong> เปิดให้รับชมได้ทุกคน)
            </span>
          </div>
        )}

        {/* If user is currently logged in, show logged-in status & option to logout */}
        {currentUser && (
          <div className="mx-6 mt-5 p-4 bg-purple-50/80 border border-[#A05AFF]/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name)}`}
                alt={currentUser.name}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-[#A05AFF]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-800 text-sm">{currentUser.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#A05AFF] text-white rounded-full">
                    ระดับ {currentUser.roleLevel}: {currentUser.roleCategoryName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{currentUser.roleLabel}</p>
                <div className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>สถานะ: เข้าสู่ระบบอยู่ (Session Cookie จะคงอยู่จนกว่าจะปิดเบราว์เซอร์)</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onLogout();
              }}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap self-start sm:self-center"
            >
              ออกจากระบบ
            </button>
          </div>
        )}

        {/* Login Mode Selector Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              setLoginMode("SELECT");
              setLoginError(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              loginMode === "SELECT"
                ? "border-[#A05AFF] text-[#A05AFF]"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            เลือกจากรายชื่อในฐานข้อมูล ({usersList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("DIRECT");
              setLoginError(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              loginMode === "DIRECT"
                ? "border-[#A05AFF] text-[#A05AFF]"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            กรอกชื่อผู้ใช้ / รหัสผ่านโดยตรง
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loginMode === "SELECT" ? (
            <>
              {/* Level Tabs Selection (3 Levels) */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  เลือกระดับสิทธิ์ผู้ใช้งาน (Select Role Level)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Level 1: ผู้ดูแล */}
                  <button
                    type="button"
                    onClick={() => handleLevelSelect(1)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedLevel === 1
                        ? "bg-[#A05AFF]/10 border-[#A05AFF] shadow-xs ring-2 ring-[#A05AFF]/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <ShieldCheck className={`w-4 h-4 ${selectedLevel === 1 ? "text-[#A05AFF]" : "text-slate-400"}`} />
                    </div>
                    <div className="font-extrabold text-xs text-slate-800">1. ผู้ดูแลระบบ</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ผู้บริหาร / หัวหน้าหอ</div>
                  </button>

                  {/* Level 2: เจ้าหน้าที่ */}
                  <button
                    type="button"
                    onClick={() => handleLevelSelect(2)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedLevel === 2
                        ? "bg-[#1BCFB4]/10 border-[#1BCFB4] shadow-xs ring-2 ring-[#1BCFB4]/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Building2 className={`w-4 h-4 ${selectedLevel === 2 ? "text-[#1BCFB4]" : "text-slate-400"}`} />
                    </div>
                    <div className="font-extrabold text-xs text-slate-800">2. เจ้าหน้าที่</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">สำนักงาน / ทะเบียน</div>
                  </button>

                  {/* Level 3: ครูหอพัก */}
                  <button
                    type="button"
                    onClick={() => handleLevelSelect(3)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedLevel === 3
                        ? "bg-[#FE9496]/10 border-[#FE9496] shadow-xs ring-2 ring-[#FE9496]/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <User className={`w-4 h-4 ${selectedLevel === 3 ? "text-[#FE9496]" : "text-slate-400"}`} />
                    </div>
                    <div className="font-extrabold text-xs text-slate-800">3. ครูประจำหอพัก</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">เช็คยอดหอ 1 - 6</div>
                  </button>
                </div>
              </div>

              {/* Select User Account Form */}
              <form onSubmit={handleConfirmSelectLogin} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      เลือกบัญชีผู้ใช้งาน (User Account)
                    </label>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                      {getLevelBadgeText(selectedLevel)}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {isLoadingUsers ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                        กำลังโหลดข้อมูลผู้ใช้จาก Firestore...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="text-xs text-slate-500 font-bold">
                          ไม่พบบัญชีผู้ใช้งานในระดับสิทธิ์นี้บนฐานข้อมูล
                        </div>
                        <p className="text-[11px] text-slate-400">
                          คุณสามารถเข้าใช้งานผ่านแท็บ "กรอกชื่อผู้ใช้ / รหัสผ่านโดยตรง" ด้านบน หรือเพิ่มบัญชีที่หน้าจัดการผู้ใช้
                        </p>
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelected = u.id === (activeUserToLogin?.id || selectedUserId);
                        return (
                          <div
                            key={u.id}
                            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                              isSelected
                                ? "border-[#A05AFF] bg-gradient-to-b from-[#A05AFF]/5 to-[#A05AFF]/10 shadow-md ring-2 ring-[#A05AFF]/30"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                            }`}
                          >
                            {/* User Card Header / Selection Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedUserId !== u.id) {
                                  setSelectedUserId(u.id);
                                  setPassword("");
                                  setLoginError(null);
                                }
                              }}
                              className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.name)}`}
                                    alt={u.name}
                                    className={`w-11 h-11 rounded-full object-cover shrink-0 transition-all ${
                                      isSelected ? "ring-2 ring-[#A05AFF] scale-105" : "ring-1 ring-slate-200"
                                    }`}
                                  />
                                  {isSelected && (
                                    <span className="absolute -bottom-0.5 -right-0.5 bg-[#A05AFF] text-white p-0.5 rounded-full ring-2 ring-white">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-800 text-sm">{u.name}</span>
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                        u.roleLevel === 1
                                          ? "bg-purple-100 text-purple-800"
                                          : u.roleLevel === 2
                                          ? "bg-teal-100 text-teal-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      ระดับ {u.roleLevel}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium">{u.roleLabel}</div>
                                </div>
                              </div>

                              <div>
                                {isSelected ? (
                                  <span className="text-[11px] font-extrabold text-[#A05AFF] bg-[#A05AFF]/15 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                    <span>กำลังเลือก</span>
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400 hover:text-slate-600">
                                    คลิกเพื่อเลือก
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Password input box directly UNDER selected user name - hidden if unselected */}
                            {isSelected && (
                              <div className="px-4 pb-4 pt-2 border-t border-[#A05AFF]/15 bg-white/80 backdrop-blur-xs space-y-3 animate-fade-in">
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5 text-[#A05AFF]" />
                                      <span>รหัสผ่านเข้าสู่ระบบสำหรับ {u.name}</span>
                                    </label>
                                  </div>

                                  <div className="relative">
                                    <input
                                      type={showPassword ? "text" : "password"}
                                      placeholder="กรอกรหัสผ่าน..."
                                      value={password}
                                      onChange={(e) => {
                                        setPassword(e.target.value);
                                        setLoginError(null);
                                      }}
                                      autoFocus
                                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] focus:bg-white focus:border-transparent outline-none transition-all shadow-xs"
                                    />
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                      title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>

                                  {loginError && (
                                    <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 shrink-0" />
                                      <span>{loginError}</span>
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="submit"
                                  className="w-full py-2.5 bg-gradient-to-r from-[#A05AFF] via-[#8E3CFF] to-[#1BCFB4] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                  <KeyRound className="w-4 h-4" />
                                  <span>ยืนยันเข้าสู่ระบบ ({u.name})</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </form>
            </>
          ) : (
            /* Direct Login Form */
            <form onSubmit={handleConfirmDirectLogin} className="space-y-4">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ชื่อผู้ใช้งาน หรือชื่อ-นามสกุล
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น Admin, ครูสมชาย หรือชื่อผู้ใช้ของคุณ"
                    value={directUsername}
                    onChange={(e) => {
                      setDirectUsername(e.target.value);
                      setLoginError(null);
                    }}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่าน..."
                      value={directPassword}
                      onChange={(e) => {
                        setDirectPassword(e.target.value);
                        setLoginError(null);
                      }}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    ระดับสิทธิ์ (Role Level)
                  </label>
                  <select
                    value={directRoleLevel}
                    onChange={(e) => setDirectRoleLevel(Number(e.target.value) as 1 | 2 | 3)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none shadow-xs"
                  >
                    <option value={1}>ระดับ 1: ผู้ดูแลระบบ / ผู้บริหาร (Admin)</option>
                    <option value={2}>ระดับ 2: เจ้าหน้าที่สำนักงาน (Staff)</option>
                    <option value={3}>ระดับ 3: ครูประจำหอพัก (Dorm Teacher)</option>
                  </select>
                </div>

                {loginError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};



