import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

// ── Types ──

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  tags: string[];
  coverImage?: string;
  body: string;
};

export type BlogPostMeta = Omit<BlogPost, 'body'>;

// ── Content directory ──

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

// ── Frontmatter parser ──

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return { data, content: match[2] };
}

// ── Loaders ──

function loadPost(filePath: string): BlogPost | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = parseFrontmatter(raw);

  if (!data.title || !data.description || !data.publishedAt || !data.author) {
    return null;
  }
  if (data.published === 'false') return null;

  const slug = path.basename(filePath, '.md');

  return {
    slug,
    title: data.title,
    description: data.description,
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt,
    author: data.author,
    tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
    coverImage: data.coverImage,
    body: content,
  };
}

export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => loadPost(path.join(CONTENT_DIR, f)))
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map(({ body: _body, ...meta }) => meta); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return loadPost(filePath);
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const post = loadPost(path.join(CONTENT_DIR, f));
      return post?.slug;
    })
    .filter((s): s is string => !!s);
}

// ── Markdown rendering ──

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}
