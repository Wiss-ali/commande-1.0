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
import { lireDocument, numeroTexte, TRANSFORMATIONS } from '@/lib/documents';
import { peut } from '@/lib/droits';
import { formaterTaux } from '@/lib/fiscal';
import { formaterDate, formaterHeure, formaterMontant, formaterTelephone } from '@/lib/formats';
import { montantEnLettres } from '@/lib/montant-lettres';
import type { Langue } from '@/lib/types-bd';
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
  const { d, commande } = await avecCommercant(s.commercant.id, async (trx) => ({ d: await lireDocument(trx, id), commande: await commandeDuDocument(trx, id) }));
  if (!d) notFound();
  const numero = numeroTexte(d);
  const signe = d.type === 'avoir' ? -1 : 1;
  const suites = d.liens.filter((l) => l.sens === 'suite');
  const annule = suites.some((l) => l.nature === 'corrige_par');
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
            {d.type === 'facture' && !annule ? <Pastille ton={d.payeLe ? 'vert' : 'safran'}>{tf(d.payeLe ? 'payee' : 'aPayer')}</Pastille> : null}
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
                  <p className="text-sm text-doux"><span className="chiffres">{l.quantite} ×</span> {formaterMontant(l.prixUnitaire, langue)}{l.tauxTva ? <> · {td('tva')} <span className="chiffres">{formaterTaux(l.tauxTva)}</span></> : null}</p>
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
            {d.timbre ? <div className="flex justify-between gap-3"><dt className="text-doux">{td('timbre')}</dt><dd>{formaterMontant(d.timbre, langue)}</dd></div> : null}
            <div className="flex items-baseline justify-between gap-3 text-xl font-bold"><dt>{td(d.type === 'avoir' ? 'netRembourser' : d.type === 'recu' ? 'montantRecu' : 'netPayer')}</dt><dd>{formaterMontant(signe * d.total, langue)}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-doux">{montantEnLettres(signe * d.total, langue)}</p>
          {d.payeLe ? <p className="mt-2 text-sm">{td('payeEspeces')} <span className="chiffres">{formaterDate(d.payeLe)}</span></p> : d.modePaiement === 'a_la_livraison' ? <p className="mt-2 text-sm">{td('payeLivraison')}</p> : null}
          {d.note ? <p className="mt-2 text-sm">{d.note}</p> : null}
        </Carte>

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

            {d.type === 'facture' && !d.payeLe && !annule && !commande ? (
              <Carte className="flex flex-col gap-3">
                <p className="text-sm">{t('encaisserTexte')}</p>
                <Formulaire action={encaisser} bouton={t('encaisser')} garder>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="cle" value={randomUUID()} />
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
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </Page>
    </>
  );
}
