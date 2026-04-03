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

// ── Abuse Monitor ────────────────────────────────────────────

export type AbuseStateRow = {
  org_id: string;
  org_name: string;
  score_30d: number;
  enforcement_level: string;
  cooldown_until: string | null;
  lock_until: string | null;
  strike_count: number;
  updated_at: string;
};

export type AbuseEventRow = {
  id: string;
  org_id: string;
  org_name: string;
  actor_user_id: string;
  actor_name: string;
  rule_key: string;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AbuseTrendPoint = {
  date: string;
  event_count: number;
  total_weight: number;
};

export type RuleBreakdownItem = {
  rule_key: string;
  count: number;
  total_weight: number;
};

export type DeviceSignalRow = {
  org_id: string;
  org_name: string;
  device_hash: string;
  user_count: number;
  last_seen_at: string;
};

export type AbuseOverview = {
  total_orgs: number;
  warning_count: number;
  cooldown_count: number;
  lock_count: number;
  total_score: number;
};

export async function getAbuseOverview(
  userId: string,
): Promise<{ data?: AbuseOverview; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const { data, error } = await supabase
      .from('org_abuse_state')
      .select('enforcement_level, score_30d');

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load abuse overview.' };
    }

    const rows = data ?? [];
    return {
      data: {
        total_orgs: rows.length,
        warning_count: rows.filter((r) => r.enforcement_level === 'warning').length,
        cooldown_count: rows.filter((r) => r.enforcement_level === 'cooldown').length,
        lock_count: rows.filter((r) => r.enforcement_level === 'lock').length,
        total_score: rows.reduce((s, r) => s + (r.score_30d ?? 0), 0),
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getAbuseStates(
  userId: string,
  filters?: { enforcementLevel?: string; orgId?: string },
): Promise<{ data?: AbuseStateRow[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    let query = supabase
      .from('org_abuse_state')
      .select('*')
      .order('score_30d', { ascending: false })
      .limit(100);

    if (filters?.enforcementLevel && filters.enforcementLevel !== 'all') {
      query = query.eq('enforcement_level', filters.enforcementLevel);
    }
    if (filters?.orgId) {
      query = query.eq('org_id', filters.orgId);
    }

    const { data: states, error: stateError } = await query;
    if (stateError) {
      console.error('Supabase error:', stateError);
      return { error: 'Failed to load abuse states.' };
    }

    if (!states || states.length === 0) return { data: [] };

    const orgIds = states.map((s) => s.org_id);
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));

    const rows: AbuseStateRow[] = states.map((s) => ({
      org_id: s.org_id,
      org_name: orgMap.get(s.org_id) ?? 'Unknown',
      score_30d: s.score_30d ?? 0,
      enforcement_level: s.enforcement_level ?? 'none',
      cooldown_until: s.cooldown_until,
      lock_until: s.lock_until,
      strike_count: s.strike_count ?? 0,
      updated_at: s.updated_at,
    }));

    return { data: rows };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getAbuseEvents(
  userId: string,
  filters?: { days?: number; orgId?: string; ruleKey?: string },
): Promise<{ data?: AbuseEventRow[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const days = filters?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('org_abuse_events')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.orgId) query = query.eq('org_id', filters.orgId);
    if (filters?.ruleKey) query = query.eq('rule_key', filters.ruleKey);

    const { data: events, error: eventError } = await query;
    if (eventError) {
      console.error('Supabase error:', eventError);
      return { error: 'Failed to load abuse events.' };
    }

    if (!events || events.length === 0) return { data: [] };

    const orgIds = [...new Set(events.map((e) => e.org_id))];
    const actorIds = [...new Set(events.map((e) => e.actor_user_id))];

    const [orgsResult, profilesResult] = await Promise.all([
      supabase.from('organizations').select('id, name').in('id', orgIds),
      supabase.from('profiles').select('id, full_name').in('id', actorIds),
    ]);

    const orgMap = new Map((orgsResult.data ?? []).map((o) => [o.id, o.name as string]));
    const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name as string]));

    const rows: AbuseEventRow[] = events.map((e) => ({
      id: e.id,
      org_id: e.org_id,
      org_name: orgMap.get(e.org_id) ?? 'Unknown',
      actor_user_id: e.actor_user_id,
      actor_name: profileMap.get(e.actor_user_id) ?? 'Unknown',
      rule_key: e.rule_key,
      weight: e.weight,
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
      created_at: e.created_at,
    }));

    return { data: rows };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getAbuseTrend(
  userId: string,
  filters?: { days?: number; orgId?: string },
): Promise<{ data?: AbuseTrendPoint[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const days = filters?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('org_abuse_events')
      .select('created_at, weight')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (filters?.orgId) query = query.eq('org_id', filters.orgId);

    const { data: events, error: eventError } = await query;
    if (eventError) {
      console.error('Supabase error:', eventError);
      return { error: 'Failed to load abuse trend.' };
    }

    // Group by date
    const byDate = new Map<string, { count: number; weight: number }>();
    for (const e of events ?? []) {
      const date = e.created_at.slice(0, 10);
      const entry = byDate.get(date) ?? { count: 0, weight: 0 };
      entry.count += 1;
      entry.weight += e.weight;
      byDate.set(date, entry);
    }

    // Fill empty days
    const points: AbuseTrendPoint[] = [];
    const start = new Date(since);
    for (let i = 0; i <= days; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = byDate.get(key);
      points.push({
        date: key,
        event_count: entry?.count ?? 0,
        total_weight: entry?.weight ?? 0,
      });
    }

    return { data: points };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getAbuseRuleBreakdown(
  userId: string,
  filters?: { days?: number; orgId?: string },
): Promise<{ data?: RuleBreakdownItem[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const days = filters?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('org_abuse_events')
      .select('rule_key, weight')
      .gte('created_at', since);

    if (filters?.orgId) query = query.eq('org_id', filters.orgId);

    const { data: events, error: eventError } = await query;
    if (eventError) {
      console.error('Supabase error:', eventError);
      return { error: 'Failed to load rule breakdown.' };
    }

    const byRule = new Map<string, { count: number; weight: number }>();
    for (const e of events ?? []) {
      const entry = byRule.get(e.rule_key) ?? { count: 0, weight: 0 };
      entry.count += 1;
      entry.weight += e.weight;
      byRule.set(e.rule_key, entry);
    }

    const items: RuleBreakdownItem[] = Array.from(byRule.entries())
      .map(([rule_key, { count, weight }]) => ({ rule_key, count, total_weight: weight }))
      .sort((a, b) => b.total_weight - a.total_weight);

    return { data: items };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getDeviceSignals(
  userId: string,
  filters?: { orgId?: string },
): Promise<{ data?: DeviceSignalRow[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    let query = supabase
      .from('user_session_signals')
      .select('org_id, device_hash, user_id, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(500);

    if (filters?.orgId) query = query.eq('org_id', filters.orgId);

    const { data: signals, error: sigError } = await query;
    if (sigError) {
      console.error('Supabase error:', sigError);
      return { error: 'Failed to load device signals.' };
    }

    if (!signals || signals.length === 0) return { data: [] };

    // Group by org_id + device_hash
    const grouped = new Map<string, { org_id: string; device_hash: string; users: Set<string>; last_seen: string }>();
    for (const s of signals) {
      const key = `${s.org_id}:${s.device_hash}`;
      const entry = grouped.get(key);
      if (entry) {
        entry.users.add(s.user_id);
        if (s.last_seen_at > entry.last_seen) entry.last_seen = s.last_seen_at;
      } else {
        grouped.set(key, { org_id: s.org_id, device_hash: s.device_hash, users: new Set([s.user_id]), last_seen: s.last_seen_at });
      }
    }

    // Only include devices with 2+ users
    const multiUser = Array.from(grouped.values()).filter((g) => g.users.size >= 2);

    if (multiUser.length === 0) return { data: [] };

    const orgIds = [...new Set(multiUser.map((g) => g.org_id))];
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));

    const rows: DeviceSignalRow[] = multiUser
      .map((g) => ({
        org_id: g.org_id,
        org_name: orgMap.get(g.org_id) ?? 'Unknown',
        device_hash: g.device_hash,
        user_count: g.users.size,
        last_seen_at: g.last_seen,
      }))
      .sort((a, b) => b.user_count - a.user_count);

    return { data: rows };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
