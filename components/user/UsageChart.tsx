import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAppStore } from "@/store/app";
import { useThemeStore } from "@/store";

const UsageChart = () => {
  const tokenHistory = useAppStore((state) => state.tokenUsageHistory);
  const isDark = useThemeStore((state) => state.theme);
  const usageStats = useMemo(() => {
    const textTokens = tokenHistory
      .filter((r) => r.type === "TEXT_RESPONSE")
      .reduce((sum, r) => sum + r.tokens, 0);

    const voiceSeconds = tokenHistory
      .filter((r) => r.type === "VOICE_SESSION")
      .reduce((sum, r) => sum + r.seconds, 0);
    // Convert seconds to minutes for display
    const voiceMinutes = parseFloat((voiceSeconds / 60).toFixed(2));

    // Simple mock projection for chart based on real values
    const currentDay = new Date().toLocaleDateString(undefined, {
      weekday: "short",
    });
    const chartData = [
      { name: "Mon", text: 450, voice: 2 },
      { name: "Tue", text: 800, voice: 5 },
      { name: "Wed", text: 200, voice: 10 },
      { name: "Thu", text: 600, voice: 0 },
      { name: "Fri", text: 1100, voice: 15 },
      { name: "Sat", text: 300, voice: 0 },
      { name: currentDay, text: textTokens, voice: voiceMinutes }, // Include real usage
    ];

    return { textTokens, voiceMinutes, chartData };
  }, [tokenHistory]);
  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
        Usage Breakdown (Weekly)
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={usageStats.chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? "#334155" : "#e2e8f0"}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke="#3b82f6"
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
              label={{
                value: "Tokens",
                angle: -90,
                position: "insideLeft",
                fill: "#3b82f6",
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#8b5cf6"
              tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
              label={{
                value: "Minutes",
                angle: 90,
                position: "insideRight",
                fill: "#8b5cf6",
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
              contentStyle={{
                backgroundColor: isDark ? "#1e293b" : "#fff",
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                color: isDark ? "#fff" : "#000",
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="text"
              name="Text (Tokens)"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              yAxisId="right"
              dataKey="voice"
              name="Voice (Mins)"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UsageChart;
