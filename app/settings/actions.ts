'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requirePermission, auditLog } from '@/lib/rbac';
import type { AppSettings } from '@/lib/settings';

// ── Types ────────────────────────────────────────────────────

export type OrgSettingsRow = {
  id: string;
  org_id: string;
  settings: Partial<AppSettings>;
  enforced_keys: string[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UserOrgSettingsRow = {
  id: string;
  user_id: string;
  org_id: string;
  settings: Partial<AppSettings>;
  created_at: string;
  updated_at: string;
};

// ── Org Settings ─────────────────────────────────────────────

export async function getOrgSettings(orgId: string) {
  try {
    const { data, error } = await supabase
      .from('org_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load organization settings.' };
    }

    return { data: data as OrgSettingsRow | null };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateOrgSettings(
  orgId: string,
  userId: string,
  settings: Partial<AppSettings>,
  enforcedKeys: string[]
) {
  // Permission check — requires settings:manage
  const check = await requirePermission(orgId, userId, 'settings:manage');
  if (!check.granted) return { error: check.error };

  try {
    const { data, error } = await supabase
      .from('org_settings')
      .upsert(
        {
          org_id: orgId,
          settings,
          enforced_keys: enforcedKeys,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to save organization settings.' };
    }

    await auditLog({ orgId, actorId: userId, action: 'settings.updated', targetType: 'org_settings', targetId: orgId });
    return { success: true, data: data as OrgSettingsRow };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── User Org Settings ────────────────────────────────────────

export async function getUserOrgSettings(userId: string, orgId: string) {
  try {
    const { data, error } = await supabase
      .from('user_org_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load your settings.' };
    }

    return { data: data as UserOrgSettingsRow | null };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateUserOrgSettings(
  userId: string,
  orgId: string,
  settings: Partial<AppSettings>
) {
  try {
    const { data, error } = await supabase
      .from('user_org_settings')
      .upsert(
        {
          user_id: userId,
          org_id: orgId,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,org_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to save your settings.' };
    }

    return { success: true, data: data as UserOrgSettingsRow };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
