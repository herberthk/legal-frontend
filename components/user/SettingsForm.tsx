"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bell,
  BellOff,
  Settings2,
  ShieldCheck,
  Mic,
  Video,
} from "lucide-react";
import { useFCMPushNotifications } from "@/hooks/use-fcm-push-notifications";
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
import { formatUniversalDate } from "@/utils";
import { CustomButton } from "@/components/ui/custom-button";
import { storage } from "@/firebase/client";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { BUCKETS } from "@/constants/buckets";
import { CircularProgress } from "@/components/ui/CircularProgress";

interface SettingsFormProps {
  user: User;
}

export default function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"profile" | "permissions">(
    "profile",
  );
  const {
    permission: notificationPermission,
    isSupported: isNotificationsSupported,
    requestPermission: requestNotificationPermission,
  } = useFCMPushNotifications();
  const [micPermission, setMicPermission] = useState<PermissionState>("prompt");
  const [cameraPermission, setCameraPermission] =
    useState<PermissionState>("prompt");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Check Microphone
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((res) => {
        setMicPermission(res.state);
        res.onchange = () => setMicPermission(res.state);
      })
      .catch(() => setMicPermission("prompt"));

    // Check Camera
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((res) => {
        setCameraPermission(res.state);
        res.onchange = () => setCameraPermission(res.state);
      })
      .catch(() => setCameraPermission("prompt"));
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name cannot be empty", {
        style: {
          background: "red",
        },
      });
      return;
    }

    startTransition(async () => {
      const result = await updateUserProfile({ name, avatar }, user.id);
      if (result.success) {
        toast.success(result.message, {
          style: {
            background: "green",
          },
        });
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file", {
        style: {
          background: "red",
        },
      });
      return;
    }

    // Validate file size (e.g., 1MB)
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Image size should be less than 1MB", {
        style: {
          background: "red",
        },
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileName = `${user.id}_${Date.now()}_${file.name}`;
      const storageRef = ref(
        storage,
        `${BUCKETS.STORED_FILES}/profiles/${fileName}`,
      );
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          toast.error("Failed to upload image");
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Delete old avatar from storage if it was a Firebase Storage URL
          if (avatar && avatar.includes("firebasestorage.googleapis.com")) {
            try {
              const oldAvatarRef = ref(storage, avatar);
              await deleteObject(oldAvatarRef);
              console.log("Old avatar deleted successfully");
            } catch (error) {
              console.error("Failed to delete old avatar:", error);
              // We don't block the flow if deletion fails (e.g., file already deleted or permissions)
            }
          }

          setAvatar(downloadURL);

          // Automatically update the database
          const result = await updateUserProfile(
            { avatar: downloadURL },
            user.id,
          );

          if (result.success) {
            toast.success("Profile photo updated successfully", {
              style: { background: "green" },
            });
            router.refresh();
          } else {
            toast.error(result.message);
          }

          setIsUploading(false);
          setUploadProgress(0);
        },
      );
    } catch (error) {
      console.error("Error in upload flow:", error);
      toast.error("An unexpected error occurred during upload");
      setIsUploading(false);
    }
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

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === "profile" ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-indigo-500 via-purple-500 to-orange-500" />

                  <CardHeader className="pt-8">
                    <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                      Public profile
                    </CardTitle>
                    <CardDescription>
                      Update your personal information and how it appears to
                      others.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Avatar Section */}
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

                          {/* Progress Overlay */}
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
                          Email cannot be changed as it is linked to your
                          account identity.
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
                              Your display name is used across the platform for
                              legal documents and AI interactions. Please ensure
                              it is accurate.
                            </p>
                          </div>
                        </div>
                      </div>
                    </form>
                  </CardContent>

                  <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                      Last updated:{" "}
                      {user.updatedAt
                        ? formatUniversalDate(user.updatedAt)
                        : "Never"}
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
              </motion.div>
            ) : (
              <motion.div
                key="permissions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />

                  <CardHeader className="pt-8">
                    <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                      App Permissions
                    </CardTitle>
                    <CardDescription>
                      Manage how Legal Adviser accesses your device features.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Notifications Permission */}
                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl shrink-0",
                            notificationPermission === "granted"
                              ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500",
                          )}
                        >
                          {notificationPermission === "granted" ? (
                            <Bell className="size-6" />
                          ) : (
                            <BellOff className="size-6" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              Push Notifications
                            </h4>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                notificationPermission === "granted"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : notificationPermission === "denied"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                              )}
                            >
                              {notificationPermission}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Receive real-time updates when your voice sessions
                            are processed.
                          </p>
                        </div>
                      </div>

                      {notificationPermission === "denied" && (
                        <div className="mt-2 bg-red-50/50 dark:bg-red-950/10 rounded-xl p-4 border border-red-200/50 dark:border-red-900/20">
                          <h5 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                            <Settings2 className="size-4" /> How to enable
                            Notifications manually:
                          </h5>
                          <ol className="list-decimal pl-5 space-y-1 text-xs text-red-700 dark:text-red-500/80">
                            <li>
                              Click the <strong>Lock (🔒)</strong> or{" "}
                              <strong>Tune (⚙️)</strong> icon next to the
                              website address in your browser bar.
                            </li>
                            <li>
                              Find <strong>Notifications</strong> in the list.
                            </li>
                            <li>
                              Change the setting from &quot;Block&quot; to{" "}
                              <strong>&quot;Allow&quot;</strong>.
                            </li>
                            <li>Reload this page.</li>
                          </ol>
                        </div>
                      )}
                      {notificationPermission !== "granted" &&
                        notificationPermission !== "denied" &&
                        isNotificationsSupported && (
                          <Button
                            onClick={requestNotificationPermission}
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                          >
                            Request Permission
                          </Button>
                        )}
                    </div>

                    {/* Microphone Permission */}
                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl shrink-0",
                            micPermission === "granted"
                              ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500",
                          )}
                        >
                          <Mic className="size-6" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              Microphone
                            </h4>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                micPermission === "granted"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : micPermission === "denied"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                              )}
                            >
                              {micPermission}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Required to speak with the AI Legal Adviser during
                            voice sessions.
                          </p>
                        </div>
                      </div>

                      {micPermission === "denied" && (
                        <div className="mt-2 bg-red-50/50 dark:bg-red-950/10 rounded-xl p-4 border border-red-200/50 dark:border-red-900/20">
                          <h5 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                            <Settings2 className="size-4" /> How to enable
                            Microphone manually:
                          </h5>
                          <ol className="list-decimal pl-5 space-y-1 text-xs text-red-700 dark:text-red-500/80">
                            <li>
                              Click the <strong>Lock (🔒)</strong> or{" "}
                              <strong>Tune (⚙️)</strong> icon next to the
                              website address in your browser bar.
                            </li>
                            <li>
                              Find <strong>Microphone</strong> in the list.
                            </li>
                            <li>
                              Change the setting from &quot;Block&quot; to{" "}
                              <strong>&quot;Allow&quot;</strong>.
                            </li>
                            <li>Reload this page.</li>
                          </ol>
                        </div>
                      )}
                    </div>

                    {/* Camera Permission */}
                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl shrink-0",
                            cameraPermission === "granted"
                              ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500",
                          )}
                        >
                          <Video className="size-6" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              Camera
                            </h4>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                cameraPermission === "granted"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : cameraPermission === "denied"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                              )}
                            >
                              {cameraPermission}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Required to capture images of documents for OCR and
                            AI analysis.
                          </p>
                        </div>
                      </div>

                      {cameraPermission === "denied" && (
                        <div className="mt-2 bg-red-50/50 dark:bg-red-950/10 rounded-xl p-4 border border-red-200/50 dark:border-red-900/20">
                          <h5 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                            <Settings2 className="size-4" /> How to enable
                            Camera manually:
                          </h5>
                          <ol className="list-decimal pl-5 space-y-1 text-xs text-red-700 dark:text-red-500/80">
                            <li>
                              Click the <strong>Lock (🔒)</strong> or{" "}
                              <strong>Tune (⚙️)</strong> icon next to the
                              website address in your browser bar.
                            </li>
                            <li>
                              Find <strong>Camera</strong> in the list.
                            </li>
                            <li>
                              Change the setting from &quot;Block&quot; to{" "}
                              <strong>&quot;Allow&quot;</strong>.
                            </li>
                            <li>Reload this page.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
