'use server';
// Actions du commerçant sur sa boutique (droit « reglages », module Boutique), ses notifications et ses demandes.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import {
  changerSousDomaine, demander, enregistrerAbonnement, enregistrerPixels, enregistrerReglages, fixerImage, lireReglages, marquerVues, mettreEnLigne, ouvrirNotification, MODELES, RESEAUX, retirerAbonnement,
  SECTIONS, type Section,
} from '@/lib/boutique';
import { journaliser } from '@/lib/journal';
import { enregistrerImageLibre, MAX_OCTETS_PHOTO, preparerPhoto, supprimerImageLibre } from '@/lib/photos';
import { abonnementValide } from '@/lib/push';
import type { SessionUtilisateur } from '@/lib/sessions';
import type { Contexte } from '@/lib/stock';
import type { ModeleBoutique } from '@/lib/types-bd';
import { exigerEcriture, exigerUtilisateur, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ctxDe = (s: SessionUtilisateur): Contexte => ({ commercantId: s.commercant.id, utilisateurId: s.utilisateur.id });
const entier = (f: FormData, nom: string, defaut: number) => {
  const v = texte(f, nom, 4);
  return /^\d{1,3}$/.test(v) ? Number(v) : defaut;
};

export const choisirAdresse = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const r = await avecCommercant(s.commercant.id, (trx) => changerSousDomaine(trx, texte(f, 'sousDomaine', 60)));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/boutique');
  return { ok: true };
});

export const basculerBoutique = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const enLigne = f.get('enLigne') === 'oui';
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await mettreEnLigne(trx, ctxDe(s), enLigne);
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: enLigne ? 'boutique.en_ligne' : 'boutique.coupee', ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  return { ok: true };
});

export const choisirModele = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const modele = MODELES.find((m) => m === f.get('modele')) as ModeleBoutique | undefined;
  if (!modele) return { erreur: 'champ_requis' };
  const produit = texte(f, 'produitUnique', 40);
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const actuels = await lireReglages(trx);
    return enregistrerReglages(trx, ctxDe(s), { ...actuels, modele, produitUniqueId: modele === 'produit_unique' && UUID.test(produit) ? produit : actuels.produitUniqueId });
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/boutique');
  return { ok: true };
});

/** Personnalisation : couleur, textes, sections, réseaux, WhatsApp, ruptures, pastilles, réservation, logo et bannière. */
export const personnaliser = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const images: Partial<Record<'logo' | 'banniere', Awaited<ReturnType<typeof preparerPhoto>>>> = {};
  for (const quoi of ['logo', 'banniere'] as const) {
    const fichier = f.get(quoi);
    if (fichier instanceof File && fichier.size > 0) {
      if (fichier.size > MAX_OCTETS_PHOTO) return { erreur: 'photo_invalide' };
      const prete = await preparerPhoto(new Uint8Array(await fichier.arrayBuffer()));
      if (!prete) return { erreur: 'photo_invalide' };
      images[quoi] = prete;
    }
  }
  // Sections : chaque section a une position (1 à 4) ; les égalités gardent l'ordre par défaut.
  const sections = [...SECTIONS].map((x, i) => ({ x, p: entier(f, `position_${x}`, i + 1) * 10 + i })).sort((a, b) => a.p - b.p).map((y) => y.x as Section);
  const ctx = ctxDe(s);
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const actuels = await lireReglages(trx);
    const fait = await enregistrerReglages(trx, ctx, {
      ...actuels,
      couleur: texte(f, 'couleur', 20) || actuels.couleur,
      accueil: { fr: texte(f, 'accueil_fr', 500), ar: texte(f, 'accueil_ar', 500) },
      livraison: { fr: texte(f, 'livraison_fr', 1000), ar: texte(f, 'livraison_ar', 1000) },
      retour: { fr: texte(f, 'retour_fr', 1000), ar: texte(f, 'retour_ar', 1000) },
      sections,
      reseaux: Object.fromEntries(RESEAUX.map((n) => [n, texte(f, `reseau_${n}`, 200)])),
      whatsapp: texte(f, 'whatsapp', 30) || null,
      ruptures: f.get('ruptures') === 'masque' ? 'masque' : 'visible',
      plusQue: entier(f, 'plusQue', actuels.plusQue),
      reservationHeures: entier(f, 'reservationHeures', actuels.reservationHeures),
    });
    if (!fait.ok) return fait;
    for (const quoi of ['logo', 'banniere'] as const) {
      const image = images[quoi];
      const retirer = f.get(`retirer_${quoi}`) === '1';
      if (!image && !retirer) continue;
      const nouvel = image ? await enregistrerImageLibre(trx, ctx, image) : null;
      const ancien = await fixerImage(trx, ctx, quoi, nouvel);
      if (ancien) await supprimerImageLibre(trx, ctx, ancien);
    }
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/boutique');
  return { ok: true };
});

