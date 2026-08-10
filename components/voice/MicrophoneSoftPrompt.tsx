"use client";

import React, { useEffect, useState, ReactNode } from "react";
import { Mic, MicOff, Settings, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  parkMicStream,
  releaseMicStream,
  requestMicStream,
} from "@/hooks/use-gemini-live/mic-stream";

interface MicrophoneSoftPromptProps {
  children: ReactNode;
}

type MicState = "checking" | "prompt" | "granted" | "denied";

export function MicrophoneSoftPrompt({ children }: MicrophoneSoftPromptProps) {
  const [micState, setMicState] = useState<MicState>("checking");
  const [isRequesting, setIsRequesting] = useState(false);

  const checkPermission = async () => {
    // Firefox does not accept "microphone" as a PermissionName and rejects
    // with a TypeError (Bugzilla 1449783), so this path is Chrome-only.
    try {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      setMicState(result.state as MicState);

      // Listen for changes (e.g., if user changes it in browser settings while page is open)
      result.onchange = () => {
        setMicState(result.state as MicState);
      };
      return;
    } catch (err) {
      console.warn("Permissions API not fully supported", err);
    }

    // Fallback for Firefox/Safari: a previously-granted mic permission is
    // detectable without prompting, because device labels are only exposed
    // once the user has granted access. Empty labels ⇒ not yet granted.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      if (inputs.length > 0 && inputs.some((d) => d.label !== "")) {
        setMicState("granted");
        return;
      }
    } catch {
      // enumerateDevices can throw in locked-down contexts — fall through
    }

    setMicState("prompt");
  };

  useEffect(() => {
    checkPermission();
  }, []);

  const requestAccess = async () => {
    setIsRequesting(true);
    try {
      const stream = await requestMicStream();
      // Park the live stream rather than stopping it — Firefox ties an
      // un-remembered grant to the stream's lifetime, so stopping here would
      // make the session's getUserMedia prompt a second time.
      parkMicStream(stream);
      setMicState("granted");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Microphone access failed", err);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setMicState("denied");
      }
    } finally {
      setIsRequesting(false);
    }
  };

  // Release the parked stream if the user leaves before starting a call.
  // Once the session claims it, the holder is empty and this is a no-op.
  useEffect(() => releaseMicStream, []);

  if (micState === "checking") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[60vh]">
        <Loader2 className="size-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-sm text-slate-500">
          Checking microphone access...
        </p>
      </div>
    );
  }

  if (micState === "granted") {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 min-h-[80vh] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-200/50 dark:border-slate-800/50 relative z-10 text-center"
      >
        <div className="mx-auto w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100 dark:border-indigo-800/50">
          {micState === "denied" ? (
            <MicOff className="size-10 text-red-500" />
          ) : (
            <Mic className="size-10 text-indigo-600 dark:text-indigo-400" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {micState === "denied" ? "Microphone Blocked" : "Microphone Access"}
        </h2>

        {micState === "denied" ? (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              We can&apos;t hear you because microphone access is blocked. To
              start a voice session, you need to allow microphone access in your
              browser settings.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 text-left">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 text-sm">
                <Settings className="size-4" /> How to fix this:
              </h4>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 marker:text-slate-400">
                <li>
                  Click the <strong>Lock (🔒)</strong> or{" "}
                  <strong>Tune (⚙️)</strong> icon next to the website address in
                  your browser bar.
                </li>
                <li>
                  Find <strong>Microphone</strong> in the list.
                </li>
                <li>
                  Change the setting from &quot;Block&quot; to{" "}
                  <strong>&quot;Allow&quot;</strong>.
                </li>
                <li>Reload this page to try again.</li>
              </ol>
            </div>

            <Button
              onClick={() => window.location.reload()}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 text-base font-medium"
            >
              I&apos;ve enabled it, reload page
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              To have a real-time conversation with the AI Legal Adviser, we
              need access to your microphone.
            </p>

            <div className="flex items-start gap-3 text-left p-4 bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
              <ShieldAlert className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800/80 dark:text-amber-500/80">
                Your audio is processed securely and is never shared with third
                parties.
              </p>
            </div>

            <Button
              onClick={requestAccess}
              disabled={isRequesting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 text-base font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                "Grant Microphone Access"
              )}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
