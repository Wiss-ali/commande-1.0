// Carte d'un produit dans la boutique : photo, nom, prix (barré si promotion), pastilles « Nouveau »,
// « Plus que N » et « Rupture de stock ». Deux tailles : grille (Vitrine, Catalogue) ou pleine largeur (Grandes photos).
import { ImageOff } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProduitPublic } from '@/lib/boutique';
import { formaterMontant, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';

export async function CarteProduit({ p, base, plusQue, large }: { p: ProduitPublic; base: string; plusQue: number; large?: boolean }) {
  const t = await getTranslations('boutique');
  const langue = (await getLocale()) as Langue;
  const prix = Math.min(...p.variantes.map((v) => v.prix));
  const differents = new Set(p.variantes.map((v) => v.prix)).size > 1;
  const barre = p.variantes.find((v) => v.prix === prix)?.prixBarre;
  const epuise = p.disponible <= 0;
  return (
    <Link href={`${base}/p/${p.id}`} className={`flex flex-col overflow-hidden rounded-xl border border-trait bg-surface ${epuise ? 'opacity-75' : ''}`}>
      <span className={`relative flex items-center justify-center bg-creux ${large ? 'aspect-[4/3]' : 'aspect-square'}`}>
        {p.photoId ? <img src={`${base}/photo/${p.photoId}${large ? '' : '?t=p'}`} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff aria-hidden className="size-8 text-doux" />}
        <span className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {p.nouveau ? <span className="rounded-full bg-vert px-2 py-0.5 text-xs font-bold text-sur-vert">{t('nouveau')}</span> : null}
          {epuise ? <span className="rounded-full bg-terre px-2 py-0.5 text-xs font-bold text-white">{t('rupture')}</span>
            : plusQue > 0 && p.disponible <= plusQue ? <span className="rounded-full bg-safran px-2 py-0.5 text-xs font-bold text-encre">{t('plusQue', { n: p.disponible })}</span> : null}
        </span>
      </span>
      <span className={`flex flex-col gap-0.5 p-3 ${large ? 'text-lg' : ''}`}>
        <span className="line-clamp-2 font-semibold">{nomLocal(p, langue)}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold">{differents ? t('aPartirDe', { prix: formaterMontant(prix, langue) }) : formaterMontant(prix, langue)}</span>
          {barre && barre > prix ? <s className="text-sm text-doux">{formaterMontant(barre, langue)}</s> : null}
        </span>
      </span>
    </Link>
  );
}
