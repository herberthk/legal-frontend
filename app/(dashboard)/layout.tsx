import Header from "@/components/global/Header";
import Sidebar from "@/components/global/Sidebar";
import { getCurrentUser } from "@/lib/actions/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) {
    return redirect("/login");
  }

  // Check if user is admin and redirect to admin dashboard if so
  // if (user.role === "ADMIN") {
  //   return redirect("/admin");
  // }
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
