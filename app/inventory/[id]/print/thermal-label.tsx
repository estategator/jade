import { QRCodeSVG } from "qrcode.react";
import { PiTrendUpDuotone } from "react-icons/pi";
import { PrintToolbar } from "./print-toolbar";

type ThermalLabelProps = Readonly<{
  itemName: string;
  itemPrice: number;
  itemDescription: string;
  publicUrl: string;
  isGreatDeal: boolean;
}>;

export function ThermalLabel({
  itemName,
  itemPrice,
  itemDescription,
  publicUrl,
  isGreatDeal,
}: ThermalLabelProps) {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-zinc-950">
      <PrintToolbar />

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
