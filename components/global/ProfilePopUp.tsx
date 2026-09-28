"use client";
import { useAuthStore, usePopStore } from "@/store";
import { LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils";
import { motion } from "framer-motion";
import { RefObject } from "react";
import { CustomLink } from "./transitions";
type Props = {
  user: User;
  ref: RefObject<HTMLDivElement>;
};
const ProfilePopUp = ({ user, ref }: Props) => {
  //   const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN");
  const toggleProfile = usePopStore((state) => state.toggleProfile);
  const router = useRouter();
  const clearUser = useAuthStore((state) => state.clearUser);
  const toggleSidebar = usePopStore((state) => state.toggleSidebar);
  const onLogout = async () => {
    try {
      await firebaseSignOut(auth);
      await signOut(); // Server action to delete cookie
      toggleSidebar();
      clearUser();
      router.push("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-140! bg-black/20 dark:bg-black/40 backdrop-blur-sm md:hidden"
        onClick={() => toggleProfile()}
      ></motion.div>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed md:absolute top-16 md:top-auto md:right-0 md:mt-2 left-0 right-0 md:left-auto w-full md:w-80 bg-white dark:bg-slate-800 border-b md:border border-slate-200 dark:border-slate-700 md:rounded-xl shadow-2xl z-100000! overflow-hidden origin-top"
        ref={ref}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => toggleProfile()}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 transition-colors md:hidden z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6 text-center border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative inline-block group">
            <Avatar className="h-26 w-26 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105 mx-auto mb-3 ring-4 ring-orange-500 dark:ring-slate-700">
              <AvatarImage src={user?.avatar || ""} alt={user?.name} />
              <AvatarFallback
                className={cn(
                  "rounded-full text-white text-3xl font-black",
                  isAdmin
                    ? "bg-indigo-600 shadow-indigo-500/20"
                    : "bg-orange-500 shadow-orange-500/20",
                )}
              >
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
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
              : `Balance: $${(user?.balance / 100).toFixed(2)}`}
          </div>
        </div>

        <div className="p-2">
          <div className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors mb-1 group">
            <CustomLink href="/dashboard/settings">
              <p
                className={`text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors ${isAdmin ? "group-hover:text-indigo-600" : "group-hover:text-orange-600"}`}
              >
                Account Settings
              </p>
              <p className="text-xs text-slate-400">Manage your subscription</p>
            </CustomLink>
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
      </motion.div>
    </>
  );
};

export default ProfilePopUp;
