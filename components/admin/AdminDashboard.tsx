"use client";

import React, { useState, useEffect } from "react";
import { Users, Mic, Server, DollarSign, Activity, ChevronRight } from "lucide-react";
import { getAdminOverviewStats, AdminOverviewStats } from "@/lib/actions/admin";
import { useThemeStore } from "@/store";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";
import AdminRevenue from "./AdminRevenue";


interface AdminDashboardProps {
  initialStats: AdminOverviewStats;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981"];

const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl backdrop-blur-md bg-opacity-95">
        <p className="text-sm font-black text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
          {new Date(label).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((item: any) => {
            if (item.name.includes("Cost")) {
              const usd = Number(item.value);
              const ugx = Math.round(usd * USD_TO_UGX_EXCHANGE_RATE);
              return (
                <div key={item.name} className="flex gap-2">
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                    {item.name}:
                  </p>
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 leading-tight">
                    ${usd.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    UGX {ugx.toLocaleString()}
                  </p>
                </div>
              );
            }
            if (item.dataKey === "cost" && item.stroke === "none") return null;

            return (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.stroke || item.fill }}
                />
                <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-900 dark:text-white">
                  {item.dataKey === "voiceSeconds"
                    ? formatDuration(item.value)
                    : item.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const AdminDashboard = ({ initialStats }: AdminDashboardProps) => {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const [stats, setStats] = useState<AdminOverviewStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Poll every 30 seconds
    const intervalId = setInterval(async () => {
      setIsRefreshing(true);
      try {
        const res = await getAdminOverviewStats();
        if (res.success && res.stats) {
          setStats(res.stats);
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setIsRefreshing(false);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const pieData = [
    { name: "Chat ($)", value: Number(stats.chatCostUsd.toFixed(2)) },
    { name: "Transcription ($)", value: Number(stats.transcriptionCostUsd.toFixed(2)) },
    { name: "Voice ($)", value: Number(stats.voiceCostUsd.toFixed(2)) },
  ];

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
          <div
            className={`w-2 h-2 rounded-full bg-green-500 ${
              isRefreshing ? "animate-pulse" : ""
            }`}
          ></div>
          <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
            {isRefreshing ? "Syncing..." : "Live"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                  <Users size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Users
                </span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
              {stats.totalUsers.toLocaleString()}
            </p>
          </div>
          <Link
            href="/admin/users"
            className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center hover:underline"
          >
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Tokens Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <Server size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Token Usage
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalTokens.toLocaleString()}
            </p>
          </div>
          <Link
            href="/admin/usage"
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center hover:underline"
          >
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Voice Sessions Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                <Mic size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Voice Sessions
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalVoiceSessions.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {Math.floor(stats.totalVoiceSeconds / 60).toLocaleString()} total minutes
            </p>
          </div>
          <Link
            href="/admin/usage?tab=voice"
            className="mt-4 text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center hover:underline"
          >
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Cost Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Cost (All)
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              ${stats.totalCostUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              UGX{" "}
              {stats.totalCostUgx.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <Link
            href="/admin/revenue"
            className="mt-4 text-sm text-green-600 dark:text-green-400 font-medium flex items-center hover:underline"
          >
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-slate-400" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Usage Trend (Last 30 Days)
            </h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeSeriesData}>
                <defs>
                  <linearGradient id="colorChat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTranscription" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  label={{
                    value: "Tokens",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    style: { fontSize: 12, fill: "#64748b" },
                  }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v: number) => `${(v / 60).toFixed(0)}m`}
                  label={{
                    value: "Voice (min)",
                    angle: 90,
                    position: "insideRight",
                    offset: 10,
                    style: { fontSize: 12, fill: "#64748b" },
                  }}
                />
                <Tooltip 
                  cursor={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  content={<CustomAreaTooltip />}
                />
                <Legend />
                <Area 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="chatTokens" 
                  name="Chat Tokens" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorChat)" 
                />
                <Area 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="transcriptionTokens" 
                  name="Transcription Tokens" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTranscription)" 
                />
                <Area 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="voiceSeconds" 
                  name="Voice Duration" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVoice)" 
                />
                <Area
                  yAxisId="left"
                  dataKey="cost"
                  name="Estimated Cost (USD)"
                  stroke="none"
                  fill="none"
                  legendType="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Cost Breakdown (USD)
          </h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    borderColor: isDark ? '#1e293b' : '#f1f5f9', 
                    color: isDark ? '#f8fafc' : '#0f172a',
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  itemStyle={{ color: isDark ? '#e2e8f0' : '#334155' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <AdminRevenue stats={stats} />
    </div>
  );
};

export default AdminDashboard;
