import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { pageUtilisateur } from '@/lib/web';

export default async function AccesRefuse() {
  await pageUtilisateur();
  const t = await getTranslations('pageErreur');
  return (
    <>
      <EnTete titre={t('interditTitre')} />
      <Page>
        <EtatVide titre={t('interditTitre')} texte={t('interditTexte')}>
          <Link href="/" className={`${classeBouton.secondaire} mt-2`}>{t('accueil')}</Link>
        </EtatVide>
      </Page>
    </>
  );
}
