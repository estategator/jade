'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { auditLog } from '@/lib/rbac';

// ── Types ────────────────────────────────────────────────────

export type NotificationKind = 'org_invite' | 'sale_completed';

export type UserNotification = {
  id: string;
  recipient_user_id: string;
  org_id: string | null;
  kind: NotificationKind;
  source_table: string;
  source_id: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Queries ──────────────────────────────────────────────────

export async function getNotifications(userId: string): Promise<{ data?: UserNotification[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('recipient_user_id', userId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load notifications.' };
    }

    return { data: (data ?? []) as UserNotification[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<{ count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .is('resolved_at', null)
      .is('read_at', null);

    if (error) {
      console.error('Supabase error:', error);
      return { count: 0, error: 'Failed to load notification count.' };
    }

    return { count: count ?? 0 };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { count: 0, error: 'An unexpected error occurred.' };
  }
}

// ── Mutations ────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to mark notification as read.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('recipient_user_id', userId)
      .is('read_at', null)
      .is('resolved_at', null);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to mark notifications as read.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Invite Actions ───────────────────────────────────────────

export async function acceptOrgInvite(notificationId: string, userId: string) {
  try {
    // Load the notification
    const { data: notification, error: notifError } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('recipient_user_id', userId)
      .is('resolved_at', null)
      .single();

    if (notifError || !notification) {
      return { error: 'Notification not found or already resolved.' };
    }

    if (notification.kind !== 'org_invite') {
      return { error: 'This notification is not an organization invite.' };
    }

    const invitationId = notification.source_id;

    // Load the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      // Invitation was canceled or already acted on — resolve the notification
      await supabase
        .from('user_notifications')
        .update({ resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', notificationId);
      return { error: 'This invitation is no longer available.' };
    }

    // Add member to organization
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: invitation.org_id,
        user_id: userId,
        role: invitation.requested_role,
      });

    if (memberError) {
      if (memberError.code === '23505') {
        // Already a member — resolve everything cleanly
        const now = new Date().toISOString();
        await Promise.all([
          supabase
            .from('organization_invitations')
            .update({ status: 'accepted', accepted_at: now, responded_at: now })
            .eq('id', invitationId),
          supabase
            .from('user_notifications')
            .update({ resolved_at: now, updated_at: now })
            .eq('id', notificationId),
        ]);
        return { error: 'You are already a member of this organization.' };
      }
      console.error('Supabase member error:', memberError);
      return { error: 'Failed to join organization.' };
    }

    // Mark invitation as accepted and resolve notification
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('organization_invitations')
        .update({ status: 'accepted', accepted_at: now, responded_at: now })
        .eq('id', invitationId),
      supabase
        .from('user_notifications')
        .update({ resolved_at: now, updated_at: now })
        .eq('id', notificationId),
    ]);

    await auditLog({
      orgId: invitation.org_id,
      actorId: userId,
      action: 'member.invited',
      targetType: 'org_member',
      targetId: userId,
      metadata: { action: 'accepted', invitationId, role: invitation.requested_role },
    });

    return { success: true, orgId: invitation.org_id };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function declineOrgInvite(notificationId: string, userId: string) {
  try {
    // Load the notification
    const { data: notification, error: notifError } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('recipient_user_id', userId)
      .is('resolved_at', null)
      .single();

    if (notifError || !notification) {
      return { error: 'Notification not found or already resolved.' };
    }

    if (notification.kind !== 'org_invite') {
      return { error: 'This notification is not an organization invite.' };
    }

    const invitationId = notification.source_id;

    // Update invitation status to declined
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('organization_invitations')
        .update({ status: 'declined', responded_at: now })
        .eq('id', invitationId)
        .eq('status', 'pending'),
      supabase
        .from('user_notifications')
        .update({ resolved_at: now, updated_at: now })
        .eq('id', notificationId),
    ]);

    await auditLog({
      orgId: notification.org_id,
      actorId: userId,
      action: 'member.removed',
      targetType: 'organization_invitation',
      targetId: invitationId,
      metadata: { action: 'declined' },
    });

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Notification Creation Helpers ────────────────────────────

/** Create a notification for an org invite (called from invite flow). */
export async function createInviteNotification(params: {
  recipientUserId: string;
  orgId: string;
  orgName: string;
  invitationId: string;
  requestedRole: string;
  invitedByEmail?: string;
}) {
  try {
    const { error } = await supabase.from('user_notifications').upsert(
      {
        recipient_user_id: params.recipientUserId,
        org_id: params.orgId,
        kind: 'org_invite' as NotificationKind,
        source_table: 'organization_invitations',
        source_id: params.invitationId,
        title: `Invitation to join ${params.orgName}`,
        body: `You've been invited to join as ${params.requestedRole}.`,
        payload: {
          org_name: params.orgName,
          requested_role: params.requestedRole,
          invited_by_email: params.invitedByEmail ?? null,
        },
      },
      { onConflict: 'recipient_user_id,source_table,source_id' }
    );

    if (error) {
      console.error('Failed to create invite notification:', error);
    }
  } catch (err) {
    console.error('Unexpected error creating notification:', err);
  }
}

/** Resolve notifications linked to a specific source row. */
export async function resolveNotificationsForSource(sourceTable: string, sourceId: string) {
  try {
    const now = new Date().toISOString();
    await supabase
      .from('user_notifications')
      .update({ resolved_at: now, updated_at: now })
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
      .is('resolved_at', null);
  } catch (err) {
    console.error('Failed to resolve notifications:', err);
  }
}

/** Notify every active member of an org that a sale completed. */
export async function createSaleNotifications(params: {
  orgId: string;
  saleId: string;
  itemName: string;
  amount: number;
  currency: string;
  buyerEmail: string | null;
}) {
  try {
    // Find all active members of the seller org
    const { data: members, error: memberError } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', params.orgId)
      .eq('status', 'active');

    if (memberError || !members || members.length === 0) {
      if (memberError) console.error('Failed to fetch org members for sale notification:', memberError);
      return;
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: params.currency,
    }).format(params.amount);

    const body = params.buyerEmail
      ? `${params.buyerEmail} purchased it for ${formatted}`
      : `Sold for ${formatted}`;

    const rows = members.map((m) => ({
      recipient_user_id: m.user_id,
      org_id: params.orgId,
      kind: 'sale_completed' as NotificationKind,
      source_table: 'sales',
      source_id: params.saleId,
      title: `Item Sold: ${params.itemName}`,
      body,
      payload: {
        item_name: params.itemName,
        amount: params.amount,
        currency: params.currency,
        buyer_email: params.buyerEmail,
      },
    }));

    const { error } = await supabase
      .from('user_notifications')
      .upsert(rows, {
        onConflict: 'recipient_user_id,source_table,source_id',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('Failed to create sale notifications:', error);
    }
  } catch (err) {
    console.error('Unexpected error creating sale notifications:', err);
  }
}

// ── Sync (email-only invites → notifications) ────────────────

/** Materialize notifications for pending invitations match by email. */
export async function syncPendingInvitesForUser(userId: string, email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Find pending invitations for this email that don't yet have invited_user_id set
    const { data: pendingInvites, error } = await supabase
      .from('organization_invitations')
      .select('id, org_id, requested_role, organizations(name)')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .is('invited_user_id', null);

    if (error || !pendingInvites || pendingInvites.length === 0) return;

    for (const invite of pendingInvites) {
      // Link the user to the invitation
      await supabase
        .from('organization_invitations')
        .update({ invited_user_id: userId })
        .eq('id', invite.id);

      // Create a notification
      const org = invite.organizations as unknown as { name: string } | null;
      await createInviteNotification({
        recipientUserId: userId,
        orgId: invite.org_id,
        orgName: org?.name ?? 'Unknown organization',
        invitationId: invite.id,
        requestedRole: invite.requested_role,
      });
    }
  } catch (err) {
    console.error('Failed to sync pending invites:', err);
  }
}
