import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// implement voice selection in this store
type AppStore = {
  showDemo: boolean;
  setShowDemo: (showDemo: boolean) => void;
  showNotifications: boolean;
  toggleNotifications: () => void;
  voicePreference: string;
  setVoicePreference: (voicePreference: string) => void;
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
      voicePreference: "Kore",
      setVoicePreference: (voicePreference: string) => set({ voicePreference }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      skipHydration: true,
    },
  ),
);
