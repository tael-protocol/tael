import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CreditCard,
  FlaskConical,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ArrowLeftRight,
  Rocket,
  Settings,
  Star,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for the dashboard sidebar, grouped into labelled
 * sections. Order = display order.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Marketplace", href: "/marketplace", icon: Store },
      { label: "Wallet", href: "/wallet", icon: Wallet },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "My Capabilities", href: "/capabilities", icon: Boxes },
      { label: "Cards", href: "/agents", icon: CreditCard },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Train", href: "/studio/train", icon: BookOpen },
      { label: "Test", href: "/studio/test", icon: FlaskConical },
      { label: "Deploy", href: "/studio/deploy", icon: Rocket },
      { label: "Inbox", href: "/studio/inbox", icon: Inbox },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Payments", href: "/payments", icon: ArrowLeftRight },
      { label: "Reviews", href: "/reviews", icon: Star },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Organizations", href: "/organizations", icon: Building2 },
      { label: "API Keys", href: "/api-keys", icon: KeyRound },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flat list of every nav item, in display order. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
