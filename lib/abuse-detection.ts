import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditLog } from '@/lib/rbac';
import {
  ANTI_SHARING_ENABLED,
  ANTI_SHARING_DRY_RUN,
  RULE_WEIGHTS,
  MAX_INVITES_PER_INVITER_PER_HOUR,
  MAX_INVITES_PER_ORG_PER_DAY,
  MAX_INVITES_PER_RECIPIENT_PER_DAY,
  CHURN_CYCLE_THRESHOLD,
  COOLDOWN_DURATION_MS,
  LOCK_DURATION_MS,
  WINDOW_1H_MS,
  WINDOW_24H_MS,
  WINDOW_7D_MS,
  WINDOW_30D_MS,
  enforcementLevelForScore,
  type AbuseRuleKey,
  type EnforcementLevel,
} from '@/lib/abuse-policy';

// ── Public result type ───────────────────────────────────────

export type AbuseCheckResult = {
  /** Whether the action should proceed. */
  allowed: boolean;
  /** Current enforcement level after this check. */
  level: EnforcementLevel;
  /** User-facing message (only set when level >= warning). */
  message?: string;
  /** ISO timestamp when the org can retry (only set on cooldown/lock). */
  retryAfter?: string;
  /** True when rules fired but were not enforced (dry-run mode). */
  dryRun: boolean;
};

// ── Invite-path check ────────────────────────────────────────

/**
 * Run all invite-related abuse checks for an organization.
 * Should be called AFTER the hard seat-cap check passes.
 */
