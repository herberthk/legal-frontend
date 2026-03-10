"use client";
import { useAuthStore } from "@/store";
import { cn, signOut } from "@/lib";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";

import { LogOut, Scale, Shield } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { sideBarItems } from "@/constants";
import Link from "next/link";
import { useEffect } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Props = {
  user: User;
};

const GlobalSidebar = ({ user }: Props) => {
  const clearUser = useAuthStore((state) => state.clearUser);
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  const onLogout = async () => {
    try {
      await firebaseSignOut(auth);
      await signOut(); // Server action to delete cookie
      clearUser();
      router.push("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };
  const navlinks = sideBarItems(user?.role);

  const setUser = useAuthStore((state) => state.setUser);
  useEffect(() => {
    if (user) {
      setUser(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const pathname = usePathname();

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className={
        isAdmin
          ? "bg-linear-to-b! via-indigo-50/50! from-indigo-50/50! to-white! dark:from-indigo-500/70! dark:to-slate-900! border-slate-200! dark:border-slate-800!"
          : "bg-linear-to-b! from-amber-200! to-white! dark:from-slate-900! dark:via-indigo-900! dark:to-slate-900!  border-slate-200! dark:border-slate-800!"
      }
    >
      <SidebarHeader className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <div
            className={`p-2 rounded-lg shadow-lg transform transition-transform duration-500 hover:rotate-12 hover:scale-110 shrink-0 ${
              isAdmin
                ? "bg-linear-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
                : "bg-linear-to-br! from-amber-500 to-orange-600 shadow-orange-500/20"
            }`}
          >
            {isAdmin ? (
              <Shield className="w-5 h-5 text-white" />
            ) : (
              <Scale className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight transition-colors truncate group-data-[collapsible=icon]:hidden">
            <span className="dark:text-white text-slate-900">
              {isAdmin ? "Admin" : "Legal"}
            </span>

            <span
              className={`text-transparent bg-clip-text ${
                isAdmin
                  ? "bg-linear-to-r from-indigo-400 to-purple-500"
                  : "bg-linear-to-r from-amber-400 to-orange-500"
              }`}
            >
              {isAdmin ? " Panel" : " Adviser"}
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarMenu>
            {navlinks.map((link) => {
              const isActive = pathname === link.id;
              return (
                <SidebarMenuItem key={link.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={link.label}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-6 rounded-xl transition-all duration-300",
                      isActive
                        ? isAdmin
                          ? "bg-indigo-600 shadow-indigo-500/20 text-white hover:bg-indigo-700 hover:text-white"
                          : "bg-orange-400! shadow-orange-500/40 text-white! hover:bg-orange-700 hover:text-white"
                        : isAdmin
                          ? "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 dark:hover:text-white"
                          : "hover:bg-orange-400! hover:text-slate-100 dark:hover:bg-slate-800! text-slate-500 dark:text-slate-400 dark:hover:text-white hover:translate-x-1",
                    )}
                  >
                    <Link href={link.href} onClick={() => setOpenMobile(false)}>
                      {link.icon}
                      <span className="group-data-[collapsible=icon]:hidden">
                        {link.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-200 dark:border-slate-800">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign Out" className="h-auto">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center space-x-2 py-4 rounded-lg text-slate-500 dark:text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all duration-300 group"
              >
                <LogOut
                  size={16}
                  className="group-hover:text-red-400 transition-colors"
                />
                <span className="group-hover:text-red-400 transition-colors group-data-[collapsible=icon]:hidden">
                  Sign Out
                </span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default GlobalSidebar;
