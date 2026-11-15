import { getTranslations } from 'next-intl/server';
import { enregistrerModules } from '@/app/actions/reglages';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { MODULES } from '@/lib/droits';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { pageUtilisateur } from '@/lib/web';

export default async function Modules() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('modulesReglages');
  const tm = await getTranslations('modules');
  const tc = await getTranslations('commun');
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <p className="text-sm text-doux">{t('aide')}</p>
        <Formulaire action={enregistrerModules} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <ul className="flex flex-col gap-2">
            {MODULES.map((m) => {
              const Icone = ICONE_MODULE[m];
              return (
                <li key={m}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-trait bg-surface px-4">
                    <Icone aria-hidden className="size-5 text-vert" />
                    <span className="flex-1 font-semibold">{tm(m)}</span>
                    <input type="checkbox" name={m} defaultChecked={s.commercant.modules[m]} className="size-6 accent-vert" />
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-doux">{t('boutiqueNote')}</p>
        </Formulaire>
      </Page>
    </>
  );
}
