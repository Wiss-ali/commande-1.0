import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { seConnecter } from '@/app/actions/connexion';
import { Formulaire } from '@/components/Formulaire';
import { PagePublique } from '@/components/PagePublique';
import { Champ } from '@/components/ui';
import { sessionUtilisateur } from '@/lib/web';

export default async function Connexion() {
  const s = await sessionUtilisateur();
  if (s) redirect(s.complete ? '/' : '/connexion/code');
  const t = await getTranslations('connexion');
  return (
    <PagePublique titre={t('titre')} sousTitre={t('sousTitre')}>
      <Formulaire action={seConnecter} bouton={t('bouton')}>
        <Champ libelle={t('telephone')} name="telephone" type="tel" inputMode="tel" autoComplete="username" dir="ltr" placeholder="0550 12 34 56" required />
        <Champ libelle={t('motDePasse')} name="motDePasse" type="password" autoComplete="current-password" required />
      </Formulaire>
      <p className="text-sm text-doux">{t('oubli')}</p>
      <p className="text-sm text-doux">{t('invitation')}</p>
    </PagePublique>
  );
}
