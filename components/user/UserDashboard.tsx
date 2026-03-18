"use client";
import { PlusCircle } from "lucide-react";
import { FC, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import UsageHistory from "../admin/UsageHistory";
import UsageCards from "./UsageCards";
import VoiceSelection from "./VoiceSelection";
import UsageChart from "./UsageChart";
import VoiceConsultations from "./VoiceConsultations";
import SystemEvents from "./SystemEvents";
import TransactionList from "./TransactionList";

type Props = {
  user: User;
};

const UserDashboard: FC<Props> = ({ user }) => {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (user) {
      setUser(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Usage Chart */}
        <UsageChart />
        {/* Transactions List */}
        <TransactionList />
      </div>

      {/* Token Usage History */}
      <UsageHistory userId={user?.id} />

      {/* Voice Consultations Card */}
      <VoiceConsultations />

      {/* Recent System Activity Placeholder */}
      <SystemEvents />
    </div>
  );
};

export default UserDashboard;
