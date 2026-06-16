"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmActionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  confirmStyle?: "danger" | "warning";
  icon?: React.ElementType;
}

export default function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmStyle = "danger",
  icon: Icon = AlertTriangle,
}: ConfirmActionModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const colors = {
    danger: {
      bg: "bg-rose-500/10 border-rose-500/20 text-rose-500",
      btn: "bg-rose-600 hover:bg-rose-500 text-white",
      icon: "text-rose-400",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/20 text-amber-500",
      btn: "bg-amber-600 hover:bg-amber-500 text-white",
      icon: "text-amber-400",
    },
  }[confirmStyle];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={!loading ? onClose : undefined}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.35 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className={`p-6 border-b border-slate-800`}>
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                  <Icon size={24} className={colors.icon} />
                </div>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>
              <h3 className="text-xl font-bold text-white mt-4 mb-2">{title}</h3>
              <div className="text-sm text-slate-400 leading-relaxed">
                {description}
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${colors.btn}`}
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
