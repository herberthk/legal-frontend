"use client";
import { useAuthStore } from "@/store";
import { signOut } from "@/lib";

import {
  CreditCard,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Scale,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
const Sidebar = () => {
  // const logout = useAuthStore((state) => state.logout);
  const isSidebarOpen = useAuthStore((state) => state.isSidebarOpen);
  const toggleSidebar = useAuthStore((state) => state.toggleSidebar);
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const router = useRouter();
  const onLogout = async () => {
    await signOut();
    toggleSidebar();
    router.push("/login");
  };
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 text-white flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } ${isAdmin ? "bg-slate-900 dark:bg-black" : "bg-slate-900 dark:bg-slate-950"}`}
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
            {isAdmin ? "Admin" : "Legal"}
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
        {/* Dashboard - Common */}
        <button
          onClick={() => {}}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
            `${isAdmin ? "bg-indigo-600 shadow-indigo-500/20" : "bg-orange-600 shadow-orange-500/20"}
                text-white font-medium shadow-lg translate-x-1`
            //   : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
          }`}
        >
          <LayoutDashboard size={20} className="animate-pulse" />
          <span>Dashboard</span>
        </button>

        {/* Role Specific Links */}
        {isAdmin ? (
          <>
            <button
              onClick={() => {}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                // currentView === View.USERS
                //   ? "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
                //   : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
              }`}
            >
              <Users size={20} />
              <span>User Management</span>
            </button>
            <button
              onClick={() => {}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                // currentView === View.ADMIN_COMPLAINTS
                //   ? "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
                //   : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
              }`}
            >
              <FileWarning size={20} />
              <span>User Complaints</span>
            </button>
            <div className="pt-4 mt-4 border-t border-slate-800">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                System
              </p>
              <button
                onClick={() => {}}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  //   currentView === View.CONFIGURATION
                  //     ? "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
                  //     : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                  "bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/20 translate-x-1"
                }`}
              >
                <Settings size={20} />
                <span>Configuration</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {}}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                // currentView === View.CHAT
                //   ? "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
                //   : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
              }`}
            >
              <MessageSquareText size={20} className="animate-pulse" />
              <span>Legal Chat</span>
            </button>

            <div className="pt-4 mt-4 border-t border-slate-800">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Account
              </p>
              <button
                onClick={() => {}}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  //   currentView === View.BILLING
                  //     ? "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
                  //     : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                  "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
                }`}
              >
                <CreditCard size={20} />
                <span>Billing & Usage</span>
              </button>
              <button
                onClick={() => {}}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  //   currentView === View.SUPPORT
                  //     ? "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
                  //     : "hover:bg-slate-800 text-slate-400 hover:text-white hover:translate-x-1"
                  "bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 translate-x-1"
                }`}
              >
                <LifeBuoy size={20} />
                <span>Help & Support</span>
              </button>
            </div>
          </>
        )}
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
