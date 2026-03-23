"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/app/components/sidebar";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/cn";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardShell({ children }: DashboardLayoutProps) {
  const { isExpanded } = useSidebar();

  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-[margin-left] duration-300 ease-in-out motion-reduce:transition-none",
          isExpanded ? "md:ml-64" : "md:ml-[72px]",
          "bg-stone-50 dark:bg-zinc-950",
        )}
      >
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
