"use client";

import { FC } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export const ClientPrintButton: FC = () => {
  const handlePrint = () => {
    try {
      window.print();
      toast.success("Print dialog opened");
    } catch (e) {
      toast.error("Failed to print transaction receipt");
    }
  };

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm hover:border-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all active:scale-95 shrink-0"
    >
      <Printer size={15} />
      Print Receipt
    </button>
  );
};
