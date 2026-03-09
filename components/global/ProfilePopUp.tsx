"use client";
import { useAuthStore, usePopStore } from "@/store";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";
import Image from "next/image";
type Props = {
  user: User;
};
const ProfilePopUp = ({ user }: Props) => {
  //   const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
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
      <div className="fixed inset-0 z-20" onClick={() => toggleProfile()}></div>
      <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right overflow-hidden">
        <div className="p-6 text-center border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative inline-block group">
            <Image
              src={user?.avatar}
              alt={user?.name}
              width={80}
              height={80}
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
            <p className="text-xs text-slate-400">Manage your subscription</p>
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
  );
};

export default ProfilePopUp;
