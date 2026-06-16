"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Shield, Camera, Lock, Key, Mail, Phone, Save, RefreshCw, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { updateAdminUser, updateAdminPassword } from "@/lib/actions/admin";

export default function AdminSettingsClient({ admin }: { admin: User }) {
  const [profileForm, setProfileForm] = useState({
    name: admin.name,
    username: admin.username || "",
    phoneNumber: admin.phoneNumber || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return toast.error("Name is required");

    setLoadingProfile(true);
    const res = await updateAdminUser(admin.id, {
      name: profileForm.name,
      username: profileForm.username,
      phoneNumber: profileForm.phoneNumber,
    });
    setLoadingProfile(false);

    if (res.success) {
      toast.success("Profile updated successfully!");
    } else {
      toast.error(res.error || "Failed to update profile");
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters.");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    setLoadingPassword(true);
    const res = await updateAdminPassword(passwordForm.newPassword);
    setLoadingPassword(false);

    if (res.success) {
      toast.success("Password changed successfully!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } else {
      toast.error(res.error || "Failed to change password");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <SettingsIcon className="text-indigo-400" />
            Profile Settings
          </h1>
          <p className="text-slate-400">
            Manage your administrator account details and security preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
          {/* Left Column: Avatar & Quick Info */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-24 bg-linear-to-b from-indigo-500/20 to-transparent" />
              
              <div className="relative z-10 mb-4 group cursor-pointer">
                <Image
                  src={admin.avatar}
                  alt={admin.name}
                  width={100}
                  height={100}
                  className="rounded-full ring-4 ring-slate-800 object-cover"
                />
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
              </div>
              
              <h2 className="text-xl font-bold text-white relative z-10">{admin.name}</h2>
              <p className="text-slate-400 text-sm relative z-10">{admin.email}</p>
              
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider relative z-10">
                <Shield size={14} /> Administrator
              </div>
            </motion.div>
          </div>

          {/* Right Column: Forms */}
          <div className="space-y-6">
            {/* Profile Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-slate-400" /> Personal Information
                </h3>
              </div>
              <form onSubmit={handleProfileUpdate} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={16} className="text-slate-500" />
                      </div>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Email Address <span className="text-slate-600 lowercase tracking-normal">(Read only)</span>
                    </label>
                    <div className="relative opacity-60 cursor-not-allowed">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className="text-slate-500" />
                      </div>
                      <input
                        type="email"
                        value={admin.email}
                        readOnly
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold">
                        @
                      </div>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        placeholder="admin_user"
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={16} className="text-slate-500" />
                      </div>
                      <input
                        type="tel"
                        value={profileForm.phoneNumber}
                        onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                        placeholder="+256 700 000 000"
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {loadingProfile ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Password Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lock size={18} className="text-slate-400" /> Security
                </h3>
              </div>
              <form onSubmit={handlePasswordUpdate} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key size={16} className="text-slate-500" />
                      </div>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CheckCircle2 size={16} className="text-slate-500" />
                      </div>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
                  >
                    {loadingPassword ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Lock size={18} />
                    )}
                    Update Password
                  </button>
                </div>
              </form>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
