import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CompteurPanier } from '@/components/boutique/CompteurPanier';
import { Pixels } from '@/components/boutique/Pixels';
import { BoutonLangue } from '@/components/EnTete';
import { PALETTE } from '@/lib/boutique';
import { formaterTelephone } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { chargerVitrine } from '@/lib/vitrine-page';

export async function generateMetadata({ params }: { params: Promise<{ sd: string }> }): Promise<Metadata> {
  const c = await chargerVitrine((await params).sd);
  if (!c) return {};
  const langue = (await getLocale()) as Langue;
  const accueil = c.v.reglages.accueil[langue] || c.v.reglages.accueil.fr || c.v.reglages.accueil.ar;
  // Une boutique en ligne peut être trouvée par les moteurs de recherche ; l'espace de gestion, jamais.
  return { title: c.v.nom, description: accueil.slice(0, 160) || undefined, robots: c.v.disponible ? { index: true, follow: true } : { index: false, follow: false } };
}

/** Cadre de chaque page d'une boutique : en-tête (logo, nom, langue, panier), couleur choisie, pied avec l'identité du vendeur. */
export default async function CadreBoutique({ params, children }: { params: Promise<{ sd: string }>; children: ReactNode }) {
  const c = await chargerVitrine((await params).sd);
  if (!c) notFound();
  const t = await getTranslations('boutique');
  const { v, base } = c;
  const couleur = PALETTE[v.reglages.couleur] ?? PALETTE.emeraude!;
  // Couleur de la boutique : feuille de style avec le nonce de la page (les styles en ligne sont interdits par la CSP).
  const css = `.boutique{--prim:${couleur.fond};--prim-fort:${couleur.fond};--prim-pale:${couleur.pale};--sur-prim:#fff;--ombre-prim:none}`
    + `@media (prefers-color-scheme:dark){:root:not([data-theme=clair]) .boutique{--prim:${couleur.pale};--prim-fort:${couleur.pale};--sur-prim:${couleur.fond};--prim-pale:${couleur.fond}}}`
    + `:root[data-theme=sombre] .boutique{--prim:${couleur.pale};--prim-fort:${couleur.pale};--sur-prim:${couleur.fond};--prim-pale:${couleur.fond}}`;

  // Boutique coupée : cadre réduit (pas de panier). Chaque page affiche « momentanément indisponible »,
  // sauf le ticket d'un acheteur, qui reste consultable par son lien privé.
  if (!v.disponible && !c.apercu) {
    return (
      <div className="boutique mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
        <style nonce={c.nonce}>{css}</style>
        <div className="flex items-center justify-between gap-2"><p className="text-xl font-bold">{v.nom}</p><BoutonLangue /></div>
        {children}
      </div>
    );
  }
  return (
    <div className="boutique flex min-h-dvh flex-col">
      <style nonce={c.nonce}>{css}</style>
      {/* Pixels publicitaires : seulement sur la boutique en ligne, jamais pendant l'aperçu du commerçant. */}
      {!c.apercu ? <Pixels facebook={v.reglages.pixels.facebook} tiktok={v.reglages.pixels.tiktok} nonce={c.nonce} /> : null}
      {c.apercu ? <p role="status" className="bg-safran px-4 py-2 text-center text-sm font-semibold text-encre">{t('apercuBandeau')}</p> : null}
      <header className="sticky top-0 z-10 border-b border-trait bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-2 px-4">
          <Link href={base || '/'} className="flex min-w-0 flex-1 items-center gap-2">
            {v.reglages.logoId ? <img src={`${base}/photo/${v.reglages.logoId}?t=p`} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg object-cover" /> : null}
            <span className="truncate text-lg font-bold">{v.nom}</span>
          </Link>
          <BoutonLangue />
          <CompteurPanier sd={v.sousDomaine} base={base} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-4">{children}</main>
      <footer className="border-t border-trait bg-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-5 text-sm text-doux">
          <p className="font-semibold text-encre">{v.nom}{v.formeJuridique ? ` · ${v.formeJuridique}` : ''}</p>
          {v.telephone ? <p>{t('telephoneVendeur')} : <a href={`tel:${v.telephone}`} dir="ltr" className="chiffres underline">{formaterTelephone(v.telephone)}</a></p> : null}
          <p>{t('paiementLivraisonSeul')}</p>
          {v.reglages.pixels.facebook || v.reglages.pixels.tiktok ? <p className="text-xs">{t('mentionPixels')}</p> : null}
          <p className="pt-2 text-xs">{t('propulse')}</p>
        </div>
      </footer>
    </div>
  );
}
