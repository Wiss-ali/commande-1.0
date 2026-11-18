import { Search } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerClients } from '@/lib/clients';
import { clientsQuiDoivent } from '@/lib/documents';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 40;

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; filtre?: string }> }) {
  const s = await pageUtilisateur('vendre', 'clients');
  const t = await getTranslations('clients');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const recherche = (params.q ?? '').slice(0, 40);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  // « Ils vous doivent » : les clients qui ont une vente à crédit pas encore payée.
  const doivent = params.filtre === 'doivent';
  const { clients, totalDu } = await avecCommercant(s.commercant.id, async (trx) => {
    const dettes = await clientsQuiDoivent(trx);
    return {
      clients: doivent
        ? dettes.map((d) => ({ id: d.id, nom: d.nom, commandes: 0, depense: 0, du: d.du, dernier: d.depuis }))
        : await listerClients(trx, { recherche, limite: PAR_PAGE * page + 1 }),
      totalDu: dettes.reduce((x, d) => x + d.du, 0),
    };
  });
  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        <form action="/clients" role="search" className="flex gap-2">
          <input type="search" name="q" defaultValue={recherche} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={40} className="min-h-12 min-w-0 flex-1 rounded-xl border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
          <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </form>
        <nav aria-label={t('filtres')} className="flex gap-2 overflow-x-auto">
          <Link href="/clients" aria-current={!doivent ? 'page' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${!doivent ? 'border-prim bg-prim text-sur-prim' : 'border-trait bg-surface'}`}>{t('tous')}</Link>
          <Link href="/clients?filtre=doivent" aria-current={doivent ? 'page' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${doivent ? 'border-prim bg-prim text-sur-prim' : 'border-trait bg-surface'}`}>{t('doivent')}</Link>
        </nav>
        {totalDu ? <p className="rounded-2xl border border-safran bg-safran-pale px-4 py-3 text-sm font-semibold text-sur-safran">{t('totalDu', { montant: formaterMontant(totalDu, langue) })}</p> : null}
        {clients.length ? (
          <ul className="flex flex-col gap-2">
            {clients.slice(0, PAR_PAGE * page).map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.nom}</span>
                    <span className="block truncate text-sm text-doux">
                      {doivent ? <>{t('depuisLe')} <span className="chiffres">{formaterDate(c.dernier!)}</span></> : <>{t('nbCommandes', { n: c.commandes })}{c.dernier ? <> · <span className="chiffres">{formaterDate(c.dernier)}</span></> : null}</>}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    {doivent ? null : <span className="block font-bold">{formaterMontant(c.depense, langue)}</span>}
                    {c.du ? <span className="block text-sm font-semibold text-sur-safran">{t('doit', { montant: formaterMontant(c.du, langue) })}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t(doivent ? 'personneDoitTitre' : recherche ? 'aucunTitre' : 'videTitre')} texte={t(doivent ? 'personneDoitTexte' : recherche ? 'aucunTexte' : 'videTexte')} />
        )}
        {!doivent && clients.length > PAR_PAGE * page ? <Link href={`/clients?${recherche ? `q=${encodeURIComponent(recherche)}&` : ''}page=${page + 1}`} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
      </Page>
    </>
  );
}
