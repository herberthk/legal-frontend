"use client";
import React, { useState } from "react";
import TransactionFilters from "./TransactionFilters";
import TransactionTableBody from "./TransactionTableBody";
import TransactionPagination from "./TransactionPagination";
import { CustomLink } from "../global/transitions";

interface TransactionFiltersWrapperProps {
  currentType: string;
  currentDuration: string;
  transactions: Transaction[];
  totalPages: number;
  currentPage: number;
  variant?: "summary" | "full";
}

const TransactionFiltersWrapper: React.FC<TransactionFiltersWrapperProps> = ({
  currentType,
  currentDuration,
  transactions,
  totalPages,
  currentPage,
  variant = "full",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const isSummary = variant === "summary";

  const handleArchiveTransaction = (id: string) => {
    // Note: In a real app with Server Components, this would be a Server Action
    // that calls revalidatePath. For now, we simulate it via local state if we want,
    // but since it's a server component now, a real archive should re-fetch.
    console.log("Archive transaction:", id);
    // Simulation: since we don't have a server action for archive yet,
    // we'll just log it. A real fix would be creating a server action.
  };

  return (
    <>
      {!isSummary && (
        <TransactionFilters
          currentType={currentType}
          currentDuration={currentDuration}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="p-2 md:px-6 py-4">Description</th>
              <th className="p-2 md:px-6 py-4">Date</th>
              <th className="p-2 md:px-6 py-4">Amount</th>
              <th className="p-2 md:px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <TransactionTableBody
              transactions={transactions}
              onArchive={handleArchiveTransaction}
              searchTerm={searchTerm}
            />
          </tbody>
        </table>
      </div>

      {isSummary ? (
        <div className="p-2 md:p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex justify-center">
          <CustomLink
            href="/dashboard/transactions"
            className="md:text-sm text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors flex items-center gap-2"
          >
            View All Transactions
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </CustomLink>
        </div>
      ) : (
        <TransactionPagination
          currentPage={currentPage}
          totalPages={totalPages}
        />
      )}
    </>
  );
};

export default TransactionFiltersWrapper;
