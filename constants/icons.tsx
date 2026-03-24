import {
  CreditCard,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from "lucide-react";

export const MicIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
export const MessageSquareIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
export const FileTextIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const sideBarItems = (role: Role) =>
  role === "ADMIN"
    ? [
        {
          id: "/dashboard/admin",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
          href: "/dashboard/admin",
        },
        {
          id: "/dashboard/admin/users",
          label: "User Management",
          icon: <Users size={20} />,
          href: "/dashboard/admin/users",
        },
        {
          id: "/dashboard/admin/complaints",
          label: "User Complaints",
          icon: <FileWarning size={20} />,
          href: "/dashboard/admin/complaints",
        },
        {
          id: "/dashboard/admin/configuration",
          label: "Configuration",
          icon: <Settings size={20} />,
          href: "/dashboard/admin/configuration",
        },
      ]
    : [
        {
          id: "/dashboard/user",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
          href: "/dashboard/user",
        },
        {
          id: "/dashboard/user/chat",
          label: "Chat with AI",
          icon: <MessageSquareIcon size={20} />,
          href: "/dashboard/user/chat",
        },
        {
          id: "/dashboard/user/voice",
          label: "Voice Chat",
          icon: <MicIcon size={20} />,
          href: "/dashboard/user/voice",
        },
        {
          id: "/dashboard/user/transactions",
          label: "Transactions",
          icon: <CreditCard size={20} />,
          href: "/dashboard/user/transactions",
        },
        {
          id: "/dashboard/user/billing",
          label: "Billing & Usage",
          icon: <CreditCard size={20} />,
          href: "/dashboard/user/billing",
        },
        {
          id: "/dashboard/user/help",
          label: "Help & Support",
          icon: <LifeBuoy size={20} />,
          href: "/dashboard/user/help",
        },
      ];
