"use client";

import React, {
  useState, useEffect, useCallback, useTransition, useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Search, SlidersHorizontal, Users, UserCheck, Ban,
  Trash2, Plus, ChevronDown, ArrowUpDown, ArrowUp,
  ArrowDown, ExternalLink, Edit2, ShieldOff, Shield,
  RotateCcw, Flame, RefreshCw, AlertTriangle, ChevronLeft,
  ChevronRight, Activity, DollarSign, Zap, Mic,
} from "lucide-react";
import {
  getAdminUsers, toggleUserStatus, softDeleteUser, restoreUser,
  permanentlyDeleteUser, getAdminUserSummaryStats,
  type AdminUserListParams, type AdminUserSummaryStats,
} from "@/lib/actions/admin";
import UserModal, { TempPasswordModal } from "@/components/admin/UserModal";
import ConfirmActionModal from "@/components/admin/ConfirmActionModal";
import { toast } from "sonner";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: User["status"] | undefined, isDeleted?: boolean) {
  if (isDeleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-700">
        <Trash2 size={10} /> Deleted
      </span>
    );
  }
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Active
      </span>
    );
  if (status === "suspended")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <ShieldOff size={10} /> Suspended
      </span>
    );
  if (status === "banned")
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <Ban size={10} /> Banned
      </span>
    );
  return null;
}

function roleBadge(role: User["role"]) {
  if (role === "ADMIN")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wide">
        <Shield size={9} /> Admin
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700/60 text-slate-400 border border-slate-700 uppercase tracking-wide">
      User
    </span>
  );
}

