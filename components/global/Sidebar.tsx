"use client";
import { useAuthStore } from "@/store";
import { cn, signOut } from "@/lib";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";

import { LogOut, ChevronRight, ChevronsUpDown, Scale } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { sideBarItems } from "@/constants";
import { useEffect, useState, useMemo } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, Variants, AnimatePresence } from "framer-motion";
import React from "react";
import Logo, { LogoText } from "./Logo";
import { CustomLink } from "./transitions";

// Types
interface SidebarSubItem {
  id: string;
  label: string;
  href: string;
}

interface SidebarLink {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: SidebarSubItem[];
}

type Props = {
  user: User | null;
};

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -12, scale: 0.95 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25 },
  },
};

const navItemVariants: Variants = {
  initial: {
    x: 0,
    scale: 1,
  },
  hover: {
    x: 6,
    scale: 1.02,
    // boxShadow: "0 0 20px 5px rgba(255, 69, 0, 0.35)",
    // backgroundColor: "rgba(255, 69, 0, 0.05)",
    // border: "1px solid rgba(255, 69, 0, 0.35)",
    color: "rgba(255, 69, 0, 0.95)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  active: {
    x: 4,
    scale: 1.02,
    // boxShadow: "0 0 20px 6px rgba(255, 69, 0, 0.45)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  tap: {
    scale: 0.97,
    x: 2,
  },
};

const iconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.15,
    rotate: 5,
    transition: { type: "spring", stiffness: 400, damping: 10 },
  },
  active: {
    scale: 1.1,
    rotate: 0,
  },
};

