"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { CustomButton } from "@/components/ui/custom-button";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { storage } from "@/firebase/client";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { BUCKETS } from "@/constants/buckets";
import { updateUserProfile } from "@/lib/actions/user";
import { formatUniversalDate, resizeImage } from "@/utils";
import { cn } from "@/lib/utils";

type UploadStage =
  | "initializing"
  | "resizing"
  | "uploading"
  | "finishing"
  | "idle";

interface ProfileSettingsProps {
  user: User;
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty", { style: { background: "red" } });
      return;
    }

    startTransition(async () => {
      const result = await updateUserProfile({ name, avatar }, user.id);
      if (result.success) {
        toast.success(result.message, { style: { background: "green" } });
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file", {
        style: { background: "red" },
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage("initializing");

    try {
      // Step 1: Resizing (if needed)
      setUploadStage("resizing");
      setUploadProgress(20); // Arbitrary progress for starting resizing
      const processedFile = await resizeImage(file, 400, 400);
      setUploadProgress(40); // Done resizing

      // Step 2: Uploading to Firebase
      setUploadStage("uploading");
      const fileName = `${user.id}_${Date.now()}_${processedFile.name}`;
      const storageRef = ref(
        storage,
        `${BUCKETS.STORED_FILES}/profiles/${fileName}`,
      );
      const uploadTask = uploadBytesResumable(storageRef, processedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Map 0-100% of upload to 40-90% of overall progress
          const uploadPercent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const progress = 40 + uploadPercent * 0.5;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          toast.error("Failed to upload image");
          setIsUploading(false);
          setUploadStage("idle");
        },
        async () => {
          // Step 3: Finishing up (Cleaning up old avatar and updating DB)
          setUploadStage("finishing");
          setUploadProgress(95);

          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (avatar && avatar.includes("firebasestorage.googleapis.com")) {
            try {
              const oldAvatarRef = ref(storage, avatar);
              await deleteObject(oldAvatarRef);
            } catch (error) {
              console.error("Failed to delete old avatar:", error);
            }
          }

          setAvatar(downloadURL);
          const result = await updateUserProfile(
            { avatar: downloadURL },
            user.id,
          );
          if (result.success) {
            setUploadProgress(100);
            toast.success("Profile photo updated successfully", {
              style: { background: "green" },
            });
            router.refresh();
          } else {
            toast.error(result.message);
          }

          // Small delay before hiding the loader for premium feel
          setTimeout(() => {
            setIsUploading(false);
            setUploadStage("idle");
            setUploadProgress(0);
          }, 800);
        },
      );
    } catch (error) {
      console.error("Error in upload flow:", error);
      toast.error("An unexpected error occurred during upload");
      setIsUploading(false);
      setUploadStage("idle");
    }
  };

  return (
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
        <div className="flex flex-col items-center sm:flex-row gap-6 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="relative group">
            <div className="relative">
              <Avatar
                className={cn(
                  "h-24 w-24 ring-4 ring-indigo-500/10 ring-offset-2 ring-offset-background transition-all duration-300 group-hover:ring-indigo-500/30",
                  isUploading && "opacity-40",
                )}
              >
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <AnimatePresence>
                {isUploading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-10"
                  >
                    <CircularProgress
                      progress={uploadProgress}
                      size={80}
                      strokeWidth={6}
                      label={uploadStage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <label
              htmlFor="avatar-upload"
              className={cn(
                "absolute bottom-0 right-0 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-110 transition-transform duration-200",
                isUploading && "pointer-events-none opacity-50",
              )}
            >
              {isUploading ? (
                <Loader2 className="size-4 text-indigo-500 animate-spin" />
              ) : (
                <Camera className="size-4 text-indigo-500" />
              )}
              <input
                id="avatar-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Profile Photo
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px]">
              Recommended: Square image
            </p>
          </div>
        </div>

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
              Email cannot be changed as it is linked to your account identity.
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
                  documents and AI interactions. Please ensure it is accurate.
                </p>
              </div>
            </div>
          </div>
        </form>
      </CardContent>

      <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
          Last updated:{" "}
          {user.updatedAt ? formatUniversalDate(user.updatedAt) : "Never"}
        </p>
        <CustomButton
          onClick={handleUpdate}
          isLoading={isPending}
          disabled={isPending || name === user.name}
          variant="transparent"
          shape="rounded"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50 uppercase order-1 sm:order-2"
          leftIcon={<CheckCircle2 size={16} />}
          hoverEffect="glow"
        >
          Update
        </CustomButton>
      </CardFooter>
    </Card>
  );
}
