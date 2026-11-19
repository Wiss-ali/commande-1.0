// Boutique en ligne : réglages du commerçant, catalogue public relié au stock, tickets des acheteurs sans compte,
// demandes à l'administrateur et notifications. Le catalogue public ne montre que ce que le commerçant a publié.
import { sql } from 'kysely';
import { etatEffectif, modulesEffectifs, situation } from './abonnements.ts';
import { avecCommercant, bd, type Trx } from './bd.ts';
import { chiffrer, dechiffrer, empreinte, hacherJeton, nouveauJeton } from './chiffrement.ts';
import { creerCommande, expirerTickets, fraisPour, type RefusCommande } from './commandes.ts';
import { normaliserTelephone } from './formats.ts';
import { autoriser } from './limites.ts';
import type { Contexte } from './stock.ts';
import { ACTIVITES, AMBIANCES, FORMES_LOGO, ICONES_LOGO, PALETTE } from './design-boutique.ts';
import { supprimerImageLibre } from './photos.ts';
import type { AmbianceBoutique, FormeLogo, ModeleBoutique, ModeLivraison, TypeDemande } from './types-bd.ts';

export const MODELES: readonly ModeleBoutique[] = ['vitrine', 'catalogue', 'grandes_photos', 'produit_unique'];
export const SECTIONS = ['accueil', 'atouts', 'produits', 'conditions', 'contact'] as const;
export type Section = (typeof SECTIONS)[number];
export const RESEAUX = ['facebook', 'instagram', 'tiktok'] as const;

// Couleurs, ambiances, logos et activités : voir design-boutique.ts (partagé avec le navigateur).
export { PALETTE } from './design-boutique.ts';

/** Noms d'adresse réservés au service lui-même. */
const RESERVES = new Set(['www', 'admin', 'api', 'app', 'mail', 'smtp', 'ftp', 'static', 'cdn', 'boutique', 'b', 'test', 'demo', 'hanout', 'support', 'aide', 'status', 'etat']);

export type RefusBoutique = 'boutique_existe' | 'sous_domaine_invalide' | 'sous_domaine_pris' | 'sous_domaine_requis' | 'introuvable' | 'champ_requis' | 'telephone_invalide' | 'demande_en_cours';

/** Nom d'adresse : minuscules, chiffres et tirets, 3 à 40 caractères, ni au début ni à la fin un tiret. */
export function verifierSousDomaine(saisie: string): string | null {
  const s = saisie.trim().toLowerCase();
  return /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s) && !s.includes('--') && !RESERVES.has(s) ? s : null;
}

// ───────────── Réglages du commerçant ─────────────

export interface ReglagesBoutique {
  enLigne: boolean;
  modele: ModeleBoutique;
  produitUniqueId: string | null;
  couleur: string;
  logoId: string | null;
  banniereId: string | null;
  accueil: { fr: string; ar: string };
  livraison: { fr: string; ar: string };
  retour: { fr: string; ar: string };
  sections: Section[];
  reseaux: Partial<Record<(typeof RESEAUX)[number], string>>;
  whatsapp: string | null;
  ruptures: 'visible' | 'masque';
  plusQue: number;
  reservationHeures: number;
  /** Identifiants de mesure des publicités ; null : rien n'est chargé. */
  pixels: { facebook: string | null; tiktok: string | null };
  activite: string;
  ambiance: AmbianceBoutique;
  logoForme: FormeLogo;
  /** Icône du logo dessiné ; null : initiales du magasin. */
  logoIcone: string | null;
  slogan: { fr: string; ar: string };
}

export const REGLAGES_DEFAUT: ReglagesBoutique = {
  enLigne: false, modele: 'vitrine', produitUniqueId: null, couleur: 'emeraude', logoId: null, banniereId: null,
  accueil: { fr: '', ar: '' }, livraison: { fr: '', ar: '' }, retour: { fr: '', ar: '' }, sections: [...SECTIONS], reseaux: {},
  whatsapp: null, ruptures: 'visible', plusQue: 3, reservationHeures: 24, pixels: { facebook: null, tiktok: null },
  activite: 'autre', ambiance: 'moderne', logoForme: 'rond', logoIcone: 'sac', slogan: { fr: '', ar: '' },
};

