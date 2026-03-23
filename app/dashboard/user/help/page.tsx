import SupportPage from "@/components/user/Support";
import { getCurrentUser } from "@/lib";
import { getUserSupportTickets, getHelpArticles } from "@/lib/actions/support";
import { seedHelpArticles } from "@/lib/actions/seed-help";

const HelpPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  // Parallel fetching
  const [tickets, faqs] = await Promise.all([
    getUserSupportTickets(user.id),
    getHelpArticles(),
    seedHelpArticles(), // Runs in background, seeds if empty
  ]);

  return <SupportPage user={user} initialTickets={tickets} faqs={faqs} />;
};

export default HelpPage;
