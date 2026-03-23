"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  PiArrowRightDuotone,
  PiChartBarDuotone,
  PiDiamondDuotone,
  PiSpinnerDuotone,
  PiEnvelopeDuotone,
  PiPackageDuotone,
  PiShieldCheckDuotone,
  PiSparkleDuotone,
  PiTagDuotone,
  PiGoogleLogoDuotone,
  PiAppleLogoDuotone,
} from "react-icons/pi";
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

function OAuthButton({ provider, loadingProvider, onClick }: OAuthButtonProps) {
  const isLoading = loadingProvider === provider;
  const copy = provider === "google" ? "Continue with Google" : "Continue with Apple";
  const Icon = provider === "google" ? PiGoogleLogoDuotone : PiAppleLogoDuotone;

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
          <Icon className="h-5 w-5" />
        </span>
        <span className="block text-sm font-semibold">{copy}</span>
      </span>
      <span className="flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400">
        {isLoading ? "Redirecting" : "Sign in"}
        <PiArrowRightDuotone className={cn("h-4 w-4 transition-transform", !isLoading && "group-hover:translate-x-0.5")} />
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

  const features = [
    { icon: PiSparkleDuotone, label: "AI-powered pricing & cataloging" },
    { icon: PiChartBarDuotone, label: "Real-time sales analytics" },
    { icon: PiShieldCheckDuotone, label: "Secure inventory management" },
  ];

  return (
    <div className="flex min-h-screen font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
      {/* ── Left branded panel (lg+) ── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-indigo-600 dark:bg-indigo-700 lg:flex lg:flex-col lg:justify-between">
        {/* Gradient mesh overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_80%,rgba(99,102,241,0.35),transparent),radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(16,185,129,0.12),transparent)]" />

        {/* Subtle dot pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Decorative blurs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-indigo-400/30 blur-3xl" />
          <div className="absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-indigo-800/40 blur-3xl" />
          {/* Extra highlight for premium depth */}
          <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-1/4 translate-y-1/4 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        {/* Faint decorative icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <PiDiamondDuotone className="absolute right-8 top-10 h-20 w-20 rotate-12 text-white/[0.04]" />
          <PiTagDuotone className="absolute bottom-32 left-6 h-16 w-16 -rotate-12 text-white/[0.05]" />
          <PiPackageDuotone className="absolute bottom-12 right-16 h-14 w-14 rotate-6 text-white/[0.04]" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link href="/" className="mb-10 inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold text-indigo-600">
                C
              </div>
              <span className="text-xl font-bold text-white">Curator</span>
            </Link>

            <h2 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
              Estate sales,{" "}
              <span className="text-indigo-200">simplified.</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-indigo-100">
              The all-in-one platform that helps estate sale professionals
              catalog, price, and sell — powered by AI.
            </p>

            <ul className="mt-10 space-y-4">
              {features.map((f) => (
                <motion.li
                  key={f.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="flex items-center gap-3 text-sm font-medium text-indigo-100"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <f.icon className="h-4 w-4 text-white" />
                  </span>
                  {f.label}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        <div className="relative z-10 px-12 pb-8 xl:px-16">
          <p className="text-xs text-indigo-200/70">
            &copy; {new Date().getFullYear()} Curator. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="relative flex w-full flex-col items-center justify-center bg-stone-50 px-4 py-12 dark:bg-zinc-950 sm:px-6 lg:w-1/2 lg:px-12 xl:px-16">
        {/* Blurs — visible only on small screens where the left panel is hidden */}
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-[120%] rounded-full bg-indigo-500/10 blur-3xl mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute left-1/2 top-40 h-72 w-72 translate-x-[20%] rounded-full bg-emerald-500/10 blur-3xl mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-6 shadow-2xl shadow-stone-200/60 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30 sm:p-8"
        >
          {/* Logo link — only on small screens since the left panel has it on lg+ */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 lg:hidden"
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
                <PiEnvelopeDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
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
                <PiSpinnerDuotone className="h-4 w-4 animate-spin" />
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
      </div>
    </div>
  );
}