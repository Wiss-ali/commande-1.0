import { randomUUID } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireCommande } from '@/components/FormulaireCommande';
import { Page } from '@/components/Page';
import { avecCommercant } from '@/lib/bd';
import { listerWilayas } from '@/lib/commandes';
import { pageUtilisateur } from '@/lib/web';

export default async function NouvelleCommande() {
  const s = await pageUtilisateur('vendre', 'commandes');
  const t = await getTranslations('commandes');
  const wilayas = await avecCommercant(s.commercant.id, listerWilayas);
  return (
    <>
      <EnTete titre={t('nouvelle')} retour="/commandes" />
      <Page>
        <FormulaireCommande cle={randomUUID()} wilayas={wilayas} />
      </Page>
    </>
  );
}
