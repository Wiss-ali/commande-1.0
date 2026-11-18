import { Download } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { BarresHorizontales, GraphiqueBarres } from '@/components/Graphiques';
import { Page } from '@/components/Page';
import { Carte, classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterMontant, nomLocal } from '@/lib/formats';
import { totalDepenses } from '@/lib/depenses';
import { meilleursProduits, periode, PERIODES, rapportCommandes, rapportMarge, retoursParWilaya, type CodePeriode } from '@/lib/rapports';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const ONGLETS = ['marge', 'commandes', 'retours', 'produits'] as const;
type Onglet = (typeof ONGLETS)[number];

/** Un rapport par écran : le chiffre clé écrit en haut, un seul graphique, le détail en dessous. */
export default async function Rapports({ searchParams }: { searchParams: Promise<{ r?: string; p?: string }> }) {
  const s = await pageUtilisateur('rapports', 'rapports');
  const t = await getTranslations('rapports');
  const langue = (await getLocale()) as Langue;
  const params = await searchParams;
  const onglet: Onglet = ONGLETS.find((o) => o === params.r) ?? 'marge';
  const code: CodePeriode = PERIODES.find((x) => x === params.p) ?? '30j';
  const p = periode(code);
  const lien = (o: Onglet, c: CodePeriode) => `/rapports?r=${o}&p=${c}`;
  const montant = (n: number) => formaterMontant(n, langue);
  const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
  const pourcent = (n: number | null) => (n === null ? '—' : `${n} %`);

  const contenu = await avecCommercant(s.commercant.id, async (trx) => {
    switch (onglet) {
      case 'marge': {
        const m = await rapportMarge(trx, p);
        const dep = await totalDepenses(trx, p);
        const td = await getTranslations('depenses');
        const etiquette = (j: string) => (m.pas === 'mois' ? `${j.slice(5, 7)}/${j.slice(0, 4)}` : `${j.slice(8, 10)}/${j.slice(5, 7)}`);
        return (
          <>
            <Carte className="flex flex-col gap-1">
              <p className="text-sm text-doux">{t('marge.titre')}</p>
              <p className={`text-3xl font-bold ${m.marge < 0 ? 'text-terre' : ''}`}>{montant(m.marge)}</p>
              <p className="text-sm text-doux">{m.tauxMarque === null ? t('marge.aucuneVente') : t('marge.taux', { taux: (m.tauxMarque / 10).toString().replace('.', langue === 'fr' ? ',' : '.') })}</p>
            </Carte>
            <Carte><GraphiqueBarres titre={t('marge.graphique')} voirChiffres={t('voirChiffres')} colonnes={[t(m.pas === 'mois' ? 'colMois' : 'colJour'), t('marge.titre')]}
              barres={m.serie.map((x) => ({ etiquette: etiquette(x.jour), valeur: x.valeur, texte: `${etiquette(x.jour)} : ${montant(x.valeur)}`, affichage: montant(x.valeur) }))} /></Carte>
            <Carte>
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-doux">{t('marge.ventes')}</dt><dd>{montant(m.ventes)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-doux">{t('marge.achat')}</dt><dd>{montant(-m.achat)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-doux">{t('marge.livraison')}</dt><dd>{montant(-m.livraison)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-trait pt-1.5 font-bold"><dt>{t('marge.titre')}</dt><dd>{montant(m.marge)}</dd></div>
              </dl>
              <p className="mt-2 text-sm text-doux">{t('marge.retours', { n: m.colisRetournes, montant: montant(m.retours) })}</p>
              <p className="mt-1 text-sm text-doux">{t('marge.panier', { n: m.nbVentes, panier: m.panierMoyen === null ? '—' : montant(m.panierMoyen) })}</p>
            </Carte>
            {/* Bénéfice net : la marge moins les dépenses du magasin (loyer, salaires…) de la période. */}
            <Carte className="flex flex-col gap-2">
              <p className="text-sm text-doux">{t('marge.benefice')}</p>
              <p className={`text-2xl font-bold ${m.marge - dep.total < 0 ? 'text-terre' : ''}`}>{montant(m.marge - dep.total)}</p>
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-doux">{t('marge.titre')}</dt><dd>{montant(m.marge)}</dd></div>
                {dep.parCategorie.map((c) => <div key={c.categorie} className="flex justify-between gap-3"><dt className="text-doux">{td(`cat.${c.categorie}`)}</dt><dd>{montant(-c.montant)}</dd></div>)}
                {!dep.total ? <p className="text-doux">{t('marge.aucuneDepense')}</p> : null}
              </dl>
              {s.commercant.modules.caisse ? <Link href="/caisse/depenses" className="text-sm font-semibold text-prim underline">{t('marge.voirDepenses')}</Link> : null}
            </Carte>
            <p className="text-xs text-doux">{t('marge.explication')}</p>
          </>
        );
      }
      case 'commandes': {
        const r = await rapportCommandes(trx, p);
        if (!r.creees && !r.expediees) return <EtatVide titre={t('vide')} texte={t('videTexte')} />;
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Carte><p className="text-sm text-doux">{t('commandes.confirmation')}</p><p className="text-3xl font-bold">{pourcent(r.tauxConfirmation)}</p></Carte>
              <Carte><p className="text-sm text-doux">{t('commandes.livraison')}</p><p className="text-3xl font-bold">{pourcent(r.tauxLivraison)}</p></Carte>
            </div>
            <Carte>
              <BarresHorizontales lignes={[
                { cle: 'creees', nom: t('commandes.creees'), valeur: r.creees, affichage: r.creees, detail: t('commandes.detailCreees', { attente: r.enAttente, annulees: r.annuleesAvant }) },
                { cle: 'confirmees', nom: t('commandes.confirmees'), valeur: r.confirmees, affichage: r.confirmees },
                { cle: 'expediees', nom: t('commandes.expediees'), valeur: r.expediees, affichage: r.expediees, detail: t('commandes.detailRoute', { n: r.enRoute }) },
                { cle: 'livrees', nom: t('commandes.livrees'), valeur: r.livrees, affichage: r.livrees },
                { cle: 'retournees', nom: t('commandes.retournees'), valeur: r.retournees, affichage: r.retournees, ton: 'terre' },
              ]} />
            </Carte>
            <p className="text-xs text-doux">{t('commandes.explication')}</p>
          </>
        );
      }
      case 'retours': {
        const w = await retoursParWilaya(trx, p);
        if (!w.length) return <EtatVide titre={t('vide')} texte={t('videTexte')} />;
        const pire = w.filter((x) => x.taux !== null).sort((a, b) => b.taux! - a.taux! || b.retournees - a.retournees)[0];
        const total = w.reduce((x, l) => x + l.retournees, 0);
        return (
          <>
            <Carte className="flex flex-col gap-1">
              <p className="text-sm text-doux">{t('retours.titre')}</p>
              <p className="text-3xl font-bold">{total}</p>
              {pire && pire.retournees ? <p className="text-sm text-doux">{t('retours.pire', { wilaya: nomLocal(pire, langue), taux: pire.taux! })}</p> : null}
            </Carte>
            <Carte>
              <BarresHorizontales lignes={w.slice(0, 15).map((l) => ({
                cle: String(l.code), nom: <><span className="chiffres text-doux">{String(l.code).padStart(2, '0')}</span> {nomLocal(l, langue)}</>,
                valeur: l.retournees, affichage: pourcent(l.taux), ton: 'terre' as const,
                detail: t('retours.detail', { expediees: l.expediees, livrees: l.livrees, retournees: l.retournees }),
              }))} />
            </Carte>
          </>
        );
      }
      case 'produits': {
        const pr = await meilleursProduits(trx, p);
        if (!pr.length) return <EtatVide titre={t('vide')} texte={t('videTexte')} />;
        return (
          <>
            <Carte className="flex flex-col gap-1">
              <p className="text-sm text-doux">{t('produits.premier')}</p>
              <p className="text-xl font-bold">{nomLocal(pr[0]!, langue)}</p>
              <p className="text-sm text-doux">{t('produits.detail', { quantite: pr[0]!.quantite, ventes: montant(pr[0]!.ventes), marge: montant(pr[0]!.marge) })}</p>
            </Carte>
            <Carte>
              <BarresHorizontales lignes={pr.map((l) => ({
                cle: l.produitId, nom: <Link href={`/stock/${l.produitId}`} className="underline">{nomLocal(l, langue)}</Link>, valeur: l.ventes, affichage: montant(l.ventes),
                detail: t('produits.ligne', { quantite: l.quantite, marge: montant(l.marge) }),
              }))} />
            </Carte>
          </>
        );
      }
    }
  });

  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        <nav aria-label={t('onglets')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {ONGLETS.map((o) => (
            <Link key={o} href={lien(o, code)} aria-current={o === onglet ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${o === onglet ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
              {t(`onglet.${o}`)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('periode')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {PERIODES.map((c) => (
            <Link key={c} href={lien(onglet, c)} aria-current={c === code ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm ${c === code ? 'border-prim font-semibold text-prim' : 'border-trait'}`}>
              {t(`p.${c}`)}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-doux">{t('du', { du: date(p.du), au: date(p.au) })}</p>
        {contenu}
        <Link href={`/rapports/export?periode=${code === 'mois_precedent' ? 'mois_precedent' : 'mois'}`} className={classeBouton.secondaire}><Download aria-hidden className="size-4" />{t('exporter')}</Link>
      </Page>
    </>
  );
}
