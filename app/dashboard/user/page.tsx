import UserDashboard from "@/components/user/UserDashboard";
import { getCurrentUser } from "@/lib";
import { getVoiceSessions } from "@/lib/actions/voice";

const UserPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sessions: recentSessions } = await getVoiceSessions({
    userId: user.id,
    limit: 6,
    filter: "custom", // Fetch most recent regardless of date for dashboard
  });

  return <UserDashboard user={user} recentSessions={recentSessions} />;
};

export default UserPage;
