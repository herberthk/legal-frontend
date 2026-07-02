import { getCurrentUser, getTransactionStatusByReference } from "@/lib";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Success from "./Success";
import { AlertCircle } from "lucide-react";
import TransactionWaiter from "@/components/user/transaction/TransactionWaiter";
import { CustomLink } from "@/components/global/transitions";

export const metadata: Metadata = {
  title: "Payment Successful | Dashboard",
  description: "Your payment was successful",
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ErrorState = ({ message }: { message: string }) => {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl text-center border border-gray-100 dark:border-slate-800">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="text-red-600" size={32} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
        Error Loading Transaction
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{message}</p>
      <CustomLink
        href="/dashboard"
        className="block w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold py-4 rounded-2xl transition-all hover:scale-[1.02] text-center"
      >
        Back to Dashboard
      </CustomLink>
    </div>
  );
};

export default async function SuccessPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = await searchParams;
  const reference = (resolvedSearchParams?.ref as string) || "";

  if (!reference) {
    return <ErrorState message="Missing transaction reference" />;
  }
  // Get transaction details from the reference ID
  const result = await getTransactionStatusByReference(reference)

  if (!result.success) {
    return <ErrorState message={result.message || "Transaction Not Found"} />;
  }
  
  if (result.success && result.transaction) {
    // If transaction not found, show the waiter to poll for it
    if (result.transaction.status === "PENDING") {
      return <TransactionWaiter txnRef={reference} />;
    }
    if (result.transaction.status === "FAILED") { 
      return <ErrorState message="Transaction failed" />;
    }
  }

const transaction = result.transaction as Transaction

  return (
   <Success amount={transaction.amount} method={transaction.method} user={user}/>
  );
}