/** Sections manquantes (ajoutées depuis) : « atouts » juste après l'accueil, les autres à la fin. */
function completerSections(sections: Section[]): Section[] {
  const r = [...sections];
  if (!r.includes('atouts')) r.splice(r.includes('accueil') ? r.indexOf('accueil') + 1 : 0, 0, 'atouts');
  return [...r, ...SECTIONS.filter((x) => !r.includes(x))];
}

export async function lireReglages(trx: Trx): Promise<ReglagesBoutique> {
  const b = await trx.selectFrom('boutiques').selectAll().executeTakeFirst();
  if (!b) return { ...REGLAGES_DEFAUT };
  const sections = (b.sections ?? []).filter((x): x is Section => (SECTIONS as readonly string[]).includes(x));
  return {
    enLigne: b.en_ligne, modele: b.modele, produitUniqueId: b.produit_unique_id, couleur: PALETTE[b.couleur] ? b.couleur : 'emeraude',
    logoId: b.logo_id, banniereId: b.banniere_id,
    accueil: { fr: b.accueil_fr, ar: b.accueil_ar }, livraison: { fr: b.livraison_fr, ar: b.livraison_ar }, retour: { fr: b.retour_fr, ar: b.retour_ar },
    sections: completerSections(sections), reseaux: b.reseaux ?? {}, whatsapp: b.whatsapp,
    ruptures: b.ruptures, plusQue: b.plus_que, reservationHeures: b.reservation_heures,
    pixels: { facebook: b.pixel_facebook, tiktok: b.pixel_tiktok },
    activite: ACTIVITES[b.activite] ? b.activite : 'autre', ambiance: b.ambiance, logoForme: b.logo_forme,
    logoIcone: b.logo_icone && (ICONES_LOGO as readonly string[]).includes(b.logo_icone) ? b.logo_icone : null,
    slogan: { fr: b.slogan_fr, ar: b.slogan_ar },
  };
}

export const FORMAT_PIXEL = { facebook: /^[0-9]{8,20}$/, tiktok: /^[A-Z0-9]{10,30}$/ } as const;

/**
 * Pixels de mesure des publicités. Vides : rien n'est chargé. Seul le format d'un identifiant est accepté
 * (chiffres pour Facebook, lettres majuscules et chiffres pour TikTok) : aucun code ne peut être collé.
 */
export async function enregistrerPixels(trx: Trx, ctx: Contexte, p: { facebook: string; tiktok: string }): Promise<{ ok: true } | { ok: false; raison: 'pixel_invalide' }> {
  const facebook = p.facebook.replace(/\s/g, '') || null;
  const tiktok = p.tiktok.replace(/\s/g, '').toUpperCase() || null;
  if ((facebook && !FORMAT_PIXEL.facebook.test(facebook)) || (tiktok && !FORMAT_PIXEL.tiktok.test(tiktok))) return { ok: false, raison: 'pixel_invalide' };
  const valeurs = { pixel_facebook: facebook, pixel_tiktok: tiktok };
  await trx.insertInto('boutiques').values({ commercant_id: ctx.commercantId, ...valeurs }).onConflict((oc) => oc.column('commercant_id').doUpdateSet(valeurs)).execute();
  return { ok: true };
}

const propre = (s: string | undefined, max: number) => (s ?? '').trim().slice(0, max);
/** Lien d'un réseau social : seulement une adresse https du réseau concerné. */
function lienReseau(reseau: (typeof RESEAUX)[number], saisie: string | undefined): string | null {
  const s = (saisie ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const hotes: Record<string, RegExp> = { facebook: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, instagram: /(^|\.)instagram\.com$/, tiktok: /(^|\.)tiktok\.com$/ };
    return u.protocol === 'https:' && hotes[reseau]!.test(u.hostname) && s.length <= 200 ? u.toString() : null;
  } catch {
    return null;
  }
}

export type SaisieReglages = Omit<ReglagesBoutique, 'enLigne' | 'logoId' | 'banniereId' | 'pixels'>;