function StatCard({
  label, value, icon: Icon, color, active, onClick,
}: {
  label: string; value: number; icon: React.ElementType;
  color: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left w-full ${
        active
          ? "bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
          : "bg-slate-800/60 border-slate-700/80 hover:border-slate-600"
      }`}
    >
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </motion.button>
  );
}

// ─── Sort Button ───────────────────────────────────────────────────────────────

function SortBtn({
  field, label, currentSort, currentOrder, onClick,
}: {
  field: string; label: string; currentSort: string;
  currentOrder: "asc" | "desc"; onClick: (f: string) => void;
}) {
  const active = currentSort === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
        active ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
      {active ? (
        currentOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      ) : (
        <ArrowUpDown size={12} />
      )}
    </button>
  );
}

// ─── Expanded Row ──────────────────────────────────────────────────────────────

function ExpandedUserRow({
  user,
  onEdit,
  onStatusChange,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
  showingDeleted,
}: {
  user: User;
  onEdit: () => void;
  onStatusChange: (s: "active" | "suspended" | "banned") => Promise<void>;
  onSoftDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
  onPermanentDelete: () => Promise<void>;
  showingDeleted: boolean;
}) {
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
              {/* Edit */}
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-all"
              >
                <Edit2 size={13} /> Edit Profile
              </button>

              {/* Status Actions */}
              {user.status !== "active" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => wrap("active", () => onStatusChange("active"))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-xs font-semibold text-emerald-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "active" ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <UserCheck size={13} />
                  )}{" "}
                  Activate
                </button>
              )}
              {user.status !== "suspended" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => setPendingAction("suspend")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-xs font-semibold text-amber-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "suspend" ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <ShieldOff size={13} />
                  )}{" "}
                  Suspend
                </button>
              )}
              {user.status !== "banned" && (
                <button
                  disabled={!!actionLoading}
                  onClick={() => setPendingAction("banned")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-xs font-semibold text-rose-300 transition-all disabled:opacity-50"
                >
                  {actionLoading === "banned" ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Ban size={13} />
                  )}{" "}
                  Ban
                </button>
              )}

              {/* Soft Delete */}
              <button
                disabled={!!actionLoading}
                onClick={() => setPendingAction("softDelete")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-900/40 text-xs font-semibold text-slate-400 hover:text-rose-300 transition-all disabled:opacity-50 ml-auto"
              >
                {actionLoading === "softDelete" ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}{" "}
                Remove
              </button>

              {/* View Full Analytics */}
              <Link
                href={`/admin/users/${user.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-xs font-semibold text-indigo-300 transition-all"
              >
                <ExternalLink size={13} /> Full Analytics
              </Link>
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

      {/* Action Modals */}
      <ConfirmActionModal
        open={pendingAction === "suspend"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          await wrap("suspend", () => onStatusChange("suspended"));
          setPendingAction(null);
        }}
        title="Suspend User"
        description={
          <>
            Are you sure you want to suspend <strong className="text-white">{user.name}</strong>? This will immediately disable their login access until you reactivate them.
          </>
        }
        confirmText="Suspend User"
        confirmStyle="warning"
        icon={ShieldOff}
      />
      <ConfirmActionModal
        open={pendingAction === "banned"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          await wrap("banned", () => onStatusChange("banned"));
          setPendingAction(null);
        }}
        title="Ban User"
        description={
          <>
            Are you sure you want to ban <strong className="text-white">{user.name}</strong>? They will be entirely locked out of the platform.
          </>
        }
        confirmText="Ban User"
        confirmStyle="danger"
        icon={Ban}
      />
      <ConfirmActionModal
        open={pendingAction === "softDelete"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          await wrap("softDelete", onSoftDelete);
          setPendingAction(null);
        }}
        title="Move to Trash"
        description={
          <>
            Are you sure you want to remove <strong className="text-white">{user.name}</strong>? Their account will be moved to the Trash and they will lose all access.
          </>
        }
        confirmText="Remove to Trash"
        confirmStyle="danger"
        icon={Trash2}
      />
      <ConfirmActionModal
        open={pendingAction === "permDelete"}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          await wrap("permDelete", onPermanentDelete);
          setPendingAction(null);
        }}
        title="Permanently Delete User"
        description={
          <>
            Are you absolutely sure you want to permanently delete <strong className="text-white">{user.name}</strong>? This action <strong className="text-rose-400">cannot be undone</strong>. All their data will be destroyed.
          </>
        }
        confirmText="Permanently Delete"
        confirmStyle="danger"
        icon={Flame}
      />
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface AdminUsersClientProps {
  initialUsers: User[];
  initialTotal: number;
  initialTotalPages: number;
  initialStats: AdminUserSummaryStats;
}

