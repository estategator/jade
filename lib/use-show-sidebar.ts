"use client";

import { usePathname } from "next/navigation";
import { isAppRoute } from "./route-utils";

export function useShowSidebar(): boolean {
  const pathname = usePathname();
  return isAppRoute(pathname);
}
