import { BillingPage } from "@/components/user/Billing";
import { getCurrentUser } from "@/lib";
import TransactionList from "@/components/user/TransactionList";

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
