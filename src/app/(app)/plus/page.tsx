import { LogOut, PanelBottom, Settings } from 'lucide-react';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { seDeconnecter } from '@/app/actions/connexion';
import { changerLangue, changerTheme } from '@/app/actions/preferences';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, classeBouton, LigneLien, TitreSection } from '@/components/ui';
import { DROIT_MODULE, MODULES, peut } from '@/lib/droits';
import { barreDe, entreesDisponibles } from '@/lib/barre';
import { ICONE_MODULE } from '@/lib/icones-modules';
import { pageUtilisateur } from '@/lib/web';

export default async function Plus() {
  const s = await pageUtilisateur();
  const t = await getTranslations('plus');
  const tm = await getTranslations('modules');
  const tr = await getTranslations('roles');
  const theme = (await cookies()).get('theme')?.value;
  const choix = theme === 'clair' || theme === 'sombre' ? theme : 'auto';
  const langue = await getLocale();
  // Les modules déjà dans la barre du bas n'y sont pas répétés.
  const barre = barreDe(s.utilisateur.barreBas, entreesDisponibles(s.utilisateur.role, s.commercant.modules));
  const autres = MODULES.filter((m) => !barre.includes(m) && s.commercant.modules[m] && peut(s.utilisateur.role, DROIT_MODULE[m]));
  return (
    <>
      <EnTete titre={t('titre')} />
      <Page>
        <Carte>
          <p className="font-semibold">{s.utilisateur.nom}</p>
          <p className="text-sm text-doux">{tr(s.utilisateur.role)} · {s.commercant.nom}</p>
        </Carte>
        <TitreSection>{t('autresModules')}</TitreSection>
        {autres.length ? (
          <div className="flex flex-col gap-2">
            {autres.map((m) => {
              const Icone = ICONE_MODULE[m];
              return <LigneLien key={m} href={`/${m}`} titre={tm(m)} icone={<Icone aria-hidden className="size-5" />} />;
            })}
          </div>
        ) : (
          <p className="text-sm text-doux">{t('aucunModule')}</p>
        )}
        {peut(s.utilisateur.role, 'reglages') ? <LigneLien href="/reglages" titre={t('reglages')} icone={<Settings aria-hidden className="size-5" />} /> : <LigneLien href="/reglages/securite" titre={t('reglages')} icone={<Settings aria-hidden className="size-5" />} />}
        {/* La barre du bas est dans Réglages ; ici seulement pour qui n'a pas accès aux Réglages. */}
        {peut(s.utilisateur.role, 'reglages') ? null : <LigneLien href="/reglages/barre" titre={t('barre')} aide={t('barreAide')} icone={<PanelBottom aria-hidden className="size-5" />} />}
        <TitreSection>{t('langue')}</TitreSection>
        <form action={changerLangue} className="grid grid-cols-2 gap-2">
          {/* Le nom d'une langue s'écrit toujours dans cette langue : ce n'est pas un texte à traduire. */}
          {([['fr', 'Français'], ['ar', 'العربية']] as const).map(([code, nom]) => (
            <button key={code} type="submit" name="langue" value={code} lang={code} aria-pressed={langue === code} className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${langue === code ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
              {nom}
            </button>
          ))}
        </form>
        <TitreSection>{t('theme')}</TitreSection>
        <form action={changerTheme} className="grid grid-cols-3 gap-2">
          {(['auto', 'clair', 'sombre'] as const).map((v) => (
            <button key={v} type="submit" name="theme" value={v} aria-pressed={choix === v} className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${choix === v ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
              {t(v === 'auto' ? 'themeAuto' : v === 'clair' ? 'themeClair' : 'themeSombre')}
            </button>
          ))}
        </form>
        <form action={seDeconnecter}>
          <button type="submit" className={`${classeBouton.danger} w-full`}>
            <LogOut aria-hidden className="directionnelle size-4" />
            {t('deconnexion')}
          </button>
        </form>
      </Page>
    </>
  );
}
