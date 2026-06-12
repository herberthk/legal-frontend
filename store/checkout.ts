"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CheckoutStep = 1 | 2 | 3 | 4;
export type PaymentMethodType = "card" | "mobile_money";

interface CheckoutState {
  // Persisted across refreshes (session only)
  step: CheckoutStep;
  amount: number;
  paymentMethod: PaymentMethodType;
  phoneNumber: string;

  // Actions
  setStep: (step: CheckoutStep) => void;
  setAmount: (amount: number) => void;
  setPaymentMethod: (method: PaymentMethodType) => void;
  setPhoneNumber: (phone: string) => void;
  resetCheckout: () => void;
  goBack: () => void;
}

const DEFAULT_STATE = {
  step: 1 as CheckoutStep,
  amount: 38000, // Default to 38,000 UGX ($10 USD)
  paymentMethod: "mobile_money" as PaymentMethodType,
  phoneNumber: "",
};

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setStep: (step) => set({ step }),
      setAmount: (amount) => set({ amount }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setPhoneNumber: (phoneNumber) => set({ phoneNumber }),

      resetCheckout: () => set(DEFAULT_STATE),

      goBack: () => {
        const current = get().step;
        if (current > 1) {
          set({ step: (current - 1) as CheckoutStep });
        }
      },
    }),
    {
      name: "checkout-session",
      // sessionStorage: survives refresh but clears when tab/browser closes.
      // This is ideal for checkout flows — safer than localStorage.
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      // Only persist UI state, NOT sensitive payment data
      partialize: (state) => ({
        step: state.step,
        amount: state.amount,
        paymentMethod: state.paymentMethod,
        phoneNumber: state.phoneNumber,
      }),
      // Skip server-side hydration to avoid mismatch
      skipHydration: true,
    }
  )
);
