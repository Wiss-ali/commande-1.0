import { Plus, Search, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { PastilleCommande } from '@/components/PastilleCommande';
import { classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { compterParFiltre, listerCommandes, type FiltreCommandes } from '@/lib/commandes';
import { autorise } from '@/lib/droits';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 30;
const FILTRES: readonly FiltreCommandes[] = ['a_confirmer', 'a_expedier', 'en_cours', 'terminees', 'toutes'];

export default async function Commandes({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; page?: string }> }) {
  const s = await pageUtilisateur('preparer', 'commandes');
  const t = await getTranslations('commandes');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const preparateur = !autorise(s.utilisateur, 'vendre');
  const parDefaut: FiltreCommandes = preparateur ? 'a_expedier' : 'a_confirmer';
  const filtre = FILTRES.find((f) => f === params.f) ?? parDefaut;
  const recherche = (params.q ?? '').slice(0, 40);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  const { commandes, compteurs } = await avecCommercant(s.commercant.id, async (trx) => ({
    commandes: await listerCommandes(trx, { filtre: recherche ? 'toutes' : filtre, recherche, limite: PAR_PAGE * page + 1 }),
    compteurs: await compterParFiltre(trx),
  }));
  const ecrit = s.commercant.etat === 'actif' && !preparateur;

  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        {ecrit ? <Link href="/commandes/nouvelle" className={classeBouton.principal}><Plus aria-hidden className="size-5" />{t('nouvelle')}</Link> : null}
        <nav aria-label={t('filtres')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTRES.map((f) => {
            const n = f in compteurs ? compteurs[f as keyof typeof compteurs] : 0;
            return (
              <Link key={f} href={`/commandes?f=${f}`} aria-current={f === filtre && !recherche ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${f === filtre && !recherche ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
                {t(`filtre.${f}`)}
                {n ? <span className="chiffres rounded-full bg-safran px-1.5 text-xs text-encre">{n}</span> : null}
              </Link>
            );
          })}
        </nav>
        <form action="/commandes" role="search" className="flex gap-2">
          <input type="search" name="q" defaultValue={recherche} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={40} className="min-h-12 min-w-0 flex-1 rounded-xl border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
          <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </form>

        {commandes.length ? (
          <ul className="flex flex-col gap-2">
            {commandes.slice(0, PAR_PAGE * page).map((c) => (
              <li key={c.id}>
                <Link href={`/commandes/${c.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="chiffres font-semibold">{t('numero', { n: c.numero })}</span>
                      {c.retours ? <TriangleAlert aria-label={t('alerteCourte')} className="size-4 text-terre" /> : null}
                    </span>
                    <span className="block truncate text-sm">{c.client}</span>
                    <span className="block truncate text-sm text-doux">
                      <span className="chiffres">{String(c.wilaya_code).padStart(2, '0')}</span> {c.commune} · <span className="chiffres">{formaterDate(c.cree_le)}</span>
                      {c.tentatives_appel ? <> · {t('appels', { n: c.tentatives_appel })}</> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold">{formaterMontant(BigInt(c.total), langue)}</span>
                    <PastilleCommande statut={c.statut} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t(recherche ? 'aucuneTitre' : `vide.${filtre}`)} texte={t(recherche ? 'aucuneTexte' : 'videTexte')} />
        )}
        {commandes.length > PAR_PAGE * page ? <Link href={`/commandes?f=${filtre}${recherche ? `&q=${encodeURIComponent(recherche)}` : ''}&page=${page + 1}`} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
      </Page>
    </>
  );
}