export async function enregistrerReglages(trx: Trx, ctx: Contexte, r: SaisieReglages): Promise<{ ok: true } | { ok: false; raison: 'champ_requis' | 'telephone_invalide' | 'introuvable' }> {
  if (!MODELES.includes(r.modele) || !PALETTE[r.couleur] || (r.ruptures !== 'visible' && r.ruptures !== 'masque')) return { ok: false, raison: 'champ_requis' };
  if (!ACTIVITES[r.activite] || !AMBIANCES.includes(r.ambiance) || !FORMES_LOGO.includes(r.logoForme) || (r.logoIcone !== null && !(ICONES_LOGO as readonly string[]).includes(r.logoIcone))) return { ok: false, raison: 'champ_requis' };
  if (!Number.isInteger(r.plusQue) || r.plusQue < 0 || r.plusQue > 99 || !Number.isInteger(r.reservationHeures) || r.reservationHeures < 1 || r.reservationHeures > 168) return { ok: false, raison: 'champ_requis' };
  let whatsapp: string | null = null;
  if (r.whatsapp?.trim()) {
    whatsapp = normaliserTelephone(r.whatsapp);
    if (!whatsapp) return { ok: false, raison: 'telephone_invalide' };
  }
  if (r.produitUniqueId) {
    const p = await trx.selectFrom('produits').select('id').where('id', '=', r.produitUniqueId).where('archive_le', 'is', null).executeTakeFirst();
    if (!p) return { ok: false, raison: 'introuvable' };
  }
  const sections = [...new Set(r.sections.filter((x) => (SECTIONS as readonly string[]).includes(x)))];
  const reseaux = Object.fromEntries(RESEAUX.flatMap((n) => { const l = lienReseau(n, r.reseaux[n]); return l ? [[n, l]] : []; }));
  const valeurs = {
    modele: r.modele, produit_unique_id: r.produitUniqueId, couleur: r.couleur,
    accueil_fr: propre(r.accueil.fr, 500), accueil_ar: propre(r.accueil.ar, 500),
    livraison_fr: propre(r.livraison.fr, 1000), livraison_ar: propre(r.livraison.ar, 1000),
    retour_fr: propre(r.retour.fr, 1000), retour_ar: propre(r.retour.ar, 1000),
    sections: JSON.stringify(sections), reseaux: JSON.stringify(reseaux), whatsapp, ruptures: r.ruptures, plus_que: r.plusQue, reservation_heures: r.reservationHeures,
    activite: r.activite, ambiance: r.ambiance, logo_forme: r.logoForme, logo_icone: r.logoIcone, slogan_fr: propre(r.slogan.fr, 80), slogan_ar: propre(r.slogan.ar, 80),
  };
  await trx.insertInto('boutiques').values({ commercant_id: ctx.commercantId, ...valeurs }).onConflict((oc) => oc.column('commercant_id').doUpdateSet(valeurs)).execute();
  return { ok: true };
}

/** Logo ou bannière : une image déjà vérifiée et rangée (voir photos.ts), rattachée à la boutique. */
export async function fixerImage(trx: Trx, ctx: Contexte, quoi: 'logo' | 'banniere', photoId: string | null): Promise<string | null> {
  const avant = await trx.selectFrom('boutiques').select(['logo_id', 'banniere_id']).executeTakeFirst();
  const colonne = quoi === 'logo' ? 'logo_id' : 'banniere_id';
  await trx.insertInto('boutiques').values({ commercant_id: ctx.commercantId, [colonne]: photoId }).onConflict((oc) => oc.column('commercant_id').doUpdateSet({ [colonne]: photoId })).execute();
  return (avant?.[colonne] as string | null | undefined) ?? null;
}

export async function changerSousDomaine(trx: Trx, saisie: string): Promise<{ ok: true; sousDomaine: string } | { ok: false; raison: RefusBoutique }> {
  const s = verifierSousDomaine(saisie);
  if (!s) return { ok: false, raison: 'sous_domaine_invalide' };
  // Vérification de disponibilité par l'empreinte de la liste publique (rôle « auth »), puis la base garantit l'unicité.
  const pris = await bd('auth').selectFrom('commercants').select('id').where('sous_domaine', '=', s).executeTakeFirst();
  const moi = await trx.selectFrom('commercants').select('id').executeTakeFirstOrThrow();
  if (pris && pris.id !== moi.id) return { ok: false, raison: 'sous_domaine_pris' };
  await trx.updateTable('commercants').set({ sous_domaine: s }).execute();
  return { ok: true, sousDomaine: s };
}

export async function mettreEnLigne(trx: Trx, ctx: Contexte, enLigne: boolean): Promise<{ ok: true } | { ok: false; raison: RefusBoutique }> {
  if (enLigne) {
    const c = await trx.selectFrom('commercants').select('sous_domaine').executeTakeFirstOrThrow();
    if (!c.sous_domaine) return { ok: false, raison: 'sous_domaine_requis' };
  }
  await trx.insertInto('boutiques').values({ commercant_id: ctx.commercantId, en_ligne: enLigne }).onConflict((oc) => oc.column('commercant_id').doUpdateSet({ en_ligne: enLigne })).execute();
  return { ok: true };
}

