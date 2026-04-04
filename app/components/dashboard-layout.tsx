"use client";

import { ReactNode } from "react";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { NotificationProvider } from "@/lib/notification-context";
import { cn } from "@/lib/cn";

interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
}

function DashboardShell({ children, sidebar }: DashboardLayoutProps) {
  const { isExpanded } = useSidebar();

  return (
    <>
      <div style={{ viewTransitionName: "site-sidebar" }}>
        {sidebar}
      </div>
      <main
        className={cn(
          "min-h-screen transition-[margin-left] duration-300 ease-in-out motion-reduce:transition-none",
          isExpanded ? "md:ml-64" : "md:ml-[72px]",
          "bg-stone-50 dark:bg-zinc-950",
        )}
      >
        <div className="mx-auto max-w-[1600px]">
          {children}
        </div>
      </main>
    </>
  );
}

export function DashboardLayout({ children, sidebar }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <NotificationProvider>
        <DashboardShell sidebar={sidebar}>{children}</DashboardShell>
      </NotificationProvider>
    </SidebarProvider>
  );
}
