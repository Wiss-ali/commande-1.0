import { getTranslations } from 'next-intl/server';
import { enregistrerModules } from '@/app/actions/reglages';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { MODULES } from '@/lib/droits';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { situation } from '@/lib/abonnements';
import { avecCommercant } from '@/lib/bd';
import { pageUtilisateur } from '@/lib/web';

export default async function Modules() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('modulesReglages');
  const tm = await getTranslations('modules');
  const tc = await getTranslations('commun');
  // Choix enregistrés du commerçant, et modules que son abonnement autorise (les autres sont grisés).
  const { choisis, ab } = await avecCommercant(s.commercant.id, async (trx) => ({
    choisis: (await trx.selectFrom('commercants').select('modules').executeTakeFirstOrThrow()).modules,
    ab: await situation(trx, s.commercant.id),
  }));
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <p className="text-sm text-doux">{t('aide')}</p>
        <Formulaire action={enregistrerModules} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <ul className="flex flex-col gap-2">
            {MODULES.map((m) => {
              const Icone = ICONE_MODULE[m];
              const permis = !ab.autorises || ab.autorises.has(m);
              return (
                <li key={m}>
                  <label className={`flex min-h-14 items-center gap-3 rounded-xl border border-trait bg-surface px-4 ${permis ? 'cursor-pointer' : 'opacity-60'}`}>
                    <Icone aria-hidden className="size-5 text-vert" />
                    <span className="flex-1"><span className="block font-semibold">{tm(m)}</span>{permis ? null : <span className="block text-sm text-doux">{t('nonCompris')}</span>}</span>
                    {permis ? <input type="checkbox" name={m} defaultChecked={choisis[m]} className="size-6 accent-vert" /> : <>{choisis[m] ? <input type="hidden" name={m} value="on" /> : null}<input type="checkbox" disabled aria-label={tm(m)} className="size-6" /></>}
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
