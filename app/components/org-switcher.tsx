"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "@/app/components/settings-provider";
import { getOrganizations, type Organization, type OrgMember } from "@/app/organizations/actions";
import { TierBadge } from "@/app/components/tier-badge";
import { type SubscriptionTier } from "@/lib/tiers";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

type OrgWithRole = Organization & { myRole: OrgMember["role"] };

type OrgSwitcherProps = {
  dropdownDirection?: "up" | "down";
};

function OrgAvatar({
  initial,
  active,
  size = "sm",
}: {
  initial: string;
  active: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-bold",
        size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
        active
          ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
          : "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400"
      )}
    >
      {initial}
    </div>
  );
}

export function OrgSwitcher({ dropdownDirection = "down" }: Readonly<OrgSwitcherProps>) {
  const { activeOrgId, setActiveOrg, userId } = useSettings();
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      let uid = userId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user.id ?? null;
      }
      if (!uid) return;
      const result = await getOrganizations(uid);
      if (result.data) setOrgs(result.data);
    }
    load();
  }, [userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const orgInitial = activeOrg?.name[0]?.toUpperCase() ?? "P";
  const orgTier = (activeOrg?.subscription_tier ?? "free") as SubscriptionTier;

  const isUp = dropdownDirection === "up";
  const dropdownPositionClass = isUp ? "bottom-full mb-1.5" : "top-full mt-1.5";

  if (orgs.length === 0) return null;

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={`Organization: ${activeOrg ? activeOrg.name : "Personal"}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          open
            ? "bg-stone-100 dark:bg-zinc-800"
            : "hover:bg-stone-50 dark:hover:bg-zinc-800/50"
        )}
      >
        <OrgAvatar initial={orgInitial} active={!!activeOrgId} />

        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span className="w-full truncate text-left text-sm font-semibold text-stone-900 dark:text-white">
            {activeOrg ? activeOrg.name : "Personal"}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-zinc-500">
            {activeOrgId ? (
              <TierBadge tier={orgTier} />
            ) : (
              "No organization"
            )}
          </span>
        </div>

        <ChevronsUpDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors dark:text-zinc-600",
            open && "text-stone-500 dark:text-zinc-400"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: isUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: isUp ? 4 : -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute left-0 z-50 w-full min-w-[220px] overflow-hidden rounded-xl border border-stone-200/80 bg-white p-1 shadow-xl shadow-stone-200/50 dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/30",
              dropdownPositionClass
            )}
            role="listbox"
            aria-label="Select organization"
          >
            {/* Personal */}
            <button
              type="button"
              role="option"
              aria-selected={!activeOrgId}
              onClick={() => {
                setActiveOrg(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                !activeOrgId
                  ? "bg-indigo-50 dark:bg-indigo-500/10"
                  : "hover:bg-stone-50 dark:hover:bg-zinc-800/60"
              )}
            >
              <OrgAvatar initial="P" active={!activeOrgId} />
              <span
                className={cn(
                  "flex-1 truncate font-medium",
                  !activeOrgId
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-stone-700 dark:text-zinc-300"
                )}
              >
                Personal
              </span>
              {!activeOrgId && (
                <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              )}
            </button>

            {orgs.length > 0 && (
              <div className="mx-2 my-1 h-px bg-stone-100 dark:bg-zinc-800" />
            )}

            {/* Orgs */}
            {orgs.map((org) => {
              const selected = activeOrgId === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setActiveOrg(org.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-stone-50 dark:hover:bg-zinc-800/60"
                  )}
                >
                  <OrgAvatar
                    initial={org.name[0]?.toUpperCase() ?? "?"}
                    active={selected}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate font-medium",
                        selected
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-stone-700 dark:text-zinc-300"
                      )}
                    >
                      {org.name}
                    </span>
                    <span className="text-[11px] text-stone-400 dark:text-zinc-500">
                      <TierBadge
                        tier={
                          (org.subscription_tier ?? "free") as SubscriptionTier
                        }
                      />
                    </span>
                  </div>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
