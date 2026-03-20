"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Apple, ArrowRight, Loader2, Mail } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AuthProvider = "google" | "apple";

type OAuthButtonProps = Readonly<{
  provider: AuthProvider;
  loadingProvider: AuthProvider | null;
  onClick: (provider: AuthProvider) => void;
}>;

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12.2c0 4.4-3 7.8-7.6 7.8A8 8 0 1 1 12.3 4c1.9 0 3.4.7 4.7 1.8" />
      <path d="M22 12h-9.5" />
    </svg>
  );
}

function OAuthButton({ provider, loadingProvider, onClick }: OAuthButtonProps) {
  const isLoading = loadingProvider === provider;
  const copy = provider === "google" ? "Continue with Google" : "Continue with Apple";
  const Icon = provider === "google" ? GoogleGlyph : Apple;

  return (
    <button
      type="button"
      onClick={() => onClick(provider)}
      disabled={Boolean(loadingProvider)}
      className={cn(
        "group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
        "border-stone-200 bg-white text-stone-900 hover:border-indigo-200 hover:shadow-lg",
        "dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-indigo-800",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-stone-50",
        "dark:focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-white">
          <Icon />
        </span>
        <span className="block text-sm font-semibold">{copy}</span>
      </span>
      <span className="flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400">
        {isLoading ? "Redirecting" : "Sign in"}
        <ArrowRight className={cn("h-4 w-4 transition-transform", !isLoading && "group-hover:translate-x-0.5")} />
      </span>
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Read URL params for intent flow
  const next = searchParams.get("next") || "/dashboard";
  const intent = searchParams.get("intent");
  const tier = searchParams.get("tier");

  // Build query string for callbacks
  const callbackParams = new URLSearchParams();
  callbackParams.set("next", next);
  if (intent) callbackParams.set("intent", intent);
  if (tier) callbackParams.set("tier", tier);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setIsAuthenticated(Boolean(session));
        if (session) {
          const redirectUrl = new URL(next, window.location.origin).pathname;
          if (intent && tier) {
            router.replace(`${redirectUrl}?intent=${intent}&tier=${tier}`);
          } else {
            router.replace(redirectUrl);
          }
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setLoadingProvider(null);
      if (session) {
        const redirectUrl = new URL(next, window.location.origin).pathname;
        if (intent && tier) {
          router.replace(`${redirectUrl}?intent=${intent}&tier=${tier}`);
        } else {
          router.replace(redirectUrl);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [next, intent, tier, router]);

  async function handleOAuthSignIn(provider: AuthProvider) {
    setErrorMessage("");
    setLoadingProvider(provider);

    const redirectTo = `${window.location.origin}/auth/callback?${callbackParams.toString()}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams:
          provider === "google"
            ? {
                access_type: "offline",
                prompt: "select_account",
              }
            : undefined,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoadingProvider(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setEmailLoading(true);
    setConfirmationSent(false);

    const emailRedirectUrl = `${window.location.origin}${next}${intent && tier ? `?intent=${intent}&tier=${tier}` : ""}`;

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirectUrl },
      });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setConfirmationSent(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
      }
    }

    setEmailLoading(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans selection:bg-stone-200 dark:bg-zinc-950 dark:selection:bg-zinc-800">
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-[120%] rounded-full bg-indigo-500/10 blur-3xl mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute left-1/2 top-40 h-72 w-72 translate-x-[20%] rounded-full bg-emerald-500/10 blur-3xl mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-6 shadow-2xl shadow-stone-200/60 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30 sm:p-8"
        >
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 font-bold text-white dark:bg-white dark:text-stone-900">
              C
            </div>
            Curator
          </Link>

          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-stone-500">
              Sign in
            </p>
            <h1 className="mt-3 text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
              Use a provider or your email to access Curator.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <OAuthButton
              provider="google"
              loadingProvider={loadingProvider}
              onClick={handleOAuthSignIn}
            />
            <OAuthButton
              provider="apple"
              loadingProvider={loadingProvider}
              onClick={handleOAuthSignIn}
            />
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200 dark:bg-zinc-800" />
            <span className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-zinc-600">or</span>
            <div className="h-px flex-1 bg-stone-200 dark:bg-zinc-800" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="block w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-3 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-stone-500"
              />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="block w-full rounded-xl border border-stone-300 bg-white py-3 px-3 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-stone-500"
            />
            <button
              type="submit"
              disabled={emailLoading}
              className="inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Sign in with email"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-stone-500 dark:text-zinc-500">
            {mode === "signin" ? (
              <>Don&apos;t have an account?{" "}
                <button type="button" onClick={() => { setMode("signup"); setErrorMessage(""); setConfirmationSent(false); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" onClick={() => { setMode("signin"); setErrorMessage(""); setConfirmationSent(false); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Sign in</button>
              </>
            )}
          </p>

          {confirmationSent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-100/70 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              Check your email for a confirmation link to finish signing up.
            </motion.div>
          ) : null}

          {isAuthenticated && !errorMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-100/70 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              You already have an active session in this browser.
            </motion.div>
          ) : null}

          {errorMessage ? (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
            >
              {errorMessage}
            </motion.p>
          ) : null}

          <p className="mt-6 text-center text-xs leading-relaxed text-stone-500 dark:text-zinc-500">
            By continuing, you agree to Curator&apos;s terms and privacy policy.
          </p>
        </motion.div>
      </main>
    </div>
  );
}