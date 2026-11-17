import { ImageOff } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AjouterPanier } from '@/components/boutique/AjouterPanier';
import { avecCommercant } from '@/lib/bd';
import { catalogue } from '@/lib/boutique';
import { nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { chargerVitrine } from '@/lib/vitrine-page';
import { Indisponible } from '@/components/boutique/Indisponible';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProduitBoutique({ params }: { params: Promise<{ sd: string; id: string }> }) {
  const { sd, id } = await params;
  const c = await chargerVitrine(sd);
  if (!c || !UUID.test(id)) notFound();
  if (!c.v.disponible && !c.apercu) return <Indisponible />;
  const t = await getTranslations('boutique');
  const langue = (await getLocale()) as Langue;
  // Les produits masqués quand ils sont épuisés restent introuvables ici aussi.
  const [p] = await avecCommercant(c.v.commercantId, (trx) => catalogue(trx, { commercantId: c.v.commercantId, reglages: c.v.reglages, produitId: id }));
  if (!p) notFound();
  const nom = nomLocal(p, langue);
  return (
    <>
      <Link href={c.base || '/'} className="text-sm font-semibold text-vert underline">{t('retourBoutique')}</Link>
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-creux">
        {p.photoId ? <img src={`${c.base}/photo/${p.photoId}`} alt="" className="size-full object-cover" /> : <ImageOff aria-hidden className="size-10 text-doux" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{nom}</h1>
        {p.nouveau ? <span className="rounded-full bg-vert px-2 py-0.5 text-xs font-bold text-sur-vert">{t('nouveau')}</span> : null}
        {p.disponible > 0 && c.v.reglages.plusQue > 0 && p.disponible <= c.v.reglages.plusQue ? <span className="rounded-full bg-safran px-2 py-0.5 text-xs font-bold text-encre">{t('plusQue', { n: p.disponible })}</span> : null}
      </div>
      {p.categorie ? <p className="text-sm text-doux">{nomLocal(p.categorie, langue)}</p> : null}
      <AjouterPanier sd={c.v.sousDomaine} base={c.base} produitId={p.id} nom={nom} variantes={p.variantes} />
      <p className="text-sm text-doux">{t('paiementLivraisonSeul')}</p>
    </>
  );
}
