"use client";
import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  AlertCircle,
  Check,
  Activity,
  Smartphone,
} from "lucide-react";
import { generateMockTransactions, generateMockCards } from "@/constants";
import BillingCard from "./BillingCard";
import UsageChart from "./UsageChart";
import TransactionList from "./TransactionList";

type BillingPageProps = {
  user: User;
};

export const BillingPage: React.FC<BillingPageProps> = ({ user }) => {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(
    generateMockTransactions(),
  );
  const [cards, setCards] = useState<PaymentMethod[]>(generateMockCards());

  // Simulation State
  const [simulatedUsage, setSimulatedUsage] = useState(0);
  const [isAddingMethod, setIsAddingMethod] = useState(false);

  // Feedback State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Payment Method Form State
  const [paymentType, setPaymentType] = useState<"card" | "mobile_money">(
    "card",
  );
  const [newMethod, setNewMethod] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
    provider: "MTN",
  });
  const [phoneError, setPhoneError] = useState("");

  // --- Real World Simulation Effects ---

  // 1. Simulate real-time usage (cost ticker) based on $0.05/min voice rate
  useEffect(() => {
    // $0.05 per minute = ~$0.00083 per second for active session
    const interval = setInterval(() => {
      setSimulatedUsage((prev) => prev + 0.00083);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- CRUD Operations ---

  const handleTransactionAdded = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleDeleteCard = (id: string) => {
    if (confirm("Remove this payment method?")) {
      setCards((prev) => prev.filter((c) => c.id !== id));
      // INTEGRATION HINT: Call DELETE /api/billing/methods/:id
    }
  };

  const handleSetDefaultCard = (id: string) => {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    // INTEGRATION HINT: Call PUT /api/billing/methods/:id/default
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for Mobile Money
    if (paymentType === "mobile_money") {
      const phoneRegex = /^(0|256|\+256)7[0-9]{8}$/;
      const cleanNumber = newMethod.number
        .replace(/\s+/g, "")
        .replace(/-/g, "");

      if (!phoneRegex.test(cleanNumber)) {
        setPhoneError("Invalid number. Use format: 077... or 070...");
        return;
      }
      setPhoneError("");
    }

    const mockNewMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: paymentType === "card" ? "visa" : "mobile_money", // simplified type logic
      last4:
        paymentType === "card"
          ? newMethod.number.slice(-4) || "8888"
          : newMethod.number.slice(-3).padStart(10, "*") || "077***",
      expiry: paymentType === "card" ? newMethod.expiry || "01/28" : undefined,
      isDefault: false,
      holderName: newMethod.name || user.name,
    };

    setCards((prev) => [...prev, mockNewMethod]);
    setIsAddingMethod(false);
    setNewMethod({
      number: "",
      expiry: "",
      cvc: "",
      name: "",
      provider: "MTN",
    });
    setPaymentType("card");

    // Trigger Success Animation
    setSuccessMessage("Payment method saved securely.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleArchiveTransaction = (id: string) => {
    // Soft delete simulation
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Billing & Usage
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your funds, payment methods, and view consumption history.
          </p>
        </div>
        <div className="flex items-center space-x-3 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-100 dark:border-orange-800 animate-in slide-in-from-right-4 duration-500">
          <Activity className="text-orange-500 w-5 h-5 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
              Session Usage
            </span>
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              ${simulatedUsage.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Balance Card */}
          <BillingCard
            user={user}
            onTransactionAdded={handleTransactionAdded}
          />

          {/* Usage Chart */}
          <UsageChart />
          {/* Transaction History Table */}
          <TransactionList
            transactions={transactions}
            onArchive={handleArchiveTransaction}
          />
        </div>

        {/* Right Column: Payment Methods */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment Methods
              </h3>
              <button
                onClick={() => setIsAddingMethod(!isAddingMethod)}
                className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-600 dark:text-slate-300 hover:rotate-90"
              >
                <Plus size={18} />
              </button>
            </div>

            {isAddingMethod && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Tab Switcher */}
                <div className="flex space-x-6 mb-4 border-b border-slate-200 dark:border-slate-700 pb-0">
                  <button
                    type="button"
                    onClick={() => setPaymentType("card")}
                    className={`pb-2 text-sm font-medium transition-colors relative ${paymentType === "card" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={14} /> Credit Card
                    </span>
                    {paymentType === "card" && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full"></div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("mobile_money")}
                    className={`pb-2 text-sm font-medium transition-colors relative ${paymentType === "mobile_money" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Smartphone size={14} /> Mobile Money
                    </span>
                    {paymentType === "mobile_money" && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full"></div>
                    )}
                  </button>
                </div>

                <form onSubmit={handleAddPaymentMethod}>
                  {paymentType === "card" ? (
                    <>
                      <input
                        type="text"
                        placeholder="Card Number"
                        value={newMethod.number}
                        onChange={(e) =>
                          setNewMethod({ ...newMethod, number: e.target.value })
                        }
                        className="w-full mb-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                        required
                      />
                      <div className="flex gap-3 mb-3">
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={newMethod.expiry}
                          onChange={(e) =>
                            setNewMethod({
                              ...newMethod,
                              expiry: e.target.value,
                            })
                          }
                          className="w-1/2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                          required
                        />
                        <input
                          type="text"
                          placeholder="CVC"
                          value={newMethod.cvc}
                          onChange={(e) =>
                            setNewMethod({ ...newMethod, cvc: e.target.value })
                          }
                          className="w-1/2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() =>
                            setNewMethod({ ...newMethod, provider: "MTN" })
                          }
                          className={`p-2 border rounded-lg text-center text-xs font-bold transition-all ${newMethod.provider === "MTN" ? "border-yellow-400 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-400" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                          MTN MoMo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewMethod({ ...newMethod, provider: "Airtel" })
                          }
                          className={`p-2 border rounded-lg text-center text-xs font-bold transition-all ${newMethod.provider === "Airtel" ? "border-red-400 bg-red-50 text-red-700 ring-1 ring-red-400" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                          Airtel Money
                        </button>
                      </div>
                      <div className="relative mb-1">
                        <input
                          type="tel"
                          placeholder="Phone Number (e.g. 077... or 070...)"
                          value={newMethod.number}
                          onChange={(e) => {
                            setNewMethod({
                              ...newMethod,
                              number: e.target.value,
                            });
                            setPhoneError("");
                          }}
                          className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border text-sm outline-none focus:ring-2 text-slate-900 dark:text-white ${phoneError ? "border-red-500 focus:ring-red-500" : "border-slate-300 dark:border-slate-600 focus:ring-orange-500"}`}
                          required
                        />
                      </div>
                      {phoneError && (
                        <p className="text-red-500 text-xs mb-3">
                          {phoneError}
                        </p>
                      )}
                    </>
                  )}

                  <input
                    type="text"
                    placeholder={
                      paymentType === "card"
                        ? "Cardholder Name"
                        : "Registered Name"
                    }
                    value={newMethod.name}
                    onChange={(e) =>
                      setNewMethod({ ...newMethod, name: e.target.value })
                    }
                    className="w-full mb-4 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                    required
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingMethod(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded hover:opacity-90 transition-opacity"
                    >
                      {paymentType === "card" ? "Save Card" : "Add Number"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`p-4 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-right-4 hover:scale-[1.02] ${card.isDefault ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-6 rounded flex items-center justify-center text-[10px] font-bold uppercase ${
                          card.type === "mobile_money"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300"
                        }`}
                      >
                        {card.type === "mobile_money" ? "MoMo" : card.type}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          •••• {card.last4}
                        </p>
                        <p className="text-xs text-slate-500">
                          {card.holderName}{" "}
                          {card.expiry ? `• Exp ${card.expiry}` : ""}
                        </p>
                      </div>
                    </div>
                    {card.isDefault && (
                      <span className="flex items-center text-xs text-orange-600 font-medium">
                        <Check size={12} className="mr-1" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    {!card.isDefault && (
                      <button
                        onClick={() => handleSetDefaultCard(card.id)}
                        className="text-xs text-slate-500 hover:text-orange-600 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Pricing Info */}
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 group-hover:rotate-12">
              <AlertCircle size={120} />
            </div>
            <h4 className="font-bold text-lg mb-2">Pricing Guide</h4>
            <ul className="space-y-2 text-sm text-indigo-100">
              <li className="flex justify-between">
                <span>Text Queries</span>
                <span className="font-mono font-bold">$0.03 / 1k tokens</span>
              </li>
              <li className="flex justify-between">
                <span>Voice Minutes</span>
                <span className="font-mono font-bold">$0.05 / min</span>
              </li>
              <li className="flex justify-between">
                <span>Daily Free</span>
                <span className="font-mono font-bold">1,000 Tokens</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Success Notification */}

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
