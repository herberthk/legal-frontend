import { isAuthenticated } from "@/lib";
import { AuthSidebar } from "./auth-sidebar";

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-[#020617] transition-colors duration-300 selection:bg-indigo-500/30">
      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/5 dark:bg-orange-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row bg-white dark:bg-[#0f172a] rounded-[2rem] overflow-hidden shadow-2xl dark:shadow-indigo-500/10 border border-slate-200 dark:border-slate-800/50 min-h-[650px] transition-all duration-500 hover:shadow-indigo-500/5">
        <AuthSidebar />
        <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-16 xl:px-20 bg-white dark:bg-[#0f172a] relative z-10 transition-colors duration-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