export async function checkInviteAbuse(params: {
  orgId: string;
  actorUserId: string;
  recipientEmail: string;
  tier: string;
}): Promise<AbuseCheckResult> {
  if (!ANTI_SHARING_ENABLED || params.tier === 'enterprise') {
    return { allowed: true, level: 'none', dryRun: false };
  }

  const { orgId, actorUserId, recipientEmail } = params;
  const now = new Date();
  const triggeredRules: { key: AbuseRuleKey; meta: Record<string, unknown> }[] = [];

  // ── 1. Check active enforcement (cooldown / lock) ────────

  const currentState = await getOrCreateAbuseState(orgId);

  if (currentState.lock_until && new Date(currentState.lock_until) > now) {
    return blocked('lock', currentState.lock_until);
  }
  if (currentState.cooldown_until && new Date(currentState.cooldown_until) > now) {
    return blocked('cooldown', currentState.cooldown_until);
  }

  // ── 2. Velocity checks ──────────────────────────────────

  const oneHourAgo = new Date(now.getTime() - WINDOW_1H_MS).toISOString();
  const oneDayAgo  = new Date(now.getTime() - WINDOW_24H_MS).toISOString();

  // 2a. Per-inviter per hour
  const { count: inviterHourCount } = await supabaseAdmin
    .from('organization_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('invited_by_id', actorUserId)
    .gte('created_at', oneHourAgo);

  if ((inviterHourCount ?? 0) >= MAX_INVITES_PER_INVITER_PER_HOUR) {
    triggeredRules.push({
      key: 'invite_burst',
      meta: { count: inviterHourCount, limit: MAX_INVITES_PER_INVITER_PER_HOUR },
    });
  }

  // 2b. Per-org per day
  const { count: orgDayCount } = await supabaseAdmin
    .from('organization_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', oneDayAgo);

  if ((orgDayCount ?? 0) >= MAX_INVITES_PER_ORG_PER_DAY) {
    triggeredRules.push({
      key: 'org_invite_flood',
      meta: { count: orgDayCount, limit: MAX_INVITES_PER_ORG_PER_DAY },
    });
  }

  // 2c. Per-recipient per day
  const { count: recipientDayCount } = await supabaseAdmin
    .from('organization_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('email', recipientEmail)
    .gte('created_at', oneDayAgo);

  if ((recipientDayCount ?? 0) >= MAX_INVITES_PER_RECIPIENT_PER_DAY) {
    triggeredRules.push({
      key: 'recipient_spam',
      meta: { count: recipientDayCount, limit: MAX_INVITES_PER_RECIPIENT_PER_DAY },
    });
  }

  // ── 3. Churn cycle check (invite → cancel/remove → re-invite) ─

  const sevenDaysAgo = new Date(now.getTime() - WINDOW_7D_MS).toISOString();

  const { count: churnCount } = await supabaseAdmin
    .from('organization_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('email', recipientEmail)
    .in('status', ['canceled', 'declined'])
    .gte('created_at', sevenDaysAgo);

  if ((churnCount ?? 0) >= CHURN_CYCLE_THRESHOLD) {
    triggeredRules.push({
      key: 'churn_cycle',
      meta: { count: churnCount, threshold: CHURN_CYCLE_THRESHOLD, email: recipientEmail },
    });
  }

  // ── 4. Repeated threshold check (hit warning+ again within 30 d) ─

  const thirtyDaysAgo = new Date(now.getTime() - WINDOW_30D_MS).toISOString();

  const { count: recentRuleHits } = await supabaseAdmin
    .from('org_abuse_events')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', thirtyDaysAgo);

  if ((recentRuleHits ?? 0) > 0 && triggeredRules.length > 0) {
    triggeredRules.push({
      key: 'repeated_threshold',
      meta: { priorHits: recentRuleHits },
    });
  }

  // ── 5. Score, record, and decide ─────────────────────────

  if (triggeredRules.length === 0) {
    return { allowed: true, level: 'none', dryRun: false };
  }

  const addedScore = triggeredRules.reduce(
    (sum, r) => sum + RULE_WEIGHTS[r.key],
    0,
  );

  // Write events
  await Promise.all(
    triggeredRules.map((r) =>
      supabaseAdmin.from('org_abuse_events').insert({
        org_id: orgId,
        actor_user_id: actorUserId,
        rule_key: r.key,
        weight: RULE_WEIGHTS[r.key],
        metadata: r.meta,
      }),
    ),
  );

  // Recalculate aggregate scores from events
  const newScore30d = await recalcWindowScore(orgId, WINDOW_30D_MS);

  const newLevel = enforcementLevelForScore(newScore30d);

  // Update state
  const stateUpdate: Record<string, unknown> = {
    score_30d: newScore30d,
    enforcement_level: newLevel,
    updated_at: now.toISOString(),
  };

  if (newLevel === 'cooldown' && currentState.enforcement_level !== 'cooldown') {
    stateUpdate.cooldown_until = new Date(now.getTime() + COOLDOWN_DURATION_MS).toISOString();
    stateUpdate.strike_count = (currentState.strike_count ?? 0) + 1;
  }

  if (newLevel === 'lock' && currentState.enforcement_level !== 'lock') {
    stateUpdate.lock_until = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
    stateUpdate.strike_count = (currentState.strike_count ?? 0) + 1;
  }

  await supabaseAdmin
    .from('org_abuse_state')
    .upsert({ org_id: orgId, ...stateUpdate }, { onConflict: 'org_id' });

  // Audit
  auditLog({
    orgId,
    actorId: actorUserId,
    action: 'abuse.rule_triggered',
    metadata: {
      rules: triggeredRules.map((r) => r.key),
      addedScore,
      totalScore30d: newScore30d,
      newLevel,
      dryRun: ANTI_SHARING_DRY_RUN,
    },
  }).catch(() => {});

  if (newLevel !== currentState.enforcement_level) {
    auditLog({
      orgId,
      actorId: actorUserId,
      action: 'abuse.enforcement_changed',
      metadata: {
        from: currentState.enforcement_level,
        to: newLevel,
        dryRun: ANTI_SHARING_DRY_RUN,
      },
    }).catch(() => {});
  }

  // ── 6. Build result ──────────────────────────────────────

  if (ANTI_SHARING_DRY_RUN) {
    return { allowed: true, level: newLevel, dryRun: true };
  }

  if (newLevel === 'lock') {
    return blocked('lock', stateUpdate.lock_until as string);
  }
  if (newLevel === 'cooldown') {
    return blocked('cooldown', stateUpdate.cooldown_until as string);
  }
  // warning: allow but attach message
  return {
    allowed: true,
    level: 'warning',
    message: 'Your organization has unusual invitation activity. Continued misuse may result in temporary restrictions.',
    dryRun: false,
  };
}

// ── Churn signal (called when a member is removed / invite canceled) ─

/**
 * Record a churn signal when a member is removed or an invite is canceled.
 * Lightweight — just bumps the score; actual enforcement runs on next invite.
 */
export async function recordChurnSignal(params: {
  orgId: string;
  actorUserId: string;
  recipientEmail: string;
}): Promise<void> {
  if (!ANTI_SHARING_ENABLED) return;

  const { orgId, actorUserId, recipientEmail } = params;
  const sevenDaysAgo = new Date(Date.now() - WINDOW_7D_MS).toISOString();

  // Only record if this email was invited recently (prevents noise)
  const { count } = await supabaseAdmin
    .from('organization_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('email', recipientEmail)
    .gte('created_at', sevenDaysAgo);

  if ((count ?? 0) === 0) return;

  await supabaseAdmin.from('org_abuse_events').insert({
    org_id: orgId,
    actor_user_id: actorUserId,
    rule_key: 'churn_cycle',
    weight: RULE_WEIGHTS.churn_cycle,
    metadata: { email: recipientEmail, trigger: 'member_removed' },
  });

  // Refresh aggregate
  const newScore = await recalcWindowScore(orgId, WINDOW_30D_MS);
  await supabaseAdmin
    .from('org_abuse_state')
    .upsert(
      {
        org_id: orgId,
        score_30d: newScore,
        enforcement_level: enforcementLevelForScore(newScore),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
}

// ── Session signal capture (called at auth callback) ─────────

/**
 * Record or update session-signal hashes for a user.
 * Raw values are never stored — only SHA-256 hashes.
 */
export async function recordSessionSignal(params: {
  userId: string;
  orgId: string | null;
  ipAddress: string;
  userAgent: string;
}): Promise<void> {
  if (!ANTI_SHARING_ENABLED) return;

  const { userId, orgId, ipAddress, userAgent } = params;

  // Use Web Crypto for hashing (available in Edge runtime / Node 18+)
  const enc = new TextEncoder();
  const [ipHash, uaHash] = await Promise.all([
    hash(enc.encode(ipAddress)),
    hash(enc.encode(userAgent)),
  ]);
  const deviceHash = await hash(enc.encode(`${ipHash}:${uaHash}`));

  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('user_session_signals')
    .upsert(
      {
        user_id: userId,
        org_id: orgId,
        ip_hash: ipHash,
        ua_hash: uaHash,
        device_hash: deviceHash,
        first_seen_at: now,
        last_seen_at: now,
      },
      { onConflict: 'user_id,device_hash' },
    );

  if (error) {
    // On conflict (existing row), just update last_seen_at
    await supabaseAdmin
      .from('user_session_signals')
      .update({ last_seen_at: now, org_id: orgId ?? undefined })
      .eq('user_id', userId)
      .eq('device_hash', deviceHash);
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function getOrCreateAbuseState(orgId: string) {
  const { data } = await supabaseAdmin
    .from('org_abuse_state')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (data) return data;

  // First time — initialize
  const blank = {
    org_id: orgId,
    score_24h: 0,
    score_7d: 0,
    score_30d: 0,
    strike_count: 0,
    enforcement_level: 'none' as const,
    cooldown_until: null,
    lock_until: null,
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin
    .from('org_abuse_state')
    .upsert(blank, { onConflict: 'org_id' });

  return blank;
}

async function recalcWindowScore(orgId: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data } = await supabaseAdmin
    .from('org_abuse_events')
    .select('weight')
    .eq('org_id', orgId)
    .gte('created_at', since);

  return (data ?? []).reduce((sum, row) => sum + (row.weight as number), 0);
}

function blocked(level: 'cooldown' | 'lock', until: string): AbuseCheckResult {
  const label = level === 'lock' ? 'temporarily locked' : 'in a cooldown period';
  return {
    allowed: false,
    level,
    message: `Invitations for this organization are ${label} due to unusual activity. Please contact support if you believe this is an error.`,
    retryAfter: until,
    dryRun: false,
  };
}

async function hash(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data as ArrayBufferView<ArrayBuffer>);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
