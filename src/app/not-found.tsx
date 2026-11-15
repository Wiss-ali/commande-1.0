import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PagePublique } from '@/components/PagePublique';
import { classeBouton } from '@/components/ui';

export default async function Introuvable() {
  const t = await getTranslations('pageErreur');
  return (
    <PagePublique titre={t('introuvableTitre')} sousTitre={t('introuvableTexte')}>
      <Link href="/" className={classeBouton.secondaire}>{t('accueil')}</Link>
    </PagePublique>
  );
}
