/**
 * PWA web app manifest.
 *
 * When this file exists, Next.js auto-serves the manifest at
 * `/manifest.webmanifest` and links it from every page. Combined with the
 * service worker registered in components/RegisterServiceWorker.tsx, this
 * makes Stride installable as a standalone desktop app from Chrome/Edge.
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stride',
    short_name: 'Stride',
    description:
      'Multi-agent orchestration for project managers. Reclaim four hours of your day.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#2C4A35',
    background_color: '#F7F5F1',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Run morning brief',
        short_name: 'Brief',
        description: 'Generate today\'s morning brief',
        url: '/brief',
      },
      {
        name: 'Meeting mode',
        short_name: 'Meeting',
        description: 'Turn a meeting transcript into action items + summaries',
        url: '/meeting',
      },
      {
        name: 'Status tracker',
        short_name: 'Tracker',
        description: 'Persistent project status view',
        url: '/tracker',
      },
      {
        name: 'Notes',
        short_name: 'Notes',
        description: 'Meeting notes',
        url: '/notes',
      },
    ],
  };
}
