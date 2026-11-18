import { randomUUID } from 'node:crypto';
import { Phone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { archiverFournisseurAction, enregistrerFournisseurAction, payerFournisseurAction } from '@/app/actions/argent';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterMontant, formaterTelephone } from '@/lib/formats';
import { lireFournisseur } from '@/lib/fournisseurs';
import { MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Fournisseur({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('fournisseurs');
  const td = await getTranslations('pdf');
  const langue = (await getLocale()) as Langue;
  const f = await avecCommercant(s.commercant.id, (trx) => lireFournisseur(trx, id));
  if (!f) notFound();
  const ecrit = s.commercant.etat === 'actif';
  const select = 'min-h-12 rounded-xl border border-trait bg-surface px-3 text-base';
  return (
    <>
      <EnTete titre={f.nom} retour="/stock/fournisseurs" />
      <Page>
        <Carte className="flex flex-col gap-2">
          <p className="text-lg font-bold">{f.nom}</p>
          {f.telephone ? <a href={`tel:${f.telephone}`} className={classeBouton.secondaire}><Phone aria-hidden className="size-4" /><span className="chiffres" dir="ltr">{formaterTelephone(f.telephone)}</span></a> : null}
          {f.note ? <p className="text-sm text-doux">{f.note}</p> : null}
        </Carte>
        <Carte>
          <p className="text-sm text-doux">{t(f.du < 0 ? 'avanceTitre' : 'duTitre')}</p>
          <p className={`text-2xl font-bold ${f.du > 0 ? 'text-sur-safran' : ''}`}>{formaterMontant(Math.abs(f.du), langue)}</p>
        </Carte>

        {ecrit ? (
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('payerTitre')}</h2>
            <Formulaire action={payerFournisseurAction} bouton={t('payer')} succes={t('paye')}>
              <input type="hidden" name="fournisseur" value={f.id} />
              <input type="hidden" name="cle" value={randomUUID()} />
              <Champ libelle={t('montant')} name="montant" inputMode="decimal" dir="ltr" maxLength={14} required autoComplete="off" />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('mode')}</span>
                <select name="mode" defaultValue="especes" className={select}>{MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}</select>
              </label>
              <p className="text-sm text-doux">{t('payerAide')}</p>
              <Champ libelle={t('reference')} name="reference" dir="ltr" maxLength={60} autoComplete="off" />
            </Formulaire>
          </Carte>
        ) : null}

        <TitreSection>{t('arrivages')}</TitreSection>
        {f.arrivages.length ? (
          <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
            {f.arrivages.map((a) => (
              <li key={a.id}>
                <Link href={`/stock/arrivages/${a.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span><span className="font-semibold text-prim underline">{t('numeroArrivage', { n: a.numero })}</span> · <span className="chiffres text-doux">{formaterDate(a.recuLe)}</span>{a.reference ? <> · <span className="chiffres">{a.reference}</span></> : null}</span>
                  <span className="shrink-0 font-semibold">{formaterMontant(a.total, langue)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-doux">{t('aucunArrivage')}</p>}

        <TitreSection>{t('paiements')}</TitreSection>
        {f.paiements.length ? (
          <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
            {f.paiements.map((p) => (
              <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>{td(`mode_${p.mode}`)} · <span className="chiffres text-doux">{formaterDate(p.creeLe)}</span>{p.arrivageNumero ? <> · {t('numeroArrivage', { n: p.arrivageNumero })}</> : null}{p.reference ? <> · <span className="chiffres">{p.reference}</span></> : null}</span>
                <span className="shrink-0 font-semibold">{formaterMontant(p.montant, langue)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-doux">{t('aucunPaiement')}</p>}

        {ecrit ? (
          <details className="rounded-2xl border border-trait bg-surface shadow-doux">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-prim">{t('modifier')}</summary>
            <div className="flex flex-col gap-3 p-4 pt-0">
              <Formulaire action={enregistrerFournisseurAction} bouton={t('enregistrer')} succes={t('enregistre')} garder>
                <input type="hidden" name="id" value={f.id} />
                <Champ libelle={t('nom')} name="nom" defaultValue={f.nom} maxLength={120} required autoComplete="off" />
                <Champ libelle={t('telephone')} name="telephone" defaultValue={f.telephone ?? ''} type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" />
                <Champ libelle={t('note')} name="note" defaultValue={f.note} maxLength={300} autoComplete="off" />
              </Formulaire>
              <form action={archiverFournisseurAction}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="archiver" value={f.archive ? '0' : '1'} />
                <button type="submit" className={`${classeBouton.secondaire} w-full`}>{t(f.archive ? 'retablir' : 'archiver')}</button>
              </form>
            </div>
          </details>
        ) : null}
      </Page>
    </>
  );
}
