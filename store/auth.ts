import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AuthStore = {
  user: User | null;
  otpResetTimer: number;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  updateOtpTimer: (timer: number) => void;
};
const initialState: Omit<
  AuthStore,
  "setUser" | "clearUser" | "updateOtpTimer"
> = {
  user: null,
  otpResetTimer: 0,
};
//implement persist middleware to persist the state in local storage
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,
      setUser: (user: User | null) => set({ user }),
      clearUser: () => set({ user: null }),
      reset: () => set(initialState),
      updateOtpTimer: (timer: number) => set({ otpResetTimer: timer }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      // skipHydration: true,
    },
  ),
);
