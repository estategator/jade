import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PiArrowLeftDuotone,
  PiArrowRightDuotone,
  PiCalendarDuotone,
  PiSparkleDuotone,
  PiTagDuotone,
  PiUserDuotone,
} from "react-icons/pi";
import { getPostBySlug, getAllSlugs, renderMarkdown } from "@/lib/blog";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd, articleJsonLd } from "@/lib/seo";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

// ── Static params for pre-rendering ──

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// ── Per-post metadata with OG ──

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };

  const url = `${SITE_URL}/blog/${slug}`;
  const ogImageUrl = `${SITE_URL}/blog/${slug}/opengraph-image`;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: post.publishedAt,
      ...(post.updatedAt ? { modifiedTime: post.updatedAt } : {}),
      authors: [post.author],
      tags: post.tags,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImageUrl],
    },
  };
}

// ── Helpers ──

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Page ──

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.body);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${slug}` },
  ]);

  const article = articleJsonLd({
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${slug}`,
    image: `${SITE_URL}/blog/${slug}/opengraph-image`,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    author: post.author,
    tags: post.tags,
  });

  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-950 text-stone-900 dark:text-white font-body selection:bg-indigo-200 dark:selection:bg-indigo-900/40 overflow-x-hidden">
      {/* ── Modern background system ───────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.18),transparent_65%)] dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.28),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.14),transparent_60%)] dark:bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.10),transparent_60%)] dark:bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.16),transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(68,64,60,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(68,64,60,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(244,244,245,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,244,245,0.05)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_30%,transparent_80%)]" />
      </div>

      <div className="relative z-10">
        <Navbar launchBadge="Launching Feb 2026" />
        <main className="pt-24 pb-24 sm:pt-28 sm:pb-28 px-4 sm:px-6 lg:px-8">
          <article className="max-w-3xl mx-auto">
            {/* Breadcrumb JSON-LD */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />
            {/* Article JSON-LD */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
            />

            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-10"
            >
              <PiArrowLeftDuotone className="h-4 w-4" aria-hidden="true" />
              Back to blog
            </Link>

            {/* Header */}
            <header className="mb-12">
              <div className="mb-5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  <PiSparkleDuotone className="w-3 h-3" aria-hidden="true" />
                  Article
                </span>
                <span className="text-xs text-stone-500 dark:text-zinc-500 inline-flex items-center gap-1">
                  <PiCalendarDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(post.publishedAt)}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white font-display leading-[1.05] text-balance">
                {post.title}
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-stone-600 dark:text-zinc-400 leading-relaxed text-balance">
                {post.description}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500 dark:text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <PiUserDuotone className="h-4 w-4" aria-hidden="true" />
                  {post.author}
                </span>
                {post.tags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <PiTagDuotone className="h-4 w-4" aria-hidden="true" />
                    {post.tags.join(", ")}
                  </span>
                )}
              </div>
            </header>

            {/* Article body */}
            <div
              className="prose prose-stone dark:prose-invert max-w-none
                prose-headings:font-display prose-headings:tracking-tight
                prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-stone-900 dark:prose-strong:text-white
                prose-code:bg-stone-100 dark:prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
                prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* CTA */}
            <div className="relative mt-20 overflow-hidden rounded-[2rem] bg-zinc-950 text-white p-10 sm:p-12 ring-1 ring-white/10">
              <div aria-hidden="true" className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(99,102,241,0.45),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_100%,rgba(139,92,246,0.35),transparent_65%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_60%_100%,rgba(16,185,129,0.2),transparent_65%)]" />
                <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />
              </div>

              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-medium text-white/90 uppercase tracking-[0.18em] mb-5">
                <PiSparkleDuotone className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
                Curator
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-display text-balance">
                Ready to modernize your estate sales?
              </h2>
              <p className="mt-3 text-zinc-300 leading-relaxed max-w-xl">
                Join thousands of professionals on the waitlist and be first to try Curator when we launch.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-white/60 transition-all shadow-lg"
              >
                Join the waitlist
                <PiArrowRightDuotone className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </main>
        <Footer />
      </div>
    </div>
  );
}
