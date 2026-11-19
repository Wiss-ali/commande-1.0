import { randomUUID } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireDocument } from '@/components/FormulaireDocument';
import { Page } from '@/components/Page';
import { peutRemiser } from '@/lib/droits';
import { pageUtilisateur } from '@/lib/web';

const TYPES = ['devis', 'proforma', 'bon_commande'] as const;

export default async function NouveauDocument({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const s = await pageUtilisateur('vendre', 'factures');
  const t = await getTranslations('document');
  const demande = (await searchParams).type;
  const type = TYPES.find((x) => x === demande) ?? 'devis';
  return (
    <>
      <EnTete titre={t(`nouveau_${type}`)} retour={`/factures?onglet=${type === 'devis' ? 'devis' : 'autres'}`} />
      <Page>
        <FormulaireDocument type={type} cle={randomUUID()} lignes={[]} client={{}} note="" prixModifiables={peutRemiser(s.utilisateur)} />
      </Page>
    </>
  );
}
