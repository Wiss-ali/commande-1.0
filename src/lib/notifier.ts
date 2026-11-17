// Prévient les vendeurs d'une nouvelle commande de la boutique sur leur téléphone (Web Push).
// Appelé après la transaction : un échec d'envoi ne défait jamais le ticket de l'acheteur.
import { avecCommercant } from './bd.ts';
import { abonnementsVendeurs } from './boutique.ts';
import { config } from './config.ts';
import { envoyerPush } from './push.ts';

export function clesVapid(): { publique: string; privee: string; contact: string } | null {
  const c = config();
  if (!c.VAPID_PUBLIQUE || !c.VAPID_PRIVEE) return null;
  return { publique: c.VAPID_PUBLIQUE, privee: c.VAPID_PRIVEE, contact: c.VAPID_CONTACT || c.URL_APP };
}

/** Le message ne contient ni nom ni téléphone : seulement le titre, le texte et l'adresse à ouvrir. */
export async function prevenirVendeurs(commercantId: string, message: { titre: string; texte: string; url: string }): Promise<number> {
  const cles = clesVapid();
  if (!cles) return 0;
  const abonnements = await avecCommercant(commercantId, abonnementsVendeurs);
  let envoyes = 0;
  const expires: string[] = [];
  await Promise.all(abonnements.map(async (a) => {
    const r = await envoyerPush(a.abonnement, JSON.stringify(message), cles);
    if (r === 'envoye') envoyes++;
    if (r === 'expire') expires.push(a.id);
  }));
  if (expires.length) await avecCommercant(commercantId, (trx) => trx.deleteFrom('abonnements_push').where('id', 'in', expires).execute());
  return envoyes;
}