/** Textes d'exemple d'une activité, en français et en arabe (lus dans les fichiers de traduction par l'appelant). */
export type TextesExemple = Record<'slogan' | 'accueil' | 'livraison' | 'retour', { fr: string; ar: string }>;

export interface SaisieCreation {
  sousDomaine: string;
  activite: string;
  modele: ModeleBoutique;
  couleur: string;
  ambiance: AmbianceBoutique;
  logoForme: FormeLogo;
  logoIcone: string | null;
  /** Publier tout de suite les produits du stock (la boutique reste coupée jusqu'à « Mettre en ligne »). */
  publierTout: boolean;
}

/**
 * Création guidée : adresse, activité, modèle, logo dessiné, couleur, ambiance, et textes d'exemple à remplacer.
 * Une seule boutique par commerçant : la ligne de `boutiques` a pour clé le commerçant, et l'adresse est une colonne
 * du commerçant. La boutique créée reste coupée.
 */
export async function creerBoutique(trx: Trx, ctx: Contexte, c: SaisieCreation, exemples: TextesExemple): Promise<{ ok: true } | { ok: false; raison: RefusBoutique }> {
  const deja = await trx.selectFrom('commercants').select('sous_domaine').executeTakeFirstOrThrow();
  if (deja.sous_domaine) return { ok: false, raison: 'boutique_existe' };
  const adresse = await changerSousDomaine(trx, c.sousDomaine);
  if (!adresse.ok) return adresse;
  const fait = await enregistrerReglages(trx, ctx, {
    ...REGLAGES_DEFAUT, ...(await lireReglages(trx)),
    modele: c.modele, couleur: c.couleur, activite: c.activite, ambiance: c.ambiance, logoForme: c.logoForme, logoIcone: c.logoIcone,
    slogan: exemples.slogan, accueil: exemples.accueil, livraison: exemples.livraison, retour: exemples.retour, sections: [...SECTIONS],
  });
  if (!fait.ok) return { ok: false, raison: 'champ_requis' };
  if (c.publierTout) await trx.updateTable('produits').set({ visible_boutique: true }).where('archive_le', 'is', null).execute();
  return { ok: true };
}

/**
 * Suppression de la boutique par le commerçant : réglages, logo et bannière effacés, adresse libérée, produits retirés
 * de la boutique. Rien d'autre ne bouge : produits et stock, commandes (y compris celles venues de la boutique),
 * devis, factures et demandes restent. Le commerçant peut en recréer une plus tard.
 */
export async function supprimerBoutique(trx: Trx, ctx: Contexte): Promise<void> {
  const b = await trx.selectFrom('boutiques').select(['logo_id', 'banniere_id']).executeTakeFirst();
  await trx.deleteFrom('boutiques').execute();
  for (const id of [b?.logo_id, b?.banniere_id]) if (id) await supprimerImageLibre(trx, ctx, id);
  await trx.updateTable('produits').set({ visible_boutique: false, nouveau: false }).where('visible_boutique', '=', true).execute();
  await trx.updateTable('commercants').set({ sous_domaine: null }).execute();
}

// ───────────── Demandes à l'administrateur ─────────────

export async function demander(trx: Trx, ctx: Contexte, type: TypeDemande, d: { nom: string; telephone: string; message?: string }): Promise<{ ok: true } | { ok: false; raison: RefusBoutique }> {
  const nom = propre(d.nom, 120);
  if (!nom) return { ok: false, raison: 'champ_requis' };
  const telephone = normaliserTelephone(d.telephone);
  if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  const ouverte = await trx.selectFrom('demandes').select('id').where('type', '=', type).where('etat', '=', 'nouvelle').executeTakeFirst();
  if (ouverte) return { ok: false, raison: 'demande_en_cours' };
  await trx.insertInto('demandes').values({ commercant_id: ctx.commercantId, type, nom, telephone, message: propre(d.message, 500) }).execute();
  return { ok: true };
}

export const demandesDuCommercant = (trx: Trx) =>
  trx.selectFrom('demandes').select(['id', 'type', 'etat', 'cree_le', 'traitee_le', 'note_admin']).orderBy('cree_le', 'desc').limit(20).execute();

// ───────────── Côté public ─────────────

