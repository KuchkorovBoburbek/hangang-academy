import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'HangangAcademy — Har kuni bir qadam',
  description: 'Koreys tilini lug‘at, grammatika va yozma mashqlar bilan o‘rganing.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
