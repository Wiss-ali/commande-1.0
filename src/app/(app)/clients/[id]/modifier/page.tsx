import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireClient } from '@/components/FormulaireClient';
import { Page } from '@/components/Page';
import { avecCommercant } from '@/lib/bd';
import { lireClient } from '@/lib/clients';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

/** Corriger la fiche d'un client : nom, téléphone, adresse, numéros légaux, note. */
export default async function ModifierClient({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('vendre', 'clients');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await avecCommercant(s.commercant.id, (trx) => lireClient(trx, id));
  if (!c) notFound();
  if (c.supprimeLe || s.commercant.etat !== 'actif') redirect(`/clients/${id}`);
  const t = await getTranslations('clients');
  return (
    <>
      <EnTete titre={t('modifierTitre')} retour={`/clients/${id}`} />
      <Page>
        <FormulaireClient id={c.id} nom={c.nom} telephone={c.telephone ?? ''} details={c.details} note={c.note} />
      </Page>
    </>
  );
}
