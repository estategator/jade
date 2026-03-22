"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, Loader2, Mail, X } from "lucide-react";

type InviteMemberModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: "admin" | "member") => Promise<void>;
  isLoading?: boolean;
  error?: string;
  warning?: string;
}>;

export function InviteMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
  warning,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");

    if (!email.trim()) {
      setLocalError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    try {
      await onSubmit(email, role);
      setEmail("");
      setRole("member");
      if (!warning) {
        onClose();
      } else {
        setSuccessMessage(warning);
      }
    } catch {
      // Error is surfaced via parent action result; keep modal open.
    }
  }

  function handleClose() {
    if (isLoading) return;
    setEmail("");
    setRole("member");
    setLocalError("");
    setSuccessMessage("");
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="absolute right-4 top-4 rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5 text-[var(--color-brand-primary)]" />
                <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
                  Invite member
                </h2>
              </div>
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Send an invitation to add a new team member to this organization.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="invite-email"
                  className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
                >
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLocalError("");
                  }}
                  placeholder="member@example.com"
                  disabled={isLoading}
                  className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "member")}
                  disabled={isLoading}
                  className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                  {role === "admin"
                    ? "Admins can invite members and manage organization projects."
                    : "Members can collaborate on organization workspaces."}
                </p>
              </div>

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Invitation created!
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      {successMessage}
                    </p>
                  </div>
                </motion.div>
              )}

              {warning && !successMessage && !localError && !error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-subtle)] p-3"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                  <p className="text-sm text-[var(--color-brand-primary)]">
                    {warning}
                  </p>
                </motion.div>
              )}

              {(localError || error) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/40"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {localError || error}
                  </p>
                </motion.div>
              )}

              <div className="flex items-center gap-3 pt-2">
                {successMessage ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--color-brand-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2"
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[var(--color-brand-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isLoading ? "Sending..." : "Send invite"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
