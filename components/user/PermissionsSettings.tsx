"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Settings2, Mic, Video } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFCMPushNotifications } from "@/hooks/use-fcm-push-notifications";
import { cn } from "@/lib/utils";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

const PermissionItem = ({
  icon: Icon,
  title,
  description,
  state,
  onEnable,
  showEnable,
  instructions,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  state: string;
  onEnable?: () => void;
  showEnable?: boolean;
  instructions: string[];
}) => (
  <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "p-3 rounded-xl shrink-0",
          state === "granted"
            ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
            : "bg-slate-200 dark:bg-slate-800 text-slate-500",
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-white">
            {title}
          </h4>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              state === "granted"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : state === "denied"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
            )}
          >
            {state}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
    </div>

    {state === "denied" && (
      <div className="mt-2 bg-red-50/50 dark:bg-red-950/10 rounded-xl p-4 border border-red-200/50 dark:border-red-900/20">
        <h5 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
          <Settings2 className="size-4" /> How to enable {title} manually:
        </h5>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-red-700 dark:text-red-500/80">
          {instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    )}

    {showEnable && state !== "granted" && state !== "denied" && (
      <Button
        onClick={onEnable}
        variant="outline"
        size="sm"
        className="w-full mt-2"
      >
        Request Permission
      </Button>
    )}
  </div>
);

export function PermissionsSettings() {
  const {
    permission: notificationPermission,
    isSupported: isNotificationsSupported,
    requestPermission: requestNotificationPermission,
  } = useFCMPushNotifications();
  const [micPermission, setMicPermission] =
    useState<PermissionState>("default");
  const [cameraPermission, setCameraPermission] =
    useState<PermissionState>("default");

  useEffect(() => {
    // Check Microphone
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((res) => {
        setMicPermission(res.state as PermissionState);
        res.onchange = () => setMicPermission(res.state as PermissionState);
      })
      .catch(() => setMicPermission("default"));

    // Check Camera
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((res) => {
        setCameraPermission(res.state as PermissionState);
        res.onchange = () => setCameraPermission(res.state as PermissionState);
      })
      .catch(() => setCameraPermission("default"));
  }, []);

  return (
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
        <PermissionItem
          icon={notificationPermission === "granted" ? Bell : BellOff}
          title="Push Notifications"
          description="Receive real-time updates when your voice sessions are processed."
          state={notificationPermission}
          onEnable={requestNotificationPermission}
          showEnable={isNotificationsSupported}
          instructions={[
            "Click the Lock (🔒) or Tune (⚙️) icon next to the website address in your browser bar.",
            "Find Notifications in the list.",
            'Change the setting from "Block" to "Allow".',
            "Reload this page.",
          ]}
        />

        <PermissionItem
          icon={Mic}
          title="Microphone"
          description="Required to speak with the AI Legal Adviser during voice sessions."
          state={micPermission}
          instructions={[
            "Click the Lock (🔒) or Tune (⚙️) icon next to the website address in your browser bar.",
            "Find Microphone in the list.",
            'Change the setting from "Block" to "Allow".',
            "Reload this page.",
          ]}
        />

        <PermissionItem
          icon={Video}
          title="Camera"
          description="Required to capture images of documents for OCR and AI analysis."
          state={cameraPermission}
          instructions={[
            "Click the Lock (🔒) or Tune (⚙️) icon next to the website address in your browser bar.",
            "Find Camera in the list.",
            'Change the setting from "Block" to "Allow".',
            "Reload this page.",
          ]}
        />
      </CardContent>
    </Card>
  );
}
