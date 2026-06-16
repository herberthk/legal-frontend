"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User as UserIcon, Mail, Phone, Key, Shield, DollarSign,
  Zap, Mic, FileText, CheckCircle2, AlertCircle, ChevronDown,
} from "lucide-react";
import { createAdminUser, updateAdminUser } from "@/lib/actions/admin";
import { toast } from "sonner";
import type { CreateAdminUserData, UpdateAdminUserData } from "@/lib/actions/admin";
import { TempPasswordModal } from "./TempPasswordModal";

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User, tempPassword?: string) => void;
  editUser?: User | null;
}

const defaultPermissions: NonNullable<User["permissions"]> = {
  canManageUsers: false,
  canViewBilling: false,
  canManageSystemStats: false,
  canManageSupport: false,
};

const INPUT_BASE = "w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all";
const LABEL_CLASS = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={LABEL_CLASS}>{children}</label>;
}

function PermissionToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left w-full ${checked ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-600"}`}>
      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${checked ? "border-indigo-400 bg-indigo-500" : "border-slate-600"}`}>
        {checked && <CheckCircle2 size={10} className="text-white" />}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

export default function UserModal({ open, onClose, onSuccess, editUser }: UserModalProps) {
  const isEdit = !!editUser;

  const [form, setForm] = useState({
    name: "", email: "", username: "", phoneNumber: "", role: "USER" as Role,
    status: "active" as "active" | "suspended" | "banned", balance: 0,
    welcomeTextTokens: 4000, freeTextTokens: 0, freeVoiceSeconds: 300,
    permissions: { ...defaultPermissions },
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"basic" | "resources" | "permissions">("basic");

  useEffect(() => {
    if (editUser) {
      setForm({
        name: editUser.name ?? "", email: editUser.email ?? "", username: editUser.username ?? "",
        phoneNumber: editUser.phoneNumber ?? "", role: editUser.role ?? "USER",
        status: editUser.status ?? "active", balance: editUser.balance ?? 0,
        welcomeTextTokens: editUser.welcomeTextTokens ?? 4000, freeTextTokens: editUser.freeTextTokens ?? 0,
        freeVoiceSeconds: editUser.freeVoiceSeconds ?? 300, permissions: editUser.permissions ?? { ...defaultPermissions },
      });
    } else {
      setForm({
        name: "", email: "", username: "", phoneNumber: "", role: "USER", status: "active",
        balance: 0, welcomeTextTokens: 4000, freeTextTokens: 0, freeVoiceSeconds: 300,
        permissions: { ...defaultPermissions },
      });
    }
    setErrors({}); setStep("basic");
  }, [editUser, open]);

  const set = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value })), []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); setStep("basic"); return; }
    setLoading(true);
    try {
      if (isEdit && editUser) {
        const data: UpdateAdminUserData = {
          name: form.name, username: form.username || undefined, phoneNumber: form.phoneNumber || undefined,
          role: form.role, status: form.status, balance: form.balance,
          welcomeTextTokens: form.welcomeTextTokens, freeTextTokens: form.freeTextTokens,
          freeVoiceSeconds: form.freeVoiceSeconds, permissions: form.role === "ADMIN" ? form.permissions : defaultPermissions,
        };
        if (form.email !== editUser.email) data.email = form.email;
        const res = await updateAdminUser(editUser.id, data);
        if (!res.success) { toast.error(res.error ?? "Update failed"); return; }
        toast.success("User updated successfully");
        onSuccess({ ...editUser, ...form, permissions: data.permissions });
      } else {
        const data: CreateAdminUserData = {
          name: form.name, email: form.email, username: form.username || undefined,
          phoneNumber: form.phoneNumber || undefined, role: form.role, status: form.status,
          balance: form.balance, welcomeTextTokens: form.welcomeTextTokens,
          freeTextTokens: form.freeTextTokens, freeVoiceSeconds: form.freeVoiceSeconds,
          permissions: form.role === "ADMIN" ? form.permissions : defaultPermissions,
        };
        const res = await createAdminUser(data);
        if (!res.success || !res.user) { toast.error(res.error ?? "Failed to create user"); return; }
        toast.success("User created successfully");
        onSuccess(res.user, res.tempPassword);
      }
    } finally { setLoading(false); }
  };

  const STEPS = ["basic", "resources", "permissions"] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.4 }} className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">{isEdit ? "Edit User" : "Create New User"}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{isEdit ? `Editing profile for ${editUser?.name}` : "Add a new user to the platform"}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"><X size={20} /></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              {STEPS.map((s) => (
                <button key={s} type="button" onClick={() => setStep(s)} className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${step === s ? "border-b-2 border-indigo-500 text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}>
                  {s === "basic" ? "Profile" : s === "resources" ? "Resources & Limits" : "Permissions"}
                </button>
              ))}
            </div>
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">
                <AnimatePresence mode="wait">
                  {step === "basic" && (
                    <motion.div key="basic" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                      <div>
                        <FieldLabel>Full Name *</FieldLabel>
                        <div className="relative">
                          <UserIcon size={16} className="absolute left-3 top-3.5 text-slate-500" />
                          <input className={`${INPUT_BASE} pl-9`} placeholder="John Doe" value={form.name} onChange={(e) => set("name", e.target.value)} />
                        </div>
                        {errors.name && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.name}</p>}
                      </div>
                      <div>
                        <FieldLabel>Email Address *</FieldLabel>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-3.5 text-slate-500" />
                          <input type="email" className={`${INPUT_BASE} pl-9`} placeholder="john@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={isEdit} />
                        </div>
                        {errors.email && <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.email}</p>}
                        {isEdit && <p className="text-xs text-slate-500 mt-1">Email cannot be changed after creation.</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Username</FieldLabel>
                          <input className={INPUT_BASE} placeholder="@johndoe" value={form.username} onChange={(e) => set("username", e.target.value)} />
                        </div>
                        <div>
                          <FieldLabel>Phone Number</FieldLabel>
                          <div className="relative">
                            <Phone size={16} className="absolute left-3 top-3.5 text-slate-500" />
                            <input className={`${INPUT_BASE} pl-9`} placeholder="+256 700 000 000" value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Role</FieldLabel>
                          <div className="relative">
                            <Shield size={16} className="absolute left-3 top-3.5 text-slate-500" />
                            <select className={`${INPUT_BASE} pl-9 appearance-none cursor-pointer`} value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
                              <option value="USER">User</option><option value="ADMIN">Admin</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <FieldLabel>Account Status</FieldLabel>
                          <div className="relative">
                            <select className={`${INPUT_BASE} appearance-none cursor-pointer`} value={form.status} onChange={(e) => set("status", e.target.value as "active" | "suspended" | "banned")}>
                              <option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      {!isEdit && (
                        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          <Key size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          <div><p className="text-sm font-semibold text-amber-300">Auto-Generated Password</p><p className="text-xs text-amber-400/80 mt-0.5">A secure temporary password will be generated for new users.</p></div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {step === "resources" && (
                    <motion.div key="resources" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                      <div>
                        <FieldLabel>Wallet Balance (UGX)</FieldLabel>
                        <div className="relative">
                          <DollarSign size={16} className="absolute left-3 top-3.5 text-slate-500" />
                          <input type="number" min={0} className={`${INPUT_BASE} pl-9`} value={form.balance} onChange={(e) => set("balance", Number(e.target.value))} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">≈ ${(form.balance / 3800).toFixed(4)} USD</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Welcome Text Tokens</FieldLabel>
                          <div className="relative">
                            <Zap size={16} className="absolute left-3 top-3.5 text-amber-500" />
                            <input type="number" min={0} className={`${INPUT_BASE} pl-9`} value={form.welcomeTextTokens} onChange={(e) => set("welcomeTextTokens", Number(e.target.value))} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">One-time bonus (default 4,000)</p>
                        </div>
                        <div>
                          <FieldLabel>Daily Free Text Tokens</FieldLabel>
                          <div className="relative">
                            <FileText size={16} className="absolute left-3 top-3.5 text-blue-500" />
                            <input type="number" min={0} className={`${INPUT_BASE} pl-9`} value={form.freeTextTokens} onChange={(e) => set("freeTextTokens", Number(e.target.value))} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Recurring daily limit</p>
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Free Voice Seconds</FieldLabel>
                        <div className="relative">
                          <Mic size={16} className="absolute left-3 top-3.5 text-purple-500" />
                          <input type="number" min={0} className={`${INPUT_BASE} pl-9`} value={form.freeVoiceSeconds} onChange={(e) => set("freeVoiceSeconds", Number(e.target.value))} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">= {Math.floor(form.freeVoiceSeconds / 60)}m {form.freeVoiceSeconds % 60}s of free voice usage</p>
                      </div>
                      <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Summary</p>
                        <div className="grid grid-cols-3 gap-3">
                          {[{ label: "Welcome Tokens", value: form.welcomeTextTokens.toLocaleString(), color: "text-amber-400" }, { label: "Daily Tokens", value: form.freeTextTokens.toLocaleString(), color: "text-blue-400" }, { label: "Voice Credit", value: `${Math.floor(form.freeVoiceSeconds / 60)}m`, color: "text-purple-400" }].map(({ label, value, color }) => (
                            <div key={label} className="text-center"><p className={`text-lg font-bold ${color}`}>{value}</p><p className="text-xs text-slate-500 mt-0.5">{label}</p></div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {step === "permissions" && (
                    <motion.div key="permissions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                      {form.role !== "ADMIN" ? (
                        <div className="p-6 text-center rounded-xl bg-slate-800/40 border border-slate-700">
                          <Shield size={32} className="mx-auto text-slate-600 mb-3" />
                          <p className="text-sm font-medium text-slate-400">Permissions are only configurable for Admin role users.</p>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl mb-2">
                            <p className="text-xs text-indigo-300 flex items-center gap-2"><Shield size={14} /> Configure which admin sections this user can access and manage.</p>
                          </div>
                          <PermissionToggle label="Manage Users" description="Can view, edit, suspend, ban, and delete other users." checked={form.permissions.canManageUsers} onChange={(v) => set("permissions", { ...form.permissions, canManageUsers: v })} />
                          <PermissionToggle label="View Billing & Revenue" description="Can access billing, revenue charts, and financial dashboards." checked={form.permissions.canViewBilling} onChange={(v) => set("permissions", { ...form.permissions, canViewBilling: v })} />
                          <PermissionToggle label="Manage System Stats" description="Can view token usage analytics, demographics, and system performance." checked={form.permissions.canManageSystemStats} onChange={(v) => set("permissions", { ...form.permissions, canManageSystemStats: v })} />
                          <PermissionToggle label="Manage Support Tickets" description="Can view, respond to, resolve, and close user support tickets." checked={form.permissions.canManageSupport} onChange={(v) => set("permissions", { ...form.permissions, canManageSupport: v })} />
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-800 bg-slate-900/80">
                <div className="flex gap-2">
                  {STEPS.map((s) => <button key={s} type="button" onClick={() => setStep(s)} className={`w-2 h-2 rounded-full transition-all ${step === s ? "bg-indigo-500 w-6" : "bg-slate-700"}`} />)}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                  {step !== "permissions" ? (
                    <button type="button" onClick={() => setStep(step === "basic" ? "resources" : "permissions")} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all">Next →</button>
                  ) : (
                    <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all flex items-center gap-2">
                      {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {isEdit ? "Save Changes" : "Create User"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { TempPasswordModal };
