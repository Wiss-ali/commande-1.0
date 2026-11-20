import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Banknote, Phone } from 'lucide-react';
import '@/components/boutique/boutique.css';
import { CompteurPanier } from '@/components/boutique/CompteurPanier';
import { LogoBoutique } from '@/components/boutique/LogoBoutique';
import { Pixels } from '@/components/boutique/Pixels';
import { BoutonLangue } from '@/components/EnTete';
import { styleCouleur } from '@/lib/design-boutique';
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

/**
 * Les pixels (programmes de Facebook, TikTok) ne tournent jamais sur une page qui demande ou montre des données de
 * l'acheteur : panier et formulaire de commande, ticket (son adresse contient le lien privé), accueil d'une boutique
 * « produit unique » (le formulaire y est). On y arrive par un chargement complet de la page (liens simples), pour
 * que le programme chargé avant ne reste pas en mémoire. La commande est signalée par la page « merci », sans donnée.
 */
async function pixelsPermis(modele: string): Promise<boolean> {
  const chemin = (await headers()).get('x-chemin') ?? '';
  // « merci » charge lui-même le pixel, avec la commande.
  if (/^\/b\/[^/]+\/(panier|t\/|merci)/.test(chemin)) return false;
  if (modele === 'produit_unique' && /^\/b\/[^/]+\/?$/.test(chemin)) return false;
  return true;
}

/** Cadre de chaque page d'une boutique : en-tête (logo, nom, langue, panier), couleur et ambiance choisies, pied avec l'identité du vendeur. */
export default async function CadreBoutique({ params, children }: { params: Promise<{ sd: string }>; children: ReactNode }) {
  const c = await chargerVitrine((await params).sd);
  if (!c) notFound();
  const t = await getTranslations('boutique');
  const langue = (await getLocale()) as Langue;
  const { v, base } = c;
  const r = v.reglages;
  // Couleur de la boutique : feuille de style avec le nonce de la page (les styles en ligne sont interdits par la CSP).
  const css = styleCouleur(r.couleur);
  const logo = r.logoId ? `${base}/photo/${r.logoId}?t=p` : null;
  const slogan = r.slogan[langue] || r.slogan.fr || r.slogan.ar;

  // Boutique coupée : cadre réduit (pas de panier). Chaque page affiche « momentanément indisponible »,
  // sauf le ticket d'un acheteur, qui reste consultable par son lien privé.
  if (!v.disponible && !c.apercu) {
    return (
      <div className="boutique mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6" data-ambiance={r.ambiance}>
        <style nonce={c.nonce}>{css}</style>
        <div className="flex items-center justify-between gap-2"><LogoBoutique nom={v.nom} forme={r.logoForme} icone={r.logoIcone} image={logo} avecNom className="text-xl" /><BoutonLangue /></div>
        {children}
      </div>
    );
  }
  const reseaux = Object.entries(r.reseaux);
  return (
    <div className="boutique flex min-h-dvh flex-col" data-ambiance={r.ambiance}>
      <style nonce={c.nonce}>{css}</style>
      {/* Pixels publicitaires : seulement sur la boutique en ligne, jamais pendant l'aperçu du commerçant. */}
      {!c.apercu && (await pixelsPermis(r.modele)) ? <Pixels facebook={r.pixels.facebook} tiktok={r.pixels.tiktok} nonce={c.nonce} /> : null}
      {c.apercu ? <p role="status" className="bg-safran px-4 py-2 text-center text-sm font-semibold text-encre">{t('apercuBandeau')}</p> : null}
      <header className="sticky top-0 z-10 border-b border-trait bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-2 px-4">
          <Link href={base || '/'} className="flex min-w-0 flex-1 items-center text-lg">
            <LogoBoutique nom={v.nom} forme={r.logoForme} icone={r.logoIcone} image={logo} taille="s" avecNom={r.logoForme !== 'texte' || !!logo} />
          </Link>
          <BoutonLangue />
          <CompteurPanier sd={v.sousDomaine} base={base} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-10 pt-4">{children}</main>
      <footer className="border-t border-trait bg-surface">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 text-sm text-doux sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <LogoBoutique nom={v.nom} forme={r.logoForme} icone={r.logoIcone} image={logo} taille="s" avecNom={r.logoForme !== 'texte' || !!logo} className="text-base text-encre" />
            {slogan ? <p>{slogan}</p> : null}
            {v.formeJuridique ? <p className="text-xs">{v.nom} · {v.formeJuridique}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            {v.telephone ? <p className="flex items-center gap-2"><Phone aria-hidden className="size-4" />{t('telephoneVendeur')} : <a href={`tel:${v.telephone}`} dir="ltr" className="chiffres font-semibold text-encre underline">{formaterTelephone(v.telephone)}</a></p> : null}
            <p className="flex items-center gap-2"><Banknote aria-hidden className="size-4" />{t('paiementLivraisonSeul')}</p>
            {reseaux.length ? (
              <ul className="flex flex-wrap gap-2 pt-1">
                {reseaux.map(([n, lien]) => <li key={n}><a href={lien} target="_blank" rel="noopener noreferrer" className="b-bouton inline-flex min-h-10 items-center border border-trait px-3 font-semibold text-encre">{t(`reseau_${n}`)}</a></li>)}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-col gap-1 border-t border-trait pt-4 text-xs sm:col-span-2">
            {r.pixels.facebook || r.pixels.tiktok ? <p>{t('mentionPixels')}</p> : null}
            <p>{t('propulse')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
