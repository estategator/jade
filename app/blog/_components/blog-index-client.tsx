"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  PiArrowRightDuotone,
  PiCalendarDuotone,
  PiSparkleDuotone,
  PiTagDuotone,
  PiUserDuotone,
} from "react-icons/pi";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import type { BlogPostMeta } from "@/lib/blog";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BlogIndexClient({ posts }: Readonly<{ posts: BlogPostMeta[] }>) {
  const [featured, ...rest] = posts;

  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-950 text-stone-900 dark:text-white font-body selection:bg-indigo-200 dark:selection:bg-indigo-900/40 overflow-x-hidden">
      {/* ── Modern background system ───────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.18),transparent_65%)] dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.28),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.14),transparent_60%)] dark:bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.10),transparent_60%)] dark:bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.16),transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(68,64,60,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(68,64,60,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(244,244,245,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,244,245,0.05)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_30%,transparent_80%)]" />
      </div>

      <div className="relative z-10">
        <Navbar launchBadge="Now in early access" />

        <main>
          {/* ── Hero ─────────────────────────────────────── */}
          <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 flex justify-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-stone-200 dark:border-zinc-800 pl-1 pr-4 py-1 text-xs sm:text-sm text-stone-600 dark:text-zinc-300 shadow-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                    <PiSparkleDuotone className="w-3 h-3" aria-hidden="true" />
                    Blog
                  </span>
                  <span className="font-medium">Tips & playbooks from the field</span>
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display leading-[1.02] text-balance"
              >
                Insights for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-[length:200%_auto] animate-[hero-gradient_8s_ease_infinite]">
                  estate sale professionals.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 leading-relaxed font-body text-balance"
              >
                Pricing strategies, merchandising playbooks, and the operating tactics behind modern estate sales and antique mall operations.
              </motion.p>
            </div>
          </section>

          {/* ── Posts ─────────────────────────────────────── */}
          <section className="relative pb-28 sm:pb-32">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              {posts.length === 0 ? (
                <p className="text-center text-stone-500 dark:text-zinc-500">
                  No posts yet — check back soon!
                </p>
              ) : (
                <>
                  {/* Featured post */}
                  {featured && (
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="group mb-12 sm:mb-16"
                    >
                      <Link
                        href={`/blog/${featured.slug}`}
                        className="block rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 sm:p-10 lg:p-12 transition-all hover:border-stone-300 dark:hover:border-zinc-700 hover:shadow-lg"
                      >
                        <div className="flex items-center gap-2 mb-5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                            <PiSparkleDuotone className="w-3 h-3" aria-hidden="true" />
                            Latest
                          </span>
                          <span className="text-xs text-stone-500 dark:text-zinc-500 inline-flex items-center gap-1">
                            <PiCalendarDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDate(featured.publishedAt)}
                          </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white font-display leading-[1.05] text-balance group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {featured.title}
                        </h2>

                        <p className="mt-5 text-lg text-stone-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                          {featured.description}
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500 dark:text-zinc-500">
                          <span className="inline-flex items-center gap-1.5">
                            <PiUserDuotone className="h-4 w-4" aria-hidden="true" />
                            {featured.author}
                          </span>
                          {featured.tags.length > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <PiTagDuotone className="h-4 w-4" aria-hidden="true" />
                              {featured.tags.slice(0, 3).join(", ")}
                            </span>
                          )}
                        </div>

                        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-2.5 transition-all">
                          Read article
                          <PiArrowRightDuotone className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </Link>
                    </motion.article>
                  )}

                  {/* Eyebrow */}
                  {rest.length > 0 && (
                    <div className="mb-8 flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em]">
                        <span className="h-px w-8 bg-indigo-600/60 dark:bg-indigo-400/60" />
                        More articles
                      </span>
                    </div>
                  )}

                  {/* Rest */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {rest.map((post, i) => (
                      <motion.article
                        key={post.slug}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className="group"
                      >
                        <Link
                          href={`/blog/${post.slug}`}
                          className="flex flex-col h-full rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-7 transition-all hover:border-stone-300 dark:hover:border-zinc-700 hover:shadow-md"
                        >
                          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500 mb-4">
                            <span className="inline-flex items-center gap-1">
                              <PiCalendarDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDate(post.publishedAt)}
                            </span>
                            <span className="text-stone-300 dark:text-zinc-700">•</span>
                            <span className="inline-flex items-center gap-1">
                              <PiUserDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                              {post.author}
                            </span>
                          </div>

                          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-display tracking-tight leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-balance">
                            {post.title}
                          </h3>

                          <p className="mt-3 text-stone-600 dark:text-zinc-400 leading-relaxed line-clamp-3 flex-1">
                            {post.description}
                          </p>

                          {post.tags.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-1.5">
                              {post.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full bg-stone-100 dark:bg-zinc-900 ring-1 ring-stone-200 dark:ring-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 dark:text-zinc-400"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-2.5 transition-all">
                            Read more
                            <PiArrowRightDuotone className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </Link>
                      </motion.article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
