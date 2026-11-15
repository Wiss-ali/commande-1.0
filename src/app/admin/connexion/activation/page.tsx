import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { adminActiver2fa, adminPreparer2fa } from '@/app/actions/admin';
import { Activation2fa } from '@/components/Activation2fa';
import { PagePublique } from '@/components/PagePublique';
import { sessionAdmin } from '@/lib/web';

export default async function AdminActivation() {
  const s = await sessionAdmin();
  if (!s) redirect('/admin/connexion');
  const t = await getTranslations('admin');
  return (
    <PagePublique titre={t('activationTitre')} sousTitre={t('activationTexte')}>
      <Activation2fa preparer={adminPreparer2fa} activer={adminActiver2fa} suite={{ href: '/admin', libelle: t('codesContinuer') }} />
    </PagePublique>
  );
}
