import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { ScanRecherche } from '@/components/ScanRecherche';
import { autorise } from '@/lib/droits';
import { pageUtilisateur } from '@/lib/web';

export default async function Scan() {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('scan');
  return (
    <>
      <EnTete titre={t('titre')} />
      <Page>
        <ScanRecherche peutCreer={autorise(s.utilisateur, 'produits.gerer') && s.commercant.etat === 'actif'} />
      </Page>
    </>
  );
}