/** Pixels de mesure des publicités : vides, ils sont désactivés. */
export const enregistrerPixelsBoutique = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await enregistrerPixels(trx, ctxDe(s), { facebook: texte(f, 'pixelFacebook', 30), tiktok: texte(f, 'pixelTiktok', 40) });
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'boutique.pixels', ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/boutique');
  return { ok: true };
});

/** Interrupteurs d'un produit : « Visible dans la boutique » et pastille « Nouveau ». */
export const basculerProduit = actionSimple(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const id = texte(f, 'id', 40);
  const champ = f.get('champ') === 'nouveau' ? 'nouveau' : 'visible_boutique';
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => trx.updateTable('produits').set({ [champ]: f.get('valeur') === 'oui' }).where('id', '=', id).execute());
  revalidatePath('/boutique');
});

/** Demande à l'administrateur : activation du paiement par carte, ou site personnalisé. */
export const envoyerDemande = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const type = f.get('type') === 'site_personnalise' ? 'site_personnalise' : 'paiement_carte';
  const r = await avecCommercant(s.commercant.id, (trx) => demander(trx, ctxDe(s), type, { nom: texte(f, 'nom', 120), telephone: texte(f, 'telephone', 30), message: texte(f, 'message', 500) }));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/boutique');
  return { ok: true };
});

// ───────────── Notifications ─────────────

export const notificationsVues = actionSimple(async () => {
  const s = await exigerUtilisateur('vendre');
  await avecCommercant(s.commercant.id, (trx) => marquerVues(trx, ctxDe(s)));
  revalidatePath('/', 'layout');
});

/** Ouvre une notification : elle est marquée comme lue, puis la commande s'affiche. */
export const ouvrirUneNotification = actionSimple(async (f) => {
  const s = await exigerUtilisateur('vendre');
  const id = texte(f, 'id', 36);
  if (!UUID.test(id)) redirect('/notifications');
  const commande = await avecCommercant(s.commercant.id, (trx) => ouvrirNotification(trx, ctxDe(s), id));
  revalidatePath('/', 'layout');
  redirect(commande ? `/commandes/${commande}` : '/notifications');
});

/** Abonnement du téléphone aux notifications (Web Push). L'adresse doit être celle d'un service connu. */
export async function abonnerTelephone(abonnement: unknown): Promise<boolean> {
  const s = await exigerUtilisateur('vendre');
  if (!abonnementValide(abonnement)) return false;
  await avecCommercant(s.commercant.id, (trx) => enregistrerAbonnement(trx, ctxDe(s), { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.keys.p256dh, auth: abonnement.keys.auth } }));
  return true;
}

export async function desabonnerTelephone(endpoint: unknown): Promise<void> {
  const s = await exigerUtilisateur('vendre');
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return;
  await avecCommercant(s.commercant.id, (trx) => retirerAbonnement(trx, endpoint));
}