export interface Vitrine {
  commercantId: string;
  sousDomaine: string;
  nom: string;
  telephone: string | null;
  formeJuridique: string | null;
  disponible: boolean;
  paiementCarte: boolean;
  reglages: ReglagesBoutique;
}

/**
 * Boutique d'après son adresse. `disponible` est faux si elle est coupée ou si le compte n'est pas actif
 * (abonnement terminé, suspendu) : la page affiche alors « Boutique momentanément indisponible ».
 */
export async function trouverBoutique(sousDomaine: string): Promise<Vitrine | null> {
  const s = verifierSousDomaine(sousDomaine);
  if (!s) return null;
  const c = await bd('auth').selectFrom('commercants').select(['id', 'nom', 'telephone', 'forme_juridique', 'etat', 'paiement_carte_actif', 'modules']).where('sous_domaine', '=', s).executeTakeFirst();
  if (!c) return null;
  // Abonnement terminé (après le délai) ou module non compris : « Boutique momentanément indisponible ».
  const ab = await situation(bd('auth'), c.id);
  const etat = etatEffectif(c.etat, ab.etat);
  const modules = modulesEffectifs(c.modules, ab.autorises);
  const reglages = await avecCommercant(c.id, lireReglages);
  // Le ticket doit toujours montrer un numéro à appeler : à défaut du téléphone du magasin, celui du propriétaire.
  const telephone = c.telephone ?? (await bd('auth').selectFrom('utilisateurs').select('telephone').where('commercant_id', '=', c.id).where('role', '=', 'proprietaire')
    .where('supprime_le', 'is', null).orderBy('cree_le').executeTakeFirst())?.telephone ?? null;
  return {
    commercantId: c.id, sousDomaine: s, nom: c.nom, telephone, formeJuridique: c.forme_juridique,
    disponible: reglages.enLigne && etat === 'actif' && !!modules.boutique, paiementCarte: c.paiement_carte_actif, reglages,
  };
}

/** Propriétaire du magasin : auteur des écritures faites au nom de la boutique (ticket, expiration). */
export async function contexteBoutique(trx: Trx, commercantId: string): Promise<Contexte> {
  const p = await trx.selectFrom('utilisateurs').select('id').where('role', '=', 'proprietaire').where('supprime_le', 'is', null).orderBy('cree_le').executeTakeFirstOrThrow();
  return { commercantId, utilisateurId: p.id };
}

export interface ArticlePublic {
  varianteId: string;
  libelle: string;
  prix: number;
  prixBarre: number | null;
  disponible: number;
}
export interface ProduitPublic {
  id: string;
  nom_fr: string;
  nom_ar: string;
  categorie: { id: string; nom_fr: string; nom_ar: string } | null;
  photoId: string | null;
  nouveau: boolean;
  variantes: ArticlePublic[];
  disponible: number;
}

/** Produits publiés, avec le stock libre (quantité moins réservations) de chaque variante. Les tickets périmés sont d'abord expirés. */
export async function catalogue(trx: Trx, o: { commercantId: string; reglages: ReglagesBoutique; produitId?: string }): Promise<ProduitPublic[]> {
  await expirerTickets(trx, await contexteBoutique(trx, o.commercantId));
  let q = trx
    .selectFrom('produits as p')
    .innerJoin('variantes as v', (j) => j.onRef('v.produit_id', '=', 'p.id').on('v.archive_le', 'is', null))
    .innerJoin('stocks as s', 's.variante_id', 'v.id')
    .leftJoin('categories as c', 'c.id', 'p.categorie_id')
    .select(['p.id', 'p.nom_fr', 'p.nom_ar', 'p.nouveau', 'c.id as cat_id', 'c.nom_fr as cat_fr', 'c.nom_ar as cat_ar', 'v.id as variante_id', 'v.libelle', 'v.prix_vente', 'v.prix_barre', 's.quantite', 's.reservee', 'v.ordre', 'p.cree_le'])
    .select((eb) => eb.selectFrom('photos_produit as ph').select('ph.id').whereRef('ph.produit_id', '=', 'p.id').limit(1).as('photo_id'))
    .where('p.visible_boutique', '=', true)
    .where('p.archive_le', 'is', null);
  if (o.produitId) q = q.where('p.id', '=', o.produitId);
  // Les plus récents d'abord ; à égalité (produits créés ensemble, import), par nom : l'ordre ne change jamais d'une visite à l'autre.
  const lignes = await q.orderBy('p.cree_le', 'desc').orderBy('p.nom_fr').orderBy('p.id').orderBy('v.ordre').limit(2000).execute();
  const parProduit = new Map<string, ProduitPublic>();
  for (const l of lignes) {
    let p = parProduit.get(l.id);
    if (!p) {
      p = { id: l.id, nom_fr: l.nom_fr, nom_ar: l.nom_ar, categorie: l.cat_id ? { id: l.cat_id, nom_fr: l.cat_fr!, nom_ar: l.cat_ar! } : null, photoId: l.photo_id, nouveau: l.nouveau, variantes: [], disponible: 0 };
      parProduit.set(l.id, p);
    }
    const disponible = Math.max(0, l.quantite - l.reservee);
    p.variantes.push({ varianteId: l.variante_id, libelle: l.libelle, prix: Number(l.prix_vente), prixBarre: l.prix_barre === null ? null : Number(l.prix_barre), disponible });
    p.disponible += disponible;
  }
  const produits = [...parProduit.values()];
  return o.reglages.ruptures === 'masque' ? produits.filter((p) => p.disponible > 0) : produits;
}

