import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { adminConnexion } from '@/app/actions/admin';
import { Formulaire } from '@/components/Formulaire';
import { PagePublique } from '@/components/PagePublique';
import { Champ } from '@/components/ui';
import { sessionAdmin } from '@/lib/web';

export default async function AdminConnexion() {
  const s = await sessionAdmin();
  if (s?.complete) redirect('/admin');
  const t = await getTranslations('admin');
  const tc = await getTranslations('connexion');
  return (
    <PagePublique titre={t('connexionTitre')}>
      <Formulaire action={adminConnexion} bouton={tc('bouton')}>
        <Champ libelle={t('identifiant')} name="identifiant" autoComplete="username" dir="ltr" autoCapitalize="none" required />
        <Champ libelle={tc('motDePasse')} name="motDePasse" type="password" autoComplete="current-password" required />
      </Formulaire>
    </PagePublique>
  );
}
