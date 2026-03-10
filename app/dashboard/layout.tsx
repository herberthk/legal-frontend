import Header from "@/components/global/Header";
import Sidebar from "@/components/global/Sidebar";
import { getCurrentUser } from "@/lib";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getCurrentUser();
  // Protection is now handled by middleware.ts for /dashboard/:path*
  // to preserve the original URL in the returnTo search parameter.
  if (!user) return null; // Fallback for type safety
  //console.log("session", session);
  return (
    <SidebarProvider>
      <Sidebar user={user} />
      <SidebarInset className="flex-1 flex flex-col min-h-screen min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-hidden">
        {/* Header */}
        <Header user={user} />

        <div className="flex-1 overflow-auto relative">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
};
export default DashboardLayout;
