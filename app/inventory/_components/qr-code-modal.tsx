"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, ExternalLink, Printer } from "lucide-react";

type QrModalProps = Readonly<{
  itemId: string;
  itemName: string;
  onClose: () => void;
}>;

export function QrCodeModal({ itemId, itemName, onClose }: QrModalProps) {
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/items/${itemId}`
      : `/items/${itemId}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-lg font-bold text-stone-900 dark:text-white">
          QR Code
        </h2>
        <p className="mb-5 truncate text-sm text-stone-500 dark:text-zinc-400">
          {itemName}
        </p>

        {/* QR */}
        <div className="mx-auto mb-5 flex w-fit items-center justify-center rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-700">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        {/* Print thermal label */}
        <a
          href={`/inventory/${itemId}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Printer className="h-4 w-4" />
          Print Thermal Label
        </a>

        {/* URL + actions */}
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
          <span className="min-w-0 flex-1 truncate text-xs text-stone-600 dark:text-zinc-400">
            {url}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
            title="Copy link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
            title="Open detail page"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
