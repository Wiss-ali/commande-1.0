import { randomUUID } from 'node:crypto';
import { ArrowDown, Banknote, ImageIcon, MessageCircle, Phone, PhoneCall, RotateCcw, Search, Truck, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AjouterPanier } from '@/components/boutique/AjouterPanier';
import { CarteProduit } from '@/components/boutique/CarteProduit';
import { CommandeBoutique } from '@/components/boutique/CommandeBoutique';
import { LogoBoutique } from '@/components/boutique/LogoBoutique';
import { avecCommercant } from '@/lib/bd';
import { catalogue, type ProduitPublic, type Section } from '@/lib/boutique';
import { listerWilayas } from '@/lib/commandes';
import { formaterTelephone, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { chargerVitrine } from '@/lib/vitrine-page';
import { Indisponible } from '@/components/boutique/Indisponible';

/** Accueil de la boutique, selon le modèle choisi. Les sections suivent l'ordre réglé par le commerçant. */
export default async function Boutique({ params, searchParams }: { params: Promise<{ sd: string }>; searchParams: Promise<{ q?: string; cat?: string }> }) {
  const c = await chargerVitrine((await params).sd);
  if (!c) notFound();
  if (!c.v.disponible && !c.apercu) return <Indisponible />;
  const t = await getTranslations('boutique');
  const langue = (await getLocale()) as Langue;
  const { v, base } = c;
  const r = v.reglages;
  const sp = await searchParams;
  const { produits, wilayas } = await avecCommercant(v.commercantId, async (trx) => ({
    produits: await catalogue(trx, { commercantId: v.commercantId, reglages: r }),
    wilayas: r.modele === 'produit_unique' ? await listerWilayas(trx) : [],
  }));
  const texte = (x: { fr: string; ar: string }) => x[langue] || x.fr || x.ar;

  // Catalogue : recherche et filtre par catégorie, côté serveur.
  const recherche = (sp.q ?? '').trim().toLowerCase().slice(0, 60);
  const categories = [...new Map(produits.flatMap((p) => (p.categorie ? [[p.categorie.id, p.categorie]] : []))).values()];
  let affiches: ProduitPublic[] = produits;
  if (r.modele === 'catalogue') {
    if (sp.cat) affiches = affiches.filter((p) => p.categorie?.id === sp.cat);
    if (recherche) affiches = affiches.filter((p) => `${p.nom_fr} ${p.nom_ar}`.toLowerCase().includes(recherche));
  }
  const unique = r.modele === 'produit_unique' ? (produits.find((p) => p.id === r.produitUniqueId) ?? produits[0]) : undefined;

  const slogan = texte(r.slogan);
  const accueil = texte(r.accueil);
  const compact = r.modele === 'catalogue' || r.modele === 'produit_unique';
  const lienWhatsapp = r.whatsapp ? `https://wa.me/213${r.whatsapp.slice(1)}` : null;
  const logo = r.logoId ? `${base}/photo/${r.logoId}?t=p` : null;
  // Titre principal de la page : le produit pour « Produit unique », sinon la phrase d'accroche (ou le nom).
  const TitreAccueil = unique ? 'p' : 'h1';
  const boutons = (sombre: boolean) => (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
      <a href="#produits" className={`b-bouton b-hero-bouton inline-flex min-h-12 items-center justify-center gap-2 px-5 font-semibold ${sombre ? 'bg-white text-encre' : 'bg-prim text-sur-prim shadow-prim'}`}>
        {t(unique ? 'commanderIci' : 'decouvrir')}<ArrowDown aria-hidden className="size-4" />
      </a>
      {lienWhatsapp ? <a href={lienWhatsapp} target="_blank" rel="noopener noreferrer" className={`b-bouton inline-flex min-h-12 items-center justify-center gap-2 border px-5 font-semibold ${sombre ? 'border-white/60 text-white' : 'border-trait-fort bg-surface/70 text-encre'}`}><MessageCircle aria-hidden className="size-4" />{t('whatsapp')}</a> : null}
    </div>
  );

  const sections: Record<Section, React.ReactNode> = {
    accueil: r.banniereId ? (
      <section key="accueil" className={`b-plein relative -mx-4 -mt-4 overflow-hidden sm:mx-0 ${r.modele === 'grandes_photos' ? 'min-h-[70vh] sm:min-h-[60vh]' : compact ? 'min-h-56' : 'min-h-[55vh] sm:min-h-96'} flex items-end`}>
        <img src={`${base}/photo/${r.banniereId}`} alt="" className="absolute inset-0 size-full object-cover" />
        <span aria-hidden className="b-voile absolute inset-0" />
        <div className={`relative flex w-full flex-col gap-3 p-6 text-white sm:p-10 ${compact ? '' : 'items-center text-center'}`}>
          <TitreAccueil className={`b-titre font-bold leading-tight ${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'}`}>{slogan || v.nom}</TitreAccueil>
          {accueil ? <p className="max-w-xl whitespace-pre-line text-white/90 sm:text-lg">{accueil}</p> : null}
          {boutons(true)}
        </div>
      </section>
    ) : (
      <section key="accueil" className={`b-hero b-plein -mx-4 -mt-4 flex flex-col gap-4 px-6 sm:mx-0 sm:px-10 ${compact ? 'py-7' : 'items-center py-12 text-center sm:py-16'}`}>
        {!compact ? <LogoBoutique nom={v.nom} forme={r.logoForme === 'texte' ? 'rond' : r.logoForme} icone={r.logoIcone} image={logo} taille="l" /> : null}
        <TitreAccueil className={`b-titre max-w-2xl font-bold leading-tight ${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'}`}>{slogan || v.nom}</TitreAccueil>
        {accueil ? <p className={`b-hero-doux max-w-xl whitespace-pre-line text-doux ${compact ? '' : 'sm:text-lg'}`}>{accueil}</p> : null}
        {boutons(false)}
      </section>
    ),
    atouts: (
      <section key="atouts" aria-label={t('atoutsTitre')}>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4">
          {([['paiement', Banknote], ['sansCompte', UserCheck], ['confirmation', PhoneCall]] as const).map(([k, Icone]) => (
            <li key={k} className="b-carte flex flex-col items-center gap-2 border border-trait bg-surface px-2 py-3 text-center sm:flex-row sm:px-4 sm:text-start">
              <span className="b-bouton flex size-10 shrink-0 items-center justify-center bg-prim-pale text-prim"><Icone aria-hidden className="size-5" /></span>
              <span className="text-xs font-semibold leading-snug sm:text-sm">{t(`atout_${k}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    ),
    produits: unique ? (
      <section key="produits" id="produits" className="grid scroll-mt-20 gap-6 sm:grid-cols-2" aria-labelledby="titre-produit">
        <div className={`b-carte flex aspect-square w-full items-center justify-center overflow-hidden ${unique.photoId ? 'bg-creux' : 'b-sans-photo'}`}>
          {unique.photoId ? <img src={`${base}/photo/${unique.photoId}`} alt="" className="size-full object-cover" /> : <span aria-hidden className="b-titre text-8xl font-bold opacity-80">{[...nomLocal(unique, langue)][0]}</span>}
        </div>
        <div className="flex flex-col gap-4">
          <h1 id="titre-produit" className="b-titre text-3xl font-bold leading-tight">{nomLocal(unique, langue)}</h1>
          <AjouterPanier sd={v.sousDomaine} base={base} produitId={unique.id} nom={nomLocal(unique, langue)} variantes={unique.variantes} />
        </div>
        <div className="b-carte flex flex-col gap-3 border border-trait bg-surface p-4 shadow-doux sm:col-span-2 sm:p-6">
          <h2 className="b-titre text-xl font-bold">{t('commanderIci')}</h2>
          <CommandeBoutique sd={v.sousDomaine} base={base} cle={randomUUID()} wilayas={wilayas} apercu={c.apercu} />
        </div>
      </section>
    ) : (
      <section key="produits" id="produits" className="flex scroll-mt-20 flex-col gap-4" aria-labelledby="titre-produits">
        <div className="flex items-end justify-between gap-3">
          <h2 id="titre-produits" className="b-titre text-2xl font-bold">{t('produits')}</h2>
          {produits.length ? <span className="text-sm text-doux">{t('nbProduits', { n: affiches.length })}</span> : null}
        </div>
        {r.modele === 'catalogue' ? (
          <>
            <form role="search" className="b-bouton flex items-center gap-2 border border-trait-fort bg-surface p-1.5 ps-4 shadow-doux">
              <Search aria-hidden className="size-5 shrink-0 text-doux" />
              <input type="search" name="q" defaultValue={sp.q ?? ''} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={60} className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
              {sp.cat ? <input type="hidden" name="cat" value={sp.cat} /> : null}
              <button type="submit" className="b-bouton min-h-11 bg-prim px-4 text-sm font-semibold text-sur-prim">{t('chercherBouton')}</button>
            </form>
            {categories.length ? (
              <nav aria-label={t('categories')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                <Link href={base || '/'} aria-current={!sp.cat ? 'true' : undefined} className={`b-bouton inline-flex min-h-11 shrink-0 items-center border px-4 text-sm font-semibold ${!sp.cat ? 'border-prim bg-prim text-sur-prim' : 'border-trait bg-surface'}`}>{t('toutes')}</Link>
                {categories.map((k) => (
                  <Link key={k.id} href={`${base}?cat=${k.id}`} aria-current={sp.cat === k.id ? 'true' : undefined} className={`b-bouton inline-flex min-h-11 shrink-0 items-center border px-4 text-sm font-semibold ${sp.cat === k.id ? 'border-prim bg-prim text-sur-prim' : 'border-trait bg-surface'}`}>{nomLocal(k, langue)}</Link>
                ))}
              </nav>
            ) : null}
          </>
        ) : null}
        {affiches.length ? (
          <ul className={r.modele === 'grandes_photos' ? 'grid gap-5 sm:grid-cols-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'}>
            {affiches.map((p) => <li key={p.id}><CarteProduit p={p} base={base} plusQue={r.plusQue} large={r.modele === 'grandes_photos'} /></li>)}
          </ul>
        ) : c.apercu && !produits.length ? (
          // Aperçu d'une boutique encore vide : des produits d'exemple montrent la mise en page, jamais visibles des acheteurs.
          <div className="flex flex-col gap-3">
            <p className="rounded-xl border border-dashed border-safran bg-safran-pale px-4 py-3 text-sm font-semibold text-sur-safran">{t('exempleProduits')}</p>
            <ul aria-hidden className={r.modele === 'grandes_photos' ? 'grid gap-5 sm:grid-cols-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'}>
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="b-carte flex flex-col overflow-hidden border border-dashed border-trait-fort bg-surface">
                  <span className={`b-sans-photo flex items-center justify-center ${r.modele === 'grandes_photos' ? 'aspect-[4/3]' : 'aspect-square'}`}><ImageIcon className="size-10 opacity-60" /></span>
                  <span className="flex flex-col gap-1 p-3"><span className="font-semibold">{t('exempleProduit', { n })}</span><span className="font-bold text-prim">{t('exemplePrix')}</span></span>
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="b-carte border border-dashed border-trait px-4 py-10 text-center text-doux">{t(recherche || sp.cat ? 'aucunResultat' : 'aucunProduit')}</p>}
      </section>
    ),
    conditions: texte(r.livraison) || texte(r.retour) ? (
      <section key="conditions" aria-label={t('conditionsTitre')} className="grid gap-3 sm:grid-cols-2">
        {([['livraison', Truck, 'conditionsLivraison'], ['retour', RotateCcw, 'conditionsRetour']] as const).map(([k, Icone, titre]) => texte(r[k]) ? (
          <div key={k} className="b-carte flex gap-3 border border-trait bg-surface p-4 shadow-doux sm:p-5">
            <span className="b-bouton flex size-11 shrink-0 items-center justify-center bg-prim-pale text-prim"><Icone aria-hidden className="size-5" /></span>
            <div className="flex flex-col gap-1"><h2 className="b-titre text-lg font-bold">{t(titre)}</h2><p className="whitespace-pre-line text-sm text-doux">{texte(r[k])}</p></div>
          </div>
        ) : null)}
      </section>
    ) : null,
    contact: (
      <section key="contact" className="b-carte flex flex-col items-start gap-4 bg-prim p-6 text-sur-prim sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="b-titre text-2xl font-bold">{t('contactTitre')}</h2>
          <p className="opacity-85">{t('contactTexte')}</p>
          {v.telephone ? <p className="chiffres pt-1 text-lg font-bold" dir="ltr">{formaterTelephone(v.telephone)}</p> : null}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {v.telephone ? <a href={`tel:${v.telephone}`} className="b-bouton inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-surface px-5 font-semibold text-encre sm:flex-none"><Phone aria-hidden className="size-4" />{t('appeler')}</a> : null}
          {lienWhatsapp ? <a href={lienWhatsapp} target="_blank" rel="noopener noreferrer" className="b-bouton inline-flex min-h-12 flex-1 items-center justify-center gap-2 border border-current px-5 font-semibold sm:flex-none"><MessageCircle aria-hidden className="size-4" />{t('whatsapp')}</a> : null}
        </div>
      </section>
    ),
  };
  return <>{r.sections.map((s) => sections[s])}</>;
}
