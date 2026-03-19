import { FC, useEffect, useMemo, useState } from "react";
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
import { db } from "@/firebase/client";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { Loader2, Filter, Calendar, Activity } from "lucide-react";

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

type TooltipProps = {
  active: boolean;
  payload: { name: string; value: number; dataKey: string; stroke: string }[];
  label: string;
};

const CustomTooltip: FC<TooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl backdrop-blur-md bg-opacity-95">
        <p className="text-sm font-black text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
          {label}
        </p>
        <div className="space-y-3">
          {payload.map((item) => {
            if (item.name.includes("Cost")) {
              const usd = Number(item.value);
              const ugx = Math.round(usd * USD_TO_UGX_EXCHANGE_RATE);
              return (
                <div key={item.name} className="flex flex-col gap-0.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {item.name}
                  </p>
                  <p className="text-base font-black text-rose-500 dark:text-rose-400 leading-tight">
                    ${usd.toFixed(4)}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400">
                    UGX {ugx.toLocaleString()}
                  </p>
                </div>
              );
            }
            if (item.dataKey === "cost" && item.stroke === "none") return null;

            const color = item.dataKey === "text" ? "#3b82f6" : "#f4511e";
            return (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {item.name}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.value.toLocaleString()}
                  </p>
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

const UsageChart = () => {
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
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

    // Determine date range based on filter
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let isHourly = false;

    switch (filter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        isHourly = true;
        break;
      case "yesterday":
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        isHourly = true;
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "custom":
        if (customRange.start && customRange.end) {
          start = new Date(customRange.start);
          end = new Date(customRange.end);
          end.setHours(23, 59, 59, 999);
        } else {
          // Fallback to last 7 days if custom range not set
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
          // Don't set loading true if it's just a fallback
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLoading(false);
          return;
        }
        break;
      case "last_week":
      default:
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
    }

    const q = query(
      collection(db, COLLECTIONS.USAGE),
      where("userId", "==", user.id),
      where("createdAt", ">=", start.toISOString()),
      where("createdAt", "<=", end.toISOString()),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const dayMap: Record<
          string,
          {
            name: string;
            text: number;
            voice: number;
            cost: number;
            sortKey: number;
          }
        > = {};

        if (isHourly) {
          // Initialize 24 hours
          for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, "0") + ":00";
            dayMap[hour] = {
              name: hour,
              text: 0,
              voice: 0,
              cost: 0,
              sortKey: i,
            };
          }
        } else {
          // Initialize days in range
          const daysDiff = Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
          );
          const iterations = Math.min(daysDiff + 1, 31); // Cap at 31 days

          for (let i = 0; i < iterations; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split("T")[0];
            const label = d.toLocaleDateString(undefined, {
              month: iterations > 10 ? "numeric" : undefined,
              day: "numeric",
              weekday: iterations <= 10 ? "short" : undefined,
            });
            dayMap[key] = {
              name: label,
              text: 0,
              voice: 0,
              cost: 0,
              sortKey: d.getTime(),
            };
          }
        }

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as UsageRecord;
          const recordDate = new Date(data.createdAt);
          const key = isHourly
            ? recordDate.getHours().toString().padStart(2, "0") + ":00"
            : data.createdAt.split("T")[0];

          if (dayMap[key]) {
            dayMap[key].cost += data.cost || 0;
            if (data.type === "TEXT_RESPONSE") {
              dayMap[key].text += data.tokens || 0;
            } else if (data.type === "VOICE_SESSION") {
              dayMap[key].voice += (data.seconds || 0) / 60;
            }
          }
        });

        const formattedData = Object.values(dayMap)
          .sort((a, b) => a.sortKey - b.sortKey)
          .map(({ name, text, voice, cost }) => ({
            name,
            text,
            voice: parseFloat(voice.toFixed(2)),
            cost: parseFloat(cost.toFixed(4)),
          }));

        setChartData(formattedData);
        setLoading(false);
      },
      (error) => {
        console.error("Usage chart listener error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id, filter, customRange.start, customRange.end]);

  const totalPeriodCost = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.cost, 0);
  }, [chartData]);

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

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-start gap-2">
          <div className="text-xs text-slate-400 font-medium mt-1">
            Period Total Cost:
          </div>
          <div className="flex flex-col">
            <div className="text-2xl font-black text-rose-500 dark:text-rose-400 leading-none">
              -${totalPeriodCost.toFixed(2)}
            </div>
            <div className="text-[10px] md:text-xs font-semibold text-slate-400 mt-1">
              UGX{" "}
              {(totalPeriodCost * USD_TO_UGX_EXCHANGE_RATE).toLocaleString(
                undefined,
                { maximumFractionDigits: 0 },
              )}
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
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" size={32} />
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
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f4511e"
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
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
                  name="Voice (Mins)"
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
                  name="Estimated Cost (USD)"
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
