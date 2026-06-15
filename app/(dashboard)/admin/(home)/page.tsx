import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAdminOverviewStats } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

const Page = async () => {
  const res = await getAdminOverviewStats();
  
  // If fetch fails or no stats returned, provide sensible defaults
  const initialStats = res.success && res.stats ? res.stats : {
    totalUsers: 0,
    totalTokens: 0,
    totalVoiceSeconds: 0,
    totalVoiceSessions: 0,
    totalCostUsd: 0,
    totalCostUgx: 0,
    chatTokens: 0,
    transcriptionTokens: 0,
    timeSeriesData: [],
  };

  return <AdminDashboard initialStats={initialStats} />;
};

export default Page;