const CollapsibleMenu = ({
  link,
  pathname,
  setOpenMobile,
  isAdmin,
}: {
  link: SidebarLink;
  pathname: string;
  setOpenMobile: (open: boolean) => void;
  isAdmin: boolean;
}) => {
  const isChildActive = useMemo(
    () => link.subItems?.some((sub) => pathname.startsWith(sub.id)),
    [link.subItems, pathname],
  );

  const isParentActive = pathname === link.href || isChildActive;
  const [isOpen, setIsOpen] = useState(isParentActive);

  // Sync state if path changes externally to a child
  if (isParentActive && !isOpen) {
    setIsOpen(true);
  }

  return (
    <SidebarMenuItem>
      <motion.div variants={itemVariants}>
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="group/collapsible"
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={link.label}
              className={cn(
                "relative flex items-center w-full gap-3 px-3 py-2.5 my-1 rounded-xl transition-all duration-300 group hover:bg-slate-100/50 dark:hover:bg-slate-800/40",
                isParentActive
                  ? "text-slate-900 dark:text-white font-bold"
                  : "text-slate-500 dark:text-slate-400 font-medium",
              )}
            >
              <AnimatePresence mode="wait">
                {isParentActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className={cn(
                      "absolute inset-0 rounded-xl z-0 shadow-lg",
                      isAdmin
                        ? "bg-linear-to-r from-indigo-600/10 to-indigo-600/5 dark:from-indigo-500/20 dark:to-indigo-500/10 border-l-4 border-indigo-600 dark:border-indigo-500"
                        : "bg-linear-to-r from-orange-600/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-500/10 border-l-4 border-orange-600 dark:border-orange-500",
                    )}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              <motion.div
                className="relative z-10 flex items-center w-full gap-3"
                variants={navItemVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <motion.div
                  variants={iconVariants}
                  animate={isParentActive ? "active" : "initial"}
                  className={cn(
                    isParentActive &&
                      (isAdmin
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-orange-600 dark:text-orange-400"),
                  )}
                >
                  {link.icon}
                </motion.div>
                <span className="flex-1 text-sm">{link.label}</span>
                <ChevronRight
                  className={cn(
                    "ml-auto w-4 h-4 transition-transform duration-300",
                    isOpen ? "rotate-90" : "opacity-40",
                  )}
                />
              </motion.div>
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent asChild forceMount>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, x: -10 }}
                  animate={{ height: "auto", opacity: 1, x: 0 }}
                  exit={{ height: 0, opacity: 0, x: -10 }}
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden"
                >
                  <SidebarMenuSub className="ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 space-y-1 my-1">
                    {link.subItems?.map((sub) => (
                      <SidebarMenuSubItem key={sub.id}>
                        <SidebarMenuSubButton asChild>
                          <CustomLink
                            href={sub.href}
                            onClick={() => setOpenMobile(false)}
                            className={cn(
                              "relative flex items-center w-full gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-300 group overflow-hidden",
                              pathname.startsWith(sub.id)
                                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:translate-x-1",
                            )}
                          >
                            <AnimatePresence mode="wait">
                              {pathname.startsWith(sub.id) && (
                                <motion.div
                                  layoutId="sub-active-pill"
                                  className={cn(
                                    "absolute inset-0 z-0 shadow-sm",
                                    isAdmin
                                      ? "bg-indigo-500/5 dark:bg-indigo-400/10"
                                      : "bg-orange-500/5 dark:bg-orange-400/10",
                                  )}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                />
                              )}
                            </AnimatePresence>
                            <span className="relative z-10">{sub.label}</span>
                          </CustomLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </SidebarMenuItem>
  );
};

const GlobalSidebar = ({ user }: Props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const clearUser = useAuthStore((state) => state.clearUser);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const router = useRouter();
  const { setOpenMobile, isMobile, openMobile } = useSidebar();

  useEffect(() => {
    if (!isMobile) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const swipeDistanceX = touchEndX - touchStartX;
      const swipeDistanceY = touchEndY - touchStartY;
      const swipeThreshold = 40;

      if (
        Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) &&
        Math.abs(swipeDistanceX) > swipeThreshold
      ) {
        if (swipeDistanceX > 0) {
          // Swiped right - open sidebar
          if (touchStartX < 150 && !openMobile) {
            setOpenMobile(true);
          }
        } else {
          // Swiped left - close sidebar
          if (openMobile) {
            setOpenMobile(false);
          }
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, {
        capture: true,
      });
      document.removeEventListener("touchend", handleTouchEnd, {
        capture: true,
      });
    };
  }, [isMobile, openMobile, setOpenMobile]);

  const onLogout = async () => {
    try {
      await firebaseSignOut(auth);
      await signOut();
      clearUser();
      router.push("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const navlinks = useMemo(
    () => sideBarItems(user?.role || "USER") as SidebarLink[],
    [user?.role],
  );
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [user, setUser]);

  const pathname = usePathname();
  const userName = user?.name || "User";
  const userEmail = user?.email || "";

  const sidebarBg = isAdmin
    ? "bg-linear-to-b! from-white! via-indigo-50/20! to-white! dark:from-slate-950! dark:via-indigo-950/20! dark:to-slate-950! border-r border-indigo-500/10 dark:border-indigo-400/5 backdrop-blur-xl"
    : "bg-linear-to-b! from-white! via-orange-50/20! to-white! dark:from-slate-950! dark:via-orange-950/20! dark:to-slate-950! border-r border-orange-500/10 dark:border-orange-400/5 backdrop-blur-xl";

  if (!mounted) {
    return (
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className={cn("transition-colors duration-200", sidebarBg)}
      />
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className={cn("transition-colors duration-300", sidebarBg)}
    >
      <SidebarHeader className="py-6 border-b-2! border-slate-200! dark:border-slate-800!">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent ring-0! focus:ring-0! focus:outline-none! "
            >
              <Scale className="w-8 h-8 text-orange-500 font-extrabold" />
              <LogoText />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <SidebarMenu className="gap-1">
              {navlinks?.map((link) => {
                if (link.subItems && link.subItems.length > 0) {
                  return (
                    <CollapsibleMenu
                      key={link.id}
                      link={link}
                      pathname={pathname}
                      setOpenMobile={setOpenMobile}
                      isAdmin={isAdmin}
                    />
                  );
                }

                return (
                  <SidebarMenuItem key={link.id}>
                    <motion.div variants={itemVariants}>
                      <SidebarMenuButton
                        asChild
                        tooltip={link.label}
                        className={cn(
                          "relative flex items-center w-full gap-3 px-3 py-2.5 my-1 rounded-xl transition-all duration-300 group hover:bg-slate-100/50 dark:hover:bg-slate-800/40",
                          pathname === link.href
                            ? "text-slate-900 dark:text-white font-bold"
                            : "text-slate-500 dark:text-slate-400 font-medium",
                        )}
                      >
                        <CustomLink
                          href={link.href}
                          onClick={() => setOpenMobile(false)}
                        >
                          <AnimatePresence mode="wait">
                            {pathname === link.href && (
                              <motion.div
                                layoutId="sidebar-active-pill"
                                className={cn(
                                  "absolute inset-0 rounded-xl z-0 shadow-lg",
                                  isAdmin
                                    ? "bg-linear-to-r from-indigo-600/10 to-indigo-600/5 dark:from-indigo-500/20 dark:to-indigo-500/10 border-l-4 border-indigo-600 dark:border-indigo-400"
                                    : "bg-linear-to-r from-orange-600/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-500/10 border-l-4 border-orange-600 dark:border-orange-400",
                                )}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 30,
                                }}
                              />
                            )}
                          </AnimatePresence>
                          <motion.div
                            className="relative z-10 flex items-center w-full gap-3"
                            variants={navItemVariants}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <motion.div
                              variants={iconVariants}
                              animate={
                                pathname === link.href ? "active" : "initial"
                              }
                              className={cn(
                                pathname === link.href &&
                                  (isAdmin
                                    ? "text-indigo-600 dark:text-indigo-500"
                                    : "text-orange-600 dark:text-orange-500"),
                              )}
                            >
                              {link.icon}
                            </motion.div>
                            <span className="text-sm">{link.label}</span>
                          </motion.div>
                        </CustomLink>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </motion.div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="py-6 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 transition-all duration-300 hover:shadow-xl group"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-105">
                      <AvatarImage src={user?.avatar || ""} alt={userName} />
                      <AvatarFallback
                        className={cn(
                          "rounded-xl text-white font-black",
                          isAdmin
                            ? "bg-indigo-600 shadow-indigo-500/20"
                            : "bg-orange-500 shadow-orange-500/20",
                        )}
                      >
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm bg-green-500",
                      )}
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-slate-900 dark:text-white">
                      {userName}
                    </span>
                    <span className="truncate text-[10px] opacity-60 uppercase tracking-tighter font-black">
                      {isAdmin ? "Administrator" : "Legal client"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-40" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-2xl p-2 shadow-2xl border-indigo-500/10 dark:border-indigo-400/10"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-3 font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white leading-none">
                      {userName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="opacity-50" />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/30 rounded-xl py-2.5 px-3 transition-colors duration-200"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="font-bold">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default GlobalSidebar;
