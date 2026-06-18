"use client";

import {
  TrendingUp,
  Coins,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
} from "lucide-react";
import { useThemeStore } from "@/store";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { AdminOverviewStats } from "@/lib/actions/admin";

interface AdminRevenueProps {
  stats: AdminOverviewStats;
  filterLabel?: string;
}

const formatCurrency = (val: number, currency = "USD") => {
  if (currency === "UGX") {
    return `UGX ${Math.round(val).toLocaleString()}`;
  }
  return `$${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomRevenueTooltip = ({ active, payload, label, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-4 rounded-xl shadow-xl border text-xs leading-relaxed backdrop-blur-md bg-opacity-95 ${
        isDark
          ? "bg-slate-900 border-slate-800 text-white"
          : "bg-white border-slate-100 text-slate-900"
      }`}>
        <p className="font-black border-b pb-2 mb-2 border-slate-100 dark:border-slate-800">
          {label}
        </p>
        <div className="space-y-2.5">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((item: any) => {
            const val = Number(item.value);
            const ugx = val * USD_TO_UGX_EXCHANGE_RATE;
            return (
              <div key={item.name} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.fill || item.stroke }}
                  />
                  <span className="font-bold text-slate-500 dark:text-slate-400">
                    {item.name}:
                  </span>
                </div>
                <div className="pl-4 flex gap-2 font-mono">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(val, "USD")}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    ({formatCurrency(ugx, "UGX")})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const AdminRevenue = ({ stats, filterLabel = "Last 30 days" }: AdminRevenueProps) => {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const tickFill = isDark ? "#94a3b8" : "#64748b";
  const gridStroke = isDark ? "#334155" : "#e2e8f0";

  // Data for side-by-side feature comparison
  const barData = [
    {
      name: "Text Chat",
      "Expected Rev": stats.expectedChatRevenueUsd,
      "Realized Rev": stats.chatCostUsd,
      "Gemini Cost": stats.googleChatCostUsd,
    },
    {
      name: "Transcription",
      "Expected Rev": stats.expectedTranscriptionRevenueUsd,
      "Realized Rev": stats.transcriptionCostUsd,
      "Gemini Cost": stats.googleTranscriptionCostUsd,
    },
    {
      name: "Voice Session",
      "Expected Rev": stats.expectedVoiceRevenueUsd,
      "Realized Rev": stats.voiceCostUsd,
      "Gemini Cost": stats.googleVoiceCostUsd,
    },
  ];

  // Colors mapping for Recharts
  const chartColors = {
    expected: "#6366f1", // Indigo
    realized: "#10b981", // Emerald
    cost: "#ef4444",     // Red
    profit: "#3b82f6",   // Blue
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* section title */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
          Financial & Revenue Analysis
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Detailed breakdown of costs, expected gross pricing, realized user spend, and net profit margins.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Expected Revenue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Expected Gross Revenue
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Layers size={20} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-4">
              {formatCurrency(stats.expectedTotalRevenueUsd)}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {formatCurrency(stats.expectedTotalRevenueUsd * USD_TO_UGX_EXCHANGE_RATE, "UGX")}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
            <span className="text-slate-400">Projected billing rate value</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center">
              100% Volume
            </span>
          </div>
        </div>

        {/* Realized Revenue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Realized Net Revenue
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-4">
              {formatCurrency(stats.totalCostUsd)}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {formatCurrency(stats.totalCostUsd * USD_TO_UGX_EXCHANGE_RATE, "UGX")}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
            <span className="text-slate-400">Actual paid billing</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {stats.expectedTotalRevenueUsd > 0
                ? `${((stats.totalCostUsd / stats.expectedTotalRevenueUsd) * 100).toFixed(0)}% conversion`
                : "0%"}
            </span>
          </div>
        </div>

        {/* Google Cloud Cost */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Google API Cost (Gemini)
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
                <Cpu size={20} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-4">
              {formatCurrency(stats.googleTotalCostUsd)}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {formatCurrency(stats.googleTotalCostUsd * USD_TO_UGX_EXCHANGE_RATE, "UGX")}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
            <span className="text-slate-400">Google Gemini usage charge</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {stats.totalCostUsd > 0
                ? `${((stats.googleTotalCostUsd / stats.totalCostUsd) * 100).toFixed(1)}% of net`
                : "No revenue"}
            </span>
          </div>
        </div>

        {/* Realized Profit Margin */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between transition hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Net Realized Profit
              </span>
              <div className={`p-2 rounded-lg ${
                stats.realizedProfitUsd >= 0
                  ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
              }`}>
                <Coins size={20} />
              </div>
            </div>
            <p className={`text-2xl md:text-3xl font-black mt-4 ${
              stats.realizedProfitUsd >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
            }`}>
              {formatCurrency(stats.realizedProfitUsd)}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1">
              {formatCurrency(stats.realizedProfitUsd * USD_TO_UGX_EXCHANGE_RATE, "UGX")}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between text-xs">
            <span className="text-slate-400">Margin percentage</span>
            <span className={`font-bold flex items-center gap-0.5 ${
              stats.realizedProfitUsd >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
            }`}>
              {stats.realizedProfitUsd >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {stats.profitMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grouped Bar Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Feature Cost vs Revenue (USD)
            </h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: tickFill, fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: tickFill, fontSize: 11 }}
                  tickFormatter={(val) => `$${val.toLocaleString()}`}
                />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                  content={<CustomRevenueTooltip isDark={isDark} />}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="Expected Rev" fill={chartColors.expected} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realized Rev" fill={chartColors.realized} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gemini Cost" fill={chartColors.cost} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Trend Area Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-slate-400" size={20} />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Profitability Trend
            </h3>
            <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
              {filterLabel}
            </span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeSeriesData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.realized} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.realized} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.cost} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartColors.cost} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.profit} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartColors.profit} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: tickFill, fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: tickFill, fontSize: 11 }}
                  tickFormatter={(val) => `$${val.toFixed(1)}`}
                />
                <Tooltip
                  cursor={{ stroke: isDark ? "#475569" : "#cbd5e1", strokeWidth: 1 }}
                  content={<CustomRevenueTooltip isDark={isDark} />}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Realized Revenue"
                  stroke={chartColors.realized}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="googleCost"
                  name="Gemini API Cost"
                  stroke={chartColors.cost}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#costGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Net Profit"
                  stroke={chartColors.profit}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#profitGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRevenue;
