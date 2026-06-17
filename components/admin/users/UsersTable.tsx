"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronDown, Users } from "lucide-react";
import { Ban, Shield, ShieldOff, Trash2 } from "lucide-react";
import ExpandedUserRow from "./ExpandedUserRow";
import type { AdminUserListParams } from "@/lib/actions/admin";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

// ─── Small helpers ─────────────────────────────────────────────────────────────

export function statusBadge(status: User["status"] | undefined, isDeleted?: boolean) {
  if (isDeleted)
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-700"><Trash2 size={10} /> Deleted</span>;
  if (status === "active")
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active</span>;
  if (status === "suspended")
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"><ShieldOff size={10} /> Suspended</span>;
  if (status === "banned")
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"><Ban size={10} /> Banned</span>;
  return null;
}

export function roleBadge(role: User["role"]) {
  if (role === "ADMIN" || role === "SUPER_ADMIN")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wide"><Shield size={9} /> Admin</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700/60 text-slate-400 border border-slate-700 uppercase tracking-wide">User</span>;
}

function SortBtn({ field, label, currentSort, currentOrder, onClick }: {
  field: string; label: string; currentSort: string;
  currentOrder: "asc" | "desc"; onClick: (f: string) => void;
}) {
  const active = currentSort === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${active ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
    >
      {label}
      {active ? (currentOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
    </button>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  search: string;
  showDeleted: boolean;
  sortBy: AdminUserListParams["sortBy"];
  sortOrder: "asc" | "desc";
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onSort: (field: string) => void;
  onEdit: (user: User) => void;
  onStatusChange: (userId: string, status: "active" | "suspended" | "banned") => Promise<void>;
  onSoftDelete: (userId: string) => Promise<void>;
  onRestore: (userId: string) => Promise<void>;
  onPermanentDelete: (userId: string) => Promise<void>;
}

export default function UsersTable({
  users, isLoading, search, showDeleted, sortBy, sortOrder,
  expandedId, onToggleExpand, onSort, onEdit,
  onStatusChange, onSoftDelete, onRestore, onPermanentDelete,
}: UsersTableProps) {
  return (
    <div className="space-y-2">
      {/* Column Headers */}
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2">
        {[
          { field: "name", label: "User" },
          { field: "email", label: "Email" },
          { field: "status", label: "Status" },
          { field: "balance", label: "Balance" },
          { field: "createdAt", label: "Joined" },
        ].map(({ field, label }) => (
          <SortBtn key={field} field={field} label={label} currentSort={sortBy ?? ""} currentOrder={sortOrder} onClick={onSort} />
        ))}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
      </div>

      {/* Rows */}
      {isLoading && users.length === 0 ? (
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
                <button
                  className="w-full grid grid-cols-[auto_1fr_auto] md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-4 text-left"
                  onClick={() => onToggleExpand(user.id)}
                >
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Image src={user.avatar} alt={user.name} width={38} height={38} className="rounded-full object-cover ring-2 ring-slate-700" />
                      {user.status === "active" && !user.isDeleted && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-800" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        {roleBadge(user.role)}
                      </div>
                      {user.username && <p className="text-xs text-slate-500 truncate">@{user.username}</p>}
                    </div>
                  </div>

                  <p className="hidden md:block text-sm text-slate-400 truncate">{user.email}</p>
                  <div className="hidden md:flex">{statusBadge(user.status, user.isDeleted)}</div>
                  <p className="hidden md:block text-sm font-semibold text-white">${balanceUsd.toFixed(2)}</p>
                  <p className="hidden md:block text-xs text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <div className="md:hidden">{statusBadge(user.status, user.isDeleted)}</div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={16} className="text-slate-500" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <ExpandedUserRow
                      user={user}
                      showingDeleted={showDeleted}
                      onEdit={() => onEdit(user)}
                      onStatusChange={(s) => onStatusChange(user.id, s)}
                      onSoftDelete={() => onSoftDelete(user.id)}
                      onRestore={() => onRestore(user.id)}
                      onPermanentDelete={() => onPermanentDelete(user.id)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
