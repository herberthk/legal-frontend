import { useAppStore } from "@/store";
import { formatDate } from "@/lib/utils";

const SystemEvents = () => {
  const tokenHistory = useAppStore((state) => state.tokenUsageHistory);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm mt-8">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
        Latest System Events
      </h3>
      <div className="space-y-4">
        {tokenHistory
          .slice(-3)
          .reverse()
          .map((rec, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors animate-in fade-in slide-in-from-left-2"
            >
              <div
                className={`w-2 h-2 rounded-full ${rec.type === "TEXT_RESPONSE" ? "bg-blue-500" : "bg-purple-500"}`}
              ></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Usage Recorded
                </p>
                <p className="text-xs text-slate-500">
                  {rec.cost} {rec.type.toLowerCase()} •{" "}
                  {rec.type.replace("_", " ")}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {formatDate(rec.createdAt)}
              </span>
            </div>
          ))}
        {tokenHistory.length === 0 && (
          <div className="flex items-center gap-4 p-3 rounded-lg opacity-50">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                System Ready
              </p>
              <p className="text-xs text-slate-500">
                Waiting for first chat session...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemEvents;
