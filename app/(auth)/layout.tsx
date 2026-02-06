import { getUserSession } from "@/lib";
import { redirect } from "next/navigation";

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getUserSession();

  if (session) {
    const path =
      session.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/user";
    redirect(path);
  }
  console.log("session", session);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200 selection:bg-orange-500/30">
      {children}
    </div>
  );
};

export default AuthLayout;
