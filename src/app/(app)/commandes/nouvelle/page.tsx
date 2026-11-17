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
  const { wilayas, communes } = await avecCommercant(s.commercant.id, async (trx) => {
    const c = await trx.selectFrom('communes').select(['wilaya_code', 'nom_fr']).where('active', '=', true).orderBy('nom_fr').execute();
    const parWilaya: Record<number, string[]> = {};
    for (const l of c) (parWilaya[l.wilaya_code] ??= []).push(l.nom_fr);
    return { wilayas: await listerWilayas(trx), communes: parWilaya };
  });
  return (
    <>
      <EnTete titre={t('nouvelle')} retour="/commandes" />
      <Page>
        <FormulaireCommande cle={randomUUID()} wilayas={wilayas} communes={communes} />
      </Page>
    </>
  );
}
