import { Truck } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { enregistrerFournisseurAction } from '@/app/actions/argent';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterMontant, formaterTelephone } from '@/lib/formats';
import { listerFournisseurs, totalDuFournisseurs } from '@/lib/fournisseurs';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Fournisseurs : ce qui leur est dû, et l'ajout d'un fournisseur. Réservé au propriétaire (prix d'achat). */
export default async function Fournisseurs({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const t = await getTranslations('fournisseurs');
  const langue = (await getLocale()) as Langue;
  const archives = (await searchParams).archives === '1';
  const { liste, du } = await avecCommercant(s.commercant.id, async (trx) => ({ liste: await listerFournisseurs(trx, { archives }), du: await totalDuFournisseurs(trx) }));
  const ecrit = s.commercant.etat === 'actif';
  return (
    <>
      <EnTete titre={t('titre')} retour="/stock" />
      <Page>
        {ecrit ? <Link href="/stock/arrivages/nouveau" className={classeBouton.principal}><Truck aria-hidden className="size-5" />{t('nouvelArrivage')}</Link> : null}
        <Link href="/stock/arrivages" className={classeBouton.secondaire}>{t('voirArrivages')}</Link>
        {du ? <p className="rounded-2xl border border-safran bg-safran-pale px-4 py-3 text-sm font-semibold text-sur-safran">{t('totalDu', { montant: formaterMontant(du, langue) })}</p> : null}
        {liste.length ? (
          <ul className="flex flex-col gap-2">
            {liste.map((f) => (
              <li key={f.id}>
                <Link href={`/stock/fournisseurs/${f.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{f.nom}</span>
                    {f.telephone ? <span className="chiffres block text-sm text-doux" dir="ltr">{formaterTelephone(f.telephone)}</span> : null}
                  </span>
                  <span className={`shrink-0 text-sm font-semibold ${f.du > 0 ? 'text-sur-safran' : 'text-doux'}`}>
                    {f.du > 0 ? t('onDoit', { montant: formaterMontant(f.du, langue) }) : f.du < 0 ? t('avance', { montant: formaterMontant(-f.du, langue) }) : t('rienDu')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t(archives ? 'aucunArchive' : 'videTitre')} texte={t(archives ? 'aucunArchiveTexte' : 'videTexte')} />
        )}
        <Link href={archives ? '/stock/fournisseurs' : '/stock/fournisseurs?archives=1'} className="text-sm font-semibold text-prim underline">{t(archives ? 'voirActifs' : 'voirArchives')}</Link>
        {ecrit && !archives ? (
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('ajouterTitre')}</h2>
            <Formulaire action={enregistrerFournisseurAction} bouton={t('ajouter')}>
              <Champ libelle={t('nom')} name="nom" maxLength={120} required autoComplete="off" />
              <Champ libelle={t('telephone')} name="telephone" type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" />
              <Champ libelle={t('note')} name="note" maxLength={300} autoComplete="off" aide={t('noteAide')} />
            </Formulaire>
          </Carte>
        ) : null}
      </Page>
    </>
  );
}
