'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { logProjectTransparencyEvent } from '@/lib/project-transparency';
import { getMemberLimit } from '@/lib/tiers';
import { requirePermission, auditLog, getUserPermissions as _getUserPermissions } from '@/lib/rbac';
import type { Permission } from '@/lib/rbac-types';
import { checkInviteAbuse, recordChurnSignal } from '@/lib/abuse-detection';

// Re-export as server action so client components can call it
export async function getPermissionsForOrg(orgId: string, userId: string): Promise<Permission[]> {
  return _getUserPermissions(orgId, userId);
}

// ── Types ────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  stripe_price_id?: string;
  subscription_status?: SubscriptionStatus;
  cancel_at_period_end?: boolean;
  current_period_end?: string;
};

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: 'superadmin' | 'admin' | 'member';
  status: 'active' | 'suspended';
  created_at: string;
};

export type MemberWithProfile = OrgMember & {
  email: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
};

export type Project = {
  id: string;
  org_id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OrgInvitation = {
  id: string;
  org_id: string;
  email: string;
  invited_by_id: string;
  invited_user_id: string | null;
  requested_role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'declined' | 'canceled';
  accepted_at: string | null;
  responded_at: string | null;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────

/** Validate an image File from FormData. Returns an error string or null. */
function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Cover image must be an image file.';
  if (file.size > 10 * 1024 * 1024) return 'Cover image must be under 10 MB.';
  return null;
}

/**
 * Upload a cover image to Supabase Storage, normalize to WebP, and return
 * a cache-busted public URL. Returns `{ url }` on success or `{ warning }` on failure.
 */
async function uploadCoverImage(
  bucket: string,
  entityId: string,
  imageFile: File,
): Promise<{ url: string } | { warning: string }> {
  try {
    const { normalizeSourceImage } = await import('@/lib/image-processing');
    const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
    const normalizedBuffer = await normalizeSourceImage(rawBuffer);
    const storagePath = `${entityId}/cover.webp`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, normalizedBuffer, { contentType: 'image/webp', upsert: true });

    if (uploadError) {
      console.error(`Cover image upload error (${bucket}):`, uploadError);
      return { warning: 'Image upload failed. Please try again.' };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    // Append cache-bust param so CDN / browser serves the new file
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;
    return { url: bustedUrl };
  } catch (err) {
    console.error(`Cover image processing error (${bucket}):`, err);
    return { warning: 'Image processing failed. Please try again.' };
  }
}

/**
 * Remove a cover image from Supabase Storage for the given entity.
 */
async function removeCoverImage(bucket: string, entityId: string): Promise<void> {
  const storagePath = `${entityId}/cover.webp`;
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) console.error(`Cover image removal error (${bucket}):`, error);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Default org bootstrap ────────────────────────────────────

/**
 * Ensure the user has at least one organization.
 * If they have none, create "{First Name}'s Org" (or "{emailPrefix}'s Org").
 * Returns the org id of an existing or newly-created org.
 */
export async function ensureDefaultOrg(
  userId: string,
  metadata?: { fullName?: string; email?: string },
): Promise<{ orgId: string } | { error: string }> {
  try {
    // Check if user already belongs to any org
    const { data: existing, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1);

    if (memErr) {
      console.error('ensureDefaultOrg membership check error:', memErr);
      return { error: 'Failed to check organizations.' };
    }

    if (existing && existing.length > 0) {
      return { orgId: existing[0].org_id };
    }

    // Derive org name from first name or email prefix
    const fullName = (metadata?.fullName ?? '').trim();
    const firstName = fullName.split(' ')[0]?.trim();
    const emailPrefix = (metadata?.email ?? '').split('@')[0]?.trim();
    const baseName = firstName || emailPrefix || 'My';
    const orgName = `${baseName}'s Org`;
    const slug = slugify(orgName) || `org-${Date.now()}`;

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug, created_by: userId })
      .select('id')
      .single();

    if (orgErr) {
      // Handle slug collision by appending timestamp
      if (orgErr.code === '23505') {
        const retrySlug = `${slugify(orgName)}-${Date.now()}`;
        const { data: retryOrg, error: retryErr } = await supabase
          .from('organizations')
          .insert({ name: orgName, slug: retrySlug, created_by: userId })
          .select('id')
          .single();

        if (retryErr || !retryOrg) {
          console.error('ensureDefaultOrg retry error:', retryErr);
          return { error: 'Failed to create default organization.' };
        }

        const { error: retryMemErr } = await supabase
          .from('org_members')
          .insert({ org_id: retryOrg.id, user_id: userId, role: 'superadmin' });

        if (retryMemErr) {
          await supabase.from('organizations').delete().eq('id', retryOrg.id);
          return { error: 'Failed to set up organization membership.' };
        }

        return { orgId: retryOrg.id };
      }

      console.error('ensureDefaultOrg create error:', orgErr);
      return { error: 'Failed to create default organization.' };
    }

    // Add the creator as superadmin
    const { error: memberErr } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, user_id: userId, role: 'superadmin' });

    if (memberErr) {
      await supabase.from('organizations').delete().eq('id', org.id);
      console.error('ensureDefaultOrg membership error:', memberErr);
      return { error: 'Failed to set up organization membership.' };
    }

    return { orgId: org.id };
  } catch (err) {
    console.error('ensureDefaultOrg unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Organizations ────────────────────────────────────────────

export async function getOrganizations(userId: string) {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select('org_id, role, organizations(*, subscriptions(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load organizations.' };
    }

    const orgs = (data ?? []).map((row) => {
      const org = row.organizations as unknown as Record<string, unknown>;
      const subsData = org.subscriptions;
      const sub = ((Array.isArray(subsData) ? subsData[0] : subsData) ?? {}) as Record<string, unknown>;
      return {
        ...org,
        subscription_tier: (sub.tier as string) ?? 'free',
        subscription_status: (sub.status as string) ?? 'none',
        stripe_subscription_id: (sub.stripe_subscription_id as string) ?? undefined,
        stripe_customer_id: (sub.stripe_customer_id as string) ?? undefined,
        stripe_price_id: (sub.stripe_price_id as string) ?? undefined,
        cancel_at_period_end: (sub.cancel_at_period_end as boolean) ?? false,
        current_period_end: (sub.current_period_end as string) ?? undefined,
        myRole: row.role as OrgMember['role'],
      } as Organization & { myRole: OrgMember['role'] };
    });

    // Fetch member counts per org in a single query
    const orgIds = orgs.map((o) => o.id);
    const countMap = new Map<string, number>();
    if (orgIds.length > 0) {
      const { data: members } = await supabase
        .from('org_members')
        .select('org_id')
        .in('org_id', orgIds)
        .eq('status', 'active');
      (members ?? []).forEach((m) => {
        countMap.set(m.org_id, (countMap.get(m.org_id) ?? 0) + 1);
      });
    }

    const enriched = orgs.map((o) => ({
      ...o,
      memberCount: countMap.get(o.id) ?? 0,
    }));

    return { data: enriched };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getOrganization(id: string) {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*, subscriptions(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Organization not found.' };
    }

    const raw = data as Record<string, unknown>;
    const subsData = raw.subscriptions;
    const sub = ((Array.isArray(subsData) ? subsData[0] : subsData) ?? {}) as Record<string, unknown>;
    const org: Organization = {
      ...(raw as unknown as Organization),
      subscription_tier: (sub.tier as Organization['subscription_tier']) ?? 'free',
      subscription_status: (sub.status as SubscriptionStatus) ?? 'none',
      stripe_subscription_id: (sub.stripe_subscription_id as string) ?? undefined,
      stripe_customer_id: (sub.stripe_customer_id as string) ?? undefined,
      stripe_price_id: (sub.stripe_price_id as string) ?? undefined,
      cancel_at_period_end: (sub.cancel_at_period_end as boolean) ?? false,
      current_period_end: (sub.current_period_end as string) ?? undefined,
    };

    return { data: org };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createOrganization(formData: FormData) {
  const name = formData.get('name') as string;
  const userId = formData.get('user_id') as string;
  const imageFile = formData.get('image') as File | null;

  if (!name || !name.trim()) return { error: 'Organization name is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  if (imageFile && imageFile.size > 0) {
    const imgErr = validateImageFile(imageFile);
    if (imgErr) return { error: imgErr };
  }

  const slug = slugify(name) || `org-${Date.now()}`;

  try {
    const phone = (formData.get('phone') as string)?.trim() || null;
    const addressLine1 = (formData.get('address_line1') as string)?.trim() || null;
    const addressLine2 = (formData.get('address_line2') as string)?.trim() || null;
    const city = (formData.get('city') as string)?.trim() || null;
    const state = (formData.get('state') as string)?.trim() || null;
    const zipCode = (formData.get('zip_code') as string)?.trim() || null;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        slug,
        created_by: userId,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        zip_code: zipCode,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Supabase error:', orgError);
      if (orgError.code === '23505') {
        return { error: 'An organization with this name already exists.' };
      }
      return { error: 'Failed to create organization.' };
    }

    // Add the creator as superadmin
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, user_id: userId, role: 'superadmin' });

    if (memberError) {
      console.error('Supabase member error:', memberError);
      await supabase.from('organizations').delete().eq('id', org.id);
      return { error: 'Failed to set up organization membership.' };
    }

    // Upload cover image if provided
    let imageWarning: string | undefined;
    if (imageFile && imageFile.size > 0) {
      const result = await uploadCoverImage('organization-images', org.id, imageFile);
      if ('url' in result) {
        await supabase.from('organizations').update({ cover_image_url: result.url }).eq('id', org.id);
        org.cover_image_url = result.url;
      } else {
        imageWarning = `Organization created but ${result.warning.charAt(0).toLowerCase()}${result.warning.slice(1)}`;
      }
    }

    return { success: true, data: org as Organization, warning: imageWarning };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateOrganization(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const imageFile = formData.get('image') as File | null;
  const removeImage = formData.get('remove_image') === 'true';

  if (!name || !name.trim()) return { error: 'Organization name is required.' };

  if (imageFile && imageFile.size > 0) {
    const imgErr = validateImageFile(imageFile);
    if (imgErr) return { error: imgErr };
  }

  const phone = (formData.get('phone') as string)?.trim() || null;
  const addressLine1 = (formData.get('address_line1') as string)?.trim() || null;
  const addressLine2 = (formData.get('address_line2') as string)?.trim() || null;
  const city = (formData.get('city') as string)?.trim() || null;
  const state = (formData.get('state') as string)?.trim() || null;
  const zipCode = (formData.get('zip_code') as string)?.trim() || null;

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        zip_code: zipCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update organization.' };
    }

    let imageWarning: string | undefined;

    if (removeImage) {
      // Explicit removal: delete storage object and clear DB field
      await removeCoverImage('organization-images', id);
      await supabase.from('organizations').update({ cover_image_url: null }).eq('id', id);
    } else if (imageFile && imageFile.size > 0) {
      // Replace cover image
      const result = await uploadCoverImage('organization-images', id, imageFile);
      if ('url' in result) {
        await supabase.from('organizations').update({ cover_image_url: result.url }).eq('id', id);
      } else {
        imageWarning = `Settings saved but ${result.warning.charAt(0).toLowerCase()}${result.warning.slice(1)}`;
      }
    }

    return { success: true, warning: imageWarning };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function deleteOrganization(id: string, userId: string) {
  const check = await requirePermission(id, userId, 'org:delete');
  if (!check.granted) return { error: check.error };

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to delete organization.' };
    }

    await auditLog({ orgId: id, actorId: userId, action: 'org.deleted', targetType: 'organization', targetId: id });
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Org Members ──────────────────────────────────────────────

export async function getOrgMembers(orgId: string): Promise<{ data?: MemberWithProfile[], error?: string }> {
  try {
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Supabase error:', membersError);
      return { error: 'Failed to load members.' };
    }

    if (!members || members.length === 0) {
      return { data: [] };
    }

    const userIds = members.map((m) => m.user_id);

    // Fetch profiles and auth emails in parallel
    const [profilesResult, emailResults] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds),
      Promise.all(
        userIds.map((uid) =>
          supabase.auth.admin.getUserById(uid).then(
            (r) => ({ id: uid, email: r.data.user?.email ?? null }),
            () => ({ id: uid, email: null })
          )
        )
      ),
    ]);

    if (profilesResult.error) {
      console.error('Supabase profile error:', profilesResult.error);
    }

    const profilesMap = new Map(profilesResult.data?.map((p) => [p.id, p]));
    const emailMap = new Map(emailResults.map((e) => [e.id, e.email]));

    const data: MemberWithProfile[] = members.map((m) => ({
      ...m,
      email: emailMap.get(m.user_id) ?? null,
      profiles: profilesMap.get(m.user_id) || null,
    }));

    return { data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getMyOrgRole(orgId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (error) return { role: null };
    return { role: data.role as OrgMember['role'] };
  } catch {
    return { role: null };
  }
}

