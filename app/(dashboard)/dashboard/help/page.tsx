import SupportPage from "@/components/user/Support";
import { getCurrentUser } from "@/lib/actions/auth";
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

  // Trigger seeding in background without blocking or rejecting page data
  seedHelpArticles().catch((err) => {
    console.error("Failed to seed help articles in background:", err);
  });

  // Parallel fetching for page data
  const [ticketsResult, faqsResult] = await Promise.all([
    getUserSupportTickets(user.id),
    getHelpArticles(),
  ]);
  const tickets = ticketsResult.success ? ticketsResult.tickets : [];
  const faqs = faqsResult.success ? faqsResult.articles : [];

  return <DirectionalTransition> 
            <SupportPage user={user} initialTickets={tickets} faqs={faqs} />
          </DirectionalTransition>
};

export default HelpPage;
