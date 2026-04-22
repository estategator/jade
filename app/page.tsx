"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion, MotionConfig, AnimatePresence, type Variants } from "framer-motion";
import {
  PiCheckCircleDuotone,
  PiArrowRightDuotone,
  PiSparkleDuotone,
  PiLightningDuotone,
  PiChartBarDuotone,
  PiCreditCardDuotone,
  PiUsersDuotone,
  PiEnvelopeDuotone,
  PiSpinnerDuotone,
  PiQuotesDuotone,
  PiCameraDuotone,
  PiPackageDuotone
} from "react-icons/pi";
import Image from "next/image";
import { subscribeUser } from "@/app/actions";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

// --- Hooks ---

type WaitlistStatus = "idle" | "loading" | "success" | "error";

function useWaitlistForm(source: string) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("email", email);
    formData.append("source", source);

    const result = await subscribeUser(formData);

    if (result.success) {
      setStatus("success");
      setEmail("");
    } else {
      setStatus("error");
      setErrorMessage(result.error || "Something went wrong");
    }
  };

  return { email, setEmail, status, errorMessage, handleSubmit };
}

// --- Components ---

// Navbar component is now in components/navbar.tsx

// --- Hero motion helpers ---

const heroContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 140, damping: 20, mass: 0.6 }
  }
};

// Phone demo flow: open camera -> aim -> scan -> result -> add -> added -> loop
type PhoneFlowPhase = "opening" | "aiming" | "scanning" | "result" | "adding" | "added";

const PHONE_FLOW: { phase: PhoneFlowPhase; duration: number }[] = [
  { phase: "opening", duration: 1100 },
  { phase: "aiming", duration: 1500 },
  { phase: "scanning", duration: 2400 },
  { phase: "result", duration: 2200 },
  { phase: "adding", duration: 1200 },
  { phase: "added", duration: 1400 }
];

type PhoneItem = {
  image: string;
  name: string;
  category: string;
  price: string;
  comps: string;
};

const PHONE_ITEMS: PhoneItem[] = [
  {
    image:
      "https://images.unsplash.com/photo-1618674622469-d7fd1a22fcf8?q=80&w=986&auto=format&fit=crop",
    name: "Vintage Ceramic Vase",
    category: "Mid-century · Decorative",
    price: "$145",
    comps: "1,284 comps"
  },
  {
    image:
      "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?q=80&w=986&auto=format&fit=crop",
    name: "Hand-Painted Tea Set",
    category: "Porcelain · Asian export",
    price: "$320",
    comps: "842 comps"
  },
  {
    image:
      "https://images.unsplash.com/photo-1519558260268-cde7e03a0152?q=80&w=986&auto=format&fit=crop",
    name: "Stoneware Serving Bowl",
    category: "Studio pottery · Signed",
    price: "$78",
    comps: "516 comps"
  },
  {
    image:
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=986&auto=format&fit=crop",
    name: "Vintage Film Camera",
    category: "35mm · Working",
    price: "$210",
    comps: "2,104 comps"
  },
  {
    image:
      "https://images.unsplash.com/photo-1593078165899-c7d2ac0d6aea?q=80&w=986&auto=format&fit=crop",
    name: "Tube Radio",
    category: "Mid-century electronics",
    price: "$185",
    comps: "673 comps"
  }
];

function usePhoneFlow(): { phase: PhoneFlowPhase; item: PhoneItem } {
  const [index, setIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => {
      setIndex((i) => {
        const next = (i + 1) % PHONE_FLOW.length;
        if (next === 0) {
          // Advance to the next item at the start of a fresh loop.
          setItemIndex((n) => (n + 1) % PHONE_ITEMS.length);
        }
        return next;
      });
    }, PHONE_FLOW[index].duration);
    return () => clearTimeout(id);
  }, [index, reduce]);

  const item = PHONE_ITEMS[itemIndex];
  // In reduced-motion mode, park on the "result" frame so users see the key moment.
  return { phase: reduce ? "result" : PHONE_FLOW[index].phase, item };
}

function useMouseParallax(strength = 20) {  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.8 });
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    // Only enable on fine pointers (mouse); skip touch devices.
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;

    const handle = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = (e.clientX - cx) / rect.width; // -0.5..0.5
      const ny = (e.clientY - cy) / rect.height;
      x.set(nx * strength);
      y.set(ny * strength);
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, [reduce, strength, x, y]);

  return { ref, x: sx, y: sy };
}

