import { Plus, Search, Download } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide, Pastille } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerDocuments, numeroTexte } from '@/lib/documents';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue, TypeDocument } from '@/lib/types-bd';
import { peut } from '@/lib/droits';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 30;
const ONGLETS = {
  factures: ['facture'],
  devis: ['devis'],
  tickets: ['ticket'],
  autres: ['proforma', 'bon_commande', 'bon_livraison', 'avoir', 'recu'],
} as const satisfies Record<string, readonly TypeDocument[]>;
type Onglet = keyof typeof ONGLETS;

export default async function Factures({ searchParams }: { searchParams: Promise<{ onglet?: string; n?: string; page?: string }> }) {
  const s = await pageUtilisateur('vendre', 'factures');
  const t = await getTranslations('factures');
  const td = await getTranslations('pdf');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const onglet: Onglet = params.onglet && params.onglet in ONGLETS ? (params.onglet as Onglet) : 'factures';
  const numero = Number((params.n ?? '').replace(/\D/g, '').slice(-6)) || undefined;
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  const { documents, devisEnAttente } = await avecCommercant(s.commercant.id, async (trx) => ({
    documents: await listerDocuments(trx, { types: ONGLETS[onglet], numero, limite: PAR_PAGE * page + 1 }),
    devisEnAttente: Number((await trx.selectFrom('documents').select((eb) => eb.fn.countAll<string>().as('n')).where('type', '=', 'devis').where('etat', '=', 'en_attente').executeTakeFirstOrThrow()).n),
  }));
  const adresse = (o: string, p?: number) => `/factures?onglet=${o}${numero ? `&n=${numero}` : ''}${p ? `&page=${p}` : ''}`;
  const ecrit = s.commercant.etat === 'actif';

  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" fin={peut(s.utilisateur.role, 'rapports') ? <Link href="/rapports/export?depuis=factures" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-trait bg-surface px-3 text-sm font-semibold"><Download aria-hidden className="size-4" />{t('exporter')}</Link> : undefined} />
      <Page>
        <nav aria-label={t('onglets')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
            <Link key={o} href={`/factures?onglet=${o}`} aria-current={o === onglet ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${o === onglet ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
              {t(`onglet.${o}`)}
              {o === 'devis' && devisEnAttente ? <span className="chiffres rounded-full bg-safran px-1.5 text-xs text-encre">{devisEnAttente}</span> : null}
            </Link>
          ))}
        </nav>
        {ecrit && onglet === 'factures' ? <Link href="/factures/nouveau?type=facture" className={classeBouton.principal}><Plus aria-hidden className="size-5" />{t('nouvelleFacture')}</Link> : null}
        {ecrit && onglet === 'devis' ? <Link href="/factures/nouveau?type=devis" className={classeBouton.principal}><Plus aria-hidden className="size-5" />{t('nouveauDevis')}</Link> : null}
        {ecrit && onglet === 'autres' ? (
          <div className="grid grid-cols-2 gap-2">
            <Link href="/factures/nouveau?type=proforma" className={classeBouton.secondaire}><Plus aria-hidden className="size-4" />{td('type_proforma')}</Link>
            <Link href="/factures/nouveau?type=bon_commande" className={classeBouton.secondaire}><Plus aria-hidden className="size-4" />{td('type_bon_commande')}</Link>
          </div>
        ) : null}
        <form action="/factures" role="search" className="flex gap-2">
          <input type="hidden" name="onglet" value={onglet} />
          <input type="search" name="n" defaultValue={numero ?? ''} inputMode="numeric" aria-label={t('chercher')} placeholder={t('chercher')} maxLength={20} dir="ltr" className="min-h-12 min-w-0 flex-1 rounded-xl border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
          <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </form>

        {documents.length ? (
          <ul className="flex flex-col gap-2">
            {documents.slice(0, PAR_PAGE * page).map((d) => (
              <li key={d.id}>
                <Link href={`/factures/${d.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3">
                  <span className="min-w-0 flex-1">
                    <span className="chiffres block font-semibold">{numeroTexte(d)}</span>
                    <span className="block truncate text-sm text-doux">
                      {onglet === 'autres' ? `${td(`type_${d.type}`)} · ` : ''}
                      {d.client ? `${d.client} · ` : ''}
                      <span className="chiffres">{formaterDate(d.emis_le)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold">{formaterMontant(BigInt(d.total), langue)}</span>
                    {d.annule ? <Pastille ton="terre">{t('annule')}</Pastille>
                      : d.type === 'devis' ? (
                        <>
                          {d.origine === 'boutique' ? <Pastille ton="bleu">{t('boutique')}</Pastille> : null}
                          <Pastille ton={d.etat === 'en_attente' ? 'safran' : d.etat === 'transforme' ? 'vert' : 'neutre'}>{t(`etat.${d.etat}`)}</Pastille>
                        </>
                      )
                      : d.type === 'facture' ? <Pastille ton={d.paye_le ? 'vert' : 'safran'}>{t(d.paye_le ? 'payee' : 'aPayer')}</Pastille>
                      : d.origine === 'boutique' ? <Pastille ton="bleu">{t('boutique')}</Pastille> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EtatVide titre={t(numero ? 'aucunTitre' : `vide.${onglet}`)} texte={t(numero ? 'aucunTexte' : `videTexte.${onglet}`)} />
        )}
        {documents.length > PAR_PAGE * page ? <Link href={adresse(onglet, page + 1)} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
      </Page>
    </>
  );
}
