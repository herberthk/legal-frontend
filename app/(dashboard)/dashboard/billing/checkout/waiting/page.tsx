import { Metadata } from "next";
import { redirect } from "next/navigation";
import { WaitingClient } from "./WaitingClient";

export const metadata: Metadata = {
  title: "Processing Payment | Dashboard",
  description: "Waiting for your Mobile Money PIN entry confirmation",
};

interface SearchParams {
  ref?: string;
}

export default async function WaitingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ref } = await searchParams;

  if (!ref) {
    redirect("/dashboard/billing/checkout");
  }

  return (
    <div className="md:p-8 px-2 max-w-2xl mx-auto animate-in fade-in duration-500 min-h-[80vh] flex items-center justify-center">
      <WaitingClient reference={ref} />
    </div>
  );
}
