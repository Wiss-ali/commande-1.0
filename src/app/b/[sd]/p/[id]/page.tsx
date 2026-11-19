import { ImageOff } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { SignalPub } from '@/components/boutique/MesurePub';
import { AjouterPanier } from '@/components/boutique/AjouterPanier';
import { avecCommercant } from '@/lib/bd';
import { catalogue } from '@/lib/boutique';
import { photosProduit } from '@/lib/photos';
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
  const { p, photos } = await avecCommercant(c.v.commercantId, async (trx) => {
    const [trouve] = await catalogue(trx, { commercantId: c.v.commercantId, reglages: c.v.reglages, produitId: id });
    return { p: trouve, photos: trouve ? await photosProduit(trx, trouve.id) : [] };
  });
  if (!p) notFound();
  const nom = nomLocal(p, langue);
  return (
    <>
      <Link href={c.base || '/'} className="text-sm font-semibold text-prim underline">{t('retourBoutique')}</Link>
      {/* Galerie : les photos défilent d'un geste du doigt (sans script), la principale d'abord. */}
      {photos.length > 1 ? (
        <ul aria-label={t('photos', { n: photos.length })} className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
          {photos.map((ph, i) => (
            <li key={ph} className="aspect-square w-[85%] shrink-0 snap-center overflow-hidden rounded-xl bg-creux">
              <img src={`${c.base}/photo/${ph}`} alt={i === 0 ? '' : t('photoN', { n: i + 1 })} loading={i === 0 ? 'eager' : 'lazy'} className="size-full object-cover" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-creux">
          {p.photoId ? <img src={`${c.base}/photo/${p.photoId}`} alt="" className="size-full object-cover" /> : <ImageOff aria-hidden className="size-10 text-doux" />}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{nom}</h1>
        {p.nouveau ? <span className="rounded-full bg-prim px-2 py-0.5 text-xs font-bold text-sur-prim">{t('nouveau')}</span> : null}
        {p.disponible > 0 && c.v.reglages.plusQue > 0 && p.disponible <= c.v.reglages.plusQue ? <span className="rounded-full bg-safran px-2 py-0.5 text-xs font-bold text-encre">{t('plusQue', { n: p.disponible })}</span> : null}
      </div>
      {p.categorie ? <p className="text-sm text-doux">{nomLocal(p.categorie, langue)}</p> : null}
      <AjouterPanier sd={c.v.sousDomaine} base={c.base} produitId={p.id} nom={nom} variantes={p.variantes} maxParArticle={c.v.reglages.maxParArticle} />
      {!c.apercu ? <SignalPub evenement="ViewContent" valeur={p.variantes[0]?.prix ?? 0} produitId={p.id} /> : null}
      <p className="text-sm text-doux">{t('paiementLivraisonSeul')}</p>
    </>
  );
}
