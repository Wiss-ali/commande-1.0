import { MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { PastilleCommande } from '@/components/PastilleCommande';
import { Carte, classeBouton, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { lireClient } from '@/lib/clients';
import { listerCommandes } from '@/lib/commandes';
import { numeroTexte } from '@/lib/documents';
import { formaterDate, formaterMontant, formaterTelephone } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Client({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('vendre', 'clients');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('clients');
  const tc = await getTranslations('commandes');
  const td = await getTranslations('pdf');
  const tf = await getTranslations('factures');
  const langue = (await getLocale()) as Langue;
  const { c, commandes } = await avecCommercant(s.commercant.id, async (trx) => ({
    c: await lireClient(trx, id),
    commandes: await listerCommandes(trx, { filtre: 'toutes', clientId: id, limite: 50 }),
  }));
  if (!c) notFound();
  const voirCommandes = s.commercant.modules.commandes;
  return (
    <>
      <EnTete titre={c.nom} retour="/clients" />
      <Page>
        <Carte className="flex flex-col gap-2">
          <p className="text-lg font-bold">{c.nom}</p>
          {c.telephone ? <p className="chiffres text-lg" dir="ltr">{formaterTelephone(c.telephone)}</p> : null}
          <p className="text-sm text-doux">{t('depuis')} <span className="chiffres">{formaterDate(c.creeLe)}</span></p>
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
        <p className="text-sm text-doux">{t('resume', { achats: c.achats, commandes: c.commandes, livrees: c.livrees, retournees: c.retournees, annulees: c.annulees })}</p>

        {voirCommandes && commandes.length ? (
          <>
            <TitreSection>{t('commandes')}</TitreSection>
            <ul className="flex flex-col gap-2">
              {commandes.map((l) => (
                <li key={l.id}>
                  <Link href={`/commandes/${l.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-trait bg-surface px-4 py-2">
                    <span className="min-w-0"><span className="chiffres block font-semibold">{tc('numero', { n: l.numero })}</span><span className="chiffres block text-sm text-doux">{formaterDate(l.cree_le)}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-bold">{formaterMontant(BigInt(l.total), langue)}</span><PastilleCommande statut={l.statut} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <TitreSection>{t('documents')}</TitreSection>
        {c.documents.length ? (
          <ul className="flex flex-col gap-2">
            {c.documents.map((d) => (
              <li key={d.id}>
                <Link href={`/factures/${d.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-trait bg-surface px-4 py-2">
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
