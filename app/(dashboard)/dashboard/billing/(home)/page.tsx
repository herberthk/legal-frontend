import { BillingPage } from "@/components/user/Billing";
import { getCurrentUser } from "@/lib/actions/auth";
import TransactionList from "@/components/user/TransactionList";
import { Metadata } from "next";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const metadata: Metadata = {
  title: "Billing | Dashboard",
  description: "Manage your subscriptions and transactions",
};

const Billing = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <DirectionalTransition>
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
    </DirectionalTransition>
  );
};

export default Billing;
