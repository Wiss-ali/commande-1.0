import { randomUUID } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireArrivage } from '@/components/FormulaireArrivage';
import { Page } from '@/components/Page';
import { Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerFournisseurs } from '@/lib/fournisseurs';
import { jourAlger } from '@/lib/rapports';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function NouvelArrivage({ searchParams }: { searchParams: Promise<{ fournisseur?: string }> }) {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const t = await getTranslations('fournisseurs');
  const { fournisseur } = await searchParams;
  const liste = await avecCommercant(s.commercant.id, (trx) => listerFournisseurs(trx));
  return (
    <>
      <EnTete titre={t('nouvelArrivage')} retour="/stock/arrivages" />
      <Page>
        {s.commercant.etat !== 'actif' ? <Message ton="info">{t('lectureSeule')}</Message> : (
          <FormulaireArrivage cle={randomUUID()} fournisseurs={liste.map((f) => ({ id: f.id, nom: f.nom }))} choisi={fournisseur && UUID.test(fournisseur) ? fournisseur : undefined} aujourdhui={jourAlger()} />
        )}
      </Page>
    </>
  );
}
