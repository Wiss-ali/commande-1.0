// En-têtes de sécurité posés sur chaque page : politique CSP stricte avec un nonce par requête, HSTS, etc.
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(requete: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  const https = (process.env.URL_APP ?? '').startsWith('https://');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? ` 'unsafe-eval'` : ''}`,
    dev ? `style-src 'self' 'unsafe-inline'` : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${dev ? ' ws:' : ''}`,
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
  const reponse = NextResponse.next({ request: { headers: entetes } });

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
