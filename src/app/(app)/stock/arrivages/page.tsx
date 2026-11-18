import { Truck } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterMontant } from '@/lib/formats';
import { listerArrivages } from '@/lib/fournisseurs';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

export default async function Arrivages() {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const t = await getTranslations('fournisseurs');
  const langue = (await getLocale()) as Langue;
  const liste = await avecCommercant(s.commercant.id, (trx) => listerArrivages(trx, 100));
  return (
    <>
      <EnTete titre={t('arrivagesTitre')} retour="/stock" />
      <Page>
        {s.commercant.etat === 'actif' ? <Link href="/stock/arrivages/nouveau" className={classeBouton.principal}><Truck aria-hidden className="size-5" />{t('nouvelArrivage')}</Link> : null}
        <Link href="/stock/fournisseurs" className={classeBouton.secondaire}>{t('titre')}</Link>
        {liste.length ? (
          <ul className="flex flex-col gap-2">
            {liste.map((a) => (
              <li key={a.id}>
                <Link href={`/stock/arrivages/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t('numeroArrivage', { n: a.numero })} · <span className="chiffres">{formaterDate(a.recuLe)}</span></span>
                    <span className="block truncate text-sm text-doux">{a.fournisseur ?? t('sansFournisseur')}{a.reference ? ` · ${a.reference}` : ''}</span>
                  </span>
                  <span className="shrink-0 font-bold">{formaterMontant(a.total, langue)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t('aucunArrivageTitre')} texte={t('aucunArrivageTexte')} />
        )}
      </Page>
    </>
  );
}