export async function inviteOrgMember(orgId: string, email: string, role: OrgMember['role'] = 'member', invitedByUserId: string) {
  try {
    // Permission check — requires members:invite
    const check = await requirePermission(orgId, invitedByUserId, 'members:invite');
    if (!check.granted) return { error: check.error };

    // Get subscription tier for member limit check
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('org_id', orgId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Supabase error:', subError);
      return { error: 'Organization not found.' };
    }

    const tier = (sub?.tier as 'free' | 'pro' | 'enterprise') || 'free';
    const memberLimit = getMemberLimit(tier);

    // Count current members
    const { count, error: countError } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (countError) {
      console.error('Supabase error:', countError);
      return { error: 'Failed to check member count.' };
    }

    // Check if adding a new member would exceed the limit
    if (count !== null && count >= memberLimit) {
      return { error: `Cannot add more members. ${tier === 'free' ? 'Free tier allows only 1 member. Upgrade to Pro to add more members.' : `${tier} tier allows up to ${memberLimit} members.`}` };
    }

    // Anti-sharing abuse check
    const abuseCheck = await checkInviteAbuse({
      orgId,
      actorUserId: invitedByUserId,
      recipientEmail: email.trim().toLowerCase(),
      tier,
    });

    if (!abuseCheck.allowed) {
      return {
        error: abuseCheck.message ?? 'Invitations are temporarily restricted for this organization.',
      };
    }

    // Find user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Auth error:', userError);
      return { error: 'Failed to find user.' };
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
      return { error: 'User with this email not found.' };
    }

    // Add the member to the organization
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({ org_id: orgId, user_id: targetUser.id, role });

    if (memberError) {
      console.error('Supabase member error:', memberError);
      if (memberError.code === '23505') {
        return { error: 'User is already a member of this organization.' };
      }
      return { error: 'Failed to add member.' };
    }

    await auditLog({ orgId, actorId: invitedByUserId, action: 'member.invited', targetType: 'org_member', targetId: targetUser.id, metadata: { email, role } });
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function sendOrgInvitation(
  orgId: string,
  email: string,
  requestedRole: 'admin' | 'member',
  invitedByUserId: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) return { error: 'Email is required.' };

  try {
    // Permission check — requires members:invite
    const check = await requirePermission(orgId, invitedByUserId, 'members:invite');
    if (!check.granted) return { error: check.error };

    // Get subscription tier for member limit check
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('org_id', orgId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Supabase error:', subError);
      return { error: 'Organization not found.' };
    }

    const tier = (sub?.tier as 'free' | 'pro' | 'enterprise') || 'free';
    const memberLimit = getMemberLimit(tier);

    // Count current members
    const { count: memberCount, error: memberCountError } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (memberCountError) {
      console.error('Supabase error:', memberCountError);
      return { error: 'Failed to check member count.' };
    }

    // Count pending invitations
    const { count: pendingCount, error: pendingCountError } = await supabase
      .from('organization_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (pendingCountError) {
      console.error('Supabase error:', pendingCountError);
      return { error: 'Failed to check pending invitations.' };
    }

    if ((memberCount ?? 0) + (pendingCount ?? 0) >= memberLimit) {
      return {
        error:
          tier === 'free'
            ? 'Cannot invite more members. Free tier allows only 1 member. Upgrade to Pro to add more members.'
            : `Cannot invite more members. ${tier} tier allows up to ${memberLimit} members.`,
      };
    }

    // Anti-sharing abuse check (runs after seat-cap, before insert)
    const abuseCheck = await checkInviteAbuse({
      orgId,
      actorUserId: invitedByUserId,
      recipientEmail: normalizedEmail,
      tier,
    });

    if (!abuseCheck.allowed) {
      return {
        error: abuseCheck.message ?? 'Invitations are temporarily restricted for this organization.',
        retryAfter: abuseCheck.retryAfter,
      };
    }

    // Prevent duplicate pending invitations
    const { data: existingInvite, error: existingInviteError } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInviteError) {
      console.error('Supabase error:', existingInviteError);
      return { error: 'Failed to validate invitation state.' };
    }

    if (existingInvite) {
      return { error: 'An invitation has already been sent to this email.' };
    }

    // If this email already has an account, ensure they are not already a member
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Auth error:', userError);
      return { error: 'Failed to validate user account.' };
    }

    const targetUser = users.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail);
    if (targetUser) {
      const { data: existingMember, error: memberLookupError } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', targetUser.id)
        .maybeSingle();

      if (memberLookupError) {
        console.error('Supabase error:', memberLookupError);
        return { error: 'Failed to validate existing membership.' };
      }

      if (existingMember) {
        return { error: 'User is already a member of this organization.' };
      }
    }

    const { data: invitation, error: insertError } = await supabase
      .from('organization_invitations')
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        invited_by_id: invitedByUserId,
        invited_user_id: targetUser?.id ?? null,
        requested_role: requestedRole,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Supabase error:', insertError);
      if (insertError.code === '23505') {
        return { error: 'An invitation has already been sent to this email.' };
      }
      return { error: 'Failed to create invitation.' };
    }

    // For existing users, skip the invite email — they already have an account
    // and will see the pending invitation when they log in.
    if (!targetUser) {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const { error: inviteEmailError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: `${origin}/auth/callback`,
        data: {
          org_id: orgId,
          requested_role: requestedRole,
        },
      });

      if (inviteEmailError) {
        console.error('Auth invite error:', inviteEmailError);

        const code = (inviteEmailError as { code?: string }).code;
        const status = (inviteEmailError as { status?: number }).status;

        if (code === 'email_exists') {
          // Race condition: user registered between our check and invite call.
          // Keep the invitation — they'll see it on login.
        } else {
          await supabase.from('organization_invitations').delete().eq('id', invitation.id);

          if (code === 'over_email_send_rate_limit' || status === 429) {
            return { error: 'Too many invitations sent recently. Please wait a moment and try again.' };
          }
          if (code === 'validation_failed') {
            return { error: 'The email address could not be validated. Please check and try again.' };
          }
          return { error: 'Failed to send invitation email. Please try again later.' };
        }
      }
    }

    await auditLog({
      orgId,
      actorId: invitedByUserId,
      action: 'member.invited',
      targetType: 'organization_invitation',
      targetId: invitation.id,
      metadata: {
        email: normalizedEmail,
        requestedRole,
      },
    });

    // Create a notification for existing users so it shows in their sidebar
    if (targetUser) {
      const { createInviteNotification } = await import('@/app/notifications/actions');
      // Fetch org name for a readable notification title
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      // Look up inviter's email for context
      const inviterUser = users.find((u) => u.id === invitedByUserId);

      await createInviteNotification({
        recipientUserId: targetUser.id,
        orgId,
        orgName: orgData?.name ?? 'Unknown organization',
        invitationId: invitation.id,
        requestedRole,
        invitedByEmail: inviterUser?.email ?? undefined,
      });
    }

    return {
      success: true,
      data: invitation as OrgInvitation,
      warning: abuseCheck.level === 'warning'
        ? (abuseCheck.message ?? 'Unusual invitation activity detected.')
        : targetUser
          ? 'This user already has an account. They\'ll see the invitation when they log in.'
          : undefined,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getPendingInvitations(orgId: string) {
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load pending invitations.' };
    }

    return { data: (data ?? []) as OrgInvitation[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function cancelInvitation(orgId: string, invitationId: string, userId: string) {
  if (!invitationId) return { error: 'Invitation ID is required.' };

  try {
    const check = await requirePermission(orgId, userId, 'members:invite');
    if (!check.granted) return { error: check.error };

    // Fetch the invitation email before canceling (needed for churn signal)
    const { data: inviteRow } = await supabase
      .from('organization_invitations')
      .select('email')
      .eq('id', invitationId)
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .maybeSingle();

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'canceled', responded_at: now })
      .eq('id', invitationId)
      .eq('org_id', orgId)
      .eq('status', 'pending');

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to cancel invitation.' };
    }

    // Resolve associated notification
    const { resolveNotificationsForSource } = await import('@/app/notifications/actions');
    await resolveNotificationsForSource('organization_invitations', invitationId);

    await auditLog({
      orgId,
      actorId: userId,
      action: 'member.removed',
      targetType: 'organization_invitation',
      targetId: invitationId,
      metadata: { reason: 'invitation_canceled' },
    });

    // Record churn signal for anti-sharing detection
    if (inviteRow?.email) {
      recordChurnSignal({ orgId, actorUserId: userId, recipientEmail: inviteRow.email }).catch(() => {});
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function upgradeSubscriptionTier(orgId: string, newTier: 'free' | 'pro' | 'enterprise', userId: string) {
  try {
    // Permission check — requires billing:manage
    const check = await requirePermission(orgId, userId, 'billing:manage');
    if (!check.granted) return { error: check.error };

    // Update the tier directly in subscriptions table
    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        { org_id: orgId, tier: newTier, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' }
      );

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to upgrade subscription.' };
    }

    await auditLog({ orgId, actorId: userId, action: 'billing.subscription_changed', targetType: 'organization', targetId: orgId, metadata: { newTier } });
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Member Role & Status ─────────────────────────────────────

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  newRole: OrgMember['role'],
  actorUserId: string
) {
  if (!orgId || !memberId || !actorUserId) return { error: 'Missing required parameters.' };

  const validRoles: OrgMember['role'][] = ['superadmin', 'admin', 'member'];
  if (!validRoles.includes(newRole)) return { error: 'Invalid role.' };

  try {
    const check = await requirePermission(orgId, actorUserId, 'members:update_role');
    if (!check.granted) return { error: check.error };

    // Fetch the target member
    const { data: target, error: targetError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single();

    if (targetError || !target) return { error: 'Member not found.' };

    if (target.role === newRole) return { success: true }; // no-op

    // Prevent removing the last active superadmin
    if (target.role === 'superadmin' && newRole !== 'superadmin') {
      const { count } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'superadmin')
        .eq('status', 'active');

      if ((count ?? 0) <= 1) {
        return { error: 'Cannot change role. At least one active Super Admin is required.' };
      }
    }

    const { error: updateError } = await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return { error: 'Failed to update member role.' };
    }

    await auditLog({
      orgId,
      actorId: actorUserId,
      action: 'member.role_changed',
      targetType: 'org_member',
      targetId: target.user_id,
      metadata: { previousRole: target.role, newRole },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateMemberStatus(
  orgId: string,
  memberId: string,
  newStatus: 'active' | 'suspended',
  actorUserId: string
) {
  if (!orgId || !memberId || !actorUserId) return { error: 'Missing required parameters.' };

  const validStatuses = ['active', 'suspended'] as const;
  if (!validStatuses.includes(newStatus)) return { error: 'Invalid status.' };

  try {
    const check = await requirePermission(orgId, actorUserId, 'members:update_role');
    if (!check.granted) return { error: check.error };

    // Fetch the target member
    const { data: target, error: targetError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single();

    if (targetError || !target) return { error: 'Member not found.' };

    if (target.status === newStatus) return { success: true }; // no-op

    // Prevent suspending the last active superadmin
    if (target.role === 'superadmin' && newStatus === 'suspended') {
      const { count } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'superadmin')
        .eq('status', 'active');

      if ((count ?? 0) <= 1) {
        return { error: 'Cannot suspend the last active Super Admin.' };
      }
    }

    // Prevent actors from suspending themselves
    if (target.user_id === actorUserId && newStatus === 'suspended') {
      return { error: 'You cannot suspend yourself.' };
    }

    const { error: updateError } = await supabase
      .from('org_members')
      .update({ status: newStatus })
      .eq('id', memberId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return { error: 'Failed to update member status.' };
    }

    await auditLog({
      orgId,
      actorId: actorUserId,
      action: 'member.status_changed',
      targetType: 'org_member',
      targetId: target.user_id,
      metadata: { previousStatus: target.status, newStatus },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Projects ─────────────────────────────────────────────────

export async function getProjects(orgId: string) {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load projects.' };
    }

    return { data: data as Project[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getProject(id: string) {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Project not found.' };
    }

    return { data: data as Project };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createProject(formData: FormData) {
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const orgId = formData.get('org_id') as string;
  const userId = formData.get('user_id') as string;
  const imageFile = formData.get('image') as File | null;

  if (!name || !name.trim()) return { error: 'Project name is required.' };
  if (!orgId) return { error: 'Organization is required.' };
  if (!userId) return { error: 'User not authenticated.' };

  if (imageFile && imageFile.size > 0) {
    const imgErr = validateImageFile(imageFile);
    if (imgErr) return { error: imgErr };
  }

  const check = await requirePermission(orgId, userId, 'projects:create');
  if (!check.granted) return { error: check.error };

  try {
    const phone = (formData.get('phone') as string)?.trim() || null;
    const addressLine1 = (formData.get('address_line1') as string)?.trim() || null;
    const addressLine2 = (formData.get('address_line2') as string)?.trim() || null;
    const city = (formData.get('city') as string)?.trim() || null;
    const state = (formData.get('state') as string)?.trim() || null;
    const zipCode = (formData.get('zip_code') as string)?.trim() || null;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description?.trim() || '',
        org_id: orgId,
        created_by: userId,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        zip_code: zipCode,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to create project.' };
    }

    // Upload cover image if provided
    let imageWarning: string | undefined;
    if (imageFile && imageFile.size > 0) {
      const result = await uploadCoverImage('project-images', data.id, imageFile);
      if ('url' in result) {
        await supabase.from('projects').update({ cover_image_url: result.url }).eq('id', data.id);
        data.cover_image_url = result.url;
      } else {
        imageWarning = `Project created but ${result.warning.charAt(0).toLowerCase()}${result.warning.slice(1)}`;
      }
    }

    await auditLog({ orgId, actorId: userId, action: 'project.created', targetType: 'project', targetId: data.id });
    return { success: true, data: data as Project, warning: imageWarning };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function toggleProjectPublished(projectId: string, userId: string, published: boolean) {
  try {
    // Look up org_id from the project to check permissions
    const { data: project, error: lookupErr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single();

    if (lookupErr || !project) return { error: 'Project not found.' };

    const check = await requirePermission(project.org_id, userId, 'projects:update');
    if (!check.granted) return { error: check.error };

    const { error } = await supabase
      .from('projects')
      .update({ published, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update publish status.' };
    }

    if (published) {
      await logProjectTransparencyEvent({
        orgId: project.org_id,
        projectId,
        actorId: userId,
        eventType: 'project_published',
        title: 'Project published',
        body: 'The sale project is now published and ready for broader visibility.',
        payload: {
          published,
        },
      });
    }

    return { success: true, published };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateProject(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const imageFile = formData.get('image') as File | null;
  const removeImage = formData.get('remove_image') === 'true';

  if (!name || !name.trim()) return { error: 'Project name is required.' };

  if (imageFile && imageFile.size > 0) {
    const imgErr = validateImageFile(imageFile);
    if (imgErr) return { error: imgErr };
  }

  const phone = (formData.get('phone') as string)?.trim() || null;
  const addressLine1 = (formData.get('address_line1') as string)?.trim() || null;
  const addressLine2 = (formData.get('address_line2') as string)?.trim() || null;
  const city = (formData.get('city') as string)?.trim() || null;
  const state = (formData.get('state') as string)?.trim() || null;
  const zipCode = (formData.get('zip_code') as string)?.trim() || null;

  try {
    const { error } = await supabase
      .from('projects')
      .update({
        name: name.trim(),
        description: description?.trim() || '',
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        zip_code: zipCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update project.' };
    }

    let imageWarning: string | undefined;

    if (removeImage) {
      await removeCoverImage('project-images', id);
      await supabase.from('projects').update({ cover_image_url: null }).eq('id', id);
    } else if (imageFile && imageFile.size > 0) {
      const result = await uploadCoverImage('project-images', id, imageFile);
      if ('url' in result) {
        await supabase.from('projects').update({ cover_image_url: result.url }).eq('id', id);
      } else {
        imageWarning = `Project saved but ${result.warning.charAt(0).toLowerCase()}${result.warning.slice(1)}`;
      }
    }

    return { success: true, warning: imageWarning };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function deleteProject(id: string, userId?: string, orgId?: string) {
  if (userId && orgId) {
    const check = await requirePermission(orgId, userId, 'projects:delete');
    if (!check.granted) return { error: check.error };
  }

  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to delete project.' };
    }

    if (userId && orgId) {
      await auditLog({ orgId, actorId: userId, action: 'project.deleted', targetType: 'project', targetId: id });
    }
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Stripe Connect (delegated to provider-actions.ts) ────────

import { stripe } from '@/lib/stripe';
import {
  connectProvider,
  syncProviderStatus,
  getOnboardingUrl,
  disconnectProvider,
} from '@/app/organizations/provider-actions';

/** @deprecated Use connectProvider(orgId, userId, 'stripe') from provider-actions.ts */
export async function createStripeConnectAccount(orgId: string, userId: string) {
  const result = await connectProvider(orgId, userId, 'stripe');
  if (result.error) return { error: result.error };
  return { success: true };
}

/** @deprecated Use getOnboardingUrl(orgId, userId, 'stripe') from provider-actions.ts */
export async function getStripeOnboardingLink(orgId: string, userId: string) {
  return getOnboardingUrl(orgId, userId, 'stripe');
}

/** @deprecated Use syncProviderStatus(orgId, 'stripe') from provider-actions.ts */
export async function getStripeAccountStatus(orgId: string) {
  const result = await syncProviderStatus(orgId, 'stripe');
  if (result.error) return { error: result.error };
  const d = result.data!;
  return {
    data: {
      connected: d.connected,
      onboardingComplete: d.onboardingComplete,
      accountId: d.externalAccountId,
      requirements: d.requirements,
    },
  };
}

/** @deprecated Use getOnboardingUrl(orgId, userId, 'stripe') from provider-actions.ts */
export async function retryStripeOnboarding(orgId: string, userId: string) {
  return getOnboardingUrl(orgId, userId, 'stripe');
}

/** @deprecated Use disconnectProvider(orgId, userId, 'stripe') from provider-actions.ts */
export async function disconnectStripeAccount(orgId: string, userId: string) {
  return disconnectProvider(orgId, userId, 'stripe');
}

// ── Subscription Billing ──────────────────────────────────────

/**
 * Get or create a Stripe Customer for an organization.
 * Persists the customer ID via RPC so we never create duplicates.
 */
async function getOrCreateStripeCustomer(orgId: string, email: string): Promise<string> {
  // Check subscriptions table for existing customer ID
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .single();

  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  // Get org name for Stripe customer creation
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  const customer = await stripe.customers.create({
    email,
    metadata: { org_id: orgId },
    name: org?.name ?? undefined,
  });

  // Persist customer ID in subscriptions table
  await supabase
    .from('subscriptions')
    .upsert(
      { org_id: orgId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
      { onConflict: 'org_id' }
    );

  return customer.id;
}

export async function createSubscriptionCheckoutSession(
  orgId: string,
  tier: 'pro',
  userId: string,
  discountCodeId?: string
) {
  try {
    // Permission check — requires billing:manage
    const billingCheck = await requirePermission(orgId, userId, 'billing:manage');
    if (!billingCheck.granted) return { error: billingCheck.error };

    // Only Pro is self-serve; Enterprise is sales-led
    if (tier !== 'pro') {
      return { error: 'Please contact sales for Enterprise plans.' };
    }

    // Get subscription to check if already active
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('org_id', orgId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      return { error: 'Organization not found.' };
    }

    // Block if already subscribed
    if (sub?.stripe_subscription_id && sub?.status === 'active') {
      return { error: 'This organization already has an active subscription. Manage it from the billing portal.' };
    }

    // Get user email for Stripe customer
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      return { error: 'User email not found.' };
    }

    const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;

    if (!stripePriceId) {
      console.error('Missing STRIPE_PRO_PRICE_ID env var');
      return { error: 'Subscription pricing not configured. Please contact support.' };
    }

    // Get or create Stripe customer anchored to the organization
    const customerId = await getOrCreateStripeCustomer(orgId, user.email);

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // If a discount code was provided, validate and create Stripe coupon
    let stripeCouponId: string | undefined;
    if (discountCodeId) {
      const { data: discountCode, error: dcError } = await supabase
        .from('subscription_discount_codes')
        .select('*')
        .eq('id', discountCodeId)
        .single();

      if (dcError || !discountCode) {
        return { error: 'Invalid discount code.' };
      }
      if (discountCode.status !== 'active') {
        return { error: 'This discount code is no longer valid.' };
      }
      if (discountCode.target_user_id !== userId) {
        return { error: 'This discount code is not valid for your account.' };
      }
      if (discountCode.times_redeemed >= discountCode.max_redemptions) {
        return { error: 'This discount code has already been used.' };
      }
      if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
        return { error: 'This discount code has expired.' };
      }

      const coupon = await stripe.coupons.create({
        percent_off: discountCode.percent_off,
        duration: 'repeating',
        duration_in_months: discountCode.duration_months,
        name: `Support: ${discountCode.code}`,
        metadata: {
          discount_code_id: discountCode.id,
          target_user_id: discountCode.target_user_id,
          issuer_user_id: discountCode.issuer_user_id,
        },
      });
      stripeCouponId = coupon.id;
    }

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/dashboard?subscription=cancelled`,
      metadata: {
        org_id: orgId,
        user_id: userId,
        tier,
        ...(discountCodeId ? { discount_code_id: discountCodeId } : {}),
      },
    });

    if (!session.url) {
      return { error: 'Failed to create checkout session.' };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Billing Portal ────────────────────────────────────────────

export async function createBillingPortalSession(orgId: string, userId: string) {
  try {
    const billingCheck = await requirePermission(orgId, userId, 'billing:manage');
    if (!billingCheck.granted) return { error: billingCheck.error };

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .single();

    if (!sub?.stripe_customer_id) {
      return { error: 'No billing account found. Subscribe to a plan first.' };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/organizations/${orgId}/settings/billing`,
    });

    return { success: true, url: portalSession.url };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
