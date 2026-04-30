"use client";
import { User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsSidebarProps {
  activeTab: "profile" | "permissions";
  setActiveTab: (tab: "profile" | "permissions") => void;
}

export function SettingsSidebar({ activeTab, setActiveTab }: SettingsSidebarProps) {
  return (
    <div className="w-full md:w-64 space-y-2">
      <Button
        variant="ghost"
        onClick={() => setActiveTab("profile")}
        className={cn(
          "w-full justify-start gap-2 transition-all duration-200",
          activeTab === "profile"
            ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <User className="size-4" />
        Profile Information
      </Button>
      <Button
        variant="ghost"
        onClick={() => setActiveTab("permissions")}
        className={cn(
          "w-full justify-start gap-2 transition-all duration-200",
          activeTab === "permissions"
            ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium"
            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
        )}
      >
        <ShieldCheck className="size-4" />
        App Permissions
      </Button>
    </div>
  );
}
