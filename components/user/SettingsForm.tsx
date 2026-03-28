"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Camera, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateUserProfile } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SettingsFormProps {
  user: User;
}

export default function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || "");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    startTransition(async () => {
      const result = await updateUserProfile({ name, avatar }, user.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto p-4 md:p-8 space-y-8"
    >
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar/Navigation for Settings - Simplified */}
        <div className="w-full md:w-64 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium"
          >
            <User className="size-4" />
            Profile Information
          </Button>
          {/* Add more settings categories here in the future */}
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-indigo-500 via-purple-500 to-orange-500" />

            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                Public profile
              </CardTitle>
              <CardDescription>
                Update your personal information and how it appears to others.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center sm:flex-row gap-6 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="relative group">
                  <Avatar className="h-24 w-24 ring-4 ring-indigo-500/10 ring-offset-2 ring-offset-background transition-all duration-300 group-hover:ring-indigo-500/30">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-110 transition-transform duration-200"
                  >
                    <Camera className="size-4 text-indigo-500" />
                    <input
                      id="avatar-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        // Implement image upload logic here if needed
                        toast.info("Image upload functionality coming soon!");
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Profile Photo
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px]">
                    Recommended: Square image, at least 400x400px.
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <Input
                    value={user.email}
                    disabled
                    className="h-11 bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-70"
                  />
                  <p className="text-[11px] text-slate-400">
                    Email cannot be changed as it is linked to your account
                    identity.
                  </p>
                </div>

                <div className="space-y-2 pt-4">
                  <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 flex gap-3">
                    <AlertCircle className="size-5 text-amber-600 dark:text-amber-500 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-400">
                        Identity Verification
                      </p>
                      <p className="text-xs text-amber-800/70 dark:text-amber-500/60 leading-relaxed">
                        Your display name is used across the platform for legal
                        documents and AI interactions. Please ensure it is
                        accurate.
                      </p>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>

            <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                Last updated:{" "}
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "Never"}
              </p>
              <Button
                onClick={handleUpdate}
                disabled={isPending || name === user.name}
                className={cn(
                  "order-1 sm:order-2 h-11 px-8 rounded-full font-semibold transition-all duration-300 shadow-lg",
                  name !== user.name
                    ? "bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/25"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none",
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
