import { getCurrentUser } from "@/lib";
import LandingPage from "./Landing";
import { redirect } from "next/navigation";

const Page = async () => {
  const user = await getCurrentUser();

  if (user) {
    const dashboardPath =
      user.role === "ADMIN" ? "/admin" : "/dashboard";
    return redirect(dashboardPath);
  }
  return <LandingPage />;
};

export default Page;
