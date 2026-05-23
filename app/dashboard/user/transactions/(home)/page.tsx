import { getCurrentUser } from "@/lib";
import TransactionList from "@/components/user/TransactionList";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const TransactionsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; duration?: string }>;
}) => {
  const { page, type, duration } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const currentPage = parseInt(page || "1");
  const currentType = type || "ALL";
  const currentDuration = duration || "all";

  return (
    <div className="md:p-8 p-2 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/user/billing"
          className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-500 hover:text-orange-600 transition-colors shadow-sm"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="md:text-2xl text-xl font-bold text-slate-900 dark:text-white">
            Full Transaction History
          </h1>
          <p className="md:text-base text-sm text-slate-500">
            View and search all your past transactions
          </p>
        </div>
      </div>

      <TransactionList
        userId={user.id}
        currentPage={currentPage}
        currentType={currentType}
        currentDuration={currentDuration}
        variant="full"
      />
    </div>
  );
};

export default TransactionsPage;
