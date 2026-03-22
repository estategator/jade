"use client";

import { motion } from "framer-motion";
import { Database, Download, FileSpreadsheet, FileText } from "lucide-react";

type DataExportSettingsProps = Readonly<{
  orgId: string;
  canManageSettings: boolean;
}>;

export function DataExportSettings({ orgId, canManageSettings }: DataExportSettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Export Data */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Export Data</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-500">Download your organization data in various formats</p>
        </div>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
          <ExportRow
            icon={FileSpreadsheet}
            label="Inventory"
            description="All items, pricing, and metadata"
            formats={["CSV", "JSON"]}
            disabled={!canManageSettings}
          />
          <ExportRow
            icon={FileText}
            label="Sales History"
            description="Transaction records and buyer information"
            formats={["CSV", "JSON"]}
            disabled={!canManageSettings}
          />
          <ExportRow
            icon={Database}
            label="Full Backup"
            description="Complete organization data export"
            formats={["JSON"]}
            disabled={!canManageSettings}
          />
        </div>
      </div>

      {/* Data Retention */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Data Retention</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-500">Configure how long data is stored</p>
        </div>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-medium text-stone-900 dark:text-white">Audit log retention</p>
              <p className="text-xs text-stone-500 dark:text-zinc-500">How long audit entries are kept</p>
            </div>
            <select disabled={!canManageSettings} defaultValue="90d" className="settings-input w-auto">
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="1y">1 year</option>
              <option value="forever">Forever</option>
            </select>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-medium text-stone-900 dark:text-white">Deleted items retention</p>
              <p className="text-xs text-stone-500 dark:text-zinc-500">Recovery window for deleted inventory</p>
            </div>
            <select disabled={!canManageSettings} defaultValue="30d" className="settings-input w-auto">
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ExportRow({
  icon: Icon,
  label,
  description,
  formats,
  disabled,
}: Readonly<{
  icon: typeof Database;
  label: string;
  description: string;
  formats: string[];
  disabled?: boolean;
}>) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
        <div>
          <p className="text-sm font-medium text-stone-900 dark:text-white">{label}</p>
          <p className="text-xs text-stone-500 dark:text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {formats.map((fmt) => (
          <button
            key={fmt}
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-3 w-3" />
            {fmt}
          </button>
        ))}
      </div>
    </div>
  );
}
