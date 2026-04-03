import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";
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
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-body selection:bg-stone-200 dark:selection:bg-zinc-800">
      <Navbar launchBadge="Launching Feb 2026" />
      <main className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
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
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 dark:text-white font-display">
              {post.title}
            </h1>
            <p className="mt-4 text-lg text-stone-600 dark:text-zinc-400">
              {post.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-zinc-500">
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
          <div className="mt-16 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <h2 className="text-xl font-bold text-stone-900 dark:text-white font-display">
              Ready to modernize your estate sales?
            </h2>
            <p className="mt-2 text-stone-600 dark:text-zinc-400">
              Join thousands of professionals on the waitlist.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Join the waitlist
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
