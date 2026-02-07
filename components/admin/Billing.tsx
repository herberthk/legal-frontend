"use client";
import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CreditCard,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  Check,
  Loader2,
  DollarSign,
  Wallet,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Server,
  Receipt,
  Smartphone,
  Filter,
  Search,
} from "lucide-react";
import {
  generateMockTransactions,
  generateMockCards,
  generateUsageData,
} from "@/constants";
import { useThemeStore } from "@/store";

type BillingPageProps = {
  user: User;
};
export const BillingPage: React.FC<BillingPageProps> = ({ user }) => {
  // State
  const [balance, setBalance] = useState(user.balance);
  const [transactions, setTransactions] = useState<Transaction[]>(
    generateMockTransactions(),
  );
  const [cards, setCards] = useState<PaymentMethod[]>(generateMockCards());
  const [usageData] = useState(generateUsageData());
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Filter State
  const [filterType, setFilterType] = useState<
    "ALL" | "DEPOSIT" | "TEXT_CHAT" | "VOICE_SESSION"
  >("ALL");
  const [filterDateRange, setFilterDateRange] = useState<
    "ALL_TIME" | "7_DAYS" | "30_DAYS"
  >("ALL_TIME");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Simulation State
  const [simulatedUsage, setSimulatedUsage] = useState(0);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Feedback State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Payment Method Form State
  const [paymentType, setPaymentType] = useState<"card" | "mobile_money">(
    "card",
  );
  const [newMethod, setNewMethod] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
    provider: "MTN",
  });
  const [phoneError, setPhoneError] = useState("");

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState("20");

  // --- Real World Simulation Effects ---

  // 1. Simulate real-time usage (cost ticker) based on $0.05/min voice rate
  useEffect(() => {
    // $0.05 per minute = ~$0.00083 per second for active session
    const interval = setInterval(() => {
      setSimulatedUsage((prev) => prev + 0.00083);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtering Logic
  const filteredTransactions = transactions.filter((t) => {
    // 1. Filter by Type
    if (filterType !== "ALL" && t.type !== filterType) return false;

    // 2. Filter by Date
    if (filterDateRange !== "ALL_TIME") {
      const txDate = new Date(t.date);
      // Use a fixed reference date or ensure it's client-side only for consistency
      const now = new Date("2024-01-01"); // Using fixed date for mock-consistency or should be handled via useEffect
      const diffTime = Math.abs(now.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filterDateRange === "7_DAYS" && diffDays > 7) return false;
      if (filterDateRange === "30_DAYS" && diffDays > 30) return false;
    }

    // 3. Filter by Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(lowerTerm);
      const matchId = t.id.toLowerCase().includes(lowerTerm);
      if (!matchDesc && !matchId) return false;
    }

    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // --- CRUD Operations ---

  const handleAddFunds = () => {
    setIsProcessing(true);
    // Simulate API Call
    setTimeout(() => {
      const amount = parseFloat(depositAmount);
      const newTx: Transaction = {
        id: `t_${Date.now()}`,
        type: "DEPOSIT",
        description: "Funds Added (Manual Top-up)",
        amount: amount,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        details: "Success",
      };

      setTransactions((prev) => [newTx, ...prev]);
      setBalance((prev) => prev + amount);
      setIsAddingFunds(false);
      setIsProcessing(false);
      setCurrentPage(1); // Go to first page to see new transaction
      setFilterType("ALL"); // Reset filter to show new tx
      setFilterDateRange("ALL_TIME");
      setSearchTerm("");

      // Trigger Success Animation
      setSuccessMessage("Funds added successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);

      // INTEGRATION HINT: Call POST /api/billing/deposit with Stripe/Payment Intent ID
    }, 1500);
  };

  const handleDeleteCard = (id: string) => {
    if (confirm("Remove this payment method?")) {
      setCards((prev) => prev.filter((c) => c.id !== id));
      // INTEGRATION HINT: Call DELETE /api/billing/methods/:id
    }
  };

  const handleSetDefaultCard = (id: string) => {
    setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    // INTEGRATION HINT: Call PUT /api/billing/methods/:id/default
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for Mobile Money
    if (paymentType === "mobile_money") {
      const phoneRegex = /^(0|256|\+256)7[0-9]{8}$/;
      const cleanNumber = newMethod.number
        .replace(/\s+/g, "")
        .replace(/-/g, "");

      if (!phoneRegex.test(cleanNumber)) {
        setPhoneError("Invalid number. Use format: 077... or 070...");
        return;
      }
      setPhoneError("");
    }

    const mockNewMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: paymentType === "card" ? "visa" : "mobile_money", // simplified type logic
      last4:
        paymentType === "card"
          ? newMethod.number.slice(-4) || "8888"
          : newMethod.number.slice(-3).padStart(10, "*") || "077***",
      expiry: paymentType === "card" ? newMethod.expiry || "01/28" : undefined,
      isDefault: false,
      holderName: newMethod.name || user.name,
    };

    setCards((prev) => [...prev, mockNewMethod]);
    setIsAddingMethod(false);
    setNewMethod({
      number: "",
      expiry: "",
      cvc: "",
      name: "",
      provider: "MTN",
    });
    setPaymentType("card");

    // Trigger Success Animation
    setSuccessMessage("Payment method saved securely.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleArchiveTransaction = (id: string) => {
    // Soft delete simulation
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedTxId(expandedTxId === id ? null : id);
  };

  const isDark = useThemeStore().theme === "dark";

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Billing & Usage
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your funds, payment methods, and view consumption history.
          </p>
        </div>
        <div className="flex items-center space-x-3 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-100 dark:border-orange-800 animate-in slide-in-from-right-4 duration-500">
          <Activity className="text-orange-500 w-5 h-5 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
              Session Usage
            </span>
            <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              ${simulatedUsage.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Balance Card */}
          <div className="bg-white dark:bg-linear-to-br dark:from-black dark:to-slate-900 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-transparent relative overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:scale-[1.01]">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
              <Wallet size={200} className="text-slate-900 dark:text-white" />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                  Available Balance
                </p>
                <h2 className="text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
                  ${balance.toFixed(2)}
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsAddingFunds(true)}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow-lg shadow-orange-900/20 transition-all flex items-center space-x-2 active:scale-95 hover:scale-105"
                  >
                    <Plus size={18} />
                    <span>Add Funds</span>
                  </button>
                  <button className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-lg font-medium backdrop-blur-sm transition-all border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30">
                    Auto-Recharge
                  </button>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Status
                </p>
                <p className="font-semibold text-lg text-slate-900 dark:text-white">
                  Active
                </p>
                <span className="inline-block mt-2 px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded border border-green-500/30">
                  Pay As You Go
                </span>
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Daily Spend (Last 7 Days)
              </h3>
              <select className="bg-slate-100 dark:bg-slate-700 border-none rounded-lg text-sm px-3 py-1 text-slate-700 dark:text-slate-300 outline-none hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
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
                    tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#fff",
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      color: isDark ? "#fff" : "#000",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#f97316"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Transaction History
              </h3>
              <button className="text-sm text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 transition-colors hover:text-orange-700">
                <Download size={14} /> Download Invoice
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {(
                  ["ALL", "DEPOSIT", "TEXT_CHAT", "VOICE_SESSION"] as const
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFilterType(type);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      filterType === type
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    }`}
                  >
                    {type === "ALL"
                      ? "All Transactions"
                      : type
                          .replace("_", " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center">
                {/* Search Bar */}
                <div className="relative group">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                    size={14}
                  />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border-none rounded-full text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/50 w-full sm:w-48 transition-all placeholder-slate-400"
                  />
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-400" />
                  <select
                    value={filterDateRange}
                    onChange={(e) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      setFilterDateRange(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:text-orange-600 transition-colors"
                  >
                    <option
                      className="bg-white dark:bg-slate-800"
                      value="ALL_TIME"
                    >
                      All Time
                    </option>
                    <option
                      className="bg-white dark:bg-slate-800"
                      value="7_DAYS"
                    >
                      Last 7 Days
                    </option>
                    <option
                      className="bg-white dark:bg-slate-800"
                      value="30_DAYS"
                    >
                      Last 30 Days
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentTransactions.length > 0 ? (
                    currentTransactions.map((t) => (
                      <React.Fragment key={t.id}>
                        <tr
                          onClick={() => toggleExpand(t.id)}
                          className={`transition-colors duration-200 animate-in fade-in slide-in-from-left-2 cursor-pointer ${
                            expandedTxId === t.id
                              ? "bg-slate-50 dark:bg-slate-700/40"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-full transition-colors ${
                                  t.type === "DEPOSIT"
                                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                    : t.type === "VOICE_SESSION"
                                      ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                }`}
                              >
                                {t.type === "DEPOSIT" ? (
                                  <DollarSign size={16} />
                                ) : (
                                  <Activity size={16} />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-slate-900 dark:text-white text-sm">
                                    {/* Highlight Search Term if exists */}
                                    {searchTerm &&
                                    t.description
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase()) ? (
                                      <>
                                        {t.description
                                          .split(
                                            new RegExp(`(${searchTerm})`, "gi"),
                                          )
                                          .map((part, i) =>
                                            part.toLowerCase() ===
                                            searchTerm.toLowerCase() ? (
                                              <span
                                                key={i}
                                                className="bg-yellow-200 dark:bg-yellow-900/50"
                                              >
                                                {part}
                                              </span>
                                            ) : (
                                              part
                                            ),
                                          )}
                                      </>
                                    ) : (
                                      t.description
                                    )}
                                  </p>
                                  {expandedTxId === t.id ? (
                                    <ChevronUp
                                      size={14}
                                      className="text-slate-400"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={14}
                                      className="text-slate-400"
                                    />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">
                                  {t.details}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                            {t.date}
                          </td>
                          <td
                            className={`px-6 py-4 font-mono text-sm font-medium ${t.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}
                          >
                            {t.amount > 0 ? "+" : ""}
                            {parseFloat(t.amount.toString()).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveTransaction(t.id);
                              }}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Archive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                        {expandedTxId === t.id && (
                          <tr className="bg-slate-50 dark:bg-slate-700/20 animate-in fade-in slide-in-from-top-1 duration-200">
                            <td colSpan={4} className="px-6 pb-6 pt-2">
                              <div className="ml-14 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                {t.type === "TEXT_CHAT" && (
                                  <>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded">
                                        <Server size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Tokens
                                        </span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                          In: 850 / Out: 350
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                                        <Clock size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Processing Time
                                        </span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                          1.24s
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded">
                                        <Activity size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Model
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                          Gemini 2.5 Flash
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                {t.type === "VOICE_SESSION" && (
                                  <>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded">
                                        <Clock size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Duration
                                        </span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                          {t.details}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                                        <DollarSign size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Rate
                                        </span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                          $0.05/min
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded">
                                        <Activity size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Voice ID
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                          Kore (Standard)
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                {t.type === "DEPOSIT" && (
                                  <>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-500 rounded">
                                        <Receipt size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Ref ID
                                        </span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                          TXN-{t.id.toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                      <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                                        <CreditCard size={16} />
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 block">
                                          Method
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                          {t.description
                                            .split("(")[1]
                                            ?.replace(")", "") || "Direct"}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No transactions found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronLeft
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                >
                  <ChevronRight
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Methods */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment Methods
              </h3>
              <button
                onClick={() => setIsAddingMethod(!isAddingMethod)}
                className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-600 dark:text-slate-300 hover:rotate-90"
              >
                <Plus size={18} />
              </button>
            </div>

            {isAddingMethod && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Tab Switcher */}
                <div className="flex space-x-6 mb-4 border-b border-slate-200 dark:border-slate-700 pb-0">
                  <button
                    type="button"
                    onClick={() => setPaymentType("card")}
                    className={`pb-2 text-sm font-medium transition-colors relative ${paymentType === "card" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={14} /> Credit Card
                    </span>
                    {paymentType === "card" && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full"></div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("mobile_money")}
                    className={`pb-2 text-sm font-medium transition-colors relative ${paymentType === "mobile_money" ? "text-orange-600 dark:text-orange-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Smartphone size={14} /> Mobile Money
                    </span>
                    {paymentType === "mobile_money" && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full"></div>
                    )}
                  </button>
                </div>

                <form onSubmit={handleAddPaymentMethod}>
                  {paymentType === "card" ? (
                    <>
                      <input
                        type="text"
                        placeholder="Card Number"
                        value={newMethod.number}
                        onChange={(e) =>
                          setNewMethod({ ...newMethod, number: e.target.value })
                        }
                        className="w-full mb-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                        required
                      />
                      <div className="flex gap-3 mb-3">
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={newMethod.expiry}
                          onChange={(e) =>
                            setNewMethod({
                              ...newMethod,
                              expiry: e.target.value,
                            })
                          }
                          className="w-1/2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                          required
                        />
                        <input
                          type="text"
                          placeholder="CVC"
                          value={newMethod.cvc}
                          onChange={(e) =>
                            setNewMethod({ ...newMethod, cvc: e.target.value })
                          }
                          className="w-1/2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() =>
                            setNewMethod({ ...newMethod, provider: "MTN" })
                          }
                          className={`p-2 border rounded-lg text-center text-xs font-bold transition-all ${newMethod.provider === "MTN" ? "border-yellow-400 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-400" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                          MTN MoMo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewMethod({ ...newMethod, provider: "Airtel" })
                          }
                          className={`p-2 border rounded-lg text-center text-xs font-bold transition-all ${newMethod.provider === "Airtel" ? "border-red-400 bg-red-50 text-red-700 ring-1 ring-red-400" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                          Airtel Money
                        </button>
                      </div>
                      <div className="relative mb-1">
                        <input
                          type="tel"
                          placeholder="Phone Number (e.g. 077... or 070...)"
                          value={newMethod.number}
                          onChange={(e) => {
                            setNewMethod({
                              ...newMethod,
                              number: e.target.value,
                            });
                            setPhoneError("");
                          }}
                          className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border text-sm outline-none focus:ring-2 text-slate-900 dark:text-white ${phoneError ? "border-red-500 focus:ring-red-500" : "border-slate-300 dark:border-slate-600 focus:ring-orange-500"}`}
                          required
                        />
                      </div>
                      {phoneError && (
                        <p className="text-red-500 text-xs mb-3">
                          {phoneError}
                        </p>
                      )}
                    </>
                  )}

                  <input
                    type="text"
                    placeholder={
                      paymentType === "card"
                        ? "Cardholder Name"
                        : "Registered Name"
                    }
                    value={newMethod.name}
                    onChange={(e) =>
                      setNewMethod({ ...newMethod, name: e.target.value })
                    }
                    className="w-full mb-4 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
                    required
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingMethod(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded hover:opacity-90 transition-opacity"
                    >
                      {paymentType === "card" ? "Save Card" : "Add Number"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`p-4 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-right-4 hover:scale-[1.02] ${card.isDefault ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-6 rounded flex items-center justify-center text-[10px] font-bold uppercase ${
                          card.type === "mobile_money"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300"
                        }`}
                      >
                        {card.type === "mobile_money" ? "MoMo" : card.type}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          •••• {card.last4}
                        </p>
                        <p className="text-xs text-slate-500">
                          {card.holderName}{" "}
                          {card.expiry ? `• Exp ${card.expiry}` : ""}
                        </p>
                      </div>
                    </div>
                    {card.isDefault && (
                      <span className="flex items-center text-xs text-orange-600 font-medium">
                        <Check size={12} className="mr-1" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                    {!card.isDefault && (
                      <button
                        onClick={() => handleSetDefaultCard(card.id)}
                        className="text-xs text-slate-500 hover:text-orange-600 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Pricing Info */}
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 group-hover:rotate-12">
              <AlertCircle size={120} />
            </div>
            <h4 className="font-bold text-lg mb-2">Pricing Guide</h4>
            <ul className="space-y-2 text-sm text-indigo-100">
              <li className="flex justify-between">
                <span>Text Queries</span>
                <span className="font-mono font-bold">$0.03 / 1k tokens</span>
              </li>
              <li className="flex justify-between">
                <span>Voice Minutes</span>
                <span className="font-mono font-bold">$0.05 / min</span>
              </li>
              <li className="flex justify-between">
                <span>Daily Free</span>
                <span className="font-mono font-bold">1,000 Tokens</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Funds Modal Overlay */}
      {isAddingFunds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Add Funds
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Enter the amount you wish to deposit into your legal account.
            </p>

            <div className="relative mb-6">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 text-2xl font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {["10", "20", "50"].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(amt)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${depositAmount === amt ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsAddingFunds(false)}
                className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                disabled={isProcessing}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <span>Confirm</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 relative overflow-hidden group">
            {/* Decorative background glow */}
            <div className="absolute inset-0 bg-linear-to-r from-green-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full shadow-lg shadow-green-500/30 animate-in zoom-in spin-in-90 duration-500">
              <Check size={18} className="text-white" strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">Success</span>
              <span className="text-xs opacity-90">{successMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
