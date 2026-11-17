import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, classeBouton, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { DROIT_MODULE, MODULES, peut } from '@/lib/droits';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { resumeStock } from '@/lib/stock';
import { pageUtilisateur } from '@/lib/web';

// Accueil provisoire : le vrai tableau de bord (chiffres, graphique, « À faire ») arrive à l'étape 5.
export default async function Accueil() {
  const s = await pageUtilisateur();
  const t = await getTranslations('accueil');
  const tm = await getTranslations('modules');
  const actifs = MODULES.filter((m) => s.commercant.modules[m] && peut(s.utilisateur.role, DROIT_MODULE[m]));
  const stock = actifs.includes('stock') ? await avecCommercant(s.commercant.id, resumeStock) : null;
  const alertes = stock ? stock.bas + stock.rupture : 0;
  return (
    <>
      <EnTete titre={t('bonjour', { nom: s.utilisateur.nom })} />
      <Page>
        <Carte className="flex flex-col gap-3">
          <div>
            <p className="text-sm text-doux">{s.commercant.nom}</p>
            <p className="text-lg font-semibold">{t('pretTitre')}</p>
          </div>
          <p className="text-sm text-doux">{t('pretTexte')}</p>
          {peut(s.utilisateur.role, 'equipe') ? <Link href="/reglages/equipe" className={classeBouton.principal}>{t('inviterEquipe')}</Link> : null}
        </Carte>
        <TitreSection>{t('modulesTitre')}</TitreSection>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {actifs.map((m) => {
            const Icone = ICONE_MODULE[m];
            return (
              <li key={m}>
                <Link href={`/${m}`} className="flex min-h-24 flex-col justify-between gap-2 rounded-xl border border-trait bg-surface p-3">
                  <Icone aria-hidden className="size-6 text-vert" />
                  <span className="font-semibold">{tm(m)}</span>
                  {m === 'stock' && stock ? (
                    alertes ? <Pastille ton="safran">{t('alertes', { n: alertes })}</Pastille> : <Pastille ton="vert">{t('produits', { n: stock.produits })}</Pastille>
                  ) : m === 'caisse' || m === 'factures' ? null : (
                    <Pastille ton="neutre">{t('bientot')}</Pastille>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Page>
    </>
  );
}
