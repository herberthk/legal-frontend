import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { FC } from "react";

type TooltipProps = {
  active: boolean;
  payload: { name: string; value: number; dataKey: string; stroke: string }[];
  label: string;
};

const formatDuration = (minutes: number): string => {
  const seconds = Math.round(minutes * 60);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
                <div key={item.name} className="flex  gap-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {item.name}:
                  </p>
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 leading-tight">
                    ${usd.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-slate-400">
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

                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-900 dark:text-white">
                  {item.dataKey === "voice"
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

export default CustomTooltip;
