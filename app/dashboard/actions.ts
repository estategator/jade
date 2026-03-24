'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requireOrgMembership } from '@/lib/rbac';

export type DashboardStats = {
  totalItems: number;
  totalInventoryValue: number;
  totalSoldRevenue: number;
  availableItems: number;
  soldItems: number;
};

export type CategoryBreakdown = {
  category: string;
  count: number;
};

export type RevenuePeriod = '1D' | '1W' | '1M' | '6M' | 'YTD' | '1Y';

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
    if (!orgId) {
      return { data: { totalItems: 0, totalInventoryValue: 0, totalSoldRevenue: 0, availableItems: 0, soldItems: 0 } as DashboardStats };
    }

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const { data, error } = await supabase
      .from('inventory_items')
      .select('price, status')
      .eq('org_id', orgId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load stats.' };
    }

    const items = data ?? [];
    const totalItems = items.length;
    const totalInventoryValue = items.reduce((sum, i) => sum + Number(i.price), 0);
    const totalSoldRevenue = items
      .filter((i) => i.status === 'sold')
      .reduce((sum, i) => sum + Number(i.price), 0);
    const availableItems = items.filter((i) => i.status === 'available').length;
    const soldItems = items.filter((i) => i.status === 'sold').length;

    return {
      data: { totalItems, totalInventoryValue, totalSoldRevenue, availableItems, soldItems } as DashboardStats,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getCategoryBreakdown(userId: string, orgId?: string | null) {
  try {
    if (!orgId) return { data: [] as CategoryBreakdown[] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const { data, error } = await supabase
      .from('inventory_items')
      .select('category')
      .eq('org_id', orgId);

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

export async function getRevenueByRange(
  userId: string,
  orgId?: string | null,
  period: RevenuePeriod = '6M',
) {
  try {
    if (!orgId) return { data: [] as RevenueByMonth[] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '1D':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case '1W':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case '1M':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case '6M':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
    }

    const { data, error } = await supabase
      .from('sales')
      .select('amount, created_at')
      .eq('seller_org_id', orgId)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load revenue data.' };
    }

    // Build bucket keys depending on period granularity
    const buckets: Record<string, number> = {};

    if (period === '1D') {
      // Hourly buckets for the last 24 hours
      for (let h = 23; h >= 0; h--) {
        const d = new Date(now);
        d.setHours(now.getHours() - h, 0, 0, 0);
        const key = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        buckets[key] = 0;
      }
      for (const sale of data ?? []) {
        const d = new Date(sale.created_at);
        const key = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        if (key in buckets) buckets[key] += Number(sale.amount);
      }
    } else if (period === '1W') {
      // Daily buckets for the last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        buckets[key] = 0;
      }
      for (const sale of data ?? []) {
        const d = new Date(sale.created_at);
        const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (key in buckets) buckets[key] += Number(sale.amount);
      }
    } else {
      // Monthly buckets for 1M, 6M, YTD, 1Y
      const monthCount =
        period === '1M' ? 2
        : period === 'YTD' ? now.getMonth() + 1
        : period === '1Y' ? 12
        : 6; // 6M
      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        buckets[key] = 0;
      }
      for (const sale of data ?? []) {
        const d = new Date(sale.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (key in buckets) buckets[key] += Number(sale.amount);
      }
    }

    const result: RevenueByMonth[] = Object.entries(buckets).map(
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
    if (!orgId) return { data: [] as StatusBreakdown[] };

    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const { data, error } = await supabase
      .from('inventory_items')
      .select('status, price')
      .eq('org_id', orgId);

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

export async function getRecentSales(userId: string, orgId?: string | null) {
  try {
    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
    }

    // Get orgs the user belongs to
    const { data: memberships, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId);

    if (memErr) {
      console.error('Supabase error:', memErr);
      return { error: 'Failed to load sales.' };
    }

    let orgIds = (memberships ?? []).map((m) => m.org_id);
    if (orgId) orgIds = orgIds.filter((id) => id === orgId);
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

export async function getSalesRevenue(userId: string, orgId?: string | null) {
  try {
    if (orgId) {
      const membership = await requireOrgMembership(orgId, userId);
      if ('error' in membership) return { error: membership.error };
    }

    const { data: memberships, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId);

    if (memErr) {
      console.error('Supabase error:', memErr);
      return { error: 'Failed to load sales revenue.' };
    }

    let orgIds = (memberships ?? []).map((m) => m.org_id);
    if (orgId) orgIds = orgIds.filter((id) => id === orgId);
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
