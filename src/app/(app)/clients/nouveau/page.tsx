import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireClient } from '@/components/FormulaireClient';
import { Page } from '@/components/Page';
import { pageUtilisateur } from '@/lib/web';

/** Ajouter un client à la main, avant toute vente ou commande. */
export default async function NouveauClient() {
  const s = await pageUtilisateur('vendre', 'clients');
  if (s.commercant.etat !== 'actif') redirect('/clients');
  const t = await getTranslations('clients');
  return (
    <>
      <EnTete titre={t('nouveauTitre')} retour="/clients" />
      <Page>
        <FormulaireClient />
      </Page>
    </>
  );
}
