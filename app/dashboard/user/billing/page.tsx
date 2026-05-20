import { BillingPage } from "@/components/user/Billing";
import { getCurrentUser } from "@/lib";
import TransactionList from "@/components/user/TransactionList";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing | Dashboard",
  description: "Manage your subscriptions and transactions",
};

const Billing = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <BillingPage
      user={user}
      transactionsList={
        <TransactionList
          userId={user.id}
          currentPage={1}
          currentType="ALL"
          currentDuration="all"
          variant="summary"
        />
      }
    />
  );
};

export default Billing;
