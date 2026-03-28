import {
  PiCheckCircleDuotone,
  PiClockDuotone,
  PiProhibitDuotone,
} from "react-icons/pi";

export const statusConfig = {
  draft: {
    label: "Draft",
    icon: PiClockDuotone,
    className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  finalized: {
    label: "Finalized",
    icon: PiCheckCircleDuotone,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  void: {
    label: "Void",
    icon: PiProhibitDuotone,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
} as const;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatAddress(addr: { address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; zip_code?: string | null } | null | undefined): string | null {
  if (!addr) return null;
  const parts: string[] = [];
  if (addr.address_line1) parts.push(addr.address_line1);
  if (addr.address_line2) parts.push(addr.address_line2);
  const cityLine = [addr.city, addr.state].filter(Boolean).join(", ");
  if (cityLine) parts.push(addr.zip_code ? `${cityLine} ${addr.zip_code}` : cityLine);
  else if (addr.zip_code) parts.push(addr.zip_code);
  return parts.length > 0 ? parts.join("\n") : null;
}
