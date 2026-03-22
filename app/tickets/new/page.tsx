"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveOrgId } from "@/lib/active-org";
import { PageHeader } from "@/app/components/page-header";
import { TicketForm } from "@/app/components/ticket-form";
import { getTicketLimits } from "@/app/help/actions";
import type { SubscriptionTier } from "@/lib/tiers";
import type { TicketPriority } from "@/app/help/actions";

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [ticketsUsed, setTicketsUsed] = useState(0);
  const [ticketLimit, setTicketLimit] = useState(2);
  const [allowedPriorities, setAllowedPriorities] = useState<TicketPriority[]>(["low"]);

  const loadLimits = useCallback(async (oid: string) => {
    const limits = await getTicketLimits(oid);
    setTier(limits.tier);
    setTicketsUsed(limits.used);
    setTicketLimit(limits.limit);
    setAllowedPriorities(limits.allowedPriorities);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      const oid = getActiveOrgId();
      if (oid) {
        setOrgId(oid);
        await loadLimits(oid);
      }
      setLoading(false);
    }
    init();
  }, [router, loadLimits]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Submit a Ticket"
        description="Describe your issue and our team will get back to you."
        backLink={{ href: "/tickets", label: "My Tickets" }}
      />

      {orgId && userId ? (
        <TicketForm
          orgId={orgId}
          userId={userId}
          tier={tier}
          ticketsUsed={ticketsUsed}
          ticketLimit={ticketLimit}
          allowedPriorities={allowedPriorities}
        />
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            Please select an organization to submit tickets.
          </p>
        </div>
      )}
    </div>
  );
}
