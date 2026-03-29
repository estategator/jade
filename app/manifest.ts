import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Curator AI — Estate Sales Management',
    short_name: 'Curator',
    description: 'AI-powered estate sales management platform. Price items instantly, manage inventory, and close sales faster.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#4f46e5',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/android-chrome-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/android-chrome-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