/** Photo publique : seulement celle d'un produit publié, ou le logo et la bannière de la boutique. */
export async function photoPublique(trx: Trx, photoId: string): Promise<boolean> {
  const r = await sql<{ ok: boolean }>`
    SELECT EXISTS (SELECT 1 FROM photos_produit ph JOIN produits p ON p.id = ph.produit_id WHERE ph.id = ${photoId} AND p.visible_boutique AND p.archive_le IS NULL)
        OR EXISTS (SELECT 1 FROM boutiques b WHERE b.logo_id = ${photoId} OR b.banniere_id = ${photoId}) AS ok`.execute(trx);
  return !!r.rows[0]?.ok;
}

export interface SaisieTicket {
  nom: string;
  telephone: string;
  wilaya: number;
  commune: string;
  livraison: ModeLivraison;
  lignes: { varianteId: string; quantite: number }[];
  /** Champ invisible : rempli seulement par un robot. */
  piege: string;
  /** Identifiant de l'appareil (cookie) et adresse tronquée : limite du nombre de tickets. */
  appareil: string;
  /** Adresse IP tronquée : limite plus large, pour ne pas bloquer un cybercafé ou un réseau mobile partagé. */
  ip?: string | null;
  libelleLivraison: string;
  cle: string;
}

export type RefusTicket = RefusCommande | 'boutique_indisponible' | 'trop_de_tickets' | 'refuse' | 'produit_indisponible';

export const MAX_TICKETS_TELEPHONE = 3; // par 24 heures et par boutique
export const MAX_TICKETS_APPAREIL = 5; // par heure et par boutique
export const MAX_TICKETS_IP = 20; // par heure et par boutique

/**
 * Ticket d'un acheteur sans compte : crée le devis « Boutique en ligne » et la commande « Nouvelle »,
 * réserve le stock pour la durée réglée, et prévient le vendeur. Renvoie le jeton du lien privé (montré une fois).
 */
