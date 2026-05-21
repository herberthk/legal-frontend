import { getCurrentUser } from "@/lib";
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
  const amountStr = (resolvedSearchParams?.amount as string) || "0";
  const amount = parseFloat(amountStr);
  const method = (resolvedSearchParams?.method as string) || "card";

 

  return (
   <Success amount={amount} method={method} user={user}/>
  );
}
