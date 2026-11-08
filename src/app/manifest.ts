import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Daylog — Life Tracker',
    short_name: 'Daylog',
    description: 'Tasks, notes, calendar and voice capture that turn every log into XP and streaks.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1014',
    theme_color: '#0E1014',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    shortcuts: [
      { name: 'Just say it', url: '/voice' },
      { name: 'Tasks', url: '/tasks' }
    ]
  };
}
