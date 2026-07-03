import React from "react";
import { notFound } from "next/navigation";
import { getAdminUserDetails } from "@/lib/actions/admin";
import AdminUserDetailClient from "@/components/admin/AdminUserDetailClient";
import type { Metadata } from "next";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getAdminUserDetails(id);
  const name = result.data?.user?.name ?? "Unknown User";
  return {
    title: `${name} — User Analytics | Admin`,
    description: `Detailed analytics, transactions, and activity history for user ${name}.`,
  };
}

const AdminUserDetailPage = async ({ params }: Props) => {
  const { id } = await params;
  const result = await getAdminUserDetails(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <DirectionalTransition><AdminUserDetailClient data={result.data} /></DirectionalTransition>;
};

export default AdminUserDetailPage;