# Anti-Sharing & Abuse Detection System

## Why This Exists

Curator's Pro plan allows up to 5 team members per organization. Some users may try to work around this limit by sharing login credentials between people or by rapidly adding and removing members to give more than 5 people access on a rotating basis.

This system detects those patterns and responds gradually — starting with a friendly warning and only escalating to temporary restrictions after repeated suspicious behavior. The goal is to stop actual abuse without punishing legitimate teams.

---

## Who It Applies To

| Plan | Covered? | Details |
|------|----------|---------|
| Free | Yes | 1-member limit; same rules apply |
| Pro | Yes | Primary target — 5-member limit |
| Enterprise | No | Unlimited members; always exempt |

Enterprise organizations are never checked. The system only runs for Free and Pro organizations.

---

## What We Look For

The system monitors six types of suspicious behavior. Each one has a name, a description, and a "weight" — a number that represents how suspicious it is. Higher weights mean the behavior is more concerning.

### 1. Invite Burst (weight: 10)

**What it means:** One person sends more than 5 invitations within a single hour.

**Why it matters:** Normal team setup rarely requires sending that many invitations so quickly. A burst of invitations may indicate someone is trying to cycle through temporary users.

**Limit:** 5 invitations per person, per organization, per hour.

### 2. Recipient Spam (weight: 15)

**What it means:** The same email address receives more than 3 invitations from the same organization within 24 hours.

**Why it matters:** If someone keeps inviting the same person over and over in a short window, they may be trying to work around a declined or canceled invitation.

**Limit:** 3 invitations to the same email, per organization, per 24 hours.

### 3. Organization Invite Flood (weight: 10)

**What it means:** An organization generates more than 15 total invitations within 24 hours.

**Why it matters:** Even if spread across multiple admins, an unusually high volume of invitations from one organization is a signal worth tracking.

**Limit:** 15 invitations per organization, per 24 hours.

### 4. Churn Cycle (weight: 20)

**What it means:** The same email address has been invited, then had their invitation canceled (or declined), 2 or more times within 7 days — and then they are being invited again.

**Why it matters:** This is the core "seat recycling" pattern. Someone invites a person, removes them, invites someone else, removes _them_, and repeats — effectively giving 10+ people access through 5 seats.

**Threshold:** 2 canceled or declined invitations for the same email within 7 days.

### 5. Device Sharing (weight: 25) — Future Phase

**What it means:** 3 or more different user accounts in the same organization are logging in from the same device within 7 days.

**Why it matters:** This is a strong signal that multiple people are sharing one set of login credentials, or that one person created multiple accounts.

**Note:** This rule is tracked (session data is collected) but not yet scored. It will be activated in a future update.

### 6. Repeated Threshold Hit (weight: 15)

**What it means:** The organization already triggered the system within the past 30 days and is triggering it again now.

**Why it matters:** A one-time burst might be innocent (like setting up a new team). But if the same organization keeps triggering rules month after month, it suggests intentional misuse.

---

## How Scoring Works

Every time a rule is triggered, its weight is added to the organization's running score. The score is calculated over a rolling 30-day window — meaning events older than 30 days no longer count.

### Score to Enforcement Level

| 30-Day Score | Level | What Happens |
|-------------|-------|--------------|
| 0–29 | **None** | Everything works normally |
| 30–59 | **Warning** | The invitation goes through, but the admin sees a warning message |
| 60–89 | **Cooldown** | Invitations are blocked for 24 hours |
| 90+ | **Lock** | Invitations are blocked for 72 hours |

### Example Scenario

Day 1: An admin sends 6 invitations in one hour.
- Triggers: Invite Burst (+10)
- Total score: 10 → **No action**

Day 3: The same admin invites the same person for the 4th time today.
- Triggers: Recipient Spam (+15)
- Total score: 25 → **No action** (still under 30)

Day 5: Admin cancels 2 invitations for the same person and re-invites them.
- Triggers: Churn Cycle (+20)
- Triggers: Repeated Threshold (+15, because there are existing events in the 30-day window)
- Total score: 60 → **Cooldown activated** (invitations blocked for 24 hours)

Day 6 (after cooldown expires): Admin tries to invite again.
- If no new rules trigger, the existing score is still 60 but no new events are added.
- The cooldown has expired, so the invitation goes through.
- A warning is shown because the score is still ≥ 30.

### Score Decay

Scores are not reduced manually. Instead, they naturally decrease as events age past the 30-day window. If an organization stops the suspicious behavior, their score will return to zero within 30 days.

---

## What Each Enforcement Level Looks Like

### None (score 0–29)

