import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AuthStore = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showProfile: boolean;
  toggleProfile: () => void;
};
//implement persist middleware to persist the state in local storage
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user: User | null) => set({ user }),
      logout: () => set({ user: null }),
      isSidebarOpen: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      showProfile: false,
      toggleProfile: () =>
        set((state) => ({ showProfile: !state.showProfile })),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration on server
      skipHydration: true,
    },
  ),
);
