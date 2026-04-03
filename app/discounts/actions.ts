'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { stripe } from '@/lib/stripe';
import { isStaffUser, getProfileRole as _getProfileRole } from '@/lib/rbac';
import { auditLog } from '@/lib/rbac';
import crypto from 'crypto';

// Re-export as a proper server action so client components can call it
export async function getProfileRole(userId: string) {
  return _getProfileRole(userId);
}

// ── Types ────────────────────────────────────────────────────

export type DiscountCode = {
  id: string;
  code: string;
  target_user_id: string;
  issuer_user_id: string;
  percent_off: number;
  duration_months: number;
  status: 'active' | 'expired' | 'revoked' | 'redeemed';
  max_redemptions: number;
  times_redeemed: number;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscountCodeWithContext = DiscountCode & {
  target_email: string;
  issuer_email: string;
};

export type DiscountRedemption = {
  id: string;
  discount_code_id: string;
  org_id: string;
  redeemed_by_user_id: string;
  applied_via: 'self_serve' | 'support';
  stripe_coupon_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────

function generateCode(): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DISC-${random}`;
}

// ── Staff actions ────────────────────────────────────────────

export async function createDiscountCode(
  userId: string,
  params: {
    targetUserEmail: string;
    percentOff: number;
    durationMonths: number;
    note?: string;
    expiresAt?: string;
  }
): Promise<{ success?: boolean; data?: DiscountCode; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  // Server-side hard caps
  if (params.percentOff < 1 || params.percentOff > 50) {
    return { error: 'Discount must be between 1% and 50%.' };
  }
  if (params.durationMonths < 1 || params.durationMonths > 3) {
    return { error: 'Duration must be between 1 and 3 months.' };
  }
  if (!Number.isInteger(params.percentOff) || !Number.isInteger(params.durationMonths)) {
    return { error: 'Discount and duration must be whole numbers.' };
  }

  const email = params.targetUserEmail.trim().toLowerCase();
  if (!email) return { error: 'Target user email is required.' };

  try {
    // Resolve target user by email
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!targetProfile) {
      // Fallback: check auth.users via admin API
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const authUser = users?.find(
        (u) => u.email?.toLowerCase() === email
      );
      if (!authUser) return { error: 'No user found with that email.' };

      return await insertCode(userId, authUser.id, params);
    }

    return await insertCode(userId, targetProfile.id, params);
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function insertCode(
  issuerId: string,
  targetUserId: string,
  params: {
    percentOff: number;
    durationMonths: number;
    note?: string;
    expiresAt?: string;
  }
): Promise<{ success?: boolean; data?: DiscountCode; error?: string }> {
  const code = generateCode();

  const { data, error } = await supabase
    .from('subscription_discount_codes')
    .insert({
      code,
      target_user_id: targetUserId,
      issuer_user_id: issuerId,
      percent_off: params.percentOff,
      duration_months: params.durationMonths,
      note: params.note?.trim() || null,
      expires_at: params.expiresAt || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    if (error.code === '23505') {
      return { error: 'Code collision. Please try again.' };
    }
    return { error: 'Failed to create discount code.' };
  }

  await auditLog({
    orgId: null,
    actorId: issuerId,
    action: 'billing.discount_created',
    targetType: 'discount_code',
    targetId: data.id,
    metadata: {
      code,
      target_user_id: targetUserId,
      percent_off: params.percentOff,
      duration_months: params.durationMonths,
    },
  });

  return { success: true, data: data as DiscountCode };
}

export async function listDiscountCodes(
  userId: string,
  filter?: 'all' | 'active' | 'revoked' | 'redeemed' | 'expired'
): Promise<{ data?: DiscountCodeWithContext[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    let query = supabase
      .from('subscription_discount_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter && filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data: codes, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load discount codes.' };
    }

    if (!codes || codes.length === 0) return { data: [] };

    // Batch resolve emails
    const userIds = [...new Set([
      ...codes.map((c) => c.target_user_id),
      ...codes.map((c) => c.issuer_user_id),
    ])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, (p.email ?? p.full_name ?? 'Unknown') as string])
    );

    const enriched: DiscountCodeWithContext[] = (codes as DiscountCode[]).map((c) => ({
      ...c,
      target_email: profileMap.get(c.target_user_id) ?? 'Unknown',
      issuer_email: profileMap.get(c.issuer_user_id) ?? 'Unknown',
    }));

    return { data: enriched };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function revokeDiscountCode(
  userId: string,
  codeId: string
): Promise<{ success?: boolean; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('subscription_discount_codes')
      .select('id, status, code')
      .eq('id', codeId)
      .single();

    if (fetchError || !existing) return { error: 'Code not found.' };
    if (existing.status !== 'active') return { error: 'Only active codes can be revoked.' };

    const { error } = await supabase
      .from('subscription_discount_codes')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', codeId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to revoke discount code.' };
    }

    await auditLog({
      orgId: null,
      actorId: userId,
      action: 'billing.discount_revoked',
      targetType: 'discount_code',
      targetId: codeId,
      metadata: { code: existing.code },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Staff direct-apply: apply a discount code to an org's active subscription. */
export async function applyDiscountToSubscription(
  userId: string,
  codeId: string,
  orgId: string
): Promise<{ success?: boolean; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    // Fetch the code
    const { data: code, error: codeError } = await supabase
      .from('subscription_discount_codes')
      .select('*')
      .eq('id', codeId)
      .single();

    if (codeError || !code) return { error: 'Discount code not found.' };
    if (code.status !== 'active') return { error: 'Code is no longer active.' };
    if (code.times_redeemed >= code.max_redemptions) return { error: 'Code has reached max redemptions.' };
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { error: 'Code has expired.' };
    }

    // Fetch org subscription
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('org_id', orgId)
      .single();

    if (subError || !sub?.stripe_subscription_id) {
      return { error: 'Organization has no active subscription.' };
    }
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      return { error: 'Subscription must be active or trialing to apply a discount.' };
    }

    // Check for duplicate redemption
    const { data: existingRedemption } = await supabase
      .from('subscription_discount_redemptions')
      .select('id')
      .eq('discount_code_id', codeId)
      .eq('org_id', orgId)
      .single();

    if (existingRedemption) {
      return { error: 'This code has already been applied to this organization.' };
    }

    // Create Stripe coupon + apply to subscription
    const coupon = await stripe.coupons.create({
      percent_off: code.percent_off,
      duration: 'repeating',
      duration_in_months: code.duration_months,
      name: `Support: ${code.code}`,
      metadata: {
        discount_code_id: code.id,
        target_user_id: code.target_user_id,
        issuer_user_id: code.issuer_user_id,
      },
    });

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      discounts: [{ coupon: coupon.id }],
    });

    // Record redemption
    await supabase.from('subscription_discount_redemptions').insert({
      discount_code_id: code.id,
      org_id: orgId,
      redeemed_by_user_id: userId,
      applied_via: 'support',
      stripe_coupon_id: coupon.id,
      stripe_subscription_id: sub.stripe_subscription_id,
    });

    // Update code status
    const newTimesRedeemed = code.times_redeemed + 1;
    await supabase
      .from('subscription_discount_codes')
      .update({
        times_redeemed: newTimesRedeemed,
        status: newTimesRedeemed >= code.max_redemptions ? 'redeemed' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', codeId);

    await auditLog({
      orgId,
      actorId: userId,
      action: 'billing.discount_applied',
      targetType: 'subscription',
      targetId: sub.stripe_subscription_id,
      metadata: {
        discount_code_id: code.id,
        code: code.code,
        percent_off: code.percent_off,
        duration_months: code.duration_months,
        stripe_coupon_id: coupon.id,
      },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Self-serve redemption (called from upgrade flow) ─────────

/** Validate and prepare a discount code for self-serve checkout. */
export async function validateDiscountCode(
  userId: string,
  code: string
): Promise<{
  valid?: boolean;
  discountCodeId?: string;
  percentOff?: number;
  durationMonths?: number;
  error?: string;
}> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: 'Please enter a discount code.' };

  try {
    const { data, error } = await supabase
      .from('subscription_discount_codes')
      .select('*')
      .eq('code', trimmed)
      .single();

    if (error || !data) return { error: 'Invalid discount code.' };
    if (data.status !== 'active') return { error: 'This code is no longer valid.' };
    if (data.target_user_id !== userId) return { error: 'This code is not valid for your account.' };
    if (data.times_redeemed >= data.max_redemptions) return { error: 'This code has already been used.' };
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { error: 'This code has expired.' };
    }

    return {
      valid: true,
      discountCodeId: data.id,
      percentOff: data.percent_off,
      durationMonths: data.duration_months,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Get org list for a specific user (for staff apply-to flow). */
export async function getSubscribedOrgs(
  userId: string
): Promise<{ data?: { org_id: string; org_name: string; tier: string; status: string }[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('org_id, tier, status')
      .in('status', ['active', 'trialing']);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load subscriptions.' };
    }

    if (!data || data.length === 0) return { data: [] };

    const orgIds = data.map((s) => s.org_id);
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));

    return {
      data: data.map((s) => ({
        org_id: s.org_id,
        org_name: orgMap.get(s.org_id) ?? 'Unknown',
        tier: s.tier,
        status: s.status,
      })),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Get redemption history for a code. */
export async function getCodeRedemptions(
  userId: string,
  codeId: string
): Promise<{ data?: (DiscountRedemption & { org_name: string })[]; error?: string }> {
  const staff = await isStaffUser(userId);
  if (!staff) return { error: 'Access denied.' };

  try {
    const { data, error } = await supabase
      .from('subscription_discount_redemptions')
      .select('*')
      .eq('discount_code_id', codeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load redemptions.' };
    }

    if (!data || data.length === 0) return { data: [] };

    const orgIds = [...new Set(data.map((r) => r.org_id))];
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name as string]));

    return {
      data: (data as DiscountRedemption[]).map((r) => ({
        ...r,
        org_name: orgMap.get(r.org_id) ?? 'Unknown',
      })),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
