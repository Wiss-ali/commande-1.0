// Pastille de statut d'une commande : forme et couleur, lisible sans les couleurs.
import { getTranslations } from 'next-intl/server';
import type { StatutCommande } from '@/lib/types-bd';
import { Pastille } from './ui';

const TON: Record<StatutCommande, 'vert' | 'safran' | 'terre' | 'bleu' | 'neutre'> = {
  nouvelle: 'safran', a_confirmer: 'safran', confirmee: 'bleu', preparee: 'bleu', expediee: 'bleu', livree: 'vert', retournee: 'terre', annulee: 'neutre',
};

export async function PastilleCommande({ statut }: { statut: StatutCommande }) {
  const t = await getTranslations('commandes.statut');
  return <Pastille ton={TON[statut]}>{t(statut)}</Pastille>;
}
