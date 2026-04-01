"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import {
  getNotifications,
  getUnreadNotificationCount,
  type UserNotification,
} from "@/app/notifications/actions";

// ── Context shape ────────────────────────────────────────────

type NotificationContextValue = {
  /** Full notification list (unresolved, newest first). */
  notifications: UserNotification[];
  /** Unread count for badge display. */
  unreadCount: number;
  /** True while the initial fetch is in progress. */
  loading: boolean;
  /** Authenticated user id (null until session resolves). */
  userId: string | null;
  /** Replace the full notification list (for local optimistic updates). */
  setNotifications: React.Dispatch<React.SetStateAction<UserNotification[]>>;
  /** Re-fetch notifications from the server. */
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Batching config ──────────────────────────────────────────

/** Flush incoming realtime events after this many ms to coalesce React renders. */
const BATCH_FLUSH_MS = 80;
/** Low-frequency reconciliation interval (ms). */
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ── Provider ─────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Pending batch of realtime inserts waiting to be flushed.
  const batchRef = useRef<UserNotification[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flush batched inserts into state ──

  const flushBatch = useCallback(() => {
    flushTimerRef.current = null;
    const pending = batchRef.current;
    if (pending.length === 0) return;
    batchRef.current = [];

    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const novel = pending.filter((n) => !existingIds.has(n.id));
      if (novel.length === 0) return prev;
      return [...novel, ...prev];
    });
  }, []);

  // ── Full fetch (initial load + reconciliation) ──

  const fetchAll = useCallback(async (uid: string) => {
    const result = await getNotifications(uid);
    if (result.data) {
      setNotifications(result.data);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (userId) await fetchAll(userId);
  }, [userId, fetchAll]);

  // ── Session bootstrap ──

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      await fetchAll(uid);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  // ── Realtime subscription (single channel per tab) ──

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("user-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const item = payload.new as UserNotification;
          batchRef.current.push(item);

          // Schedule a flush if one isn't already pending.
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(flushBatch, BATCH_FLUSH_MS);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Flush any remaining items on teardown.
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      batchRef.current = [];
    };
  }, [userId, flushBatch]);

  // ── Periodic reconciliation + visibility-based refresh ──

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    // Low-frequency server reconciliation to catch any missed events.
    const timer = setInterval(() => fetchAll(uid), RECONCILE_INTERVAL_MS);

    // Re-sync when the tab regains focus.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchAll(uid);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId, fetchAll]);

  // ── Derived unread count ──

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        userId,
        setNotifications,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
