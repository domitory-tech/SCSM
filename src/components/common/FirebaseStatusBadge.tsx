import React, { useEffect, useState } from "react";
import { Database, CheckCircle2, AlertCircle, RefreshCw, Layers, Wifi, Server } from "lucide-react";
import { checkFirebaseConnection, FIREBASE_PROJECT_INFO, FirebaseConnectionStatus } from "../../lib/firebase";

interface FirebaseStatusProps {
  compact?: boolean;
  variant?: "compact" | "sidebar" | "full";
  lastDbSaveTime?: string;
}

export const FirebaseStatusBadge: React.FC<FirebaseStatusProps> = ({
  compact = false,
  variant,
  lastDbSaveTime
}) => {
  const activeVariant = variant || (compact ? "compact" : "full");

  const [status, setStatus] = useState<FirebaseConnectionStatus>({
    isConnected: false,
    lastChecked: null,
    error: null,
    latencyMs: null
  });
  const [loading, setLoading] = useState(false);

  const verifyConnection = async () => {
    setLoading(true);
    const res = await checkFirebaseConnection();
    setStatus(res);
    setLoading(false);
  };

  useEffect(() => {
    verifyConnection();
    const interval = setInterval(verifyConnection, 60000); // Check every 60s
    return () => clearInterval(interval);
  }, []);

  if (activeVariant === "compact") {
    return (
      <div
        onClick={verifyConnection}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
          status.isConnected
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100/80"
            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
        }`}
        title={`โปรเจกต์: ${FIREBASE_PROJECT_INFO.projectName} | บัญชี: ${FIREBASE_PROJECT_INFO.userEmail} | คลิกเพื่อทดสอบการเชื่อมต่อ`}
      >
        <span className="relative flex h-2 w-2">
          {status.isConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              status.isConnected ? "bg-emerald-500" : "bg-amber-500"
            }`}
          ></span>
        </span>
        <span className="truncate max-w-[140px] sm:max-w-none">
          Firebase: {status.isConnected ? "เชื่อมต่อแล้ว" : "กำลังตรวจสอบ..."}
        </span>
        {status.latencyMs && (
          <span className="text-[10px] opacity-75 font-mono">({status.latencyMs}ms)</span>
        )}
        <RefreshCw className={`w-3 h-3 ml-0.5 ${loading ? "animate-spin text-emerald-600" : "opacity-50"}`} />
      </div>
    );
  }

  if (activeVariant === "sidebar") {
    return (
      <div className="p-3.5 mx-3 my-2 bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-2xl space-y-2 border border-indigo-500/30 shadow-md relative overflow-hidden text-xs font-bold">
        {/* Line 1: Header */}
        <div className="flex items-center gap-1.5 text-amber-300 border-b border-white/10 pb-1.5">
          <Database className="w-4 h-4 text-amber-400 shrink-0" />
          <span>สถานะเชื่อมต่อฐานข้อมูล</span>
        </div>

        {/* Line 2: Connection status */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-extrabold">
            <span
              className={`w-2 h-2 rounded-full ${
                status.isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"
              }`}
            />
            <span>{status.isConnected ? "Firebase เชื่อมต่อแล้ว" : "Firebase กำลังเชื่อมต่อ..."}</span>
          </div>
          <button
            onClick={verifyConnection}
            disabled={loading}
            className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded-md border border-white/10"
            title="รีเฟรชการเชื่อมต่อ"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin" : ""}`} />
            <span>เช็ค</span>
          </button>
        </div>

        {/* Line 3: Main database */}
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="flex items-center gap-1 text-slate-400">
            <Server className="w-3 h-3 text-amber-400 shrink-0" />
            <span>ฐานข้อมูลหลัก :</span>
          </span>
          <span className="font-extrabold text-amber-200 truncate" title={FIREBASE_PROJECT_INFO.projectName}>
            Firebase
          </span>
        </div>

        {/* Line 4: Connection speed */}
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="flex items-center gap-1 text-slate-400">
            <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>ความเร็วการเชื่อต่อ :</span>
          </span>
          <span className="font-mono text-[10px] font-bold text-emerald-300">
            {status.latencyMs ? `${status.latencyMs} ms` : "กำลังวัด..."}
          </span>
        </div>

        {/* Line 5: Last updated */}
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <div className="text-[10px] font-bold text-slate-400">
            อัปเดตข้อมูลล่าสุด
          </div>
          <div className="font-mono text-[10px] font-bold text-emerald-200 bg-black/40 px-2 py-1 rounded-lg border border-white/10 truncate">
            {lastDbSaveTime || status.lastChecked || "เปิดใช้งานแล้ว"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-500/30 shadow-lg relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl ring-1 ring-amber-500/30 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-base text-white">{FIREBASE_PROJECT_INFO.projectName}</h4>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-400/30">
                Primary Database (Firebase)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
              <span>บัญชีผู้ใช้: <strong className="text-amber-200">{FIREBASE_PROJECT_INFO.userEmail}</strong></span>
              <span className="text-slate-500">•</span>
              <span>Project ID: <span className="font-mono text-slate-300">{FIREBASE_PROJECT_INFO.projectId}</span></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {status.isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">Firebase: เชื่อมต่อแล้ว (Online)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">ตรวจสอบสถานะ...</span>
                </>
              )}
            </div>
            {status.lastChecked && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                เช็กล่าสุด: {status.lastChecked} {status.latencyMs && `(${status.latencyMs} ms)`}
              </p>
            )}
          </div>

          <button
            onClick={verifyConnection}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            title="ทดสอบการเชื่อมต่อ Firebase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">ทดสอบ</span>
          </button>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-slate-400 block text-[10px]">Database Name</span>
          <span className="font-semibold text-amber-200 truncate block">Firestore DB</span>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-slate-400 block text-[10px]">Database ID</span>
          <span className="font-semibold text-slate-200 truncate block font-mono text-[10px]">
            {FIREBASE_PROJECT_INFO.databaseId}
          </span>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-slate-400 block text-[10px]">Auth Domain</span>
          <span className="font-semibold text-slate-200 truncate block text-[10px]">
            {FIREBASE_PROJECT_INFO.authDomain}
          </span>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-slate-400 block text-[10px]">Extension / Sync</span>
          <span className="font-semibold text-emerald-300 truncate block flex items-center gap-1">
            <Layers className="w-3 h-3" /> Active Sync
          </span>
        </div>
      </div>
    </div>
  );
};
