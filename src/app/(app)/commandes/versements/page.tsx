import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { enregistrerVersementAction } from '@/app/actions/argent';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, EtatVide, Message, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { colisAReverser, listerVersements } from '@/lib/depenses';
import { formaterDate, formaterMontant } from '@/lib/formats';
import { jourAlger } from '@/lib/rapports';
import { MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Argent des colis livrés : ce que le transporteur doit encore reverser, et les versements reçus. */
export default async function Versements({ searchParams }: { searchParams: Promise<{ fait?: string }> }) {
  const s = await pageUtilisateur('vendre', 'commandes');
  const t = await getTranslations('versements');
  const td = await getTranslations('pdf');
  const tc = await getTranslations('commandes');
  const langue = (await getLocale()) as Langue;
  const { colis, versements } = await avecCommercant(s.commercant.id, async (trx) => ({ colis: await colisAReverser(trx), versements: await listerVersements(trx) }));
  const attendu = colis.reduce((x, c) => x + c.montant, 0);
  const ecrit = s.commercant.etat === 'actif';
  const fait = (await searchParams).fait === '1';
  return (
    <>
      <EnTete titre={t('titre')} retour="/commandes" />
      <Page>
        {fait ? <Message ton="succes">{t('enregistre')}</Message> : null}
        <Carte>
          <p className="text-sm text-doux">{t('aReverser', { n: colis.length })}</p>
          <p className="text-2xl font-bold">{formaterMontant(attendu, langue)}</p>
        </Carte>
        {colis.length && ecrit ? (
          <Formulaire action={enregistrerVersementAction} bouton={t('enregistrer')}>
            <input type="hidden" name="cle" value={randomUUID()} />
            <p className="text-sm text-doux">{t('texte')}</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t('colis')}</legend>
              {colis.map((c) => (
                <label key={c.commandeId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-trait bg-surface px-3 py-2">
                  <input type="checkbox" name="commande" value={c.commandeId} defaultChecked className="size-5 shrink-0 accent-prim" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold">{tc('numero', { n: c.numero })} · {c.client}</span>
                    <span className="block text-doux">{c.transporteur ?? t('sansTransporteur')}{c.livreeLe ? <> · <span className="chiffres">{formaterDate(c.livreeLe)}</span></> : null}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{formaterMontant(c.montant, langue)}</span>
                </label>
              ))}
            </fieldset>
            <Champ libelle={t('recu')} name="recu" inputMode="decimal" dir="ltr" maxLength={14} required autoComplete="off" aide={t('recuAide')} />
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t('date')} name="recuLe" type="date" defaultValue={jourAlger()} dir="ltr" />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('mode')}</span>
                <select name="mode" defaultValue="virement" className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base">{MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}</select>
              </label>
            </div>
            <Champ libelle={t('reference')} name="reference" dir="ltr" maxLength={60} autoComplete="off" />
          </Formulaire>
        ) : !colis.length ? <EtatVide titre={t('rienTitre')} texte={t('rienTexte')} /> : null}

        <TitreSection>{t('historique')}</TitreSection>
        {versements.length ? (
          <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
            {versements.map((v) => (
              <li key={v.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3"><span className="font-semibold"><span className="chiffres">{formaterDate(v.recuLe)}</span> · {v.transporteur ?? t('plusieurs')}</span><span className="shrink-0 font-semibold">{formaterMontant(v.recu, langue)}</span></div>
                <p className="text-doux">{t('detail', { n: v.colis })} · {td(`mode_${v.mode}`)}{v.attendu !== v.recu ? ` · ${t('frais', { montant: formaterMontant(v.attendu - v.recu, langue) })}` : ''}{v.reference ? ` · ${v.reference}` : ''}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-doux">{t('aucun')}</p>}
        <Link href="/commandes" className="text-sm font-semibold text-prim underline">{t('retourCommandes')}</Link>
      </Page>
    </>
  );
}
