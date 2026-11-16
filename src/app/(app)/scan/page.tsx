import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { ScanRecherche } from '@/components/ScanRecherche';
import { peut } from '@/lib/droits';
import { pageUtilisateur } from '@/lib/web';

export default async function Scan() {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('scan');
  return (
    <>
      <EnTete titre={t('titre')} />
      <Page>
        <ScanRecherche peutCreer={peut(s.utilisateur.role, 'stock.corriger') && s.commercant.etat === 'actif'} />
      </Page>
    </>
  );
}
