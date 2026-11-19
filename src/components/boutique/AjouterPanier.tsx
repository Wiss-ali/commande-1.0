'use client';
// Choix de la variante et de la quantité, puis « Ajouter au panier ». Désactivé si l'article est épuisé.
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { signalerPub } from './MesurePub';
import { ajouterAuPanier } from './panier';

interface Variante {
  varianteId: string;
  libelle: string;
  prix: number;
  prixBarre: number | null;
  disponible: number;
}

export function AjouterPanier({ sd, base, produitId, nom, variantes, direct, maxParArticle = 99 }: { sd: string; base: string; produitId: string; nom: string; variantes: Variante[]; direct?: boolean; maxParArticle?: number }) {
  const t = useTranslations('boutique');
  const langue = useLocale() as Langue;
  const premiere = variantes.find((v) => v.disponible > 0) ?? variantes[0]!;
  const [choix, setChoix] = useState(premiere.varianteId);
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);
  const v = variantes.find((x) => x.varianteId === choix) ?? premiere;
  const epuise = v.disponible <= 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2">
        <span className="b-titre text-3xl font-bold text-prim">{formaterMontant(v.prix, langue)}</span>
        {v.prixBarre && v.prixBarre > v.prix ? <s className="text-doux">{formaterMontant(v.prixBarre, langue)}</s> : null}
      </p>
      {variantes.length > 1 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{t('choisirVariante')}</legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((x) => (
              <label key={x.varianteId} className={`b-bouton inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold ${x.varianteId === choix ? 'border-prim bg-prim-pale text-prim' : 'border-trait'} ${x.disponible <= 0 ? 'line-through opacity-60' : ''}`}>
                <input type="radio" name="variante" value={x.varianteId} checked={x.varianteId === choix} onChange={() => { setChoix(x.varianteId); setQuantite(1); setAjoute(false); }} className="sr-only" />
                {x.libelle}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {epuise ? (
        <p className="rounded-lg border border-terre bg-terre-pale px-3 py-2.5 text-center font-semibold text-terre">{t('rupture')}</p>
      ) : (
        <label className="flex items-center gap-3">
          <span className="text-sm font-medium">{t('quantite')}</span>
          <select value={quantite} onChange={(e) => setQuantite(Number(e.target.value))} className="min-h-11 rounded-xl border border-trait bg-surface px-3 text-base">
            {Array.from({ length: Math.min(10, maxParArticle, v.disponible) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={epuise}
        onClick={() => {
          ajouterAuPanier(sd, { varianteId: v.varianteId, produitId, nom, libelle: v.libelle, prix: v.prix, max: Math.min(maxParArticle, v.disponible) }, quantite);
          signalerPub('AddToCart', { valeur: v.prix * quantite, produitId });
          setAjoute(true);
          if (direct) window.location.assign(`${base}/panier`);
        }}
        className="b-bouton inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-prim shadow-prim hover:bg-prim-fort px-4 text-base font-semibold text-sur-prim disabled:opacity-50"
      >
        {t(direct ? 'commanderMaintenant' : 'ajouter')}
      </button>
      {ajoute && !direct ? (
        <p role="status" className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1 text-prim"><Check aria-hidden className="size-4" />{t('ajoute')}</span>
          <Link href={`${base}/panier`} className="font-semibold text-prim underline">{t('voirPanier')}</Link>
        </p>
      ) : null}
    </div>
  );
}
