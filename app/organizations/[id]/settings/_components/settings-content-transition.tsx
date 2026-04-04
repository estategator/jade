"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

export function SettingsContentTransition({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="fade-in" exit="fade-out" default="none">
      {children}
    </ViewTransition>
  );
}
