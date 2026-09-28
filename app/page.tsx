import { getCurrentUser } from "@/lib/actions/auth";
import LandingPage from "./Landing";
import { redirect } from "next/navigation";
import DirectionalTransition from "@/components/global/DirectionalTransition";

const Page = async () => {
  const user = await getCurrentUser();

  if (user) {
    const dashboardPath =
      user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
    return redirect(dashboardPath);
  }
  return <DirectionalTransition><LandingPage /></DirectionalTransition>;
};

export default Page;
