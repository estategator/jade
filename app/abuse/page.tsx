"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ShieldAlert,
  Lock,
  Activity,
  Loader2,
  AlertCircle,
  Monitor,
  Filter,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getProfileRole,
  getAbuseOverview,
  getAbuseStates,
  getAbuseEvents,
  getAbuseTrend,
  getAbuseRuleBreakdown,
  getDeviceSignals,
  type AbuseOverview,
  type AbuseStateRow,
  type AbuseEventRow,
  type AbuseTrendPoint,
  type RuleBreakdownItem,
  type DeviceSignalRow,
} from "@/app/support/actions";
import { cn } from "@/lib/cn";

const RULE_LABELS: Record<string, string> = {
  invite_burst: "Invite Burst",
  recipient_spam: "Recipient Spam",
  org_invite_flood: "Org Invite Flood",
  churn_cycle: "Churn Cycle",
  device_sharing: "Device Sharing",
  repeated_threshold: "Repeated Threshold",
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  none: { label: "None", color: "text-stone-500 dark:text-zinc-400", bg: "bg-stone-100 dark:bg-zinc-800" },
  warning: { label: "Warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  cooldown: { label: "Cooldown", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
  lock: { label: "Lock", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

type DateRange = "7" | "30";

export default function AbuseMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uid, setUid] = useState("");

  // Data
  const [overview, setOverview] = useState<AbuseOverview | null>(null);
  const [states, setStates] = useState<AbuseStateRow[]>([]);
  const [events, setEvents] = useState<AbuseEventRow[]>([]);
  const [trend, setTrend] = useState<AbuseTrendPoint[]>([]);
  const [ruleBreakdown, setRuleBreakdown] = useState<RuleBreakdownItem[]>([]);
  const [deviceSignals, setDeviceSignals] = useState<DeviceSignalRow[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const [levelFilter, setLevelFilter] = useState("all");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const role = await getProfileRole(session.user.id);
      if (role !== "developer" && role !== "support") {
        router.replace("/dashboard");
        return;
      }
      setUid(session.user.id);
    }
    init();
  }, [router]);

  const loadData = useCallback(
    async (userId: string) => {
      setLoading(true);
      setError("");
      const days = parseInt(dateRange);
      const orgId = selectedOrg ?? undefined;

      const [overviewRes, statesRes, eventsRes, trendRes, ruleRes, deviceRes] =
        await Promise.all([
          getAbuseOverview(userId),
          getAbuseStates(userId, { enforcementLevel: levelFilter, orgId }),
          getAbuseEvents(userId, { days, orgId, ruleKey: ruleFilter !== "all" ? ruleFilter : undefined }),
          getAbuseTrend(userId, { days, orgId }),
          getAbuseRuleBreakdown(userId, { days, orgId }),
          getDeviceSignals(userId, { orgId }),
        ]);

      if (overviewRes.error) setError(overviewRes.error);
      if (overviewRes.data) setOverview(overviewRes.data);
      if (statesRes.data) setStates(statesRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (trendRes.data) setTrend(trendRes.data);
      if (ruleRes.data) setRuleBreakdown(ruleRes.data);
      if (deviceRes.data) setDeviceSignals(deviceRes.data);
      setLoading(false);
    },
    [dateRange, levelFilter, ruleFilter, selectedOrg],
  );

  useEffect(() => {
    if (uid) loadData(uid);
  }, [uid, loadData]);

  if (!uid || (loading && !overview)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Abuse Monitor"
        description="Visual overview of anti-sharing abuse signals across all organizations."
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-zinc-400">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="all">All Levels</option>
          <option value="warning">Warning</option>
          <option value="cooldown">Cooldown</option>
          <option value="lock">Lock</option>
        </select>
        <select
          value={ruleFilter}
          onChange={(e) => setRuleFilter(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="all">All Rules</option>
          {Object.entries(RULE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {selectedOrg && (
          <button
            type="button"
            onClick={() => setSelectedOrg(null)}
            className="rounded-lg bg-[var(--color-brand-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-primary)] transition-colors hover:opacity-80"
          >
            Clear org filter &times;
          </button>
        )}
      </div>

      {/* Overview cards */}
      {overview && <OverviewCards overview={overview} />}

      {/* Trend + Rule breakdown row */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TrendChart trend={trend} dateRange={dateRange} />
        <RuleBreakdownChart breakdown={ruleBreakdown} />
      </div>

      {/* Org states table */}
      <OrgStatesTable states={states} onSelectOrg={setSelectedOrg} selectedOrg={selectedOrg} />

      {/* Events table */}
      <EventsTable events={events} onSelectOrg={setSelectedOrg} />

      {/* Device signals */}
      <DeviceSignalsPanel signals={deviceSignals} onSelectOrg={setSelectedOrg} />
    </div>
  );
}

// ── Overview Cards ───────────────────────────────────────────

function OverviewCards({ overview }: { overview: AbuseOverview }) {
  const cards = [
    {
      label: "Orgs with Signals",
      value: overview.total_orgs,
      color: "text-stone-700 dark:text-zinc-300",
      bg: "bg-stone-50 dark:bg-zinc-800/50",
      icon: Activity,
    },
    {
      label: "Warnings",
      value: overview.warning_count,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      icon: AlertTriangle,
    },
    {
      label: "Cooldowns",
      value: overview.cooldown_count,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      icon: ShieldAlert,
    },
    {
      label: "Locks",
      value: overview.lock_count,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
      icon: Lock,
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-xl border border-stone-200 p-4 dark:border-zinc-700",
              card.bg,
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", card.color)} />
              <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">
                {card.label}
              </p>
            </div>
            <p className={cn("mt-2 text-2xl font-bold", card.color)}>
              {card.value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Trend Chart ──────────────────────────────────────────────

function TrendChart({ trend, dateRange }: { trend: AbuseTrendPoint[]; dateRange: string }) {
  const maxWeight = useMemo(() => Math.max(...trend.map((t) => t.total_weight), 1), [trend]);

  if (trend.length === 0) {
    return (
      <EmptyBlock title="No trend data" description="No abuse events in the selected window." />
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          Score Trend ({dateRange}d)
        </h3>
      </div>
      <div className="flex h-40 items-end gap-px">
        {trend.map((point) => {
          const height = maxWeight > 0 ? (point.total_weight / maxWeight) * 100 : 0;
          return (
            <div
              key={point.date}
              className="group relative flex-1"
              title={`${point.date}: ${point.event_count} events, weight ${point.total_weight}`}
            >
              <div
                className="w-full rounded-t bg-[var(--color-brand-primary)]/60 transition-colors group-hover:bg-[var(--color-brand-primary)]"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-stone-400 dark:text-zinc-500">
        <span>{trend[0]?.date}</span>
        <span>{trend[trend.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ── Rule Breakdown ───────────────────────────────────────────

function RuleBreakdownChart({ breakdown }: { breakdown: RuleBreakdownItem[] }) {
  const maxWeight = useMemo(() => Math.max(...breakdown.map((b) => b.total_weight), 1), [breakdown]);

  if (breakdown.length === 0) {
    return (
      <EmptyBlock title="No rule data" description="No rules triggered in the selected window." />
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          Rule Breakdown
        </h3>
      </div>
      <div className="space-y-3">
        {breakdown.map((item) => {
          const pct = (item.total_weight / maxWeight) * 100;
          return (
            <div key={item.rule_key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-stone-700 dark:text-zinc-300">
                  {RULE_LABELS[item.rule_key] ?? item.rule_key}
                </span>
                <span className="text-stone-400 dark:text-zinc-500">
                  {item.count} hits &middot; weight {item.total_weight}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-primary)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Org States Table ─────────────────────────────────────────

function OrgStatesTable({
  states,
  onSelectOrg,
  selectedOrg,
}: {
  states: AbuseStateRow[];
  onSelectOrg: (orgId: string | null) => void;
  selectedOrg: string | null;
}) {
  if (states.length === 0) {
    return (
      <div className="mb-8">
        <EmptyBlock title="No abuse states" description="No organizations have triggered abuse rules." />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">
        Organization States
      </h3>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
              <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Organization</th>
              <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Level</th>
              <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">Score (30d)</th>
              <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 md:table-cell">Strikes</th>
              <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 lg:table-cell">Expires</th>
              <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
            {states.map((s) => {
              const level = LEVEL_CONFIG[s.enforcement_level] ?? LEVEL_CONFIG.none;
              const isSelected = selectedOrg === s.org_id;
              const expiresAt = s.lock_until ?? s.cooldown_until;
              return (
                <tr
                  key={s.org_id}
                  onClick={() => onSelectOrg(isSelected ? null : s.org_id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/30",
                    isSelected && "bg-[var(--color-brand-subtle)] dark:bg-[var(--color-brand-subtle)]",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-stone-900 dark:text-white">
                    {s.org_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", level.color, level.bg)}>
                      {level.label}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-stone-700 dark:text-zinc-300 sm:table-cell">
                    {s.score_30d}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-stone-700 dark:text-zinc-300 md:table-cell">
                    {s.strike_count}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-stone-500 dark:text-zinc-400 lg:table-cell">
                    {expiresAt ? formatDate(expiresAt) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-stone-500 dark:text-zinc-400 sm:table-cell">
                    {formatDate(s.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Events Table ─────────────────────────────────────────────

function EventsTable({
  events,
  onSelectOrg,
}: {
  events: AbuseEventRow[];
  onSelectOrg: (orgId: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="mb-8">
        <EmptyBlock title="No abuse events" description="No events recorded in the selected window." />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">
        Recent Events
      </h3>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Time</th>
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Organization</th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 md:table-cell">Actor</th>
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Rule</th>
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Weight</th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
              {events.map((e) => (
                <tr
                  key={e.id}
                  className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500 dark:text-zinc-400">
                    {formatDate(e.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectOrg(e.org_id)}
                      className="text-sm font-medium text-[var(--color-brand-primary)] hover:opacity-80"
                    >
                      {e.org_name}
                    </button>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-stone-700 dark:text-zinc-300 md:table-cell">
                    {e.actor_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {RULE_LABELS[e.rule_key] ?? e.rule_key}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-sm text-stone-700 dark:text-zinc-300">
                    +{e.weight}
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-stone-400 dark:text-zinc-500 lg:table-cell">
                    {formatMetadata(e.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Device Signals ───────────────────────────────────────────

function DeviceSignalsPanel({
  signals,
  onSelectOrg,
}: {
  signals: DeviceSignalRow[];
  onSelectOrg: (orgId: string) => void;
}) {
  if (signals.length === 0) {
    return (
      <div className="mb-8">
        <EmptyBlock
          title="No shared devices"
          description="No devices with multiple users detected."
        />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">
        Device Sharing Signals
      </h3>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
              <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Organization</th>
              <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Device Hash</th>
              <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Users</th>
              <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
            {signals.map((s) => (
              <tr
                key={`${s.org_id}:${s.device_hash}`}
                className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/30"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectOrg(s.org_id)}
                    className="text-sm font-medium text-[var(--color-brand-primary)] hover:opacity-80"
                  >
                    {s.org_name}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-500 dark:text-zinc-400">
                  {s.device_hash.slice(0, 12)}…
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      s.user_count >= 3
                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
                    )}
                  >
                    <Monitor className="h-3 w-3" />
                    {s.user_count} users
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-xs text-stone-500 dark:text-zinc-400 sm:table-cell">
                  {formatDate(s.last_seen_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <Activity className="mx-auto h-8 w-8 text-stone-300 dark:text-zinc-600" />
      <p className="mt-2 text-sm font-medium text-stone-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (meta.count != null) parts.push(`count: ${meta.count}`);
  if (meta.limit != null) parts.push(`limit: ${meta.limit}`);
  if (meta.email) parts.push(`email: ${String(meta.email)}`);
  if (meta.threshold != null) parts.push(`threshold: ${meta.threshold}`);
  if (meta.priorHits != null) parts.push(`prior: ${meta.priorHits}`);
  return parts.join(", ") || "—";
}