const Hero = () => {
  const { email, setEmail, status, errorMessage, handleSubmit } = useWaitlistForm("hero_section");
  const reduce = useReducedMotion();
  const { ref: heroRef } = useMouseParallax(30);
  const { x: parallaxSoftX, y: parallaxSoftY } = useMouseParallax(14);
  const { phase, item } = usePhoneFlow();
  const photoVisible = phase !== "opening";
  const cameraChromeVisible = phase === "aiming" || phase === "scanning";
  const sheetVisible = phase === "result" || phase === "adding" || phase === "added";

  return (
    <MotionConfig reducedMotion="user">
    <section ref={heroRef} className="relative pt-28 pb-24 lg:pt-36 lg:pb-32 overflow-hidden isolate">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Left Column - Text Content (staggered) */}
          <motion.div
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            {/* Announcement pill */}
            <motion.div variants={heroItemVariants} className="mb-7 flex justify-center lg:justify-start">
              <a
                href="#waitlist"
                className="group inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-stone-200 dark:border-zinc-800 pl-1 pr-4 py-1 text-xs sm:text-sm text-stone-600 dark:text-zinc-300 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  <PiSparkleDuotone className="w-3 h-3" aria-hidden="true" />
                  Beta
                </span>
                <span className="font-medium">Early access opens May 15</span>
                <PiArrowRightDuotone className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </a>
            </motion.div>

            <motion.h1 variants={heroItemVariants} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display leading-[1.02] text-balance">
              Price it. List it. Sell it.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-[length:200%_auto] animate-[hero-gradient_8s_ease_infinite]">
                Before the next customer walks in.
              </span>
            </motion.h1>

            <motion.p variants={heroItemVariants} className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0 font-body text-balance">
              The AI pricing and inventory assistant for estate sale pros, antique dealers, and auction teams. Snap, price, sell—without breaking stride.
            </motion.p>

            <motion.form
              id="waitlist"
              variants={heroItemVariants}
              onSubmit={handleSubmit}
              className="max-w-md mx-auto lg:mx-0 flex flex-col sm:flex-row gap-2 p-1.5 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-lg shadow-indigo-500/5"
            >
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <PiEnvelopeDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="block w-full pl-10 pr-3 py-3 bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl text-white bg-stone-900 dark:bg-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950 focus:ring-stone-900 dark:focus:ring-white disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {status === "loading" ? (
                  <PiSpinnerDuotone className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : status === "success" ? (
                  <><PiCheckCircleDuotone className="w-4 h-4" aria-hidden="true" /> Added</>
                ) : (
                  <>Get early access <PiArrowRightDuotone className="h-4 w-4" aria-hidden="true" /></>
                )}
              </button>
            </motion.form>
            {status === "success" && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                You&apos;re on the list. We&apos;ll email you when early access opens.
              </motion.p>
            )}
            {status === "error" && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </motion.p>
            )}

            {/* Trust bullets (compact inline row) */}
            <motion.ul variants={heroItemVariants} className="mt-6 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-sm text-stone-500 dark:text-zinc-500">
              <li className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />Confident prices in seconds</li>
              <li className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />One catalog, everywhere</li>
              <li className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />Cards without the line</li>
            </motion.ul>
          </motion.div>

          {/* Right Column - App Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.8, delay: 0.35 }}
            style={{ x: parallaxSoftX, y: parallaxSoftY }}
            className="relative flex justify-center lg:justify-end"
          >
            {/* Phone Mockup */}
            <div
              className="relative mx-auto border-zinc-800 bg-zinc-900 border-[14px] rounded-[2.5rem] h-[580px] w-[280px] shadow-2xl"
            >
              <div className="h-[32px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
              <div className="h-[46px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
              <div className="h-[46px] w-[3px] bg-zinc-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
              <div className="h-[64px] w-[3px] bg-zinc-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
              <div className="rounded-[2rem] overflow-hidden w-full h-full bg-zinc-900 relative">
                {/* Base: item photo — revealed once camera finishes opening */}
                <AnimatePresence mode="wait">
                  {photoVisible && (
                    <motion.div
                      key={`photo-${item.image}`}
                      initial={{ opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url("${item.image}")` }}
                      />
                      <div className="absolute inset-0 bg-black/30" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 1: Opening camera — app-launch screen */}
                <AnimatePresence>
                  {phase === "opening" && (
                    <motion.div
                      key="opening"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 1.08 }}
                      transition={{ duration: 0.35, ease: "easeIn" }}
                      className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex flex-col items-center justify-center text-white"
                    >
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 220, damping: 16 }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand-primary)] to-violet-600 flex items-center justify-center shadow-2xl shadow-[var(--color-brand-primary)]/40 mb-4"
                      >
                        <PiCameraDuotone className="w-8 h-8 text-white" aria-hidden="true" />
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="text-sm font-medium text-white"
                      >
                        Opening camera
                      </motion.p>
                      <PiSpinnerDuotone className="w-4 h-4 animate-spin mt-3 text-zinc-400" aria-hidden="true" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phases 2-3: Camera chrome (status pill + corner brackets) */}
                <AnimatePresence>
                  {cameraChromeVisible && (
                    <motion.div
                      key="chrome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      {/* Status pill */}
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5"
                      >
                        {phase === "aiming" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Point at item
                          </>
                        ) : (
                          <>
                            <PiSparkleDuotone className="w-3 h-3 text-[var(--color-brand-primary)]" aria-hidden="true" />
                            Analyzing…
                          </>
                        )}
                      </motion.div>

                      {/* Corner brackets */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="absolute top-16 left-8 right-8 bottom-24"
                      >
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[var(--color-brand-primary)] rounded-tl-md" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[var(--color-brand-primary)] rounded-tr-md" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[var(--color-brand-primary)] rounded-bl-md" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[var(--color-brand-primary)] rounded-br-md" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 2: Aiming — shutter button */}
                <AnimatePresence>
                  {phase === "aiming" && (
                    <motion.div
                      key="shutter"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 220, damping: 22 }}
                      className="absolute bottom-6 left-0 right-0 flex justify-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                        className="w-14 h-14 rounded-full border-4 border-white/90 bg-white/20 backdrop-blur-sm"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 3: Scanning — line + glow band sweep */}
                <AnimatePresence>
                  {phase === "scanning" && (
                    <motion.div key="scan" className="absolute inset-0 pointer-events-none" exit={{ opacity: 0 }}>
                      <motion.div
                        initial={{ y: 0 }}
                        animate={{ y: 360, opacity: [0.6, 1, 1, 0.6] }}
                        transition={{ duration: 2.2, ease: "easeInOut" }}
                        className="absolute top-16 left-8 right-8 h-0.5 bg-[var(--color-brand-primary)] shadow-[0_0_18px_var(--color-brand-primary)]"
                      />
                      <motion.div
                        initial={{ y: -32 }}
                        animate={{ y: 360 }}
                        transition={{ duration: 2.2, ease: "easeInOut" }}
                        className="absolute top-16 left-8 right-8 h-16 bg-gradient-to-b from-transparent via-[var(--color-brand-primary)]/30 to-transparent blur-md"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phases 4-6: Result sheet (price card + action button) */}
                <AnimatePresence>
                  {sheetVisible && (
                    <motion.div
                      key="sheet"
                      initial={{ y: 220, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 220, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 180, damping: 26 }}
                      className="absolute bottom-0 left-0 right-0 p-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl border-t border-zinc-200/50 dark:border-zinc-700/50"
                    >
                      <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{item.category}</p>
                        </div>
                        <motion.p
                          key={item.price}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
                          className="text-xl font-bold text-zinc-900 dark:text-white"
                        >
                          {item.price}
                        </motion.p>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 }}
                        className="flex items-center gap-1.5 mb-4"
                      >
                        <PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          High confidence · {item.comps}
                        </span>
                      </motion.div>

                      <motion.div
                        animate={phase === "adding" ? { scale: 0.97 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        className={
                          "w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors " +
                          (phase === "added"
                            ? "bg-emerald-500 text-white"
                            : "bg-[var(--color-brand-primary)] text-white")
                        }
                      >
                        {phase === "result" && (
                          <>
                            Add to catalog
                            <PiArrowRightDuotone className="w-4 h-4" aria-hidden="true" />
                          </>
                        )}
                        {phase === "adding" && (
                          <>
                            <PiSpinnerDuotone className="w-4 h-4 animate-spin" aria-hidden="true" />
                            Adding…
                          </>
                        )}
                        {phase === "added" && (
                          <>
                            <PiCheckCircleDuotone className="w-4 h-4" aria-hidden="true" />
                            Added to catalog
                          </>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phase 6: Added — small package burst behind the sheet */}
                <AnimatePresence>
                  {phase === "added" && (
                    <motion.div
                      key="added-fx"
                      initial={{ opacity: 0, scale: 0.6, y: 40 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="absolute top-1/3 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl bg-emerald-500/15 backdrop-blur-md flex items-center justify-center border border-emerald-500/30"
                    >
                      <PiPackageDuotone className="w-8 h-8 text-emerald-500" aria-hidden="true" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Floating Stats Card — modern glass */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.7 }}
              className="absolute -left-6 top-20 hidden sm:block"
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl shadow-stone-900/5 dark:shadow-black/40 border border-stone-200/80 dark:border-zinc-800/80 min-w-[180px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-lg flex items-center justify-center">
                    <PiChartBarDuotone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-zinc-500 font-medium">Items scanned</p>
                    <p className="text-lg font-bold text-stone-900 dark:text-white font-display tabular-nums">1,247</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Floating Revenue Card — modern glass */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.85 }}
              className="absolute -right-6 bottom-24 hidden sm:block"
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl shadow-stone-900/5 dark:shadow-black/40 border border-stone-200/80 dark:border-zinc-800/80 min-w-[180px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-lg flex items-center justify-center">
                    <PiLightningDuotone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-zinc-500 font-medium">Catalog value</p>
                    <p className="text-lg font-bold text-stone-900 dark:text-white font-display tabular-nums">$42,850</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
    </MotionConfig>
  );
};

const Features = () => {
  const features = [
    {
      title: "AI-powered valuations",
      description: "Trained on auction records, completed eBay sales, and dealer comps—so you can trust the number without cracking a reference book.",
      icon: <PiSparkleDuotone className="w-5 h-5" aria-hidden="true" />,
      highlight: "3-second pricing"
    },
    {
      title: "Smart inventory",
      description: "Scan once, list everywhere. Curator categorizes and tags as you go, generating price tags, buyer catalogs, and lot sheets from one source of truth.",
      icon: <PiChartBarDuotone className="w-5 h-5" aria-hidden="true" />,
      highlight: "Auto-categorization"
    },
    {
      title: "Instant payments",
      description: "Take cards at the table, send professional invoices, and reconcile payouts automatically with the processor you already use.",
      icon: <PiCreditCardDuotone className="w-5 h-5" aria-hidden="true" />,
      highlight: "Stripe · Square · Clover"
    },
    {
      title: "Team collaboration",
      description: "Staff, pickers, and consignors on the same catalog in real time—with roles and permissions keeping everyone in their lane.",
      icon: <PiUsersDuotone className="w-5 h-5" aria-hidden="true" />,
      highlight: "Multi-user access"
    }
  ];

  return (
    <section className="relative py-28 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em] mb-5">
            <span className="h-px w-8 bg-indigo-600/60 dark:bg-indigo-400/60" />
            Platform
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-5 font-display">
            Built for the way the trade actually works.
          </h2>
          <p className="text-lg text-stone-600 dark:text-zinc-400 font-body leading-relaxed">
            From the driveway sale to the auction block to the mall booth—Curator handles the parts you dread so you can do the part you love.
          </p>
        </div>

        {/* Feature grid — modern bordered matrix */}
        <div className="grid md:grid-cols-2 gap-px rounded-3xl overflow-hidden bg-stone-200/70 dark:bg-zinc-800/60 ring-1 ring-stone-200/70 dark:ring-zinc-800/60">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.06, duration: 0.5, ease: "easeOut" }}
              className="group relative bg-white dark:bg-zinc-950 p-8 lg:p-10 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-900"
            >
              {/* Index number */}
              <span className="absolute top-6 right-6 text-xs font-mono text-stone-300 dark:text-zinc-700 tracking-widest">
                0{index + 1}
              </span>

              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-500/20 mb-6 transition-transform group-hover:-translate-y-0.5">
                {feature.icon}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-semibold text-stone-900 dark:text-white font-display tracking-tight">
                  {feature.title}
                </h3>
              </div>

              <p className="text-[15px] text-stone-600 dark:text-zinc-400 leading-relaxed font-body mb-5 max-w-md">
                {feature.description}
              </p>

              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-zinc-500">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                {feature.highlight}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LogoStrip = () => {
  return (
    <section className="relative border-y border-stone-200/70 dark:border-zinc-800/70 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <p className="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-[0.18em] lg:border-r lg:border-stone-200 lg:dark:border-zinc-800 lg:pr-12 shrink-0">
            Built on tools
            <br className="hidden lg:block" /> you already trust
          </p>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6 lg:gap-x-14 text-stone-400 dark:text-zinc-600">
            {/* AWS */}
            <svg className="h-8 w-auto transition-colors hover:text-stone-700 dark:hover:text-zinc-300" viewBox="0 0 24 24" fill="currentColor" aria-label="AWS">
              <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z" />
              <path d="M21.725 15.251c-2.455 1.813-6.019 2.779-9.085 2.779-4.299 0-8.17-1.59-11.098-4.235-.23-.207-.024-.49.251-.328 3.161 1.838 7.072 2.947 11.114 2.947 2.725 0 5.722-.566 8.48-1.74.415-.175.766.272.338.577z" />
              <path d="M22.693 14.135c-.313-.4-2.07-.191-2.862-.096-.24.032-.279-.184-.063-.335 1.406-.982 3.709-.702 3.975-.375.264.335-.072 2.63-1.39 3.727-.199.167-.391.08-.303-.144.295-.726.95-2.373.643-2.777z" />
            </svg>
            {/* Stripe */}
            <div className="flex items-center gap-2 transition-colors hover:text-stone-700 dark:hover:text-zinc-300">
              <svg className="h-6 w-auto" viewBox="0 0 24 24" fill="currentColor" aria-label="Stripe">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
              </svg>
              <span className="font-semibold tracking-tight">Stripe</span>
            </div>
            {/* OpenAI */}
            <div className="flex items-center gap-2 transition-colors hover:text-stone-700 dark:hover:text-zinc-300">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-label="OpenAI">
                <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
              </svg>
              <span className="font-semibold tracking-tight">OpenAI</span>
            </div>
            {/* Gemini */}
            <div className="flex items-center gap-2 transition-colors hover:text-stone-700 dark:hover:text-zinc-300">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-label="Gemini">
                <path d="M12,2 L12,2 C12,7.52 16.48,12 22,12 L22,12 L22,12 C16.48,12 12,16.48 12,22 L12,22 L12,22 C12,16.48 7.52,12 2,12 L2,12 L2,12 C7.52,12 12,7.52 12,2 L12,2 Z" />
              </svg>
              <span className="font-semibold tracking-tight">Gemini</span>
            </div>
            {/* Square + Clover as text badges */}
            <span className="text-sm font-semibold tracking-tight transition-colors hover:text-stone-700 dark:hover:text-zinc-300">Square</span>
            <span className="text-sm font-semibold tracking-tight transition-colors hover:text-stone-700 dark:hover:text-zinc-300">Clover</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const SocialProof = () => {
  const stats = [
    { value: "~3s", label: "avg time to a confident price" },
    { value: "500+", label: "lots cataloged in pilot sales" },
    { value: "3", label: "card processors natively supported" },
    { value: "Beta", label: "partners shaping v1" }
  ];

  const testimonial = {
    quote:
      "We used to spend the first morning of every sale arguing about prices. With Curator, we staged the whole house in an afternoon and opened the doors with confidence.",
    name: "[Name]",
    role: "Estate Liquidator",
    location: "[City]"
  };

  return (
    <section className="relative py-28 sm:py-32 bg-stone-50 dark:bg-zinc-900/40 border-y border-stone-200/70 dark:border-zinc-800/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-start">
          {/* Left: feature testimonial */}
          <div className="lg:col-span-3">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em] mb-5">
              <span className="h-px w-8 bg-indigo-600/60 dark:bg-indigo-400/60" />
              From the floor
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-8 font-display">
              Built with the people doing the work.
            </h2>

            <motion.figure
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative p-8 lg:p-10 rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm"
            >
              <PiQuotesDuotone className="w-9 h-9 text-indigo-500/50 dark:text-indigo-400/50 mb-5" aria-hidden="true" />
              <blockquote className="text-xl lg:text-2xl text-stone-800 dark:text-zinc-200 leading-snug font-display tracking-tight">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-8 pt-6 border-t border-stone-200 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{testimonial.name}</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">{testimonial.role} · {testimonial.location}</p>
                </div>
              </figcaption>
            </motion.figure>

            {/* Pilot partner strip */}
            <div className="mt-10 flex items-center gap-5">
              <p className="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-[0.18em] shrink-0">
                Pilot partner
              </p>
              <div className="h-px flex-1 bg-stone-200 dark:bg-zinc-800" />
              <Image
                src="/partners/clover-logo-sideways.webp"
                alt="Clover Collections LLC"
                width={180}
                height={60}
                className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity dark:invert dark:brightness-90"
              />
            </div>
          </div>

          {/* Right: stat rail */}
          <div className="lg:col-span-2 lg:pl-8 lg:border-l lg:border-stone-200/70 lg:dark:border-zinc-800/70">
            <p className="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-[0.18em] mb-8">
              By the numbers
            </p>
            <div className="space-y-6">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="flex items-baseline gap-5 pb-6 border-b border-stone-200/70 dark:border-zinc-800/70 last:border-0 last:pb-0"
                >
                  <p className="text-4xl sm:text-5xl font-bold text-stone-900 dark:text-white font-display tracking-tight tabular-nums shrink-0 min-w-[4.5rem]">
                    {stat.value}
                  </p>
                  <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CTASection = () => {
  const { email, setEmail, status, errorMessage, handleSubmit } = useWaitlistForm("cta_section");

  return (
    <section className="relative py-28 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-zinc-950 text-white p-10 sm:p-16 lg:p-20 ring-1 ring-white/10"
        >
          {/* Decorative background layers */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(99,102,241,0.45),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_100%,rgba(139,92,246,0.35),transparent_65%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_60%_100%,rgba(16,185,129,0.2),transparent_65%)]" />
            <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />
          </div>

          <div className="relative grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-medium text-white/90 uppercase tracking-[0.18em] mb-6">
                <PiLightningDuotone className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
                Limited early access
              </span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display mb-6 text-balance">
                Stop pricing from memory.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300">Start selling with confidence.</span>
              </h2>
              <p className="text-lg text-zinc-300 leading-relaxed font-body max-w-xl">
                Be first in line when Curator opens. Founding members get lifetime pricing and a direct line to the team building it.
              </p>
            </div>

            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="relative">
                  <PiEnvelopeDuotone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" aria-hidden="true" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your work email"
                    className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-base backdrop-blur-sm transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading" || status === "success"}
                  className="inline-flex items-center justify-center px-6 py-4 bg-white text-zinc-900 hover:bg-zinc-100 text-base font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-white/60 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  {status === "loading" ? (
                    <PiSpinnerDuotone className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : status === "success" ? (
                    <><PiCheckCircleDuotone className="w-5 h-5 mr-2 text-emerald-600" aria-hidden="true" />You&apos;re in</>
                  ) : (
                    <>Get early access<PiArrowRightDuotone className="ml-2 h-5 w-5" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              {status === "success" && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-sm text-emerald-300 font-medium"
                >
                  You&apos;re in. We&apos;ll only email when it matters.
                </motion.p>
              )}
              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-sm text-red-300 font-medium"
                >
                  {errorMessage}
                </motion.p>
              )}

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />Free to join</span>
                <span className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />No card required</span>
                <span className="flex items-center gap-1.5"><PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />Cancel anytime</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};





export default function Home() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-950 text-stone-900 dark:text-white font-body selection:bg-indigo-200 dark:selection:bg-indigo-900/40 overflow-x-hidden">
      {/* ── Modern background system ───────────────────────── */}
      {/* Top atmospheric mesh — localized to hero zone, softly fades out */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[980px] -z-10"
      >
        {/* Base tonal wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950" />
        {/* Brand aurora */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.18),transparent_65%)] dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.28),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.14),transparent_60%)] dark:bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.10),transparent_60%)] dark:bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.16),transparent_60%)]" />
        {/* Hairline grid — masked to fade at edges */}
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(68,64,60,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(68,64,60,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(244,244,245,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,244,245,0.05)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_30%,transparent_80%)]" />
      </div>

      <div className="relative z-10">
        <Navbar glassEffect hideOnScroll />
        <main>
          <Hero />
          <LogoStrip />
          <Features />
          <SocialProof />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