Everything works normally. No messages, no restrictions.

### Warning (score 30–59)

The invitation is **allowed** but the admin sees a message:

> "Your organization has unusual invitation activity. Continued misuse may result in temporary restrictions."

This is purely informational. No actions are blocked.

### Cooldown (score 60–89)

Invitations are **blocked for 24 hours**. The admin sees:

> "Invitations for this organization are in a cooldown period due to unusual activity. Please contact support if you believe this is an error."

The response includes a "retry after" timestamp so the admin knows when they can try again. All other organization features (inventory, marketing, settings, etc.) continue to work normally.

### Lock (score 90+)

Invitations are **blocked for 72 hours**. The admin sees:

> "Invitations for this organization are temporarily locked due to unusual activity. Please contact support if you believe this is an error."

Same as cooldown but longer. This only happens after sustained, repeated suspicious behavior.

**Important:** We never permanently ban invitation access. Cooldowns and locks always expire automatically.

---

## Where Checks Run

The system checks for abuse at three points:

### 1. Sending an Invitation

When an admin clicks "Invite Member" and submits an email address. This is the primary enforcement point. The check runs _after_ verifying the organization hasn't exceeded its seat limit but _before_ the invitation is actually created.

### 2. Directly Adding a Member

There is a secondary code path where a member can be added directly (without the invitation email flow). The same abuse checks run here too, so this path cannot be used to bypass the system.

### 3. Canceling an Invitation

When an admin cancels a pending invitation, the system records a "churn signal." This doesn't block the cancellation itself — it just notes the event so that if the admin then re-invites the same person, the churn cycle rule can detect the pattern.

---

## Session Signal Collection

Every time a user logs in, the system records a fingerprint of their device. This is used to detect credential sharing (multiple people using the same login).

### What Is Collected

- A one-way hash of their IP address
- A one-way hash of their browser's User-Agent string
- A combined "device hash" derived from both

### What Is NOT Collected

- The raw IP address is never stored
- The raw User-Agent string is never stored
- No cookies, screen resolution, or other browser fingerprinting techniques are used
- No personal information beyond what the user already provided at signup

### How Hashing Works

The system uses SHA-256 (an industry-standard one-way function) to convert values like `192.168.1.1` into a fixed-length string like `a1b2c3d4e5...`. It is not possible to reverse this process to recover the original IP address. The hash is only useful for checking "did this same value appear before?"

### Current Status

Session signals are being collected but the Device Sharing rule (checking for 3+ accounts on the same device) is **not yet active**. It will be enabled in a future update after we have enough baseline data to set accurate thresholds.

---

## Database Storage

The system uses three database tables. All three are locked down so that only the server can read or write them — they are never accessible from the browser.

### Abuse Events (org_abuse_events)

An append-only log of every rule that fires. Each row records:
- Which organization
- Which user triggered it
- Which rule fired
- The rule's weight
- Additional context (like the email involved, the count that exceeded the limit)
- When it happened

This table is never modified after a row is written. It serves as a complete audit trail.

### Abuse State (org_abuse_state)

A single row per organization that tracks the current situation:
- Current 30-day score
- How many "strikes" (cooldowns or locks) have occurred
- The current enforcement level (none, warning, cooldown, or lock)
- When a cooldown or lock expires (if active)

This row is updated every time a rule fires.

### Session Signals (user_session_signals)

One row per user per unique device. Tracks:
- The user's hashed device fingerprint
- When they first and last logged in from that device
- Which organization they belong to

Used for future device-sharing detection.

---

## Feature Flags and Safe Rollout

The system has two environment variable controls:

### ANTI_SHARING_ENABLED

- Default: `true` (system is active)
- Set to `false` to completely disable all checks
- When disabled, no rules are evaluated, no events are recorded, and no session signals are captured

### ANTI_SHARING_DRY_RUN

- Default: `false` (enforcement is real)
- Set to `true` to enable "observation mode"
- In dry-run mode, all rules are evaluated and events are recorded, but **no actions are ever blocked**
- Warnings, cooldowns, and locks are calculated but not enforced
- This is useful for the first week of deployment to see what the system would do without affecting any users

### Recommended Rollout Schedule

| Week | Configuration | Behavior |
|------|--------------|----------|
| 1 | `ANTI_SHARING_DRY_RUN=true` | Log everything, block nothing |
| 2 | `ANTI_SHARING_DRY_RUN=false` | Warnings active, cooldowns and locks active |
| 3+ | Same as week 2 | Full enforcement; review false-positive reports |

If at any point something goes wrong, set `ANTI_SHARING_ENABLED=false` to immediately disable the entire system.

