import { Download } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { ImportProduits } from '@/components/ImportProduits';
import { Page } from '@/components/Page';
import { Carte, classeBouton, Message } from '@/components/ui';
import { MAX_LIGNES } from '@/lib/tableur';
import { pageUtilisateur } from '@/lib/web';

export default async function Import() {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const t = await getTranslations('import');
  return (
    <>
      <EnTete titre={t('titre')} retour="/stock" />
      <Page>
        <Carte className="flex flex-col gap-3">
          <p className="text-sm">{t('explication', { max: MAX_LIGNES })}</p>
          {/* Téléchargement d'un fichier : un lien normal, pas une navigation interne. */}
          <a href="/stock/import/modele" download className={classeBouton.secondaire}><Download aria-hidden className="size-5" />{t('modele')}</a>
        </Carte>
        {s.commercant.etat === 'actif' ? <ImportProduits /> : <Message ton="info">{t('lectureSeule')}</Message>}
        <Link href="/stock" className={classeBouton.secondaire}>{t('retourStock')}</Link>
      </Page>
    </>
  );
}
