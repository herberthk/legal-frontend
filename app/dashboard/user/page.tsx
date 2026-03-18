import UserDashboard from "@/components/user/UserDashboard";
import { getCurrentUser } from "@/lib";

const UserPage = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserDashboard user={user} />;
};

export default UserPage;
