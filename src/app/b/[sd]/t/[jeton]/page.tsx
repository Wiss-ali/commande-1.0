import { CircleCheck, MessageCircle, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { LienPartage } from '@/components/LienPartage';
import { ViderPanier } from '@/components/boutique/ViderPanier';
import { lireTicket } from '@/lib/boutique';
import { config } from '@/lib/config';
import { formaterDate, formaterHeure, formaterMontant, formaterTelephone, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { chargerVitrine } from '@/lib/vitrine-page';

/** Ticket de l'acheteur, retrouvé par son lien privé (impossible à deviner). Le téléphone du vendeur en grand. */
export default async function Ticket({ params, searchParams }: { params: Promise<{ sd: string; jeton: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { sd, jeton } = await params;
  const c = await chargerVitrine(sd);
  if (!c) notFound();
  const ticket = await lireTicket(c.v.commercantId, jeton);
  if (!ticket) notFound();
  const t = await getTranslations('boutique');
  const ts = await getTranslations('commandes.statut');
  const langue = (await getLocale()) as Langue;
  const nouveau = (await searchParams).nouveau === '1';
  const tel = c.v.telephone;
  const whatsapp = c.v.reglages.whatsapp ?? tel;
  const message = t('messageWhatsapp', { numero: ticket.numero });
  // Adresse complète du ticket, à garder ou à partager.
  const app = config();
  const lien = c.base === '' && app.DOMAINE_BOUTIQUES
    ? `${app.https ? 'https' : 'http'}://${c.v.sousDomaine}.${app.DOMAINE_BOUTIQUES}/t/${jeton}`
    : `${app.URL_APP.replace(/\/$/, '')}/b/${c.v.sousDomaine}/t/${jeton}`;
  return (
    <>
      {nouveau ? <ViderPanier sd={c.v.sousDomaine} /> : null}
      {/* Commande tout juste passée : signalée aux pixels par une page à part, sans le lien privé ni les coordonnées. */}
      {nouveau && !c.apercu && (c.v.reglages.pixels.facebook || c.v.reglages.pixels.tiktok) ? <iframe src={`${c.base}/merci?v=${ticket.total}`} title="" aria-hidden tabIndex={-1} sandbox="allow-scripts" className="pointer-events-none fixed size-px opacity-0" /> : null}
      <section className="flex flex-col items-center gap-1 rounded-xl border-2 border-prim bg-surface p-5 text-center">
        <CircleCheck aria-hidden className="size-10 text-prim" />
        <h1 className="text-lg font-semibold">{t('ticketTitre')}</h1>
        <p className="chiffres text-4xl font-bold">{t('ticketNumero', { n: ticket.numero })}</p>
        <p className="text-sm text-doux"><span className="chiffres">{formaterDate(ticket.creeLe)} {formaterHeure(ticket.creeLe)}</span> · {ts(ticket.statut)}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-4 text-center">
        <p className="font-semibold">{t('appelezVendeur')}</p>
        {tel ? <p className="chiffres text-3xl font-bold" dir="ltr">{formaterTelephone(tel)}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          {tel ? <a href={`tel:${tel}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-prim shadow-prim hover:bg-prim-fort px-3 font-semibold text-sur-prim"><Phone aria-hidden className="size-5" />{t('appeler')}</a> : null}
          {whatsapp ? <a href={`https://wa.me/213${whatsapp.slice(1)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-prim px-3 font-semibold text-prim"><MessageCircle aria-hidden className="size-5" />{t('whatsapp')}</a> : null}
        </div>
        {ticket.statut === 'nouvelle' && ticket.reservationJusqua ? <p className="text-sm text-doux">{t('reserveJusqua', { date: `${formaterDate(ticket.reservationJusqua)} ${formaterHeure(ticket.reservationJusqua)}` })}</p> : null}
      </section>

      <section className="flex flex-col gap-2">
        <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
          {ticket.lignes.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 px-4 py-3"><span><span className="chiffres">{l.quantite} ×</span> {l.designation}</span><span className="shrink-0 font-semibold">{formaterMontant(l.total, langue)}</span></li>
          ))}
          <li className="flex items-baseline justify-between gap-3 px-4 py-3 text-xl font-bold"><span>{t('total')}</span><span>{formaterMontant(ticket.total, langue)}</span></li>
        </ul>
        <p className="rounded-lg bg-prim-pale px-3 py-2 text-center font-semibold text-prim">{t('paiement_livraison')}</p>
        <p className="text-sm text-doux">{ticket.nom} · <span className="chiffres">{String(ticket.wilaya.code).padStart(2, '0')}</span> {nomLocal(ticket.wilaya, langue)} · {ticket.commune} · {t(`mode_${ticket.livraison}`)}</p>
      </section>
      <section className="flex flex-col gap-2 rounded-2xl border border-trait bg-surface shadow-doux p-4">
        <p className="text-sm">{t('gardezLien')}</p>
        <LienPartage lien={lien} texte={t('lienTicket')} />
      </section>
    </>
  );
}
