"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { deleteOrganization } from "@/app/organizations/actions";

type DangerZoneSettingsProps = Readonly<{
  orgId: string;
  orgName: string;
  canDeleteOrg: boolean;
}>;

export function DangerZoneSettings({ orgId, orgName, canDeleteOrg }: DangerZoneSettingsProps) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDeleteOrg() {
    if (confirmName !== orgName) return;

    setDeleting(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated.");
      setDeleting(false);
      return;
    }

    const result = await deleteOrganization(orgId, session.user.id);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }

    router.push("/organizations");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Transfer Ownership */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Transfer Ownership</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-500">Transfer this organization to another super admin</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-stone-600 dark:text-zinc-400">
            Transferring ownership will make another member the primary owner with full control over organization settings, billing, and deletion.
          </p>
          <button
            type="button"
            disabled
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 transition-colors dark:border-zinc-700 dark:text-zinc-500"
          >
            Transfer ownership
          </button>
        </div>
      </div>

      {/* Delete Organization */}
      <div className="rounded-xl border border-red-200 bg-white dark:border-red-900/40 dark:bg-zinc-900">
        <div className="border-b border-red-100 px-5 py-3 dark:border-red-900/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Delete Organization</h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-500">This action is permanent and cannot be undone</p>
        </div>
        <div className="px-5 py-4">
          {!canDeleteOrg ? (
            <p className="text-sm text-stone-500 dark:text-zinc-400">
              Only super admins can delete this organization.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Deleting this organization will permanently remove all inventory, sales data, team members, and settings.
              </p>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
                  {error}
                </p>
              )}

              <div>
                <label htmlFor="confirm-delete" className="settings-label">
                  Type <span className="font-semibold text-stone-900 dark:text-white">{orgName}</span> to confirm
                </label>
                <input
                  id="confirm-delete"
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={orgName}
                  className="settings-input max-w-xs"
                />
              </div>

              <button
                type="button"
                disabled={confirmName !== orgName || deleting}
                onClick={handleDeleteOrg}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete organization
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
