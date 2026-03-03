import Header from "@/components/global/Header";
import Sidebar from "@/components/global/Sidebar";
import { getUserSession } from "@/lib";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getUserSession();
  // Protection is now handled by middleware.ts for /dashboard/:path*
  // to preserve the original URL in the returnTo search parameter.
  if (!session) return null; // Fallback for type safety
  //console.log("session", session);
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-200 selection:bg-orange-500/30">
      {/* Mobile Backdrop */}
      {/* {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )} */}

      {/* Sidebar */}
      <Sidebar user={session} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        {/* Header */}
        <Header user={session} />

        <div className="flex-1 overflow-auto relative">{children}</div>
      </main>
    </div>
  );
};
export default DashboardLayout;
