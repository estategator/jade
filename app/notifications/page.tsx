"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCheck,
  Loader2,
  ShoppingBag,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  acceptOrgInvite,
  declineOrgInvite,
  type UserNotification,
} from "@/app/notifications/actions";
import { cn } from "@/lib/cn";

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (uid: string) => {
    const result = await getNotifications(uid);
    if (result.data) {
      setNotifications(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    }
    init();
  }, [router, load]);

  // Real-time: listen for new notifications inserted for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('user-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as UserNotification;
          setNotifications((prev) => {
            // Avoid duplicates if already fetched
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function handleAcceptInvite(notification: UserNotification) {
    if (!userId) return;
    setActionLoading(notification.id);
    setError("");

    const result = await acceptOrgInvite(notification.id, userId);
    if (result.error) {
      setError(result.error);
      setActionLoading(null);
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    setActionLoading(null);
    router.refresh();
  }

  async function handleDeclineInvite(notification: UserNotification) {
    if (!userId) return;
    setActionLoading(notification.id);
    setError("");

    const result = await declineOrgInvite(notification.id, userId);
    if (result.error) {
      setError(result.error);
      setActionLoading(null);
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    setActionLoading(null);
  }

  async function handleMarkRead(notification: UserNotification) {
    if (!userId) return;
    await markNotificationRead(notification.id, userId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }

  async function handleMarkAllRead() {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `You have ${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"} — manage invites, updates, and team activity.` : "You’re all caught up — no unread notifications."}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </motion.div>
      )}

      {notifications.length > 0 && unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <BellOff className="mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            All caught up
          </h3>
          <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
            You have no pending notifications.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                actionLoading={actionLoading}
                onAccept={handleAcceptInvite}
                onDecline={handleDeclineInvite}
                onMarkRead={handleMarkRead}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Notification Card ────────────────────────────────────────

function NotificationCard({
  notification,
  actionLoading,
  onAccept,
  onDecline,
  onMarkRead,
}: {
  notification: UserNotification;
  actionLoading: string | null;
  onAccept: (n: UserNotification) => void;
  onDecline: (n: UserNotification) => void;
  onMarkRead: (n: UserNotification) => void;
}) {
  const isLoading = actionLoading === notification.id;
  const isUnread = !notification.read_at;
  const payload = notification.payload as { org_name?: string; requested_role?: string; invited_by_email?: string; item_name?: string; amount?: number; currency?: string; buyer_email?: string | null };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className={cn(
        "rounded-2xl border bg-white p-5 transition-all dark:bg-zinc-900",
        isUnread
          ? "border-indigo-200 dark:border-indigo-800/50"
          : "border-stone-200 dark:border-zinc-800"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            notification.kind === "org_invite"
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
              : notification.kind === "sale_completed"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400"
          )}
        >
          {notification.kind === "org_invite" ? (
            <Building2 className="h-5 w-5" />
          ) : notification.kind === "sale_completed" ? (
            <ShoppingBag className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={cn(
                "text-sm text-stone-900 dark:text-white",
                isUnread ? "font-bold" : "font-medium"
              )}>
                {notification.title}
              </h3>
              {notification.body && (
                <p className="mt-0.5 text-sm text-stone-600 dark:text-zinc-400">
                  {notification.body}
                </p>
              )}
              {payload.invited_by_email && (
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                  Invited by {payload.invited_by_email}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isUnread && (
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              )}
              <span className="text-xs text-stone-400 dark:text-zinc-600">
                {formatRelativeTime(notification.created_at)}
              </span>
            </div>
          </div>

          {/* Actions */}
          {notification.kind === "org_invite" && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAccept(notification)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Accept
              </button>
              <button
                type="button"
                onClick={() => onDecline(notification)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-all hover:bg-stone-50 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </button>
              {isUnread && (
                <button
                  type="button"
                  onClick={() => onMarkRead(notification)}
                  className="ml-auto text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  Mark read
                </button>
              )}
            </div>
          )}

          {notification.kind !== "org_invite" && isUnread && (
            <div className="mt-3 flex items-center">
              <button
                type="button"
                onClick={() => onMarkRead(notification)}
                className="text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Mark read
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}
