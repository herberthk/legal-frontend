import { SupportPage } from "@/components/admin/Support";
import { getCurrentUser } from "@/lib";

const HelpPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  return <SupportPage user={user} />;
};

export default HelpPage;
