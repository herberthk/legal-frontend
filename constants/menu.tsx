import {
  Bell,
  CreditCard,
  FileText,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from "lucide-react";
import { MessageSquareIcon, MicIcon } from "./icons";

type MenuItems = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  subItems?: Omit<MenuItems, "subItems" | "icon">[];
};
export const sideBarItems = (role: Role): MenuItems[] => {
  const globalItems: MenuItems[] = [
    {
      id: "/dashboard/notifications",
      label: "Notifications",
      icon: <Bell size={20} />,
      href: "/dashboard/notifications",
    },
  ];

  return role === "ADMIN"
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
        ...globalItems,
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
          id: "voice-chat",
          label: "Voice Chat",
          icon: <MicIcon size={20} />,
          href: "",
          subItems: [
            {
              id: "/dashboard/user/voice",
              label: "Voice",
              href: "/dashboard/user/voice",
            },
            {
              id: "/dashboard/user/transcripts",
              label: "Transcripts",
              href: "/dashboard/user/transcripts",
            },
          ],
        },
        {
          id: "transcribe-documents",
          label: "Transcribe documents",
          icon: <FileText size={20} />,
          href: "",
          subItems: [
            {
              id: "/dashboard/user/transcribe",
              label: "Transcribe",
              href: "/dashboard/user/transcribe",
            },
            {
              id: "/dashboard/user/transcriptions",
              label: "Transcriptions",
              href: "/dashboard/user/transcriptions",
            },
          ],
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
        ...globalItems,
        {
          id: "/dashboard/user/help",
          label: "Help & Support",
          icon: <LifeBuoy size={20} />,
          href: "/dashboard/user/help",
        },
        {
          id: "/dashboard/user/settings",
          label: "Settings",
          icon: <Settings size={20} />,
          href: "/dashboard/user/settings",
        },
      ];
};
