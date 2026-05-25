import {
  Bell,
  CreditCard,
  FileText,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  Scale,
  Settings,
  Sparkles,
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
      id: "/notifications",
      label: "Notifications",
      icon: <Bell size={20} />,
      href: "/notifications",
    },
  ];

  return role === "ADMIN"
    ? [
        {
          id: "/admin",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
          href: "/admin",
        },
        {
          id: "/admin/users",
          label: "User Management",
          icon: <Users size={20} />,
          href: "/admin/users",
        },
        ...globalItems,
        {
          id: "/admin/complaints",
          label: "User Complaints",
          icon: <FileWarning size={20} />,
          href: "/admin/complaints",
        },
        {
          id: "/admin/configuration",
          label: "Configuration",
          icon: <Settings size={20} />,
          href: "/admin/configuration",
        },
      ]
    : [
        {
          id: "/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
          href: "/dashboard",
        },
        {
          id: "/dashboard/chat",
          label: "Chat with AI",
          icon: <MessageSquareIcon size={20} />,
          href: "/dashboard/chat",
        },
        {
          id: "voice-chat",
          label: "Voice Chat",
          icon: <MicIcon size={20} />,
          href: "",
          subItems: [
            {
              id: "/dashboard/voice",
              label: "Voice",
              href: "/dashboard/voice",
            },
            {
              id: "/dashboard/transcripts",
              label: "Transcripts",
              href: "/dashboard/transcripts",
            },
          ],
        },
        {
          id: "transcribe-documents",
          label: "Digitise documents",
          icon: <FileText size={20} />,
          href: "",
          subItems: [
            {
              id: "/dashboard/transcribe",
              label: "Transcribe",
              href: "/dashboard/transcribe",
            },
            {
              id: "/dashboard/transcriptions",
              label: "Transcriptions",
              href: "/dashboard/transcriptions",
            },
          ],
        },
        {
          id: "/dashboard/transactions",
          label: "Transactions",
          icon: <CreditCard size={20} />,
          href: "/dashboard/transactions",
        },
        {
          id: "legal-review-group",
          label: "Legal Review",
          icon: <Scale size={20} />,
          href: "",
          subItems: [
            {
              id: "/dashboard/review",
              label: "New Review",
              href: "/dashboard/review",
            },
            {
              id: "/dashboard/reviews",
              label: "Review History",
              href: "/dashboard/reviews",
            },
          ],
        },
        {
          id: "/dashboard/billing",
          label: "Billing & Usage",
          icon: <CreditCard size={20} />,
          href: "/dashboard/billing",
        },
        ...globalItems,
        {
          id: "/dashboard/help",
          label: "Help & Support",
          icon: <LifeBuoy size={20} />,
          href: "/dashboard/help",
        },
        {
          id: "/dashboard/freecredits",
          label: "Free Credits",
          icon: <Sparkles size={20} />,
          href: "/dashboard/freecredits",
        },
        {
          id: "/dashboard/settings",
          label: "Settings",
          icon: <Settings size={20} />,
          href: "/dashboard/settings",
        },
      ];
};
