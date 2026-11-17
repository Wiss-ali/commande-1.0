import { Search } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerClients } from '@/lib/clients';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 40;

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const s = await pageUtilisateur('vendre', 'clients');
  const t = await getTranslations('clients');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const recherche = (params.q ?? '').slice(0, 40);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  const clients = await avecCommercant(s.commercant.id, (trx) => listerClients(trx, { recherche, limite: PAR_PAGE * page + 1 }));
  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        <form action="/clients" role="search" className="flex gap-2">
          <input type="search" name="q" defaultValue={recherche} aria-label={t('chercher')} placeholder={t('chercher')} maxLength={40} className="min-h-12 min-w-0 flex-1 rounded-lg border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
          <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </form>
        {clients.length ? (
          <ul className="flex flex-col gap-2">
            {clients.slice(0, PAR_PAGE * page).map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-trait bg-surface p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.nom}</span>
                    <span className="block truncate text-sm text-doux">
                      {t('nbCommandes', { n: c.commandes })}{c.dernier ? <> · <span className="chiffres">{formaterDate(c.dernier)}</span></> : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold">{formaterMontant(c.depense, langue)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t(recherche ? 'aucunTitre' : 'videTitre')} texte={t(recherche ? 'aucunTexte' : 'videTexte')} />
        )}
        {clients.length > PAR_PAGE * page ? <Link href={`/clients?${recherche ? `q=${encodeURIComponent(recherche)}&` : ''}page=${page + 1}`} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
      </Page>
    </>
  );
}
