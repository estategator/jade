// ── Types ────────────────────────────────────────────────────

/**
 * Icon identifiers for sidebar nav items.
 * Resolved to actual React components on the client via SIDEBAR_ICONS map.
 */
export type SidebarIconId =
  | "chart-bar"
  | "package"
  | "buildings"
  | "trend-up"
  | "bell"
  | "megaphone"
  | "receipt"
  | "question"
  | "hand-heart"
  | "ticket"
  | "users"
  | "file-text"
  | "tag"
  | "shield-warning";

export interface NavItem {
  label: string;
  href: string;
  /** Serializable icon identifier — resolved to a component on the client. */
  iconId: SidebarIconId;
  /** When set, the badge count is rendered next to the item. */
  badgeKey?: "unreadCount";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarVisibility {
  isMember: boolean;
  isStaff: boolean;
}

// ── Builder ──────────────────────────────────────────────────

/**
 * Build the sidebar nav sections with role-based filtering already applied.
 * This is a pure function — no hooks, no async — so it can run on the server
 * during SSR and produce the exact same output on the client for hydration.
 *
 * Icon references use serializable string IDs so nav sections can cross the
 * server → client component boundary without serialization errors.
 */
export function buildNavSections(
  visibility: SidebarVisibility,
): NavSection[] {
  const { isMember, isStaff } = visibility;

  return [
    {
      title: "Core",
      items: [
        ...(!isMember
          ? [{ label: "Dashboard", href: "/dashboard", iconId: "chart-bar" as const }]
          : []),
        { label: "Inventory", href: "/inventory", iconId: "package" as const },
        ...(!isMember
          ? [{ label: "Pricing", href: "/pricing-optimization", iconId: "trend-up" as const }]
          : []),
        { label: "Marketing", href: "/marketing", iconId: "megaphone" as const },
        { label: "Invoices", href: "/invoices", iconId: "receipt" as const },
      ],
    },
    {
      title: "Clients",
      items: [
        { label: "Clients", href: "/clients", iconId: "users" as const },
        { label: "Contracts", href: "/contracts", iconId: "file-text" as const },
      ],
    },
    {
      title: "Manage",
      items: [
        {
          label: "Notifications",
          href: "/notifications",
          iconId: "bell" as const,
          badgeKey: "unreadCount" as const,
        },
        { label: "Organizations", href: "/organizations", iconId: "buildings" as const },
      ],
    },
    {
      title: "Support",
      items: [
        { label: "Help", href: "/dashboard/help", iconId: "question" as const },
        { label: "Tickets", href: "/tickets", iconId: "ticket" as const },
        ...(isStaff
          ? [
              { label: "Support Portal", href: "/support", iconId: "hand-heart" as const },
              { label: "Abuse Monitor", href: "/abuse", iconId: "shield-warning" as const },
              { label: "Discounts", href: "/discounts", iconId: "tag" as const },
            ]
          : []),
      ],
    },
  ];
}
