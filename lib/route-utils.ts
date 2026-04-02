/**
 * Determines if a pathname should show the sidebar (app routes only)
 */
export function isAppRoute(pathname: string): boolean {
  const appRoutes = [
    "/dashboard",
    "/onboarding",
    "/clients",
    "/contracts",
    "/inventory",
    "/cart",
    "/checkout",
    "/pricing-optimization",
    "/marketing",
    "/invoices",
    "/settings",
    "/organizations",
    "/upgrade",
    "/notifications",
    "/dashboard/help",
    "/tickets",
    "/support",
  ];

  return appRoutes.some((route) => pathname.startsWith(route));
}
