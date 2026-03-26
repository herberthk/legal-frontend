import { getCurrentUser } from "@/lib";
import { getNotifications } from "@/lib/actions/notifications";
import NotificationList from "@/components/global/NotificationList";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    filter?: "ALL" | "UNREAD" | "READ";
  }>;
}

const NotificationPage = async ({ searchParams }: PageProps) => {
  const user = await getCurrentUser();
  if (!user) {
    return redirect("/login");
  }

  const { page, filter } = await searchParams;
  const currentPage = Number(page) || 1;
  const currentFilter = filter || "ALL";

  const result = await getNotifications(user.id, {
    page: currentPage,
    pageSize: 10,
    filter: currentFilter,
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Notifications
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Stay updated with your account activity and system alerts.
        </p>
      </div>

      <NotificationList
        initialNotifications={result.notifications || []}
        totalCount={result.totalCount || 0}
        totalPages={result.totalPages || 0}
        currentPage={currentPage}
        currentFilter={currentFilter}
        isAdmin={user.role === "ADMIN"}
        userId={user.id}
      />
    </div>
  );
};

export default NotificationPage;
