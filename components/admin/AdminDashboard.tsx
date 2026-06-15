"use client";

import React, { useState, useEffect } from "react";
import { Users, Mic, Server, DollarSign, Activity, ChevronRight } from "lucide-react";
import { getAdminOverviewStats, AdminOverviewStats } from "@/lib/actions/admin";
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
import Link from "next/link";

interface AdminDashboardProps {
  initialStats: AdminOverviewStats;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981"];

const AdminDashboard = ({ initialStats }: AdminDashboardProps) => {
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
    { name: "Chat Tokens", value: stats.chatTokens },
    { name: "Transcription Tokens", value: stats.transcriptionTokens },
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
              <BarChart data={stats.timeSeriesData}>
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
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="tokens" name="Tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="cost" name="Cost (USD)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Token Distribution
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
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
