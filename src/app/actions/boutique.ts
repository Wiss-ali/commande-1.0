'use server';
// Actions du commerçant sur sa boutique (droit « reglages », module Boutique), ses notifications et ses demandes.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import {
  changerSousDomaine, creerBoutique, demander, supprimerBoutique, type SaisieReglages, enregistrerAbonnement, enregistrerPixels, enregistrerReglages, fixerImage, lireReglages, marquerVues, mettreEnLigne, ouvrirNotification, MODELES, RESEAUX, retirerAbonnement,
  SECTIONS, type Section,
} from '@/lib/boutique';
import { ACTIVITES, AMBIANCES, FORMES_LOGO } from '@/lib/design-boutique';
import { textesExemple } from '@/lib/exemples-boutique';
import { journaliser } from '@/lib/journal';
import { enregistrerImageLibre, MAX_OCTETS_PHOTO, preparerPhoto, supprimerImageLibre } from '@/lib/photos';
import { abonnementValide } from '@/lib/push';
import type { SessionUtilisateur } from '@/lib/sessions';
import type { Contexte } from '@/lib/stock';
import type { AmbianceBoutique, FormeLogo } from '@/lib/types-bd';
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

/**
 * Personnalisation, en trois parties enregistrées séparément (chaque formulaire n'envoie que la sienne) :
 * « apparence » (modèle, couleur, ambiance, logo dessiné ou envoyé, bannière), « textes » (accroche, accueil,
 * livraison, retour) et « reglages » (ordre des sections, contact, ruptures, pastilles, réservation).
 */
export const personnaliser = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const partie = f.get('partie');
  const images: Partial<Record<'logo' | 'banniere', Awaited<ReturnType<typeof preparerPhoto>>>> = {};
  if (partie === 'apparence') {
    for (const quoi of ['logo', 'banniere'] as const) {
      const fichier = f.get(quoi);
      if (fichier instanceof File && fichier.size > 0) {
        if (fichier.size > MAX_OCTETS_PHOTO) return { erreur: 'photo_invalide' };
        const prete = await preparerPhoto(new Uint8Array(await fichier.arrayBuffer()));
        if (!prete) return { erreur: 'photo_invalide' };
        images[quoi] = prete;
      }
    }
  }
  const ctx = ctxDe(s);
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const actuels = await lireReglages(trx);
    let saisie: SaisieReglages = actuels;
    if (partie === 'apparence') {
      const modele = MODELES.find((m) => m === f.get('modele')) ?? actuels.modele;
      const produit = texte(f, 'produitUnique', 40);
      const icone = texte(f, 'logoIcone', 20);
      saisie = {
        ...actuels, modele,
        produitUniqueId: f.has('produitUnique') ? (UUID.test(produit) ? produit : null) : actuels.produitUniqueId,
        couleur: texte(f, 'couleur', 20) || actuels.couleur,
        ambiance: (AMBIANCES as readonly string[]).includes(texte(f, 'ambiance', 20)) ? (texte(f, 'ambiance', 20) as AmbianceBoutique) : actuels.ambiance,
        logoForme: (FORMES_LOGO as readonly string[]).includes(texte(f, 'logoForme', 20)) ? (texte(f, 'logoForme', 20) as FormeLogo) : actuels.logoForme,
        logoIcone: f.has('logoIcone') ? (icone || null) : actuels.logoIcone,
      };
    } else if (partie === 'textes') {
      const deux = (k: string, max: number) => ({ fr: texte(f, `${k}_fr`, max), ar: texte(f, `${k}_ar`, max) });
      saisie = { ...actuels, slogan: deux('slogan', 80), accueil: deux('accueil', 500), livraison: deux('livraison', 1000), retour: deux('retour', 1000) };
    } else if (partie === 'reglages') {
      // Sections : chaque section a une position ; les égalités gardent l'ordre par défaut.
      const sections = [...SECTIONS].map((x, i) => ({ x, p: entier(f, `position_${x}`, i + 1) * 10 + i })).sort((a, b) => a.p - b.p).map((y) => y.x as Section);
      saisie = {
        ...actuels, sections,
        reseaux: Object.fromEntries(RESEAUX.map((n) => [n, texte(f, `reseau_${n}`, 200)])),
        whatsapp: texte(f, 'whatsapp', 30) || null,
        ruptures: f.get('ruptures') === 'masque' ? 'masque' : 'visible',
        plusQue: entier(f, 'plusQue', actuels.plusQue),
        reservationHeures: entier(f, 'reservationHeures', actuels.reservationHeures),
        maxParArticle: entier(f, 'maxParArticle', actuels.maxParArticle),
        maxTicketsAttente: entier(f, 'maxTicketsAttente', actuels.maxTicketsAttente),
      };
    } else return { ok: false as const, raison: 'champ_requis' as const };
    const fait = await enregistrerReglages(trx, ctx, saisie);
    if (!fait.ok) return fait;
    for (const quoi of ['logo', 'banniere'] as const) {
      const image = images[quoi];
      const retirer = partie === 'apparence' && f.get(`retirer_${quoi}`) === '1';
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

/** Assistant de création : la boutique est créée coupée, avec les textes d'exemple de l'activité (fr et ar). */
export const creerMaBoutique = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const activite = ACTIVITES[texte(f, 'activite', 20)] ? texte(f, 'activite', 20) : 'autre';
  const exemples = textesExemple(activite);
  const ambiance = texte(f, 'ambiance', 20);
  const forme = texte(f, 'logoForme', 20);
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await creerBoutique(trx, ctxDe(s), {
      sousDomaine: texte(f, 'sousDomaine', 60), activite,
      modele: MODELES.find((m) => m === f.get('modele')) ?? 'vitrine',
      couleur: texte(f, 'couleur', 20),
      ambiance: (AMBIANCES as readonly string[]).includes(ambiance) ? (ambiance as AmbianceBoutique) : 'moderne',
      logoForme: (FORMES_LOGO as readonly string[]).includes(forme) ? (forme as FormeLogo) : 'rond',
      logoIcone: texte(f, 'logoIcone', 20) || null,
      publierTout: f.get('publierTout') === 'oui',
    }, exemples);
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'boutique.creee', ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect('/boutique?creee=1');
});

/** Suppression de la boutique : il faut retaper son adresse. Produits, commandes et documents restent. */
export const supprimerMaBoutique = action(async (f) => {
  const s = await exigerEcriture('reglages', 'boutique');
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const c = await trx.selectFrom('commercants').select('sous_domaine').executeTakeFirstOrThrow();
    if (!c.sous_domaine || texte(f, 'confirmation', 60).toLowerCase() !== c.sous_domaine) return false;
    await supprimerBoutique(trx, ctxDe(s));
    await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'boutique.supprimee', ip });
    return true;
  });
  if (!r) return { erreur: 'confirmation_incorrecte' };
  revalidatePath('/', 'layout');
  redirect('/boutique?supprimee=1');
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
