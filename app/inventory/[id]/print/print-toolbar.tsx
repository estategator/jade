"use client";

import { useEffect } from "react";
import { PiPrinterDuotone, PiArrowLeftDuotone } from "react-icons/pi";

export function PrintToolbar() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="print:hidden flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <PiArrowLeftDuotone className="h-4 w-4" />
        Close
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        <PiPrinterDuotone className="h-4 w-4" />
        Print Label
      </button>
    </div>
  );
}
