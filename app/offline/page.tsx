import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline | Legal Adviser",
  description: "You are currently offline.",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-4">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg">
          <WifiOff className="w-12 h-12 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            You&apos;re Offline
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            It looks like you&apos;ve lost your internet connection. We&apos;ll
            automatically reconnect when you&apos;re back online.
          </p>
        </div>
      </div>
    </div>
  );
}
