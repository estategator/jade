"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PiPrinterDuotone, PiArrowLeftDuotone, PiTrendUpDuotone } from "react-icons/pi";

type ThermalLabelProps = Readonly<{
  itemName: string;
  itemPrice: number;
  itemDescription: string;
  itemId: string;
  isGreatDeal: boolean;
}>;

export function ThermalLabel({
  itemName,
  itemPrice,
  itemDescription,
  itemId,
  isGreatDeal,
}: ThermalLabelProps) {
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/items/${itemId}`
      : `/items/${itemId}`;

  useEffect(() => {
    // Auto-print after a brief delay so the page renders first
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-zinc-950">
      {/* Screen-only toolbar */}
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
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <PiPrinterDuotone className="h-4 w-4" />
          Print Label
        </button>
      </div>

      {/* Thermal label — visible on screen and the only thing that prints */}
      <div className="flex justify-center px-4 py-8 print:p-0">
        <div className="thermal-label w-full max-w-[58mm] bg-white p-3 text-black print:max-w-none print:shadow-none">
          {/* Item name */}
          <h1 className="text-center text-base font-bold leading-tight">
            {itemName}
          </h1>

          {/* Price */}
          <p className="mt-1 text-center text-2xl font-extrabold">
            ${itemPrice.toFixed(2)}
          </p>

          {/* Good find badge */}
          {isGreatDeal && (
            <div className="mx-auto mt-1.5 flex w-fit items-center gap-1 rounded-md border border-stone-300 px-2 py-0.5 text-xs font-semibold">
              <PiTrendUpDuotone className="h-3 w-3" />
              Great Deal
            </div>
          )}

          {/* Divider */}
          <hr className="my-2 border-dashed border-stone-400" />

          {/* Description */}
          <p className="text-center text-[10px] leading-snug">
            {itemDescription || "Estate sale item"}
          </p>

          {/* Divider */}
          <hr className="my-2 border-dashed border-stone-400" />

          {/* QR Code */}
          <div className="flex justify-center">
            <QRCodeSVG value={publicUrl} size={160} level="M" />
          </div>

          {/* Scan prompt */}
          <p className="mt-1.5 text-center text-[9px] text-stone-500 print:text-black">
            Scan to view &amp; buy online
          </p>
        </div>
      </div>
    </div>
  );
}
