import { ImageResponse } from '@vercel/og';
import { getPostBySlug } from '@/lib/blog';

export const runtime = 'nodejs';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  const title = post?.title ?? 'Blog';
  const description = post?.description ?? '';
  const author = post?.author ?? 'Curator Team';
  const date = post
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #1c1917 0%, #27272a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: '#1c1917',
            }}
          >
            C
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#e7e5e4' }}>
            Curator Blog
          </span>
        </div>

        {/* Middle: title + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#fafaf9',
              maxWidth: '90%',
            }}
          >
            {title.length > 80 ? `${title.slice(0, 77)}...` : title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 22,
                color: '#a8a29e',
                lineHeight: 1.4,
                maxWidth: '85%',
              }}
            >
              {description.length > 140
                ? `${description.slice(0, 137)}...`
                : description}
            </div>
          )}
        </div>

        {/* Bottom: author + date */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18, color: '#78716c' }}>{author}</span>
          <span style={{ fontSize: 18, color: '#78716c' }}>{date}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
