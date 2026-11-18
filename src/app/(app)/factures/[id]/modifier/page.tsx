import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireDocument } from '@/components/FormulaireDocument';
import { Page } from '@/components/Page';
import { avecCommercant } from '@/lib/bd';
import { lireDocument } from '@/lib/documents';
import { montantPourSaisie } from '@/lib/formats';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ModifierDevis({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('vendre', 'factures');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('document');
  const d = await avecCommercant(s.commercant.id, (trx) => lireDocument(trx, id));
  if (!d || d.type !== 'devis' || d.etat !== 'en_attente') notFound();
  const a = d.acheteur;
  return (
    <>
      <EnTete titre={t('modifierDevis')} retour={`/factures/${id}`} />
      <Page>
        <FormulaireDocument
          type="devis" id={id} cle={randomUUID()} note={d.note}
          lignes={d.lignes.map((l) => ({ varianteId: l.varianteId, designation: l.designation, quantite: String(l.quantite), prix: montantPourSaisie(l.prixUnitaire), remise: l.remise ? montantPourSaisie(l.remise) : '' }))}
          client={a ? { nom: a.nom, telephone: a.telephone ?? '', adresse: a.adresse ?? '', nif: a.nif ?? '', rc: a.rc ?? '', nis: a.nis ?? '', ai: a.ai ?? '' } : {}}
        />
      </Page>
    </>
  );
}
