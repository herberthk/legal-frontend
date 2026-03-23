"use client";
import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TransactionPaginationProps {
  currentPage: number;
  totalPages: number;
}

const TransactionPagination: React.FC<TransactionPaginationProps> = ({
  currentPage,
  totalPages,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
      <span className="text-xs text-slate-500">
        Page {currentPage} of {Math.max(1, totalPages)}
      </span>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
        >
          <ChevronLeft
            size={20}
            className="text-slate-600 dark:text-slate-400"
          />
        </button>
        <button
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
  );
};

export default TransactionPagination;
