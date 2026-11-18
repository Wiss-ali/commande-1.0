import { randomUUID } from 'node:crypto';
import { FileDown, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { annulerDocument, changerEtat, encaisser, transformerDocument } from '@/app/actions/ventes';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { PartagerPdf } from '@/components/PartagerPdf';
import { Carte, Champ, classeBouton, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { commandeDuDocument } from '@/lib/commandes';
import { lignesRestantes, lireDocument, numeroTexte, TRANSFORMATIONS } from '@/lib/documents';
import { peut } from '@/lib/droits';
import { formaterTaux } from '@/lib/fiscal';
import { formaterDate, formaterHeure, formaterMontant, formaterTelephone } from '@/lib/formats';
import { montantEnLettres } from '@/lib/montant-lettres';
import { MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Document({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ manques?: string }> }) {
  const s = await pageUtilisateur('vendre', 'factures');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('document');
  const tf = await getTranslations('factures');
  const td = await getTranslations('pdf');
  const tc = await getTranslations('commandes');
  const langue = (await getLocale()) as Langue;
  const { d, commande, restes } = await avecCommercant(s.commercant.id, async (trx) => {
    const doc = await lireDocument(trx, id);
    // Ce qui peut encore être rendu (retour d'une partie) : seulement pour une vente pas entièrement annulée.
    const r = doc?.solde && doc.solde.net !== 0 ? await lignesRestantes(trx, id) : [];
    return { d: doc, commande: await commandeDuDocument(trx, id), restes: r };
  });
  if (!d) notFound();
  const tp = await getTranslations('paiement');
  const numero = numeroTexte(d);
  const signe = d.type === 'avoir' ? -1 : 1;
  const suites = d.liens.filter((l) => l.sens === 'suite');
  // Annulé : entièrement corrigé par un ou plusieurs avoirs. Un retour partiel laisse la vente en place.
  const annule = d.solde ? d.solde.net === 0 : suites.some((l) => l.nature === 'corrige_par');
  const retourPartiel = !annule && suites.some((l) => l.nature === 'corrige_par');
  const reste = d.solde && !annule ? d.solde.reste : 0;
  const remiseTotale = d.lignes.reduce((x, l) => x + l.remise, 0);
  const vente = d.type === 'facture' || d.type === 'ticket';
  const modesPayes = [...new Set(d.paiements.filter((p) => p.montant > 0).map((p) => p.mode))];
  const transforme = suites.some((l) => l.nature === 'transforme_en');
  const ecrit = s.commercant.etat === 'actif';
  // Le devis et la facture d'une commande se gèrent depuis la commande (confirmer, annuler, retour).
  const possibles = commande && d.type === 'devis' ? [] : (d.type === 'devis' ? d.etat === 'en_attente' : !transforme) ? (TRANSFORMATIONS[d.type] ?? []) : [];
  const autres = possibles.filter((c) => c !== 'facture');
  const onglet = d.type === 'facture' ? 'factures' : d.type === 'devis' ? 'devis' : d.type === 'ticket' ? 'tickets' : 'autres';
  const { manques } = await searchParams;
  const avecTva = d.lignes.some((l) => l.tauxTva > 0);

  return (
    <>
      <EnTete titre={`${td(`type_${d.type}`)} ${numero}`} retour={`/factures?onglet=${onglet}`} />
      <Page>
        {manques ? <Message ton="info">{t('stockAVerifier')}</Message> : null}
        <Carte className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="chiffres text-lg font-bold">{numero}</p>
            {annule ? <Pastille ton="terre">{tf('annule')}</Pastille> : null}
            {d.type === 'devis' ? <Pastille ton={d.etat === 'en_attente' ? 'safran' : d.etat === 'transforme' ? 'vert' : 'neutre'}>{tf(`etat.${d.etat}`)}</Pastille> : null}
            {retourPartiel ? <Pastille ton="neutre">{tp('retourPartiel')}</Pastille> : null}
            {vente && !annule && (d.type === 'facture' || reste > 0) ? <Pastille ton={reste <= 0 ? 'vert' : 'safran'}>{reste <= 0 ? tf('payee') : d.solde!.paye > 0 ? tp('payeeEnPartie') : tf('aPayer')}</Pastille> : null}
            {d.modeVente === 'envoi' ? <Pastille ton="bleu">{t('envoi')}</Pastille> : null}
            {d.origine === 'boutique' ? <Pastille ton="bleu">{tf('boutique')}</Pastille> : null}
          </div>
          <p className="text-sm text-doux"><span className="chiffres">{formaterDate(d.emisLe)} {formaterHeure(d.emisLe)}</span> · {d.emisPar}</p>
          {d.valideJusqua ? <p className="text-sm text-doux">{td('valable')} <span className="chiffres">{formaterDate(d.valideJusqua)}</span></p> : null}
          {d.acheteur ? (
            <div className="border-t border-trait pt-2 text-sm">
              <p className="font-semibold">{d.acheteur.nom}</p>
              {d.acheteur.telephone ? <p><a href={`tel:${d.acheteur.telephone}`} className="chiffres text-prim underline">{formaterTelephone(d.acheteur.telephone)}</a></p> : null}
              {d.acheteur.adresse ? <p className="text-doux">{d.acheteur.adresse}</p> : null}
              {d.acheteur.nif ? <p className="text-doux">{td('nif')} : <span className="chiffres">{d.acheteur.nif}</span></p> : null}
            </div>
          ) : null}
        </Carte>

        {d.lignes.length ? (
          <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
            {d.lignes.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{l.designation}</p>
                  <p className="text-sm text-doux"><span className="chiffres">{l.quantite} ×</span> {formaterMontant(l.prixUnitaire, langue)}{l.remise ? <> · {td('remise')} {formaterMontant(l.remise, langue)}</> : null}{l.tauxTva ? <> · {td('tva')} <span className="chiffres">{formaterTaux(l.tauxTva)}</span></> : null}</p>
                </div>
                <p className="shrink-0 font-semibold">{formaterMontant(l.totalTtc, langue)}</p>
              </li>
            ))}
          </ul>
        ) : null}

        <Carte>
          <dl className="flex flex-col gap-1.5 text-sm">
            {avecTva ? (
              <>
                <div className="flex justify-between gap-3"><dt className="text-doux">{td('totalHt')}</dt><dd>{formaterMontant(signe * d.totalHt, langue)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-doux">{td('tva')}</dt><dd>{formaterMontant(signe * d.totalTva, langue)}</dd></div>
              </>
            ) : null}
            {remiseTotale ? <div className="flex justify-between gap-3"><dt className="text-doux">{td('remiseTotale')}</dt><dd>{formaterMontant(-remiseTotale, langue)}</dd></div> : null}
            {d.timbre ? <div className="flex justify-between gap-3"><dt className="text-doux">{td('timbre')}</dt><dd>{formaterMontant(d.timbre, langue)}</dd></div> : null}
            <div className="flex items-baseline justify-between gap-3 text-xl font-bold"><dt>{td(d.type === 'avoir' ? 'netRembourser' : d.type === 'recu' ? 'montantRecu' : 'netPayer')}</dt><dd>{formaterMontant(signe * d.total, langue)}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-doux">{montantEnLettres(signe * d.total, langue)}</p>
          {d.payeLe && vente ? <p className="mt-2 text-sm">{td('payeLe')} <span className="chiffres">{formaterDate(d.payeLe)}</span>{modesPayes.length ? ` · ${modesPayes.map((m) => td(`mode_${m}`)).join(' + ')}` : ''}</p>
            : d.payeLe && d.modePaiement ? <p className="mt-2 text-sm">{td(d.type === 'avoir' ? 'rembourseLe' : 'payeLe')} <span className="chiffres">{formaterDate(d.payeLe)}</span> · {td(`mode_${d.modePaiement}`)}</p>
            : d.modePaiement === 'a_la_livraison' ? <p className="mt-2 text-sm">{td('payeLivraison')}</p> : null}
          {reste > 0 ? <p className="mt-2 text-base font-bold text-sur-safran">{td('resteDu')} {formaterMontant(reste, langue)}</p> : null}
          {d.note ? <p className="mt-2 text-sm">{d.note}</p> : null}
        </Carte>

        {d.paiements.length ? (
          <>
            <TitreSection>{tp('titre')}</TitreSection>
            <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
              {d.paiements.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{p.montant < 0 ? tp('rendu') : td(`mode_${p.mode}`)}{p.montant < 0 ? ` · ${td(`mode_${p.mode}`)}` : ''}</p>
                    <p className="text-doux"><span className="chiffres">{formaterDate(p.creeLe)} {formaterHeure(p.creeLe)}</span>{p.reference ? <> · <span className="chiffres">{p.reference}</span></> : null}</p>
                  </div>
                  <p className="shrink-0 font-semibold">{formaterMontant(p.montant, langue)}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {commande ? (
          <Link href={`/commandes/${commande.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-2 text-sm">
            <span className="text-doux">{t('commandeLiee')}</span>
            <span className="chiffres font-semibold text-prim underline">{tc('numero', { n: commande.numero })}</span>
          </Link>
        ) : null}
        {d.liens.length ? (
          <>
            <TitreSection>{t('liens')}</TitreSection>
            <div className="flex flex-col gap-2">
              {d.liens.map((l) => (
                <Link key={l.id} href={`/factures/${l.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-2 text-sm">
                  <span className="text-doux">{t(`lien.${l.sens}.${l.nature}`)}</span>
                  <span className="font-semibold text-prim underline">{td(`type_${l.type}`)} <span className="chiffres">{numeroTexte(l)}</span></span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <a href={`/factures/${id}/pdf?langue=fr`} target="_blank" rel="noopener" className={classeBouton.secondaire}><FileDown aria-hidden className="size-4" />{t('pdfFr')}</a>
          <a href={`/factures/${id}/pdf?langue=ar`} target="_blank" rel="noopener" className={classeBouton.secondaire}><FileDown aria-hidden className="size-4" />{t('pdfAr')}</a>
        </div>
        <PartagerPdf adresse={`/factures/${id}/pdf`} nom={numero} texte={t('partager')} />

        {ecrit ? (
          <>
            {d.type === 'devis' && d.etat === 'en_attente' && commande ? (
              <Link href={`/factures/${id}/modifier`} className={classeBouton.secondaire}><Pencil aria-hidden className="size-4" />{t('modifier')}</Link>
            ) : null}
            {d.type === 'devis' && d.etat === 'en_attente' && !commande ? (
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/factures/${id}/modifier`} className={classeBouton.secondaire}><Pencil aria-hidden className="size-4" />{t('modifier')}</Link>
                <form action={changerEtat}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="etat" value="refuse" />
                  <button type="submit" className={`${classeBouton.danger} w-full`}>{t('refuser')}</button>
                </form>
              </div>
            ) : null}
            {d.type === 'devis' && d.etat === 'refuse' && !commande ? (
              <form action={changerEtat}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="etat" value="en_attente" />
                <button type="submit" className={`${classeBouton.secondaire} w-full`}>{t('rouvrir')}</button>
              </form>
            ) : null}

            {possibles.includes('facture') ? (
              <Carte className="flex flex-col gap-3">
                <h2 className="font-semibold">{t('transformerTitre')}</h2>
                <p className="text-sm text-doux">{t('transformerTexte')}</p>
                {(['directe', 'envoi'] as const).map((mode) => (
                  <Formulaire key={mode} action={transformerDocument} bouton={t(`mode_${mode}`)} style={mode === 'directe' ? 'principal' : 'secondaire'} garder>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="cible" value="facture" />
                    <input type="hidden" name="mode" value={mode} />
                    <input type="hidden" name="cle" value={randomUUID()} />
                    {/* Une facture exige le nom du client : demandé ici si le document n'en a pas. */}
                    {!d.acheteur && mode === 'directe' ? <Champ libelle={t('clientNom')} name="clientNom" maxLength={120} autoComplete="off" aide={t('clientNomAide')} /> : null}
                    {!d.acheteur && mode === 'envoi' ? <Champ libelle={t('clientNom')} name="clientNom" maxLength={120} autoComplete="off" /> : null}
                    {mode === 'directe' ? (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">{tp('commentPaye')}</span>
                        <select name="paiement" defaultValue="especes" className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                          {MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}
                          <option value="credit">{tp('pasEncorePaye')}</option>
                        </select>
                      </label>
                    ) : null}
                    <p className="text-sm text-doux">{t(`aide_${mode}`)}</p>
                  </Formulaire>
                ))}
              </Carte>
            ) : null}
            {autres.length ? (
              <details className="rounded-2xl border border-trait bg-surface shadow-doux">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-prim">{t('autresDocuments')}</summary>
                <div className="flex flex-col gap-3 p-4 pt-0">
                  {autres.map((cible) => (
                    <Formulaire key={cible} action={transformerDocument} bouton={t('creer', { type: td(`type_${cible}`) })} style="secondaire" garder>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="cible" value={cible} />
                      <input type="hidden" name="cle" value={randomUUID()} />
                    </Formulaire>
                  ))}
                </div>
              </details>
            ) : null}

            {vente && reste > 0 && !commande ? (
              <Carte className="flex flex-col gap-3">
                <h2 className="font-semibold">{tp('encaisserTitre')}</h2>
                <p className="text-sm text-doux">{tp('encaisserTexte', { reste: formaterMontant(reste, langue) })}</p>
                <Formulaire action={encaisser} bouton={t('encaisser')} garder>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="cle" value={randomUUID()} />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{tp('mode')}</span>
                    <select name="mode" defaultValue="especes" className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                      {MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}
                    </select>
                  </label>
                  <Champ libelle={tp('montant')} name="montant" inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" placeholder={String(reste / 100)} aide={tp('montantAide')} />
                  <Champ libelle={tp('reference')} name="reference" dir="ltr" maxLength={60} autoComplete="off" aide={tp('referenceAide')} />
                </Formulaire>
              </Carte>
            ) : null}

            {(d.type === 'facture' || d.type === 'ticket') && !annule && !commande && peut(s.utilisateur.role, 'stock.corriger') ? (
              <details className="rounded-2xl border border-trait bg-surface shadow-doux">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-terre">{t('annulerTitre')}</summary>
                <div className="flex flex-col gap-3 p-4 pt-0">
                  <p className="text-sm text-doux">{t('annulerTexte')}</p>
                  <Formulaire action={annulerDocument} bouton={t('annulerBouton')} style="danger" garder>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="cle" value={randomUUID()} />
                    <label className="flex min-h-12 cursor-pointer items-center gap-3">
                      <input type="checkbox" name="remettre" defaultChecked className="size-5 accent-prim" />
                      <span className="text-sm">{t('remettreStock')}</span>
                    </label>
                  </Formulaire>
                  {restes.some((l) => l.resteQuantite > 0) && !(restes.length === 1 && restes[0]!.resteQuantite === 1) ? (
                    <div className="flex flex-col gap-3 border-t border-trait pt-3">
                      <h3 className="font-semibold">{tp('retourTitre')}</h3>
                      <p className="text-sm text-doux">{tp('retourTexte')}</p>
                      <Formulaire action={annulerDocument} bouton={tp('retourBouton')} style="secondaire" garder>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="cle" value={randomUUID()} />
                        <input type="hidden" name="partiel" value="1" />
                        {restes.filter((l) => l.resteQuantite > 0).map((l) => (
                          <Champ key={l.id} libelle={`${l.designation} (${tp('auPlus', { n: l.resteQuantite })})`} name={`retour.${l.id}`} type="number" inputMode="numeric" min={0} max={l.resteQuantite} step={1} defaultValue="" dir="ltr" autoComplete="off" />
                        ))}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium">{tp('modeRemboursement')}</span>
                          <select name="modeRemboursement" defaultValue="especes" className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                            {MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}
                          </select>
                        </label>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3">
                          <input type="checkbox" name="remettre" defaultChecked className="size-5 accent-prim" />
                          <span className="text-sm">{t('remettreStock')}</span>
                        </label>
                      </Formulaire>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </Page>
    </>
  );
}
