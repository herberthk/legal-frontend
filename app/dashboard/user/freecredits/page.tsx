import { getCurrentUser } from "@/lib";
import { getFreeCreditHistory } from "@/lib/actions/usage";
import FreeCreditList from "@/components/user/FreeCreditList";
import { ChevronLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Free Credit History | Dashboard",
  description: "View your free token renewal and bonus history.",
};

const FreeCreditsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) => {
  const { page } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const currentPage = parseInt(page || "1");
  const pageSize = 10;

  const { records, totalPages, totalCount } = await getFreeCreditHistory(
    user.id,
    currentPage,
    pageSize,
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/user"
            className="p-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:scale-105 transition-all shadow-sm"
          >
            <ChevronLeft size={22} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Free Rewards
              </h1>
              <Sparkles size={20} className="text-amber-500 animate-pulse" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Track your automated token renewals and bonuses
            </p>
          </div>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none mb-1">
              Next Reward
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              1,000 Tokens every 72 hours
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative">
        {/* Subtle decorative background element */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />

        <FreeCreditList
          records={records}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800/50">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          About Free Rewards
        </h4>
        <ul className="space-y-2">
          {[
            "Free tokens are automatically credited every 3 days if your balance is low.",
            "Each renewal grants you 1,000 high-quality text tokens.",
            "Welcome bonuses are credited once upon account creation.",
            "You can always fund your wallet to bypass the wait and get unlimited access.",
          ].map((item, i) => (
            <li
              key={i}
              className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2"
            >
              <div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FreeCreditsPage;
