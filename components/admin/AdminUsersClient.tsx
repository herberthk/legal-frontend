"use client";

import React, { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Ban, Trash2, ShieldOff, Plus, RefreshCw,
  Search, SlidersHorizontal, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  getAdminUsers, toggleUserStatus, softDeleteUser, restoreUser,
  permanentlyDeleteUser, getAdminUserSummaryStats,
  type AdminUserListParams, type AdminUserSummaryStats,
} from "@/lib/actions/admin";
import UserModal, { TempPasswordModal } from "@/components/admin/UserModal";
import UsersTable from "@/components/admin/users/UsersTable";
import { toast } from "sonner";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, active, onClick }: {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

interface AdminUsersClientProps {
  initialUsers: User[];
  initialTotal: number;
  initialTotalPages: number;
  initialStats: AdminUserSummaryStats;
}

export default function AdminUsersClient({
  initialUsers, initialTotal, initialTotalPages, initialStats,
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tempPwModal, setTempPwModal] = useState<{ open: boolean; password: string; name: string }>({ open: false, password: "", name: "" });

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchUsers = useCallback((params?: Partial<AdminUserListParams>) => {
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
  }, [search, sortBy, sortOrder, page, showDeleted, statusFilter]);

  const refreshStats = useCallback(async () => {
    const res = await getAdminUserSummaryStats();
    if (res.success && res.stats) setSummaryStats(res.stats);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchUsers({ search, page: 1 }); }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => { fetchUsers(); }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [sortBy, sortOrder, page, showDeleted, statusFilter]);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchUsers(), refreshStats()]);
    setIsRefreshing(false);
  };

  const handleStatusChange = async (userId: string, status: "active" | "suspended" | "banned") => {
    const res = await toggleUserStatus(userId, status);
    if (!res.success) { toast.error(res.error ?? "Failed to change status"); return; }
    toast.success(`User ${status === "active" ? "activated" : status === "suspended" ? "suspended" : "banned"} successfully`);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    refreshStats();
  };

  const handleSoftDelete = async (userId: string) => {
    const res = await softDeleteUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to remove user"); return; }
    toast.success("User removed (soft deleted)");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  const handleRestore = async (userId: string) => {
    const res = await restoreUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to restore user"); return; }
    toast.success("User restored successfully");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  const handlePermanentDelete = async (userId: string) => {
    const res = await permanentlyDeleteUser(userId);
    if (!res.success) { toast.error(res.error ?? "Failed to permanently delete user"); return; }
    toast.success("User permanently deleted");
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setExpandedId(null);
    refreshStats();
  };

  const handleModalSuccess = (user: User, tempPassword?: string) => {
    setModalOpen(false);
    if (tempPassword) setTempPwModal({ open: true, password: tempPassword, name: user.name });
    if (editingUser) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
    } else {
      setUsers((prev) => [user, ...prev]);
      setTotalCount((c) => c + 1);
    }
    setEditingUser(null);
    refreshStats();
  };

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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">User Management</h1>
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(({ label, value, icon, color, filter }) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              icon={icon}
              color={color}
              active={filter === null ? showDeleted : statusFilter === filter && !showDeleted}
              onClick={() => {
                if (filter === null) { setShowDeleted(true); setStatusFilter("all"); }
                else { setShowDeleted(false); setStatusFilter(filter); }
                setPage(1);
              }}
            />
          ))}
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5">
            <SlidersHorizontal size={14} className="text-slate-500 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as AdminUserListParams["sortBy"]); setPage(1); }}
              className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
            >
              {[
                { value: "createdAt", label: "Join Date" },
                { value: "name", label: "Name" },
                { value: "email", label: "Email" },
                { value: "balance", label: "Balance" },
                { value: "status", label: "Status" },
              ].map(({ value, label }) => (
                <option key={value} value={value} className="bg-slate-800">{label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
            >
              {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>

          <button
            onClick={() => { const next = !showDeleted; setShowDeleted(next); setStatusFilter("all"); setPage(1); }}
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

        {/* Table */}
        <UsersTable
          users={users}
          isLoading={isLoading}
          search={search}
          showDeleted={showDeleted}
          sortBy={sortBy}
          sortOrder={sortOrder}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          onSort={handleSort}
          onEdit={(user) => { setEditingUser(user); setModalOpen(true); }}
          onStatusChange={handleStatusChange}
          onSoftDelete={handleSoftDelete}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">Page {page} of {totalPages} · {totalCount} users</p>
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
                if (totalPages > 5) { const start = Math.max(1, Math.min(page - 2, totalPages - 4)); p = start + i; }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${page === p ? "bg-indigo-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"}`}
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

      {/* Modals */}
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
