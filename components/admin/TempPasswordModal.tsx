"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Eye, EyeOff, Copy, CheckCircle2, AlertCircle } from "lucide-react";

export function TempPasswordModal({
  open,
  password,
  userName,
  onClose,
}: {
  open: boolean;
  password: string;
  userName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.35 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-8 shadow-2xl text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">User Created Successfully</h3>
            <p className="text-sm text-slate-400 mb-6">
              Share this temporary password with <strong className="text-white">{userName}</strong>. They should change it after first login.
            </p>

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-6">
              <Key size={16} className="text-amber-400 flex-shrink-0" />
              <span className="flex-1 font-mono text-sm text-white tracking-wider">
                {showPw ? password : "•".repeat(password.length)}
              </span>
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={`ml-1 transition-colors ${copied ? "text-green-400" : "text-slate-500 hover:text-white"}`}
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6 text-left">
              <p className="text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                This password will not be shown again. Copy and securely share it now.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all"
            >
              Done — I&apos;ve saved the password
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
