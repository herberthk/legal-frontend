"use client";
import { PlusCircle } from "lucide-react";
import { FC, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import UsageHistory from "./UsageHistory";
import UsageCards from "./UsageCards";
import VoiceSelection from "./VoiceSelection";
import VoiceConsultations from "./VoiceConsultations";
import SystemEvents from "./SystemEvents";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import UsageChart (contains heavy Recharts)
const UsageChart = dynamic(() => import("./UsageChart"), {
  loading: () => <Skeleton className="h-[480px] w-full rounded-2xl" />,
  ssr: false,
});

type Props = {
  user: User;
};

const UserDashboard: FC<Props> = ({ user }) => {
  const setUser = useAuthStore((state) => state.setUser);

  // Sync user only if needed (e.g. on first load if store is empty)
  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [user, setUser]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2">
            Track your daily free credits and account balance.
          </p>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95">
          <PlusCircle size={18} />
          <span>Add Funds</span>
        </button>
      </div>

      {/* Balance & Usage Cards */}
      <UsageCards user={user} />

      {/* Voice Selection */}
      <VoiceSelection />

      <div className="w-full">
        {/* Usage Chart */}
        <UsageChart />
      </div>

      {/* Token Usage History */}
      {/* <UsageHistory userId={user?.id} /> */}

      {/* Voice Consultations Card */}
      <VoiceConsultations isDashboard={true} />

      {/* Recent System Activity Placeholder */}
      <SystemEvents />
    </div>
  );
};

export default UserDashboard;
