import { ClipboardList, FileSpreadsheet, History, Package, Plus, Search, Tags, Truck, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { PastilleStock } from '@/components/PastilleStock';
import { classeBouton, EtatVide, LigneLien, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { autorise, peut } from '@/lib/droits';
import { formaterMontant, nomLocal } from '@/lib/formats';
import { marquerEcart } from '@/app/actions/ventes';
import { listerEcarts, numeroTexte } from '@/lib/documents';
import { etatProduit, listerProduits, resumeStock, type FiltreStock } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 30;
const FILTRES: readonly FiltreStock[] = ['tous', 'bas', 'rupture', 'archives'];

export default async function Stock({ searchParams }: { searchParams: Promise<{ q?: string; filtre?: string; page?: string }> }) {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('stock');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const filtre = FILTRES.find((f) => f === params.filtre) ?? 'tous';
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  const gere = peut(s.utilisateur.role, 'stock.corriger');
  const cree = autorise(s.utilisateur, 'produits.gerer');

  const { resume, produits, ecarts } = await avecCommercant(s.commercant.id, async (trx) => ({
    ecarts: gere ? await listerEcarts(trx) : [],
    resume: await resumeStock(trx),
    produits: await listerProduits(trx, { recherche: q, filtre, langue, limite: PAR_PAGE * page + 1 }),
  }));
  const encore = produits.length > PAR_PAGE * page;
  const adresse = (plus: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(filtre !== 'tous' ? { filtre } : {}) });
    for (const [k, v] of Object.entries(plus)) v === '' || v === 'tous' ? p.delete(k) : p.set(k, String(v));
    const texte = p.toString();
    return texte ? `/stock?${texte}` : '/stock';
  };
  const compte: Partial<Record<FiltreStock, number>> = { tous: resume.produits, bas: resume.bas, rupture: resume.rupture };
  const vide = resume.produits === 0 && filtre === 'tous' && !q;

  return (
    <>
      <EnTete titre={t('titre')} />
      <Page>
        {vide ? (
          <EtatVide titre={t('videTitre')} texte={t(gere ? 'videTexte' : 'videTexteEmploye')}>
            {cree ? (
              <div className="mt-2 flex w-full flex-col gap-2">
                <Link href="/stock/nouveau" className={classeBouton.principal}><Plus aria-hidden className="size-5" />{t('ajouter')}</Link>
                {gere ? <Link href="/stock/import" className={classeBouton.secondaire}><FileSpreadsheet aria-hidden className="size-5" />{t('importer')}</Link> : null}
              </div>
            ) : null}
          </EtatVide>
        ) : (
          <>
            {ecarts.length ? (
              <section className="flex flex-col gap-2 rounded-xl border border-safran bg-safran-pale p-3 text-sur-safran">
                <h2 className="font-semibold">{t('aVerifierTitre', { n: ecarts.length })}</h2>
                <p className="text-sm">{t('aVerifierTexte')}</p>
                <ul className="flex flex-col gap-2">
                  {ecarts.slice(0, 10).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 rounded-lg bg-surface p-2 text-encre">
                      <Link href={`/stock/${e.produit_id}`} className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold underline">{nomLocal(e, langue)}{e.libelle ? ` · ${e.libelle}` : ''}</span>
                        <span className="text-doux">{t('aVerifierLigne', { n: e.quantite })} <span className="chiffres">{numeroTexte(e)}</span></span>
                      </Link>
                      <form action={marquerEcart}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className={classeBouton.secondaire}>{t('verifie')}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {cree ? <Link href="/stock/nouveau" className={classeBouton.principal}><Plus aria-hidden className="size-5" />{t('ajouter')}</Link> : null}
            <form action="/stock" role="search" className="flex gap-2">
              {filtre !== 'tous' ? <input type="hidden" name="filtre" value={filtre} /> : null}
              <input type="search" name="q" defaultValue={q} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={80} className="min-h-12 min-w-0 flex-1 rounded-xl border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
              <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
            </form>
            <nav aria-label={t('filtres')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {FILTRES.map((f) => (
                <Link key={f} href={adresse({ filtre: f })} aria-current={f === filtre ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${f === filtre ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
                  {t(`filtre.${f}`)}
                  {compte[f] !== undefined ? <span className="chiffres">{compte[f]}</span> : null}
                </Link>
              ))}
            </nav>
            {peut(s.utilisateur.role, 'rapports') ? (
              <p className="text-sm text-doux">{t('valeur')} <span className="font-semibold text-encre">{formaterMontant(resume.valeur, langue)}</span></p>
            ) : null}

            {produits.length === 0 ? (
              <EtatVide titre={t('aucunTitre')} texte={t('aucunTexte')}>
                <Link href="/stock" className={`${classeBouton.secondaire} mt-2`}>{t('toutVoir')}</Link>
              </EtatVide>
            ) : (
              <ul className="flex flex-col gap-2">
                {produits.slice(0, PAR_PAGE * page).map((p) => (
                  <li key={p.id}>
                    <Link href={`/stock/${p.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-creux text-doux">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.photo_id ? <img src={`/photos/${p.photo_id}?t=p`} alt="" loading="lazy" className="size-full object-cover" /> : <Package aria-hidden className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{nomLocal(p, langue)}</span>
                        <span className="block text-sm text-doux">
                          {formaterMontant(BigInt(p.prix_min), langue)}
                          {p.nb_variantes > 1 ? ` · ${t('variantes', { n: p.nb_variantes })}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="chiffres text-lg font-bold">{p.stock}</span>
                        {p.archive ? null : <PastilleStock etat={etatProduit(p)} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {encore ? <Link href={adresse({ page: page + 1 })} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
          </>
        )}

        <TitreSection>{t('outils')}</TitreSection>
        <div className="flex flex-col gap-2">
          {/* Arrivages et fournisseurs : utiles, mais pas tous les jours ; rangés avec les outils. */}
          {peut(s.utilisateur.role, 'stock.corriger') ? (
            <>
              <LigneLien href="/stock/arrivages/nouveau" titre={t('arrivage')} aide={t('arrivageAide')} icone={<Truck aria-hidden className="size-5" />} />
              <LigneLien href="/stock/fournisseurs" titre={t('fournisseurs')} aide={t('fournisseursAide')} icone={<UsersRound aria-hidden className="size-5" />} />
            </>
          ) : null}
          <LigneLien href="/stock/inventaire" titre={t('inventaire')} aide={t('inventaireAide')} icone={<ClipboardList aria-hidden className="size-5" />} />
          <LigneLien href="/stock/etiquettes" titre={t('etiquettes')} aide={t('etiquettesAide')} icone={<Tags aria-hidden className="size-5" />} />
          {gere && !vide ? <LigneLien href="/stock/import" titre={t('importer')} aide={t('importerAide')} icone={<FileSpreadsheet aria-hidden className="size-5" />} /> : null}
          <LigneLien href="/stock/mouvements" titre={t('historique')} aide={t('historiqueAide')} icone={<History aria-hidden className="size-5" />} />
        </div>
      </Page>
    </>
  );
}
