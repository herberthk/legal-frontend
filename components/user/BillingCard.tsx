"use client";
import React from "react";
import { Plus, Wallet } from "lucide-react";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { CustomButton } from "../ui/custom-button";
import { useRouter } from "next/navigation";

interface BillingCardProps {
  user: User;
  balance: number;
}

const BillingCard: React.FC<BillingCardProps> = ({
  user,
  balance,
}) => {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-linear-to-br dark:from-black dark:to-slate-900 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-transparent relative overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:scale-[1.01]">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
        <Wallet size={200} className="text-slate-900 dark:text-white" />
      </div>
      <div className="relative flex justify-between items-start">
        <div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
            Available Balance
          </p>
          <h2 className="text-5xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">
            ${(balance / 100).toFixed(2)}
          </h2>
          <p className="text-lg ml-2 text-slate-500 font-medium mb-6">
            USh{" "}
            {Math.round(
              (balance / 100) * USD_TO_UGX_EXCHANGE_RATE,
            ).toLocaleString()}
          </p>
          <div className="flex space-x-3">
            <CustomButton
              onClick={() => router.push("/dashboard/user/billing/checkout")}
              variant="transparent"
              shape="pill"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className="bg-slate-100/50 dark:bg-slate-800/50 text-foreground hover:text-indigo-400"
              leftIcon={<Plus size={18} />}
              hoverEffect="glow"
            >
              Add Funds
            </CustomButton>

            <CustomButton
              variant="transparent"
              shape="rounded"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className="bg-slate-100/50 dark:bg-slate-800/50 text-foreground"
              hoverEffect="glow"
            >
              Auto-Recharge
            </CustomButton>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            Status
          </p>
          <p className="font-semibold text-lg text-slate-900 dark:text-white">
            Active
          </p>
          <span className="inline-block mt-2 px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded border border-green-500/30">
            Pay As You Go
          </span>
        </div>
      </div>
    </div>
  );
};

export default BillingCard;
