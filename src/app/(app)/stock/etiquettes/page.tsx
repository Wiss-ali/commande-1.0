import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { donnerCodeInterne } from '@/app/actions/stock';
import { BoutonImprimer } from '@/components/BoutonImprimer';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, classeBouton, EtatVide, Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { peut } from '@/lib/droits';
import { codeEnImage } from '@/lib/etiquettes';
import { formaterMontant, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_ARTICLES = 60;
const MAX_ETIQUETTES = 500;
const FORMATS = ['planche', 'rouleau'] as const;

type Params = Record<string, string | string[] | undefined>;
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function Etiquettes({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('etiquettes');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const produitId = UUID.test(un(params.produit)) ? un(params.produit) : '';
  const q = un(params.q).trim().slice(0, 80);
  const imprimer = un(params.imprimer) === '1';
  const forme = un(params.forme) === 'qr' ? 'qr' : 'barres';
  const format = FORMATS.find((f) => f === un(params.format)) ?? 'planche';
  const avecPrix = !imprimer || un(params.prix) === '1';

  const articles = await avecCommercant(s.commercant.id, (trx) => {
    let requete = trx
      .selectFrom('variantes as v')
      .innerJoin('produits as p', 'p.id', 'v.produit_id')
      .select(['v.id', 'v.libelle', 'v.code_barres', 'v.prix_vente', 'p.nom_fr', 'p.nom_ar'])
      .where('v.archive_le', 'is', null);
    if (produitId) requete = requete.where('p.id', '=', produitId);
    if (q) {
      const motif = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      requete = requete.where((eb) => eb.or([eb('p.nom_fr', 'ilike', motif), eb('p.nom_ar', 'ilike', motif), eb('v.code_barres', '=', q)]));
    }
    return requete.orderBy('p.nom_fr').orderBy('p.nom_ar').orderBy('v.ordre').limit(MAX_ARTICLES).execute();
  });
  const gere = peut(s.utilisateur.role, 'stock.corriger') && s.commercant.etat === 'actif';

  if (imprimer) {
    const etiquettes: { cle: string; nom: string; libelle: string; prix: string; image: string }[] = [];
    for (const a of articles) {
      if (!a.code_barres) continue;
      const n = Math.min(Math.max(Math.trunc(Number(un(params[`n_${a.id}`])) || 0), 0), 100);
      if (!n) continue;
      const image = codeEnImage(a.code_barres, forme);
      for (let i = 0; i < n && etiquettes.length < MAX_ETIQUETTES; i++) {
        etiquettes.push({ cle: `${a.id}-${i}`, nom: nomLocal(a, langue), libelle: a.libelle, prix: formaterMontant(BigInt(a.prix_vente), langue), image });
      }
    }
    const retour = new URLSearchParams({ ...(produitId ? { produit: produitId } : {}), ...(q ? { q } : {}) }).toString();
    return (
      <>
        <div className="print:hidden"><EnTete titre={t('titre')} retour={`/stock/etiquettes${retour ? `?${retour}` : ''}`} /></div>
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 print:max-w-none print:p-0">
          {etiquettes.length ? (
            <>
              <div className="flex flex-col gap-2 print:hidden">
                <BoutonImprimer texte={t('imprimer', { n: etiquettes.length })} />
                <p className="text-sm text-doux">{t(format === 'rouleau' ? 'aideRouleau' : 'aidePlanche')}</p>
              </div>
              <ul className={format === 'rouleau' ? 'etiquettes-rouleau' : 'etiquettes-planche'}>
                {etiquettes.map((e) => (
                  <li key={e.cle} className="etiquette">
                    <span className="etiquette-nom">{e.nom}{e.libelle ? ` · ${e.libelle}` : ''}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.image} alt="" />
                    {avecPrix ? <span className="etiquette-prix">{e.prix}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EtatVide titre={t('rienTitre')} texte={t('rienTexte')} />
          )}
        </main>
      </>
    );
  }

  const sansCode = articles.filter((a) => !a.code_barres);
  return (
    <>
      <EnTete titre={t('titre')} retour={produitId ? `/stock/${produitId}` : '/stock'} />
      <Page>
        {produitId ? null : (
          <form action="/stock/etiquettes" role="search" className="flex gap-2">
            <input type="search" name="q" defaultValue={q} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={80} className="min-h-12 min-w-0 flex-1 rounded-lg border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
            <button type="submit" className={`${classeBouton.secondaire} min-h-12`}>{t('filtrer')}</button>
          </form>
        )}
        {articles.length === 0 ? (
          <EtatVide titre={t('videTitre')} texte={t('videTexte')}>
            <Link href="/stock" className={`${classeBouton.secondaire} mt-2`}>{t('retourStock')}</Link>
          </EtatVide>
        ) : (
          <>
            {sansCode.length ? (
              <Carte className="flex flex-col gap-3">
                <p className="text-sm">{t(gere ? 'sansCode' : 'sansCodeEmploye', { n: sansCode.length })}</p>
                {gere ? (
                  <ul className="flex flex-col gap-2">
                    {sansCode.map((a) => (
                      <li key={a.id} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nomLocal(a, langue)}{a.libelle ? ` · ${a.libelle}` : ''}</span>
                        <form action={donnerCodeInterne}>
                          <input type="hidden" name="variante" value={a.id} />
                          <button type="submit" className={classeBouton.secondaire}>{t('creerCode')}</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Carte>
            ) : null}
            {articles.length > sansCode.length ? (
              <form action="/stock/etiquettes" className="flex flex-col gap-4">
                <input type="hidden" name="imprimer" value="1" />
                {produitId ? <input type="hidden" name="produit" value={produitId} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}
                <Carte className="flex flex-col gap-3">
                  <h2 className="font-semibold">{t('combien')}</h2>
                  <ul className="flex flex-col divide-y divide-trait">
                    {articles.filter((a) => a.code_barres).map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-2">
                        <label htmlFor={`n_${a.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{nomLocal(a, langue)}{a.libelle ? ` · ${a.libelle}` : ''}</span>
                          <span className="chiffres text-sm text-doux">{a.code_barres}</span>
                        </label>
                        <input id={`n_${a.id}`} name={`n_${a.id}`} type="number" min={0} max={100} defaultValue={produitId ? 1 : 0} inputMode="numeric" dir="ltr" className="chiffres min-h-12 w-20 rounded-lg border border-trait bg-surface px-2 text-center text-base" />
                      </li>
                    ))}
                  </ul>
                </Carte>
                <Carte className="flex flex-col gap-3">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium">{t('forme')}</legend>
                    {(['barres', 'qr'] as const).map((f) => (
                      <label key={f} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-trait px-3">
                        <input type="radio" name="forme" value={f} defaultChecked={f === 'barres'} className="size-5 accent-vert" />
                        <span className="text-sm">{t(`forme_${f}`)}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium">{t('format')}</legend>
                    {FORMATS.map((f) => (
                      <label key={f} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-trait px-3">
                        <input type="radio" name="format" value={f} defaultChecked={f === 'planche'} className="size-5 accent-vert" />
                        <span className="text-sm">{t(`format_${f}`)}</span>
                      </label>
                    ))}
                  </fieldset>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3">
                    <input type="checkbox" name="prix" value="1" defaultChecked className="size-5 accent-vert" />
                    <span className="text-sm">{t('avecPrix')}</span>
                  </label>
                </Carte>
                <button type="submit" className={classeBouton.principal}>{t('preparer')}</button>
              </form>
            ) : null}
            {articles.length === MAX_ARTICLES ? <Message ton="info">{t('tropArticles', { n: MAX_ARTICLES })}</Message> : null}
          </>
        )}
      </Page>
    </>
  );
}
