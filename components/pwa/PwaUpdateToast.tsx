"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSerwistBroadcastUpdate } from "@/hooks";
import { RefreshCcw } from "lucide-react";

export default function PwaUpdateToast() {
  const { updates, clearUpdates } = useSerwistBroadcastUpdate();
  const hasToastedRef = useRef(false);

  useEffect(() => {
    // Only show the toast if we have updates and haven't toasted yet for this batch
    if (updates.length > 0 && !hasToastedRef.current) {
      hasToastedRef.current = true;

      toast("App update available", {
        icon: <RefreshCcw className="size-4 text-blue-500" />,
        description: "New update available.",
        duration: Number.POSITIVE_INFINITY, // Keep it visible until acted upon or dismissed
        action: {
          label: "Refresh",
          onClick: () => {
            clearUpdates();
            window.location.reload();
          },
        },
        cancel: {
          label: "Dismiss",
          onClick: () => {
            clearUpdates();
            hasToastedRef.current = false;
          },
        },
        onDismiss: () => {
          hasToastedRef.current = false;
        },
        onAutoClose: () => {
          hasToastedRef.current = false;
        },
      });
    }
  }, [updates, clearUpdates]);

  // This is a headless component that just handles the logic for the toast
  return null;
}
