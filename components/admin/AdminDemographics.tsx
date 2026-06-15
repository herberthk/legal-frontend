"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Monitor, Globe, RefreshCw, Users2 } from "lucide-react";
import { useThemeStore } from "@/store";
import {
  BarChart,
  Bar,
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
import { getAdminDemographicsStats, AdminDemographicsStats } from "@/lib/actions/admin";

const DEVICE_COLORS = ["#6366f1", "#f97316", "#10b981"];
const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#f59e0b", "#06b6d4", "#84cc16", "#ef4444", "#a855f7"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DemoTooltip = ({ active, payload, label, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-3 rounded-xl shadow-xl border text-xs ${
        isDark
          ? "bg-slate-900 border-slate-800 text-white"
          : "bg-white border-slate-100 text-slate-900"
      }`}>
        <p className="font-bold mb-1">{label}</p>
        <p style={{ color: payload[0]?.fill || "#3b82f6" }}>
          {payload[0]?.name}: <span className="font-semibold">{payload[0]?.value?.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieTooltipContent = ({ active, payload, isDark }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const total = payload[0]?.payload?.total || 1;
    const pct = ((item.value / total) * 100).toFixed(1);
    return (
      <div className={`p-3 rounded-xl shadow-xl border text-xs ${
        isDark
          ? "bg-slate-900 border-slate-800 text-white"
          : "bg-white border-slate-100 text-slate-900"
      }`}>
        <p className="font-bold mb-1">{item.name}</p>
        <p style={{ color: item.fill }}>
          Sessions: <span className="font-semibold">{item.value.toLocaleString()}</span>
        </p>
        <p className={isDark ? "text-slate-400" : "text-slate-500"}>Share: {pct}%</p>
      </div>
    );
  }
  return null;
};

interface AdminDemographicsProps {
  initialStats: AdminDemographicsStats;
}

const AdminDemographics = ({ initialStats }: AdminDemographicsProps) => {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const [stats, setStats] = useState<AdminDemographicsStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tickFill = isDark ? "#94a3b8" : "#64748b";
  const gridStroke = isDark ? "#334155" : "#e2e8f0";

  const refreshStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getAdminDemographicsStats();
      if (res.success && res.stats) setStats(res.stats);
    } catch (e) {
      console.error("Failed to refresh demographics", e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Poll every 5 minutes (demographics change less frequently)
  useEffect(() => {
    const id = setInterval(refreshStats, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshStats]);

  // Enrich pie data with total for percentage calculation
  const totalDeviceSessions = stats.devices.reduce((s, d) => s + d.count, 0);
  const devicePieData = stats.devices.map((d) => ({
    name: d.label,
    value: d.count,
    total: totalDeviceSessions,
  }));

  const updatedLabel = stats.updatedAt
    ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : "No data yet";

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Demographics</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{updatedLabel} · {stats.totalSessions.toLocaleString()} total sessions</p>
          </div>
        </div>
        <button
          onClick={refreshStats}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Row 1: Device Pie + Top Browsers Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={18} className="text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Device Types</h3>
          </div>
          {devicePieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data available</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={devicePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {devicePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent isDark={isDark} />} />
                  <Legend
                    iconType="circle"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 12, color: tickFill }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Browsers */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Browsers</h3>
          </div>
          {stats.browsers.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data available</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.browsers.slice(0, 7)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: tickFill }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: tickFill }}
                    width={70}
                  />
                  <Tooltip content={<DemoTooltip isDark={isDark} />} cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }} />
                  <Bar dataKey="count" name="Sessions" radius={[0, 4, 4, 0]}>
                    {stats.browsers.slice(0, 7).map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: OS Bar + Countries Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operating Systems */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={18} className="text-purple-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Operating Systems</h3>
          </div>
          {stats.operatingSystems.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data available</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.operatingSystems.slice(0, 7)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: tickFill }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: tickFill }}
                    width={80}
                  />
                  <Tooltip content={<DemoTooltip isDark={isDark} />} cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }} />
                  <Bar dataKey="count" name="Sessions" radius={[0, 4, 4, 0]}>
                    {stats.operatingSystems.slice(0, 7).map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[(i + 3) % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Global Reach — Top Countries */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-emerald-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Global Reach</h3>
          </div>
          {stats.countries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data available</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.countries.slice(0, 7)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: tickFill }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: tickFill }}
                    width={80}
                  />
                  <Tooltip content={<DemoTooltip isDark={isDark} />} cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }} />
                  <Bar dataKey="count" name="Sessions" radius={[0, 4, 4, 0]}>
                    {stats.countries.slice(0, 7).map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[(i + 6) % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDemographics;
