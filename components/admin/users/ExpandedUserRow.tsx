"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Edit2, ShieldOff, Ban, Trash2, ExternalLink,
  RotateCcw, Flame, RefreshCw, UserCheck,
  DollarSign, Zap, Activity, Mic,
} from "lucide-react";
import ConfirmActionModal from "@/components/admin/ConfirmActionModal";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { CustomLink } from "@/components/global/transitions";

interface ExpandedUserRowProps {
  user: User;
  onEdit: () => void;
  onStatusChange: (s: "active" | "suspended" | "banned") => Promise<void>;
  onSoftDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
  onPermanentDelete: () => Promise<void>;
  showingDeleted: boolean;
}

export default function ExpandedUserRow({
  user,
  onEdit,
  onStatusChange,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  showingDeleted,
}: ExpandedUserRowProps) {
  const [pendingAction, setPendingAction] = useState<"suspend" | "banned" | "softDelete" | "permDelete" | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    await fn();
    setActionLoading(null);
  };

  const balanceUsd = (user.balance ?? 0) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-0">
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              {
                label: "Wallet Balance",
                value: `$${balanceUsd.toFixed(2)}`,
                sub: `UGX ${Math.round((user.balance ?? 0) / 100 * USD_TO_UGX_EXCHANGE_RATE).toLocaleString()}`,
                icon: DollarSign,
                color: "text-green-400",
              },
              {
                label: "Welcome Tokens",
                value: (user.welcomeTextTokens ?? 0).toLocaleString(),
                sub: "one-time bonus",
                icon: Zap,
                color: "text-amber-400",
              },
              {
                label: "Daily Free Tokens",
                value: (user.freeTextTokens ?? 0).toLocaleString(),
                sub: "resets daily",
                icon: Activity,
                color: "text-blue-400",
              },
              {
                label: "Voice Credits",
                value: `${Math.floor((user.freeVoiceSeconds ?? 0) / 60)}m ${(user.freeVoiceSeconds ?? 0) % 60}s`,
                sub: "remaining",
                icon: Mic,
                color: "text-purple-400",
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-slate-900/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className={color} />
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
                <p className="text-sm font-bold text-white">{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Info Row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400 mb-5 pb-5 border-b border-slate-700/60">
            <span>UID: <span className="font-mono text-slate-300">{user.id}</span></span>
            {user.username && <span>@{user.username}</span>}
            {user.phoneNumber && <span>{user.phoneNumber}</span>}
            <span>Joined: {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
            {user.isDeleted && user.deletedAt && (
              <span className="text-rose-400">
                Deleted: {new Date(user.deletedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Actions */}
          {!showingDeleted ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-all"
              >
                <Edit2 size={13} /> Edit Profile
              </button>

              {user.status !== "active" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => wrap("active", () => onStatusChange("active"))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "active" ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={13} />}{" "}
                  Activate
                </button>
              )}
              {user.status !== "suspended" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => setPendingAction("suspend")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-xs font-semibold text-amber-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "suspend" ? <RefreshCw size={12} className="animate-spin" /> : <ShieldOff size={13} />}{" "}
                  Suspend
                </button>
              )}
              {user.status !== "banned" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => setPendingAction("banned")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-xs font-semibold text-rose-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "banned" ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={13} />}{" "}
                  Ban
                </button>
              )}

              <button
                disabled={!!actionLoading}
                onClick={() => setPendingAction("softDelete")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-900/40 text-xs font-semibold text-slate-400 hover:text-rose-300 transition-all disabled:opacity-50 ml-auto"
              >
                {actionLoading === "softDelete" ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={13} />}{" "}
                Remove
              </button>

              <CustomLink
                href={`/admin/users/${user.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-xs font-semibold text-indigo-300 transition-all"
              >
                <ExternalLink size={13} /> Full Analytics
              </CustomLink>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={!!actionLoading}
                onClick={() => wrap("restore", onRestore)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
              >
                {actionLoading === "restore" ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={13} />}
                Restore Account
              </button>
              <button
                onClick={() => setPendingAction("permDelete")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 text-xs font-semibold text-rose-400 transition-all"
              >
                <Flame size={13} /> Permanently Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modals */}
      <ConfirmActionModal
        open={pendingAction === "suspend"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => { await wrap("suspend", () => onStatusChange("suspended")); setPendingAction(null); }}
        title="Suspend User"
        description={<>Are you sure you want to suspend <strong className="text-white">{user.name}</strong>? This will immediately disable their login access until you reactivate them.</>}
        confirmText="Suspend User"
        confirmStyle="warning"
        icon={ShieldOff}
      />
      <ConfirmActionModal
        open={pendingAction === "banned"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => { await wrap("banned", () => onStatusChange("banned")); setPendingAction(null); }}
        title="Ban User"
        description={<>Are you sure you want to ban <strong className="text-white">{user.name}</strong>? They will be entirely locked out of the platform.</>}
        confirmText="Ban User"
        confirmStyle="danger"
        icon={Ban}
      />
      <ConfirmActionModal
        open={pendingAction === "softDelete"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => { await wrap("softDelete", onSoftDelete); setPendingAction(null); }}
        title="Move to Trash"
        description={<>Are you sure you want to remove <strong className="text-white">{user.name}</strong>? Their account will be moved to the Trash and they will lose all access.</>}
        confirmText="Remove to Trash"
        confirmStyle="danger"
        icon={Trash2}
      />
      <ConfirmActionModal
        open={pendingAction === "permDelete"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => { await wrap("permDelete", onPermanentDelete); setPendingAction(null); }}
        title="Permanently Delete User"
        description={<>Are you absolutely sure you want to permanently delete <strong className="text-white">{user.name}</strong>? This action <strong className="text-rose-400">cannot be undone</strong>. All their data will be destroyed.</>}
        confirmText="Permanently Delete"
        confirmStyle="danger"
        icon={Flame}
      />
    </motion.div>
  );
}
