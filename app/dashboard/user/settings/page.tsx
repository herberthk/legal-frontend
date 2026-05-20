import { getCurrentUser } from "@/lib";
import SettingsForm from "@/components/user/SettingsForm";
import { redirect } from "next/navigation";
import BackButton from "@/components/global/BackButton";

export const metadata = {
  title: "Settings | Legal Adviser",
  description: "Manage your account settings and profile information.",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 mb-10 text-left px-2 md:px-4 items-start">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            Account Settings
          </h1>
        </div>
        <p className="md:text-xl text-base text-muted-foreground ml-2">
          Manage your account preferences and profile information.
        </p>
      </div>
      
      <SettingsForm user={user} />
    </div>
  );
}
