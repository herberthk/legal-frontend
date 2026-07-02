import { getCurrentUser } from "@/lib";
import { redirect } from "next/navigation";
import { CheckoutClient } from "./CheckoutClient";
import BackButton from "@/components/global/BackButton";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout | Dashboard",
  description: "Add funds to your account",
};

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="md:p-8 px-2 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
     

      <div className="px-2 md:px-4">
        <CheckoutClient user={user} balance={user.balance} />
      </div>
    </div>
  );
}
