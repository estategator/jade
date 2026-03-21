"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function DashboardErrorToast({
  errors,
}: Readonly<{ errors: string[] }>) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || errors.length === 0) return;
    shown.current = true;

    if (errors.length === 1) {
      toast.error(errors[0]);
    } else {
      toast.error("Some dashboard data failed to load", {
        description: errors.join("; "),
      });
    }
  }, [errors]);

  return null;
}
