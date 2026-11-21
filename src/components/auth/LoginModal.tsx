import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile, SystemSettings } from "../../types";
import { fetchUsers, verifyUserPasswordById, setupFirstTimePassword, invalidateFirestoreReadCache } from "../../services/api";
import { DEFAULT_SYSTEM_USERS } from "../../data/userProfiles";
import { getDirectImageUrl } from "../../utils/dateUtils";
import { isValidPasswordStrength, sanitizeUserForClient } from "../../utils/security";
import {
  auth,
  ensureAuthReady,
  signInWithGoogleAndRefresh,
  getCurrentHostname,
  FIREBASE_PROJECT_ID
} from "../../lib/firebase";
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
  Sparkles,
  UserCheck,
  Shield
} from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  targetTabName?: string;
  standalone?: boolean;
  systemSettings?: SystemSettings;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  currentUser,
  onLogout,
  targetTabName,
  standalone = false,
  systemSettings
}) => {
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(1);
  const [password, setPassword] = useState("");
  const [confirmInitialPassword, setConfirmInitialPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usersList, setUsersList] = useState<UserProfile[]>(DEFAULT_SYSTEM_USERS);
  const [selectedUserId, setSelectedUserId] = useState<string>("user-admin");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string>(() => auth.currentUser?.emailVerified ? (auth.currentUser.email || "") : "");
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((fbUser) => {
      setFirebaseUserEmail(fbUser?.emailVerified && fbUser.email ? fbUser.email : "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen || standalone) {
      let cancelled = false;
      setIsLoadingUsers(true);
      ensureAuthReady()
        .then(() => fetchUsers())
        .then((users) => {
          if (cancelled) return;
          if (users && users.length > 0) {
            setUsersList(users);
            const firstUser = users.find((u) => u.roleLevel === selectedLevel) || users[0];
            if (firstUser && !selectedUserId) {
              setSelectedUserId(firstUser.id);
              setSelectedLevel(firstUser.roleLevel as 1 | 2 | 3 | 4);
            }
          }
        })
        .catch((err) => {
          console.warn("fetchUsers background sync:", err);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingUsers(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, standalone, firebaseUserEmail]);

  if (!isOpen && !standalone) return null;

  // Filter users strictly by selected Role Level (ระดับสิทธิ์ 1, 2, 3, 4)
  const filteredUsers = usersList.filter((u) => u.roleLevel === selectedLevel);
  const activeUserToLogin =
    filteredUsers.find((u) => u.id === selectedUserId) || filteredUsers[0];

  const handleLevelSelect = (level: 1 | 2 | 3 | 4) => {
    setSelectedLevel(level);
    setPassword("");
    setConfirmInitialPassword("");
    setLoginError(null);
    const firstUserOfLevel = usersList.find((u) => u.roleLevel === level);
    if (firstUserOfLevel) {
      setSelectedUserId(firstUserOfLevel.id);
    } else {
      setSelectedUserId("");
    }
  };

  const handleConfirmSelectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUserToLogin) {
      setLoginError("กรุณาเลือกบัญชีผู้ใช้งานที่ต้องการเข้าสู่ระบบ");
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);
    try {
      // Initial first-time password creation when an account does not yet have a password configured
      if (!activeUserToLogin.hasPassword) {
        if (!isValidPasswordStrength(password)) {
          setLoginError("กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร");
          return;
        }
        if (password.trim() !== confirmInitialPassword.trim()) {
          setLoginError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
          return;
        }
        const updatedUser = await setupFirstTimePassword(activeUserToLogin.id, password);
        setUsersList((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
        onLogin(sanitizeUserForClient(updatedUser));
        setPassword("");
        setConfirmInitialPassword("");
        if (!standalone) onClose();
        return;
      }

      // Standard cryptographic password verification
      if (!password.trim()) {
        setLoginError("กรุณากรอกรหัสผ่าน");
        return;
      }

      const isValid = await verifyUserPasswordById(activeUserToLogin.id, password);
      if (!isValid) {
        setLoginError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
        return;
      }

      onLogin(sanitizeUserForClient(activeUserToLogin));
      setPassword("");
      setConfirmInitialPassword("");
      if (!standalone) {
        onClose();
      }
    } catch (err: any) {
      setLoginError(err?.message || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleVerifySession = async () => {
    setIsSubmitting(true);
    setLoginError(null);
    setUnauthorizedDomainHost(null);
    try {
      const fbUser = await signInWithGoogleAndRefresh();
      invalidateFirestoreReadCache();
      await queryClient.invalidateQueries();
      const freshUsers = await fetchUsers().catch(() => usersList);
      if (freshUsers && freshUsers.length > 0) {
        setUsersList(freshUsers);
      }

      const verifiedEmail = (fbUser.email || "").trim().toLowerCase();
      if (verifiedEmail === "domitory@pcccr.ac.th") {
        const existingAdmin = freshUsers.find((u) => u.roleLevel === 1);
        const adminProfile: UserProfile = sanitizeUserForClient({
          id: existingAdmin?.id || `google-${fbUser.uid}`,
          name: existingAdmin?.name || fbUser.displayName || "ผู้ดูแลระบบหลัก",
          phone: existingAdmin?.phone || "",
          role: "SYSTEM_ADMIN",
          roleLevel: 1,
          roleCategory: "ADMIN",
          roleCategoryName: "ผู้ดูแล",
          roleLabel: existingAdmin?.roleLabel || "ผู้ดูแลระบบหลัก (Google Verified Admin)",
          dormId: existingAdmin?.dormId || "",
          allowedDormIds: existingAdmin?.allowedDormIds || [],
          avatarUrl: existingAdmin?.avatarUrl || getDirectImageUrl(fbUser.photoURL || "")
        });
        onLogin(adminProfile);
        if (!standalone) onClose();
        return;
      }

      const fallbackVisitor: UserProfile =
        freshUsers.find((u) => u.roleLevel === 4) ||
        sanitizeUserForClient({
          id: `google-${fbUser.uid}`,
          name: fbUser.displayName || fbUser.email || "ผู้เยี่ยมชมระบบ",
          role: "GUEST",
          roleLevel: 4,
          roleCategory: "GUEST",
          roleCategoryName: "ผู้เยี่ยมชม",
          roleLabel: "ผู้เยี่ยมชมที่ยืนยันตัวตนแล้ว",
          avatarUrl: getDirectImageUrl(fbUser.photoURL || "")
        });
      onLogin(sanitizeUserForClient(fallbackVisitor));
      if (!standalone) onClose();
    } catch (err: any) {
      if (err?.code === "auth/unauthorized-domain") {
        setUnauthorizedDomainHost(getCurrentHostname());
      }
      setLoginError(err?.message || "การยืนยันบัญชี Google ถูกยกเลิกหรือไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLevelBadgeText = (level: number) => {
    if (level === 1) return "ระดับสิทธิ์ 1 - ผู้ดูแลระบบ (Admin)";
    if (level === 2) return "ระดับสิทธิ์ 2 - เจ้าหน้าที่ (Staff)";
    if (level === 4) return "ระดับสิทธิ์ 4 - ผู้เยี่ยมชม (Visitor)";
    return "ระดับสิทธิ์ 3 - ครูประจำหอพัก (Dorm Teacher)";
  };

  const loginCard = (
    <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
      {/* Modal Header */}
      <div className="p-6 bg-gradient-to-r from-[#A05AFF] via-[#9E58FF] to-[#1BCFB4] text-white flex items-center justify-between relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          {standalone && systemSettings?.schoolLogoUrl ? (
            <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={getDirectImageUrl(systemSettings.schoolLogoUrl)}
                alt="School Logo"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner shrink-0">
              <LogIn className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
              <span className="truncate">
                {standalone
                  ? systemSettings?.systemNameTh || "ระบบบริหารจัดการหอพักนักเรียน"
                  : "เข้าสู่ระบบ (Authentication)"}
              </span>
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
            </h3>
            <p className="text-xs text-purple-100 mt-0.5 font-medium truncate">
              {standalone
                ? `${systemSettings?.schoolNameTh || "เข้าสู่ระบบเพื่อเข้าใช้งาน"} • กรุณาเข้าสู่ระบบก่อนเข้าใช้งาน`
                : "เข้าสู่ระบบด้วยบัญชีผู้ใช้งานที่ลงทะเบียนในระบบ"}
            </p>
          </div>
        </div>

        {!standalone && (
          <button
            type="button"
            onClick={onClose}
            className="relative z-10 text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/15 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Standalone Notice Banner */}
      {standalone && !currentUser && (
        <div className="mx-6 mt-5 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-3 text-xs text-purple-900 font-semibold">
          <Lock className="w-4.5 h-4.5 text-[#A05AFF] shrink-0" />
          <span>
            ระบบตั้งค่าให้ผู้ใช้งานทุกระดับ (รวมถึง <strong>ระดับ 4 ผู้เยี่ยมชม</strong>) ต้องเข้าสู่ระบบก่อนเข้าดูข้อมูล
          </span>
        </div>
      )}

      {/* Message when user is redirected to login from protected tab */}
      {!standalone && targetTabName && !currentUser && (
        <div className="mx-6 mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800 font-medium">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            ต้องเข้าสู่ระบบก่อนเพื่อใช้งานเมนู <strong className="text-amber-900">{targetTabName}</strong>
          </span>
        </div>
      )}

      {/* If user is currently logged in, show logged-in status & option to logout */}
      {currentUser && (
        <div className="mx-6 mt-5 p-4 bg-purple-50/80 border border-[#A05AFF]/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <img
              src={getDirectImageUrl(currentUser.avatarUrl || "") || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name)}`}
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
                <span>สถานะ: เข้าสู่ระบบอยู่ (Session จะคงอยู่จนกว่าจะปิดเบราว์เซอร์)</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            ออกจากระบบ
          </button>
        </div>
      )}

      {/* Account Selector Header */}
      <div className="px-6 pt-4 pb-2.5 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#A05AFF]">
            เลือกบัญชีผู้ใช้งานในระบบ ({usersList.length} บัญชี)
          </span>
          <button
            type="button"
            onClick={handleGoogleVerifySession}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {firebaseUserEmail
                ? `เชื่อมต่อ Google แล้ว (${firebaseUserEmail})`
                : "เข้าสู่ระบบ / เชื่อมต่อฐานข้อมูลด้วย Google"}
            </span>
          </button>
        </div>

        {!firebaseUserEmail && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium leading-relaxed">
            หากเปิดใช้งานจาก <strong>GitHub Pages</strong> หรืออุปกรณ์ใหม่ กรุณากดปุ่ม{" "}
            <strong>"เข้าสู่ระบบ / เชื่อมต่อฐานข้อมูลด้วย Google"</strong> ด้านบนเพื่อดึงข้อมูลล่าสุดจาก Firestore
          </div>
        )}

        {unauthorizedDomainHost && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1.5">
            <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>ต้องเพิ่มโดเมน GitHub Pages ใน Firebase Console ก่อนจึงจะล็อกอิน Google ได้</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-rose-800">
              <li>
                เปิด Firebase Console โปรเจกต์ <code className="bg-white px-1 rounded border border-rose-200 font-bold">{FIREBASE_PROJECT_ID}</code>
              </li>
              <li>
                ไปที่ <strong>Authentication &gt; Settings &gt; Authorized domains</strong>
              </li>
              <li>
                กด <strong>Add domain</strong> แล้วเพิ่มโดเมน{" "}
                <code className="bg-white px-1.5 py-0.5 rounded border border-rose-300 font-bold text-rose-950">{unauthorizedDomainHost}</code>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="p-6 overflow-y-auto space-y-5">
        {/* Level Tabs Selection (4 Levels) */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            เลือกระดับสิทธิ์ผู้ใช้งาน (Select Role Level)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

            <button
              type="button"
              onClick={() => handleLevelSelect(4)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedLevel === 4
                  ? "bg-slate-800/5 border-slate-700 shadow-xs ring-2 ring-slate-400/30"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <UserCheck className={`w-4 h-4 ${selectedLevel === 4 ? "text-slate-800" : "text-slate-400"}`} />
              </div>
              <div className="font-extrabold text-xs text-slate-800">4. ผู้เยี่ยมชม</div>
              <div className="text-[10px] text-slate-500 mt-0.5">ดูข้อมูลตามสิทธิ์</div>
            </button>
          </div>
        </div>

        {/* Select User Account Form */}
        <form onSubmit={handleConfirmSelectLogin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
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
                  กำลังโหลดข้อมูลผู้ใช้จากฐานข้อมูลระบบ...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs text-slate-600 font-bold">
                    ไม่พบบัญชีผู้ใช้งานใน{getLevelBadgeText(selectedLevel)}บนฐานข้อมูล
                  </div>
                  <p className="text-[11px] text-slate-500">
                    กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างหรือกำหนดสิทธิ์บัญชีผู้ใช้งานในเมนูจัดการผู้ใช้
                  </p>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = u.id === (activeUserToLogin?.id || selectedUserId);
                  const needsInitialPassword = !u.hasPassword;
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
                            setConfirmInitialPassword("");
                            setLoginError(null);
                          }
                        }}
                        className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={getDirectImageUrl(u.avatarUrl || "") || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.name)}`}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-800 text-sm">{u.name}</span>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                  u.roleLevel === 1
                                    ? "bg-purple-100 text-purple-800"
                                    : u.roleLevel === 2
                                    ? "bg-teal-100 text-teal-800"
                                    : u.roleLevel === 4
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                ระดับ {u.roleLevel}
                              </span>
                              {needsInitialPassword && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                  ตั้งรหัสผ่านครั้งแรก
                                </span>
                              )}
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

                      {/* Password input box directly UNDER selected user name */}
                      {isSelected && (
                        <div className="px-4 pb-4 pt-2 border-t border-[#A05AFF]/15 bg-white/80 backdrop-blur-xs space-y-3 animate-fade-in">
                          {needsInitialPassword && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold">
                              บัญชีนี้ยังไม่ได้ตั้งค่ารหัสผ่านส่วนตัว กรุณากำหนดรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร) เพื่อใช้งานอย่างปลอดภัย
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-[#A05AFF]" />
                                <span>
                                  {needsInitialPassword
                                    ? `กำหนดรหัสผ่านใหม่สำหรับ ${u.name}`
                                    : `รหัสผ่านเข้าสู่ระบบสำหรับ ${u.name}`}
                                </span>
                              </label>
                            </div>

                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                placeholder={needsInitialPassword ? "ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร..." : "กรอกรหัสผ่าน..."}
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

                            {needsInitialPassword && (
                              <div className="relative mt-2.5">
                                <input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง..."
                                  value={confirmInitialPassword}
                                  onChange={(e) => {
                                    setConfirmInitialPassword(e.target.value);
                                    setLoginError(null);
                                  }}
                                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] focus:bg-white focus:border-transparent outline-none transition-all shadow-xs"
                                />
                                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                              </div>
                            )}

                            {loginError && (
                              <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{loginError}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-gradient-to-r from-[#A05AFF] via-[#8E3CFF] to-[#1BCFB4] hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#A05AFF]/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            <KeyRound className="w-4 h-4" />
                            <span>
                              {isSubmitting
                                ? "กำลังตรวจสอบข้อมูล..."
                                : needsInitialPassword
                                ? `บันทึกรหัสผ่านและเข้าสู่ระบบ (${u.name})`
                                : `ยืนยันเข้าสู่ระบบ (${u.name})`}
                            </span>
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
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f2f4f9] via-purple-50/70 to-teal-50/50 flex items-center justify-center p-4 font-sans">
        {loginCard}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      {loginCard}
    </div>
  );
};
