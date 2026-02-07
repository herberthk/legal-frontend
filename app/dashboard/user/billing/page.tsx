import { BillingPage } from "@/components/admin/Billing";
import { getUserSession } from "@/lib";
import { redirect } from "next/navigation";

const Billing = async () => {
  const user = await getUserSession();
  if (!user) redirect("/login");
  return <BillingPage user={user} />;
};

export default Billing;
