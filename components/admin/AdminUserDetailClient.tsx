"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Shield, ShieldOff, Ban, UserCheck, Edit2, Trash2,
  RotateCcw, DollarSign, Zap, Mic, FileText, MessageSquare,
  Activity, Clock, CreditCard, AlertTriangle, CheckCircle2,
  XCircle, HelpCircle, RefreshCw,
  TrendingUp, Phone, Mail, Calendar, Key,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toggleUserStatus, softDeleteUser, restoreUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import type { AdminUserDetails } from "@/lib/actions/admin";
import UserModal from "@/components/admin/UserModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoChip({ icon: Icon, label, value, color = "text-slate-400" }: {
  icon: React.ElementType; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-slate-600 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
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
  if (isDeleted)
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
        <Trash2 size={12} /> Deleted
      </span>
    );
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
      </span>
    );
  if (status === "suspended")
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <ShieldOff size={12} /> Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
      <Ban size={12} /> Banned
    </span>
  );
}

function TransactionMethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; class: string }> = {
    STRIPE: { label: "Stripe", class: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
    MTN: { label: "MTN", class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    AIRTEL: { label: "Airtel", class: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const m = map[method] ?? { label: method, class: "bg-slate-700 text-slate-400 border-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${m.class}`}>
      {m.label}
    </span>
  );
}

function ComplaintStatusBadge({ status }: { status: string }) {
  if (status === "OPEN") return <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2 py-0.5 rounded">Open</span>;
  if (status === "IN_PROGRESS") return <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">In Progress</span>;
  if (status === "RESOLVED") return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded">Resolved</span>;
  return <span className="text-[10px] font-bold text-slate-400 bg-slate-700 border border-slate-600 px-2 py-0.5 rounded">{status}</span>;
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="font-bold text-white mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((item: any) => (
        <div key={item.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: item.stroke }} />
          <span className="text-slate-400">{item.name}:</span>
          <span className="font-semibold text-white">
            {item.name === "Cost" ? `$${Number(item.value).toFixed(4)}` : item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tab Component ─────────────────────────────────────────────────────────────

function Tab({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
        active
          ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40"
          : "text-slate-500 hover:text-slate-300 border border-transparent"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/40 text-indigo-200" : "bg-slate-700 text-slate-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main Client Component ─────────────────────────────────────────────────────

interface Props {
  data: AdminUserDetails;
}

export default function AdminUserDetailClient({ data: initialData }: Props) {
  const [data, setData] = useState(initialData);
  const { user, stats, recentTransactions, supportTickets, usageTimeSeries } = data;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  // Chart data — format date labels
  const chartData = usageTimeSeries.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ─── Back + Header ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-1"
          >
            <ArrowLeft size={16} /> Back to Users
          </Link>

          {/* Identity card */}
          <div className="flex-1 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="relative shrink-0">
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={72}
                  height={72}
                  className="rounded-2xl object-cover ring-2 ring-slate-700"
                />
                {user.role === "ADMIN" && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <Shield size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-white">{user.name}</h1>
                  <StatusBadgeLarge status={user.status} isDeleted={user.isDeleted} />
                  {user.role === "ADMIN" && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase">
                      Admin
                    </span>
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

              {/* Quick actions */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-all"
                >
                  <Edit2 size={13} /> Edit
                </button>
                {!user.isDeleted && (
                  <>
                    {user.status !== "active" && (
                      <button
                        disabled={!!actionLoading}
                        onClick={() => wrap("active", () => handleStatusChange("active"))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
                      >
                        {actionLoading === "active" ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={13} />}
                        Activate
                      </button>
                    )}
                    {user.status !== "suspended" && (
                      <button
                        disabled={!!actionLoading}
                        onClick={() => wrap("suspended", () => handleStatusChange("suspended"))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-xs font-semibold text-amber-300 transition-all disabled:opacity-50"
                      >
                        {actionLoading === "suspended" ? <RefreshCw size={12} className="animate-spin" /> : <ShieldOff size={13} />}
                        Suspend
                      </button>
                    )}
                    {user.status !== "banned" && (
                      <button
                        disabled={!!actionLoading}
                        onClick={() => wrap("banned", () => handleStatusChange("banned"))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-xs font-semibold text-rose-300 transition-all disabled:opacity-50"
                      >
                        {actionLoading === "banned" ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={13} />}
                        Ban
                      </button>
                    )}
                    <button
                      disabled={!!actionLoading}
                      onClick={() => wrap("softDelete", handleSoftDelete)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-rose-900/30 text-xs font-semibold text-slate-400 hover:text-rose-300 transition-all disabled:opacity-50"
                    >
                      {actionLoading === "softDelete" ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={13} />}
                      Remove
                    </button>
                  </>
                )}
                {user.isDeleted && (
                  <button
                    disabled={!!actionLoading}
                    onClick={() => wrap("restore", handleRestore)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
                  >
                    {actionLoading === "restore" ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restore
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Balance + Resource Grid ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Balance */}
          <div className="col-span-2 lg:col-span-1 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                <DollarSign size={15} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Wallet Balance</p>
            </div>
            <p className="text-3xl font-bold text-white">${balanceUsd.toFixed(2)}</p>
            <p className="text-sm text-slate-400 mt-1">UGX {balanceUgx.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="text-sm font-semibold text-rose-400 mt-0.5">${totalSpentUsd.toFixed(2)}</p>
            </div>
          </div>

          {/* Resource Limits */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                <Zap size={15} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Welcome Tokens</p>
            </div>
            <p className="text-3xl font-bold text-white">{(user.welcomeTextTokens ?? 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">one-time bonus remaining</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Activity size={15} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Daily Tokens</p>
            </div>
            <p className="text-3xl font-bold text-white">{(user.freeTextTokens ?? 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">daily free allocation</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Mic size={15} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Voice Credits</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {Math.floor((user.freeVoiceSeconds ?? 0) / 60)}m {(user.freeVoiceSeconds ?? 0) % 60}s
            </p>
            <p className="text-xs text-slate-500 mt-1">voice time remaining</p>
          </div>
        </div>

        {/* ─── Consumption Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: MessageSquare, label: "Chat Sessions", value: stats.totalChatSessions.toLocaleString(), sub: "lifetime", color: "bg-blue-600" },
            { icon: Mic, label: "Voice Minutes", value: `${stats.totalVoiceMinutes}m`, sub: "total voice", color: "bg-purple-600" },
            { icon: FileText, label: "Transcriptions", value: stats.totalTranscriptions.toLocaleString(), sub: "documents", color: "bg-indigo-600" },
            { icon: AlertTriangle, label: "Doc Reviews", value: stats.totalDocumentReviews.toLocaleString(), sub: "AI reviews", color: "bg-cyan-600" },
            { icon: Zap, label: "Total Tokens", value: stats.totalTokensUsed > 1000 ? `${(stats.totalTokensUsed / 1000).toFixed(1)}k` : stats.totalTokensUsed.toString(), sub: "all time", color: "bg-amber-600" },
            { icon: TrendingUp, label: "Amount Spent", value: `$${(stats.totalAmountSpentCents / 100).toFixed(2)}`, sub: "realized cost", color: "bg-green-600" },
          ].map((s) => (
            <StatTile key={s.label} {...s} />
          ))}
        </div>

        {/* ─── Permissions (if admin) ───────────────────────────────────── */}
        {user.role === "ADMIN" && user.permissions && (
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
                  <div
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                      granted
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                        : "bg-slate-700/40 border-slate-700 text-slate-500"
                    }`}
                  >
                    {granted ? <CheckCircle2 size={13} className="text-indigo-400" /> : <XCircle size={13} />}
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Usage Chart ──────────────────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={16} className="text-slate-400" />
            <h3 className="text-sm font-bold text-white">Usage — Last 30 Days</h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  {[
                    { id: "chat", color: "#3b82f6" },
                    { id: "trans", color: "#8b5cf6" },
                    { id: "cost", color: "#10b981" },
                  ].map(({ id, color }) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="chatTokens" name="Chat Tokens" stroke="#3b82f6" strokeWidth={2} fill="url(#chat)" />
                <Area type="monotone" dataKey="transcriptionTokens" name="Transcription" stroke="#8b5cf6" strokeWidth={2} fill="url(#trans)" />
                <Area type="monotone" dataKey="cost" name="Cost" stroke="#10b981" strokeWidth={2} fill="url(#cost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── Tabbed Activity ──────────────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center gap-2 p-4 border-b border-slate-700/60">
            <Tab
              label="Transactions"
              active={activeTab === "transactions"}
              onClick={() => setActiveTab("transactions")}
              count={recentTransactions.length}
            />
            <Tab
              label="Support Tickets"
              active={activeTab === "tickets"}
              onClick={() => setActiveTab("tickets")}
              count={supportTickets.length}
            />
          </div>

          {/* Tab Content */}
          <div className="p-4">
            <AnimatePresence mode="wait">
              {activeTab === "transactions" && (
                <motion.div
                  key="transactions"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-2"
                >
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <CreditCard size={36} className="mx-auto mb-3 text-slate-700" />
                      <p>No transactions yet</p>
                    </div>
                  ) : (
                    recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-4 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl hover:border-slate-600 transition-all"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === "DEPOSIT"
                            ? "bg-green-600/20"
                            : tx.type === "VOICE_SESSION"
                            ? "bg-purple-600/20"
                            : "bg-blue-600/20"
                        }`}>
                          {tx.type === "DEPOSIT" ? (
                            <DollarSign size={15} className="text-green-400" />
                          ) : tx.type === "VOICE_SESSION" ? (
                            <Mic size={15} className="text-purple-400" />
                          ) : (
                            <MessageSquare size={15} className="text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <TransactionMethodBadge method={tx.method} />
                            <p className="text-xs text-slate-500">{tx.details}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${tx.type === "DEPOSIT" ? "text-green-400" : "text-rose-400"}`}>
                            {tx.type === "DEPOSIT" ? "+" : "-"}${((tx.amount ?? 0) / 100).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(tx.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {tx.status === "COMPLETED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : tx.status === "FAILED" ? (
                            <XCircle size={16} className="text-rose-400" />
                          ) : (
                            <Clock size={16} className="text-amber-400" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === "tickets" && (
                <motion.div
                  key="tickets"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-2"
                >
                  {supportTickets.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <HelpCircle size={36} className="mx-auto mb-3 text-slate-700" />
                      <p>No support tickets</p>
                    </div>
                  ) : (
                    supportTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-start gap-4 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl hover:border-slate-600 transition-all"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          ticket.priority === "HIGH"
                            ? "bg-rose-600/20"
                            : ticket.priority === "MEDIUM"
                            ? "bg-amber-600/20"
                            : "bg-slate-700"
                        }`}>
                          <HelpCircle
                            size={15}
                            className={
                              ticket.priority === "HIGH"
                                ? "text-rose-400"
                                : ticket.priority === "MEDIUM"
                                ? "text-amber-400"
                                : "text-slate-400"
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 justify-between">
                            <p className="text-sm font-semibold text-white leading-tight">{ticket.subject}</p>
                            <ComplaintStatusBadge status={ticket.status} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              ticket.priority === "HIGH"
                                ? "bg-rose-500/20 text-rose-400"
                                : ticket.priority === "MEDIUM"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-slate-700 text-slate-400"
                            }`}>
                              {ticket.priority}
                            </span>
                            <span className="text-[10px] text-slate-500">{ticket.category}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{ticket.description}</p>
                        </div>
                        <div className="text-right shrink-0 text-[10px] text-slate-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <UserModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={(updatedUser) => {
          setEditModalOpen(false);
          setData((d) => ({ ...d, user: { ...d.user, ...updatedUser } }));
          toast.success("Profile updated");
        }}
        editUser={user}
      />
    </div>
  );
}
