'use server';
// Actions de la boutique publique (acheteur sans compte). Aucune session : la boutique est retrouvée par son
// adresse, et tout se passe dans la transaction de ce commerçant. Le prix vient toujours de la fiche, jamais du téléphone.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { texte } from '@/lib/actions';
import { creerTicket, fraisPublics, trouverBoutique } from '@/lib/boutique';
import { config } from '@/lib/config';
import type { Etat } from '@/lib/etat';
import { prevenirVendeurs } from '@/lib/notifier';
import { infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemaLignes = z.array(z.object({ varianteId: z.string().regex(UUID), quantite: z.number().int().min(1).max(99) })).min(1).max(50);

/** Identifiant anonyme de l'appareil (cookie), pour limiter le nombre de tickets. */
async function appareil(): Promise<string> {
  const boite = await cookies();
  let id = boite.get('appareil')?.value;
  if (!id || !UUID.test(id)) {
    id = crypto.randomUUID();
    boite.set('appareil', id, { httpOnly: true, sameSite: 'lax', secure: config().https, path: '/', maxAge: 365 * 24 * 3600 });
  }
  return id;
}

export async function fraisLivraison(sousDomaine: string, wilaya: number, livraison: string): Promise<{ domicile: number | null; relais: number | null }> {
  const v = typeof sousDomaine === 'string' ? await trouverBoutique(sousDomaine) : null;
  if (!v || !Number.isInteger(wilaya) || wilaya < 1 || wilaya > 99) return { domicile: null, relais: null };
  void livraison;
  const [domicile, relais] = await Promise.all([fraisPublics(v.commercantId, wilaya, 'domicile'), fraisPublics(v.commercantId, wilaya, 'point_relais')]);
  return { domicile, relais };
}

/** Valide le panier : crée le ticket, prévient le vendeur, puis ouvre la page du ticket (lien privé). */
export async function commander(_etat: Etat, f: FormData): Promise<Etat> {
  const sousDomaine = texte(f, 'boutique', 40);
  const base = texte(f, 'base', 60);
  const v = await trouverBoutique(sousDomaine);
  if (!v) return { erreur: 'introuvable' };
  // Paiement par carte : jamais traité. L'acheteur doit choisir le paiement à la livraison.
  if (f.get('paiement') === 'carte') return { erreur: 'carte_inactive' };
  let lignes: z.infer<typeof schemaLignes>;
  try {
    const lu = schemaLignes.safeParse(JSON.parse(String(f.get('lignes') ?? '')));
    if (!lu.success) return { erreur: 'panier_vide' };
    lignes = lu.data;
  } catch {
    return { erreur: 'panier_vide' };
  }
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(cle)) return { erreur: 'inconnue' };
  const t = await getTranslations('commandes');
  const { ip } = await infoRequete();
  const r = await creerTicket(v, {
    nom: texte(f, 'nom', 120), telephone: texte(f, 'telephone', 30), wilaya: Number(texte(f, 'wilaya', 3)) || 0, commune: texte(f, 'commune', 80),
    livraison: f.get('livraison') === 'point_relais' ? 'point_relais' : 'domicile', lignes, piege: texte(f, 'site_web', 200),
    appareil: await appareil(), ip, libelleLivraison: t('libelleLivraison'), cle,
  });
  if (!r.ok) return { erreur: r.raison };
  // Notification du vendeur : jamais bloquante pour l'acheteur.
  try {
    const tn = await getTranslations('notifications');
    await prevenirVendeurs(v.commercantId, { titre: tn('pushTitre', { n: r.numero }), texte: tn('pushTexte'), url: `/commandes/${r.commandeId}` });
  } catch {
    console.error('[push] envoi impossible');
  }
  // Sur son sous-domaine, la boutique n'a pas de préfixe ; sinon ses pages sont sous /b/nom.
  redirect(`${base === '' ? '' : `/b/${v.sousDomaine}`}/t/${r.jeton}?nouveau=1`);
}
