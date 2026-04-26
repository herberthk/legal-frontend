"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Initial state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You are back online!", {
        icon: <Wifi className="w-4 h-4" />,
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline.", {
        icon: <WifiOff className="w-4 h-4" />,
        description: "Please check your internet connection.",
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}
