"use client";
import React, { useState } from "react";
import {
  Plus,
  Check,
  Loader2,
  Wallet,
  Smartphone,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import "react-credit-cards-2/dist/es/styles-compiled.css";
import Cards from "react-credit-cards-2";
import { z } from "zod";
import { processDeposit } from "@/lib/actions/wallet";

interface BillingCardProps {
  user: User;
}

const cardSchema = z.object({
  number: z
    .string()
    .regex(/^\d{16}$/, "Card number must be exactly 16 digits"),
  expiry: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, "Expiry must be in MM/YY format")
    .refine((val) => {
      const [month] = val.split("/").map(Number);
      return month >= 1 && month <= 12;
    }, "Invalid month"),
  cvc: z.string().regex(/^\d{3}$/, "CVC must be exactly 3 digits"),
  name: z.string().min(1, "Card holder name is required"),
});

const formatCardNumber = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 16);
};

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
};

const formatCVC = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 3);
};

type Focus = "number" | "name" | "expiry" | "cvc" | "";
const BillingCard: React.FC<BillingCardProps> = ({ user }) => {
  const [balance, setBalance] = useState(user.balance);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("20");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New states for extended wallet functionality
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card">(
    "mobile_money",
  );
  const [mobileNetwork, setMobileNetwork] = useState<"MTN" | "AIRTEL">("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [focus, setFocus] = useState<Focus>("");
  const [cardErrors, setCardErrors] = useState<{ [key: string]: string }>({});

  const [cardComingSoon, setCardComingSoon] = useState(false);

  const handleAddFunds = async () => {
    if (paymentMethod === "card") {
      const result = cardSchema.safeParse({
        number: cardNumber,
        expiry: cardExpiry,
        cvc: cardCvc,
        name: cardName,
      });

      if (!result.success) {
        const fieldErrors: { [key: string]: string } = {};
        result.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[issue.path[0].toString()] = issue.message;
          }
        });
        setCardErrors(fieldErrors);
        return;
      }

      setCardErrors({});
      // Validate card inputs visually
      if (!depositAmount) return;
      setCardComingSoon(true);
      setTimeout(() => setCardComingSoon(false), 3000);
      return;
    }

    if (paymentMethod === "mobile_money") {
      if (!phoneNumber || !depositAmount) return;

      setIsProcessing(true);

      const amountNum = parseFloat(depositAmount);
      // Backend action
      const res = await processDeposit(
        user.id,
        amountNum,
        `Mobile Money (${mobileNetwork}) - ${phoneNumber}`,
        "Success",
      );

      if (res.success && res.transaction) {
        setBalance(res.newBalance || balance + amountNum);

        setIsAddingFunds(false);
        // Reset states
        setPhoneNumber("");
        setDepositAmount("20");

        // Trigger Success Animation
        setSuccessMessage("Funds added successfully!");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        alert("Failed to add funds: " + res.message);
      }
      setIsProcessing(false);
    }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Add Funds
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  Select a payment method and top up securely
                </p>
              </div>
              <button
                onClick={() => setIsAddingFunds(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {/* Payment Method Selector */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setPaymentMethod("mobile_money")}
                  className={`flex-1 flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${
                    paymentMethod === "mobile_money"
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-bold"
                      : "border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Smartphone size={24} className="mb-2 relative z-10" />
                  <span className="text-sm relative z-10">Mobile Money</span>
                  {paymentMethod === "mobile_money" && (
                    <div className="h-1.5 w-8 bg-orange-500 rounded-full mt-2 absolute bottom-2 animate-in slide-in-from-bottom-2 fade-in"></div>
                  )}
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${
                    paymentMethod === "card"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold"
                      : "border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <CreditCard size={24} className="mb-2 relative z-10" />
                  <span className="text-sm relative z-10">Card</span>
                  {paymentMethod === "card" && (
                    <div className="h-1.5 w-8 bg-blue-500 rounded-full mt-2 absolute bottom-2 animate-in slide-in-from-bottom-2 fade-in"></div>
                  )}
                </button>
              </div>

              {/* Amount Selector - Used by both methods */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Amount (USD)
                </label>
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 text-2xl font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white transition-all shadow-inner"
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {["10", "20", "50", "100"].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDepositAmount(amt)}
                      className={`py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                        depositAmount === amt
                          ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Money Details */}
              {paymentMethod === "mobile_money" && (
                <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Network Provider
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setMobileNetwork("MTN")}
                        className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all ${
                          mobileNetwork === "MTN"
                            ? "border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-500 ring-2 ring-yellow-500/20"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${mobileNetwork === "MTN" ? "bg-yellow-500" : "bg-slate-300"}`}
                        ></div>
                        MTN Money
                      </button>
                      <button
                        onClick={() => setMobileNetwork("AIRTEL")}
                        className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all ${
                          mobileNetwork === "AIRTEL"
                            ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-500 ring-2 ring-red-500/20"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${mobileNetwork === "AIRTEL" ? "bg-red-500" : "bg-slate-300"}`}
                        ></div>
                        Airtel Money
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 0771234567"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Card Details */}
              {paymentMethod === "card" && (
                <div className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-300">
                  {cardComingSoon && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 p-3 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle size={20} className="shrink-0 mt-0.5" />
                      <div className="text-sm font-medium">
                        Card payments integration is coming soon! Please use
                        Mobile Money for now.
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="shrink-0 flex justify-center transform scale-90 sm:scale-100 origin-top">
                      <Cards
                        number={cardNumber}
                        expiry={cardExpiry}
                        cvc={cardCvc}
                        name={cardName}
                        focused={focus}
                      />
                    </div>
                    <div className="w-full space-y-4">
                      <div className="relative">
                        <input
                          type="tel"
                          name="number"
                          value={cardNumber}
                          onChange={(e) => {
                            setCardNumber(formatCardNumber(e.target.value));
                            if (cardErrors.number) {
                              setCardErrors((prev) => {
                                const { number, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onFocus={(e) => setFocus(e.target.name as Focus)}
                          placeholder="Card Number"
                          className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border ${cardErrors.number ? "border-red-500" : "border-slate-200 dark:border-slate-700"} rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all font-medium font-mono`}
                          maxLength={16}
                        />
                        {cardErrors.number && (
                          <p className="text-red-500 text-xs mt-1 ml-1">
                            {cardErrors.number}
                          </p>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          name="name"
                          value={cardName}
                          onChange={(e) => {
                            setCardName(e.target.value);
                            if (cardErrors.name) {
                              setCardErrors((prev) => {
                                const { name, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onFocus={(e) => setFocus(e.target.name as Focus)}
                          placeholder="Card Holder Name"
                          className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border ${cardErrors.name ? "border-red-500" : "border-slate-200 dark:border-slate-700"} rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all font-medium uppercase`}
                        />
                        {cardErrors.name && (
                          <p className="text-red-500 text-xs mt-1 ml-1">
                            {cardErrors.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-4">
                        <div className="w-1/2">
                          <input
                            type="tel"
                            name="expiry"
                            value={cardExpiry}
                            onChange={(e) => {
                              setCardExpiry(formatExpiry(e.target.value));
                              if (cardErrors.expiry) {
                                setCardErrors((prev) => {
                                  const { expiry, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            onFocus={(e) => setFocus(e.target.name as Focus)}
                            placeholder="MM/YY"
                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border ${cardErrors.expiry ? "border-red-500" : "border-slate-200 dark:border-slate-700"} rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all font-medium font-mono`}
                            maxLength={5}
                          />
                          {cardErrors.expiry && (
                            <p className="text-red-500 text-xs mt-1 ml-1">
                              {cardErrors.expiry}
                            </p>
                          )}
                        </div>
                        <div className="w-1/2">
                          <input
                            type="tel"
                            name="cvc"
                            value={cardCvc}
                            onChange={(e) => {
                              setCardCvc(formatCVC(e.target.value));
                              if (cardErrors.cvc) {
                                setCardErrors((prev) => {
                                  const { cvc, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            onFocus={(e) => setFocus(e.target.name as Focus)}
                            placeholder="CVC"
                            className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border ${cardErrors.cvc ? "border-red-500" : "border-slate-200 dark:border-slate-700"} rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all font-medium font-mono`}
                            maxLength={3}
                          />
                          {cardErrors.cvc && (
                            <p className="text-red-500 text-xs mt-1 ml-1">
                              {cardErrors.cvc}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={handleAddFunds}
                disabled={isProcessing}
                className={`w-full py-4 text-white rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2
                  ${
                    paymentMethod === "mobile_money"
                      ? "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20 active:scale-[0.98]"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-[0.98]"
                  }
                  disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100
                `}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <Wallet size={20} />
                    <span>
                      {paymentMethod === "card"
                        ? "Verify & Add Funds"
                        : `Deposit $${depositAmount}`}
                    </span>
                  </>
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
