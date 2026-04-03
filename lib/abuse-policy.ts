// Anti-sharing policy constants for progressive fair-use enforcement.
// Applies to Pro-tier organizations (5 seats) to detect and throttle
// member-slot abuse (rapid invite/remove churn, seat recycling, etc.).

// ── Feature flags ────────────────────────────────────────────

/** Master kill-switch. When false, all abuse checks are skipped. */
export const ANTI_SHARING_ENABLED =
  process.env.ANTI_SHARING_ENABLED !== 'false'; // default ON

/**
 * When true, abuse rules are evaluated and logged but never block actions.
 * Use during initial rollout to gather baseline data.
 */
export const ANTI_SHARING_DRY_RUN =
  process.env.ANTI_SHARING_DRY_RUN === 'true'; // default OFF

// ── Rule keys & weights ──────────────────────────────────────

export type AbuseRuleKey =
  | 'invite_burst'          // >N invites by one user in 1 h
  | 'recipient_spam'        // >N invites to same email in 24 h
  | 'org_invite_flood'      // >N invites per org in 24 h
  | 'churn_cycle'           // invite-accept/add then remove loop within 7 d
  | 'device_sharing'        // 3+ accounts on same device_hash in 7 d (Phase 2)
  | 'repeated_threshold';   // hit warning+ threshold again within 30 d

export const RULE_WEIGHTS: Record<AbuseRuleKey, number> = {
  invite_burst: 10,
  recipient_spam: 15,
  org_invite_flood: 10,
  churn_cycle: 20,
  device_sharing: 25,
  repeated_threshold: 15,
};

// ── Velocity limits (hard caps checked before scoring) ───────

/** Max invitations one user may send per org within 1 hour. */
export const MAX_INVITES_PER_INVITER_PER_HOUR = 5;

/** Max invitations an org may generate within 24 hours. */
export const MAX_INVITES_PER_ORG_PER_DAY = 15;

/** Max invitations to the same recipient email per 24 hours. */
export const MAX_INVITES_PER_RECIPIENT_PER_DAY = 3;

// ── Scoring thresholds ───────────────────────────────────────

export type EnforcementLevel = 'none' | 'warning' | 'cooldown' | 'lock';

/** Maps a cumulative 30-day risk score to an enforcement level. */
export function enforcementLevelForScore(score: number): EnforcementLevel {
  if (score >= 90) return 'lock';
  if (score >= 60) return 'cooldown';
  if (score >= 30) return 'warning';
  return 'none';
}

// ── Cooldown / lock durations ────────────────────────────────

/** Cooldown period in milliseconds (invites rejected with retry-after). */
export const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 h

/** Lock period in milliseconds (all invite actions blocked). */
export const LOCK_DURATION_MS = 72 * 60 * 60 * 1000; // 72 h

// ── Time windows ─────────────────────────────────────────────

export const WINDOW_1H_MS  = 60 * 60 * 1000;
export const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
export const WINDOW_7D_MS  = 7 * 24 * 60 * 60 * 1000;
export const WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000;

// ── Churn detection ──────────────────────────────────────────

/**
 * Number of invite → remove (or cancel) cycles for the same recipient
 * email within 7 days that constitutes a churn signal.
 */
export const CHURN_CYCLE_THRESHOLD = 2;
