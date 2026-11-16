import { useTranslations } from 'next-intl';
import type { EtatStock } from '@/lib/stock';
import { Pastille } from './ui';

/** État du stock : la forme change avec la couleur (rond, losange, carré). */
export function PastilleStock({ etat }: { etat: EtatStock }) {
  const t = useTranslations('stock');
  if (etat === 'rupture') return <Pastille ton="terre">{t('rupture')}</Pastille>;
  if (etat === 'bas') return <Pastille ton="safran">{t('bas')}</Pastille>;
  return <Pastille ton="vert">{t('enStock')}</Pastille>;
}
