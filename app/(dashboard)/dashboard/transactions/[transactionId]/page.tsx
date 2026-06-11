import { FC } from "react";
import { getTransaction } from "@/lib/actions/wallet";
import { getCurrentUser } from "@/lib";
import {
  ArrowLeft,
  Printer,
  Calendar,
  Clock,
  Shield,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { ClientPrintButton } from "./ClientPrintButton";

interface PageProps {
  params: Promise<{ transactionId: string }>;
}

const TransactionDetailPage: FC<PageProps> = async ({ params }) => {
  const { transactionId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const res = await getTransaction(transactionId);
  if (!res.success || !res.transaction) {
    notFound();
  }

  const t = res.transaction;
  const isDeposit = t.type === "DEPOSIT";
  const absAmountDollars = Math.abs(t.amount / 100);
  const absAmountUgx = absAmountDollars * USD_TO_UGX_EXCHANGE_RATE;

  return (
    <div className="md:p-8 p-3 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* ── Top Header Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/transactions"
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-500/30 transition-all shadow-sm group active:scale-95"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div>
            <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block mb-0.5">
              Secure Ledger Receipt
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Transaction Details
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ClientPrintButton />
        </div>
      </div>

      {/* ── Main Layout Grid ── */}
      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Premium Receipt Card */}
        <div className="md:col-span-8 space-y-6">
          <div id="printable-receipt" className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 shadow-2xl p-6 md:p-8 backdrop-blur-xl">
            {/* Ambient gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Stamp indicator */}
            <div className="absolute top-6 right-6 select-none opacity-90">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest border ${
                  t.status === "COMPLETED"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    : t.status === "FAILED"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse"
                }`}
              >
                {t.status}
              </span>
            </div>

            {/* Receipt Header */}
            <div className="space-y-1 mb-8 pt-4">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                Legal Adviser App
              </h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Invoice Reference: {t.reference || t.id}
              </p>
            </div>

            {/* Large Amount Display */}
            <div className="py-6 px-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/80 dark:border-slate-800/60 text-center mb-8 space-y-1.5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-indigo-600 to-orange-600" />
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                Total Transaction Value
              </span>
              <div className="flex items-center justify-center gap-2">
                <div
                  className={`p-1.5 rounded-full shrink-0 ${
                    isDeposit
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-indigo-500/10 text-indigo-500"
                  }`}
                >
                  {isDeposit ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isDeposit ? "+" : "-"}${absAmountDollars.toFixed(2)}
                </h3>
              </div>
              <p className="text-sm font-bold text-orange-500 dark:text-orange-400">
                UGX {absAmountUgx.toLocaleString()}
              </p>
            </div>

            {/* Detailed Metadata Grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                Transaction Details
              </h4>

              <div className="grid grid-cols-2 gap-y-4 py-2">
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Account User
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {user.name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    User Email
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate block max-w-[200px]">
                    {user.email}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Type
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t.type === "DEPOSIT"
                      ? "Wallet Funds Deposit"
                      : t.type === "TEXT_CHAT"
                      ? "AI Text Consultation"
                      : "Voice AI Session"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Description
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t.description}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Settlement Method
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t.method || "Consultation Balance Debit"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Consumption / Metrics
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t.details || "Instant consultation credit"}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Settled Date
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    {formatDate(t.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Status Timestamp
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-400" />
                    {new Date(t.createdAt).toLocaleTimeString("en-US", {
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer encryption note */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-emerald-500 shrink-0" />
                <span>SECURE CRYPTOGRAPHIC LEDGER RECORD</span>
              </div>
              <span>Powered by Netbritz</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Info Sidebar */}
        <div className="md:col-span-4 space-y-6">
          {/* Quick Stats Panel */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-orange-500 animate-pulse" />
              Impact Summary
            </h3>
            <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                  <Coins size={16} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">
                    Remaining Wallet Balance
                  </span>
                  <span className="text-sm font-extrabold text-slate-850 dark:text-slate-200">
                    ${(user.balance / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-orange-50/50 dark:bg-slate-950/40 rounded-2xl border border-orange-500/10 dark:border-orange-500/5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isDeposit
                  ? "This deposit was securely verified. If your balance does not reflect this change instantly, try reloading the dashboard page."
                  : "This consultation debit is mapped directly to legal AI advisor computation time, ensuring transparent, precise per-token billing."}
              </div>
            </div>
          </div>

          {/* Customer Support Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
              <HelpCircle size={16} className="text-indigo-500" />
              Need Support?
            </h3>
            <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              If there&apos;s any discrepancy, or you want to request a manual invoice audit, our core finance desk is ready to help.
            </p>

            <Link
              href="mailto:info@netbritz.com"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 rounded-xl transition-all active:scale-95"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailPage;
