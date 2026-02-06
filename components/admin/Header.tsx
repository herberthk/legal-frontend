"use client";
import { notifications } from "@/constants";
import { signOut } from "@/lib";
import { useAppStore, useAuthStore, useThemeStore } from "@/store";
import {
  Menu,
  Search,
  Moon,
  Sun,
  Bell,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  user: User;
};
const Header: React.FC<Props> = ({ user }) => {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const toggleSidebar = useAuthStore((state) => state.toggleSidebar);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const showNotifications = useAppStore((state) => state.showNotifications);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);
  const displayedNotifications = notifications().slice(0, 4);
  const unreadCount = displayedNotifications.filter((n) => n.unread).length;
  const showProfile = useAuthStore((state) => state.showProfile);
  const toggleProfile = useAuthStore((state) => state.toggleProfile);
  const pathName = usePathname();
  const router = useRouter();
  const onLogout = async () => {
    await signOut();
    toggleSidebar();
    router.push("/login");
  };
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      <div className="flex items-center flex-1 max-w-lg">
        {/* Mobile Menu Trigger */}
        <button
          onClick={() => toggleSidebar()}
          className="mr-3 p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        {/* Search Bar */}
        <div className="relative w-full max-w-md hidden md:block group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder={
              isAdmin
                ? "Search users, transaction IDs..."
                : "Search documents, cases, or laws..."
            }
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 outline-none transition-all focus:bg-white dark:focus:bg-slate-950 ring-2 ring-transparent focus:ring-opacity-50 focus:ring-current"
            style={{
              ["--tw-ring-color" as string]: isAdmin ? "#6366f1" : "#f97316",
            }}
          />
        </div>
        {/* Mobile title if sidebar is hidden */}
        <span className="md:hidden font-bold text-slate-900 dark:text-white truncate">
          {/* {currentView === View.ADMIN_COMPLAINTS
            ? "Complaints"
            : currentView.charAt(0) + currentView.slice(1).toLowerCase()} */}
          {pathName.charAt(0).toUpperCase() + pathName.slice(1)}
        </span>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {isAdmin && (
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              System Live
            </span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:rotate-12 hover:scale-110"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <div className="relative">
          <button
            onClick={toggleNotifications}
            className={`p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-110 relative ${showNotifications ? "bg-slate-100 dark:bg-slate-800" : ""}`}
          >
            <Bell
              size={20}
              className={
                showNotifications
                  ? isAdmin
                    ? "text-indigo-600"
                    : "text-orange-600"
                  : ""
              }
            />
            {unreadCount > 0 && (
              <span
                className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 border-2 border-white dark:border-slate-900 rounded-full animate-pulse ${isAdmin ? "bg-indigo-500" : "bg-orange-500"}`}
              ></span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={toggleNotifications}
              ></div>
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Notifications
                  </h3>
                  <button
                    onClick={toggleNotifications}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {displayedNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No new notifications
                    </div>
                  ) : (
                    displayedNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group ${n.unread ? (isAdmin ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "bg-orange-50/50 dark:bg-orange-900/10") : ""}`}
                      >
                        <p
                          className={`text-sm text-slate-800 dark:text-slate-200 transition-colors ${isAdmin ? "group-hover:text-indigo-700 dark:group-hover:text-indigo-400" : "group-hover:text-orange-700 dark:group-hover:text-orange-400"}`}
                        >
                          {n.text}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                          {n.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {/* Footer Link */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center">
                  <button
                    onClick={() => {}}
                    className={`text-xs font-bold uppercase tracking-wider hover:underline ${isAdmin ? "text-indigo-600 dark:text-indigo-400" : "text-orange-600 dark:text-orange-400"}`}
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Section */}
        <div className="relative pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={() => toggleProfile()}
            className="flex items-center space-x-3 group focus:outline-none"
          >
            <div className="text-right hidden md:block">
              <p
                className={`text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors ${isAdmin ? "group-hover:text-indigo-600 dark:group-hover:text-indigo-500" : "group-hover:text-orange-600 dark:group-hover:text-orange-500"}`}
              >
                {user?.name}
              </p>
              <p className="text-xs text-slate-400 max-w-[150px] truncate">
                {user?.email}
              </p>
            </div>
            <img
              src={user?.avatar}
              alt={user?.name}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-transparent transition-all duration-300 transform group-hover:scale-105 ${isAdmin ? "group-hover:ring-indigo-500" : "group-hover:ring-orange-500"}`}
            />
            <ChevronDown
              size={16}
              className={`hidden sm:block text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-300 ${showProfile ? "rotate-180" : ""}`}
            />
          </button>

          {showProfile && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => toggleProfile()}
              ></div>
              <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right overflow-hidden">
                <div className="p-6 text-center border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <div className="relative inline-block group">
                    <img
                      src={user?.avatar}
                      alt={user?.name}
                      className="w-20 h-20 rounded-full mx-auto mb-3 ring-4 ring-white dark:ring-slate-700 shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      className={`absolute bottom-3 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${user?.status === "active" ? "bg-green-500" : "bg-red-500"}`}
                    ></div>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    {user?.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {user?.email}
                  </p>
                  <div
                    className={`mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${isAdmin ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800"}`}
                  >
                    {isAdmin
                      ? "ADMINISTRATOR"
                      : `Balance: $${user?.balance.toFixed(2)}`}
                  </div>
                </div>

                <div className="p-2">
                  <div className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors mb-1 group">
                    <p
                      className={`text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors ${isAdmin ? "group-hover:text-indigo-600" : "group-hover:text-orange-600"}`}
                    >
                      Account Settings
                    </p>
                    <p className="text-xs text-slate-400">
                      Manage your subscription
                    </p>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
