import { generateMockVoiceSessions, notifications } from "@/constants";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// implement voice selection in this store
type AppStore = {
  preferredVoice: string;
  setPreferredVoice: (preferredVoice: string) => void;
  activeTab: string;
  setActiveTab: (activeTab: string) => void;
  tokenUsageHistory: TokenUsageRecord[];
  setTokenUsageHistory: (tokenUsageHistory: TokenUsageRecord[]) => void;
  voiceSessions: VoiceSession[];
  setVoiceSessions: (voiceSessions: VoiceSession[]) => void;
  notifications: Notifications[];
  setNotifications: (notifications: Notifications[]) => void;
};
// Implement persist middleware to persist the state in local storage
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      preferredVoice: "Kore",
      setPreferredVoice: (preferredVoice: string) => set({ preferredVoice }),
      activeTab: "dashboard",
      setActiveTab: (activeTab: string) => set({ activeTab }),
      tokenUsageHistory: [],
      setTokenUsageHistory: (tokenUsageHistory: TokenUsageRecord[]) =>
        set({ tokenUsageHistory }),
      voiceSessions: generateMockVoiceSessions(),
      setVoiceSessions: (voiceSessions: VoiceSession[]) =>
        set({ voiceSessions }),
      notifications: notifications(),
      setNotifications: (notifications: Notifications[]) =>
        set({ notifications }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      // skipHydration: true,
    },
  ),
);
