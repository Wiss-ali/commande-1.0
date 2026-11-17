// Données communes aux pages publiques d'une boutique, lues une seule fois par requête.
import { headers } from 'next/headers';
import { cache } from 'react';
import { trouverBoutique, type Vitrine } from './boutique';
import { sessionUtilisateur } from './web';

export interface ContexteVitrine {
  v: Vitrine;
  /** Préfixe des liens : '' sur le sous-domaine, '/b/nom' sinon. */
  base: string;
  /** Le commerçant regarde sa boutique coupée : aperçu permis, commandes refusées. */
  apercu: boolean;
  nonce: string;
}

export const chargerVitrine = cache(async (sd: string): Promise<ContexteVitrine | null> => {
  const v = await trouverBoutique(decodeURIComponent(sd));
  if (!v) return null;
  const h = await headers();
  const base = h.get('x-boutique-base') === '' ? '' : `/b/${v.sousDomaine}`;
  let apercu = false;
  if (!v.disponible) {
    const s = await sessionUtilisateur();
    apercu = !!s?.complete && s.commercant.id === v.commercantId;
  }
  return { v, base, apercu, nonce: h.get('x-nonce') ?? '' };
});
