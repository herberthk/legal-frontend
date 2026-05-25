"use client";

import { useEffect, useState } from "react";
import { formatUniversalDate } from "@/utils";

interface ClientFormattedDateProps {
  date: string | number | Date | { toDate: () => Date } | null | undefined;
  className?: string;
}

export default function ClientFormattedDate({ date, className }: ClientFormattedDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a subtle animated skeleton loader during SSR to avoid hydration mismatch
    return (
      <span
        className={`animate-pulse bg-slate-200 dark:bg-slate-800/80 h-4 w-28 rounded-md inline-block align-middle ${className || ""}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {formatUniversalDate(date)}
    </span>
  );
}
