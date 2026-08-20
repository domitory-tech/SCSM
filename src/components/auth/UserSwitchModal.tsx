import React from "react";
import { UserProfile } from "../../types";
import { DEMO_USERS } from "../../data/userProfiles";
import { Check, Shield, UserCheck, X } from "lucide-react";

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100">
        <div className="p-5 bg-gradient-to-r from-purple-600 to-pink-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">สลับผู้ใช้งาน (Switch User Role)</h3>
              <p className="text-xs text-purple-100">ทดสอบการเข้าถึงข้อมูลตามสิทธิ์ของแต่ละฝ่าย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {DEMO_USERS.map((u) => {
            const isSelected = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser(u);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-pink-500 bg-pink-50/50 shadow-sm ring-2 ring-pink-500/20"
                    : "border-gray-200 hover:border-pink-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-purple-200"
                  />
                  <div>
                    <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <span>{u.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold bg-pink-600 text-white px-2 py-0.5 rounded-full">
                          ใช้งานอยู่
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{u.roleLabel}</div>
                  </div>
                </div>
                {isSelected && <Check className="w-5 h-5 text-pink-600 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
