// import { notifications } from "@/constants";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// implement voice selection in this store
type AppStore = {
  activeTab: string;
  setActiveTab: (activeTab: string) => void;
  tokenUsageHistory: UsageRecord[];
  setTokenUsageHistory: (tokenUsageHistory: UsageRecord[]) => void;
  voiceSessions: VoiceSession[];
  setVoiceSessions: (voiceSessions: VoiceSession[]) => void;
  // notifications: Notifications[];
  // setNotifications: (notifications: Notifications[]) => void;
  reset: () => void;
};

const initialState: Omit<
  AppStore,
  | "setActiveTab"
  | "setTokenUsageHistory"
  | "setVoiceSessions"
  | "setNotifications"
  | "reset"
> = {
  activeTab: "dashboard",
  tokenUsageHistory: [],
  voiceSessions: [],
  // notifications: notifications(),
};
// Implement persist middleware to persist the state in local storage
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...initialState,
      setActiveTab: (activeTab: string) => set({ activeTab }),
      setTokenUsageHistory: (tokenUsageHistory: UsageRecord[]) =>
        set({ tokenUsageHistory }),
      setVoiceSessions: (voiceSessions: VoiceSession[]) =>
        set({ voiceSessions }),
      // setNotifications: (notifications: Notifications[]) =>
      //   set({ notifications }),
      reset: () => set(initialState),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      // skipHydration: true,
    },
  ),
);
