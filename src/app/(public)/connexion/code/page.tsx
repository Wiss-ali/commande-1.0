import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { seDeconnecter, verifierCodeConnexion } from '@/app/actions/connexion';
import { Formulaire } from '@/components/Formulaire';
import { PagePublique } from '@/components/PagePublique';
import { Champ, classeBouton } from '@/components/ui';
import { sessionUtilisateur } from '@/lib/web';

export default async function Code() {
  const s = await sessionUtilisateur();
  if (!s) redirect('/connexion');
  if (s.complete) redirect('/');
  const t = await getTranslations('code');
  return (
    <PagePublique titre={t('titre')} sousTitre={t('texte')}>
      <Formulaire action={verifierCodeConnexion} bouton={t('bouton')}>
        <Champ libelle={t('champ')} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" aide={t('secours')} required autoFocus />
      </Formulaire>
      <form action={seDeconnecter}>
        <button type="submit" className={classeBouton.secondaire}>{t('autreCompte')}</button>
      </form>
    </PagePublique>
  );
}
