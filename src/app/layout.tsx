import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Daylog', template: '%s · Daylog' },
  description: 'Daylog — a life tracker that turns every log into XP, streaks and a calmer day.',
  applicationName: 'Daylog',
  appleWebApp: { capable: true, title: 'Daylog', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: '#0E1014',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
