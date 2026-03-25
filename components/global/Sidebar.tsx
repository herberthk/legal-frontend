"use client";
import { useAuthStore } from "@/store";
import { cn, signOut } from "@/lib";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/firebase/client";

import {
  LogOut,
  Scale,
  Shield,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { sideBarItems } from "@/constants";
import Link from "next/link";
import { useEffect, useState } from "react";

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

type Props = {
  user: User;
};

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const navItemVariants: Variants = {
  initial: {
    x: 0,
    scale: 1,
    boxShadow: "0 0 0px 0px rgba(255, 69, 0, 0)",
    backgroundColor: "transparent",
  },
  hover: {
    x: 4,
    scale: 1.02,
    boxShadow: "0 0 20px 5px rgba(255, 69, 0, 0.35)",
    backgroundColor: "rgba(255, 69, 0, 0.05)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  active: {
    x: 4,
    scale: 1.02,
    // boxShadow: "0 0 20px 6px rgba(255, 69, 0, 0.45)",
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  tap: {
    scale: 0.98,
    // boxShadow: "0 0 8px 2px rgba(255, 69, 0, 0.2)",
  },
};

const floatingVariants: Variants = {
  initial: { y: 0 },
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

interface SidebarSubItem {
  id: string;
  label: string;
  href: string;
}

interface SidebarLink {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  subItems?: SidebarSubItem[];
}

const CollapsibleMenu = ({
  link,
  pathname,
  itemVariants,
  setOpenMobile,
  MotionLink,
}: {
  link: SidebarLink;
  pathname: string;
  itemVariants: Variants;
  setOpenMobile: (open: boolean) => void;
  MotionLink: React.ElementType;
}) => {
  const isParentActive =
    pathname === link.id ||
    link.subItems?.some((sub: SidebarSubItem) => pathname.startsWith(sub.id));

  const [isOpen, setIsOpen] = useState(isParentActive);

  // Sync open state when path changes to a child
  React.useEffect(() => {
    if (isParentActive) {
      setIsOpen(true);
    }
  }, [isParentActive]);

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
              isActive={pathname === link.id}
              className={cn(
                "transition-all duration-300",
                pathname === link.id &&
                  "bg-linear-to-r from-indigo-600 to-orange-500 text-white! shadow-lg",
              )}
            >
              <motion.div
                className="flex items-center w-full gap-2 px-2 py-1.5 rounded-lg"
                variants={navItemVariants}
                animate={pathname === link.id ? "active" : "initial"}
                whileHover="hover"
                whileTap="tap"
              >
                {link.icon}
                <span>{link.label}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </motion.div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <SidebarMenuSub>
                    {link.subItems?.map((sub: SidebarSubItem) => (
                      <SidebarMenuSubItem key={sub.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname.startsWith(sub.id)}
                          className="transition-all duration-300"
                        >
                          <MotionLink
                            href={sub.href}
                            onClick={() => setOpenMobile(false)}
                            className={cn(
                              "flex items-center w-full gap-2 px-2 py-1.5 rounded-lg transition-all duration-300",
                              pathname.startsWith(sub.id) &&
                                "bg-linear-to-r from-indigo-600 to-orange-500 text-white! shadow-lg",
                            )}
                            variants={navItemVariants}
                            animate={pathname.startsWith(sub.id) ? "active" : "initial"}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <span>{sub.label}</span>
                          </MotionLink>
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
    setMounted(true);
  }, []);

  type ExtendedUser = typeof user & {
    name?: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  };
  const extendedUser = user as ExtendedUser;

  const clearUser = useAuthStore((state) => state.clearUser);
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();

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
  const MotionLink = motion(Link);

  // Custom user fallback
  const userName =
    extendedUser?.name ||
    extendedUser?.displayName ||
    (isAdmin ? "Admin User" : "shadcn");
  const userEmail =
    extendedUser?.email || (isAdmin ? "admin@example.com" : "m@example.com");

  if (!mounted) {
    return (
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className={cn(
          "transition-colors duration-200",
          isAdmin
            ? "bg-linear-to-b! via-indigo-50/50! from-indigo-50/50! to-white! dark:from-indigo-500/70! dark:to-slate-900! border-slate-200! dark:border-slate-800!"
            : "bg-linear-to-b! from-amber-200! to-white! dark:from-slate-900! dark:via-indigo-900! dark:to-slate-900! border-slate-200! dark:border-slate-800!",
        )}
      />
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className={
        isAdmin
          ? "bg-linear-to-b! via-indigo-50/50! from-indigo-50/50! to-white! dark:from-indigo-500/70! dark:to-slate-900! border-slate-200! dark:border-slate-800!"
          : "bg-linear-to-b! from-amber-200! to-white! dark:from-slate-900! dark:via-indigo-900! dark:to-slate-900! border-slate-200! dark:border-slate-800!"
      }
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <motion.div
                    variants={floatingVariants}
                    initial="initial"
                    animate="animate"
                    className={cn(
                      "flex aspect-square size-8 items-center justify-center rounded-lg text-white shadow-lg transform transition-transform duration-500 hover:rotate-12 hover:scale-110 shrink-0",
                      isAdmin
                        ? "bg-linear-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
                        : "bg-linear-to-br from-amber-500 to-orange-600 shadow-orange-500/20",
                    )}
                  >
                    {isAdmin ? (
                      <Shield className="size-4" />
                    ) : (
                      <Scale className="size-4" />
                    )}
                  </motion.div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold dark:text-white text-slate-900 text-lg">
                      {isAdmin ? "Admin" : "Legal"}
                      <span
                        className={cn(
                          "ml-1 text-transparent bg-clip-text",
                          isAdmin
                            ? "bg-linear-to-r from-indigo-400 to-purple-500"
                            : "bg-linear-to-r from-amber-400 to-orange-500",
                        )}
                      >
                        {isAdmin ? " Panel" : " Adviser"}
                      </span>
                    </span>
                  </div>
                  {/* <ChevronsUpDown className="ml-auto size-4" /> */}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              {/* <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div
                      className={cn(
                        "flex aspect-square size-8 items-center justify-center rounded-lg text-white shadow-lg",
                        isAdmin
                          ? "bg-linear-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
                          : "bg-linear-to-br from-amber-500 to-orange-600 shadow-orange-500/20",
                      )}
                    >
                      {isAdmin ? (
                        <Shield className="size-4" />
                      ) : (
                        <Scale className="size-4" />
                      )}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold dark:text-white text-slate-900">
                        {isAdmin ? "Admin" : "Legal"}
                        <span
                          className={cn(
                            "ml-1 text-transparent bg-clip-text",
                            isAdmin
                              ? "bg-linear-to-r from-indigo-400 to-purple-500"
                              : "bg-linear-to-r from-amber-400 to-orange-500",
                          )}
                        >
                          {isAdmin ? " Panel" : " Adviser"}
                        </span>
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuContent> */}
            </DropdownMenu>
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
            <SidebarMenu>
              {navlinks.map((link) => {
                const hasSubItems = link.subItems && link.subItems.length > 0;
                const isParentActive =
                  pathname === link.id ||
                  link.subItems?.some(
                    (sub: { id: string }) => pathname === sub.id,
                  );

                if (hasSubItems) {
                  return (
                    <CollapsibleMenu
                      key={link.id}
                      link={link as SidebarLink}
                      pathname={pathname}
                      itemVariants={itemVariants}
                      setOpenMobile={setOpenMobile}
                      MotionLink={MotionLink}
                    />
                  );
                }

                return (
                  <SidebarMenuItem key={link.id}>
                    <motion.div variants={itemVariants}>
                      <SidebarMenuButton
                        asChild
                        tooltip={link.label}
                        isActive={isParentActive}
                        className="transition-all duration-300"
                      >
                        <MotionLink
                          href={link.href}
                          onClick={() => setOpenMobile(false)}
                          className={cn(
                            "flex items-center w-full gap-2 px-2 py-1.5 rounded-sm transition-all duration-300",
                            pathname === link.id &&
                              "bg-linear-to-r from-indigo-600 to-orange-500 text-white! shadow-lg",
                          )}
                          variants={navItemVariants}
                          animate={pathname === link.id ? "active" : "initial"}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          {link.icon}
                          <span>{link.label}</span>
                        </MotionLink>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </motion.div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={extendedUser?.photoURL || ""}
                      alt={userName}
                    />
                    <AvatarFallback
                      className={cn(
                        "rounded-lg text-white font-bold",
                        isAdmin ? "bg-indigo-600" : "bg-orange-500",
                      )}
                    >
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs">{userEmail}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={extendedUser?.photoURL || ""}
                        alt={userName}
                      />
                      <AvatarFallback
                        className={cn(
                          "rounded-lg text-white font-bold",
                          isAdmin ? "bg-indigo-600" : "bg-orange-500",
                        )}
                      >
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs">{userEmail}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer text-red-500 focus:text-red-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
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
