import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// implement voice selection in this store
type AppStore = {
  showDemo: boolean;
  setShowDemo: (showDemo: boolean) => void;
  showNotifications: boolean;
  toggleNotifications: () => void;
  preferredVoice: string;
  setPreferredVoice: (preferredVoice: string) => void;
  activeTab: string;
  setActiveTab: (activeTab: string) => void;
};
// Implement persist middleware to persist the state in local storage
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      showDemo: false,
      setShowDemo: (showDemo: boolean) => set({ showDemo }),
      showNotifications: false,
      toggleNotifications: () =>
        set((state) => ({ showNotifications: !state.showNotifications })),
      preferredVoice: "Kore",
      setPreferredVoice: (preferredVoice: string) => set({ preferredVoice }),
      activeTab: "dashboard",
      setActiveTab: (activeTab: string) => set({ activeTab }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      skipHydration: true,
    },
  ),
);
