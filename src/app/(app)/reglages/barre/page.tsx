import { getTranslations } from 'next-intl/server';
import { enregistrerBarre } from '@/app/actions/preferences';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte } from '@/components/ui';
import { barreDe, entreesDisponibles, TAILLE_BARRE } from '@/lib/barre';
import { peut } from '@/lib/droits';
import { pageUtilisateur } from '@/lib/web';

/** Barre du bas : chaque personne choisit ses 4 entrées (parmi ce qu'elle peut ouvrir) ; « Plus » reste à la fin. */
export default async function Barre() {
  const s = await pageUtilisateur();
  const t = await getTranslations('barre');
  const tn = await getTranslations('nav');
  const tm = await getTranslations('modules');
  const disponibles = entreesDisponibles(s.utilisateur.role, s.commercant.modules);
  const barre = barreDe(s.utilisateur.barreBas, disponibles);
  const nom = (e: string) => (tn.has(e) ? tn(e) : tm(e));
  return (
    <>
      <EnTete titre={t('titre')} retour={peut(s.utilisateur.role, 'reglages') ? '/reglages' : '/plus'} />
      <Page>
        <p className="text-sm text-doux">{t('texte')}</p>
        <Carte>
          <Formulaire action={enregistrerBarre} bouton={t('enregistrer')} succes={t('enregistre')} garder>
            {Array.from({ length: TAILLE_BARRE }, (_, i) => (
              <label key={i} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{t('position', { n: i + 1 })}</span>
                <select name="entree" defaultValue={barre[i] ?? ''} className="min-h-12 min-w-40 rounded-xl border border-trait bg-surface px-3 text-base">
                  <option value="">{t('vide')}</option>
                  {disponibles.map((e) => <option key={e} value={e}>{nom(e)}</option>)}
                </select>
              </label>
            ))}
            <p className="text-sm text-doux">{t('plusFin')}</p>
          </Formulaire>
        </Carte>
        <Formulaire action={enregistrerBarre} bouton={t('parDefaut')} style="secondaire" succes={t('enregistre')}>
          <input type="hidden" name="defaut" value="1" />
        </Formulaire>
      </Page>
    </>
  );
}
