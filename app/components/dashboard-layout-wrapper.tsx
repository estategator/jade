"use client";

import type { ReactNode } from "react";
import { useShowSidebar } from "@/lib/use-show-sidebar";
import { DashboardLayout } from "./dashboard-layout";

export function DashboardLayoutWrapper({
  children,
  sidebar,
}: Readonly<{
  children: React.ReactNode;
  sidebar: ReactNode;
}>) {
  const showSidebar = useShowSidebar();

  if (!showSidebar) {
    return children;
  }

  return <DashboardLayout sidebar={sidebar}>{children}</DashboardLayout>;
}
