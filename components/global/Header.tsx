"use client";
import { useAuthStore, usePopStore, useThemeStore } from "@/store";
import { Moon, Sun, Bell, ChevronDown, Menu, ChevronLeft, ArrowLeft } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import NotificationPopUp from "./NotificationPopUp";
import ProfilePopUp from "./ProfilePopUp";
import { motion, AnimatePresence } from "framer-motion";
import { addTransitionType, startTransition, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { db } from "@/firebase/client";
import { onSnapshot, where, query, collection } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "@/lib";
import { getInitials } from "@/utils";
import { useClickAway } from "@uidotdev/usehooks";
import { TRANSITION } from "@/constants";

type Props = {
  user: User;
};

const Header: React.FC<Props> = ({ user }) => {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN");
  const { toggleSidebar } = useSidebar();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const showNotifications = usePopStore((state) => state.showNotifications);
  const toggleNotifications = usePopStore((state) => state.toggleNotifications);
  const showProfile = usePopStore((state) => state.showProfile);
  const toggleProfile = usePopStore((state) => state.toggleProfile);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  const isHomePage = pathname === "/dashboard" || pathname === "/admin";

  const notificationsRef = useClickAway<HTMLDivElement>(() => {
    toggleNotifications();
  });

  const profileRef = useClickAway<HTMLDivElement>(() => {
    toggleProfile();
  });

  // Perform firestore realtime listener for unread notifications filter for unread and get the count

  useEffect(() => {
    const unreadQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      where("isRead", "==", false),
    );

    const unsubscribe = onSnapshot(unreadQuery, (snap) => {
      setUnreadCount(snap.size); // snap.size = count of matching docs
    });

    return unsubscribe;
  }, [user.id]);

  const handleBack = () => {
      startTransition(() => {
        addTransitionType(TRANSITION.NAV_BACK)
        router.back()
      })
    }
  // console.log("avatar", user.avatar);
  return (
    <header className="md:h-16 h-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      <div className="flex items-center flex-1 max-w-lg">
        {/* Navigation Action (Menu or Back) */}
        {!isHomePage ? (
          <>
            {/* Desktop Menu Trigger */}
            <button
              onClick={toggleSidebar}
              className="hidden md:block mr-3 p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            {/* Mobile Back Button */}
            <button
              onClick={handleBack}
              className="md:hidden mr-1 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="mr-3 p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu size={20} />
          </button>
        )}
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
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleNotifications}
            className={`p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 relative ${showNotifications ? "bg-slate-100 dark:bg-slate-800" : ""}`}
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
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center border-2 border-white dark:border-slate-900 rounded-full text-[10px] font-black text-white shadow-lg ${
                    isAdmin ? "bg-indigo-500" : "bg-orange-600"
                  }`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <NotificationPopUp
                ref={notificationsRef}
                unreadCount={unreadCount}
              />
            )}
          </AnimatePresence>
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
              <p className="text-xs text-slate-400 max-w-37.5 truncate">
                {user?.email}
              </p>
            </div>

            <Avatar className="md:h-10 md:w-10 h-6.25 w-6.25 rounded-full transition-transform duration-300 group-hover:scale-105 ring-orange-500 dark:ring-slate-700">
              <AvatarImage src={user?.avatar || ""} alt={user?.name} />
              <AvatarFallback
                className={cn(
                  "rounded-full text-white font-black md:text-sm text-xs",
                  isAdmin
                    ? "bg-indigo-600 shadow-indigo-500/20"
                    : "bg-orange-500 shadow-orange-500/20",
                )}
              >
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <ChevronDown
              size={16}
              className={`hidden sm:block text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-300 ${showProfile ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {showProfile && <ProfilePopUp ref={profileRef} user={user} />}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Header;
