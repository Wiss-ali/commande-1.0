import { MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { PastilleCommande } from '@/components/PastilleCommande';
import { Formulaire } from '@/components/Formulaire';
import { Carte, Champ, classeBouton, Message, Pastille, TitreSection } from '@/components/ui';
import { effacerClient } from '@/app/actions/clients';
import { encaisserCredit } from '@/app/actions/ventes';
import { autorise } from '@/lib/droits';
import { avecCommercant } from '@/lib/bd';
import { lireClient } from '@/lib/clients';
import { listerCommandes } from '@/lib/commandes';
import { dettesClient, numeroTexte } from '@/lib/documents';
import { MODES_ENCAISSEMENT } from '@/lib/types-bd';
import { randomUUID } from 'node:crypto';
import { formaterDate, formaterMontant, formaterTelephone } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Client({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ verse?: string }> }) {
  const s = await pageUtilisateur('vendre', 'clients');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('clients');
  const tc = await getTranslations('commandes');
  const td = await getTranslations('pdf');
  const tf = await getTranslations('factures');
  const langue = (await getLocale()) as Langue;
  const { c, commandes, dettes } = await avecCommercant(s.commercant.id, async (trx) => ({
    c: await lireClient(trx, id),
    commandes: await listerCommandes(trx, { filtre: 'toutes', clientId: id, limite: 50 }),
    dettes: await dettesClient(trx, id),
  }));
  const tp = await getTranslations('paiement');
  const verse = Boolean((await searchParams).verse);
  if (!c) notFound();
  const voirCommandes = s.commercant.modules.commandes;
  return (
    <>
      <EnTete titre={c.nom} retour="/clients" />
      <Page>
        {verse ? <Message ton="succes">{tp('versementFait')}</Message> : null}
        <Carte className="flex flex-col gap-2">
          <p className="text-lg font-bold">{c.nom}</p>
          {c.telephone ? <p className="chiffres text-lg" dir="ltr">{formaterTelephone(c.telephone)}</p> : null}
          <p className="text-sm text-doux">{t('depuis')} <span className="chiffres">{formaterDate(c.creeLe)}</span></p>
          {c.supprimeLe ? <Message ton="info">{t('donneesSupprimees', { date: formaterDate(c.supprimeLe) })}</Message> : null}
          {c.telephone ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a href={`tel:${c.telephone}`} className={classeBouton.secondaire}><Phone aria-hidden className="size-4" />{tc('appeler')}</a>
              <a href={`https://wa.me/213${c.telephone.slice(1)}`} target="_blank" rel="noopener noreferrer" className={classeBouton.secondaire}><MessageCircle aria-hidden className="size-4" />{tc('whatsapp')}</a>
            </div>
          ) : null}
        </Carte>

        <div className="grid grid-cols-2 gap-2">
          <Carte><p className="text-sm text-doux">{t('depense')}</p><p className="text-xl font-bold">{formaterMontant(c.depense, langue)}</p></Carte>
          <Carte><p className="text-sm text-doux">{t('tauxRetour')}</p><p className={`chiffres text-xl font-bold ${c.tauxRetour ? 'text-terre' : ''}`}>{c.tauxRetour === null ? '—' : `${c.tauxRetour} %`}</p></Carte>
        </div>
        {c.du > 0 ? (
          <Carte className="flex flex-col gap-3 border-safran">
            <div><p className="text-sm text-doux">{t('resteDu')}</p><p className="text-2xl font-bold text-sur-safran">{formaterMontant(c.du, langue)}</p></div>
            <ul className="flex flex-col divide-y divide-trait text-sm">
              {dettes.map((d) => (
                <li key={d.documentId}>
                  <Link href={`/factures/${d.documentId}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span><span className="font-semibold text-prim underline">{td(`type_${d.type}`)} <span className="chiffres">{numeroTexte(d)}</span></span> · <span className="chiffres text-doux">{formaterDate(d.emisLe)}</span></span>
                    <span className="shrink-0 font-semibold">{formaterMontant(d.reste, langue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {s.commercant.etat === 'actif' ? (
              <Formulaire action={encaisserCredit} bouton={tp('versementBouton')}>
                <input type="hidden" name="client" value={c.id} />
                <input type="hidden" name="cle" value={randomUUID()} />
                <p className="text-sm text-doux">{tp('versementTexte')}</p>
                <Champ libelle={tp('montant')} name="montant" inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" required />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tp('mode')}</span>
                  <select name="mode" defaultValue="especes" className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                    {MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}
                  </select>
                </label>
                <Champ libelle={tp('reference')} name="reference" dir="ltr" maxLength={60} autoComplete="off" aide={tp('referenceAide')} />
              </Formulaire>
            ) : null}
          </Carte>
        ) : null}
        <p className="text-sm text-doux">{t('resume', { achats: c.achats, commandes: c.commandes, livrees: c.livrees, retournees: c.retournees, annulees: c.annulees })}</p>

        {voirCommandes && commandes.length ? (
          <>
            <TitreSection>{t('commandes')}</TitreSection>
            <ul className="flex flex-col gap-2">
              {commandes.map((l) => (
                <li key={l.id}>
                  <Link href={`/commandes/${l.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-2">
                    <span className="min-w-0"><span className="chiffres block font-semibold">{tc('numero', { n: l.numero })}</span><span className="chiffres block text-sm text-doux">{formaterDate(l.cree_le)}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-bold">{formaterMontant(BigInt(l.total), langue)}</span><PastilleCommande statut={l.statut} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {!c.supprimeLe && autorise(s.utilisateur, 'reglages') && s.commercant.etat === 'actif' ? (
          <details className="rounded-2xl border border-trait bg-surface shadow-doux">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-terre">{t('supprimerTitre')}</summary>
            <div className="p-4 pt-0">
              <Formulaire action={effacerClient} bouton={t('supprimerBouton')} style="danger">
                <input type="hidden" name="id" value={c.id} />
                <p className="text-sm text-doux">{t('supprimerTexte')}</p>
                <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" name="confirmer" required className="size-5 accent-prim" /><span className="text-sm">{t('supprimerConfirmer')}</span></label>
              </Formulaire>
            </div>
          </details>
        ) : null}

        <TitreSection>{t('documents')}</TitreSection>
        {c.documents.length ? (
          <ul className="flex flex-col gap-2">
            {c.documents.map((d) => (
              <li key={d.id}>
                <Link href={`/factures/${d.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-2">
                  <span className="min-w-0"><span className="block text-sm text-doux">{td(`type_${d.type}`)}</span><span className="chiffres block font-semibold">{numeroTexte(d)}</span></span>
                  <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-bold">{formaterMontant(d.total, langue)}</span>{d.annule ? <Pastille ton="terre">{tf('annule')}</Pastille> : null}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-doux">{t('aucunDocument')}</p>}
      </Page>
    </>
  );
}
