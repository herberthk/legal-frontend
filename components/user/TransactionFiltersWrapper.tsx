"use client";
import React, { useState } from "react";
import TransactionFilters from "./TransactionFilters";
import TransactionTableBody from "./TransactionTableBody";
import TransactionPagination from "./TransactionPagination";

interface TransactionFiltersWrapperProps {
  currentType: string;
  transactions: Transaction[];
  totalPages: number;
  currentPage: number;
}

const TransactionFiltersWrapper: React.FC<TransactionFiltersWrapperProps> = ({
  currentType,
  transactions,
  totalPages,
  currentPage,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

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
      <TransactionFilters
        currentType={currentType}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
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
            <TransactionTableBody
              transactions={transactions}
              onArchive={handleArchiveTransaction}
              searchTerm={searchTerm}
            />
          </tbody>
        </table>
      </div>
      <TransactionPagination
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </>
  );
};

export default TransactionFiltersWrapper;
