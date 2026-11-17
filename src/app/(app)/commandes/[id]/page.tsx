import { randomUUID } from 'node:crypto';
import { MessageCircle, Phone, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { agirCommande } from '@/app/actions/commandes';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { PastilleCommande } from '@/components/PastilleCommande';
import { Carte, classeBouton, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { A_CONFIRMER, A_EXPEDIER, lireCommande, listerTransporteurs } from '@/lib/commandes';
import { numeroTexte } from '@/lib/documents';
import { autorise } from '@/lib/droits';
import { formaterDate, formaterHeure, formaterMontant, formaterTelephone, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

/** Bouton d'une opération : chaque envoi porte sa propre clé, un double toucher ne fait rien de plus. */
function Operation({ id, op, bouton, style = 'secondaire', children }: { id: string; op: string; bouton: string; style?: 'principal' | 'secondaire' | 'danger'; children?: React.ReactNode }) {
  return (
    <Formulaire action={agirCommande} bouton={bouton} style={style} garder>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="cle" value={randomUUID()} />
      {children}
    </Formulaire>
  );
}

export default async function Commande({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('preparer', 'commandes');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('commandes');
  const td = await getTranslations('pdf');
  const langue = (await getLocale()) as Langue;
  const { c, transporteurs } = await avecCommercant(s.commercant.id, async (trx) => ({ c: await lireCommande(trx, id), transporteurs: await listerTransporteurs(trx) }));
  if (!c) notFound();
  const ecrit = s.commercant.etat === 'actif';
  const vend = autorise(s.utilisateur, 'vendre');
  const telephoneWa = c.client.telephone ? `213${c.client.telephone.slice(1)}` : null;
  const aConfirmer = A_CONFIRMER.includes(c.statut);
  const aExpedier = A_EXPEDIER.includes(c.statut);
  const documents = [c.devis, c.facture, c.avoir].filter((d) => d !== null);

  return (
    <>
      <EnTete titre={t('numero', { n: c.numero })} retour="/commandes" />
      <Page>
        {c.alerte.retours + c.alerte.annulations > 0 ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-terre bg-terre-pale px-3 py-2.5 text-sm font-semibold text-terre">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('alerte', { retours: c.alerte.retours, annulations: c.alerte.annulations })}
          </p>
        ) : null}

        <Carte className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="chiffres text-lg font-bold">{t('numero', { n: c.numero })}</p>
            <PastilleCommande statut={c.statut} />
            {c.origine === 'boutique' ? <span className="text-sm text-doux">{t('origineBoutique')}</span> : null}
          </div>
          <div>
            {c.statut === 'nouvelle' && c.reservationJusqua ? <p className="text-sm text-doux">{t('reserveJusqua', { date: `${formaterDate(c.reservationJusqua)} ${formaterHeure(c.reservationJusqua)}` })}</p> : null}
          </div>
          <p className="text-sm text-doux"><span className="chiffres">{formaterDate(c.creeLe)} {formaterHeure(c.creeLe)}</span></p>
          <div className="border-t border-trait pt-2">
            <p className="font-semibold"><Link href={`/clients/${c.client.id}`} className="underline">{c.client.nom}</Link></p>
            {c.client.telephone ? <p className="chiffres text-lg" dir="ltr">{formaterTelephone(c.client.telephone)}</p> : null}
            <p className="text-sm">
              <span className="chiffres">{String(c.wilaya.code).padStart(2, '0')}</span> {nomLocal(c.wilaya, langue)} · {c.commune}
            </p>
            <p className="text-sm text-doux">{t(`mode_${c.livraison}`)}{c.adresse ? ` · ${c.adresse}` : ''}</p>
          </div>
          {c.client.telephone && vend ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a href={`tel:${c.client.telephone}`} className={classeBouton.secondaire}><Phone aria-hidden className="size-4" />{t('appeler')}</a>
              <a href={`https://wa.me/${telephoneWa}`} target="_blank" rel="noopener noreferrer" className={classeBouton.secondaire}><MessageCircle aria-hidden className="size-4" />{t('whatsapp')}</a>
            </div>
          ) : null}
          {c.tentatives ? <p className="text-sm text-doux">{t('appels', { n: c.tentatives })}{c.dernierAppel ? <> · <span className="chiffres">{formaterDate(c.dernierAppel)} {formaterHeure(c.dernierAppel)}</span></> : null}</p> : null}
        </Carte>

        <ul className="flex flex-col divide-y divide-trait rounded-xl border border-trait bg-surface">
          {c.lignes.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
              <p className="min-w-0"><span className="chiffres">{l.quantite} ×</span> {l.designation}</p>
              <p className="shrink-0 font-semibold">{formaterMontant(l.totalTtc, langue)}</p>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 px-4 py-3 text-xl font-bold"><span>{t('totalClient')}</span><span>{formaterMontant(c.total, langue)}</span></li>
        </ul>
        {c.note ? <p className="text-sm">{c.note}</p> : null}

        {c.expedieeLe ? (
          <Carte className="flex flex-col gap-1 text-sm">
            <p>{t('expedieeLe')} <span className="chiffres">{formaterDate(c.expedieeLe)}</span>{c.transporteur ? ` · ${c.transporteur}` : ''}</p>
            {c.numeroSuivi ? <p>{t('suivi')} : <span className="chiffres font-semibold" dir="ltr">{c.numeroSuivi}</span></p> : null}
            {c.livreeLe ? <p>{t('livreeLe')} <span className="chiffres">{formaterDate(c.livreeLe)}</span></p> : null}
            {c.retourneeLe ? <p>{t('retourneeLe')} <span className="chiffres">{formaterDate(c.retourneeLe)}</span></p> : null}
          </Carte>
        ) : null}

        {ecrit ? (
          <>
            {aConfirmer && vend ? (
              <Carte className="flex flex-col gap-3">
                <h2 className="font-semibold">{t('confirmerTitre')}</h2>
                <p className="text-sm text-doux">{t('confirmerTexte')}</p>
                <Operation id={id} op="confirmer_envoi" bouton={t('confirmer_envoi')} style="principal" />
                <Operation id={id} op="confirmer_directe" bouton={t('confirmer_directe')} />
                <Operation id={id} op="appel" bouton={t('pasDeReponse')} />
                <Link href={`/factures/${c.devis.id}/modifier`} className={classeBouton.secondaire}>{t('modifierArticles')}</Link>
              </Carte>
            ) : null}
            {c.statut === 'confirmee' ? <Operation id={id} op="preparer" bouton={t('preparer')} style="principal" /> : null}
            {aExpedier ? (
              <Carte className="flex flex-col gap-3">
                <h2 className="font-semibold">{t('expedierTitre')}</h2>
                <Operation id={id} op="expedier" bouton={t('expedier')} style={c.statut === 'preparee' ? 'principal' : 'secondaire'}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('transporteur')}</span>
                    <select name="transporteur" className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre">
                      <option value="">{t('sansTransporteur')}</option>
                      {transporteurs.map((tr) => <option key={tr.id} value={tr.id}>{tr.nom}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('suivi')}</span>
                    <input name="suivi" maxLength={60} dir="ltr" autoComplete="off" className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre" />
                  </label>
                </Operation>
              </Carte>
            ) : null}
            {c.statut === 'expediee' && vend ? (
              <Carte className="flex flex-col gap-3">
                <h2 className="font-semibold">{t('arriveeTitre')}</h2>
                <Operation id={id} op="livrer" bouton={t('livree')} style="principal" />
                <Operation id={id} op="retour" bouton={t('retournee')} style="danger" />
                <p className="text-sm text-doux">{t('retourTexte')}</p>
              </Carte>
            ) : null}
            {(aConfirmer || aExpedier) && vend ? (
              <details className="rounded-xl border border-trait bg-surface">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-terre">{t('annuler')}</summary>
                <div className="flex flex-col gap-3 p-4 pt-0">
                  <p className="text-sm text-doux">{t(c.facture ? 'annulerTexteFacture' : 'annulerTexte')}</p>
                  <Operation id={id} op="annuler" bouton={t('annulerBouton')} style="danger" />
                </div>
              </details>
            ) : null}
          </>
        ) : null}

        {vend ? (
          <>
            <TitreSection>{t('documents')}</TitreSection>
            <div className="flex flex-col gap-2">
              {documents.map((d) => (
                <Link key={d.id} href={`/factures/${d.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-trait bg-surface px-4 py-2 text-sm">
                  <span className="text-doux">{td(`type_${d.type}`)}</span>
                  <span className="chiffres font-semibold text-vert underline">{numeroTexte(d)}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <TitreSection>{t('historique')}</TitreSection>
        <ol className="flex flex-col gap-1 text-sm">
          {c.historique.map((h, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-trait py-2">
              <span>{h.evenement === 'statut' && h.nouveau ? t(`statut.${h.nouveau}`) : t(`evenement.${h.evenement}`)} · {h.auteur}</span>
              <span className="chiffres shrink-0 text-doux">{formaterDate(h.le)} {formaterHeure(h.le)}</span>
            </li>
          ))}
        </ol>
      </Page>
    </>
  );
}
