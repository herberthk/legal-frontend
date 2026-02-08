import { create } from "zustand";

type PopStore = {
  showDemo: boolean;
  setShowDemo: (showDemo: boolean) => void;
  showNotifications: boolean;
  toggleNotifications: () => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showProfile: boolean;
  toggleProfile: () => void;
};
export const usePopStore = create<PopStore>()((set) => ({
  showDemo: false,
  setShowDemo: (showDemo: boolean) => set({ showDemo }),
  showNotifications: false,
  toggleNotifications: () =>
    set((state) => ({ showNotifications: !state.showNotifications })),
  isSidebarOpen: false,
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  showProfile: false,
  toggleProfile: () => set((state) => ({ showProfile: !state.showProfile })),
}));
