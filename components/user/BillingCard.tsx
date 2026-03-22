"use client";
import React, { useState } from "react";
import {
  Plus,
  Check,
  Loader2,
  Wallet,
} from "lucide-react";

interface BillingCardProps {
  user: User;
  onTransactionAdded: (transaction: Transaction, newBalance: number) => void;
}

const BillingCard: React.FC<BillingCardProps> = ({ user, onTransactionAdded }) => {
  const [balance, setBalance] = useState(user.balance);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("20");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddFunds = () => {
    setIsProcessing(true);
    // Simulate API Call
    setTimeout(() => {
      const amount = parseFloat(depositAmount);
      const newBalance = balance + amount;
      
      const newTx: Transaction = {
        id: `t_${Date.now()}`,
        type: "DEPOSIT",
        description: "Funds Added (Manual Top-up)",
        amount: amount,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        details: "Success",
      };

      setBalance(newBalance);
      onTransactionAdded(newTx, newBalance);
      setIsAddingFunds(false);
      setIsProcessing(false);

      // Trigger Success Animation
      setSuccessMessage("Funds added successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1500);
  };

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
            <h2 className="text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
              ${balance.toFixed(2)}
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsAddingFunds(true)}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow-lg shadow-orange-900/20 transition-all flex items-center space-x-2 active:scale-95 hover:scale-105"
              >
                <Plus size={18} />
                <span>Add Funds</span>
              </button>
              <button className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-lg font-medium backdrop-blur-sm transition-all border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30">
                Auto-Recharge
              </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Add Funds
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Enter the amount you wish to deposit into your legal account.
            </p>

            <div className="relative mb-6">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 text-2xl font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {["10", "20", "50"].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(amt)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${depositAmount === amt ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsAddingFunds(false)}
                className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                disabled={isProcessing}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <span>Confirm</span>
                )}
              </button>
            </div>
          </div>
        </div>
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
