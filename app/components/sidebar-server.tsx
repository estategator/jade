import { createClient } from "@/utils/supabase/server";
import { getOrgRole, getProfileRole, resolveActiveOrgId } from "@/lib/rbac";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { buildNavSections, type NavSection } from "@/lib/sidebar-nav";
import { SidebarClient } from "@/app/components/sidebar-client";

export interface SidebarServerData {
  navSections: NavSection[];
  unreadCount: number;
}

/**
 * Server component that resolves sidebar visibility on the server
 * and passes pre-filtered nav sections to the client sidebar shell.
 *
 * This ensures role-restricted links (Dashboard, Pricing, staff-only)
 * are never included in the initial HTML for unauthorized users.
 */
export async function SidebarServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated — render nothing; layout handles auth gating
    return null;
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  // Parallel: org role, staff role, unread count
  const [orgRole, profileRole, { count: unreadCount }] = await Promise.all([
    activeOrgId ? getOrgRole(activeOrgId, user.id) : Promise.resolve(null),
    getProfileRole(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  const isMember = orgRole === "member";
  const isStaff = profileRole === "developer" || profileRole === "support";

  const navSections = buildNavSections({ isMember, isStaff });

  return (
    <SidebarClient
      navSections={navSections}
      initialUnreadCount={unreadCount}
    />
  );
}
