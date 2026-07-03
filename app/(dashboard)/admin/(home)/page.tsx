import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminDemographics from "@/components/admin/AdminDemographics";
import DirectionalTransition from "@/components/global/DirectionalTransition";
import { getAdminOverviewStats, getAdminDemographicsStats, AdminDemographicsStats } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

const EMPTY_DEMO_STATS: AdminDemographicsStats = {
  totalSessions: 0,
  devices: [],
  browsers: [],
  operatingSystems: [],
  countries: [],
  cities: [],
  updatedAt: null,
};

const Page = async () => {
  const [overviewRes, demoRes] = await Promise.all([
    getAdminOverviewStats(),
    getAdminDemographicsStats(),
  ]);

  const initialStats = overviewRes.success && overviewRes.stats ? overviewRes.stats : {
    totalUsers: 0,
    totalTokens: 0,
    totalVoiceSeconds: 0,
    totalVoiceSessions: 0,
    totalCostUsd: 0,
    totalCostUgx: 0,
    chatTokens: 0,
    transcriptionTokens: 0,
    chatCostUsd: 0,
    transcriptionCostUsd: 0,
    voiceCostUsd: 0,
    googleChatCostUsd: 0,
    googleTranscriptionCostUsd: 0,
    googleVoiceCostUsd: 0,
    googleTotalCostUsd: 0,
    expectedChatRevenueUsd: 0,
    expectedTranscriptionRevenueUsd: 0,
    expectedVoiceRevenueUsd: 0,
    expectedTotalRevenueUsd: 0,
    realizedProfitUsd: 0,
    realizedProfitUgx: 0,
    profitMarginPercent: 0,
    expectedProfitUsd: 0,
    expectedProfitUgx: 0,
    expectedProfitMarginPercent: 0,
    timeSeriesData: [],
  };

  const initialDemoStats = demoRes.success && demoRes.stats ? demoRes.stats : EMPTY_DEMO_STATS;

  return (
    <DirectionalTransition>
    <div className="space-y-8">
      <AdminDashboard initialStats={initialStats} />
      <div className="px-4 md:px-8 pb-8 max-w-7xl mx-auto">
        <AdminDemographics initialStats={initialDemoStats} />
      </div>
    </div>
    </DirectionalTransition>
  );
};

export default Page;

