import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// La langue vient du cookie « langue » (posé par le bouton de langue), sinon de la langue du navigateur.
export default getRequestConfig(async () => {
  const choix = (await cookies()).get('langue')?.value;
  let locale: 'fr' | 'ar';
  if (choix === 'fr' || choix === 'ar') locale = choix;
  else locale = ((await headers()).get('accept-language') ?? '').trim().toLowerCase().startsWith('ar') ? 'ar' : 'fr';
  return { locale, timeZone: 'Africa/Algiers', messages: (await import(`../../messages/${locale}.json`)).default };
});
