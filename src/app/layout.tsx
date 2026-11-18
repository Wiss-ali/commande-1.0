import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('commun');
  return { title: t('nomApp'), description: t('description'), robots: { index: false, follow: false }, icons: { icon: '/icones/icone.svg', apple: '/icones/icone-180.png' } };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1c' },
  ],
};

export default async function Racine({ children }: { children: React.ReactNode }) {
  const langue = await getLocale();
  const theme = (await cookies()).get('theme')?.value;
  return (
    <html lang={langue} dir={langue === 'ar' ? 'rtl' : 'ltr'} data-theme={theme === 'clair' || theme === 'sombre' ? theme : undefined}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
