import { SupportPage } from "@/components/admin/Support";
import { getUserSession } from "@/lib";

const HelpPage = async () => {
  const user = await getUserSession();
  if (!user) return null;
  return <SupportPage user={user} />;
};

export default HelpPage;
