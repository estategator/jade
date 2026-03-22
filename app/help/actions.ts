'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import type { SubscriptionTier } from '@/lib/tiers';

// ── Types ────────────────────────────────────────────────────

export type TicketCategory = 'billing' | 'bug' | 'feature' | 'general';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicket = {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  tier_at_creation: SubscriptionTier;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type TicketReply = {
  id: string;
  ticket_id: string;
  user_id: string;
  is_admin: boolean;
  message: string;
  created_at: string;
};

// ── Tier limits ──────────────────────────────────────────────

const MONTHLY_TICKET_LIMITS: Record<SubscriptionTier, number> = {
  free: 2,
  pro: 20,
  enterprise: Infinity,
};

const ALLOWED_PRIORITIES: Record<SubscriptionTier, TicketPriority[]> = {
  free: ['low'],
  pro: ['low', 'medium'],
  enterprise: ['low', 'medium', 'high'],
};

// ── Helpers ──────────────────────────────────────────────────

async function getMonthlyTicketCount(orgId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error('Supabase error:', error);
    return 0;
  }
  return count ?? 0;
}

async function getOrgTier(orgId: string): Promise<SubscriptionTier> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return 'free';
  return (data.tier as SubscriptionTier) ?? 'free';
}

// ── Queries ──────────────────────────────────────────────────

export async function getTickets(
  orgId: string
): Promise<{ data?: SupportTicket[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load tickets.' };
    }
    return { data: (data ?? []) as SupportTicket[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getTicket(
  ticketId: string,
  orgId: string
): Promise<{ data?: SupportTicket & { replies: TicketReply[] }; error?: string }> {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('org_id', orgId)
      .single();

    if (ticketError || !ticket) {
      return { error: 'Ticket not found.' };
    }

    const { data: replies, error: repliesError } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('Supabase error:', repliesError);
      return { error: 'Failed to load ticket replies.' };
    }

    return {
      data: {
        ...(ticket as SupportTicket),
        replies: (replies ?? []) as TicketReply[],
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Mutations ────────────────────────────────────────────────

export async function submitTicket(
  orgId: string,
  userId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const category = (formData.get('category') as TicketCategory) ?? 'general';
  const priority = (formData.get('priority') as TicketPriority) ?? 'low';

  if (!title || !description) {
    return { error: 'Title and description are required.' };
  }
  if (title.length > 200) {
    return { error: 'Title must be 200 characters or fewer.' };
  }
  if (description.length > 5000) {
    return { error: 'Description must be 5000 characters or fewer.' };
  }

  try {
    const tier = await getOrgTier(orgId);

    // Enforce monthly ticket limit
    const currentCount = await getMonthlyTicketCount(orgId);
    const limit = MONTHLY_TICKET_LIMITS[tier];
    if (currentCount >= limit) {
      return {
        error: `You've reached the monthly limit of ${limit} tickets for the ${tier} plan. Upgrade for more.`,
      };
    }

    // Enforce priority limits
    const allowedPriorities = ALLOWED_PRIORITIES[tier];
    const effectivePriority = allowedPriorities.includes(priority)
      ? priority
      : allowedPriorities[0];

    const { error } = await supabase.from('support_tickets').insert({
      org_id: orgId,
      user_id: userId,
      title,
      description,
      category,
      priority: effectivePriority,
      tier_at_creation: tier,
    });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Something went wrong. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function replyToTicket(
  ticketId: string,
  orgId: string,
  userId: string,
  message: string
): Promise<{ success?: boolean; error?: string }> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { error: 'Reply message is required.' };
  }
  if (trimmed.length > 5000) {
    return { error: 'Reply must be 5000 characters or fewer.' };
  }

  try {
    // Verify ticket belongs to org
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .eq('org_id', orgId)
      .single();

    if (ticketError || !ticket) {
      return { error: 'Ticket not found.' };
    }

    if (ticket.status === 'closed') {
      return { error: 'Cannot reply to a closed ticket.' };
    }

    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: ticketId,
      user_id: userId,
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

export async function getTicketLimits(orgId: string): Promise<{
  tier: SubscriptionTier;
  used: number;
  limit: number;
  allowedPriorities: TicketPriority[];
}> {
  const tier = await getOrgTier(orgId);
  const used = await getMonthlyTicketCount(orgId);
  return {
    tier,
    used,
    limit: MONTHLY_TICKET_LIMITS[tier],
    allowedPriorities: ALLOWED_PRIORITIES[tier],
  };
}

// ── Contact Form (unauthenticated) ──────────────────────────

export async function submitContactForm(data: {
  name: string;
  email: string;
  category: string;
  message: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { name, email, category, message } = data;

  if (!name.trim() || !email.trim() || !message.trim()) {
    return { error: 'All fields are required.' };
  }

  if (name.length > 100 || email.length > 200 || message.length > 5000) {
    return { error: 'Input exceeds maximum length.' };
  }

  const { error } = await supabase
    .from('contact_submissions')
    .insert({
      name: name.trim(),
      email: email.trim(),
      category: category || 'general',
      message: message.trim(),
    });

  if (error) {
    console.error('Contact form submission failed:', error);
    return { error: 'Failed to send message. Please try again.' };
  }

  return { success: true };
}
