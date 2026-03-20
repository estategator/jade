"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type SidebarContextValue = {
  isExpanded: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarExpanded");
    return stored !== null ? JSON.parse(stored) : true;
  });

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", JSON.stringify(isExpanded));
  }, [isExpanded]);

  return (
    <SidebarContext.Provider value={{ isExpanded, toggle: () => setIsExpanded((p: boolean) => !p) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
