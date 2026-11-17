import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { GraphiqueBarres } from '@/components/Graphiques';
import { Page } from '@/components/Page';
import { Carte, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { autorise, DROIT_MODULE, MODULES } from '@/lib/droits';
import { formaterDate, formaterMontant, formaterNombre } from '@/lib/formats';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { chiffresAccueil, jourAlger, periode, rapportMarge, serieVentes } from '@/lib/rapports';
import type { Langue, NomModule } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

// Tableau de bord : le pont entre les modules. Quatre chiffres au plus, une carte par module, un graphique,
// et la liste « À faire ». Chaque rôle ne voit que ce que ses droits lui ouvrent.
export default async function Accueil({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const s = await pageUtilisateur();
  const t = await getTranslations('accueil');
  const tm = await getTranslations('modules');
  const langue = (await getLocale()) as Langue;
  const jours = (await searchParams).jours === '30' ? 30 : 7;
  const m = s.commercant.modules;
  const peut = (d: Parameters<typeof autorise>[1]) => autorise(s.utilisateur, d);
  const actifs = MODULES.filter((x) => m[x] && peut(DROIT_MODULE[x]));
  const a = (x: NomModule) => actifs.includes(x);
  const voitVentes = peut('vendre') && (a('caisse') || a('factures'));

  const { c, serie, margeMois } = await avecCommercant(s.commercant.id, async (trx) => ({
    c: await chiffresAccueil(trx),
    serie: voitVentes ? await serieVentes(trx, jours) : [],
    margeMois: a('rapports') ? (await rapportMarge(trx, periode('mois'))).marge : null,
  }));

  // Quatre chiffres au plus, dans cet ordre.
  const chiffres: { cle: string; libelle: string; valeur: string; lien: string; alerte?: boolean }[] = [];
  if (voitVentes) chiffres.push({ cle: 'ventes', libelle: t('ventesJour'), valeur: formaterMontant(c.ventesJour, langue), lien: a('caisse') ? '/caisse/cloture' : '/factures' });
  if (a('commandes') && peut('vendre')) chiffres.push({ cle: 'confirmer', libelle: t('aConfirmer'), valeur: formaterNombre(c.aConfirmer), lien: '/commandes?f=a_confirmer', alerte: c.aConfirmer > 0 });
  if (a('commandes')) chiffres.push({ cle: 'route', libelle: t('enRoute'), valeur: formaterNombre(c.enRoute), lien: '/commandes?f=en_cours' });
  if (a('stock')) chiffres.push({ cle: 'stock', libelle: t('stockBas'), valeur: formaterNombre(c.stockBas), lien: '/stock?filtre=bas', alerte: c.stockBas > 0 });

  // Liste « À faire » : seulement ce qui demande une action, chaque ligne ouvre l'écran concerné.
  const aFaire: { cle: string; texte: string; lien: string }[] = [];
  if (a('commandes') && peut('vendre') && c.aConfirmer) aFaire.push({ cle: 'confirmer', texte: t('faire.confirmer', { n: c.aConfirmer }), lien: '/commandes?f=a_confirmer' });
  if (a('commandes') && c.aExpedier) aFaire.push({ cle: 'expedier', texte: t('faire.expedier', { n: c.aExpedier }), lien: '/commandes?f=a_expedier' });
  if (a('stock') && peut('stock.corriger') && c.ecarts) aFaire.push({ cle: 'ecarts', texte: t('faire.ecarts', { n: c.ecarts }), lien: '/stock' });
  if (a('stock') && c.ruptures) aFaire.push({ cle: 'ruptures', texte: t('faire.ruptures', { n: c.ruptures }), lien: '/stock?filtre=rupture' });
  if (a('factures') && c.devisEnAttente) aFaire.push({ cle: 'devis', texte: t('faire.devis', { n: c.devisEnAttente }), lien: '/factures?onglet=devis' });
  if (a('caisse') && c.caisseNonCloturee) aFaire.push({ cle: 'caisse', texte: t('faire.caisse'), lien: '/caisse/cloture' });
  // Rappel mensuel : les dix premiers jours du mois, télécharger l'archive du mois précédent.
  if (a('rapports') && Number(jourAlger().slice(8)) <= 10) aFaire.push({ cle: 'archive', texte: t('faire.archive'), lien: '/rapports/export?periode=mois_precedent' });

  // Un seul chiffre utile par carte de module.
  const chiffreModule = (x: NomModule) => {
    switch (x) {
      case 'stock': return c.stockBas ? <Pastille ton="safran">{t('carte.alertes', { n: c.stockBas })}</Pastille> : <Pastille ton="vert">{t('carte.stockOk')}</Pastille>;
      case 'caisse': return <span className="text-sm text-doux">{t('carte.ventes', { n: c.nbVentesJour })}</span>;
      case 'factures': return c.devisEnAttente ? <Pastille ton="safran">{t('carte.devis', { n: c.devisEnAttente })}</Pastille> : <span className="text-sm text-doux">{t('carte.aJour')}</span>;
      case 'commandes': return c.aConfirmer ? <Pastille ton="safran">{t('carte.aConfirmer', { n: c.aConfirmer })}</Pastille> : <span className="text-sm text-doux">{t('carte.enRoute', { n: c.enRoute })}</span>;
      case 'clients': return <span className="text-sm text-doux">{t('carte.clients', { n: c.clients })}</span>;
      case 'rapports': return margeMois === null ? null : <span className="text-sm text-doux">{t('carte.marge')} <span className="font-semibold text-encre">{formaterMontant(margeMois, langue)}</span></span>;
      // La boutique en ligne arrive à l'étape 6 : elle est désactivée tant qu'elle n'est pas mise en ligne.
      case 'boutique': return <Pastille ton="neutre">{t('carte.boutiqueOff')}</Pastille>;
    }
  };

  const total = serie.reduce((x, p) => x + p.valeur, 0);
  const jourCourt = (j: string) => `${j.slice(8, 10)}/${j.slice(5, 7)}`;

  return (
    <>
      <EnTete titre={t('bonjour', { nom: s.utilisateur.nom })} />
      <Page>
        <p className="-mt-1 text-sm text-doux">{s.commercant.nom} · <span className="chiffres">{formaterDate(new Date())}</span></p>
        {chiffres.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {chiffres.map((x) => (
              <li key={x.cle}>
                <Link href={x.lien} className={`flex min-h-24 flex-col justify-between gap-1 rounded-xl border bg-surface p-3 ${x.alerte ? 'border-safran' : 'border-trait'}`}>
                  <span className="text-sm text-doux">{x.libelle}</span>
                  <span className="text-xl font-bold">{x.valeur}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {voitVentes ? (
          <Carte className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('graphiqueTitre', { n: jours })}</h2>
                <p className="text-lg font-bold">{formaterMontant(total, langue)}</p>
              </div>
              <div role="group" aria-label={t('graphiquePeriode')} className="flex shrink-0 gap-1">
                {([7, 30] as const).map((n) => (
                  <Link key={n} href={n === 7 ? '/' : '/?jours=30'} scroll={false} aria-current={n === jours ? 'true' : undefined} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-semibold ${n === jours ? 'border-vert bg-vert-pale text-vert' : 'border-trait'}`}>
                    {t('jours', { n })}
                  </Link>
                ))}
              </div>
            </div>
            <GraphiqueBarres
              titre={t('graphiqueDescription', { n: jours, total: formaterMontant(total, langue) })}
              barres={serie.map((p) => ({ etiquette: jourCourt(p.jour), valeur: p.valeur, texte: `${jourCourt(p.jour)} : ${formaterMontant(p.valeur, langue)}`, affichage: formaterMontant(p.valeur, langue) }))}
              voirChiffres={t('voirChiffres')}
              colonnes={[t('colJour'), t('colVentes')]}
            />
          </Carte>
        ) : null}

        <TitreSection>{t('aFaireTitre')}</TitreSection>
        {aFaire.length ? (
          <ul className="flex flex-col gap-2">
            {aFaire.map((x) => (
              <li key={x.cle}>
                <Link href={x.lien} className="flex min-h-12 items-center gap-3 rounded-xl border border-trait bg-surface px-4 py-2">
                  <span aria-hidden className="size-2 shrink-0 rotate-45 bg-safran" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{x.texte}</span>
                  <ChevronRight aria-hidden className="directionnelle size-5 shrink-0 text-doux" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-trait px-4 py-3 text-sm text-doux">{t('rienAFaire')}</p>
        )}

        <TitreSection>{t('modulesTitre')}</TitreSection>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {actifs.map((x) => {
            const Icone = ICONE_MODULE[x];
            return (
              <li key={x}>
                <Link href={`/${x}`} className="flex min-h-24 flex-col justify-between gap-2 rounded-xl border border-trait bg-surface p-3">
                  <Icone aria-hidden className="size-6 text-vert" />
                  <span className="font-semibold">{tm(x)}</span>
                  {chiffreModule(x)}
                </Link>
              </li>
            );
          })}
        </ul>
      </Page>
    </>
  );
}
