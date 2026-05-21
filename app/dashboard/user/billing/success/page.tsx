import { getCurrentUser, getTransactionByReference } from "@/lib";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import Success from "./Success";

export const metadata: Metadata = {
  title: "Payment Successful | Dashboard",
  description: "Your payment was successful",
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = await searchParams;
  const reference = (resolvedSearchParams?.ref as string) || "";
  // Get transaction details from the reference ID
  
  const transaction = await getTransactionByReference(reference) as unknown as Transaction;

  if (!transaction) {
    redirect("/dashboard/user/billing");
  }



  return (
   <Success amount={transaction.amount} method={transaction.method} user={user}/>
  );
}
