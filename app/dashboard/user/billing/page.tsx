import { BillingPage } from "@/components/user/Billing";
import { getCurrentUser } from "@/lib";
import TransactionList from "@/components/user/TransactionList";

const Billing = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; duration?: string }>;
}) => {
  const { page, type, duration } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const currentPage = parseInt(page || "1");
  const currentType = type || "ALL";
  const currentDuration = duration || "all";

  return (
    <BillingPage
      user={user}
      transactionsList={
        <TransactionList
          userId={user.id}
          currentPage={currentPage}
          currentType={currentType}
          currentDuration={currentDuration}
        />
      }
    />
  );
};

export default Billing;
