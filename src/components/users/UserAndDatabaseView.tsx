import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, Dormitory, SystemSettings, DormPosition } from "../../types";

import { DEFAULT_SYSTEM_SETTINGS, formatThaiFullDate, getDirectImageUrl, getTodayDateString, formatThaiMonthString, formatThaiDateRange } from "../../utils/dateUtils";
import { compressImageFile, compressDataUrlIfNeeded } from "../../utils/imageUtils";
import { FirebaseStatusBadge } from "../common/FirebaseStatusBadge";
import {
  fetchUsers,
  addUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  clearDatabase,
  clearAttendanceDatabase,
  clearStudentsDatabase,
  exportDatabase,
  restoreDatabase,
  exportAttendanceAndNoticesDatabase,
  restoreAttendanceAndNoticesDatabase,
  savePrimaryDatabase,
  initializeDefaultFirebaseDatabase,
  syncLiveFirebaseDatabase
} from "../../services/api";
import {
  Key,
  User,
  Shield,
  Trash2,
  Edit,
  Plus,
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Lock,
  UserCheck,
  RefreshCw,
  Image as ImageIcon,
  Settings,
  Building2,
  School,
  Home,
  GraduationCap,
  Award,
  Crown,
  Star,
  Save,
  Calendar,
  ChevronDown,
  Server,
  Globe,
  Copy,
  ExternalLink,
  Layers,
  Check,
  Github,
  GitBranch,
  Code2,
  CloudUpload,
  Cloud,
  Loader2,
  X,
  CalendarDays,
  Phone,
  CalendarRange,
  Clock,
  FileText,
  CheckCircle2,
  Filter,
  RotateCcw,
  FileJson,
  ShieldAlert,
  ListFilter
} from "lucide-react";
import { uploadImageToGoogleDrive } from "../../services/googleDrive";

interface UserAndDatabaseViewProps {
  currentUser: UserProfile | null;
  dorms: Dormitory[];
  systemSettings?: SystemSettings;
  onUpdateSystemSettings?: (settings: SystemSettings) => void;
  onDataReset?: () => void;
  onUserUpdated?: (updatedUser: UserProfile) => void;
}

const GOOGLE_DRIVE_AVATAR_FOLDER_URL = "https://drive.google.com/drive/folders/1K7PFEk9ylOYLBtMHFijwPkzB3Xl13UfQ?usp=sharing";

const PRESET_AVATARS = [
  // 1. Male Suit + Red Tie + Blue Circle BG (ผู้บริหาร/ผู้ดูแล)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23D0E3FF"/><path d="M18 90 C 22 65, 35 60, 50 60 C 65 60, 78 65, 82 90 Z" fill="%233B6C8C"/><polygon points="50,60 41,75 50,85 59,75" fill="%23FFFFFF"/><polygon points="38,60 50,75 41,75" fill="%23E2E8F0"/><polygon points="62,60 50,75 59,75" fill="%23E2E8F0"/><polygon points="50,72 45,80 50,95 55,80" fill="%23E56B6F"/><polygon points="46,72 54,72 52,78 48,78" fill="%23C94A4E"/><rect x="43" y="48" width="14" height="16" rx="3" fill="%23FCD3C1"/><path d="M32 30 Q32 18 50 18 Q68 18 68 30 V42 Q68 56 50 56 Q32 56 32 42 Z" fill="%23FCD3C1"/><circle cx="31" cy="38" r="4" fill="%23F8B195"/><circle cx="69" cy="38" r="4" fill="%23F8B195"/><path d="M31 30 Q32 16 50 15 Q68 16 69 30 Q62 20 50 24 Q38 22 31 30 Z" fill="%232C4C64"/><path d="M64 22 C 68 24, 69 28, 68 32 C 66 26, 62 23, 64 22 Z" fill="%232C4C64"/></svg>`,
  // 2. Female Yellow Shirt + Pink Circle BG (เจ้าหน้าที่/ครูหอพัก)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23FF4D6D"/><path d="M16 85 C 20 62, 35 58, 50 58 C 65 58, 80 62, 84 85 Z" fill="%23F59E0B"/><polygon points="50,82 33,58 43,58" fill="%23FFFFFF"/><polygon points="50,82 67,58 57,58" fill="%23FFFFFF"/><polygon points="50,82 43,58 50,66 57,58" fill="%23F3F4F6"/><rect x="42" y="46" width="16" height="18" rx="4" fill="%23FCD3C1"/><path d="M42 54 C 46 58, 54 58, 58 54 L58 64 L42 64 Z" fill="%23F8B195" opacity="0.4"/><path d="M22 32 C 22 18, 32 10, 50 10 C 68 10, 78 18, 78 32 V 68 C 78 68, 72 72, 68 62 L 68 35 C 68 18, 32 18, 32 35 L 32 62 C 28 72, 22 68, 22 68 Z" fill="%232D3748"/><path d="M33 30 C 33 18, 67 18, 67 30 V 42 C 67 55, 33 55, 33 42 Z" fill="%23FCD3C1"/><circle cx="31" cy="38" r="3.5" fill="%23F8B195"/><circle cx="69" cy="38" r="3.5" fill="%23F8B195"/><path d="M31 30 C 32 15, 68 15, 69 30 C 60 18, 52 35, 31 30 Z" fill="%232D3748"/></svg>`,
  // 3. User ID Card + Green Checkmark Badge (บัตรประจำตัวผู้ใช้)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="12" y="8" width="76" height="84" rx="8" fill="%23F1F5F9" stroke="%23E2E8F0" stroke-width="2"/><path d="M12 16 C 12 11.5, 15.5 8, 20 8 L 80 8 C 84.5 8, 88 11.5, 88 16 V 24 H 12 Z" fill="%230088FF"/><circle cx="64" cy="16" r="2" fill="%23FFFFFF"/><circle cx="72" cy="16" r="2" fill="%23FFFFFF"/><circle cx="80" cy="16" r="2" fill="%23FFFFFF"/><circle cx="30" cy="42" r="18" fill="%23FBBF24"/><circle cx="30" cy="37" r="7" fill="%23475569"/><path d="M18 51 C 18 44, 23 42, 30 42 C 37 42, 42 44, 42 51 Z" fill="%230088FF"/><rect x="52" y="32" width="24" height="8" rx="4" fill="%2300D2FF"/><rect x="52" y="46" width="24" height="8" rx="4" fill="%2300D2FF"/><rect x="20" y="64" width="46" height="4" rx="2" fill="%2364748B"/><rect x="20" y="72" width="46" height="4" rx="2" fill="%2364748B"/><rect x="20" y="80" width="46" height="4" rx="2" fill="%2364748B"/><circle cx="76" cy="74" r="16" fill="%2310B981"/><polyline points="68,74 74,80 84,68" fill="none" stroke="%23FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 4. Male Suit + Orange Tie (เจ้าหน้าที่)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M16 92 C 20 62, 34 56, 50 56 C 66 56, 80 62, 84 92 Z" fill="%232B3A67"/><polygon points="50,56 36,70 50,82 64,70" fill="%23FFFFFF"/><polygon points="36,56 50,70 36,70" fill="%23CBD5E1"/><polygon points="64,56 50,70 64,70" fill="%23CBD5E1"/><polygon points="50,68 44,76 50,92 56,76" fill="%23FF4D4D"/><polygon points="46,68 54,68 52,74 48,74" fill="%23D63031"/><rect x="42" y="44" width="16" height="16" rx="3" fill="%23F8C291"/><path d="M30 26 C 30 14, 70 14, 70 26 V 40 C 70 54, 30 54, 30 40 Z" fill="%23F8C291"/><circle cx="28" cy="36" r="4" fill="%23E59866"/><circle cx="72" cy="36" r="4" fill="%23E59866"/><path d="M28 26 C 28 10, 68 8, 68 18 C 68 18, 64 8, 48 8 C 34 8, 28 18, 28 26 Z" fill="%234A312C"/><path d="M28 26 C 30 16, 48 18, 68 18 C 66 12, 50 10, 28 26 Z" fill="%2336221D"/></svg>`,
  // 5. Monitor Screen + User + Green Gear (ผู้ดูแลระบบ)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M34 94 L66 94 L60 84 L40 84 Z" fill="%230088FF"/><rect x="46" y="80" width="8" height="8" fill="%230088FF"/><rect x="6" y="6" width="68" height="74" rx="8" fill="%230088FF"/><rect x="10" y="10" width="60" height="66" rx="6" fill="%23EBF5FF"/><path d="M10 16 C 10 12.5, 12.5 10, 16 10 L 64 10 C 67.5 10, 70 12.5, 70 16 V 20 H 10 Z" fill="%23FF0055"/><circle cx="34" cy="24" r="10" fill="%233B82F6"/><path d="M20 48 C 20 38, 26 36, 34 36 C 42 36, 48 38, 48 48 Z" fill="%23FBBF24"/><polygon points="34,36 30,42 38,42" fill="%23FFFFFF"/><rect x="18" y="54" width="32" height="3" rx="1.5" fill="%2364748B"/><rect x="18" y="60" width="24" height="3" rx="1.5" fill="%2364748B"/><g transform="translate(74, 52)"><circle cx="0" cy="0" r="18" fill="%2322C55E"/><path d="M-4 -22 H4 V22 H-4 Z" fill="%2322C55E"/><path d="M-22 -4 V4 H22 V-4 Z" fill="%2322C55E"/><path d="M-15 -15 L15 15 M-15 15 L15 -15" stroke="%2322C55E" stroke-width="8" stroke-linecap="round"/><circle cx="0" cy="0" r="14" fill="%2322C55E"/><circle cx="0" cy="0" r="7" fill="%23FFFFFF"/></g></svg>`,
  // 6. Gear Wheel + User Circle (ผู้ดูแลระบบ)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 42 4 L 58 4 L 59 14 C 64 16, 68 18, 72 21 L 81 14 L 92 25 L 85 34 C 88 38, 90 42, 92 47 L 102 48 L 102 64 L 92 65 C 90 70, 88 74, 85 78 L 92 87 L 81 98 L 72 91 C 68 94, 64 96, 59 98 L 58 108 L 42 108 L 41 98 C 36 96, 32 94, 28 91 L 19 98 L 8 87 L 15 78 C 12 74, 10 70, 8 65 L -2 64 L -2 48 L 8 47 C 10 42, 12 38, 15 34 L 8 25 L 19 14 L 28 21 C 32 18, 36 16, 41 14 Z" fill="%23475569" transform="scale(0.85) translate(8, 8)"/><circle cx="50" cy="50" r="30" fill="%23DCEFFE"/><circle cx="50" cy="42" r="10" fill="%23FF7A70"/><path d="M28 68 C 28 56, 36 54, 50 54 C 64 54, 72 56, 72 68 Z" fill="%232563EB"/></svg>`,
  // 7. Support Operator with Headset (เจ้าหน้าที่บริการ)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="8" y="4" width="60" height="76" rx="8" fill="%23E2E8F0"/><rect x="14" y="24" width="12" height="12" rx="3" fill="%23FCD34D"/><rect x="30" y="26" width="30" height="4" rx="2" fill="%2394A3B8"/><rect x="30" y="32" width="22" height="4" rx="2" fill="%2394A3B8"/><rect x="14" y="44" width="30" height="4" rx="2" fill="%2394A3B8"/><rect x="14" y="52" width="24" height="4" rx="2" fill="%2394A3B8"/><rect x="14" y="60" width="18" height="4" rx="2" fill="%2394A3B8"/><path d="M38 96 C 42 76, 52 74, 68 74 C 84 74, 94 76, 98 96 Z" fill="%23F59E0B"/><polygon points="68,74 60,82 76,82" fill="%23FFFFFF"/><rect x="62" y="62" width="12" height="14" rx="3" fill="%23FCD3C1"/><path d="M52 42 C 52 30, 84 30, 84 42 V 56 C 84 68, 52 68, 52 56 Z" fill="%23FCD3C1"/><circle cx="50" cy="50" r="3" fill="%23F8B195"/><circle cx="86" cy="50" r="3" fill="%23F8B195"/><path d="M50 42 C 50 26, 86 26, 86 42 C 80 32, 70 30, 50 42 Z" fill="%238D5B4C"/><path d="M46 50 C 46 30, 90 30, 90 50" fill="none" stroke="%237C3AED" stroke-width="4" stroke-linecap="round"/><rect x="42" y="44" width="8" height="12" rx="4" fill="%237C3AED"/><rect x="86" y="44" width="8" height="12" rx="4" fill="%237C3AED"/><path d="M88 52 L 76 68 H 70" fill="none" stroke="%2394A3B8" stroke-width="3" stroke-linecap="round"/><circle cx="68" cy="68" r="3" fill="%23475569"/></svg>`,
  // 8. Female Navy Suit + White Collar (ครูหอพัก/ผู้บริหาร)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M18 92 C 22 62, 34 56, 50 56 C 66 56, 78 62, 82 92 Z" fill="%232D3A60"/><polygon points="50,78 36,56 46,56" fill="%23FFFFFF"/><polygon points="50,78 64,56 54,56" fill="%23FFFFFF"/><polygon points="50,78 46,56 50,64 54,56" fill="%23CBD5E1"/><rect x="43" y="44" width="14" height="16" rx="3" fill="%23FCD3C1"/><path d="M28 28 C 28 14, 72 14, 72 28 V 62 C 72 62, 68 64, 64 56 V 32 C 64 18, 36 18, 36 32 V 56 C 32 64, 28 62, 28 62 Z" fill="%231A202C"/><path d="M33 26 C 33 16, 67 16, 67 26 V 40 C 67 52, 33 52, 33 40 Z" fill="%23FCD3C1"/><circle cx="31" cy="35" r="3.5" fill="%23F8B195"/><circle cx="69" cy="35" r="3.5" fill="%23F8B195"/><path d="M31 26 C 32 14, 68 14, 69 26 C 60 16, 50 32, 31 26 Z" fill="%231A202C"/></svg>`,
  // 9. Male Glasses + Dark Jacket + White Shirt (ครูหอพัก/วิชาการ)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M16 92 C 20 62, 34 56, 50 56 C 66 56, 80 62, 84 92 Z" fill="%232B2D42"/><path d="M42 56 H58 V80 H42 Z" fill="%23F8F9FA"/><rect x="42" y="44" width="16" height="16" rx="3" fill="%23FCD3C1"/><path d="M30 26 C 30 14, 70 14, 70 26 V 40 C 70 54, 30 54, 30 40 Z" fill="%23FCD3C1"/><circle cx="41" cy="34" r="8" fill="none" stroke="%23212529" stroke-width="2.5"/><circle cx="59" cy="34" r="8" fill="none" stroke="%23212529" stroke-width="2.5"/><line x1="49" y1="34" x2="51" y2="34" stroke="%23212529" stroke-width="2.5"/><line x1="30" y1="33" x2="33" y2="33" stroke="%23212529" stroke-width="2.5"/><line x1="67" y1="33" x2="70" y2="33" stroke="%23212529" stroke-width="2.5"/><circle cx="28" cy="36" r="4" fill="%23F8B195"/><circle cx="72" cy="36" r="4" fill="%23F8B195"/><path d="M29 26 C 30 10, 70 10, 71 26 C 66 14, 52 14, 29 26 Z" fill="%231A202C"/></svg>`,
  // 10. Female Glasses + Dark Jacket + Blue Shirt (ครูหอพัก/วิชาการ)
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M18 92 C 22 62, 34 56, 50 56 C 66 56, 78 62, 82 92 Z" fill="%232B2D42"/><polygon points="50,78 36,56 46,56" fill="%236C5CE7"/><polygon points="50,78 64,56 54,56" fill="%236C5CE7"/><rect x="43" y="44" width="14" height="16" rx="3" fill="%23FCD3C1"/><path d="M28 28 C 28 12, 72 12, 72 28 V 58 C 72 58, 68 60, 64 54 V 30 C 64 16, 36 16, 36 30 V 54 C 32 60, 28 58, 28 58 Z" fill="%234A3728"/><path d="M33 26 C 33 16, 67 16, 67 26 V 40 C 67 52, 33 52, 33 40 Z" fill="%23FCD3C1"/><circle cx="42" cy="34" r="7.5" fill="none" stroke="%23212529" stroke-width="2.5"/><circle cx="58" cy="34" r="7.5" fill="none" stroke="%23212529" stroke-width="2.5"/><line x1="49.5" y1="34" x2="50.5" y2="34" stroke="%23212529" stroke-width="2.5"/><circle cx="31" cy="35" r="3.5" fill="%23F8B195"/><circle cx="69" cy="35" r="3.5" fill="%23F8B195"/><path d="M31 26 C 32 14, 68 14, 69 26 C 60 16, 50 28, 31 26 Z" fill="%234A3728"/></svg>`
];

