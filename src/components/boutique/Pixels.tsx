// Code de départ des pixels publicitaires, avec le nonce de la page (CSP). Les identifiants ont un format
// vérifié par la base (chiffres, ou majuscules et chiffres) : ils ne peuvent pas contenir de code.
import { FORMAT_PIXEL } from '@/lib/boutique';
import { SuiviPages } from './MesurePub';

const FACEBOOK = (id: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(id)});fbq('track','PageView');`;
const TIKTOK = (id: string) =>
  `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var s=d.createElement("script");s.async=!0;s.src=r+"?sdkid="+e+"&lib="+t;var x=d.getElementsByTagName("script")[0];x.parentNode.insertBefore(s,x)};ttq.load(${JSON.stringify(id)});ttq.page()}(window,document,'ttq');`;

export function Pixels({ facebook, tiktok, nonce }: { facebook: string | null; tiktok: string | null; nonce: string }) {
  const fb = facebook && FORMAT_PIXEL.facebook.test(facebook) ? facebook : null;
  const tt = tiktok && FORMAT_PIXEL.tiktok.test(tiktok) ? tiktok : null;
  if (!fb && !tt) return null;
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: (fb ? FACEBOOK(fb) : '') + (tt ? TIKTOK(tt) : '') }} />
      <SuiviPages />
    </>
  );
}
