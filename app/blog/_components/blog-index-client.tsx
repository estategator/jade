"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, User, Tag } from "lucide-react";
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
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-body selection:bg-stone-200 dark:selection:bg-zinc-800">
      <Navbar launchBadge="Launching Feb 2026" />
      <main>
        {/* Hero */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-white font-display">
              Blog
            </h1>
            <p className="mt-4 text-lg text-stone-600 dark:text-zinc-400">
              Tips, guides, and insights for estate sale professionals.
            </p>
          </motion.div>
        </section>

        {/* Posts grid */}
        <section className="pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {posts.length === 0 ? (
              <p className="text-center text-stone-500 dark:text-zinc-500">
                No posts yet — check back soon!
              </p>
            ) : (
              <div className="grid gap-8">
                {posts.map((post, i) => (
                  <motion.article
                    key={post.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 transition-shadow hover:shadow-lg"
                  >
                    <Link href={`/blog/${post.slug}`} className="block">
                      <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white font-display group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {post.title}
                      </h2>
                      <p className="mt-3 text-stone-600 dark:text-zinc-400 line-clamp-3">
                        {post.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(post.publishedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {post.author}
                        </span>
                        {post.tags.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            {post.tags.slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>

                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">
                        Read more <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
