/**
 * Determines if a pathname should show the sidebar (app routes only)
 */
export function isAppRoute(pathname: string): boolean {
  const appRoutes = [
    "/dashboard",
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
    "/developer",
  ];

  return appRoutes.some((route) => pathname.startsWith(route));
}
