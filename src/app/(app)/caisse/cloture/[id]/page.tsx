import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { resumeCaisse } from '@/lib/documents';
import { formaterDate, formaterHeure, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function RapportCloture({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('vendre', 'caisse');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('cloture');
  const langue = (await getLocale()) as Langue;
  const c = await avecCommercant(s.commercant.id, (trx) => resumeCaisse(trx, id));
  if (!c || !c.fermeeLe || c.attendues === null || c.comptees === null) notFound();
  const ecart = c.comptees - c.attendues;
  const ligne = (libelle: string, valeur: string, fort = false) => (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${fort ? 'text-lg font-bold' : ''}`}><dt className={fort ? '' : 'text-doux'}>{libelle}</dt><dd>{valeur}</dd></div>
  );
  return (
    <>
      <EnTete titre={t('rapportTitre')} retour="/caisse/cloture" />
      <Page>
        {ecart === 0 ? <Message ton="succes">{t('caisseJuste')}</Message> : <Message ton="info">{t(ecart > 0 ? 'enTrop' : 'manque', { montant: formaterMontant(Math.abs(ecart), langue) })}</Message>}
        <Carte>
          <p className="text-sm text-doux">{t('ouverte', { nom: c.ouvertePar })} <span className="chiffres">{formaterDate(c.ouverteLe)} {formaterHeure(c.ouverteLe)}</span></p>
          <p className="text-sm text-doux">{t('fermee', { nom: c.fermeePar ?? '' })} <span className="chiffres">{formaterDate(c.fermeeLe)} {formaterHeure(c.fermeeLe)}</span></p>
          <dl className="mt-2 divide-y divide-trait">
            {ligne(t('ventes'), String(c.ventes))}
            {ligne(t('fond'), formaterMontant(c.fond, langue))}
            {ligne(t('especes'), formaterMontant(c.especes, langue))}
            {ligne(t('remboursements'), formaterMontant(-c.remboursements, langue))}
            {ligne(t('attendues'), formaterMontant(c.attendues, langue), true)}
            {ligne(t('comptees'), formaterMontant(c.comptees, langue), true)}
            {ligne(t('ecart'), formaterMontant(ecart, langue), true)}
          </dl>
          {c.note ? <p className="mt-2 text-sm">{c.note}</p> : null}
        </Carte>
      </Page>
    </>
  );
}
