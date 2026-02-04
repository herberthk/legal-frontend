import { create } from "zustand";

type AppStore = {
  showDemo: boolean;
  setShowDemo: (showDemo: boolean) => void;
};
export const useAppStore = create<AppStore>((set) => ({
  showDemo: false,
  setShowDemo: (showDemo: boolean) => set({ showDemo }),
}));