export async function creerTicket(v: Vitrine, s: SaisieTicket): Promise<{ ok: true; jeton: string; numero: number; commandeId: string } | { ok: false; raison: RefusTicket }> {
  if (!v.disponible) return { ok: false, raison: 'boutique_indisponible' };
  if (s.piege.trim()) return { ok: false, raison: 'refuse' };
  const telephone = normaliserTelephone(s.telephone);
  if (!s.telephone.trim()) return { ok: false, raison: 'telephone_requis' };
  if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  if (!s.lignes.length || s.lignes.length > 50) return { ok: false, raison: 'panier_vide' };
  if (!(await autoriser(`ticket-appareil:${v.commercantId}`, s.appareil, MAX_TICKETS_APPAREIL, 3600))) return { ok: false, raison: 'trop_de_tickets' };
  if (s.ip && !(await autoriser(`ticket-ip:${v.commercantId}`, s.ip, MAX_TICKETS_IP, 3600))) return { ok: false, raison: 'trop_de_tickets' };
  if (!(await autoriser(`ticket-telephone:${v.commercantId}`, telephone, MAX_TICKETS_TELEPHONE, 24 * 3600))) return { ok: false, raison: 'trop_de_tickets' };
  const { jeton, hash } = nouveauJeton();
  return avecCommercant(v.commercantId, async (trx) => {
    const ctx = await contexteBoutique(trx, v.commercantId);
    await expirerTickets(trx, ctx);
    // Seuls les articles publiés et encore disponibles peuvent être commandés.
    const ids = [...new Set(s.lignes.map((l) => l.varianteId))];
    const publies = await trx
      .selectFrom('variantes as v').innerJoin('produits as p', 'p.id', 'v.produit_id')
      .select('v.id').where('v.id', 'in', ids).where('p.visible_boutique', '=', true).where('p.archive_le', 'is', null).where('v.archive_le', 'is', null)
      .execute();
    if (publies.length !== ids.length) return { ok: false as const, raison: 'produit_indisponible' as const };
    const fin = new Date(Date.now() + v.reglages.reservationHeures * 3600_000);
    const r = await creerCommande(trx, ctx, {
      client: { nom: s.nom, telephone }, wilaya: s.wilaya, commune: s.commune, livraison: s.livraison, lignes: s.lignes,
      cle: s.cle, libelleLivraison: s.libelleLivraison, origine: 'boutique', ticket: { hash, reservationJusqua: fin },
    });
    if (!r.ok) return r;
    if (r.doublon) return { ok: false as const, raison: 'refuse' as const };
    const c = await trx.selectFrom('commandes').select('numero').where('id', '=', r.id).executeTakeFirstOrThrow();
    await trx.insertInto('notifications').values({ commercant_id: v.commercantId, type: 'commande_boutique', commande_id: r.id }).execute();
    return { ok: true as const, jeton, numero: c.numero, commandeId: r.id };
  });
}

export interface TicketPublic {
  numero: number;
  statut: string;
  nom: string;
  wilaya: { code: number; nom_fr: string; nom_ar: string };
  commune: string;
  livraison: ModeLivraison;
  lignes: { designation: string; quantite: number; total: number }[];
  total: number;
  creeLe: Date;
  reservationJusqua: Date | null;
}

/** Ticket retrouvé par son lien privé. Le téléphone de l'acheteur n'est pas renvoyé. */
export async function lireTicket(commercantId: string, jeton: string): Promise<TicketPublic | null> {
  if (!/^[\w-]{43}$/.test(jeton)) return null;
  return avecCommercant(commercantId, async (trx) => {
    await expirerTickets(trx, await contexteBoutique(trx, commercantId));
    const c = await trx
      .selectFrom('commandes as c').innerJoin('clients as cl', 'cl.id', 'c.client_id').innerJoin('wilayas as w', 'w.code', 'c.wilaya_code').innerJoin('documents as d', 'd.id', 'c.devis_id')
      .select(['c.numero', 'c.statut', 'cl.nom', 'w.code', 'w.nom_fr', 'w.nom_ar', 'c.commune', 'c.livraison', 'c.devis_id', 'c.facture_id', 'd.total', 'c.cree_le', 'c.reservation_jusqua'])
      .where('c.ticket_hash', '=', hacherJeton(jeton))
      .executeTakeFirst();
    if (!c) return null;
    const lignes = await trx.selectFrom('lignes_document').select(['designation', 'quantite', 'total_ttc']).where('document_id', '=', c.facture_id ?? c.devis_id).orderBy('ordre').execute();
    return {
      numero: c.numero, statut: c.statut, nom: c.nom, wilaya: { code: c.code, nom_fr: c.nom_fr, nom_ar: c.nom_ar }, commune: c.commune, livraison: c.livraison,
      lignes: lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, total: Number(l.total_ttc) })), total: lignes.reduce((x, l) => x + Number(l.total_ttc), 0),
      creeLe: c.cree_le, reservationJusqua: c.reservation_jusqua,
    };
  });
}

/** Frais affichés à l'acheteur avant de valider (même grille que pour une commande saisie à la main). */
export const fraisPublics = (commercantId: string, wilaya: number, livraison: ModeLivraison) => avecCommercant(commercantId, (trx) => fraisPour(trx, wilaya, livraison));

// ───────────── Notifications du vendeur ─────────────

// Une notification est « nouvelle » pour une personne tant que : elle est arrivée après son dernier « Tout marquer
// comme vu », elle ne l'a pas ouverte, et la commande attend encore une confirmation (si quelqu'un l'a déjà traitée,
// il n'y a plus rien à faire).
const A_TRAITER = ['nouvelle', 'a_confirmer'] as const;

