import SupportPage from "@/components/user/Support";
import { getCurrentUser } from "@/lib";
import { getUserSupportTickets, getHelpArticles } from "@/lib/actions/support";
import { seedHelpArticles } from "@/lib/actions/seed-help";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const metadata = {
  title: "Help Center | Dashboard",
  description: "Get help with your account and services",
};

const HelpPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  // Parallel fetching
  const [ticketsResult, faqsResult] = await Promise.all([
    getUserSupportTickets(user.id),
    getHelpArticles(),
    seedHelpArticles(), // Runs in background, seeds if empty
  ]);
  const tickets = ticketsResult.success ? ticketsResult.tickets : [];
  const faqs = faqsResult.success ? faqsResult.articles : [];

  return <DirectionalTransition> 
            <SupportPage user={user} initialTickets={tickets} faqs={faqs} />
          </DirectionalTransition>
};

export default HelpPage;
