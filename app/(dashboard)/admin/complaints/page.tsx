import React from 'react';
import AdminComplaints from '@/components/admin/AdminComplaints';
import { getCurrentUser } from '@/lib';
import { getAllSupportTickets } from '@/lib/actions/support';
import { redirect } from 'next/navigation';

export const metadata = {
  title: "Complaints Management | Admin",
  description: "Manage user support tickets and complaints.",
};

const ComplaintsPage = async () => {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    redirect('/dashboard');
  }

  const tickets = await getAllSupportTickets();

  return <AdminComplaints initialTickets={tickets} currentUser={user} />;
};

export default ComplaintsPage;