'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { isStaffUser as _isStaffUser, getProfileRole as _getProfileRole } from '@/lib/rbac';
import type { SupportTicket, TicketReply, TicketStatus } from '@/app/help/actions';

// ── Types ────────────────────────────────────────────────────

export type TicketWithOrg = SupportTicket & {
  org_name: string;
  user_email: string;
  reply_count: number;
};

export type { ProfileRole } from '@/lib/rbac-types';

// Wrap centralized helpers as proper server actions (re-exports from
// a 'use server' module are not callable across the client boundary).
export async function getProfileRole(userId: string) {
  return _getProfileRole(userId);
}

export async function isStaffUser(userId: string) {
  return _isStaffUser(userId);
}

// ── Queries ──────────────────────────────────────────────────

export async function getAllTickets(
  userId: string,
  statusFilter?: TicketStatus | 'all'
): Promise<{ data?: TicketWithOrg[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: tickets, error: ticketError } = await query;

    if (ticketError) {
      console.error('Supabase error:', ticketError);
      return { error: 'Failed to load tickets.' };
    }

    if (!tickets || tickets.length === 0) {
      return { data: [] };
    }

    // Gather org names and user emails in batch
    const orgIds = [...new Set(tickets.map((t) => t.org_id))];
    const userIds = [...new Set(tickets.map((t) => t.user_id))];
    const ticketIds = tickets.map((t) => t.id);

    const [orgsResult, profilesResult, replyCounts] = await Promise.all([
      supabase.from('organizations').select('id, name').in('id', orgIds),
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase
        .from('ticket_replies')
        .select('ticket_id')
        .in('ticket_id', ticketIds),
    ]);

    const orgMap = new Map(
      (orgsResult.data ?? []).map((o) => [o.id, o.name as string])
    );
    const profileMap = new Map(
      (profilesResult.data ?? []).map((p) => [p.id, p.full_name as string])
    );

    // Count replies per ticket
    const replyCountMap = new Map<string, number>();
    for (const r of replyCounts.data ?? []) {
      replyCountMap.set(r.ticket_id, (replyCountMap.get(r.ticket_id) ?? 0) + 1);
    }

    const enriched: TicketWithOrg[] = (tickets as SupportTicket[]).map((t) => ({
      ...t,
      org_name: orgMap.get(t.org_id) ?? 'Unknown',
      user_email: profileMap.get(t.user_id) ?? 'Unknown',
      reply_count: replyCountMap.get(t.id) ?? 0,
    }));

    return { data: enriched };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getTicketDetail(
  userId: string,
  ticketId: string
): Promise<{
  data?: SupportTicket & { replies: TicketReply[]; org_name: string; user_email: string };
  error?: string;
}> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return { error: 'Ticket not found.' };
    }

    const [repliesResult, orgResult, profileResult] = await Promise.all([
      supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
      supabase
        .from('organizations')
        .select('name')
        .eq('id', ticket.org_id)
        .single(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', ticket.user_id)
        .single(),
    ]);

    return {
      data: {
        ...(ticket as SupportTicket),
        replies: (repliesResult.data ?? []) as TicketReply[],
        org_name: (orgResult.data?.name as string) ?? 'Unknown',
        user_email: (profileResult.data?.full_name as string) ?? 'Unknown',
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Mutations ────────────────────────────────────────────────

export async function updateTicketStatus(
  userId: string,
  ticketId: string,
  status: TicketStatus
): Promise<{ success?: boolean; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (status === 'resolved') {
      updateData.resolved_at = now;
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update ticket status.' };
    }
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function adminReplyToTicket(
  userId: string,
  ticketId: string,
  message: string
): Promise<{ success?: boolean; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  const trimmed = message.trim();
  if (!trimmed) return { error: 'Reply message is required.' };
  if (trimmed.length > 5000) return { error: 'Reply must be 5000 characters or fewer.' };

  try {
    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: ticketId,
      user_id: userId,
      is_admin: true,
      message: trimmed,
    });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Something went wrong. Please try again.' };
    }

    // Update ticket timestamp
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getTicketStats(userId: string): Promise<{
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  error?: string;
}> {
  const staff = await isStaffUser(userId);
  if (!staff) return { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, error: 'Access denied.' };

  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('status');

    if (error) {
      console.error('Supabase error:', error);
      return { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, error: 'Failed to load stats.' };
    }

    const statuses = data ?? [];
    return {
      total: statuses.length,
      open: statuses.filter((s) => s.status === 'open').length,
      in_progress: statuses.filter((s) => s.status === 'in_progress').length,
      resolved: statuses.filter((s) => s.status === 'resolved').length,
      closed: statuses.filter((s) => s.status === 'closed').length,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, error: 'An unexpected error occurred.' };
  }
}
