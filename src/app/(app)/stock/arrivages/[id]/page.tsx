import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterHeure, formaterMontant, nomLocal } from '@/lib/formats';
import { lireArrivage } from '@/lib/fournisseurs';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Arrivage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('fournisseurs');
  const langue = (await getLocale()) as Langue;
  const a = await avecCommercant(s.commercant.id, (trx) => lireArrivage(trx, id));
  if (!a) notFound();
  void searchParams;
  return (
    <>
      <EnTete titre={t('numeroArrivage', { n: a.numero })} retour="/stock/arrivages" />
      <Page>
        <Carte className="flex flex-col gap-1.5 text-sm">
          <p className="text-base font-semibold">{a.fournisseur ? <Link href={`/stock/fournisseurs/${a.fournisseur.id}`} className="text-prim underline">{a.fournisseur.nom}</Link> : t('sansFournisseur')}</p>
          <p className="text-doux">{t('recuLe')} <span className="chiffres">{formaterDate(a.recuLe)}</span>{a.reference ? <> · {t('reference')} <span className="chiffres">{a.reference}</span></> : null}</p>
          <p className="text-doux">{t('saisiPar', { nom: a.creePar })} <span className="chiffres">{formaterDate(a.creeLe)} {formaterHeure(a.creeLe)}</span></p>
          {a.note ? <p>{a.note}</p> : null}
        </Carte>
        <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
          {a.lignes.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
              <Link href={`/stock/${l.produitId}`} className="min-w-0">
                <span className="block font-medium underline">{nomLocal({ nom_fr: l.nomFr, nom_ar: l.nomAr }, langue)}{l.libelle ? ` · ${l.libelle}` : ''}</span>
                <span className="block text-sm text-doux"><span className="chiffres">{l.quantite} ×</span> {formaterMontant(l.coutUnitaire, langue)}</span>
              </Link>
              <span className="shrink-0 font-semibold">{formaterMontant(l.quantite * l.coutUnitaire, langue)}</span>
            </li>
          ))}
        </ul>
        <Carte>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3 text-xl font-bold"><dt>{t('total')}</dt><dd>{formaterMontant(a.total, langue)}</dd></div>
            {a.fournisseur ? <div className="flex justify-between gap-3"><dt className="text-doux">{t('payeArrivage')}</dt><dd>{formaterMontant(a.paye, langue)}</dd></div> : null}
          </dl>
          <p className="mt-2 text-sm text-doux">{t('stockEntre')}</p>
        </Carte>
      </Page>
    </>
  );
}
