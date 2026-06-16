"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="font-bold text-white mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((item: any) => (
        <div key={item.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: item.stroke }} />
          <span className="text-slate-400">{item.name}:</span>
          <span className="font-semibold text-white">
            {item.name === "Cost" ? `$${Number(item.value).toFixed(4)}` : item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

interface UsageChartsProps {
  usageTimeSeries: {
    date: string;
    chatTokens: number;
    voiceSeconds: number;
    transcriptionTokens: number;
    cost: number;
  }[];
}

export default function UsageCharts({ usageTimeSeries }: UsageChartsProps) {
  const chartData = usageTimeSeries.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <h3 className="text-sm font-bold text-white">Usage — Last 30 Days</h3>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              {[
                { id: "chat", color: "#3b82f6" },
                { id: "trans", color: "#8b5cf6" },
                { id: "cost", color: "#10b981" },
              ].map(({ id, color }) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="chatTokens" name="Chat Tokens" stroke="#3b82f6" strokeWidth={2} fill="url(#chat)" />
            <Area type="monotone" dataKey="transcriptionTokens" name="Transcription" stroke="#8b5cf6" strokeWidth={2} fill="url(#trans)" />
            <Area type="monotone" dataKey="cost" name="Cost" stroke="#10b981" strokeWidth={2} fill="url(#cost)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
