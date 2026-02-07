"use client";
import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Users, TrendingUp, Mic, Server } from "lucide-react";

const AdminDashboard = () => {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const tokenUsageHistory = useAppStore((state) => state.tokenUsageHistory);
  // Calculate stats from tokenHistory or use mocks
  const textTokens = tokenUsageHistory
    .filter((r) => r.unit === "TOKENS")
    .reduce((a, b) => a + b.amount, 0);
  const voiceSeconds = tokenUsageHistory
    .filter((r) => r.unit === "SECONDS")
    .reduce((a, b) => a + b.amount, 0);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            System Overview
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2">
            Platform metrics and resource consumption.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
            System Operational
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <Users size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Users
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            1,248
          </p>
          <p className="text-xs text-green-500 mt-1 flex items-center">
            <TrendingUp size={12} className="mr-1" /> +12% this week
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
              <Server size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Token Usage
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {(textTokens + 50000).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across all text models</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
              <Mic size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Voice Minutes
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {Math.floor((voiceSeconds + 12000) / 60).toLocaleString()}m
          </p>
          <p className="text-xs text-slate-500 mt-1">Processed via Live API</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Live Activity Feed
        </h3>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {tokenUsageHistory.length === 0 ? (
            <p className="text-slate-500 text-sm italic">
              No active requests momentarily.
            </p>
          ) : (
            tokenUsageHistory
              .slice(-10)
              .reverse()
              .map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${rec.unit === "TOKENS" ? "bg-blue-500" : "bg-purple-500"}`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {rec.type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rec.amount} {rec.unit.toLowerCase()} consumption
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {mounted
                      ? new Date(rec.timestamp).toLocaleTimeString()
                      : "--:--"}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
