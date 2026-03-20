'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireOrgMembership } from '@/lib/rbac';

export type DashboardStats = {
  totalItems: number;
  totalRevenue: number;
  totalSoldRevenue: number;
  availableItems: number;
  soldItems: number;
};

export type CategoryBreakdown = {
  category: string;
  count: number;
};

export type RevenueByMonth = {
  month: string;
  revenue: number;
};

export type StatusBreakdown = {
  status: string;
  count: number;
  revenue: number;
};

export async function getDashboardStats(userId: string, orgId?: string | null) {
  try {
    let query = supabase
      .from('inventory_items')
      .select('price, status');

    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
      query = query.eq('org_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load stats.' };
    }

    const items = data ?? [];
    const totalItems = items.length;
    const totalRevenue = items.reduce((sum, i) => sum + Number(i.price), 0);
    const totalSoldRevenue = items
      .filter((i) => i.status === 'sold')
      .reduce((sum, i) => sum + Number(i.price), 0);
    const availableItems = items.filter((i) => i.status === 'available').length;
    const soldItems = items.filter((i) => i.status === 'sold').length;

    return {
      data: { totalItems, totalRevenue, totalSoldRevenue, availableItems, soldItems } as DashboardStats,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getCategoryBreakdown(userId: string, orgId?: string | null) {
  try {
    let query = supabase
      .from('inventory_items')
      .select('category');

    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
      query = query.eq('org_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load categories.' };
    }

    const counts: Record<string, number> = {};
    for (const item of data ?? []) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }

    const breakdown: CategoryBreakdown[] = Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { data: breakdown };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getRevenueByMonth(userId: string, orgId?: string | null) {
  try {
    let query = supabase
      .from('inventory_items')
      .select('price, sold_at')
      .eq('status', 'sold')
      .not('sold_at', 'is', null);

    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
      query = query.eq('org_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load revenue data.' };
    }

    const monthlyRevenue: Record<string, number> = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyRevenue[key] = 0;
    }

    for (const item of data ?? []) {
      const d = new Date(item.sold_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (key in monthlyRevenue) {
        monthlyRevenue[key] += Number(item.price);
      }
    }

    const result: RevenueByMonth[] = Object.entries(monthlyRevenue).map(
      ([month, revenue]) => ({ month, revenue })
    );

    return { data: result };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getStatusBreakdown(userId: string, orgId?: string | null) {
  try {
    let query = supabase
      .from('inventory_items')
      .select('status, price');

    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
      query = query.eq('org_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load status data.' };
    }

    const statusMap: Record<string, { count: number; revenue: number }> = {};
    for (const item of data ?? []) {
      if (!statusMap[item.status]) {
        statusMap[item.status] = { count: 0, revenue: 0 };
      }
      statusMap[item.status].count += 1;
      statusMap[item.status].revenue += Number(item.price);
    }

    const breakdown: StatusBreakdown[] = Object.entries(statusMap).map(
      ([status, vals]) => ({ status, ...vals })
    );

    return { data: breakdown };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Sales ────────────────────────────────────────────────────

export type Sale = {
  id: string;
  inventory_item_id: string;
  buyer_email: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  inventory_items?: { name: string } | null;
};

export async function getRecentSales(userId: string) {
  try {
    // Get orgs the user belongs to
    const { data: memberships, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId);

    if (memErr) {
      console.error('Supabase error:', memErr);
      return { error: 'Failed to load sales.' };
    }

    const orgIds = (memberships ?? []).map((m) => m.org_id);
    if (orgIds.length === 0) return { data: [] };

    const { data, error } = await supabase
      .from('sales')
      .select('id, inventory_item_id, buyer_email, amount, currency, status, created_at, inventory_items(name)')
      .in('seller_org_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load sales.' };
    }

    return { data: (data ?? []) as unknown as Sale[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getSalesRevenue(userId: string) {
  try {
    const { data: memberships, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId);

    if (memErr) {
      console.error('Supabase error:', memErr);
      return { error: 'Failed to load sales revenue.' };
    }

    const orgIds = (memberships ?? []).map((m) => m.org_id);
    if (orgIds.length === 0) return { data: { total: 0, count: 0 } };

    const { data, error } = await supabase
      .from('sales')
      .select('amount')
      .in('seller_org_id', orgIds)
      .eq('status', 'completed');

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load sales revenue.' };
    }

    const items = data ?? [];
    const total = items.reduce((sum, s) => sum + Number(s.amount), 0);

    return { data: { total, count: items.length } };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
