// En-têtes de sécurité posés sur chaque page : politique CSP stricte avec un nonce par requête, HSTS, etc.
import { NextResponse, type NextRequest } from 'next/server';

/** « magasin-ali.mondomaine.dz » → « magasin-ali » ; rien pour le domaine principal ou un autre hôte. */
export function boutiqueDeHote(hote: string | null): string | null {
  const domaine = process.env.DOMAINE_BOUTIQUES;
  if (!domaine || !hote) return null;
  const h = hote.toLowerCase().replace(/:\d+$/, '');
  if (!h.endsWith(`.${domaine}`)) return null;
  const nom = h.slice(0, -domaine.length - 1);
  return /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(nom) && nom !== 'www' ? nom : null;
}

/**
 * Pixels publicitaires (Facebook, TikTok) : leur code, chargé par un script portant le nonce ('strict-dynamic'),
 * envoie ses mesures à ces adresses. Autorisées seulement sur les pages publiques des boutiques, jamais dans
 * l'espace de gestion ; rien n'est chargé tant que le commerçant n'a pas activé un pixel.
 */
const MESURE_PUB = 'https://www.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://analytics-ipv6.tiktok.com';

export function proxy(requete: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  const https = (process.env.URL_APP ?? '').startsWith('https://');
  const sousDomaine = boutiqueDeHote(requete.headers.get('host'));
  const pagePublique = !!sousDomaine || requete.nextUrl.pathname.startsWith('/b/');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? ` 'unsafe-eval'` : ''}`,
    dev ? `style-src 'self' 'unsafe-inline'` : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:${pagePublique ? ` ${MESURE_PUB}` : ''}`,
    `font-src 'self'`,
    `connect-src 'self'${dev ? ' ws:' : ''}${pagePublique ? ` ${MESURE_PUB}` : ''}`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const entetes = new Headers(requete.headers);
  entetes.set('x-nonce', nonce);
  entetes.set('Content-Security-Policy', csp);
  // Boutique sur son sous-domaine (« nom.mondomaine.dz ») : même application, pages de /b/nom.
  // Les liens de la boutique sont alors écrits sans le préfixe /b/nom (en-tête x-boutique-base).
  entetes.delete('x-boutique-base');
  let reponse: NextResponse;
  if (sousDomaine && !requete.nextUrl.pathname.startsWith('/_next')) {
    entetes.set('x-boutique-base', '');
    const cible = requete.nextUrl.clone();
    cible.pathname = `/b/${sousDomaine}${requete.nextUrl.pathname === '/' ? '' : requete.nextUrl.pathname}`;
    reponse = NextResponse.rewrite(cible, { request: { headers: entetes } });
  } else {
    reponse = NextResponse.next({ request: { headers: entetes } });
  }

  reponse.headers.set('Content-Security-Policy', csp);
  reponse.headers.set('X-Content-Type-Options', 'nosniff');
  reponse.headers.set('X-Frame-Options', 'DENY');
  // Les liens d'invitation contiennent un jeton : l'adresse de la page n'est jamais transmise à un autre site.
  reponse.headers.set('Referrer-Policy', 'no-referrer');
  reponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  reponse.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  if (https) reponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  // Pages personnelles : jamais gardées par un cache intermédiaire.
  reponse.headers.set('Cache-Control', 'no-store');
  return reponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icones/|wasm/|photos/|manifest.webmanifest).*)'],
};
