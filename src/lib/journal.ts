// Journal des actions sensibles. En ajout seulement : la base refuse toute modification.
// Ne jamais y mettre de mot de passe, de jeton, de téléphone ni d'adresse.
import { bd, type Trx } from './bd.ts';
import type { Kysely } from 'kysely';
import type { BD } from './types-bd.ts';

export interface Entree {
  commercantId: string | null;
  acteurType: 'utilisateur' | 'administrateur' | 'systeme' | 'anonyme';
  acteurId?: string | null;
  action: string;
  objetType?: string;
  objetId?: string | null;
  details?: Record<string, string | number | boolean | null>;
  ip?: string | null;
}

export async function journaliser(via: Trx | Kysely<BD>, e: Entree): Promise<void> {
  await via
    .insertInto('journal_actions')
    .values({
      commercant_id: e.commercantId,
      acteur_type: e.acteurType,
      acteur_id: e.acteurId ?? null,
      action: e.action,
      objet_type: e.objetType ?? null,
      objet_id: e.objetId ?? null,
      details: JSON.stringify(e.details ?? {}),
      ip_tronquee: e.ip ?? null,
    })
    .execute();
}

export const journaliserAuth = (e: Entree) => journaliser(bd('auth'), e);

/** Adresse tronquée (IPv4 : /24, IPv6 : /48) : assez pour repérer un abus, pas pour identifier une personne. */
export function tronquerIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const propre = ip.trim().replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(propre)) return `${propre.split('.').slice(0, 3).join('.')}.0`;
  if (propre.includes(':')) return `${propre.split(':').slice(0, 3).join(':')}::`;
  return null;
}
