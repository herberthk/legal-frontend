"use client";
import { notifications } from "@/constants";
import { useAuthStore, usePopStore, useThemeStore } from "@/store";
import { Menu, Search, Moon, Sun, Bell, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import NotificationPopUp from "./NotificationPopUp";
import ProfilePopUp from "./ProfilePopUp";
import Image from "next/image";

type Props = {
  user: User;
};
const Header: React.FC<Props> = ({ user }) => {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const toggleSidebar = usePopStore((state) => state.toggleSidebar);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const showNotifications = usePopStore((state) => state.showNotifications);
  const toggleNotifications = usePopStore((state) => state.toggleNotifications);
  const displayedNotifications = notifications().slice(0, 4);
  const unreadCount = displayedNotifications.filter((n) => n.unread).length;
  const showProfile = usePopStore((state) => state.showProfile);
  const toggleProfile = usePopStore((state) => state.toggleProfile);
  const pathName = usePathname();

  // console.log("avatar", user.avatar);
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

          {showNotifications && <NotificationPopUp />}
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
            <Image
              src={user?.avatar}
              alt={user?.name}
              width={40}
              height={40}
              unoptimized
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-transparent transition-all duration-300 transform group-hover:scale-105 ${isAdmin ? "group-hover:ring-indigo-500" : "group-hover:ring-orange-500"}`}
            />
            <ChevronDown
              size={16}
              className={`hidden sm:block text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-300 ${showProfile ? "rotate-180" : ""}`}
            />
          </button>

          {showProfile && <ProfilePopUp user={user} />}
        </div>
      </div>
    </header>
  );
};

export default Header;
