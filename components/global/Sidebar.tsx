"use client";
import { useAuthStore, usePopStore } from "@/store";
import { cn, signOut } from "@/lib";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";

import { LogOut, Scale, Shield, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { sideBarItems } from "@/constants";
import Link from "next/link";
import { useEffect } from "react";
type Props = {
  user: User;
};
const Sidebar = ({ user }: Props) => {
  const isSidebarOpen = usePopStore((state) => state.isSidebarOpen);
  const toggleSidebar = usePopStore((state) => state.toggleSidebar);
  const clearUser = useAuthStore((state) => state.clearUser);
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
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
  const navlinks = sideBarItems(user?.role);

  const setUser = useAuthStore((state) => state.setUser);
  useEffect(() => {
    setUser(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // console.log("activeTab", activeTab);
  const pathname = usePathname();
  return (
    <aside
      className={`fixed inset-y-0 bg-white left-0 z-40 w-64 text-white flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } ${isAdmin ? "dark:bg-slate-900" : "dark:bg-slate-950"}`}
    >
      <div className="p-6 flex items-center justify-between border-b border-slate-800 dark:border-slate-800 group">
        <div className="flex items-center space-x-2 cursor-pointer">
          <div
            className={`p-2 rounded-lg shadow-lg transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 ${isAdmin ? "bg-linear-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20" : "bg-linear-to-br from-amber-500 to-orange-600 shadow-orange-500/20"}`}
          >
            {isAdmin ? (
              <Shield className="w-6 h-6 text-white" />
            ) : (
              <Scale className="w-6 h-6 text-white" />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight group-hover:text-white transition-colors">
            <span className="dark:text-white text-slate-900">
              {isAdmin ? "Admin" : "Legal"}
            </span>

            <span
              className={`text-transparent bg-clip-text ${isAdmin ? "bg-linear-to-r from-indigo-400 to-purple-500" : "bg-linear-to-r from-amber-400 to-orange-500"}`}
            >
              {isAdmin ? "Panel" : "Adviser"}
            </span>
          </span>
        </div>
        {/* Close button for mobile inside sidebar */}
        <button
          onClick={() => toggleSidebar()}
          className="md:hidden text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navlinks.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            onClick={() => {
              // setActiveTab(link.id);
              toggleSidebar();
            }}
            // className={cn(
            //   `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${`${isAdmin ? "bg-indigo-600 shadow-indigo-500/20" : "bg-orange-600 shadow-orange-500/20"}`}`,
            //   activeTab === link.id && "bg-indigo-600 shadow-indigo-500/20",
            // )}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300",
              pathname === link.id
                ? isAdmin
                  ? "bg-indigo-600 shadow-indigo-500/20"
                  : "bg-orange-600 shadow-orange-500/20"
                : isAdmin
                  ? "hover:bg-slate-800 text-slate-400 dark:hover:text-white hover:translate-x-1"
                  : "hover:bg-slate-800 text-slate-400 dark:hover:text-white hover:translate-x-1",
            )}
          >
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 dark:border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all duration-300 group"
        >
          <LogOut
            size={16}
            className="group-hover:text-red-400 transition-colors"
          />
          <span className="group-hover:text-red-400 transition-colors">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