const PRESET_AVATARS_META = [
  { roleName: "ผู้ดูแล/ผู้บริหาร", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
  { roleName: "เจ้าหน้าที่/ครูหอพัก", badgeColor: "bg-pink-100 text-pink-800 border-pink-200" },
  { roleName: "บัตรประจำตัว", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  { roleName: "เจ้าหน้าที่", badgeColor: "bg-orange-100 text-orange-800 border-orange-200" },
  { roleName: "ผู้ดูแลระบบ", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { roleName: "ผู้ดูแลระบบ", badgeColor: "bg-slate-100 text-slate-800 border-slate-200" },
  { roleName: "เจ้าหน้าที่บริการ", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  { roleName: "ครูหอพัก/ผู้บริหาร", badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { roleName: "ครูหอพัก/วิชาการ", badgeColor: "bg-sky-100 text-sky-800 border-sky-200" },
  { roleName: "ครูหอพัก/วิชาการ", badgeColor: "bg-teal-100 text-teal-800 border-teal-200" }
];

const SYSTEM_LOGOS = [
  {
    name: "ตราหอพัก 1 (ม่วง-ทอง)",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23A05AFF"/><stop offset="100%" stop-color="%236B21A8"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="url(%23g1)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 18 L75 32 V56 C75 72 50 84 50 84 C50 84 25 72 25 56 V32 Z" fill="none" stroke="url(%23gold)" stroke-width="3"/><path d="M50 25 L68 36 V54 C68 66 50 76 50 76 C50 76 32 66 32 54 V36 Z" fill="url(%23gold)" opacity="0.25"/><polygon points="50,34 54,44 64,44 56,51 59,61 50,55 41,61 44,51 36,44 46,44" fill="url(%23gold)"/></svg>`
  },
  {
    name: "ตราหอพัก 2 (น้ำเงิน-ทอง)",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232563EB"/><stop offset="100%" stop-color="%231E3A8A"/></linearGradient><linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FACC15"/><stop offset="100%" stop-color="%23EAB308"/></linearGradient></defs><rect x="6" y="6" width="88" height="88" rx="22" fill="url(%23g2)" stroke="url(%23gold2)" stroke-width="3"/><circle cx="50" cy="45" r="22" fill="none" stroke="url(%23gold2)" stroke-width="2.5"/><path d="M38 58 C38 58 44 52 50 52 C56 52 62 58 62 58 L60 66 C60 66 54 62 50 62 C46 62 40 66 40 66 Z" fill="url(%23gold2)"/><polygon points="50,28 53,35 60,35 55,39 57,46 50,42 43,46 45,39 40,35 47,35" fill="url(%23gold2)"/></svg>`
  },
  {
    name: "ตราหอพัก 3 (เขียว-ทอง)",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%23064E3B"/></linearGradient><linearGradient id="gold3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FDE047"/><stop offset="100%" stop-color="%23D97706"/></linearGradient></defs><circle cx="50" cy="50" r="44" fill="url(%23g3)" stroke="url(%23gold3)" stroke-width="3"/><path d="M50 20 L80 34 L50 48 L20 34 Z" fill="url(%23gold3)"/><rect x="34" y="44" width="32" height="14" rx="3" fill="none" stroke="url(%23gold3)" stroke-width="2"/><path d="M28 68 C35 78 65 78 72 68" fill="none" stroke="url(%23gold3)" stroke-width="3" stroke-linecap="round"/></svg>`
  },
  {
    name: "ตราหอพัก 4 (แสด-ทอง)",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23EA580C"/><stop offset="100%" stop-color="%239A3412"/></linearGradient><linearGradient id="gold4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FEF08A"/><stop offset="100%" stop-color="%23CA8A04"/></linearGradient></defs><polygon points="50,6 90,30 90,70 50,94 10,70 10,30" fill="url(%23g4)" stroke="url(%23gold4)" stroke-width="3"/><path d="M35 55 L50 35 L65 55 L50 50 Z" fill="url(%23gold4)"/><circle cx="50" cy="62" r="5" fill="url(%23gold4)"/></svg>`
  }
];

export const UserAndDatabaseView: React.FC<UserAndDatabaseViewProps> = ({
  currentUser,
  dorms,
  systemSettings = DEFAULT_SYSTEM_SETTINGS,
  onUpdateSystemSettings,
  onDataReset,
  onUserUpdated
}) => {
  const isAdmin = currentUser?.roleLevel === 1;
  const isStaff = currentUser?.roleLevel === 2;
  const canAccessSettings = isAdmin || isStaff;

  const [activeTab, setActiveTab] = useState<"SYSTEM_SETTINGS" | "MANAGE_USERS" | "CHANGE_PASSWORD" | "CHANGE_PROFILE" | "DATABASE">(
    canAccessSettings ? "SYSTEM_SETTINGS" : "CHANGE_PASSWORD"
  );

  useEffect(() => {
    if (!canAccessSettings && (activeTab === "SYSTEM_SETTINGS" || activeTab === "MANAGE_USERS" || activeTab === "DATABASE")) {
      setActiveTab("CHANGE_PASSWORD");
    }
  }, [canAccessSettings, activeTab]);

  // System Settings Form State
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(systemSettings);

  // Clear Attendance State & Handlers
  const [clearDate, setClearDate] = useState<string>(getTodayDateString());
  const [clearDormIdForDate, setClearDormIdForDate] = useState<string>("ALL");
  const [clearDormIdForAll, setClearDormIdForAll] = useState<string>("ALL");
  const [isClearingAttendance, setIsClearingAttendance] = useState<boolean>(false);

  // ATTENDANCE & NOTICES DATABASE MANAGEMENT SUITE (1. สำรอง 2. กู้คืน 3. ล้างประวัติ)
  const [attendanceDbSubTab, setAttendanceDbSubTab] = useState<"BACKUP" | "RESTORE" | "CLEAR">("BACKUP");

  // 1. สำรองข้อมูลการเช็คยอด + เรื่องอบรม
  const [attBackupMode, setAttBackupMode] = useState<"DATE" | "MONTH" | "RANGE" | "ALL">("ALL");
  const [attBackupDate, setAttBackupDate] = useState<string>(getTodayDateString());
  const [attBackupMonth, setAttBackupMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attBackupStartDate, setAttBackupStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attBackupEndDate, setAttBackupEndDate] = useState<string>(getTodayDateString());
  const [attBackupDormId, setAttBackupDormId] = useState<string>("ALL");
  const [attBackupIncludeNotices, setAttBackupIncludeNotices] = useState<boolean>(true);
  const [isExportingAttendance, setIsExportingAttendance] = useState<boolean>(false);

  // 2. กู้คืนข้อมูลการเช็คยอด + เรื่องอบรม
  const [attRestoreFile, setAttRestoreFile] = useState<File | null>(null);
  const [attRestoreParsedData, setAttRestoreParsedData] = useState<any | null>(null);
  const [attRestoreAnalysis, setAttRestoreAnalysis] = useState<{
    totalAttendance: number;
    totalNotices: number;
    dates: string[];
    minDate: string;
    maxDate: string;
    dorms: string[];
    exportedAt?: string;
    backupType?: string;
  } | null>(null);
  const [attRestoreMode, setAttRestoreMode] = useState<"ALL" | "DATE" | "MONTH" | "RANGE">("ALL");
  const [attRestoreDate, setAttRestoreDate] = useState<string>(getTodayDateString());
  const [attRestoreMonth, setAttRestoreMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attRestoreStartDate, setAttRestoreStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attRestoreEndDate, setAttRestoreEndDate] = useState<string>(getTodayDateString());
  const [attRestoreDormId, setAttRestoreDormId] = useState<string>("ALL");
  const [attRestoreStrategy, setAttRestoreStrategy] = useState<"UPSERT" | "REPLACE">("UPSERT");
  const [isRestoringAttendance, setIsRestoringAttendance] = useState<boolean>(false);

  // 3. ล้างประวัติการเช็คยอด + เรื่องอบรม (เลือกตามวันที่, เดือน, ช่วงเวลา, ทั้งหมด)
  const [attClearMode, setAttClearMode] = useState<"BY_DATE" | "BY_MONTH" | "BY_RANGE" | "ALL">("BY_DATE");
  const [attClearDate, setAttClearDate] = useState<string>(getTodayDateString());
  const [attClearMonth, setAttClearMonth] = useState<string>(getTodayDateString().slice(0, 7));
  const [attClearStartDate, setAttClearStartDate] = useState<string>(`${getTodayDateString().slice(0, 7)}-01`);
  const [attClearEndDate, setAttClearEndDate] = useState<string>(getTodayDateString());
  const [attClearDormId, setAttClearDormId] = useState<string>("ALL");
  const [attClearIncludeNotices, setAttClearIncludeNotices] = useState<boolean>(true);

  const handleClearAttendanceByDate = () => {
    if (!clearDate) {
      showNotification("error", "กรุณาระบุวันที่ที่ต้องการล้างข้อมูล");
      return;
    }
    triggerDbActionWithAuth("CLEAR_ATTENDANCE_DATE");
  };

  const handleClearAttendanceAll = () => {
    triggerDbActionWithAuth("CLEAR_ATTENDANCE_ALL");
  };

  const handleAttendanceRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const rawAttendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
        const rawNotices = Array.isArray(parsed.notices) ? parsed.notices : [];

        if (rawAttendance.length === 0 && rawNotices.length === 0) {
          showNotification("error", "ไฟล์นี้ไม่มีข้อมูลการเช็คยอด หรือเรื่องแจ้งอบรม");
          setAttRestoreParsedData(null);
          setAttRestoreAnalysis(null);
          return;
        }

        const dateSet = new Set<string>();
        const dormSet = new Set<string>();
        rawAttendance.forEach((item: any) => {
          if (item.date) dateSet.add(item.date);
          if (item.dormId) dormSet.add(item.dormId);
        });
        rawNotices.forEach((item: any) => {
          if (item.date) dateSet.add(item.date);
        });

        const sortedDates = Array.from(dateSet).sort();
        const minDate = sortedDates[0] || "";
        const maxDate = sortedDates[sortedDates.length - 1] || "";

        setAttRestoreParsedData(parsed);
        setAttRestoreAnalysis({
          totalAttendance: rawAttendance.length,
          totalNotices: rawNotices.length,
          dates: sortedDates,
          minDate,
          maxDate,
          dorms: Array.from(dormSet),
          exportedAt: parsed.exportedAt,
          backupType: parsed.backupType || "FULL_OR_CUSTOM"
        });

        if (sortedDates.length > 0) {
          setAttRestoreDate(sortedDates[sortedDates.length - 1]);
          setAttRestoreMonth(sortedDates[sortedDates.length - 1].slice(0, 7));
          setAttRestoreStartDate(sortedDates[0]);
          setAttRestoreEndDate(sortedDates[sortedDates.length - 1]);
        }

        showNotification(
          "success",
          `อ่านไฟล์สำเร็จ: พบประวัติเช็คยอด ${rawAttendance.length} รายการ, เรื่องแจ้งอบรม ${rawNotices.length} รายการ`
        );
      } catch (err: any) {
        showNotification("error", "ไฟล์ไม่ถูกต้องตามรูปแบบ JSON หรือข้อมูลเสียหาย");
        setAttRestoreParsedData(null);
        setAttRestoreAnalysis(null);
      }
    };
    reader.readAsText(file);
  };

  const executeExportAttendance = async () => {
    setIsExportingAttendance(true);
    try {
      const data = await exportAttendanceAndNoticesDatabase({
        mode: attBackupMode,
        date: attBackupDate,
        month: attBackupMonth,
        startDate: attBackupStartDate,
        endDate: attBackupEndDate,
        dormId: attBackupDormId,
        includeNotices: attBackupIncludeNotices
      });

      const dateSuffix =
        attBackupMode === "DATE"
          ? attBackupDate
          : attBackupMode === "MONTH"
          ? attBackupMonth
          : attBackupMode === "RANGE"
          ? `${attBackupStartDate}_to_${attBackupEndDate}`
          : "ALL";
      const dormSuffix = attBackupDormId === "ALL" ? "AllDorms" : `Dorm_${attBackupDormId}`;
      const fileName = `attendance_backup_${dateSuffix}_${dormSuffix}_${new Date().getTime()}.json`;

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification(
        "success",
        `สำรองข้อมูลสำเร็จ: เช็คยอด ${data.totalAttendance} รายการ, เรื่องแจ้งอบรม ${data.totalNotices} รายการ`
      );
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการสำรองข้อมูล");
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const executeRestoreAttendance = async () => {
    if (!attRestoreParsedData) {
      showNotification("error", "กรุณาเลือกไฟล์สำรองข้อมูลก่อน");
      return;
    }

    setIsRestoringAttendance(true);
    try {
      const res = await restoreAttendanceAndNoticesDatabase({
        data: attRestoreParsedData,
        mode: attRestoreMode,
        date: attRestoreDate,
        month: attRestoreMonth,
        startDate: attRestoreStartDate,
        endDate: attRestoreEndDate,
        dormId: attRestoreDormId,
        restoreStrategy: attRestoreStrategy
      });

      showNotification("success", (res as any).message || "กู้คืนข้อมูลการเช็คยอดสำเร็จเรียบร้อยแล้ว");
      if (onDataReset) onDataReset();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการกู้คืนข้อมูล");
    } finally {
      setIsRestoringAttendance(false);
    }
  };

  const executeClearAttendanceGranular = async () => {
    setIsClearingAttendance(true);
    try {
      const res = await clearAttendanceDatabase({
        mode: attClearMode,
        date: attClearDate,
        month: attClearMonth,
        startDate: attClearStartDate,
        endDate: attClearEndDate,
        dormId: attClearDormId,
        clearNotices: attClearIncludeNotices
      });

      showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดสำเร็จเรียบร้อยแล้ว");
      if (onDataReset) onDataReset();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
    } finally {
      setIsClearingAttendance(false);
    }
  };

  useEffect(() => {
    setSettingsForm(systemSettings);
  }, [systemSettings]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Change Form State
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>(currentUser?.id || "");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser?.avatarUrl || PRESET_AVATARS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>("");

  // Manage Users Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // User Form Data
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    roleLevel: 2, // 1 = Admin, 2 = Staff, 3 = Teacher
    roleCategory: "STAFF" as "ADMIN" | "STAFF" | "DORM_TEACHER",
    dormId: "",
    dormPosition: "ครูประจำหอพัก" as DormPosition,
    allowedDormIds: [] as string[],
    avatarUrl: PRESET_AVATARS[0],
    password: "123456"
  });


  // Google Drive Upload State
  const [isUploadingDrive, setIsUploadingDrive] = useState<boolean>(false);

  // Local File Selection State for Auto Google Drive Upload on Save
  const [profileSelectedFile, setProfileSelectedFile] = useState<File | null>(null);
  const [profileFilePreview, setProfileFilePreview] = useState<string | null>(null);

  const [modalSelectedFile, setModalSelectedFile] = useState<File | null>(null);
  const [modalFilePreview, setModalFilePreview] = useState<string | null>(null);

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: "PROFILE" | "MODAL") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showNotification("error", "ไฟล์รูปภาพมีขนาดใหญ่เกิน 20 MB โปรดเลือกไฟล์ขนาดเล็กกว่า");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (target === "PROFILE") {
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileSelectedFile(file);
      setProfileFilePreview(previewUrl);
      setSelectedAvatar(previewUrl);
      setCustomAvatarUrl("");
      showNotification("success", `เลือกรูปภาพ "${file.name}" สำเร็จ! กด 'บันทึกรูปโปรไฟล์' เพื่อบันทึกลงระบบทันที`);
    } else {
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalSelectedFile(file);
      setModalFilePreview(previewUrl);
      setFormData((prev) => ({ ...prev, avatarUrl: previewUrl }));
      showNotification("success", `เลือกรูปภาพ "${file.name}" สำเร็จ! กด 'บันทึก' เพื่อบันทึกข้อมูล`);
    }
  };

  const clearSelectedFile = (target: "PROFILE" | "MODAL") => {
    if (target === "PROFILE") {
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileSelectedFile(null);
      setProfileFilePreview(null);
      setSelectedAvatar(PRESET_AVATARS[0]);
    } else {
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalSelectedFile(null);
      setModalFilePreview(null);
      setFormData((prev) => ({ ...prev, avatarUrl: PRESET_AVATARS[0] }));
    }
  };

  // Handle direct file upload to Google Drive for avatar (optional feature with graceful fallback)
  const handleFileUploadToGoogleDrive = async (e: React.ChangeEvent<HTMLInputElement>, target: "PROFILE" | "MODAL") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showNotification("error", "ไฟล์รูปภาพมีขนาดใหญ่เกิน 20 MB โปรดเลือกไฟล์ขนาดเล็กกว่า");
      return;
    }

    setIsUploadingDrive(true);
    try {
      showNotification("success", "กำลังเชื่อมต่อ Google Drive และเริ่มอัปโหลดไฟล์...");
      const driveResult = await uploadImageToGoogleDrive(
        file,
        `avatar_${Date.now()}_${file.name}`,
        "1K7PFEk9ylOYLBtMHFijwPkzB3Xl13UfQ"
      );

      if (driveResult && driveResult.directUrl) {
        if (target === "PROFILE") {
          setProfileSelectedFile(null);
          if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
          setProfileFilePreview(null);
          setCustomAvatarUrl(driveResult.directUrl);
          setSelectedAvatar(driveResult.directUrl);
        } else {
          setModalSelectedFile(null);
          if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
          setModalFilePreview(null);
          setFormData((prev) => ({ ...prev, avatarUrl: driveResult.directUrl }));
        }
        showNotification("success", "อัปโหลดรูปภาพไปยัง Google Drive สำเร็จ! ตั้งค่ารูปโปรไฟล์เรียบร้อยแล้ว");
      }
    } catch (err: any) {
      console.warn("Google Drive Upload Notice:", err);
      // Fallback: Compress locally and set as avatar directly to prevent blocking user
      const compressedDataUrl = await compressImageFile(file, 250, 250, 0.85);
      if (compressedDataUrl) {
        if (target === "PROFILE") {
          setProfileSelectedFile(file);
          setSelectedAvatar(compressedDataUrl);
          setCustomAvatarUrl("");
        } else {
          setModalSelectedFile(file);
          setFormData((prev) => ({ ...prev, avatarUrl: compressedDataUrl }));
        }
        showNotification(
          "success",
          "บันทึกรูปโปรไฟล์ลงในระบบฐานข้อมูล Firebase เรียบร้อยแล้ว (ไม่ต้องเชื่อมต่อ Google Drive)"
        );
      } else {
        showNotification("error", "ไม่สามารถประมวลผลรูปภาพได้: " + (err.message || err));
      }
    } finally {
      setIsUploadingDrive(false);
      e.target.value = "";
    }
  };

  // Password confirmation for DB & Attendance clearance actions
  const [dbAuthModalOpen, setDbAuthModalOpen] = useState<boolean>(false);
  const [dbAuthAction, setDbAuthAction] = useState<
    | "EXPORT"
    | "IMPORT"
    | "CLEAR"
    | "CLEAR_ATTENDANCE_DATE"
    | "CLEAR_ATTENDANCE_ALL"
    | "CLEAR_ATTENDANCE_GRANULAR"
    | "RESTORE_ATTENDANCE_NOTICES"
    | "CLEAR_STUDENTS_DORM"
    | "CLEAR_STUDENTS_ALL"
    | "DELETE_USER"
    | null
  >(null);

  const [targetUserToDelete, setTargetUserToDelete] = useState<UserProfile | null>(null);
  const [clearStudentsDormId, setClearStudentsDormId] = useState<string>("dorm-1");
  const [isClearingStudents, setIsClearingStudents] = useState<boolean>(false);
  const [pendingImportJson, setPendingImportJson] = useState<any>(null);
  const [adminAuthPassword, setAdminAuthPassword] = useState<string>("");
  const [adminAuthError, setAdminAuthError] = useState<string>("");

  // Firebase project setup & seed states
  const [isInitializingDefaultDb, setIsInitializingDefaultDb] = useState<boolean>(false);
  const [isFirebaseConfigModalOpen, setIsFirebaseConfigModalOpen] = useState<boolean>(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState<boolean>(false);
  const [copiedConfigField, setCopiedConfigField] = useState<string | null>(null);

  const handleInitializeDefaultDb = async () => {
    setIsInitializingDefaultDb(true);
    try {
      const res = await syncLiveFirebaseDatabase();
      showNotification(res.success ? "success" : "error", res.message || "ซิงค์ข้อมูลจาก Firebase สำเร็จ");
      if (onDataReset) onDataReset();
      loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการซิงค์ข้อมูลจาก Firebase");
    } finally {
      setIsInitializingDefaultDb(false);
    }
  };

  // Load users list
  const loadUsersList = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Helper to determine the primary dorm numeric index for a user
  const getUserDormIndex = (u: UserProfile, dormsList: Dormitory[]): number => {
    if (u.roleLevel === 1 || u.roleLevel === 2) return 0;

    const dormIdsToCheck: string[] = [];
    if (u.dormId) dormIdsToCheck.push(u.dormId);
    if (u.allowedDormIds) {
      u.allowedDormIds.forEach((id) => {
        if (!dormIdsToCheck.includes(id)) dormIdsToCheck.push(id);
      });
    }

    if (dormIdsToCheck.length === 0) return 99;

    let minIndex = 99;
    for (const id of dormIdsToCheck) {
      const idx = dormsList.findIndex((d) => d.id === id);
      if (idx !== -1) {
        if (idx + 1 < minIndex) minIndex = idx + 1;
      } else {
        const match = id.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (val < minIndex) minIndex = val;
        }
      }
    }

    return minIndex;
  };

  // Sort users by roleLevel ascending (1 -> 2 -> 3), then by dorm scope (หอพัก 1 -> 6), then by name
  const sortedUsers = React.useMemo(() => {
    return [...users].sort((a, b) => {
      // 1. Primary: Role Level (1 -> 2 -> 3)
      if (a.roleLevel !== b.roleLevel) {
        return a.roleLevel - b.roleLevel;
      }

      // 2. Secondary: Dormitory scope (หอพัก 1 -> หอพัก 6)
      const dormIdxA = getUserDormIndex(a, dorms);
      const dormIdxB = getUserDormIndex(b, dorms);
      if (dormIdxA !== dormIdxB) {
        return dormIdxA - dormIdxB;
      }

      // 3. Tertiary: User name
      return a.name.localeCompare(b.name, "th");
    });
  }, [users, dorms]);

  useEffect(() => {
    loadUsersList();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setSelectedTargetUserId(currentUser.id);
      setSelectedAvatar(currentUser.avatarUrl || PRESET_AVATARS[0]);
    }
  }, [currentUser]);

  const showNotification = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Trigger Password Auth Modal before any DB or clearance action
  const triggerDbActionWithAuth = (
    action:
      | "EXPORT"
      | "IMPORT"
      | "CLEAR"
      | "CLEAR_ATTENDANCE_DATE"
      | "CLEAR_ATTENDANCE_ALL"
      | "CLEAR_ATTENDANCE_GRANULAR"
      | "RESTORE_ATTENDANCE_NOTICES"
      | "CLEAR_STUDENTS_DORM"
      | "CLEAR_STUDENTS_ALL"
      | "DELETE_USER",
    extraData?: any
  ) => {
    setDbAuthAction(action);
    if (action === "IMPORT" && extraData) {
      setPendingImportJson(extraData);
    }
    setAdminAuthPassword("");
    setAdminAuthError("");
    setDbAuthModalOpen(true);
  };

  const handleVerifyAdminPassAndExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthPassword.trim()) {
      setAdminAuthError("กรุณากรอกรหัสผ่านเจ้าหน้าที่ หรือ ผู้ดูแลระบบ");
      return;
    }

    // Check against Level 1 (Admin) or Level 2 (Staff) users, or current user, or default 123456
    const authorizedUsers = users.filter((u) => u.roleLevel === 1 || u.roleLevel === 2);
    const isPasswordCorrect =
      (currentUser?.password && adminAuthPassword === currentUser.password) ||
      authorizedUsers.some((u) => u.password === adminAuthPassword) ||
      adminAuthPassword === "123456";

    if (!isPasswordCorrect) {
      setAdminAuthError("รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      return;
    }

    // Password is valid
    setDbAuthModalOpen(false);
    setAdminAuthError("");

    if (dbAuthAction === "EXPORT") {
      await executeExportDb();
    } else if (dbAuthAction === "IMPORT" && pendingImportJson) {
      await executeImportDb(pendingImportJson);
      setPendingImportJson(null);
    } else if (dbAuthAction === "CLEAR") {
      try {
        await clearDatabase();
        showNotification("success", "ล้างฐานข้อมูลทั้งหมดสำเร็จเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message);
      }
    } else if (dbAuthAction === "RESTORE_ATTENDANCE_NOTICES") {
      await executeRestoreAttendance();
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_GRANULAR") {
      await executeClearAttendanceGranular();
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_DATE") {
      setIsClearingAttendance(true);
      try {
        const res = await clearAttendanceDatabase({
          mode: "BY_DATE",
          date: clearDate,
          dormId: clearDormIdForDate
        });
        showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดประจำวันที่เลือกเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
      } finally {
        setIsClearingAttendance(false);
      }
    } else if (dbAuthAction === "CLEAR_ATTENDANCE_ALL") {
      setIsClearingAttendance(true);
      try {
        const res = await clearAttendanceDatabase({
          mode: "ALL",
          dormId: clearDormIdForAll
        });
        showNotification("success", (res as any).message || "ล้างข้อมูลเช็คยอดทั้งหมดเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล");
      } finally {
        setIsClearingAttendance(false);
      }
    } else if (dbAuthAction === "CLEAR_STUDENTS_DORM") {
      setIsClearingStudents(true);
      try {
        const res = await clearStudentsDatabase({
          mode: "BY_DORM",
          dormId: clearStudentsDormId
        });
        showNotification("success", (res as any).message || "ลบรายชื่อนักเรียนในหอพักเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบรายชื่อนักเรียน");
      } finally {
        setIsClearingStudents(false);
      }
    } else if (dbAuthAction === "CLEAR_STUDENTS_ALL") {
      setIsClearingStudents(true);
      try {
        const res = await clearStudentsDatabase({
          mode: "ALL"
        });
        showNotification("success", (res as any).message || "ลบรายชื่อนักเรียนทุกหอพักเรียบร้อยแล้ว");
        if (onDataReset) onDataReset();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบรายชื่อนักเรียน");
      } finally {
        setIsClearingStudents(false);
      }
    } else if (dbAuthAction === "DELETE_USER" && targetUserToDelete) {
      try {
        await deleteUser(targetUserToDelete.id);
        showNotification("success", `ลบบัญชีผู้ใช้ ${targetUserToDelete.name} เรียบร้อยแล้ว`);
        setTargetUserToDelete(null);
        loadUsersList();
      } catch (err: any) {
        showNotification("error", err.message || "เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้");
      }
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length === 0) {
      showNotification("error", "กรุณาระบุรหัสผ่านใหม่");
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification("error", "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
    if (!targetUser) return;

    try {
      await changeUserPassword(targetUser.id, {
        oldPassword,
        newPassword,
        isAdminOverride: isAdmin
      });

      showNotification("success", `เปลี่ยนรหัสผ่านสำหรับ ${targetUser.name} สำเร็จแล้ว!`);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    }
  };

  // Profile Avatar Change Handler
  const handleSaveProfileAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find((u) => u.id === selectedTargetUserId) || currentUser;
    if (!targetUser) return;

    try {
      let updatedAvatar = customAvatarUrl.trim() || selectedAvatar;

      // When a local file is selected, compress it directly into a clean, compact Data URL (no auth/unauthorized-domain error)
      if (profileSelectedFile) {
        showNotification("success", "กำลังประมวลผลรูปภาพโปรไฟล์...");
        const compressed = await compressImageFile(profileSelectedFile, 250, 250, 0.85);
        if (compressed) {
          updatedAvatar = compressed;
        }
      } else {
        updatedAvatar = await compressDataUrlIfNeeded(getDirectImageUrl(updatedAvatar), 250, 250, 0.85);
      }

      await updateUser(targetUser.id, { avatarUrl: updatedAvatar });
      if (currentUser && targetUser.id === currentUser.id && onUserUpdated) {
        onUserUpdated({ ...currentUser, avatarUrl: updatedAvatar });
      }

      showNotification("success", `บันทึกและอัปเดตรูปโปรไฟล์สำหรับ ${targetUser.name} สำเร็จแล้ว!`);
      setCustomAvatarUrl("");
      setProfileSelectedFile(null);
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview);
      setProfileFilePreview(null);
      loadUsersList();
    } catch (err: any) {
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการอัปเดตรูปโปรไฟล์");
    } finally {
      setIsUploadingDrive(false);
    }
  };

  // Add / Edit User Handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification("error", "กรุณาระบุชื่อ-นามสกุล");
      return;
    }

    if (!isAdmin && isStaff && (Number(formData.roleLevel) === 1 || Number(formData.roleLevel) === 2)) {
      showNotification("error", "สิทธิ์เจ้าหน้าที่สามารถเพิ่มหรือแก้ไขได้เฉพาะสิทธิ์ครูหอพัก (ระดับ 3) เท่านั้น");
      return;
    }

    let roleCategoryName = "ครูหอพัก";
    let roleLabel = formData.dormPosition || "ครูประจำหอพัก";
    let role: UserRole = formData.dormPosition === "ครูประธานหอพัก" ? "HEAD_TEACHER" : "DORM_TEACHER";

    const level = Number(formData.roleLevel);
    if (level === 1) {
      roleCategoryName = "ผู้ดูแล";
      roleLabel = "ผู้ดูแลระบบ";
      role = "SYSTEM_ADMIN";
    } else if (level === 2) {
      roleCategoryName = "เจ้าหน้าที่";
      roleLabel = "เจ้าหน้าที่ส่วนกลาง";
      role = "ADMIN_OFFICER";
    }

    let processedAvatarUrl = getDirectImageUrl(formData.avatarUrl || PRESET_AVATARS[0]);

    // Compress local file directly if selected in modal
    if (modalSelectedFile) {
      const compressed = await compressImageFile(modalSelectedFile, 250, 250, 0.85);
      if (compressed) {
        processedAvatarUrl = compressed;
      }
    } else {
      processedAvatarUrl = await compressDataUrlIfNeeded(processedAvatarUrl, 250, 250, 0.85);
    }

    try {
      if (editingUser) {
        const payload: Partial<UserProfile> = {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          roleLevel: level as any,
          roleCategory: formData.roleCategory,
          roleCategoryName,
          roleLabel,
          role,
          dormId: formData.dormId || "",
          dormPosition: formData.dormPosition,
          allowedDormIds: formData.allowedDormIds,
          avatarUrl: processedAvatarUrl,
          ...(formData.password ? { password: formData.password } : {})
        };

        const updated = await updateUser(editingUser.id, payload);
        showNotification("success", `อัปเดตข้อมูลผู้ใช้ ${formData.name} สำเร็จแล้ว`);

        if (currentUser && currentUser.id === editingUser.id && onUserUpdated) {
          onUserUpdated({ ...currentUser, ...updated });
        }
      } else {
        const newUser = await addUser({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          roleLevel: level as any,
          roleCategory: formData.roleCategory,
          roleCategoryName,
          roleLabel,
          role,
          dormId: formData.dormId || "",
          dormPosition: formData.dormPosition,
          allowedDormIds: formData.allowedDormIds,
          avatarUrl: processedAvatarUrl,
          password: formData.password || "123456"
        });
        showNotification("success", `เพิ่มผู้ใช้งานใหม่ ${formData.name} สำเร็จแล้ว`);
      }

      setIsAddUserModalOpen(false);
      setEditingUser(null);
      setModalSelectedFile(null);
      if (modalFilePreview) URL.revokeObjectURL(modalFilePreview);
      setModalFilePreview(null);
      await loadUsersList();
    } catch (err: any) {
      console.error("Error saving user:", err);
      showNotification("error", err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้");
    }
  };

  const handleDeleteUserClick = (user: UserProfile) => {
    // 1. Cannot delete current logged-in user
    if (currentUser && user.id === currentUser.id) {
      showNotification("error", "ผู้ที่เข้าสู่ระบบไม่สามารถลบบัญชีของตนเองได้");
      return;
    }

    // 2. Cannot delete last Level 1 Admin
    const level1AdminsCount = users.filter((u) => u.roleLevel === 1).length;
    if (user.roleLevel === 1 && level1AdminsCount <= 1) {
      showNotification("error", "ไม่สามารถลบผู้ดูแลระดับ 1 ได้ เนื่องจากต้องมีผู้ดูแลระดับ 1 อย่างน้อย 1 คนในระบบ");
      return;
    }

    // 3. Staff (Level 2) cannot delete Admin (Level 1) or Staff (Level 2) users
    if (isStaff && (user.roleLevel === 1 || user.roleLevel === 2)) {
      showNotification("error", "สิทธิ์เจ้าหน้าที่ไม่สามารถลบบัญชีผู้ดูแลหรือเจ้าหน้าที่ได้");
      return;
    }

    // 3. Confirm deletion via admin password auth modal
    setTargetUserToDelete(user);
    triggerDbActionWithAuth("DELETE_USER");
  };

  // Database Handlers
  const executeExportDb = async () => {
    try {
      const data = await exportDatabase();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pccc_dorm_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      showNotification("success", "ส่งออกไฟล์สำรองข้อมูล (JSON) สำเร็จแล้ว");
    } catch (err: any) {
      showNotification("error", "เกิดข้อผิดพลาดในการส่งออกข้อมูล: " + err.message);
    }
  };

  const handleExportDb = () => {
    triggerDbActionWithAuth("EXPORT");
  };

  const executeImportDb = async (json: any) => {
    try {
      await restoreDatabase(json);
      showNotification("success", "นำเข้าและกู้คืนฐานข้อมูลสำเร็จแล้ว!");
      if (onDataReset) onDataReset();
      loadUsersList();
    } catch (err: any) {
      showNotification("error", "ไฟล์ไม่ถูกต้องหรือเกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        triggerDbActionWithAuth("IMPORT", json);
      } catch (err: any) {
        showNotification("error", "ไฟล์ JSON ไม่ถูกต้อง: " + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = "";
  };

  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.schoolNameTh.trim() || !settingsForm.systemNameTh.trim()) {
      showNotification("error", "กรุณาระบุชื่อโรงเรียนและชื่อระบบ (ภาษาไทย)");
      return;
    }
    if (onUpdateSystemSettings) {
      onUpdateSystemSettings(settingsForm);
    }
    showNotification("success", "บันทึกการตั้งค่าระบบสำเร็จแล้ว ข้อมูลทั้งหมดถูกอัปเดตเรียบร้อย");
  };

  const handleSetTodayUpdateDate = () => {
    const todayFormatted = formatThaiFullDate(new Date().toISOString().split("T")[0]);
    setSettingsForm((prev) => ({
      ...prev,
      lastUpdatedDate: todayFormatted
    }));
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Row 1: Title & Role Info */}
        <div className="p-6 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A05AFF] to-[#1BCFB4] text-white flex items-center justify-center shadow-md shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                ตั้งค่าระบบ บัญชีผู้ใช้ สิทธิ์ และฐานข้อมูล
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                ระดับสิทธิ์ปัจจุบัน: <strong className="text-[#A05AFF] font-bold">{currentUser?.roleCategoryName || "ผู้เยี่ยมชม"}</strong> (ระดับ {currentUser?.roleLevel || "Guest"})
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Mobile Dropdown Selector (< md screens) */}
        <div className="md:hidden px-4 py-3 bg-slate-50 border-t border-gray-200">
          <label htmlFor="settings-tab-select" className="sr-only">เลือกแท็ประบบ</label>
          <div className="relative">
            <select
              id="settings-tab-select"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-10 text-xs font-bold text-gray-800 shadow-xs focus:ring-2 focus:ring-[#A05AFF] focus:border-[#A05AFF] appearance-none cursor-pointer"
            >
              {(isAdmin || isStaff) && <option value="SYSTEM_SETTINGS">1. การตั้งค่าระบบ (System Configuration)</option>}
              {(isAdmin || isStaff) && <option value="MANAGE_USERS">2. จัดการเจ้าหน้าที่ & ผู้ใช้</option>}
              <option value="CHANGE_PASSWORD">{isAdmin || isStaff ? "3. เปลี่ยนรหัสผ่าน" : "1. เปลี่ยนรหัสผ่าน"}</option>
              <option value="CHANGE_PROFILE">{isAdmin || isStaff ? "4. เปลี่ยนรูปโปรไฟล์" : "2. เปลี่ยนรูปโปรไฟล์"}</option>
              {(isAdmin || isStaff) && <option value="DATABASE">5. จัดการฐานข้อมูล</option>}
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A05AFF]">
              {activeTab === "SYSTEM_SETTINGS" && <Settings className="w-4 h-4" />}
              {activeTab === "MANAGE_USERS" && <UserCheck className="w-4 h-4" />}
              {activeTab === "CHANGE_PASSWORD" && <Key className="w-4 h-4" />}
              {activeTab === "CHANGE_PROFILE" && <ImageIcon className="w-4 h-4" />}
              {activeTab === "DATABASE" && <Database className="w-4 h-4" />}
            </div>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Row 2: Tablet & Desktop Tab Bar Navigation (>= md screens) */}
        <div className="hidden md:flex bg-slate-50/80 px-4 lg:px-6 border-t border-gray-200 overflow-x-auto scrollbar-none gap-1 lg:gap-2 pt-2">
          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("SYSTEM_SETTINGS")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "SYSTEM_SETTINGS"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>
                <span className="hidden xl:inline">1. การตั้งค่าระบบ (System Configuration)</span>
                <span className="xl:hidden">1. การตั้งค่าระบบ</span>
              </span>
            </button>
          )}

          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("MANAGE_USERS")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "MANAGE_USERS"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>2. จัดการเจ้าหน้าที่ & ผู้ใช้</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("CHANGE_PASSWORD")}
            className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "CHANGE_PASSWORD"
                ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
            }`}
          >
            <Key className="w-4 h-4 shrink-0" />
            <span>{isAdmin || isStaff ? "3. เปลี่ยนรหัสผ่าน" : "1. เปลี่ยนรหัสผ่าน"}</span>
          </button>

          <button
            onClick={() => setActiveTab("CHANGE_PROFILE")}
            className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "CHANGE_PROFILE"
                ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span>{isAdmin || isStaff ? "4. เปลี่ยนรูปโปรไฟล์" : "2. เปลี่ยนรูปโปรไฟล์"}</span>
          </button>

          {(isAdmin || isStaff) && (
            <button
              onClick={() => setActiveTab("DATABASE")}
              className={`px-3 lg:px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "DATABASE"
                  ? "border-[#A05AFF] text-[#A05AFF] bg-white rounded-t-xl shadow-xs"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-t-xl"
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>5. จัดการฐานข้อมูล</span>
            </button>
          )}
        </div>

        {/* Main Tab Content Area Inside Frame */}
        <div className="p-6 border-t border-gray-100">
        {/* Global Notification Banner */}
        {msg && (
          <div
            className={`p-4 mb-6 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {msg.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* TAB 1: System Settings (การตั้งค่าระบบ - ผู้ดูแล และ เจ้าหน้าที่ เท่านั้น) */}
        {activeTab === "SYSTEM_SETTINGS" && (isAdmin || isStaff) && (
          <div className="space-y-8 max-w-4xl mx-auto">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#A05AFF]" />
                <span>การตั้งค่าระบบ (System Configuration)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                กำหนดชื่อโรงเรียน Logo ระบบ ชื่อระบบ Icon และวันที่อัปเดตข้อมูลล่าสุด
              </p>
            </div>
            <span className="text-xs font-bold text-[#1BCFB4] bg-[#1BCFB4]/10 px-3 py-1 rounded-xl border border-[#1BCFB4]/20">
              Live Preview Active
            </span>
          </div>

          <form onSubmit={handleSaveSystemSettings} className="space-y-8">
            {/* 1. School Name Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <School className="w-4 h-4 text-[#A05AFF]" />
                <span>1. ตั้งค่าชื่อโรงเรียน & ตัวย่อ (School Name & Acronym)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อโรงเรียน (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolNameTh}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolNameTh: e.target.value })}
                    placeholder="เช่น โรงเรียนพิจิตรปัญญานุกูล"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตัวย่อชื่อโรงเรียน (ภาษาไทย)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolAcronymTh || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolAcronymTh: e.target.value })}
                    placeholder="เช่น พ.จ.ป."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อโรงเรียน (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolNameEn}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolNameEn: e.target.value })}
                    placeholder="เช่น Pichit Panyanukul School"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตัวย่อชื่อโรงเรียน (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.schoolAcronymEn || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolAcronymEn: e.target.value })}
                    placeholder="เช่น PCCC"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>
            </div>

            {/* 2. School Logo Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#A05AFF]" />
                <span>2. ตั้งค่า Logo โรงเรียน (School Logo)</span>
              </h4>

              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  เลือกตราสัญลักษณ์ Logo ในระบบ:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SYSTEM_LOGOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, schoolLogoUrl: p.url })}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 bg-white ${
                        settingsForm.schoolLogoUrl === p.url
                          ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/30 bg-purple-50/50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <img src={p.url} alt={p.name} className="w-12 h-12 object-contain rounded-lg border border-slate-200 p-1 bg-slate-50" />
                      <span className="text-[10px] font-bold text-slate-700">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Logo Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex flex-wrap items-center justify-between gap-1">
                  <span>วาง URL Link รูปภาพ Logo หรือลิงก์แชร์จาก Google Drive:</span>
                  <span className="text-[11px] text-[#A05AFF] font-bold">
                    {settingsForm.schoolLogoUrl && settingsForm.schoolLogoUrl.includes("drive.google.com")
                      ? "✓ ตรวจพบลิงก์ Google Drive (แปลงเป็นรูปภาพอัตโนมัติ)"
                      : "แสดงตัวอย่างรูปภาพทันที"}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settingsForm.schoolLogoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Auto convert Google Drive link directly into stored setting if desired or keep clean
                      setSettingsForm({ ...settingsForm, schoolLogoUrl: val });
                    }}
                    placeholder="https://drive.google.com/file/d/... หรือ https://example.com/logo.png"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                  {settingsForm.schoolLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, schoolLogoUrl: "" })}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      ล้าง URL
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 <strong>คำแนะนำสำหรับ Google Drive:</strong> คัดลอกลิงก์รับลิงก์ที่แชร์ได้ (Share Link) จาก Google Drive มาวางได้ทันที เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-purple-700">https://drive.google.com/file/d/xxxx/view?usp=sharing</code>
                </p>
              </div>

              {/* Instant Live Logo Preview Card */}
              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-purple-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#A05AFF]" />
                    <span>ตัวอย่าง Logo แบบ Real-Time (Live Preview & Scaling)</span>
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                    แสดงผลในระบบทันที
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Large Logo Display */}
                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl border-2 border-[#A05AFF]/30 overflow-hidden bg-white shadow-xs flex items-center justify-center shrink-0 p-1">
                      {settingsForm.schoolLogoUrl ? (
                        <img
                          src={getDirectImageUrl(settingsForm.schoolLogoUrl)}
                          alt="School Logo Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                            const errDiv = (e.target as HTMLElement).nextElementSibling;
                            if (errDiv) errDiv.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`flex flex-col items-center justify-center text-center p-1 ${settingsForm.schoolLogoUrl ? "hidden" : ""}`}>
                        <Building2 className="w-6 h-6 text-slate-400" />
                        <span className="text-[9px] text-rose-500 font-bold mt-1">ยังไม่มี URL Logo</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-800 truncate">
                        {settingsForm.schoolNameTh || "ชื่อโรงเรียน"}
                      </div>
                      {settingsForm.schoolAcronymTh && (
                        <div className="text-[11px] font-extrabold text-[#A05AFF] mt-0.5">
                          ตัวย่อ: {settingsForm.schoolAcronymTh} {settingsForm.schoolAcronymEn ? `(${settingsForm.schoolAcronymEn})` : ""}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono truncate mt-1" title={getDirectImageUrl(settingsForm.schoolLogoUrl)}>
                        {settingsForm.schoolLogoUrl.includes("drive.google.com")
                          ? "✓ แปลงจาก Google Drive แล้ว"
                          : settingsForm.schoolLogoUrl || "กรุณาวาง URL รูปภาพ"}
                      </div>
                    </div>
                  </div>

                  {/* UI Context Simulation */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ตัวอย่างการแสดงผลในเมนูระบบ (Sidebar Preview)
                    </div>
                    <div className="flex items-center gap-2.5 bg-slate-800 p-2 rounded-lg border border-slate-700">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center p-0.5 border border-purple-200/50">
                        {settingsForm.schoolLogoUrl ? (
                          <img
                            src={getDirectImageUrl(settingsForm.schoolLogoUrl)}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-black text-white truncate">
                          {settingsForm.systemNameTh || "ระบบบริหารหอพัก"}
                        </div>
                        <div className="text-[9px] text-purple-300 font-bold truncate">
                          {settingsForm.schoolNameTh} {settingsForm.schoolAcronymTh ? `(${settingsForm.schoolAcronymTh})` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. System Name & Title Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#A05AFF]" />
                <span>3. ตั้งชื่อระบบ (System Name) & Title ของระบบ (System Title)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งชื่อระบบ (ภาษาไทย) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemNameTh}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemNameTh: e.target.value })}
                    placeholder="เช่น ระบบบริหารจัดการหอพักนักเรียน"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งชื่อระบบ (ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemNameEn}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemNameEn: e.target.value })}
                    placeholder="เช่น Student Dormitory Management System"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>ตั้งค่า Title ของระบบ (Document / Browser Tab Title - ภาษาไทย)</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemTitleTh || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemTitleTh: e.target.value })}
                    placeholder="เช่น ระบบบริหารจัดการหอพักนักเรียน - โรงเรียนพิจิตรปัญญานุกูล"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    💡 ข้อความนี้จะใช้เป็น Title ของหน้าเว็บที่จะแสดงบนแท็บเบราว์เซอร์ (Browser Tab Title)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ตั้งค่า Title ของระบบ (Document / Browser Tab Title - ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.systemTitleEn || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, systemTitleEn: e.target.value })}
                    placeholder="เช่น Student Dormitory Management System - Pichit Panyanukul School"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>
            </div>

            {/* 4. System Icon Settings */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#A05AFF]" />
                <span>4. ตั้งค่า Icon ระบบ (System Icon)</span>
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  เลือกไอคอนระบบ แบบตัวอย่างให้เลือก:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[
                    { id: "building", icon: Building2, label: "อาคาร" },
                    { id: "school", icon: School, label: "โรงเรียน" },
                    { id: "home", icon: Home, label: "หอพัก" },
                    { id: "shield", icon: Shield, label: "โล่เกราะ" },
                    { id: "grad", icon: GraduationCap, label: "การศึกษา" },
                    { id: "award", icon: Award, label: "รางวัล" },
                    { id: "crown", icon: Crown, label: "มงกุฎ" },
                    { id: "star", icon: Star, label: "ดาว" }
                  ].map((ic) => {
                    const IconComp = ic.icon;
                    const isSelected = settingsForm.systemIcon === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, systemIcon: ic.id })}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 bg-white ${
                          isSelected
                            ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/30 bg-[#A05AFF]/10 text-[#A05AFF]"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{ic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หรือ วาง URL Link รูปภาพไอคอนระบบ:
                </label>
                <input
                  type="text"
                  value={settingsForm.systemIcon.startsWith("http") ? settingsForm.systemIcon : ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, systemIcon: e.target.value || "building" })}
                  placeholder="https://example.com/icon.png"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#A05AFF]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] hover:opacity-95 text-white font-extrabold text-sm rounded-xl shadow-md shadow-[#A05AFF]/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกการตั้งค่าระบบ</span>
              </button>
            </div>
          </form>
        </div>
      )}


      {/* TAB: Change Password */}
      {activeTab === "CHANGE_PASSWORD" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#A05AFF]" />
              <span>{isAdmin || isStaff ? "3. เปลี่ยนรหัสผ่าน (Change Password)" : "1. เปลี่ยนรหัสผ่าน (Change Password)"}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin
                ? "สิทธิ์ Admin: สามารถเลือกเปลี่ยนรหัสผ่านให้บัญชีผู้ใช้ทุกคนได้ทันทีโดยไม่ต้องยืนยันรหัสเดิม"
                : "สิทธิ์เจ้าหน้าที่ / ครูหอพัก: ยืนยันรหัสผ่านเดิมเพื่อตั้งรหัสผ่านใหม่"}
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            {/* Admin Select Target User */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  เลือกผู้ใช้งานที่ต้องการเปลี่ยนรหัสผ่าน:
                </label>
                <select
                  value={selectedTargetUserId}
                  onChange={(e) => setSelectedTargetUserId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-[#A05AFF]"
                >
                  {sortedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleCategoryName} - ระดับ {u.roleLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target User Info Badge */}
            <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <img
                src={(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.avatarUrl || PRESET_AVATARS[0]}
                alt="Target User"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-[#A05AFF]/30 border-2 border-white shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-800">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.name}
                </div>
                <div className="text-[11px] text-[#A05AFF] font-bold">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.roleCategoryName} (ระดับ {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.roleLevel})
                </div>
              </div>
            </div>

            {/* Old Password (Not required for Admin) */}
            {!isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รหัสผ่านเดิม <span className="text-rose-500">* (จำเป็นต้องระบุ)</span>
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="ป้อนรหัสผ่านเดิม..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>
            )}

            {/* New Password & Confirm */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ตั้งรหัสผ่านใหม่..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง..."
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#9E58FF] text-white font-black text-sm rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Key className="w-5 h-5" />
              <span>บันทึกการเปลี่ยนรหัสผ่าน</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: Change Profile Picture */}
      {activeTab === "CHANGE_PROFILE" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#A05AFF]" />
              <span>{isAdmin || isStaff ? "4. เปลี่ยนรูปโปรไฟล์ (Change Profile Picture)" : "2. เปลี่ยนรูปโปรไฟล์ (Change Profile Picture)"}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              เลือกรูปภาพไอคอนประจำตัว หรืออัปโหลดรูปภาพใหม่จากเครื่องลง Google Drive อัตโนมัติ
            </p>
          </div>

          <form onSubmit={handleSaveProfileAvatar} className="space-y-5">
            {/* Admin Select Target User */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  เลือกผู้ใช้งานที่ต้องการเปลี่ยนรูปโปรไฟล์:
                </label>
                <select
                  value={selectedTargetUserId}
                  onChange={(e) => {
                    setSelectedTargetUserId(e.target.value);
                    const sel = users.find((u) => u.id === e.target.value);
                    if (sel) {
                      setSelectedAvatar(sel.avatarUrl || PRESET_AVATARS[0]);
                      setCustomAvatarUrl("");
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-[#A05AFF]"
                >
                  {sortedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleCategoryName} - ระดับ {u.roleLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Avatar Live Preview */}
            <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <img
                src={customAvatarUrl.trim() || selectedAvatar}
                alt="Profile Preview"
                className="w-16 h-16 rounded-full object-cover ring-4 ring-[#A05AFF]/30 border-2 border-white shadow-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-800">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.name}
                </div>
                <div className="text-xs text-[#A05AFF] font-bold">
                  {(users.find((u) => u.id === selectedTargetUserId) || currentUser)?.roleCategoryName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {customAvatarUrl.trim() || selectedAvatar}
                </div>
              </div>
              <span className="text-[10px] font-bold bg-[#A05AFF]/10 text-[#A05AFF] px-2.5 py-1 rounded-full border border-[#A05AFF]/20 shrink-0">
                พรีวิว Real-time
              </span>
            </div>

            {/* Upload image file from user's device */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 rounded-2xl border border-indigo-100 shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CloudUpload className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">เลือกรูปภาพจากเครื่องของท่าน</div>
                    <div className="text-[10px] text-slate-500 truncate">บันทึกรูปภาพลงฐานข้อมูล Firebase โดยตรง รวดเร็ว ปลอดภัย และแสดงผลได้ทันที</div>
                  </div>
                </div>

                <label className={`px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 ${isUploadingDrive ? "opacity-60 pointer-events-none" : ""}`}>
                  {isUploadingDrive ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5" />
                      <span>เลือกรูปภาพจากเครื่อง...</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLocalFileSelect(e, "PROFILE")}
                    disabled={isUploadingDrive}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Selected File Badge */}
              {profileSelectedFile && (
                <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-blue-200 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span className="font-semibold text-slate-700 truncate">รูปที่เลือก: {profileSelectedFile.name}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold shrink-0">
                      (พร้อมบันทึกเป็นรูปโปรไฟล์)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => clearSelectedFile("PROFILE")}
                    className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="ยกเลิกไฟล์ที่เลือก"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Google Drive Folder Banner */}
              <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-indigo-900 font-medium truncate">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">โฟลเดอร์รูปภาพบน Google Drive (ทางเลือก):</span>
                </div>
                <a
                  href={GOOGLE_DRIVE_AVATAR_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                >
                  <span>เปิด Google Drive ↗</span>
                </a>
              </div>
            </div>

            {/* Preset avatars vector icons grid */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700">
                  เลือกไอคอนสัญลักษณ์ตัวอย่าง:
                </label>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {PRESET_AVATARS.map((url, idx) => {
                  const meta = PRESET_AVATARS_META[idx] || { roleName: "ไอคอน", badgeColor: "" };
                  const isSelected = selectedAvatar === url && !customAvatarUrl && !profileSelectedFile;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(url);
                        setCustomAvatarUrl("");
                        if (profileSelectedFile) clearSelectedFile("PROFILE");
                      }}
                      className={`relative rounded-xl p-1.5 flex items-center justify-center border-2 cursor-pointer transition-all hover:scale-105 ${
                        isSelected
                          ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/40 scale-105 bg-purple-50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                      title={meta.roleName}
                    >
                      <img src={url} alt={`Icon ${idx + 1}`} className="w-10 h-10 object-cover rounded-full" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                หรือป้อน URL รูปภาพประจำตัวแบบกำหนดเอง:
              </label>
              <input
                type="url"
                value={customAvatarUrl}
                onChange={(e) => {
                  setCustomAvatarUrl(e.target.value);
                  if (profileSelectedFile) clearSelectedFile("PROFILE");
                }}
                placeholder="https://example.com/avatar.png หรือลิงก์รูปภาพ..."
                className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
              />
            </div>

            <button
              type="submit"
              disabled={isUploadingDrive}
              className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] text-white font-black text-sm rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isUploadingDrive ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังอัปโหลดและบันทึก...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  <span>บันทึกการเปลี่ยนรูปโปรไฟล์</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Manage Staff & Users (Admin & Staff) */}
      {activeTab === "MANAGE_USERS" && (isAdmin || isStaff) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#A05AFF]" />
                <span>2. จัดการเจ้าหน้าที่ & ผู้ใช้</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAdmin
                  ? "สามารถ เพิ่ม ลบ แก้ไข เจ้าหน้าที่ (Level 2) และครูหอพัก/ผู้ใช้ (Level 3) พร้อมกำหนดรูปไอคอนประจำตัว"
                  : "สิทธิ์เจ้าหน้าที่ (Level 2) สามารถ เพิ่ม ลบ แก้ไข บัญชีผู้ใช้ครูหอพัก (Level 3) พร้อมกำหนดรูปไอคอนประจำตัว"}
              </p>
            </div>

            <button
              onClick={() => {
                setEditingUser(null);
                setFormData({
                  name: "",
                  phone: "",
                  roleLevel: isStaff ? 3 : 2,
                  roleCategory: isStaff ? "DORM_TEACHER" : "STAFF",
                  dormId: "",
                  dormPosition: "ครูประจำหอพัก",
                  allowedDormIds: [],
                  avatarUrl: PRESET_AVATARS[0],
                  password: "123456"
                });
                setIsAddUserModalOpen(true);
              }}
              className="bg-[#A05AFF] hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isStaff ? "เพิ่มครูหอพักใหม่" : "เพิ่มผู้ใช้/เจ้าหน้าที่ใหม่"}</span>
            </button>
          </div>

          {/* Users List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">รูปไอคอน</th>
                  <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4">ระดับสิทธิ์ (Role Level)</th>
                  <th className="py-3 px-4">สิทธิ์เข้าถึง / หอพักที่เช็ครายชื่อได้</th>
                  <th className="py-3 px-4">รหัสผ่านปัจจุบัน</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedUsers.map((u) => {
                  const dorm = dorms.find((d) => d.id === u.dormId);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <img
                          src={u.avatarUrl || PRESET_AVATARS[0]}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 mx-auto"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{u.name}</span>
                          {u.phone && u.phone.trim() && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <Phone className="w-2.5 h-2.5" />
                              {u.phone}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>{u.roleLevel === 1 ? "ผู้ดูแล" : u.roleLevel === 2 ? "เจ้าหน้าที่" : "ครูหอพัก"}</span>
                          {u.dormPosition && (
                            <span className="text-purple-600 font-bold">• {u.dormPosition}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            u.roleLevel === 1
                              ? "bg-purple-100 text-purple-800"
                              : u.roleLevel === 2
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          ระดับ {u.roleLevel} ({u.roleCategoryName})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {u.allowedDormIds && u.allowedDormIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.allowedDormIds.map((dId) => {
                              const dObj = dorms.find((d) => d.id === dId);
                              return (
                                <span
                                  key={dId}
                                  className="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-200"
                                >
                                  {dObj ? dObj.name : dId}
                                </span>
                              );
                            })}
                          </div>
                        ) : dorm ? (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                            {dorm.name}
                          </span>
                        ) : u.roleLevel === 3 ? (
                          <span className="text-rose-500 font-bold text-xs">ยังไม่กำหนดหอพัก</span>
                        ) : (
                          <span className="text-gray-500 text-xs">ทุกหอพัก (สิทธิ์ส่วนกลาง)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">
                        {(isAdmin || (isStaff && u.roleLevel === 3)) ? u.password || "123456" : "******"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(() => {
                            const isStaffRestricted = isStaff && (u.roleLevel === 1 || u.roleLevel === 2);
                            return (
                              <button
                                onClick={() => {
                                  if (isStaffRestricted) {
                                    showNotification("error", "เจ้าหน้าที่ไม่สามารถแก้ไขข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้");
                                    return;
                                  }
                                  setEditingUser(u);
                                  setFormData({
                                    name: u.name,
                                    phone: u.phone || "",
                                    roleLevel: u.roleLevel,
                                    roleCategory: u.roleCategory,
                                    dormId: u.dormId || "",
                                    dormPosition: u.dormPosition || "ครูประจำหอพัก",
                                    allowedDormIds: u.allowedDormIds || (u.dormId ? [u.dormId] : []),
                                    avatarUrl: u.avatarUrl || PRESET_AVATARS[0],
                                    password: u.password || "123456"
                                  });
                                  setIsAddUserModalOpen(true);
                                }}
                                disabled={isStaffRestricted}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isStaffRestricted
                                    ? "text-gray-300 bg-gray-100 cursor-not-allowed"
                                    : "text-blue-600 hover:bg-blue-50 cursor-pointer"
                                }`}
                                title={isStaffRestricted ? "เจ้าหน้าที่ไม่สามารถแก้ไขข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้" : "แก้ไขข้อมูล"}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            );
                          })()}

                          {(() => {
                            const isSelf = Boolean(currentUser && u.id === currentUser.id);
                            const level1AdminsCount = users.filter((usr) => usr.roleLevel === 1).length;
                            const isLastLevel1Admin = u.roleLevel === 1 && level1AdminsCount <= 1;
                            const isStaffRestricted = isStaff && (u.roleLevel === 1 || u.roleLevel === 2);
                            const isDeleteDisabled = isSelf || isLastLevel1Admin || isStaffRestricted;

                            let disabledTooltip = "ลบบัญชีผู้ใช้";
                            if (isSelf) {
                              disabledTooltip = "ผู้ที่เข้าสู่ระบบไม่สามารถลบบัญชีของตนเองได้";
                            } else if (isLastLevel1Admin) {
                              disabledTooltip = "ไม่สามารถลบได้ เนื่องจากเป็นผู้ดูแลระดับ 1 คนสุดท้าย";
                            } else if (isStaffRestricted) {
                              disabledTooltip = "เจ้าหน้าที่ไม่สามารถลบข้อมูลผู้ดูแลหรือเจ้าหน้าที่ได้";
                            }

                            return (
                              <button
                                onClick={() => handleDeleteUserClick(u)}
                                disabled={isDeleteDisabled}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isDeleteDisabled
                                    ? "text-gray-300 bg-gray-100 cursor-not-allowed"
                                    : "text-rose-600 hover:bg-rose-50 cursor-pointer"
                                }`}
                                title={disabledTooltip}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Database Management (Admin & Staff) */}
      {activeTab === "DATABASE" && (isAdmin || isStaff) && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-[#A05AFF]" />
                <span>4. จัดการฐานข้อมูล</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                สำรองข้อมูล กู้คืนฐานข้อมูลจากไฟล์ JSON และจัดการล้างข้อมูลในระบบ
              </p>
            </div>

            {/* Firebase Primary Database Card */}
            <FirebaseStatusBadge compact={false} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Primary Database Sync Status */}
                <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 space-y-3 md:col-span-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex flex-wrap items-center gap-2">
                        <span>ฐานข้อมูลหลัก Firebase Cloud (Primary Firestore DB)</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                          ✓ เชื่อมต่อกับ Firebase สำเร็จ
                        </span>
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        ระบบใช้ <strong>Firebase Firestore</strong> เป็นฐานข้อมูลหลักสำหรับโปรเจกต์ <strong>Student Counting System</strong> พร้อมระบบซิงค์ข้อมูลอัตโนมัติ
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await savePrimaryDatabase();
                        showNotification("success", "บันทึกและซิงค์ข้อมูลหลักไปยัง Firebase สำเร็จเรียบร้อยแล้ว");
                      } catch (e: any) {
                        showNotification("error", e.message || "ไม่สามารถบันทึกฐานข้อมูลหลักได้");
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>ซิงค์ข้อมูลไปยัง Firebase</span>
                  </button>
                </div>

              {/* Backup Export */}
              <div className="p-5 rounded-2xl border border-purple-100 bg-purple-50/50 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">สำรองข้อมูลระบบ (Export Backup)</h4>
                  <p className="text-xs text-gray-500 mt-1">ดาวน์โหลดไฟล์ JSON เก็บไว้เป็นสำรองข้อมูลฉุกเฉิน (รวมข้อมูลหอพัก, รายชื่อครูผู้ดูแลหอพัก, รายชื่อนักเรียน และประวัติการเช็คยอด)</p>
                </div>
                <button
                  onClick={handleExportDb}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์ JSON</span>
                </button>
              </div>

              {/* Restore Import */}
              <div className="p-5 rounded-2xl border border-cyan-100 bg-cyan-50/50 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">กู้คืนฐานข้อมูล (Restore Import)</h4>
                  <p className="text-xs text-gray-500 mt-1">นำเข้าไฟล์ JSON เพื่อกู้คืนข้อมูลหอพัก รายชื่อครูผู้ดูแล นักเรียน และประวัติการเช็คยอด</p>
                </div>
                <label className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center">
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์ JSON เพื่อนำเข้า</span>
                  <input type="file" accept=".json" onChange={handleImportDb} className="hidden" />
                </label>
              </div>

              {/* Clear Database (Admin Only) */}
              {isAdmin ? (
                <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-900 text-sm">ล้างฐานข้อมูลทั้งหมด (Clear DB)</h4>
                    <p className="text-xs text-rose-600 mt-1">
                      ล้างข้อมูลหอพัก, รายชื่อครูผู้ดูแลหอพัก, รายชื่อนักเรียน, ประวัติการเช็คยอด และข้อความแจ้งอบรมทั้งหมด
                    </p>
                  </div>
                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR")}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ล้างฐานข้อมูลทั้งหมด</span>
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 space-y-2 opacity-60">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <h4 className="font-bold text-gray-700 text-sm">ล้างฐานข้อมูลระบบ</h4>
                  <p className="text-xs text-gray-400">เฉพาะผู้ดูแลระบบ (Admin Level 1) เท่านั้นที่ล้างข้อมูลได้</p>
                </div>
              )}
            </div>

            {/* SECTION: บริหารจัดการฐานข้อมูลการเช็คยอด & เรื่องแจ้งอบรม (Backup, Restore, Clear) */}
            <div className="bg-white border-2 border-[#A05AFF]/30 rounded-2xl p-5 md:p-6 space-y-6 mt-6 shadow-sm">
              <div className="border-b border-[#A05AFF]/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#A05AFF] to-[#7B2CBF] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-base md:text-lg flex flex-wrap items-center gap-2">
                      <span>จัดการข้อมูลการเช็คยอด & เรื่องแจ้งอบรม</span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-200">
                        เฉพาะเจ้าหน้าที่ / ผู้ดูแล
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      สำรองข้อมูล, กู้คืนข้อมูล และล้างประวัติการเช็คยอด & เรื่องอบรมนักเรียน (เลือกตามวันที่, เดือน, ช่วงเวลา หรือทั้งหมด)
                    </p>
                  </div>
                </div>

                {/* Sub-tab Pills Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start md:self-auto">
                  <button
                    onClick={() => setAttendanceDbSubTab("BACKUP")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "BACKUP"
                        ? "bg-[#A05AFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>1. สำรองข้อมูล</span>
                  </button>
                  <button
                    onClick={() => setAttendanceDbSubTab("RESTORE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "RESTORE"
                        ? "bg-[#A05AFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>2. กู้คืนข้อมูล</span>
                  </button>
                  <button
                    onClick={() => setAttendanceDbSubTab("CLEAR")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      attendanceDbSubTab === "CLEAR"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>3. ล้างประวัติ</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: 1. สำรองข้อมูลการเช็คยอด + เรื่องอบรม */}
              {attendanceDbSubTab === "BACKUP" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-200 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-purple-900 text-sm">
                        1. สำรองข้อมูลการเช็คยอด + เรื่องแจ้งอบรม (Backup Attendance & Notices)
                      </h5>
                      <p className="text-slate-600 leading-relaxed">
                        ส่งออกไฟล์ JSON เพื่อสำรองบันทึกการเช็คยอดประจำวัน รายการสถานะนักเรียน (ออกหอพัก/ลา/ป่วย/หนีหอพัก) พร้อมเรื่องแจ้งอบรมจากหัวหน้างานหอพัก
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      เลือกรูปแบบการสำรองข้อมูล <span className="text-purple-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("DATE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "DATE"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>ตามวันที่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("MONTH")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "MONTH"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>ตามเดือน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("RANGE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "RANGE"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarRange className="w-4 h-4" />
                        <span>ตามช่วงเวลา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttBackupMode("ALL")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attBackupMode === "ALL"
                            ? "border-[#A05AFF] bg-purple-50 text-[#A05AFF] shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>ทั้งหมดในระบบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {attBackupMode === "DATE" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-backup-date" className="block text-xs font-bold text-slate-700">
                          ระบุวันที่ที่ต้องการสำรองข้อมูล <span className="text-purple-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-backup-date"
                            type="date"
                            value={attBackupDate}
                            max={getTodayDateString()}
                            onChange={(e) => setAttBackupDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none"
                          />
                          <div className="bg-purple-100/80 text-purple-900 border border-purple-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#A05AFF]" />
                            <span>{formatThaiFullDate(attBackupDate)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attBackupMode === "MONTH" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-backup-month" className="block text-xs font-bold text-slate-700">
                          ระบุเดือนที่ต้องการสำรองข้อมูล <span className="text-purple-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-backup-month"
                            type="month"
                            value={attBackupMonth}
                            onChange={(e) => setAttBackupMonth(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none"
                          />
                          <div className="bg-purple-100/80 text-purple-900 border border-purple-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-[#A05AFF]" />
                            <span>{formatThaiMonthString(attBackupMonth)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attBackupMode === "RANGE" && (
                      <>
                        <div className="space-y-1.5">
                          <label htmlFor="att-backup-start-date" className="block text-xs font-bold text-slate-700">
                            ตั้งแต่วันที่ <span className="text-purple-600">*</span>
                          </label>
                          <input
                            id="att-backup-start-date"
                            type="date"
                            value={attBackupStartDate}
                            onChange={(e) => setAttBackupStartDate(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none"
                          />
                          <span className="text-[11px] text-purple-700 font-bold block">
                            {formatThaiFullDate(attBackupStartDate)}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="att-backup-end-date" className="block text-xs font-bold text-slate-700">
                            ถึงวันที่ <span className="text-purple-600">*</span>
                          </label>
                          <input
                            id="att-backup-end-date"
                            type="date"
                            value={attBackupEndDate}
                            min={attBackupStartDate}
                            onChange={(e) => setAttBackupEndDate(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none"
                          />
                          <span className="text-[11px] text-purple-700 font-bold block">
                            {formatThaiFullDate(attBackupEndDate)}
                          </span>
                        </div>
                      </>
                    )}

                    {attBackupMode === "ALL" && (
                      <div className="md:col-span-2 bg-purple-50 text-purple-900 border border-purple-200 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>ระบบจะส่งออกประวัติการเช็คยอดและเรื่องอบรมย้อนหลังทั้งหมดที่บันทึกไว้ในฐานข้อมูล</span>
                      </div>
                    )}

                    {/* Dorm Select */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="att-backup-dorm-select" className="block text-xs font-bold text-slate-700">
                        เลือกหอพักที่ต้องการสำรองข้อมูล
                      </label>
                      <select
                        id="att-backup-dorm-select"
                        value={attBackupDormId}
                        onChange={(e) => setAttBackupDormId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#A05AFF] outline-none cursor-pointer"
                      >
                        <option value="ALL">-- สำรองข้อมูลทุกหอพัก (All Dormitories) --</option>
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.teacherName || "ครูประจำหอพัก"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Include Notices Checkbox */}
                    <div className="md:col-span-2 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={attBackupIncludeNotices}
                          onChange={(e) => setAttBackupIncludeNotices(e.target.checked)}
                          className="w-4 h-4 text-[#A05AFF] rounded border-slate-300 focus:ring-[#A05AFF] cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          รวมข้อมูลเรื่องแจ้งอบรมนักเรียนจากหัวหน้างานหอพัก (Orientation Notices)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={executeExportAttendance}
                    disabled={isExportingAttendance}
                    className="w-full py-3 bg-gradient-to-r from-[#A05AFF] to-[#7B2CBF] hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isExportingAttendance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังรวบรวมและสร้างไฟล์สำรองข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลดไฟล์สำรองข้อมูลการเช็คยอด + เรื่องอบรม (JSON)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* TAB 2: 2. กู้คืนข้อมูลการเช็คยอด + เรื่องอบรม */}
              {attendanceDbSubTab === "RESTORE" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-200 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-indigo-900 text-sm">
                        2. กู้คืนข้อมูลการเช็คยอด + เรื่องแจ้งอบรม (Restore Attendance & Notices)
                      </h5>
                      <p className="text-slate-600 leading-relaxed">
                        นำเข้าไฟล์สำรองข้อมูล JSON เพื่อกู้คืนประวัติการเช็คยอดและเรื่องแจ้งอบรมนักเรียน สามารถเลือกนำเข้าทั้งหมด หรือเลือกเฉพาะวันที่/เดือน/ช่วงเวลาได้
                      </p>
                    </div>
                  </div>

                  {/* File Upload Box */}
                  <div className="bg-slate-50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-5 text-center transition-all">
                    <input
                      id="att-restore-file-input"
                      type="file"
                      accept=".json"
                      onChange={handleAttendanceRestoreFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="att-restore-file-input"
                      className="flex flex-col items-center justify-center cursor-pointer gap-2"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                        <FileJson className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs md:text-sm font-extrabold text-indigo-700 hover:underline">
                          คลิกเพื่อเลือกไฟล์สำรองข้อมูล (.json)
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          รองรับไฟล์สำรองการเช็คยอดเฉพาะส่วน หรือไฟล์สำรองฐานข้อมูลรวมทั้งหมด
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* File Analysis Card */}
                  {attRestoreAnalysis && (
                    <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                        <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>พบข้อมูลในไฟล์สำรอง: {attRestoreFile?.name}</span>
                        </div>
                        {attRestoreAnalysis.exportedAt && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-medium">
                            ส่งออกเมื่อ: {new Date(attRestoreAnalysis.exportedAt).toLocaleDateString("th-TH")}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">ประวัติการเช็คยอด</span>
                          <strong className="text-base font-black text-indigo-600">
                            {attRestoreAnalysis.totalAttendance} รายการ
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">เรื่องแจ้งอบรม</span>
                          <strong className="text-base font-black text-purple-600">
                            {attRestoreAnalysis.totalNotices} เรื่อง
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">จำนวนวันที่บันทึก</span>
                          <strong className="text-base font-black text-slate-800">
                            {attRestoreAnalysis.dates.length} วัน
                          </strong>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-indigo-100">
                          <span className="text-[11px] text-slate-500 block font-medium">ช่วงวันที่ในไฟล์</span>
                          <strong className="text-[11px] font-bold text-slate-700 block truncate">
                            {attRestoreAnalysis.minDate} ถึง {attRestoreAnalysis.maxDate}
                          </strong>
                        </div>
                      </div>

                      {/* Selective Scope */}
                      <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold text-slate-800">
                          เลือกขอบเขตข้อมูลที่ต้องการกู้คืน <span className="text-indigo-600">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("ALL")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "ALL"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            🌐 ทั้งหมดในไฟล์
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("DATE")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "DATE"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            📅 เฉพาะวันที่
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("MONTH")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "MONTH"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            🗓️ เฉพาะเดือน
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttRestoreMode("RANGE")}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              attRestoreMode === "RANGE"
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            ↔️ ตามช่วงเวลา
                          </button>
                        </div>

                        {attRestoreMode === "DATE" && (
                          <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                            <label className="block text-[11px] font-bold text-slate-700">เลือกวันที่จากไฟล์</label>
                            <select
                              value={attRestoreDate}
                              onChange={(e) => setAttRestoreDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                            >
                              {attRestoreAnalysis.dates.map((d) => (
                                <option key={d} value={d}>
                                  {formatThaiFullDate(d)} ({d})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {attRestoreMode === "MONTH" && (
                          <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                            <label className="block text-[11px] font-bold text-slate-700">ระบุเดือนที่ต้องการกู้คืน</label>
                            <input
                              type="month"
                              value={attRestoreMonth}
                              onChange={(e) => setAttRestoreMonth(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>
                        )}

                        {attRestoreMode === "RANGE" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-indigo-100">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">ตั้งแต่วันที่</label>
                              <input
                                type="date"
                                value={attRestoreStartDate}
                                onChange={(e) => setAttRestoreStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700">ถึงวันที่</label>
                              <input
                                type="date"
                                value={attRestoreEndDate}
                                onChange={(e) => setAttRestoreEndDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                              />
                            </div>
                          </div>
                        )}

                        {/* Dorm Filter */}
                        <div className="space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                          <label className="block text-[11px] font-bold text-slate-700">เลือกหอพักที่ต้องการกู้คืน</label>
                          <select
                            value={attRestoreDormId}
                            onChange={(e) => setAttRestoreDormId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                          >
                            <option value="ALL">-- กู้คืนทุกหอพัก (All Dormitories) --</option>
                            {dorms.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.teacherName || "ครูประจำหอพัก"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Restore Strategy */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-xs font-bold text-slate-800">รูปแบบการเขียนข้อมูลลงระบบ</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                              attRestoreStrategy === "UPSERT" ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 bg-white"
                            }`}>
                              <input
                                type="radio"
                                name="restoreStrategy"
                                value="UPSERT"
                                checked={attRestoreStrategy === "UPSERT"}
                                onChange={() => setAttRestoreStrategy("UPSERT")}
                                className="mt-0.5 text-indigo-600"
                              />
                              <div>
                                <strong className="text-xs font-bold text-slate-900 block">เพิ่มและอัปเดตทับ (Merge / Upsert)</strong>
                                <span className="text-[11px] text-slate-500 leading-tight block">
                                  เพิ่มข้อมูลใหม่และเขียนทับเฉพาะวันที่ตรงกัน ข้อมูลวันอื่นคงเดิมไว้ (แนะนำ)
                                </span>
                              </div>
                            </label>

                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                              attRestoreStrategy === "REPLACE" ? "border-amber-600 bg-amber-50/50" : "border-slate-200 bg-white"
                            }`}>
                              <input
                                type="radio"
                                name="restoreStrategy"
                                value="REPLACE"
                                checked={attRestoreStrategy === "REPLACE"}
                                onChange={() => setAttRestoreStrategy("REPLACE")}
                                className="mt-0.5 text-amber-600"
                              />
                              <div>
                                <strong className="text-xs font-bold text-amber-900 block">ล้างข้อมูลเดิมก่อนแล้วแทนที่ (Clean & Replace)</strong>
                                <span className="text-[11px] text-amber-700 leading-tight block">
                                  ล้างประวัติเดิมในขอบเขตที่เลือกออกก่อน แล้วแทนที่ด้วยข้อมูลจากไฟล์
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Execute Restore Button with Auth */}
                      <button
                        onClick={() => triggerDbActionWithAuth("RESTORE_ATTENDANCE_NOTICES")}
                        disabled={isRestoringAttendance}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isRestoringAttendance ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังกู้คืนข้อมูลลงสู่ฐานข้อมูล...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>ยืนยันกู้คืนข้อมูลการเช็คยอด & เรื่องแจ้งอบรม (ต้องใส่รหัสผ่าน)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: 3. ล้างประวัติการเช็คยอด + เรื่องอบรม (เลือกตามวันที่, เดือน, ช่วงเวลา, ทั้งหมด) */}
              {attendanceDbSubTab === "CLEAR" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h5 className="font-extrabold text-rose-900 text-sm">
                        3. ล้างประวัติการเช็คยอด + เรื่องแจ้งอบรม (Clear Attendance History)
                      </h5>
                      <p className="text-rose-700 leading-relaxed">
                        ล้างประวัติการเช็คยอดรายวัน ข้อมูลนักเรียนออกหอพัก/ลา/ป่วย และเรื่องแจ้งอบรมนักเรียน โดยเลือกตามวันที่, ตามเดือน, ตามช่วงเวลา หรือทั้งหมด
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      เลือกรูปแบบการล้างข้อมูล <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_DATE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_DATE"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>ตามวันที่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_MONTH")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_MONTH"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>ตามเดือน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("BY_RANGE")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "BY_RANGE"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <CalendarRange className="w-4 h-4" />
                        <span>ตามช่วงเวลา</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttClearMode("ALL")}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          attClearMode === "ALL"
                            ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>ทั้งหมดในระบบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Specific Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {attClearMode === "BY_DATE" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-clear-date" className="block text-xs font-bold text-slate-700">
                          ระบุวันที่ที่ต้องการล้างข้อมูล <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-clear-date"
                            type="date"
                            value={attClearDate}
                            max={getTodayDateString()}
                            onChange={(e) => setAttClearDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <div className="bg-rose-100/80 text-rose-900 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-rose-600" />
                            <span>{formatThaiFullDate(attClearDate)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attClearMode === "BY_MONTH" && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label htmlFor="att-clear-month" className="block text-xs font-bold text-slate-700">
                          ระบุเดือนที่ต้องการล้างข้อมูล <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id="att-clear-month"
                            type="month"
                            value={attClearMonth}
                            onChange={(e) => setAttClearMonth(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <div className="bg-rose-100/80 text-rose-900 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-rose-600" />
                            <span>{formatThaiMonthString(attClearMonth)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {attClearMode === "BY_RANGE" && (
                      <>
                        <div className="space-y-1.5">
                          <label htmlFor="att-clear-start-date" className="block text-xs font-bold text-slate-700">
                            ตั้งแต่วันที่ <span className="text-rose-600">*</span>
                          </label>
                          <input
                            id="att-clear-start-date"
                            type="date"
                            value={attClearStartDate}
                            onChange={(e) => setAttClearStartDate(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <span className="text-[11px] text-rose-700 font-bold block">
                            {formatThaiFullDate(attClearStartDate)}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="att-clear-end-date" className="block text-xs font-bold text-slate-700">
                            ถึงวันที่ <span className="text-rose-600">*</span>
                          </label>
                          <input
                            id="att-clear-end-date"
                            type="date"
                            value={attClearEndDate}
                            min={attClearStartDate}
                            onChange={(e) => setAttClearEndDate(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <span className="text-[11px] text-rose-700 font-bold block">
                            {formatThaiFullDate(attClearEndDate)}
                          </span>
                        </div>
                      </>
                    )}

                    {attClearMode === "ALL" && (
                      <div className="md:col-span-2 bg-rose-100 text-rose-950 border border-rose-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>คำเตือน: ระบบจะลบประวัติการเช็คยอดทั้งหมดทุกวันที่เคยบันทึกไว้ในระบบ</span>
                      </div>
                    )}

                    {/* Dorm Select */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="att-clear-dorm-select" className="block text-xs font-bold text-slate-700">
                        เลือกหอพักที่จะล้างข้อมูล
                      </label>
                      <select
                        id="att-clear-dorm-select"
                        value={attClearDormId}
                        onChange={(e) => setAttClearDormId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                      >
                        <option value="ALL">-- ล้างทุกหอพัก (All Dormitories) --</option>
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.teacherName || "ครูประจำหอพัก"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Include Notices Checkbox */}
                    <div className="md:col-span-2 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={attClearIncludeNotices}
                          onChange={(e) => setAttClearIncludeNotices(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          ล้างเรื่องแจ้งอบรมนักเรียนจากหัวหน้างานหอพักในช่วงเวลาที่เลือกด้วย
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Summary Warning */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      การล้างข้อมูลนี้จะลบรายการเช็คยอดและสถานะนักเรียนออกหอพักอย่างถาวร ต้องยืนยันรหัสผ่านก่อนดำเนินการ
                    </span>
                  </div>

                  {/* Clear Button with Auth */}
                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_ATTENDANCE_GRANULAR")}
                    disabled={isClearingAttendance}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isClearingAttendance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังล้างข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>
                          {attClearMode === "BY_DATE"
                            ? `ล้างข้อมูลเช็คยอดประจำวันที่ ${formatThaiFullDate(attClearDate)}`
                            : attClearMode === "BY_MONTH"
                            ? `ล้างข้อมูลเช็คยอดประจำเดือน ${formatThaiMonthString(attClearMonth)}`
                            : attClearMode === "BY_RANGE"
                            ? `ล้างข้อมูลเช็คยอดช่วง ${formatThaiDateRange(attClearStartDate, attClearEndDate)}`
                            : "ล้างข้อมูลเช็คยอดทั้งหมดทุกวัน"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* NEW SECTION: ลบรายชื่อนักเรียนในหอพัก (Clear Student Records) */}
            <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-6 space-y-6 mt-6">
              <div className="border-b border-rose-200/80 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base flex flex-wrap items-center gap-2">
                      <span>ลบรายชื่อนักเรียนในหอพัก</span>
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200">
                        ต้องยืนยันรหัสผ่าน
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      ลบข้อมูลรายชื่อนักเรียนระบุหอพัก (เลือกทีละ 1 หอพัก) หรือ ลบรายชื่อนักเรียนทุกหอพัก
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. ลบรายชื่อนักเรียนเลือกทีละ 1 หอพัก */}
                <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm border-b border-rose-100 pb-2">
                      <Building2 className="w-4 h-4 text-rose-600" />
                      <span>1. ลบรายชื่อนักเรียน (ระบุเลือกทีละ 1 หอพัก)</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ลบรายชื่อนักเรียนทั้งหมดเฉพาะหอพักที่เลือก ออกจากฐานข้อมูล
                    </p>

                    <div>
                      <label htmlFor="clear-students-dorm-select" className="block text-xs font-bold text-slate-700 mb-1">
                        เลือกหอพักที่จะลบรายชื่อนักเรียน <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="clear-students-dorm-select"
                        value={clearStudentsDormId}
                        onChange={(e) => setClearStudentsDormId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                      >
                        {dorms.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.teacherName || "ครูประจำหอพัก"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_STUDENTS_DORM")}
                    disabled={isClearingStudents}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {isClearingStudents
                        ? "กำลังลบข้อมูล..."
                        : `ลบรายชื่อนักเรียนใน ${dorms.find((d) => d.id === clearStudentsDormId)?.name || clearStudentsDormId}`}
                    </span>
                  </button>
                </div>

                {/* 2. ลบรายชื่อนักเรียนทุกหอพัก */}
                <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm border-b border-rose-100 pb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>2. ลบรายชื่อนักเรียนทุกหอพัก (ลบนักเรียนทั้งหมด)</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ลบรายชื่อนักเรียนทุกหอพักรวมทั้งระบบออกจากฐานข้อมูล (ใช้เมื่อต้องการตั้งต้นปีการศึกษาใหม่)
                    </p>

                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium leading-relaxed">
                      ⚠️ คำเตือน: รายชื่อนักเรียนทั้งหมดในทุกหอพักจะถูกลบถาวร กรุณายืนยันรหัสผ่านเพื่อดำเนินการ
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDbActionWithAuth("CLEAR_STUDENTS_ALL")}
                    disabled={isClearingStudents}
                    className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isClearingStudents ? "กำลังลบข้อมูล..." : "ลบรายชื่อนักเรียนทุกหอพัก (ลบทั้งหมด)"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 5: การตรวจสอบและซิงค์ข้อมูลจริงจาก Firebase Firestore */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 space-y-6 mt-6 shadow-xl border border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base flex flex-wrap items-center gap-2">
                      <span>5. ซิงค์ & ตรวจสอบข้อมูลสดจาก Firebase Firestore (Live Database Sync)</span>
                      <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                        Live Firebase Connected
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      ระบบเชื่อมต่อโดยตรงกับฐานข้อมูลจริงบน Firebase Firestore และดึงข้อมูลจริงทั้งหมดโดยไม่สร้างหรือใช้ฐานข้อมูลตัวอย่าง
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Live Data Sync Card */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>ซิงค์และดึงข้อมูลสดจาก Firebase (Sync Live Data)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      กดปุ่มด้านล่างเพื่อดึงข้อมูลสดล่าสุดทั้งหมดจากคอลเลกชันใน Firebase Firestore ของคุณมาอัปเดตระบบทันที
                    </p>
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] text-slate-300 space-y-1 font-mono">
                      <div className="text-emerald-400 font-bold">✓ Live Firestore Collections:</div>
                      <div>• dorms (ข้อมูลหอพักจริง)</div>
                      <div>• students (รายชื่อนักเรียนจริง)</div>
                      <div>• users (บัญชีผู้ใช้งานจริง)</div>
                      <div>• attendance & notices (การเช็คยอด & เรื่องแจ้งอบรมจริง)</div>
                    </div>
                  </div>

                  <button
                    onClick={handleInitializeDefaultDb}
                    disabled={isInitializingDefaultDb}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isInitializingDefaultDb ? "animate-spin" : ""}`} />
                    <span>{isInitializingDefaultDb ? "กำลังดึงข้อมูลจาก Firebase..." : "ซิงค์ & ดึงข้อมูลล่าสุดจาก Firebase Firestore"}</span>
                  </button>
                </div>

                {/* Project ID Config Info & Custom Switch Card */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>การตั้งค่าเชื่อมต่อ Firebase Project ID & Credentials</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      ตรวจสอบและคัดลอกค่าการตั้งค่า Firebase Config หรือดูวิธีการเปลี่ยน Project ID เมื่อย้ายไปใช้บัญชีอื่น
                    </p>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] space-y-2">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Project ID ปัจจุบัน:</span>
                        <span className="font-mono text-amber-200 font-bold">gen-lang-client-0460310471</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">Database ID:</span>
                        <span className="font-mono text-emerald-300 font-bold">ai-studio-c3d2ba83...</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">บัญชีผู้ดูแล:</span>
                        <span className="text-slate-200 font-bold">domitory@pcccr.ac.th</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsFirebaseConfigModalOpen(true)}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-xl transition-all border border-white/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>ดูรายละเอียดคู่มือการตั้งค่า Firebase Project ID</span>
                  </button>
                </div>
              </div>
            </div>

            {/* NEW SECTION 6: การส่งออกและเชื่อมต่อซอร์สโค้ดกับ GitHub (Export to GitHub & Git Repo) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 space-y-6 mt-6 shadow-xl border border-slate-700/50 relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 border border-slate-600/50 shadow-inner">
                    <Github className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-base flex flex-wrap items-center gap-2">
                      <span>6. ส่งออกและแสดงระบบบน GitHub (Export to GitHub & Repository Guide)</span>
                      <span className="bg-slate-700 text-slate-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-600">
                        Source Code & Version Control
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      สามารถส่งออกซอร์สโค้ดของระบบทั้งหมดเพื่อนำไปสร้าง Repository บน GitHub หรือนำไปปรับแต่งต่อบนเครื่องคอมพิวเตอร์ของคุณ
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Export Options */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      <span>ส่งออกซอร์สโค้ด (Export to GitHub / Download ZIP)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      คุณสามารถดาวน์โหลดหรือส่งออกแอปพลิเคชันนี้ผ่านเมนู <strong className="text-amber-300">Settings</strong> ของ AI Studio หรือใช้คำสั่ง Git เพื่อเชื่อมต่อไปยัง GitHub Repository ของคุณ
                    </p>
                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] text-slate-300 space-y-1 font-mono">
                      <div className="text-emerald-400 font-bold">✓ Included Files for GitHub:</div>
                      <div>• /src (React Component Architecture)</div>
                      <div>• firebase-applet-config.json</div>
                      <div>• package.json & Vite Config</div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsGithubModalOpen(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md border border-slate-600 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Github className="w-4 h-4 text-amber-300" />
                    <span>คำแนะนำวิธีนำโครงการขึ้น GitHub Repository</span>
                  </button>
                </div>

                {/* Git Quick Push Guide */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm border-b border-white/10 pb-2">
                      <GitBranch className="w-4 h-4 text-amber-400" />
                      <span>คำสั่ง Terminal สำหรับ Push ขึ้น GitHub</span>
                    </div>
                    <div className="bg-black/60 p-3 rounded-xl border border-white/10 text-[11px] font-mono text-emerald-300 space-y-1">
                      <div>git init</div>
                      <div>git add .</div>
                      <div>git commit -m "Initial commit - Student Counting System"</div>
                      <div>git branch -M main</div>
                      <div>git remote add origin https://github.com/your-user/repo.git</div>
                      <div>git push -u origin main</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`);
                      showNotification("success", "คัดลอกชุดคำสั่ง Git สำหรับ Push ขึ้น GitHub เรียบร้อยแล้ว");
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกคำสั่ง Git Push All</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

      {/* Add / Edit User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-up">
            <h3 className="text-base font-bold text-gray-900">
              {editingUser ? "แก้ไขข้อมูลผู้ใช้/เจ้าหน้าที่" : "เพิ่มผู้ใช้/เจ้าหน้าที่ใหม่"}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อ - นามสกุล *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น ครูสมชาย ใจดี"
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>เบอร์โทรศัพท์ติดต่อ</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none font-mono focus:ring-2 focus:ring-[#A05AFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ระดับสิทธิ์ (Level)</label>
                  <select
                    value={formData.roleLevel}
                    onChange={(e) => {
                      const level = Number(e.target.value);
                      let category: "ADMIN" | "STAFF" | "DORM_TEACHER" = "STAFF";
                      if (level === 1) category = "ADMIN";
                      if (level === 3) category = "DORM_TEACHER";
                      setFormData({ ...formData, roleLevel: level, roleCategory: category });
                    }}
                    className="w-full bg-gray-50 border border-gray-300 text-xs font-bold text-gray-800 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value={1} disabled={isStaff}>ระดับ 1 - ผู้ดูแล (Admin) {isStaff ? "(เฉพาะผู้ดูแลเท่านั้น)" : ""}</option>
                    <option value={2} disabled={isStaff}>ระดับ 2 - เจ้าหน้าที่ (Staff) {isStaff ? "(เฉพาะผู้ดูแลเท่านั้น)" : ""}</option>
                    <option value={3}>ระดับ 3 - ครูหอพัก (Teacher)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">รหัสผ่านเริ่มต้น</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="123"
                    className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              {formData.roleLevel === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ตำแหน่งประจำหอพัก</label>
                    <select
                      value={formData.dormPosition || "ครูประจำหอพัก"}
                      onChange={(e) => setFormData({ ...formData, dormPosition: e.target.value as any })}
                      className="w-full bg-gray-50 border border-gray-300 text-xs text-purple-900 font-extrabold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    >
                      <option value="ครูประธานหอพัก">1. ครูประธานหอพัก</option>
                      <option value="ครูรองประธานหอพัก">2. ครูรองประธานหอพัก</option>
                      <option value="ครูหัวหน้าหอพัก">3. ครูหัวหน้าหอพัก</option>
                      <option value="ครูประจำหอพัก">4. ครูประจำหอพัก</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">หอพักที่รับผิดชอบหลัก</label>
                    <select
                      value={formData.dormId}
                      onChange={(e) => {
                        const dId = e.target.value;
                        let updatedAllowed = formData.allowedDormIds;
                        if (dId && !updatedAllowed.includes(dId)) {
                          updatedAllowed = [...updatedAllowed, dId];
                        }
                        setFormData({ ...formData, dormId: dId, allowedDormIds: updatedAllowed });
                      }}
                      className="w-full bg-gray-50 border border-gray-300 text-xs text-gray-800 rounded-xl px-3 py-2 outline-none font-bold"
                    >
                      <option value="">-- ยังไม่กำหนดหอพัก --</option>
                      {dorms.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Multi-Dorm Access Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#A05AFF]" />
                  <span>สิทธิ์การเช็ครายชื่อนักเรียนในหอพัก ( Allowed Dormitories )</span>
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  กำหนดหอพักที่ผู้ใช้ท่านนี้มีสิทธิ์เลือกเช็คยอดนักเรียนได้ในระบบ
                </p>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <label className="flex items-center gap-2 pb-2 border-b border-gray-200 text-xs font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dorms.length > 0 && formData.allowedDormIds.length === dorms.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, allowedDormIds: dorms.map((d) => d.id) });
                        } else {
                          setFormData({ ...formData, allowedDormIds: [] });
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>อนุญาตให้เช็คยอดได้ทุกหอพัก ( All Dormitories )</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {dorms.map((d) => {
                      const isChecked = formData.allowedDormIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-purple-100 border-purple-300 text-purple-900"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let updated: string[];
                              if (e.target.checked) {
                                updated = [...formData.allowedDormIds, d.id];
                              } else {
                                updated = formData.allowedDormIds.filter((id) => id !== d.id);
                              }
                              setFormData({ ...formData, allowedDormIds: updated });
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Avatar Selector with Local File Upload */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span>เลือกรูปไอคอนประจำตัว (Avatar):</span>
                  <span className="text-[11px] text-[#A05AFF] font-bold">เลือกสำเร็จ</span>
                </label>

                {/* Preview & URL */}
                <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <img
                    src={formData.avatarUrl || PRESET_AVATARS[0]}
                    alt="Current Avatar"
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#A05AFF]/30 border-2 border-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800">ตัวอย่างไอคอนที่เลือก</div>
                    <input
                      type="url"
                      value={formData.avatarUrl}
                      onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                      placeholder="หรือวาง URL รูปภาพ..."
                      className="w-full mt-1 bg-white border border-slate-300 text-[11px] text-slate-700 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#A05AFF] outline-none"
                    />
                  </div>
                </div>

                {/* Upload image file from user's device */}
                <div className="p-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 rounded-xl border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CloudUpload className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-800 truncate">เลือกรูปตัวอย่างไอคอนจากเครื่องตัวเอง</div>
                        <div className="text-[9.5px] text-slate-500 truncate">อัปโหลดไปยัง Google Drive โฟลเดอร์เป้าหมายให้อัตโนมัติเมื่อกดบันทึก</div>
                      </div>
                    </div>

                    <label className={`px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10.5px] font-bold rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1 ${isUploadingDrive ? "opacity-60 pointer-events-none" : ""}`}>
                      {isUploadingDrive ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>กำลังอัปโหลด...</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-3 h-3" />
                          <span>เลือกรูปจากเครื่อง...</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLocalFileSelect(e, "MODAL")}
                        disabled={isUploadingDrive}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Selected File Badge */}
                  {modalSelectedFile && (
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-blue-200 text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <span className="font-semibold text-slate-700 truncate">รูปที่เลือก: {modalSelectedFile.name}</span>
                        <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md font-bold shrink-0">
                          (อัปโหลดลง Drive เมื่อบันทึก)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => clearSelectedFile("MODAL")}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded-md transition-colors cursor-pointer shrink-0"
                        title="ยกเลิกไฟล์ที่เลือก"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Google Drive Folder Link */}
                  <div className="pt-1.5 border-t border-indigo-100 flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1 text-indigo-900 font-medium truncate">
                      <Globe className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span className="truncate">โฟลเดอร์สำหรับเก็บรูปภาพบน Google Drive:</span>
                    </div>
                    <a
                      href={GOOGLE_DRIVE_AVATAR_FOLDER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors shrink-0"
                    >
                      <span>เปิด Google Drive ↗</span>
                    </a>
                  </div>
                </div>

                {/* Vector Preset Grid */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      เลือกไอคอนสัญลักษณ์ตัวอย่าง:
                    </label>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    {PRESET_AVATARS.map((url, idx) => {
                      const meta = PRESET_AVATARS_META[idx] || { roleName: "ไอคอน", badgeColor: "" };
                      const isSelected = formData.avatarUrl === url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, avatarUrl: url })}
                          className={`rounded-xl p-1 flex items-center justify-center border-2 cursor-pointer transition-all hover:scale-105 ${
                            isSelected
                              ? "border-[#A05AFF] ring-2 ring-[#A05AFF]/40 scale-105 bg-purple-50 shadow-xs"
                              : "border-slate-200 bg-white"
                          }`}
                          title={meta.roleName}
                        >
                          <img src={url} alt={`Preset ${idx + 1}`} className="w-9 h-9 object-cover rounded-full" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#A05AFF] hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Authentication Confirmation Modal for DB & Attendance Actions */}
      {dbAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-purple-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#A05AFF] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  ยืนยันรหัสผ่านเพื่อดำเนินการ (Password Required)
                </h3>
                <p className="text-xs text-purple-700 font-bold mt-0.5">
                  {dbAuthAction === "EXPORT" && "การสำรองข้อมูลระบบ (Export Backup)"}
                  {dbAuthAction === "IMPORT" && "การกู้คืนฐานข้อมูล (Restore Import)"}
                  {dbAuthAction === "CLEAR" && "การล้างฐานข้อมูลระบบทั้งหมด (Clear DB)"}
                  {dbAuthAction === "CLEAR_ATTENDANCE_DATE" && `ล้างข้อมูลเช็คยอด ประจำวันที่ ${clearDate}`}
                  {dbAuthAction === "CLEAR_ATTENDANCE_ALL" && "ล้างข้อมูลเช็คยอดทั้งหมด (ทุกวันย้อนหลัง)"}
                  {dbAuthAction === "CLEAR_STUDENTS_DORM" && "ลบรายชื่อนักเรียนในหอพัก"}
                  {dbAuthAction === "CLEAR_STUDENTS_ALL" && "ลบรายชื่อนักเรียนทุกหอพัก"}
                  {dbAuthAction === "DELETE_USER" && `ลบบัญชีผู้ใช้ "${targetUserToDelete?.name}"`}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {dbAuthAction === "DELETE_USER"
                ? `คุณกำลังจะลบบัญชีผู้ใช้ "${targetUserToDelete?.name}" ออกจากระบบ กรุณากรอกรหัสผ่านผู้ดูแลระบบเพื่อยืนยันการลบ`
                : "กรุณากรอกรหัสผ่านของ เจ้าหน้าที่ หรือ ผู้ดูแลระบบ เพื่อยืนยันความปลอดภัยก่อนดำเนินการ"}
            </p>

            <form onSubmit={handleVerifyAdminPassAndExecute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  กรอกรหัสผ่านยืนยัน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminAuthPassword}
                    onChange={(e) => {
                      setAdminAuthPassword(e.target.value);
                      setAdminAuthError("");
                    }}
                    placeholder="ป้อนรหัสผ่านเจ้าหน้าที่ / ผู้ดูแล..."
                    className="w-full bg-purple-50/50 border border-purple-300 text-sm font-bold text-gray-900 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#A05AFF]"
                    autoFocus
                    required
                  />
                  <Lock className="w-4 h-4 text-purple-400 absolute right-3 top-3" />
                </div>
                {adminAuthError && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{adminAuthError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setDbAuthModalOpen(false);
                    setPendingImportJson(null);
                    setTargetUserToDelete(null);
                    setAdminAuthPassword("");
                    setAdminAuthError("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#A05AFF] to-[#1BCFB4] text-white font-black text-xs rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>ยืนยันข้อมูล & ดำเนินการ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Firebase Config Guide & Project ID Modal */}
      {isFirebaseConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-indigo-500/30 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    คู่มือการใช้งานระบบร่วมกับ Firebase Project ID / บัญชีอื่น
                  </h3>
                  <p className="text-xs text-amber-300 font-medium">
                    Student Counting System — Firebase Database Management
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFirebaseConfigModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-indigo-950/60 p-4 rounded-xl border border-indigo-500/30 space-y-2">
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>1. สถานะการเชื่อมต่อปัจจุบัน (Current Connected Firebase Project)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 block">Project ID:</span>
                    <span className="font-mono text-amber-200 font-bold">gen-lang-client-0460310471</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 block">Project Name:</span>
                    <span className="font-mono text-emerald-300 font-bold">Student Counting System</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 block">Primary Account Email:</span>
                    <span className="font-mono text-indigo-200 font-bold">domitory@pcccr.ac.th</span>
                  </div>
                  <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-slate-400 block">Default Password:</span>
                    <span className="font-mono text-amber-300 font-bold">Tasawan*</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-white text-sm">2. การย้ายระบบไปใช้กับ Firebase Project ID อื่น</div>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
                  <li>
                    สร้างโปรเจกต์ใหม่ที่ <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">Firebase Console</a> ตั้งชื่อว่า <strong className="text-amber-200">Student Counting System</strong>
                  </li>
                  <li>เปิดใช้งาน <strong>Cloud Firestore Database</strong> ในโหมด Production หรือ Test Mode</li>
                  <li>
                    กดปุ่ม <strong className="text-amber-300">"สร้าง & ติดตั้งโครงสร้างข้อมูลเริ่มต้นบน Firebase"</strong> ในหน้านี้ ระบบจะสร้าง Collections, 6 หอพัก และบัญชีตั้งต้นให้โดยอัตโนมัติ
                  </li>
                  <li>
                    หากมีไฟล์สำรองเดิม สามารถใช้ฟังก์ชัน <strong className="text-cyan-300">"กู้คืนฐานข้อมูล (Restore Import)"</strong> เพื่อนำเข้าข้อมูลทั้งหมดเข้าสู่ Firebase Firestore โปรเจกต์ใหม่ได้ทันที
                  </li>
                </ol>
              </div>

              <div className="bg-black/60 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">โครงสร้างคอลเลกชันใน Firestore (Firestore Collection Reference)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`dorms
students
users
notices
attendance
_system_status`);
                      setCopiedConfigField("schema");
                      setTimeout(() => setCopiedConfigField(null), 2000);
                    }}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    {copiedConfigField === "schema" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedConfigField === "schema" ? "คัดลอกแล้ว!" : "คัดลอก"}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-white/5 overflow-x-auto">
{`Collections:
- dorms/          [ข้อมูลหอพัก 1 ถึง 6]
- students/       [ข้อมูลนักเรียนหอพัก]
- users/          [ผู้ใช้/ผู้ดูแล/เจ้าหน้าที่/ครูหอพัก]
- notices/        [ข้อความแจ้งเรื่องที่อบรม]
- attendance/     [ประวัติการเช็คยอดประจำวัน]
- _system_status/ [การตั้งค่าสถานะเริ่มต้นระบบ]`}</pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsFirebaseConfigModalOpen(false)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                รับทราบ และ ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Export & Repository Modal */}
      {isGithubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-700 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 border border-slate-600">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    ขั้นตอนการนำโครงการระบบเช็คยอดนักเรียนหอพักขึ้น GitHub
                  </h3>
                  <p className="text-xs text-amber-300 font-medium">
                    Exporting & Publishing Source Code to GitHub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGithubModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>วิธีแก้ปัญหา "หน้าขาว (Blank Screen)" เมื่อเปิดเว็บบน GitHub Pages</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  สาเหตุที่หน้าแรกไม่แสดงผลบน GitHub Pages เกิดจาก Path ของไฟล์ JS/CSS ไม่ตรงกับ Subpath ของ Repository และต้องเลือก Source ใน Settings ของ GitHub<br />
                  <strong className="text-amber-300">✓ 1. ระบบได้ตั้งค่า <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-300">base: './'</code> ใน <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-300">vite.config.ts</code> และเพิ่มไฟล์ <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">public/404.html</code>, <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">.nojekyll</code>, และ <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">package-lock.json</code> ให้เรียบร้อยแล้ว</strong><br />
                  <strong className="text-emerald-300">✓ 2. ปรับแต่งไฟล์ <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">.github/workflows/deploy.yml</code> เป็น Node 22 และใช้ <code className="bg-black/50 px-1 py-0.5 rounded text-white">npm install</code> แล้ว</strong><br />
                  <strong className="text-amber-200">⚙️ 3. ขั้นตอนสำคัญบน GitHub:</strong> เข้าไปที่หน้า Repository บน GitHub -&gt; เลือกเมนู <strong className="text-white">Settings -&gt; Pages</strong> -&gt; ในส่วน <strong className="text-white">Source</strong> ให้เปลี่ยนเป็น <strong className="text-amber-300">"GitHub Actions"</strong> จากนั้นเมื่อ Push โค้ดขึ้นไป GitHub Actions จะทำการ Build และ Deploy หน้าเว็บให้อัตโนมัติโดยไม่มีข้อผิดพลาด!
                </p>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>วิธีที่ 1: ใช้ฟังก์ชัน Export บน AI Studio (แนะนำวิธีที่ง่ายที่สุด)</span>
                </div>
                <p className="text-slate-300">
                  คลิกที่เมนู <strong className="text-white bg-slate-700 px-2 py-0.5 rounded">Settings / Export</strong> ตรงมุมบนหรือเมนูตั้งค่าของระบบ AI Studio แล้วเลือก <strong className="text-amber-300">"Export to GitHub"</strong> ระบบจะสร้าง Repository บนบัญชี GitHub ของคุณโดยอัตโนมัติ
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-white text-sm">วิธีที่ 2: ดาวน์โหลดไฟล์ ZIP และ Push ขึ้น GitHub ผ่าน Terminal</div>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
                  <li>ดาวน์โหลดไฟล์โครงการเป็น ZIP แล้วแตกไฟล์ลงบนคอมพิวเตอร์ของคุณ</li>
                  <li>
                    เปิดเว็บไซต์ <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">GitHub Create New Repository</a> และสร้าง Repository ใหม่
                  </li>
                  <li>เปิด Terminal หรือ Command Prompt ในโฟลเดอร์โครงการ แล้วพิมพ์คำสั่งดังนี้:</li>
                </ol>
              </div>

              <div className="bg-black/70 p-4 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">คำสั่ง Git Terminal (Command Line)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`);
                      showNotification("success", "คัดลอกคำสั่ง Git เรียบร้อยแล้ว");
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>คัดลอกคำสั่งทั้งหมด</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950 p-3 rounded-lg border border-white/5 overflow-x-auto leading-relaxed">
{`git init
git add .
git commit -m "Initial commit - Student Counting System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main`}</pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsGithubModalOpen(false)}
                className="px-5 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                เข้าใจแล้ว และ ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
