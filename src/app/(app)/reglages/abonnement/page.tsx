import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, Message, Pastille, TitreSection } from '@/components/ui';
import { listerPaiements, situation } from '@/lib/abonnements';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Abonnement du commerçant : formule, dates, modules compris, paiements. Le renouvellement passe par l'administrateur. */
export default async function Abonnement() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('abonnement');
  const tm = await getTranslations('modules');
  const tmo = await getTranslations('moyens');
  const langue = (await getLocale()) as Langue;
  const { ab, paiements } = await avecCommercant(s.commercant.id, async (trx) => ({
    ab: await situation(trx, s.commercant.id), paiements: await listerPaiements(trx, { commercantId: s.commercant.id, limite: 24 }),
  }));
  const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <Carte className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold">{ab.formule?.nom ?? t('sansFormule')}</p>
            {ab.etat !== 'sans' ? <Pastille ton={ab.etat === 'actif' ? 'vert' : ab.etat === 'lecture_seule' ? 'terre' : 'safran'}>{t(`etat.${ab.etat}`)}</Pastille> : null}
          </div>
          {ab.debut && ab.fin ? <p className="text-sm">{t('periode', { du: date(ab.debut), au: date(ab.fin) })}</p> : <p className="text-sm text-doux">{t('sansTexte')}</p>}
          {ab.joursRestants !== null && ab.joursRestants > 0 ? <p className="text-sm text-doux">{t('restant', { n: ab.joursRestants })}</p> : null}
          {ab.etat === 'delai' && ab.finDelai ? <Message ton="info">{t('delai', { date: date(ab.finDelai) })}</Message> : null}
          {ab.etat === 'lecture_seule' ? <Message ton="info">{t('lectureSeule')}</Message> : null}
        </Carte>
        {ab.autorises ? (
          <Carte>
            <h2 className="font-semibold">{t('modulesTitre')}</h2>
            <p className="mt-1 text-sm">{[...ab.autorises].map((m) => tm(m)).join(', ')}</p>
          </Carte>
        ) : null}
        <p className="text-sm text-doux">{t('renouveler')}</p>
        {paiements.length ? (
          <>
            <TitreSection>{t('paiements')}</TitreSection>
            <ul className="flex flex-col divide-y divide-trait rounded-xl border border-trait bg-surface text-sm">
              {paiements.map((p) => (
                <li key={p.id} className="flex flex-col px-4 py-3">
                  <span className="flex justify-between gap-3"><span>{date(p.recu_le)} · {tmo(p.moyen)}</span><span className="font-semibold">{formaterMontant(BigInt(p.montant), langue)}</span></span>
                  {p.debut && p.fin ? <span className="text-doux">{p.formule} · {date(p.debut)} → {date(p.fin)}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Page>
    </>
  );
}
