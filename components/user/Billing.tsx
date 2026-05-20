"use client";
import React, { useState } from "react";
import { Check } from "lucide-react";
import BillingCard from "./BillingCard";
import PricingGuide from "./PricingGuide";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import BackButton from "../global/BackButton";

// Dynamically import heavy components
const UsageChart = dynamic(() => import("./UsageChart"), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
  ssr: false,
});

const PaymentMethods = dynamic(() => import("./PaymentMethods"), {
  loading: () => <Skeleton className="h-80 w-full rounded-2xl" />,
});

type BillingPageProps = {
  user: User;
  transactionsList: React.ReactNode;
};

export const BillingPage: React.FC<BillingPageProps> = ({
  user,
  transactionsList,
}) => {
  // State
  // const [simulatedUsage, setSimulatedUsage] = useState(0);

  // Feedback State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Real World Simulation Effects ---

  // 1. Simulate real-time usage (cost ticker) based on $0.05/min voice rate
  // useEffect(() => {
  //   // $0.05 per minute = ~$0.00083 per second for active session
  //   const interval = setInterval(() => {
  //     setSimulatedUsage((prev) => prev + 0.00083);
  //   }, 1000);
  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div className="md:p-8 px-2 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="p-2 md:p-4 mt-3 flex items-center gap-4">
          <BackButton />
          <div className="mt-1">
            <h1 className="md:text-3xl text-xl font-bold text-slate-900 dark:text-white">
              Billing & Usage
            </h1>
            <p className="md:text-base text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage your funds, payment methods, and view consumption history.
            </p>
          </div>
        </div>
        {/* <div className="flex items-center space-x-3 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-100 dark:border-orange-800 animate-in slide-in-from-right-4 duration-500">
          <Activity className="text-orange-500 w-5 h-5 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
              Session Usage
            </span>
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              ${simulatedUsage.toFixed(5)}
            </span>
          </div>
        </div> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Balance Card */}
          <BillingCard user={user} />

          {/* Usage Chart */}
          <UsageChart />
          {/* Transaction History Table (Server-Rendered) */}
          {transactionsList}
        </div>

        {/* Right Column: Payment Methods */}
        <div className="space-y-8">
          <PaymentMethods
            user={user}
            onSuccess={(msg) => {
              setSuccessMessage(msg);
              setTimeout(() => setSuccessMessage(null), 4000);
            }}
          />

          {/* Quick Pricing Info */}
          <PricingGuide />
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 relative overflow-hidden group">
            {/* Decorative background glow */}
            <div className="absolute inset-0 bg-linear-to-r from-green-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full shadow-lg shadow-green-500/30 animate-in zoom-in spin-in-90 duration-500">
              <Check size={18} className="text-white" strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">Success</span>
              <span className="text-xs opacity-90">{successMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
