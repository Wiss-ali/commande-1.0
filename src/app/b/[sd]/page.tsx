import { randomUUID } from 'node:crypto';
import { MessageCircle, Phone, Search } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AjouterPanier } from '@/components/boutique/AjouterPanier';
import { CarteProduit } from '@/components/boutique/CarteProduit';
import { CommandeBoutique } from '@/components/boutique/CommandeBoutique';
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

  const sections: Record<Section, React.ReactNode> = {
    accueil: (
      <section key="accueil" className="flex flex-col gap-3">
        {r.banniereId ? <img src={`${base}/photo/${r.banniereId}`} alt="" className={`w-full rounded-xl object-cover ${r.modele === 'grandes_photos' ? 'aspect-[16/9]' : 'aspect-[3/1]'}`} /> : null}
        {texte(r.accueil) ? <p className="whitespace-pre-line text-lg">{texte(r.accueil)}</p> : null}
      </section>
    ),
    produits: unique ? (
      <section key="produits" className="flex flex-col gap-4" aria-labelledby="titre-produit">
        {unique.photoId ? <img src={`${base}/photo/${unique.photoId}`} alt="" className="aspect-square w-full rounded-xl object-cover" /> : null}
        <h1 id="titre-produit" className="text-2xl font-bold">{nomLocal(unique, langue)}</h1>
        <AjouterPanier sd={v.sousDomaine} base={base} produitId={unique.id} nom={nomLocal(unique, langue)} variantes={unique.variantes} maxParArticle={r.maxParArticle} />
        <h2 className="pt-2 text-lg font-semibold">{t('commanderIci')}</h2>
        <CommandeBoutique sd={v.sousDomaine} base={base} cle={randomUUID()} wilayas={wilayas} apercu={c.apercu} />
      </section>
    ) : (
      <section key="produits" className="flex flex-col gap-3" aria-labelledby="titre-produits">
        <h1 id="titre-produits" className="text-xl font-bold">{t('produits')}</h1>
        {r.modele === 'catalogue' ? (
          <>
            <form role="search" className="flex gap-2">
              <input type="search" name="q" defaultValue={sp.q ?? ''} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={60} className="min-h-12 min-w-0 flex-1 rounded-xl border border-trait bg-surface px-3 text-base" />
              {sp.cat ? <input type="hidden" name="cat" value={sp.cat} /> : null}
              <button type="submit" aria-label={t('chercher')} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-trait bg-surface"><Search aria-hidden className="size-5" /></button>
            </form>
            {categories.length ? (
              <nav aria-label={t('categories')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                <Link href={base || '/'} aria-current={!sp.cat ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${!sp.cat ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>{t('toutes')}</Link>
                {categories.map((k) => (
                  <Link key={k.id} href={`${base}?cat=${k.id}`} aria-current={sp.cat === k.id ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${sp.cat === k.id ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>{nomLocal(k, langue)}</Link>
                ))}
              </nav>
            ) : null}
          </>
        ) : null}
        {affiches.length ? (
          <ul className={r.modele === 'grandes_photos' ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
            {affiches.map((p) => <li key={p.id}><CarteProduit p={p} base={base} plusQue={r.plusQue} large={r.modele === 'grandes_photos'} /></li>)}
          </ul>
        ) : <p className="rounded-xl border border-dashed border-trait px-4 py-6 text-center text-doux">{t(recherche || sp.cat ? 'aucunResultat' : 'aucunProduit')}</p>}
      </section>
    ),
    conditions: texte(r.livraison) || texte(r.retour) ? (
      <section key="conditions" className="flex flex-col gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-4">
        {texte(r.livraison) ? <div><h2 className="font-semibold">{t('conditionsLivraison')}</h2><p className="whitespace-pre-line text-sm">{texte(r.livraison)}</p></div> : null}
        {texte(r.retour) ? <div><h2 className="font-semibold">{t('conditionsRetour')}</h2><p className="whitespace-pre-line text-sm">{texte(r.retour)}</p></div> : null}
      </section>
    ) : null,
    contact: (
      <section key="contact" className="flex flex-col gap-2 rounded-2xl border border-trait bg-surface shadow-doux p-4">
        <h2 className="font-semibold">{t('contact')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {v.telephone ? <a href={`tel:${v.telephone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-trait px-3 text-sm font-semibold"><Phone aria-hidden className="size-4" />{t('appeler')}</a> : null}
          {r.whatsapp ? <a href={`https://wa.me/213${r.whatsapp.slice(1)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-trait px-3 text-sm font-semibold"><MessageCircle aria-hidden className="size-4" />{t('whatsapp')}</a> : null}
        </div>
        {v.telephone ? <p className="chiffres text-sm text-doux" dir="ltr">{formaterTelephone(v.telephone)}</p> : null}
        {Object.entries(r.reseaux).length ? (
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(r.reseaux).map(([n, lien]) => <li key={n}><a href={lien} target="_blank" rel="noopener noreferrer" className="font-semibold text-prim underline">{t(`reseau_${n}`)}</a></li>)}
          </ul>
        ) : null}
      </section>
    ),
  };
  return <>{r.sections.map((s) => sections[s])}</>;
}