---

## Audit Trail

Every time the system takes action, it writes to the existing audit log (the same log used for all organization activity like member changes, billing events, etc.). Three new audit event types were added:

| Event | When It's Written |
|-------|------------------|
| `abuse.rule_triggered` | A rule fired (includes which rules, the scores, and whether dry-run was active) |
| `abuse.enforcement_changed` | The enforcement level changed (e.g., from "none" to "warning", or from "warning" to "cooldown") |
| `abuse.override_applied` | A support team member manually cleared a cooldown or lock (future feature) |

---

## Support Override (Future)

A planned feature will allow support team members to:
- Clear an active cooldown or lock for an organization
- Reduce the organization's strike count by one
- Attach a reason that gets recorded in the audit log

This ensures that if a legitimate team is incorrectly flagged, support can resolve it without waiting for the timer to expire.

---

## Scenarios and Expected Outcomes

### Scenario 1: Normal Team Setup

A new Pro organization adds 4 team members on their first day.

- 4 invitations in one hour → under the 5/hour limit
- Total score: 0
- **Outcome: No warnings, no restrictions**

### Scenario 2: Busy Onboarding Day

An admin sets up 5 members, realizes they invited the wrong email for one, cancels it, and re-invites the correct person.

- 5 invitations in one hour → triggers Invite Burst (+10)
- 1 cancellation + re-invite → under churn threshold (needs 2)
- Total score: 10
- **Outcome: No warnings (score under 30)**

### Scenario 3: Deliberate Seat Recycling

An admin invites Person A, they join, admin removes them, invites Person B, they join, admin removes them, invites Person C — all within a week. Repeat with the same people the following week.

- Multiple churn cycles detected (+20 each)
- Repeated threshold hits (+15)
- Score quickly reaches 60+
- **Outcome: Warning, then cooldown after a few more cycles**

### Scenario 4: Credential Sharing (Future)

Three different people log into the same account from the same browser on the same computer within a week.

- Device sharing signal detected (+25) — once active
- **Current outcome: Signal recorded but not scored**
- **Future outcome: Contributes to score like any other rule**

### Scenario 5: Enterprise Organization

An Enterprise admin sends 50 invitations in a day.

- System is completely bypassed for Enterprise
- **Outcome: No checks, no warnings, no restrictions**

---

## What This System Does NOT Do

- **It does not lock anyone out of their account.** Only invitation actions are affected. Members can always log in, view inventory, manage sales, and use all other features.
- **It does not permanently ban anyone.** Every restriction has an expiration timer.
- **It does not read private data.** IP addresses and browser information are hashed before storage and cannot be reversed.
- **It does not affect Enterprise customers.** Enterprise organizations are completely exempt.
- **It does not block the first offense.** The system starts with a warning and only escalates after continued suspicious patterns.

---

## Files Involved

| File | Purpose |
|------|---------|
| `lib/abuse-policy.ts` | All constants: rule weights, velocity limits, thresholds, time windows, feature flags |
| `lib/abuse-detection.ts` | Core logic: checking invitations, recording churn, capturing session signals |
| `lib/rbac-types.ts` | Audit event type definitions (3 new `abuse.*` types) |
| `app/organizations/actions.ts` | Integration points: abuse checks in invite flows, churn recording in cancel flow |
| `app/auth/callback/route.ts` | Session signal capture on login |
| `supabase/migrations/029_anti_sharing_abuse_tracking.sql` | Database tables and indexes |
| `app/components/help-docs-content.tsx` | User-facing documentation in the help center |
| `lib/faqs.ts` | FAQ entries about the fair-use policy |

---

## Tuning the System

All thresholds are defined as named constants in `lib/abuse-policy.ts`. To adjust behavior:

- **Make the system more lenient:** Increase the score thresholds (e.g., change warning from 30 to 50) or decrease rule weights.
- **Make the system stricter:** Decrease the score thresholds or increase rule weights.
- **Change cooldown/lock durations:** Modify `COOLDOWN_DURATION_MS` (default 24 hours) or `LOCK_DURATION_MS` (default 72 hours).
- **Adjust velocity limits:** Modify `MAX_INVITES_PER_INVITER_PER_HOUR` (default 5), `MAX_INVITES_PER_ORG_PER_DAY` (default 15), or `MAX_INVITES_PER_RECIPIENT_PER_DAY` (default 3).
- **Change churn sensitivity:** Modify `CHURN_CYCLE_THRESHOLD` (default 2 canceled/declined invitations for the same email in 7 days).

No code changes are required to adjust these values — only the constants need to be updated.