export async function compterNonVues(trx: Trx, utilisateurId: string): Promise<number> {
  const r = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM notifications n
    JOIN commandes c ON c.id = n.commande_id
    WHERE n.cree_le > coalesce((SELECT vu_le FROM notifications_vues WHERE utilisateur_id = ${utilisateurId}), '-infinity')
      AND c.statut IN ('nouvelle', 'a_confirmer')
      AND NOT EXISTS (SELECT 1 FROM notifications_lues l WHERE l.notification_id = n.id AND l.utilisateur_id = ${utilisateurId})`.execute(trx);
  return r.rows[0]!.n;
}

export async function listerNotifications(trx: Trx, utilisateurId: string) {
  const vu = (await trx.selectFrom('notifications_vues').select('vu_le').where('utilisateur_id', '=', utilisateurId).executeTakeFirst())?.vu_le ?? null;
  const lues = new Set((await trx.selectFrom('notifications_lues').select('notification_id').where('utilisateur_id', '=', utilisateurId).execute()).map((l) => l.notification_id));
  const lignes = await trx
    .selectFrom('notifications as n').innerJoin('commandes as c', 'c.id', 'n.commande_id').innerJoin('documents as d', 'd.id', 'c.devis_id').innerJoin('clients as cl', 'cl.id', 'c.client_id')
    .select(['n.id', 'n.type', 'n.cree_le', 'c.id as commande_id', 'c.numero', 'c.statut', 'd.total', 'cl.nom'])
    .orderBy('n.cree_le', 'desc').limit(50).execute();
  return lignes.map((l) => ({ ...l, nouvelle: (!vu || l.cree_le > vu) && !lues.has(l.id) && (A_TRAITER as readonly string[]).includes(l.statut) }));
}

/** Ouvrir une notification la marque comme lue pour cette personne ; renvoie la commande à afficher. */
export async function ouvrirNotification(trx: Trx, ctx: Contexte, notificationId: string): Promise<string | null> {
  const n = await trx.selectFrom('notifications').select('commande_id').where('id', '=', notificationId).executeTakeFirst();
  if (!n) return null;
  await trx.insertInto('notifications_lues').values({ commercant_id: ctx.commercantId, utilisateur_id: ctx.utilisateurId, notification_id: notificationId })
    .onConflict((oc) => oc.columns(['utilisateur_id', 'notification_id']).doNothing()).execute();
  return n.commande_id;
}

export async function marquerVues(trx: Trx, ctx: Contexte): Promise<void> {
  await trx.insertInto('notifications_vues').values({ commercant_id: ctx.commercantId, utilisateur_id: ctx.utilisateurId, vu_le: new Date() })
    .onConflict((oc) => oc.column('utilisateur_id').doUpdateSet({ vu_le: new Date() })).execute();
}

/** Garde l'abonnement du téléphone de la personne (adresse et clés chiffrées, empreinte pour l'unicité). */
export async function enregistrerAbonnement(trx: Trx, ctx: Contexte, abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
  const hmac = empreinte(abonnement.endpoint, 'push.endpoint');
  const id = crypto.randomUUID();
  await trx.deleteFrom('abonnements_push').where('point_hmac', '=', hmac).execute();
  await trx.insertInto('abonnements_push').values({ id, commercant_id: ctx.commercantId, utilisateur_id: ctx.utilisateurId, point_hmac: hmac, abonnement_chiffre: chiffrer(JSON.stringify(abonnement), `abonnements_push:${id}`) }).execute();
}

export async function retirerAbonnement(trx: Trx, endpoint: string): Promise<void> {
  await trx.deleteFrom('abonnements_push').where('point_hmac', '=', empreinte(endpoint, 'push.endpoint')).execute();
}

/** Abonnements des personnes qui vendent (propriétaire et vendeurs), déchiffrés pour l'envoi. */
export async function abonnementsVendeurs(trx: Trx): Promise<{ id: string; abonnement: { endpoint: string; keys: { p256dh: string; auth: string } } }[]> {
  const r = await trx.selectFrom('abonnements_push as a').innerJoin('utilisateurs as u', 'u.id', 'a.utilisateur_id')
    .select(['a.id', 'a.abonnement_chiffre']).where('u.role', 'in', ['proprietaire', 'vendeur']).where('u.desactive', '=', false).where('u.supprime_le', 'is', null).execute();
  return r.map((l) => ({ id: l.id, abonnement: JSON.parse(dechiffrer(l.abonnement_chiffre, `abonnements_push:${l.id}`)) }));
}
