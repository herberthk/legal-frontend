"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Shield, ShieldOff, Ban, UserCheck, Edit2, Trash2,
  RotateCcw, DollarSign, Zap, Mic, FileText, MessageSquare,
  Activity, TrendingUp, Phone, Mail, Calendar, Key,
  CheckCircle2, XCircle, RefreshCw, AlertTriangle,
} from "lucide-react";
import { toggleUserStatus, softDeleteUser, restoreUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/admin/ConfirmActionModal";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import type { AdminUserDetails } from "@/lib/actions/admin";
import UserModal from "@/components/admin/UserModal";
import UsageCharts from "@/components/admin/user-detail/UsageCharts";
import TransactionsTab from "@/components/admin/user-detail/TransactionsTab";
import TicketsTab from "@/components/admin/user-detail/TicketsTab";

// ─── Small shared helpers ────────────────────────────────────────────────────

function InfoChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-slate-600 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-300">{value}</p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

function StatusBadgeLarge({ status, isDeleted }: { status: User["status"]; isDeleted?: boolean }) {
  if (isDeleted) return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600"><Trash2 size={12} /> Deleted</span>;
  if (status === "active") return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active</span>;
  if (status === "suspended") return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30"><ShieldOff size={12} /> Suspended</span>;
  return <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30"><Ban size={12} /> Banned</span>;
}

function Tab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${active ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/40 text-indigo-200" : "bg-slate-700 text-slate-400"}`}>{count}</span>
      )}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AdminUserDetailClient({ data: initialData }: { data: AdminUserDetails }) {
  const [data, setData] = useState(initialData);
  const { user, stats, recentTransactions, supportTickets, usageTimeSeries } = data;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"suspend" | "banned" | "softDelete" | null>(null);
  const [activeTab, setActiveTab] = useState<"transactions" | "tickets">("transactions");

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    await fn();
    setActionLoading(null);
  };

  const handleStatusChange = async (status: "active" | "suspended" | "banned") => {
    const res = await toggleUserStatus(user.id, status);
    if (!res.success) { toast.error(res.error ?? "Failed"); return; }
    toast.success(`User ${status}`);
    setData((d) => ({ ...d, user: { ...d.user, status } }));
  };

  const handleSoftDelete = async () => {
    const res = await softDeleteUser(user.id);
    if (!res.success) { toast.error(res.error ?? "Failed"); return; }
    toast.success("User soft-deleted");
    setData((d) => ({ ...d, user: { ...d.user, isDeleted: true, status: "suspended" } }));
  };

  const handleRestore = async () => {
    const res = await restoreUser(user.id);
    if (!res.success) { toast.error(res.error ?? "Failed"); return; }
    toast.success("User restored");
    setData((d) => ({ ...d, user: { ...d.user, isDeleted: false, status: "active" } }));
  };

  const balanceUsd = (user.balance ?? 0) / 100;
  const balanceUgx = Math.round(balanceUsd * USD_TO_UGX_EXCHANGE_RATE);
  const totalSpentUsd = (user.totalSpent ?? 0) / 100;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Back + Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Link href="/admin/users" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-1">
            <ArrowLeft size={16} /> Back to Users
          </Link>

          <div className="flex-1 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="relative shrink-0">
                <Image src={user.avatar} alt={user.name} width={72} height={72} className="rounded-2xl object-cover ring-2 ring-slate-700" />
                {user.role === "ADMIN" || user.role === "SUPER_ADMIN" && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <Shield size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-white">{user.name}</h1>
                  <StatusBadgeLarge status={user.status} isDeleted={user.isDeleted} />
                  {user.role === "ADMIN" || user.role === "SUPER_ADMIN" && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase">Admin</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
                  <InfoChip icon={Mail} label="Email" value={user.email} />
                  {user.phoneNumber && <InfoChip icon={Phone} label="Phone" value={user.phoneNumber} />}
                  {user.username && <InfoChip icon={Key} label="Username" value={`@${user.username}`} />}
                  <InfoChip icon={Calendar} label="Joined" value={new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })} />
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-2">UID: {user.id}</p>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-all">
                  <Edit2 size={13} /> Edit
                </button>
                {!user.isDeleted && (
                  <>
                    {user.status !== "active" && (
                      <button disabled={!!actionLoading} onClick={() => wrap("active", () => handleStatusChange("active"))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50">
                        {actionLoading === "active" ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={13} />} Activate
                      </button>
                    )}
                    {user.status !== "suspended" && (
                      <button disabled={!!actionLoading} onClick={() => setPendingAction("suspend")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-xs font-semibold text-amber-300 transition-all disabled:opacity-50">
                        {actionLoading === "suspend" ? <RefreshCw size={12} className="animate-spin" /> : <ShieldOff size={13} />} Suspend
                      </button>
                    )}
                    {user.status !== "banned" && (
                      <button disabled={!!actionLoading} onClick={() => setPendingAction("banned")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-xs font-semibold text-rose-300 transition-all disabled:opacity-50">
                        {actionLoading === "banned" ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={13} />} Ban
                      </button>
                    )}
                    <button disabled={!!actionLoading} onClick={() => setPendingAction("softDelete")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-rose-900/30 text-xs font-semibold text-slate-400 hover:text-rose-300 transition-all disabled:opacity-50">
                      {actionLoading === "softDelete" ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={13} />} Remove
                    </button>
                  </>
                )}
                {user.isDeleted && (
                  <button disabled={!!actionLoading} onClick={() => wrap("restore", handleRestore)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50">
                    {actionLoading === "restore" ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={13} />} Restore
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Balance + Resource Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-2 lg:col-span-1 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center"><DollarSign size={15} className="text-white" /></div>
              <p className="text-sm font-semibold text-slate-300">Wallet Balance</p>
            </div>
            <p className="text-3xl font-bold text-white">${balanceUsd.toFixed(2)}</p>
            <p className="text-sm text-slate-400 mt-1">UGX {balanceUgx.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="text-sm font-semibold text-rose-400 mt-0.5">${totalSpentUsd.toFixed(2)}</p>
            </div>
          </div>
          {[
            { Icon: Zap, bg: "bg-amber-600", label: "Welcome Tokens", val: (user.welcomeTextTokens ?? 0).toLocaleString(), sub: "one-time bonus remaining" },
            { Icon: Activity, bg: "bg-blue-600", label: "Daily Tokens", val: (user.freeTextTokens ?? 0).toLocaleString(), sub: "daily free allocation" },
            { Icon: Mic, bg: "bg-purple-600", label: "Voice Credits", val: `${Math.floor((user.freeVoiceSeconds ?? 0) / 60)}m ${(user.freeVoiceSeconds ?? 0) % 60}s`, sub: "voice time remaining" },
          ].map(({ Icon, bg, label, val, sub }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4"><div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}><Icon size={15} className="text-white" /></div><p className="text-sm font-semibold text-slate-300">{label}</p></div>
              <p className="text-3xl font-bold text-white">{val}</p>
              <p className="text-xs text-slate-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Consumption Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: MessageSquare, label: "Chat Sessions", value: stats.totalChatSessions.toLocaleString(), sub: "lifetime", color: "bg-blue-600" },
            { icon: Mic, label: "Voice Minutes", value: `${stats.totalVoiceMinutes}m`, sub: "total voice", color: "bg-purple-600" },
            { icon: FileText, label: "Transcriptions", value: stats.totalTranscriptions.toLocaleString(), sub: "documents", color: "bg-indigo-600" },
            { icon: AlertTriangle, label: "Doc Reviews", value: stats.totalDocumentReviews.toLocaleString(), sub: "AI reviews", color: "bg-cyan-600" },
            { icon: Zap, label: "Total Tokens", value: stats.totalTokensUsed > 1000 ? `${(stats.totalTokensUsed / 1000).toFixed(1)}k` : stats.totalTokensUsed.toString(), sub: "all time", color: "bg-amber-600" },
            { icon: TrendingUp, label: "Amount Spent", value: `$${(stats.totalAmountSpentCents / 100).toFixed(2)}`, sub: "realized cost", color: "bg-green-600" },
          ].map((s) => <StatTile key={s.label} {...s} />)}
        </div>

        {/* Admin Permissions */}
        {user.role === "ADMIN" || user.role === "SUPER_ADMIN" && user.permissions && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Admin Permissions</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "canManageUsers", label: "Manage Users" },
                { key: "canViewBilling", label: "View Billing" },
                { key: "canManageSystemStats", label: "System Stats" },
                { key: "canManageSupport", label: "Manage Support" },
              ].map(({ key, label }) => {
                const granted = user.permissions?.[key as keyof typeof user.permissions];
                return (
                  <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${granted ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-slate-700/40 border-slate-700 text-slate-500"}`}>
                    {granted ? <CheckCircle2 size={13} className="text-indigo-400" /> : <XCircle size={13} />}
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Usage Chart */}
        <UsageCharts usageTimeSeries={usageTimeSeries} />

        {/* Tabbed Activity */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-700/60">
            <Tab label="Transactions" active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} count={recentTransactions.length} />
            <Tab label="Support Tickets" active={activeTab === "tickets"} onClick={() => setActiveTab("tickets")} count={supportTickets.length} />
          </div>
          <div className="p-4">
            <AnimatePresence mode="wait">
              {activeTab === "transactions"
                ? <TransactionsTab transactions={recentTransactions} />
                : <TicketsTab tickets={supportTickets} />
              }
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={(updatedUser) => { setEditModalOpen(false); setData((d) => ({ ...d, user: { ...d.user, ...updatedUser } })); toast.success("Profile updated"); }}
        editUser={user}
      />
      <ConfirmActionModal open={pendingAction === "suspend"} onClose={() => setPendingAction(null)} onConfirm={async () => { await wrap("suspend", () => handleStatusChange("suspended")); setPendingAction(null); }} title="Suspend User" description={<>Are you sure you want to suspend <strong className="text-white">{user.name}</strong>? This will immediately disable their login access until you reactivate them.</>} confirmText="Suspend User" confirmStyle="warning" icon={ShieldOff} />
      <ConfirmActionModal open={pendingAction === "banned"} onClose={() => setPendingAction(null)} onConfirm={async () => { await wrap("banned", () => handleStatusChange("banned")); setPendingAction(null); }} title="Ban User" description={<>Are you sure you want to ban <strong className="text-white">{user.name}</strong>? They will be entirely locked out of the platform.</>} confirmText="Ban User" confirmStyle="danger" icon={Ban} />
      <ConfirmActionModal open={pendingAction === "softDelete"} onClose={() => setPendingAction(null)} onConfirm={async () => { await wrap("softDelete", handleSoftDelete); setPendingAction(null); }} title="Move to Trash" description={<>Are you sure you want to remove <strong className="text-white">{user.name}</strong>? Their account will be moved to the Trash and they will lose all access.</>} confirmText="Remove to Trash" confirmStyle="danger" icon={Trash2} />
    </div>
  );
}
