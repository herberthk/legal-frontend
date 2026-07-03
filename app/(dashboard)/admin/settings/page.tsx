import { getAuthenticatedAdmin } from "@/lib/actions/admin";
import { redirect } from "next/navigation";
import AdminSettingsClient from "@/components/admin/AdminSettingsClient";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const metadata = {
  title: "Admin Settings",
  description: "Manage your administrator profile and security settings.",
};

export default async function AdminSettingsPage() {
  const admin = await getAuthenticatedAdmin();

  if (!admin || (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  return <DirectionalTransition><AdminSettingsClient admin={admin} /></DirectionalTransition>
}
