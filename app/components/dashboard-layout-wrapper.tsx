"use client";

import { useShowSidebar } from "@/lib/use-show-sidebar";
import { DashboardLayout } from "./dashboard-layout";

export function DashboardLayoutWrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showSidebar = useShowSidebar();

  if (!showSidebar) {
    return children;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
