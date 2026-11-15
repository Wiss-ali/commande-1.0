import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { adminCode, adminDeconnexion } from '@/app/actions/admin';
import { Formulaire } from '@/components/Formulaire';
import { PagePublique } from '@/components/PagePublique';
import { Champ, classeBouton } from '@/components/ui';
import { sessionAdmin } from '@/lib/web';

export default async function AdminCode() {
  const s = await sessionAdmin();
  if (!s) redirect('/admin/connexion');
  if (s.complete) redirect('/admin');
  if (!s.administrateur.totpActif) redirect('/admin/connexion/activation');
  const t = await getTranslations('code');
  return (
    <PagePublique titre={t('titre')} sousTitre={t('texte')}>
      <Formulaire action={adminCode} bouton={t('bouton')}>
        <Champ libelle={t('champ')} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" aide={t('secours')} required autoFocus />
      </Formulaire>
      <form action={adminDeconnexion}>
        <button type="submit" className={classeBouton.secondaire}>{t('autreCompte')}</button>
      </form>
    </PagePublique>
  );
}
