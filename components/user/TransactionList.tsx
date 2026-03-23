import { Download } from "lucide-react";
import { getUserTransactions } from "@/lib/actions/wallet";
import TransactionFiltersWrapper from "./TransactionFiltersWrapper";

interface TransactionListProps {
  userId: string;
  currentPage: number;
  currentType: string;
}

const TransactionList = async ({
  userId,
  currentPage,
  currentType,
}: TransactionListProps) => {
  const res = await getUserTransactions(userId, currentPage, 6, currentType);

  const transactions = res.success ? (res.transactions as Transaction[]) : [];
  const totalPages = res.success ? res.totalPages || 1 : 1;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Transaction History
        </h3>
        <button className="text-sm text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 transition-colors hover:text-orange-700">
          <Download size={14} /> Download Invoice
        </button>
      </div>

      <TransactionFiltersWrapper
        currentType={currentType}
        transactions={transactions}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </div>
  );
};

export default TransactionList;
