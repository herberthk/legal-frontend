import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAuthStore, useThemeStore } from "@/store";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { Filter, Calendar, Activity } from "lucide-react";
import CustomTooltip from "../global/modal/CustomTooltip";
import { getUsageChartData } from "@/lib/actions/usage";

const FILTER_OPTIONS: { label: string; value: UsageFilter }[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
];

interface ChartDataItem {
  name: string;
  text: number;
  voice: number;
  cost: number;
}

const UsageChart = () => {
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [totalPeriodCost, setTotalPeriodCost] = useState(0);
  const [filter, setFilter] = useState<UsageFilter>("last_week");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  const handleFilterChange = (newFilter: UsageFilter) => {
    setFilter(newFilter);
    setLoading(true);
  };

  const handleCustomRangeChange = (type: "start" | "end", value: string) => {
    setCustomRange((prev) => ({ ...prev, [type]: value }));
    setLoading(true);
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getUsageChartData(
          user.id,
          filter,
          { start: customRange.start, end: customRange.end },
          new Date().getTimezoneOffset(),
        );

        if (result.success) {
          setChartData(result.chartData);
          setTotalPeriodCost(result.totalPeriodCost ?? 0);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, filter, customRange.start, customRange.end]);

  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300 min-h-[480px] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Usage Flow
            </h3>
            <p className="text-xs text-slate-500">Text vs Voice Usage</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Filter size={14} className="text-slate-400 shrink-0 mr-1" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full font-medium transition-all shrink-0 ${
                filter === opt.value
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-start gap-2">
          <div className="text-xs text-slate-400 font-medium mt-1 uppercase">
            Period Total Cost:
          </div>
          <div className="flex gap-2">
            <div className="text-sm text-rose-500 dark:text-rose-400">
              -${totalPeriodCost.toFixed(2)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              ( UGX{" "}
              {(totalPeriodCost * USD_TO_UGX_EXCHANGE_RATE).toLocaleString(
                undefined,
                { maximumFractionDigits: 0 },
              )}
              )
            </div>
          </div>
        </div>
      </div>

      {filter === "custom" && (
        <div className="flex items-end gap-3 mb-6 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-300">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
              From
            </label>
            <div className="relative">
              <Calendar
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={customRange.start}
                onChange={(e) =>
                  handleCustomRangeChange("start", e.target.value)
                }
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
              To
            </label>
            <div className="relative">
              <Calendar
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => handleCustomRangeChange("end", e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 h-64 px-2">
              {[40, 70, 45, 90, 65, 50, 80].map((h, i) => (
                <div key={i} className="flex-1 space-y-2">
                  <div
                    className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-t-lg transition-all duration-500 animate-pulse"
                    style={{ height: `${h}%` }}
                  ></div>
                  <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            No history available yet.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorText" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorVoice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f4511e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f4511e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? "#334155" : "#e2e8f0"}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#3b82f6"
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f4511e"
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(1)}m`}
                  label={{
                    value: "Duration",
                    angle: 90,
                    position: "insideRight",
                    offset: 10,
                    style: {
                      fill: isDark ? "#94a3b8" : "#64748b",
                      fontSize: 9,
                      fontWeight: 600,
                      textAnchor: "middle",
                    },
                  }}
                />
                <Tooltip
                  cursor={{
                    stroke: isDark ? "#475569" : "#cbd5e1",
                    strokeWidth: 1,
                  }}
                  content={
                    <CustomTooltip active={false} payload={[]} label="" />
                  }
                />
                <Legend
                  iconType="circle"
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ paddingTop: "0px", paddingBottom: "24px" }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="text"
                  name="Text (Tokens)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorText)"
                  animationDuration={1500}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="voice"
                  name="Voice (Duration)"
                  stroke="#f4511e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVoice)"
                  animationDuration={1500}
                />
                {/* Hidden area to show cost in tooltip */}
                <Area
                  yAxisId="left"
                  dataKey="cost"
                  name="Estimated Cost (USD/UGX)"
                  stroke="none"
                  fill="none"
                  legendType="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageChart;
