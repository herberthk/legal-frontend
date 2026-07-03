import React from "react";
import { getAdminUsers, getAdminUserSummaryStats } from "@/lib/actions/admin";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import type { Metadata } from "next";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const metadata: Metadata = {
  title: "User Management | Admin Dashboard",
  description: "Manage platform users — view, create, update, suspend, ban, or delete users.",
};

// Force dynamic rendering so fresh data is fetched on every request
export const dynamic = "force-dynamic";

const AdminUsersPage = async () => {
  const [usersResult, statsResult] = await Promise.all([
    getAdminUsers({ pageSize: 20, sortBy: "createdAt", sortOrder: "desc" }),
    getAdminUserSummaryStats(),
  ]);

  const initialUsers = usersResult.success ? usersResult.users : [];
  const initialTotal = usersResult.success ? usersResult.totalCount : 0;
  const initialTotalPages = usersResult.success ? usersResult.totalPages : 1;
  const initialStats = statsResult.success && statsResult.stats
    ? statsResult.stats
    : { totalUsers: 0, activeUsers: 0, suspendedUsers: 0, bannedUsers: 0, deletedUsers: 0 };

  return (
    <DirectionalTransition>
      <AdminUsersClient
        initialUsers={initialUsers}
        initialTotal={initialTotal}
        initialTotalPages={initialTotalPages}
        initialStats={initialStats}
      />
    </DirectionalTransition>
  );
};

export default AdminUsersPage;