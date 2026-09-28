import DirectionalTransition from "@/components/global/DirectionalTransition";
import UserDashboard from "@/components/user/UserDashboard";
import { getCurrentUser } from "@/lib/actions/auth";
import { getVoiceSessions } from "@/lib/actions/voice";

const UserPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sessions: recentSessions } = await getVoiceSessions({
    userId: user.id,
    limit: 6,
    filter: "custom", // Fetch most recent regardless of date for dashboard
  });

  return <DirectionalTransition>

    <UserDashboard user={user} recentSessions={recentSessions} />
  </DirectionalTransition>
};

export default UserPage;