export default function AdminUsersClient({
  initialUsers,
  initialTotal,
  initialTotalPages,
  initialStats,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [summaryStats, setSummaryStats] = useState<AdminUserSummaryStats>(initialStats);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<AdminUserListParams["sortBy"]>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AdminUserListParams["statusFilter"]>("all");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tempPwModal, setTempPwModal] = useState<{ open: boolean; password: string; name: string }>({
    open: false, password: "", name: "",
  });

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // ─── Fetch users ───────────────────────────────────────────────────────────
  const fetchUsers = useCallback(
    (params?: Partial<AdminUserListParams>) => {
      startTransition(async () => {
        const res = await getAdminUsers({
          search: params?.search ?? search,
          sortBy: params?.sortBy ?? sortBy,
          sortOrder: params?.sortOrder ?? sortOrder,
          page: params?.page ?? page,
          pageSize: 20,
          showDeleted: params?.showDeleted ?? showDeleted,
          statusFilter: params?.statusFilter ?? statusFilter,
        });
        if (res.success) {
          setUsers(res.users);
          setTotalCount(res.totalCount);
          setTotalPages(res.totalPages);
        }
      });
    },
    [search, sortBy, sortOrder, page, showDeleted, statusFilter],
  );

  const refreshStats = useCallback(async () => {
    const res = await getAdminUserSummaryStats();
    if (res.success && res.stats) setSummaryStats(res.stats);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchUsers({ search, page: 1 });
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Re-fetch on filter/sort/page changes
  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, page, showDeleted, statusFilter]);

  // ─── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortBy === field) {
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      setSortOrder(newOrder);
      fetchUsers({ sortOrder: newOrder });
    } else {
      setSortBy(field as AdminUserListParams["sortBy"]);
      setSortOrder("asc");
      fetchUsers({ sortBy: field as AdminUserListParams["sortBy"], sortOrder: "asc" });
    }
  };

  // ─── Full refresh ──────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchUsers(), refreshStats()]);
    setIsRefreshing(false);
  };

  // ─── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (userId: string, status: "active" | "suspended" | "banned") => {
    const res = await toggleUserStatus(userId, status);
    if (!res.success) { toast.error(res.error ?? "Failed to change status"); return; }
    toast.success(`User ${status === "active" ? "activated" : status === "suspended" ? "suspended" : "banned"} successfully`);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    refreshStats();
  };

  // ─── Soft delete ───────────────────────────────────────────────────────────
  const handleSoftDelete = async (userId: string) => {
    const res = await softDeleteUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to remove user"); return; }
    toast.success("User removed (soft deleted)");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  // ─── Restore ───────────────────────────────────────────────────────────────
  const handleRestore = async (userId: string) => {
    const res = await restoreUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to restore user"); return; }
    toast.success("User restored successfully");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  // ─── Permanent delete ──────────────────────────────────────────────────────
  const handlePermanentDelete = async (userId: string) => {
    const res = await permanentlyDeleteUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to permanently delete user"); return; }
    toast.success("User permanently deleted");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  // ─── Modal success ─────────────────────────────────────────────────────────
  const handleModalSuccess = (user: User, tempPassword?: string) => {
    setModalOpen(false);
    if (tempPassword) {
      setTempPwModal({ open: true, password: tempPassword, name: user.name });
    }
    if (editingUser) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
    } else {
      setUsers((prev) => [user, ...prev]);
      setTotalCount((c) => c + 1);
    }
    setEditingUser(null);
    refreshStats();
  };

  // ─── Status filter cards mapping ───────────────────────────────────────────
  const statCards = [
    { label: "Total Users", value: summaryStats.totalUsers, icon: Users, color: "bg-slate-600", filter: "all" as const },
    { label: "Active", value: summaryStats.activeUsers, icon: UserCheck, color: "bg-emerald-600", filter: "active" as const },
    { label: "Suspended", value: summaryStats.suspendedUsers, icon: ShieldOff, color: "bg-amber-600", filter: "suspended" as const },
    { label: "Banned", value: summaryStats.bannedUsers, icon: Ban, color: "bg-rose-600", filter: "banned" as const },
    { label: "Deleted", value: summaryStats.deletedUsers, icon: Trash2, color: "bg-slate-700", filter: null },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {totalCount.toLocaleString()} {showDeleted ? "deleted" : statusFilter !== "all" ? statusFilter : ""} users
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setEditingUser(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-900/30"
            >
              <Plus size={16} /> Add User
            </motion.button>
          </div>
        </div>

        {/* ─── Stats Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(({ label, value, icon, color, filter }) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              icon={icon}
              color={color}
              active={
                filter === null
                  ? showDeleted
                  : statusFilter === filter && !showDeleted
              }
              onClick={() => {
                if (filter === null) {
                  setShowDeleted(true);
                  setStatusFilter("all");
                } else {
                  setShowDeleted(false);
                  setStatusFilter(filter);
                }
                setPage(1);
              }}
            />
          ))}
        </div>

        {/* ─── Filters Row ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-lg">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
            <input
              id="admin-user-search"
              type="text"
              placeholder="Search by name, email, username, phone, UID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-all"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5">
            <SlidersHorizontal size={14} className="text-slate-500 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as AdminUserListParams["sortBy"]);
                setPage(1);
              }}
              className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
            >
              {[
                { value: "createdAt", label: "Join Date" },
                { value: "name", label: "Name" },
                { value: "email", label: "Email" },
                { value: "balance", label: "Balance" },
                { value: "status", label: "Status" },
              ].map(({ value, label }) => (
                <option key={value} value={value} className="bg-slate-800">
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
            >
              {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>

          {/* Trash toggle */}
          <button
            onClick={() => {
              const next = !showDeleted;
              setShowDeleted(next);
              setStatusFilter("all");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              showDeleted
                ? "bg-rose-600/20 border-rose-500/50 text-rose-300"
                : "bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
            }`}
          >
            <Trash2 size={14} />
            {showDeleted ? "Viewing Trash" : "Trash"}
          </button>
        </div>

        {/* ─── Table Header (md+) ──────────────────────────────────────── */}
        <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2">
          {[
            { field: "name", label: "User" },
            { field: "email", label: "Email" },
            { field: "status", label: "Status" },
            { field: "balance", label: "Balance" },
            { field: "createdAt", label: "Joined" },
          ].map(({ field, label }) => (
            <SortBtn
              key={field}
              field={field}
              label={label}
              currentSort={sortBy ?? ""}
              currentOrder={sortOrder}
              onClick={handleSort}
            />
          ))}
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
        </div>

        {/* ─── User List ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          {isLoading && users.length === 0 ? (
            // Skeleton
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl h-16 animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-400 font-medium">No users found</p>
              <p className="text-slate-500 text-sm mt-1">
                {search ? `No results for "${search}"` : showDeleted ? "No deleted users" : "Try a different filter"}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {users.map((user, idx) => {
                const isExpanded = expandedId === user.id;
                const balanceUsd = (user.balance ?? 0) / 100;

                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "bg-slate-800/80 border-indigo-500/40 shadow-lg shadow-indigo-500/5"
                        : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70"
                    }`}
                  >
                    {/* Row */}
                    <button
                      className="w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-4 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : user.id)}
                    >
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Image
                            src={user.avatar}
                            alt={user.name}
                            width={38}
                            height={38}
                            className="rounded-full object-cover ring-2 ring-slate-700"
                          />
                          {user.status === "active" && !user.isDeleted && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-800" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                            {roleBadge(user.role)}
                          </div>
                          {user.username && (
                            <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                          )}
                        </div>
                      </div>

                      {/* Email — hidden on mobile */}
                      <p className="hidden md:block text-sm text-slate-400 truncate">{user.email}</p>

                      {/* Status */}
                      <div className="hidden md:flex">{statusBadge(user.status, user.isDeleted)}</div>

                      {/* Balance */}
                      <p className="hidden md:block text-sm font-semibold text-white">
                        ${balanceUsd.toFixed(2)}
                      </p>

                      {/* Joined */}
                      <p className="hidden md:block text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </p>

                      {/* Expand icon */}
                      <div className="flex items-center justify-end gap-2">
                        {/* Mobile status badge */}
                        <div className="md:hidden">{statusBadge(user.status, user.isDeleted)}</div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={16} className="text-slate-500" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Expanded Panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <ExpandedUserRow
                          user={user}
                          showingDeleted={showDeleted}
                          onEdit={() => {
                            setEditingUser(user);
                            setModalOpen(true);
                          }}
                          onStatusChange={(s) => handleStatusChange(user.id, s)}
                          onSoftDelete={() => handleSoftDelete(user.id)}
                          onRestore={() => handleRestore(user.id)}
                          onPermanentDelete={() => handlePermanentDelete(user.id)}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {totalCount} users
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5) {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  p = start + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                      page === p
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <UserModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingUser(null); }}
        onSuccess={handleModalSuccess}
        editUser={editingUser}
      />
      <TempPasswordModal
        open={tempPwModal.open}
        password={tempPwModal.password}
        userName={tempPwModal.name}
        onClose={() => setTempPwModal({ open: false, password: "", name: "" })}
      />
    </div>
  );
}
