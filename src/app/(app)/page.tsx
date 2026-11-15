import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, classeBouton, Pastille, TitreSection } from '@/components/ui';
import { DROIT_MODULE, MODULES, peut } from '@/lib/droits';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { pageUtilisateur } from '@/lib/web';

// Accueil provisoire : le vrai tableau de bord (chiffres, graphique, « À faire ») arrive à l'étape 5.
export default async function Accueil() {
  const s = await pageUtilisateur();
  const t = await getTranslations('accueil');
  const tm = await getTranslations('modules');
  const actifs = MODULES.filter((m) => s.commercant.modules[m] && peut(s.utilisateur.role, DROIT_MODULE[m]));
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
                  <Pastille ton="neutre">{t('bientot')}</Pastille>
                </Link>
              </li>
            );
          })}
        </ul>
      </Page>
    </>
  );
}
