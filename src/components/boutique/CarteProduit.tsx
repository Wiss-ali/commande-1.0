// Carte d'un produit dans la boutique : photo, nom, prix (barré si promotion), pastilles « Nouveau »,
// « Plus que N » et « Rupture de stock ». Deux tailles : grille (Vitrine, Catalogue) ou grande (Grandes photos).
// Sans photo, la première lettre du produit sur un fond pâle de la couleur de la boutique.
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
  const nom = nomLocal(p, langue);
  const remise = barre && barre > prix ? Math.round((1 - prix / barre) * 100) : 0;
  return (
    <Link href={`${base}/p/${p.id}`} className={`b-carte b-carte-produit group flex h-full flex-col overflow-hidden border border-trait bg-surface shadow-doux ${epuise ? 'opacity-75' : ''}`}>
      <span className={`relative flex items-center justify-center overflow-hidden ${large ? 'aspect-[4/5] sm:aspect-[4/3]' : 'aspect-square'} ${p.photoId ? 'bg-creux' : 'b-sans-photo'}`}>
        {p.photoId
          ? <img src={`${base}/photo/${p.photoId}${large ? '' : '?t=p'}`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          : <span aria-hidden className={`b-titre font-bold opacity-80 ${large ? 'text-7xl' : 'text-5xl'}`}>{[...nom.trim()][0]?.toLocaleUpperCase('fr') ?? '?'}</span>}
        <span className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {p.nouveau ? <span className="b-bouton bg-prim px-2 py-0.5 text-xs font-bold text-sur-prim">{t('nouveau')}</span> : null}
          {epuise ? <span className="b-bouton bg-terre px-2 py-0.5 text-xs font-bold text-white">{t('rupture')}</span>
            : plusQue > 0 && p.disponible <= plusQue ? <span className="b-bouton bg-safran px-2 py-0.5 text-xs font-bold text-encre">{t('plusQue', { n: p.disponible })}</span> : null}
        </span>
        {remise > 0 && !epuise ? <span className="chiffres b-bouton absolute end-2 top-2 bg-encre px-2 py-0.5 text-xs font-bold text-surface">{t('remise', { n: remise })}</span> : null}
      </span>
      <span className={`flex flex-1 flex-col gap-1 p-3 ${large ? 'sm:p-4' : ''}`}>
        <span className={`line-clamp-2 font-semibold ${large ? 'b-titre text-xl' : ''}`}>{nom}</span>
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className={`font-bold text-prim ${large ? 'text-lg' : ''}`}>{differents ? t('aPartirDe', { prix: formaterMontant(prix, langue) }) : formaterMontant(prix, langue)}</span>
          {barre && barre > prix ? <s className="text-sm text-doux">{formaterMontant(barre, langue)}</s> : null}
        </span>
      </span>
    </Link>
  );
}
