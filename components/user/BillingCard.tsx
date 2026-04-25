"use client";
import React, { useState } from "react";
import { Plus, Check, Wallet } from "lucide-react";
import "react-credit-cards-2/dist/es/styles-compiled.css";

import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { CustomButton } from "../ui/custom-button";
import { AddFundsModal } from "./AddFundsModal";

interface BillingCardProps {
  user: User;
}

const BillingCard: React.FC<BillingCardProps> = ({ user }) => {
  const [balance, setBalance] = useState(user.balance);
  const [isAddingFunds, setIsAddingFunds] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <>
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
                onClick={() => setIsAddingFunds(true)}
                variant="transparent"
                shape="pill"
                borderLeftWidth="4px"
                borderLeftColor="#4f46e5"
                borderRightWidth="4px"
                borderRightColor="#ea580c"
                className="bg-slate-100/50 dark:bg-slate-800/50"
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
                className="bg-slate-100/50 dark:bg-slate-800/50"
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

      {/* Add Funds Modal Overlay */}
      {isAddingFunds && (
        <AddFundsModal
          balance={balance}
          setIsAddingFunds={setIsAddingFunds}
          setBalance={setBalance}
          setSuccessMessage={setSuccessMessage}
          user={user}
        />
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 relative overflow-hidden group">
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
    </>
  );
};

export default BillingCard;
