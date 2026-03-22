import { BillingPage } from "@/components/user/Billing";
import { getCurrentUser } from "@/lib";

const Billing = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  return <BillingPage user={user} />;
};

export default Billing;
