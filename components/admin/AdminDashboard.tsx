"use client";

import React, { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { Users, Mic, Server, DollarSign, Activity, ChevronRight, Calendar, RefreshCw } from "lucide-react";
import {
  getAdminOverviewStats,
  getAdminOverviewStatsByRange,
  AdminOverviewStats,
  DateRangeInput,
} from "@/lib/actions/admin";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminDashboardProps {
  initialStats: AdminOverviewStats;
}

type PresetKey = "7d" | "30d" | "90d" | "6m" | "1y" | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  days?: number; // undefined for "custom"
}

const PRESETS: Preset[] = [
  { key: "7d",  label: "Last 7 days",   days: 7   },
  { key: "30d", label: "Last 30 days",  days: 30  },
  { key: "90d", label: "Last 90 days",  days: 90  },
  { key: "6m",  label: "Last 6 months", days: 183 },
  { key: "1y",  label: "Last 1 year",   days: 365 },
  { key: "custom", label: "Custom",               },
];

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toISODate = (d: Date): string => d.toISOString().split("T")[0];

const buildRangeForPreset = (days: number): DateRangeInput => {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const fmtAxisDate = (val: string, diffDays: number) => {
  const d = new Date(val);
  if (diffDays <= 90) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffDays <= 365) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl backdrop-blur-md bg-opacity-95">
        <p className="text-sm font-black text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
          {new Date(label).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((item: any) => {
            if (item.name.includes("Cost")) {
              const usd = Number(item.value);
              const ugx = Math.round(usd * USD_TO_UGX_EXCHANGE_RATE);
              return (
                <div key={item.name} className="flex gap-2">
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider">{item.name}:</p>
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 leading-tight">${usd.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">UGX {ugx.toLocaleString()}</p>
                </div>
              );
            }
            if (item.dataKey === "cost" && item.stroke === "none") return null;
            return (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.fill }} />
                <p className="text-[10px] font-bold text-slate-400 tracking-wider">{item.name}</p>
                <p className="text-[10px] text-slate-900 dark:text-white">
                  {item.dataKey === "voiceSeconds" ? formatDuration(item.value) : item.value.toLocaleString()}
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

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminDashboard = ({ initialStats }: AdminDashboardProps) => {
  const theme  = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  // Default: last 30 days
  const [activePreset, setActivePreset] = useState<PresetKey>("30d");
  const [stats, setStats]               = useState<AdminOverviewStats>(initialStats);
  const [isPending, startTransition]    = useTransition();

  // Custom date inputs
  const initialRange = buildRangeForPreset(30);
  const [customStart, setCustomStart] = useState(initialRange.startDate);
  const [customEnd,   setCustomEnd  ] = useState(initialRange.endDate);
  const [showCustom,  setShowCustom ] = useState(false);

  // Debounce timer ref for custom range
  const customDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Diff in days for axis tick formatting
  const diffDays = Math.ceil(
    (new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24),
  );

  // ── Fetch by range ──────────────────────────────────────────────────────────
  const fetchByRange = useCallback((range: DateRangeInput) => {
    startTransition(async () => {
      const res = await getAdminOverviewStatsByRange(range);
      if (res.success && res.stats) setStats(res.stats);
    });
  }, []);

  // ── Handle preset click ─────────────────────────────────────────────────────
  const handlePreset = useCallback((preset: Preset) => {
    setActivePreset(preset.key);
    if (preset.key === "custom") {
      setShowCustom(true);
      return; // wait for user to pick dates
    }
    setShowCustom(false);
    const range = buildRangeForPreset(preset.days!);
    setCustomStart(range.startDate);
    setCustomEnd(range.endDate);
    fetchByRange(range);
  }, [fetchByRange]);

  // ── Handle custom date change (debounced 600ms) ──────────────────────────────
  const handleCustomDateChange = useCallback((start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      if (start && end && start <= end) {
        fetchByRange({ startDate: start, endDate: end });
      }
    }, 600);
  }, [fetchByRange]);

  // ── Live-polling (30s) — respects active filter ─────────────────────────────
  useEffect(() => {
    const poll = async () => {
      if (activePreset === "custom") {
        if (customStart && customEnd && customStart <= customEnd) {
          const res = await getAdminOverviewStatsByRange({ startDate: customStart, endDate: customEnd });
          if (res.success && res.stats) setStats(res.stats);
        }
      } else if (activePreset === "30d") {
        // "All time" totals for the default view match the original action
        const res = await getAdminOverviewStats();
        if (res.success && res.stats) setStats(res.stats);
      } else {
        const preset = PRESETS.find((p) => p.key === activePreset);
        if (preset?.days) {
          const res = await getAdminOverviewStatsByRange(buildRangeForPreset(preset.days));
          if (res.success && res.stats) setStats(res.stats);
        }
      }
    };

    const intervalId = setInterval(poll, 30_000);
    return () => clearInterval(intervalId);
  }, [activePreset, customStart, customEnd]);

  // ── Cleanup debounce on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const pieData = [
    { name: "Chat ($)",          value: Number(stats.chatCostUsd.toFixed(2))          },
    { name: "Transcription ($)", value: Number(stats.transcriptionCostUsd.toFixed(2)) },
    { name: "Voice ($)",         value: Number(stats.voiceCostUsd.toFixed(2))          },
  ];

  const activePresetObj = PRESETS.find((p) => p.key === activePreset);
  const filterLabel     = activePreset === "custom"
    ? `${customStart} → ${customEnd}`
    : activePresetObj?.label ?? "Last 30 days";

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            System Overview
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2">
            Platform metrics and resource consumption.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <RefreshCw size={12} className="animate-spin" />
              <span>Updating…</span>
            </div>
          )}
          <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* ── Date-range filter bar ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col gap-3">
          {/* Preset pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
              <Calendar size={13} />
              Period
            </div>
            {PRESETS.map((preset) => {
              const isActive = activePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  id={`filter-${preset.key}`}
                  onClick={() => handlePreset(preset)}
                  disabled={isPending}
                  className={`
                    relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 scale-105"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }
                  `}
                >
                  {preset.label}
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-800" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom date pickers — slide in when "Custom" is active */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showCustom ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label htmlFor="filter-custom-start" className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  From
                </label>
                <input
                  id="filter-custom-start"
                  type="date"
                  value={customStart}
                  max={customEnd || toISODate(new Date())}
                  onChange={(e) => handleCustomDateChange(e.target.value, customEnd)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="filter-custom-end" className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  To
                </label>
                <input
                  id="filter-custom-end"
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={toISODate(new Date())}
                  onChange={(e) => handleCustomDateChange(customStart, e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
              {customStart && customEnd && customStart <= customEnd && (
                <span className="text-[10px] text-slate-400 italic">
                  {Math.ceil((new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24)) + 1} days selected
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-300 ${isPending ? "opacity-60" : "opacity-100"}`}
      >
        {/* Users */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                  <Users size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
              {stats.totalUsers.toLocaleString()}
            </p>
          </div>
          <Link href="/admin/users" className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center hover:underline">
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Tokens */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <Server size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Token Usage</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalTokens.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">{filterLabel}</p>
          </div>
          <Link href="/admin/usage" className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center hover:underline">
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Voice Sessions */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                <Mic size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Voice Sessions</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalVoiceSessions.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {Math.floor(stats.totalVoiceSeconds / 60).toLocaleString()} total minutes
            </p>
          </div>
          <Link href="/admin/usage?tab=voice" className="mt-4 text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center hover:underline">
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>

        {/* Cost */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Cost</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              ${stats.totalCostUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              UGX {stats.totalCostUgx.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <Link href="/admin/revenue" className="mt-4 text-sm text-green-600 dark:text-green-400 font-medium flex items-center hover:underline">
            View Details <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>
      </div>

      {/* ── Charts ── */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${isPending ? "opacity-60" : "opacity-100"}`}
      >
        {/* Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-slate-400" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Usage Trend
            </h3>
            <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
              {filterLabel}
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeSeriesData}>
                <defs>
                  <linearGradient id="colorChat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="colorTranscription" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => fmtAxisDate(val, diffDays)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  label={{ value: "Tokens", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12, fill: "#64748b" } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v: number) => `${(v / 60).toFixed(0)}m`}
                  label={{ value: "Voice (min)", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 12, fill: "#64748b" } }}
                />
                <Tooltip
                  cursor={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  content={<CustomAreaTooltip />}
                />
                <Legend />
                <Area yAxisId="left"  type="monotone" dataKey="chatTokens"          name="Chat Tokens"          stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorChat)" />
                <Area yAxisId="left"  type="monotone" dataKey="transcriptionTokens" name="Transcription Tokens" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTranscription)" />
                <Area yAxisId="right" type="monotone" dataKey="voiceSeconds"        name="Voice Duration"       stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVoice)" />
                <Area yAxisId="left" dataKey="cost" name="Estimated Cost (USD)" stroke="none" fill="none" legendType="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Cost Breakdown (USD)</h3>
          <p className="text-xs text-slate-400 mb-6">{filterLabel}</p>
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
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    borderColor:     isDark ? "#1e293b" : "#f1f5f9",
                    color:           isDark ? "#f8fafc"  : "#0f172a",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  itemStyle={{ color: isDark ? "#e2e8f0" : "#334155" }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <AdminRevenue stats={stats} filterLabel={filterLabel} />
    </div>
  );
};

export default AdminDashboard;
