// Documents commerciaux : ticket, facture, avoir, devis, proforma, bon de commande, bon de livraison, reçu.
// Une seule fonction, `creerDocument`, écrit le document, ses lignes, son numéro, les mouvements de stock
// et les liens, dans la transaction du commerçant : tout réussit ou rien ne change.
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { chiffrer, dechiffrer, dechiffrerOuNul, empreinte } from './chiffrement.ts';
import { calculerLigne, calculerTimbre, horsTaxe, lireBaremeTimbre, lireReglagesDocuments, repartirRemise, type ReglagesDocuments } from './fiscal.ts';
import { normaliserTelephone } from './formats.ts';
import { reglageBrut } from './reglages-plateforme.ts';
import { ajouterMouvement, type Contexte } from './stock.ts';
import { MODES_ENCAISSEMENT, type EtatDocument, type ModeEncaissement, type ModePaiement, type TypeDocument } from './types-bd.ts';

export const PREFIXES: Record<TypeDocument, string> = {
  devis: 'DV', proforma: 'PF', bon_commande: 'BC', bon_livraison: 'BL', facture: 'FA', avoir: 'AV', recu: 'RC', ticket: 'TK',
};
/** « FA-2026-00012 ». */
export const numeroTexte = (d: { type: TypeDocument; annee: number; numero: number }) => `${PREFIXES[d.type]}-${d.annee}-${String(d.numero).padStart(5, '0')}`;

/** Ce qu'un document peut devenir, d'un toucher. */
export const TRANSFORMATIONS: Partial<Record<TypeDocument, readonly TypeDocument[]>> = {
  devis: ['facture', 'bon_livraison', 'proforma', 'bon_commande'],
  proforma: ['facture', 'bon_livraison', 'bon_commande'],
  bon_commande: ['facture', 'bon_livraison'],
  bon_livraison: ['facture'],
};

export type RefusDocument =
  | 'panier_vide'
  | 'quantite_invalide'
  | 'montant_invalide'
  | 'designation_requise'
  | 'introuvable'
  | 'client_requis'
  | 'telephone_invalide'
  | 'stock_insuffisant'
  | 'stock_reserve'
  | 'deja_transforme'
  | 'transformation_impossible'
  | 'devis_non_modifiable'
  | 'deja_paye'
  | 'deja_annule'
  | 'caisse_fermee'
  | 'remise_invalide'
  | 'paiement_invalide'
  | 'client_credit'
  | 'retour_invalide'
  | 'rien_a_payer';
type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: RefusDocument };

export interface Mentions {
  nom: string;
  formeJuridique?: string;
  adresse?: string;
  telephone?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  ai?: string;
}
export interface LigneSaisie {
  varianteId?: string | null;
  /** Obligatoire pour une ligne libre (sans article du stock). */
  designation?: string;
  quantite: number;
  /** Prix TTC d'une unité, en centimes. Pour un article du stock, pris dans la fiche s'il est absent. */
  prixUnitaire?: number;
  /** Taux figé d'un document d'origine (transformation). */
  tauxTva?: number;
  coutUnitaire?: number;
  /** Remise sur la ligne, en centimes TTC (retirée du prix × quantité). */
  remise?: number;
}

/** Une somme reçue à l'émission, hors droit de timbre (calculé ensuite sur la part en espèces). */
export interface Encaissement {
  mode: ModeEncaissement;
  montant: number;
  reference?: string;
}

const MAX_LIGNES = 200;
const MAX_QUANTITE = 100_000;
const MAX_MONTANT = 100_000_000_00;
const entier = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
export const anneeAlger = (d = new Date()) => Number(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Algiers', year: 'numeric' }).format(d));

/** Mentions légales du commerçant, telles qu'elles seront figées sur le document. */
export async function mentionsVendeur(trx: Trx, commercantId: string): Promise<{ mentions: Mentions; reglages: ReglagesDocuments }> {
  const c = await trx
    .selectFrom('commercants')
    .select(['nom', 'forme_juridique', 'telephone', 'adresse_chiffre', 'rc_chiffre', 'nif_chiffre', 'nis_chiffre', 'ai_chiffre', 'reglages_documents'])
    .where('id', '=', commercantId)
    .executeTakeFirstOrThrow();
  const lire = (v: string | null, col: string) => dechiffrerOuNul(v, `commercants.${col}:${commercantId}`) ?? undefined;
  return {
    mentions: {
      nom: c.nom, formeJuridique: c.forme_juridique ?? undefined, telephone: c.telephone ?? undefined,
      adresse: lire(c.adresse_chiffre, 'adresse'), rc: lire(c.rc_chiffre, 'rc'), nif: lire(c.nif_chiffre, 'nif'), nis: lire(c.nis_chiffre, 'nis'), ai: lire(c.ai_chiffre, 'ai'),
    },
    reglages: lireReglagesDocuments(c.reglages_documents),
  };
}

const propre = (s: string | undefined, max: number) => (s ?? '').trim().slice(0, max) || undefined;

/** Nettoie les mentions de l'acheteur. Null si le nom manque ou si le téléphone est invalide. */
export function verifierAcheteur(a: Mentions | null | undefined): Resultat<{ acheteur: Mentions | null }> {
  if (!a || !Object.values(a).some((v) => v?.trim())) return { ok: true, acheteur: null };
  const nom = propre(a.nom, 120);
  if (!nom) return { ok: false, raison: 'client_requis' };
  let telephone: string | undefined;
  if (a.telephone?.trim()) {
    telephone = normaliserTelephone(a.telephone) ?? undefined;
    if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  }
  return { ok: true, acheteur: { nom, telephone, adresse: propre(a.adresse, 300), rc: propre(a.rc, 40), nif: propre(a.nif, 40), nis: propre(a.nis, 40), ai: propre(a.ai, 40) } };
}

/** Fiche client retrouvée par son téléphone, sinon créée. Le téléphone et les numéros légaux sont chiffrés. */
async function enregistrerClient(trx: Trx, ctx: Contexte, a: Mentions): Promise<string> {
  const hmac = a.telephone ? empreinte(a.telephone, 'clients.telephone') : null;
  const { nom, telephone, ...details } = a;
  const existant = hmac ? await trx.selectFrom('clients').select('id').where('telephone_hmac', '=', hmac).executeTakeFirst() : undefined;
  const id = existant?.id ?? randomUUID();
  const valeurs = {
    nom,
    telephone_chiffre: telephone ? chiffrer(telephone, `clients.telephone:${id}`) : null,
    telephone_hmac: hmac,
    details_chiffre: Object.values(details).some(Boolean) ? chiffrer(JSON.stringify(details), `clients.details:${id}`) : null,
  };
  if (existant) await trx.updateTable('clients').set(valeurs).where('id', '=', id).execute();
  else await trx.insertInto('clients').values({ id, commercant_id: ctx.commercantId, ...valeurs }).execute();
  return id;
}

/** Prochain numéro du type pour l'année. Verrouille le compteur jusqu'à la fin de la transaction. */
export async function prochainNumero(trx: Trx, commercantId: string, type: TypeDocument | 'commande' | 'arrivage', annee: number): Promise<number> {
  const r = await sql<{ dernier: number }>`
    INSERT INTO compteurs_documents (commercant_id, type, annee, dernier) VALUES (${commercantId}, ${type}, ${annee}, 1)
    ON CONFLICT (commercant_id, type, annee) DO UPDATE SET dernier = compteurs_documents.dernier + 1
    RETURNING dernier`.execute(trx);
  return r.rows[0]!.dernier;
}

/** La caisse ouverte du commerçant ; ouverte d'elle-même (fond à zéro) à la première vente. */
export async function caisseOuverte(trx: Trx, ctx: Contexte, creer = true): Promise<string | null> {
  const ouverte = await trx.selectFrom('sessions_caisse').select('id').where('fermee_le', 'is', null).executeTakeFirst();
  if (ouverte || !creer) return ouverte?.id ?? null;
  const { id } = await trx.insertInto('sessions_caisse').values({ commercant_id: ctx.commercantId, ouverte_par: ctx.utilisateurId }).returning('id').executeTakeFirstOrThrow();
  return id;
}

/** Quantités encore réservées par un document, article par article (réservations moins libérations). */
export async function reservationsNettes(trx: Trx, documentId: string): Promise<Map<string, number>> {
  const r = await trx
    .selectFrom('mouvements_stock')
    .select(['variante_id', (eb) => eb.fn.sum<string>('quantite').as('net')])
    .where('document_id', '=', documentId)
    .where('type', 'in', ['reservation', 'liberation'])
    .groupBy('variante_id')
    .execute();
  return new Map(r.filter((l) => Number(l.net) > 0).map((l) => [l.variante_id, Number(l.net)]));
}

/** Libère tout ce que le document réserve encore. */
export async function libererReservations(trx: Trx, ctx: Contexte, documentId: string): Promise<void> {
  for (const [varianteId, net] of await reservationsNettes(trx, documentId)) {
    await ajouterMouvement(trx, ctx, { varianteId, type: 'liberation', quantite: -net, documentId });
  }
}

/** Quantités par article, à partir de lignes (le même article peut être sur deux lignes). */
const parArticle = (lignes: { varianteId: string | null; quantite: number }[]) => {
  const m = new Map<string, number>();
  for (const l of lignes) if (l.varianteId) m.set(l.varianteId, (m.get(l.varianteId) ?? 0) + l.quantite);
  return m;
};

/**
 * Vérifie, avant toute écriture, que le stock libre suffit pour réserver ces quantités.
 * `dejaReserve` : ce que le même document réserve déjà et rendra avant de réserver à nouveau.
 * Ainsi un refus n'écrit rien (pas de numéro consommé, pas de document à moitié écrit).
 */
async function stockLibreSuffit(trx: Trx, besoins: Map<string, number>, dejaReserve = new Map<string, number>()): Promise<boolean> {
  if (!besoins.size) return true;
  const s = await trx.selectFrom('stocks').select(['variante_id', 'quantite', 'reservee']).where('variante_id', 'in', [...besoins.keys()]).execute();
  const parId = new Map(s.map((l) => [l.variante_id, l.quantite - l.reservee]));
  for (const [id, q] of besoins) if ((parId.get(id) ?? 0) + (dejaReserve.get(id) ?? 0) < q) return false;
  return true;
}

interface LignePrete {
  varianteId: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  tauxTva: number;
  coutUnitaire: number;
  remise: number;
  totalHt: number;
  totalTtc: number;
}

/** Complète les lignes avec la fiche des articles (nom, prix, taux, prix d'achat) et calcule les totaux. */
async function preparerLignes(trx: Trx, lignes: LigneSaisie[], reglages: ReglagesDocuments, o: { prixLibres: boolean }): Promise<Resultat<{ lignes: LignePrete[] }>> {
  if (!lignes.length || lignes.length > MAX_LIGNES) return { ok: false, raison: 'panier_vide' };
  const ids = [...new Set(lignes.flatMap((l) => (l.varianteId ? [l.varianteId] : [])))];
  const fiches = ids.length
    ? await trx
        .selectFrom('variantes as v')
        .innerJoin('produits as p', 'p.id', 'v.produit_id')
        .select(['v.id', 'v.libelle', 'v.prix_vente', 'v.prix_achat', 'v.archive_le', 'p.nom_fr', 'p.nom_ar', 'p.taux_tva'])
        .where('v.id', 'in', ids)
        .execute()
    : [];
  const parId = new Map(fiches.map((f) => [f.id, f]));
  const pretes: LignePrete[] = [];
  for (const l of lignes) {
    if (!entier(l.quantite, 1, MAX_QUANTITE)) return { ok: false, raison: 'quantite_invalide' };
    const fiche = l.varianteId ? parId.get(l.varianteId) : undefined;
    if (l.varianteId && !fiche) return { ok: false, raison: 'introuvable' };
    const prixUnitaire = fiche && (!o.prixLibres || l.prixUnitaire === undefined) ? Number(fiche.prix_vente) : l.prixUnitaire;
    if (!entier(prixUnitaire, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
    const designation = (l.designation?.trim() || (fiche ? `${fiche.nom_fr || fiche.nom_ar}${fiche.libelle ? ` · ${fiche.libelle}` : ''}` : '')).slice(0, 200);
    if (!designation) return { ok: false, raison: 'designation_requise' };
    const tauxTva = l.tauxTva ?? (reglages.assujettiTva ? (fiche?.taux_tva ?? reglages.tauxDefaut) : 0);
    const remise = l.remise ?? 0;
    if (!entier(remise, 0, prixUnitaire! * l.quantite)) return { ok: false, raison: 'remise_invalide' };
    const { totalHt, totalTtc } = calculerLigne(prixUnitaire!, l.quantite, tauxTva, remise);
    pretes.push({ varianteId: l.varianteId ?? null, designation, quantite: l.quantite, prixUnitaire: prixUnitaire!, tauxTva, coutUnitaire: l.coutUnitaire ?? (fiche ? Number(fiche.prix_achat) : 0), remise, totalHt, totalTtc });
  }
  return { ok: true, lignes: pretes };
}

/** Ajoute aux lignes une remise sur le total, répartie au prorata (chaque ligne garde sa TVA juste). */
function appliquerRemiseGlobale(lignes: LignePrete[], remise: number): LignePrete[] {
  const parts = repartirRemise(lignes.map((l) => l.totalTtc), remise);
  return lignes.map((l, i) => {
    const r = l.remise + parts[i]!;
    return { ...l, remise: r, ...calculerLigne(l.prixUnitaire, l.quantite, l.tauxTva, r) };
  });
}

const valeursLigne = (commercantId: string, documentId: string) => (l: LignePrete & { ligneOrigineId?: string | null }, ordre: number) => ({
  commercant_id: commercantId, document_id: documentId, variante_id: l.varianteId, designation: l.designation, quantite: l.quantite,
  prix_unitaire: l.prixUnitaire, taux_tva: l.tauxTva, total_ht: l.totalHt, total_ttc: l.totalTtc, cout_unitaire: l.coutUnitaire,
  remise: l.remise, ligne_origine_id: l.ligneOrigineId ?? null, ordre,
});

/** Moyen résumé sur le document : le seul moyen utilisé, sinon « mixte ». */
const modeResume = (modes: string[]): ModePaiement | null => {
  const u = [...new Set(modes)];
  return u.length === 0 ? null : u.length === 1 ? (u[0] as ModePaiement) : 'mixte';
};

/** Vérifie une liste d'encaissements : moyens connus, montants positifs, références courtes. */
function verifierEncaissements(e: Encaissement[] | undefined): Encaissement[] | null {
  if (!e) return [];
  if (e.length > 5) return null;
  const propres: Encaissement[] = [];
  for (const x of e) {
    if (!MODES_ENCAISSEMENT.includes(x.mode) || !entier(x.montant, 1, MAX_MONTANT)) return null;
    propres.push({ mode: x.mode, montant: x.montant, reference: (x.reference ?? '').trim().slice(0, 60) });
  }
  return propres;
}
const totaux = (lignes: LignePrete[]) => {
  const ttc = lignes.reduce((s, l) => s + l.totalTtc, 0);
  const ht = lignes.reduce((s, l) => s + l.totalHt, 0);
  return { ttc, ht, tva: ttc - ht };
};

export interface NouveauDocument {
  type: TypeDocument;
  origine: 'caisse' | 'manuel' | 'boutique';
  lignes: LigneSaisie[];
  acheteur?: Mentions | null;
  /** Payé tout de suite et entièrement en espèces (vente directe). Raccourci de `encaisse`. */
  payeEnEspeces?: boolean;
  /**
   * Sommes reçues à l'émission (facture ou ticket), hors timbre. Moins que le total : le reste est dû
   * (vente à crédit), ce qui exige un client nommé.
   */
  encaisse?: Encaissement[];
  /** Remise sur le total, en centimes TTC, répartie entre les lignes. */
  remiseGlobale?: number;
  modeVente?: 'directe' | 'envoi';
  /** « vente » : sort le stock (ce qui manque est noté à vérifier). « reserver » : le bloque pour un envoi. */
  stock?: 'vente' | 'reserver' | null;
  /** Les prix saisis remplacent ceux des fiches (devis, facture écrite à la main, transformation). */
  prixLibres?: boolean;
  note?: string;
  cle?: string;
  /** Document d'origine : le lien est gardé dans les deux sens. */
  source?: { id: string; nature: 'transforme_en' | 'corrige_par' | 'regle_par' };
  /** Avoir : les totaux sont négatifs. */
  negatif?: boolean;
  /** Reçu de paiement : montant encaissé, sans ligne d'article. */
  montantRecu?: number;
  /** Réservations d'un document d'origine, rendues dans la même transaction avant de réserver. */
  reservationsRendues?: Map<string, number>;
}

export async function creerDocument(trx: Trx, ctx: Contexte, n: NouveauDocument): Promise<Resultat<{ id: string; doublon?: boolean; manques: number }>> {
  if (n.cle) {
    const deja = await trx.selectFrom('documents').select('id').where('cle', '=', n.cle).executeTakeFirst();
    if (deja) return { ok: true, id: deja.id, doublon: true, manques: 0 };
  }
  const { mentions, reglages } = await mentionsVendeur(trx, ctx.commercantId);
  const a = verifierAcheteur(n.acheteur);
  if (!a.ok) return a;
  if (n.type === 'facture' && !a.acheteur) return { ok: false, raison: 'client_requis' };

  let lignes: LignePrete[] = [];
  if (n.type === 'recu') {
    if (!entier(n.montantRecu, 1, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  } else {
    const p = await preparerLignes(trx, n.lignes, reglages, { prixLibres: !!n.prixLibres });
    if (!p.ok) return p;
    lignes = p.lignes;
    if (n.remiseGlobale) {
      if (!entier(n.remiseGlobale, 0, totaux(lignes).ttc)) return { ok: false, raison: 'remise_invalide' };
      lignes = appliquerRemiseGlobale(lignes, n.remiseGlobale);
    }
  }
  const t = n.type === 'recu' ? { ttc: n.montantRecu!, ht: n.montantRecu!, tva: 0 } : totaux(lignes);

  // Encaissements : seulement pour une vente (facture, ticket). Le reçu de paiement porte son propre moyen.
  const vente = n.type === 'facture' || n.type === 'ticket';
  const encaisse = n.payeEnEspeces ? [{ mode: 'especes' as const, montant: t.ttc, reference: '' }] : verifierEncaissements(n.encaisse);
  if (!encaisse) return { ok: false, raison: 'paiement_invalide' };
  const recuTotal = encaisse.reduce((s, e) => s + e.montant, 0);
  if (n.type !== 'recu' && (!vente ? encaisse.length > 0 : recuTotal > t.ttc)) return { ok: false, raison: 'paiement_invalide' };
  // Vente à crédit (payée en partie ou pas du tout, hors envoi) : il faut savoir qui doit.
  const credit = vente && n.modeVente !== 'envoi' && recuTotal < t.ttc;
  if (credit && !a.acheteur) return { ok: false, raison: 'client_credit' };
  // Droit de timbre : seulement sur la part payée en espèces au moment de la vente.
  const partEspeces = encaisse.filter((e) => e.mode === 'especes').reduce((s, e) => s + e.montant, 0);
  const avecTimbre = partEspeces > 0 && ((n.type === 'facture' && reglages.timbreFactures) || (n.type === 'ticket' && reglages.timbreTickets));
  const timbre = avecTimbre ? calculerTimbre(partEspeces, lireBaremeTimbre(await reglageBrut('timbre'))) : 0;
  const signe = n.negatif ? -1 : 1;
  const toutPaye = vente && recuTotal === t.ttc && t.ttc > 0;

  if (n.stock === 'reserver' && !(await stockLibreSuffit(trx, parArticle(lignes), n.reservationsRendues))) return { ok: false, raison: 'stock_insuffisant' };

  const id = randomUUID();
  const annee = anneeAlger();
  const numero = await prochainNumero(trx, ctx.commercantId, n.type, annee);
  // Après le verrou du numéro : deux ventes simultanées n'ouvrent jamais deux caisses.
  const session = partEspeces > 0 || (n.type === 'recu' && n.payeEnEspeces) ? await caisseOuverte(trx, ctx) : null;
  // Un ticket ne garde le client que s'il en a un (vente à crédit) : le moins de données possible.
  const clientId = a.acheteur ? await enregistrerClient(trx, ctx, a.acheteur) : null;
  const maintenant = new Date();
  const validite = n.type === 'devis' || n.type === 'proforma' ? new Date(maintenant.getTime() + reglages.validiteDevisJours * 86_400_000).toISOString().slice(0, 10) : null;
  await trx
    .insertInto('documents')
    .values({
      id,
      commercant_id: ctx.commercantId,
      type: n.type,
      annee,
      numero,
      etat: n.type === 'devis' ? 'en_attente' : 'emis',
      origine: n.origine,
      mode_vente: n.modeVente ?? null,
      client_id: clientId,
      vendeur_chiffre: chiffrer(JSON.stringify(mentions), `documents.vendeur:${id}`),
      acheteur_chiffre: a.acheteur ? chiffrer(JSON.stringify(a.acheteur), `documents.acheteur:${id}`) : null,
      total_ht: signe * t.ht,
      total_tva: signe * t.tva,
      timbre,
      total: signe * (t.ttc + timbre),
      mode_paiement: n.type === 'recu' ? (n.payeEnEspeces ? 'especes' : modeResume(encaisse.map((e) => e.mode))) : modeResume(encaisse.map((e) => e.mode)) ?? (n.modeVente === 'envoi' ? 'a_la_livraison' : null),
      paye_le: toutPaye || n.type === 'recu' ? maintenant : null,
      valide_jusqua: validite,
      stock_sorti: n.stock === 'vente',
      note: (n.note ?? '').trim().slice(0, 500),
      // Tout ce qui est encaissé en espèces entre dans la caisse ouverte.
      session_caisse_id: session,
      emis_par: ctx.utilisateurId,
      cle: n.cle ?? null,
    })
    .execute();
  if (lignes.length) await trx.insertInto('lignes_document').values(lignes.map(valeursLigne(ctx.commercantId, id))).execute();
  // Chaque somme reçue est notée ; le timbre s'ajoute à la part en espèces.
  if (vente && encaisse.length) {
    let timbreAjoute = false;
    await trx.insertInto('paiements').values(encaisse.map((e) => {
      const montant = e.montant + (e.mode === 'especes' && !timbreAjoute ? timbre : 0);
      if (e.mode === 'especes') timbreAjoute = true;
      return { commercant_id: ctx.commercantId, document_id: id, montant, mode: e.mode, reference: e.reference ?? '', session_caisse_id: e.mode === 'especes' ? session : null, cree_par: ctx.utilisateurId };
    })).execute();
  }

  // Stock : les quantités sont regroupées par article (le même article peut être sur deux lignes).
  let manques = 0;
  if (n.stock) {
    for (const [varianteId, quantite] of parArticle(lignes)) {
      if (n.stock === 'reserver') {
        const r = await ajouterMouvement(trx, ctx, { varianteId, type: 'reservation', quantite, documentId: id });
        if (r !== 'ok') return { ok: false, raison: r === 'stock_reserve' ? 'stock_reserve' : 'stock_insuffisant' };
        continue;
      }
      // Vente : elle passe toujours. On sort ce que le stock connu permet ; le reste est noté « à vérifier ».
      const s = await trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', varianteId).executeTakeFirstOrThrow();
      const sortie = Math.min(quantite, Math.max(0, s.quantite - s.reservee));
      if (sortie > 0) await ajouterMouvement(trx, ctx, { varianteId, type: 'vente', quantite: -sortie, documentId: id });
      if (sortie < quantite) {
        manques++;
        await trx.insertInto('ecarts_stock').values({ commercant_id: ctx.commercantId, variante_id: varianteId, document_id: id, quantite: quantite - sortie }).execute();
      }
    }
  }
  if (n.source) {
    await trx.insertInto('liens_documents').values({ commercant_id: ctx.commercantId, source_id: n.source.id, cible_id: id, nature: n.source.nature }).execute();
  }
  return { ok: true, id, manques };
}

export interface VenteCaisse {
  lignes: { varianteId: string; quantite: number; remise?: number }[];
  facture?: boolean;
  acheteur?: Mentions | null;
  cle: string;
  remiseGlobale?: number;
  /** Sommes reçues. Absent : tout en espèces (comme avant). Moins que le total : vente à crédit. */
  encaisse?: Encaissement[];
}

/** Vente en magasin : ticket (ou facture si le client la demande), stock sorti, payée tout de suite ou à crédit. */
export function vendreEnCaisse(trx: Trx, ctx: Contexte, v: VenteCaisse) {
  return creerDocument(trx, ctx, {
    type: v.facture ? 'facture' : 'ticket', origine: 'caisse', lignes: v.lignes, acheteur: v.acheteur ?? null,
    payeEnEspeces: !v.encaisse, encaisse: v.encaisse, remiseGlobale: v.remiseGlobale, modeVente: 'directe', stock: 'vente', cle: v.cle,
  });
}

/** Modifie un devis tant qu'il est en attente : lignes, client, note. Son numéro ne change pas. */
/** Vrai si chaque article garde le prix de sa fiche (ou celui déjà écrit sur le devis modifié), sans nouvelle remise. */
export async function prixPermis(trx: Trx, lignes: LigneSaisie[], remiseGlobale: number, devisId: string | null): Promise<boolean> {
  if (remiseGlobale) return false;
  const ids = [...new Set(lignes.flatMap((l) => (l.varianteId ? [l.varianteId] : [])))];
  const fiches = ids.length ? await trx.selectFrom('variantes').select(['id', 'prix_vente']).where('id', 'in', ids).execute() : [];
  const fiche = new Map(fiches.map((x) => [x.id, Number(x.prix_vente)]));
  const deja = devisId ? ((await lireDocument(trx, devisId))?.lignes ?? []) : [];
  return lignes.every((l) => {
    if (!l.varianteId) return true; // ligne libre (service, frais) : pas de stock, prix libre
    const anciennes = deja.filter((d) => d.varianteId === l.varianteId);
    const prixOk = l.prixUnitaire === fiche.get(l.varianteId) || anciennes.some((d) => d.prixUnitaire === l.prixUnitaire);
    const remiseOk = !l.remise || anciennes.some((d) => d.remise === l.remise);
    return prixOk && remiseOk;
  });
}

export async function modifierDevis(trx: Trx, ctx: Contexte, id: string, m: { lignes: LigneSaisie[]; acheteur?: Mentions | null; note?: string; remiseGlobale?: number }): Promise<Resultat<object>> {
  const d = await trx.selectFrom('documents').select(['type', 'etat']).where('id', '=', id).executeTakeFirst();
  if (!d) return { ok: false, raison: 'introuvable' };
  if (d.type !== 'devis' || d.etat !== 'en_attente') return { ok: false, raison: 'devis_non_modifiable' };
  const { reglages } = await mentionsVendeur(trx, ctx.commercantId);
  const a = verifierAcheteur(m.acheteur);
  if (!a.ok) return a;
  const p = await preparerLignes(trx, m.lignes, reglages, { prixLibres: true });
  if (!p.ok) return p;
  if (m.remiseGlobale) {
    if (!entier(m.remiseGlobale, 0, totaux(p.lignes).ttc)) return { ok: false, raison: 'remise_invalide' };
    p.lignes = appliquerRemiseGlobale(p.lignes, m.remiseGlobale);
  }
  // Devis d'une commande : il réserve le stock. Les nouvelles quantités doivent être disponibles.
  const reserve = await reservationsNettes(trx, id);
  if (reserve.size && !(await stockLibreSuffit(trx, parArticle(p.lignes), reserve))) return { ok: false, raison: 'stock_insuffisant' };
  const t = totaux(p.lignes);
  if (reserve.size) {
    await libererReservations(trx, ctx, id);
    for (const [varianteId, quantite] of parArticle(p.lignes)) await ajouterMouvement(trx, ctx, { varianteId, type: 'reservation', quantite, documentId: id });
  }
  await trx.deleteFrom('lignes_document').where('document_id', '=', id).execute();
  await trx.insertInto('lignes_document').values(p.lignes.map(valeursLigne(ctx.commercantId, id))).execute();
  await trx
    .updateTable('documents')
    .set({
      total_ht: t.ht, total_tva: t.tva, total: t.ttc, note: (m.note ?? '').trim().slice(0, 500),
      client_id: a.acheteur ? await enregistrerClient(trx, ctx, a.acheteur) : null,
      acheteur_chiffre: a.acheteur ? chiffrer(JSON.stringify(a.acheteur), `documents.acheteur:${id}`) : null,
    })
    .where('id', '=', id)
    .execute();
  return { ok: true };
}

export async function changerEtatDevis(trx: Trx, ctx: Contexte, id: string, etat: 'refuse' | 'en_attente'): Promise<Resultat<object>> {
  const attendu: EtatDocument = etat === 'refuse' ? 'en_attente' : 'refuse';
  // Le devis d'une commande se gère depuis la commande (annuler, confirmer).
  const commande = await trx.selectFrom('commandes').select('id').where('devis_id', '=', id).executeTakeFirst();
  if (commande) return { ok: false, raison: 'devis_non_modifiable' };
  const r = await trx.updateTable('documents').set({ etat }).where('id', '=', id).where('type', '=', 'devis').where('etat', '=', attendu).executeTakeFirst();
  if (!r.numUpdatedRows) return { ok: false, raison: 'devis_non_modifiable' };
  if (etat === 'refuse') await libererReservations(trx, ctx, id);
  return { ok: true };
}

/** Le document et tous ceux dont il vient par transformation. */
async function chaineOrigines(trx: Trx, id: string): Promise<string[]> {
  const r = await sql<{ id: string }>`
    WITH RECURSIVE chaine AS (
      SELECT id FROM documents WHERE id = ${id}
      UNION
      SELECT l.source_id FROM chaine c JOIN liens_documents l ON l.cible_id = c.id AND l.nature = 'transforme_en'
    ) SELECT id FROM chaine`.execute(trx);
  return r.rows.map((l) => l.id);
}

/** Vrai si le document, ou l'un de ceux dont il vient, a déjà sorti le stock. */
async function stockDejaSorti(trx: Trx, id: string): Promise<boolean> {
  const r = await sql<{ sorti: boolean }>`
    WITH RECURSIVE chaine AS (
      SELECT id, stock_sorti FROM documents WHERE id = ${id}
      UNION
      SELECT d.id, d.stock_sorti FROM chaine c JOIN liens_documents l ON l.cible_id = c.id AND l.nature = 'transforme_en' JOIN documents d ON d.id = l.source_id
    ) SELECT bool_or(stock_sorti) AS sorti FROM chaine`.execute(trx);
  return !!r.rows[0]?.sorti;
}

/**
 * Transforme un document en suivant, sans ressaisie : mêmes lignes, mêmes prix, lien gardé.
 * Pour une facture, `mode` répond à la question « Envoi » ou « Vente directe » :
 *  - vente directe : le stock sort et la facture est payée en espèces tout de suite ;
 *  - envoi : le stock est réservé, la facture sera payée à la livraison.
 */
export async function transformer(
  trx: Trx, ctx: Contexte, sourceId: string, cible: TypeDocument,
  o: { mode?: 'directe' | 'envoi'; acheteur?: Mentions | null; cle: string; depuisCommande?: boolean; encaisse?: Encaissement[] },
): Promise<Resultat<{ id: string; manques: number }>> {
  const deja = await trx.selectFrom('documents').select('id').where('cle', '=', o.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id, manques: 0 };
  // Le devis d'une commande se confirme depuis la commande, pour que son suivi reste juste.
  if (!o.depuisCommande && (await trx.selectFrom('commandes').select('id').where('devis_id', '=', sourceId).executeTakeFirst())) return { ok: false, raison: 'transformation_impossible' };
  const source = await trx.selectFrom('documents').select(['id', 'type', 'etat', 'acheteur_chiffre', 'origine', 'note']).where('id', '=', sourceId).executeTakeFirst();
  if (!source) return { ok: false, raison: 'introuvable' };
  if (!TRANSFORMATIONS[source.type]?.includes(cible)) return { ok: false, raison: 'transformation_impossible' };
  if (source.type === 'devis' && source.etat !== 'en_attente') return { ok: false, raison: 'deja_transforme' };
  const suite = await trx.selectFrom('liens_documents').select('cible_id').where('source_id', '=', sourceId).where('nature', '=', 'transforme_en').executeTakeFirst();
  if (suite) return { ok: false, raison: 'deja_transforme' };
  if (cible === 'facture' && !o.mode) return { ok: false, raison: 'transformation_impossible' };

  const lignes = await trx.selectFrom('lignes_document').select(['variante_id', 'designation', 'quantite', 'prix_unitaire', 'taux_tva', 'cout_unitaire', 'remise']).where('document_id', '=', sourceId).orderBy('ordre').execute();
  const acheteur = o.acheteur ?? (source.acheteur_chiffre ? (JSON.parse(dechiffrer(source.acheteur_chiffre, `documents.acheteur:${sourceId}`)) as Mentions) : null);
  const sorti = await stockDejaSorti(trx, sourceId);
  let stock: NouveauDocument['stock'] = null;
  if (!sorti) {
    if (cible === 'bon_livraison') stock = 'vente';
    else if (cible === 'facture') stock = o.mode === 'envoi' ? 'reserver' : 'vente';
  }
  if (cible === 'facture' && !verifierAcheteur(acheteur).ok) return { ok: false, raison: 'telephone_invalide' };
  if (cible === 'facture' && !acheteur?.nom?.trim()) return { ok: false, raison: 'client_requis' };
  // Ce que la chaîne réserve déjà (devis d'une commande) passe au nouveau document : rendu puis repris.
  const chaine = stock ? await chaineOrigines(trx, sourceId) : [];
  const rendues = new Map<string, number>();
  for (const docId of chaine) for (const [v, q] of await reservationsNettes(trx, docId)) rendues.set(v, (rendues.get(v) ?? 0) + q);
  if (stock === 'reserver' && !(await stockLibreSuffit(trx, parArticle(lignes.map((l) => ({ varianteId: l.variante_id, quantite: l.quantite }))), rendues))) {
    return { ok: false, raison: 'stock_insuffisant' };
  }
  for (const docId of chaine) await libererReservations(trx, ctx, docId);
  const r = await creerDocument(trx, ctx, {
    type: cible,
    origine: source.origine,
    lignes: lignes.map((l) => ({ varianteId: l.variante_id, designation: l.designation, quantite: l.quantite, prixUnitaire: Number(l.prix_unitaire), tauxTva: l.taux_tva, coutUnitaire: Number(l.cout_unitaire), remise: Number(l.remise) })),
    acheteur,
    prixLibres: true,
    // Vente directe : payée tout de suite en espèces, sauf si un autre paiement (ou un crédit) est indiqué.
    payeEnEspeces: cible === 'facture' && o.mode === 'directe' && !o.encaisse,
    encaisse: cible === 'facture' && o.mode === 'directe' ? o.encaisse : undefined,
    modeVente: cible === 'facture' ? o.mode : undefined,
    stock,
    note: source.note,
    cle: o.cle,
    source: { id: sourceId, nature: 'transforme_en' },
  });
  if (!r.ok) return r;
  if (source.type === 'devis') await trx.updateTable('documents').set({ etat: 'transforme' }).where('id', '=', sourceId).execute();
  return { ok: true, id: r.id, manques: r.manques };
}

/** Ce qui a été vendu et ce qui a été payé pour une facture ou un ticket (vue `soldes_documents`). */
export async function soldeDocument(trx: Trx, id: string): Promise<{ net: number; paye: number; reste: number } | null> {
  const s = await trx.selectFrom('soldes_documents').select(['net', 'paye']).where('document_id', '=', id).executeTakeFirst();
  if (!s) return null;
  return { net: Number(s.net), paye: Number(s.paye), reste: Number(s.net) - Number(s.paye) };
}

interface LigneRestante {
  id: string;
  varianteId: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  tauxTva: number;
  coutUnitaire: number;
  totalTtc: number;
  /** Ce qui n'a pas encore été rendu par un avoir. */
  resteQuantite: number;
  resteTtc: number;
  resteHt: number;
}

/** Lignes d'une facture ou d'un ticket, avec ce qui reste après les avoirs déjà faits. */
export async function lignesRestantes(trx: Trx, sourceId: string): Promise<LigneRestante[]> {
  const lignes = await trx.selectFrom('lignes_document').select(['id', 'variante_id', 'designation', 'quantite', 'prix_unitaire', 'taux_tva', 'cout_unitaire', 'total_ttc', 'total_ht']).where('document_id', '=', sourceId).orderBy('ordre').execute();
  const rendus = await trx
    .selectFrom('lignes_document as la')
    .innerJoin('liens_documents as l', 'l.cible_id', 'la.document_id')
    .select(['la.ligne_origine_id', (eb) => eb.fn.sum<string>('la.quantite').as('q'), (eb) => eb.fn.sum<string>('la.total_ttc').as('ttc'), (eb) => eb.fn.sum<string>('la.total_ht').as('ht')])
    .where('l.source_id', '=', sourceId)
    .where('l.nature', '=', 'corrige_par')
    .groupBy('la.ligne_origine_id')
    .execute();
  const parLigne = new Map(rendus.map((r) => [r.ligne_origine_id, r]));
  return lignes.map((l) => {
    const r = parLigne.get(l.id);
    return {
      id: l.id, varianteId: l.variante_id, designation: l.designation, quantite: l.quantite, prixUnitaire: Number(l.prix_unitaire), tauxTva: l.taux_tva,
      coutUnitaire: Number(l.cout_unitaire), totalTtc: Number(l.total_ttc),
      resteQuantite: l.quantite - Number(r?.q ?? 0), resteTtc: Number(l.total_ttc) - Number(r?.ttc ?? 0), resteHt: Number(l.total_ht) - Number(r?.ht ?? 0),
    };
  });
}

export interface RetourLigne {
  ligneId: string;
  quantite: number;
}

/**
 * Avoir : corrige une facture ou un ticket, qui ne se modifient jamais. Sans `lignes`, il annule tout ce qui
 * reste ; avec `lignes`, il ne rend qu'une partie (une ligne, une partie de la quantité). Il porte son propre
 * numéro, cite le document corrigé, remet le stock si on le demande, et rend l'argent seulement à hauteur de ce
 * qui avait été payé (une vente à crédit voit simplement sa dette diminuer).
 */
export async function creerAvoir(
  trx: Trx, ctx: Contexte, sourceId: string,
  o: { remettreEnStock: boolean; cle: string; lignes?: RetourLigne[]; modeRemboursement?: ModeEncaissement },
): Promise<Resultat<{ id: string; rembourse: number }>> {
  const deja = await trx.selectFrom('documents').select('id').where('cle', '=', o.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id, rembourse: 0 };
  const source = await trx.selectFrom('documents').select(['id', 'type', 'acheteur_chiffre', 'origine', 'mode_vente', 'timbre']).where('id', '=', sourceId).executeTakeFirst();
  if (!source || (source.type !== 'facture' && source.type !== 'ticket')) return { ok: false, raison: 'introuvable' };
  const solde = (await soldeDocument(trx, sourceId))!;
  if (solde.net === 0) return { ok: false, raison: 'deja_annule' };
  const restes = await lignesRestantes(trx, sourceId);
  const reserve = await reservationsNettes(trx, sourceId);
  // Un envoi pas encore expédié ne se rend pas en partie : on l'annule entièrement, ou on modifie la commande.
  if (o.lignes && reserve.size) return { ok: false, raison: 'retour_invalide' };

  const voulu = new Map<string, number>();
  if (o.lignes) {
    if (o.lignes.length > MAX_LIGNES) return { ok: false, raison: 'retour_invalide' };
    for (const r of o.lignes) voulu.set(r.ligneId, (voulu.get(r.ligneId) ?? 0) + r.quantite);
  } else {
    for (const l of restes) if (l.resteQuantite > 0) voulu.set(l.id, l.resteQuantite);
  }
  const rendues: (LignePrete & { ligneOrigineId: string })[] = [];
  for (const [ligneId, q] of voulu) {
    const l = restes.find((x) => x.id === ligneId);
    if (!l || !entier(q, 1, l.resteQuantite)) return { ok: false, raison: 'retour_invalide' };
    // La dernière unité prend le reste exact : la somme des avoirs retombe juste sur la facture.
    const totalTtc = q === l.resteQuantite ? l.resteTtc : Math.round((l.totalTtc * q) / l.quantite);
    const totalHt = q === l.resteQuantite ? l.resteHt : horsTaxe(totalTtc, l.tauxTva);
    rendues.push({
      varianteId: l.varianteId, designation: l.designation, quantite: q, prixUnitaire: l.prixUnitaire, tauxTva: l.tauxTva, coutUnitaire: l.coutUnitaire,
      remise: Math.max(0, l.prixUnitaire * q - totalTtc), totalTtc, totalHt, ligneOrigineId: l.id,
    });
  }
  if (!rendues.length) return { ok: false, raison: 'retour_invalide' };
  const complet = restes.every((l) => l.resteQuantite - (voulu.get(l.id) ?? 0) === 0);
  // Le droit de timbre n'est rendu qu'avec la dernière partie de la vente.
  const timbre = complet ? Number(source.timbre) : 0;
  const t = totaux(rendues);
  const totalAvoir = -(t.ttc + timbre);
  const rembourse = Math.max(0, solde.paye - (solde.net + totalAvoir));
  const modeRembourse = o.modeRemboursement && MODES_ENCAISSEMENT.includes(o.modeRemboursement) ? o.modeRemboursement : 'especes';

  const id = randomUUID();
  const { mentions } = await mentionsVendeur(trx, ctx.commercantId);
  const annee = anneeAlger();
  const numero = await prochainNumero(trx, ctx.commercantId, 'avoir', annee);
  // Après le verrou du numéro : deux opérations simultanées n'ouvrent jamais deux caisses.
  const session = rembourse > 0 && modeRembourse === 'especes' ? await caisseOuverte(trx, ctx) : null;
  const maintenant = new Date();
  await trx
    .insertInto('documents')
    .values({
      id, commercant_id: ctx.commercantId, type: 'avoir', annee, numero, etat: 'emis', origine: source.origine,
      mode_vente: source.mode_vente, client_id: null,
      vendeur_chiffre: chiffrer(JSON.stringify(mentions), `documents.vendeur:${id}`),
      // Le texte chiffré est lié à son document : il est déchiffré puis rechiffré pour l'avoir.
      acheteur_chiffre: source.acheteur_chiffre ? chiffrer(dechiffrer(source.acheteur_chiffre, `documents.acheteur:${sourceId}`), `documents.acheteur:${id}`) : null,
      total_ht: -t.ht, total_tva: -t.tva, timbre, total: totalAvoir,
      mode_paiement: rembourse ? modeRembourse : null, paye_le: rembourse ? maintenant : null,
      // L'argent rendu en espèces sort de la caisse ouverte.
      session_caisse_id: session,
      stock_sorti: o.remettreEnStock, emis_par: ctx.utilisateurId, cle: o.cle,
    })
    .execute();
  await trx.insertInto('lignes_document').values(rendues.map(valeursLigne(ctx.commercantId, id))).execute();
  await trx.insertInto('liens_documents').values({ commercant_id: ctx.commercantId, source_id: sourceId, cible_id: id, nature: 'corrige_par' }).execute();
  if (rembourse) {
    await trx.insertInto('paiements').values({ commercant_id: ctx.commercantId, document_id: sourceId, montant: -rembourse, mode: modeRembourse, piece_id: id, session_caisse_id: session, cree_par: ctx.utilisateurId }).execute();
  }

  // Stock : on ne remet jamais plus que ce que la vente avait sorti (moins ce qui est déjà revenu).
  // Réservation encore active (envoi pas encore expédié) : libérée. Les mouvements sont rattachés à l'avoir.
  for (const [varianteId, net] of reserve) await ajouterMouvement(trx, ctx, { varianteId, type: 'liberation', quantite: -net, documentId: id });
  if (o.remettreEnStock) {
    const sorties = await trx.selectFrom('mouvements_stock').select(['variante_id', (eb) => eb.fn.sum<string>('quantite').as('q')]).where('document_id', '=', sourceId).where('type', '=', 'vente').groupBy('variante_id').execute();
    const revenus = await trx
      .selectFrom('mouvements_stock as m')
      .innerJoin('liens_documents as l', 'l.cible_id', 'm.document_id')
      .select(['m.variante_id', (eb) => eb.fn.sum<string>('m.quantite').as('q')])
      .where('l.source_id', '=', sourceId).where('l.nature', '=', 'corrige_par').where('m.type', '=', 'retour').where('m.document_id', '<>', id)
      .groupBy('m.variante_id')
      .execute();
    const sortiParBl = !sorties.length && (await stockDejaSorti(trx, sourceId));
    const sorti = new Map(sorties.map((m) => [m.variante_id, -Number(m.q)]));
    const revenu = new Map(revenus.map((m) => [m.variante_id, Number(m.q)]));
    for (const [varianteId, q] of parArticle(rendues)) {
      // Stock sorti par un bon de livraison antérieur : remis à partir des lignes.
      const possible = sortiParBl ? q : Math.max(0, (sorti.get(varianteId) ?? 0) - (revenu.get(varianteId) ?? 0));
      const remis = Math.min(q, possible);
      if (remis > 0) await ajouterMouvement(trx, ctx, { varianteId, type: 'retour', quantite: remis, documentId: id });
    }
  }
  return { ok: true, id, rembourse };
}

/**
 * Encaisse tout ou partie de ce qui reste dû sur une facture ou un ticket (vente à crédit, facture à payer) :
 * crée le reçu de paiement, note la somme, et marque la vente payée quand il ne reste plus rien.
 */
export async function encaisserFacture(
  trx: Trx, ctx: Contexte, factureId: string, cle: string,
  p: { mode?: ModeEncaissement; montant?: number; reference?: string } = {},
): Promise<Resultat<{ id: string }>> {
  const deja = await trx.selectFrom('documents').select('id').where('cle', '=', cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id };
  const f = await trx.selectFrom('documents').select(['type', 'paye_le', 'acheteur_chiffre', 'mode_vente']).where('id', '=', factureId).executeTakeFirst();
  if (!f || (f.type !== 'facture' && f.type !== 'ticket')) return { ok: false, raison: 'introuvable' };
  const solde = (await soldeDocument(trx, factureId))!;
  if (solde.net === 0) return { ok: false, raison: 'deja_annule' };
  if (f.paye_le || solde.reste <= 0) return { ok: false, raison: 'deja_paye' };
  const mode = p.mode ?? 'especes';
  const montant = p.montant ?? solde.reste;
  if (!MODES_ENCAISSEMENT.includes(mode) || !entier(montant, 1, solde.reste)) return { ok: false, raison: 'paiement_invalide' };
  const reference = (p.reference ?? '').trim().slice(0, 60);
  const acheteur = f.acheteur_chiffre ? (JSON.parse(dechiffrer(f.acheteur_chiffre, `documents.acheteur:${factureId}`)) as Mentions) : null;
  const r = await creerDocument(trx, ctx, {
    type: 'recu', origine: 'manuel', lignes: [], acheteur, payeEnEspeces: mode === 'especes', encaisse: [{ mode, montant, reference }],
    montantRecu: montant, cle, source: { id: factureId, nature: 'regle_par' },
  });
  if (!r.ok) return r;
  const session = mode === 'especes' ? await caisseOuverte(trx, ctx) : null;
  await trx.insertInto('paiements').values({ commercant_id: ctx.commercantId, document_id: factureId, montant, mode, reference, piece_id: r.id, session_caisse_id: session, cree_par: ctx.utilisateurId }).execute();
  const modes = await trx.selectFrom('paiements').select('mode').where('document_id', '=', factureId).where(sql<boolean>`montant > 0`).execute();
  await trx.updateTable('documents').set({ mode_paiement: modeResume(modes.map((m) => m.mode)), ...(montant === solde.reste ? { paye_le: new Date() } : {}) }).where('id', '=', factureId).execute();
  return { ok: true, id: r.id };
}

export interface Dette {
  documentId: string;
  type: TypeDocument;
  annee: number;
  numero: number;
  emisLe: Date;
  net: number;
  paye: number;
  reste: number;
}

/** Ventes d'un client pas encore entièrement payées (hors colis, payés à la livraison), les plus anciennes d'abord. */
export async function dettesClient(trx: Trx, clientId: string): Promise<Dette[]> {
  const r = await trx
    .selectFrom('soldes_documents as s')
    .innerJoin('documents as d', 'd.id', 's.document_id')
    .select(['s.document_id', 'd.type', 'd.annee', 'd.numero', 'd.emis_le', 's.net', 's.paye'])
    .where('s.client_id', '=', clientId)
    .where((eb) => eb.or([eb('s.mode_vente', 'is', null), eb('s.mode_vente', '<>', 'envoi')]))
    .whereRef('s.net', '>', 's.paye')
    .orderBy('d.emis_le')
    .execute();
  return r.map((l) => ({ documentId: l.document_id, type: l.type, annee: l.annee, numero: l.numero, emisLe: l.emis_le, net: Number(l.net), paye: Number(l.paye), reste: Number(l.net) - Number(l.paye) }));
}

/** Clients qui doivent de l'argent, avec le total dû, les plus gros d'abord. */
export async function clientsQuiDoivent(trx: Trx, limite = 200): Promise<{ id: string; nom: string; du: number; depuis: Date }[]> {
  const r = await sql<{ id: string; nom: string; du: string; depuis: Date }>`
    SELECT c.id, c.nom, sum(s.net - s.paye) AS du, min(s.emis_le) AS depuis
    FROM soldes_documents s JOIN clients c ON c.id = s.client_id
    WHERE (s.mode_vente IS NULL OR s.mode_vente <> 'envoi') AND s.net > s.paye
    GROUP BY c.id, c.nom ORDER BY du DESC LIMIT ${limite}`.execute(trx);
  return r.rows.map((l) => ({ id: l.id, nom: l.nom, du: Number(l.du), depuis: l.depuis }));
}

/**
 * Versement d'un client sur son crédit : la somme règle ses ventes dues, des plus anciennes aux plus récentes,
 * avec un reçu pour chacune. La clé rend l'opération sûre en cas de double toucher.
 */
export async function encaisserClient(
  trx: Trx, ctx: Contexte, clientId: string, p: { mode: ModeEncaissement; montant: number; reference?: string; cle: string },
): Promise<Resultat<{ recus: string[] }>> {
  const deja = await trx.selectFrom('documents').select('id').where('cle', '=', p.cle).executeTakeFirst();
  if (deja) return { ok: true, recus: [deja.id] };
  const dettes = await dettesClient(trx, clientId);
  const du = dettes.reduce((s, d) => s + d.reste, 0);
  if (!du) return { ok: false, raison: 'rien_a_payer' };
  if (!entier(p.montant, 1, du)) return { ok: false, raison: 'paiement_invalide' };
  const recus: string[] = [];
  let reste = p.montant;
  for (const d of dettes) {
    if (!reste) break;
    const part = Math.min(reste, d.reste);
    const r = await encaisserFacture(trx, ctx, d.documentId, recus.length ? randomUUID() : p.cle, { mode: p.mode, montant: part, reference: p.reference });
    if (!r.ok) return r;
    recus.push(r.id);
    reste -= part;
  }
  return { ok: true, recus };
}

// ───────────── Lectures ─────────────

export interface LigneListe {
  id: string;
  type: TypeDocument;
  annee: number;
  numero: number;
  etat: EtatDocument;
  origine: 'caisse' | 'manuel' | 'boutique';
  total: string;
  paye_le: Date | null;
  mode_vente: 'directe' | 'envoi' | null;
  emis_le: Date;
  client: string | null;
  annule: boolean;
}

export async function listerDocuments(trx: Trx, o: { types: readonly TypeDocument[]; numero?: number; limite: number; decalage?: number }): Promise<LigneListe[]> {
  let q = trx
    .selectFrom('documents as d')
    .leftJoin('clients as c', 'c.id', 'd.client_id')
    .select(['d.id', 'd.type', 'd.annee', 'd.numero', 'd.etat', 'd.origine', 'd.total', 'd.paye_le', 'd.mode_vente', 'd.emis_le', 'c.nom as client'])
    // « Annulé » : entièrement corrigé par un ou plusieurs avoirs (il ne reste rien de la vente).
    .select((eb) => eb.exists(eb.selectFrom('soldes_documents as s').select('s.document_id').whereRef('s.document_id', '=', 'd.id').where(sql<boolean>`s.net = 0`)).as('annule'))
    .where('d.type', 'in', [...o.types]);
  // Un devis se retrouve aussi par le numéro du ticket (ou de la commande) qu'il porte.
  if (o.numero) q = q.where((eb) => eb.or([eb('d.numero', '=', o.numero!), eb('d.id', 'in', eb.selectFrom('commandes').select('devis_id').where('numero', '=', o.numero!))]));
  return (await q.orderBy('d.emis_le', 'desc').orderBy('d.numero', 'desc').limit(o.limite).offset(o.decalage ?? 0).execute()) as LigneListe[];
}

export interface DocumentComplet {
  id: string;
  type: TypeDocument;
  annee: number;
  numero: number;
  etat: EtatDocument;
  origine: 'caisse' | 'manuel' | 'boutique';
  modeVente: 'directe' | 'envoi' | null;
  vendeur: Mentions;
  acheteur: Mentions | null;
  totalHt: number;
  totalTva: number;
  timbre: number;
  total: number;
  modePaiement: ModePaiement | null;
  payeLe: Date | null;
  valideJusqua: Date | null;
  note: string;
  emisLe: Date;
  emisPar: string;
  lignes: { id: string; varianteId: string | null; designation: string; quantite: number; prixUnitaire: number; tauxTva: number; remise: number; totalHt: number; totalTtc: number }[];
  /** Facture ou ticket : ce qui reste vendu après les avoirs, ce qui est payé, ce qui reste dû. */
  solde: { net: number; paye: number; reste: number } | null;
  /** Sommes reçues (ou rendues) pour cette vente. */
  paiements: { id: string; montant: number; mode: ModePaiement; reference: string; pieceId: string | null; creeLe: Date }[];
  clientId: string | null;
  /** Documents liés, dans les deux sens : ce qui l'a créé et ce qu'il a créé. */
  liens: { id: string; type: TypeDocument; annee: number; numero: number; nature: 'transforme_en' | 'corrige_par' | 'regle_par'; sens: 'origine' | 'suite' }[];
}

export async function lireDocument(trx: Trx, id: string): Promise<DocumentComplet | null> {
  const d = await trx
    .selectFrom('documents as d')
    .innerJoin('utilisateurs as u', 'u.id', 'd.emis_par')
    .select(['d.id', 'd.type', 'd.annee', 'd.numero', 'd.etat', 'd.origine', 'd.mode_vente', 'd.vendeur_chiffre', 'd.acheteur_chiffre', 'd.total_ht', 'd.total_tva', 'd.timbre', 'd.total', 'd.mode_paiement', 'd.paye_le', 'd.valide_jusqua', 'd.note', 'd.emis_le', 'd.client_id', 'u.nom as emis_par'])
    .where('d.id', '=', id)
    .executeTakeFirst();
  if (!d) return null;
  const lignes = await trx.selectFrom('lignes_document').select(['id', 'variante_id', 'designation', 'quantite', 'prix_unitaire', 'taux_tva', 'remise', 'total_ht', 'total_ttc']).where('document_id', '=', id).orderBy('ordre').execute();
  const vente = d.type === 'facture' || d.type === 'ticket';
  const paiements = vente ? await trx.selectFrom('paiements').select(['id', 'montant', 'mode', 'reference', 'piece_id', 'cree_le']).where('document_id', '=', id).orderBy('cree_le').execute() : [];
  const liens = await sql<{ id: string; type: TypeDocument; annee: number; numero: number; nature: 'transforme_en' | 'corrige_par' | 'regle_par'; sens: 'origine' | 'suite' }>`
    SELECT d.id, d.type, d.annee, d.numero, l.nature, 'origine' AS sens FROM liens_documents l JOIN documents d ON d.id = l.source_id WHERE l.cible_id = ${id}
    UNION ALL
    SELECT d.id, d.type, d.annee, d.numero, l.nature, 'suite' AS sens FROM liens_documents l JOIN documents d ON d.id = l.cible_id WHERE l.source_id = ${id}`.execute(trx);
  return {
    id: d.id, type: d.type, annee: d.annee, numero: d.numero, etat: d.etat, origine: d.origine, modeVente: d.mode_vente,
    vendeur: JSON.parse(dechiffrer(d.vendeur_chiffre, `documents.vendeur:${id}`)) as Mentions,
    acheteur: d.acheteur_chiffre ? (JSON.parse(dechiffrer(d.acheteur_chiffre, `documents.acheteur:${id}`)) as Mentions) : null,
    totalHt: Number(d.total_ht), totalTva: Number(d.total_tva), timbre: Number(d.timbre), total: Number(d.total),
    modePaiement: d.mode_paiement, payeLe: d.paye_le, valideJusqua: d.valide_jusqua, note: d.note, emisLe: d.emis_le, emisPar: d.emis_par,
    lignes: lignes.map((l) => ({ id: l.id, varianteId: l.variante_id, designation: l.designation, quantite: l.quantite, prixUnitaire: Number(l.prix_unitaire), tauxTva: l.taux_tva, remise: Number(l.remise), totalHt: Number(l.total_ht), totalTtc: Number(l.total_ttc) })),
    liens: liens.rows,
    solde: vente ? await soldeDocument(trx, id) : null,
    paiements: paiements.map((p) => ({ id: p.id, montant: Number(p.montant), mode: p.mode, reference: p.reference, pieceId: p.piece_id, creeLe: p.cree_le })),
    clientId: d.client_id,
  };
}

// ───────────── Caisse ─────────────

export interface ResumeCaisse {
  id: string;
  ouverteLe: Date;
  ouvertePar: string;
  fond: number;
  ventes: number;
  /** Espèces encaissées (ventes et reçus) moins les remboursements. */
  especes: number;
  remboursements: number;
  /** Espèces sorties de la caisse : dépenses et paiements aux fournisseurs. */
  sorties: number;
  fermeeLe: Date | null;
  fermeePar: string | null;
  attendues: number | null;
  comptees: number | null;
  note: string;
}

export async function resumeCaisse(trx: Trx, id: string): Promise<ResumeCaisse | null> {
  const r = await sql<{
    id: string; ouverte_le: Date; ouverte_par: string; fond_ouverture: string; fermee_le: Date | null; fermee_par: string | null;
    especes_attendues: string | null; especes_comptees: string | null; note: string; ventes: number; especes: string; remboursements: string; sorties: string;
  }>`
    SELECT s.id, s.ouverte_le, o.nom AS ouverte_par, s.fond_ouverture, s.fermee_le, f.nom AS fermee_par, s.especes_attendues, s.especes_comptees, s.note,
      (SELECT count(*) FROM documents d WHERE d.session_caisse_id = s.id AND d.type IN ('ticket', 'facture'))::int AS ventes,
      (SELECT coalesce(sum(p.montant), 0) FROM paiements p WHERE p.session_caisse_id = s.id AND p.montant > 0) AS especes,
      (SELECT coalesce(-sum(p.montant), 0) FROM paiements p WHERE p.session_caisse_id = s.id AND p.montant < 0) AS remboursements,
      (SELECT coalesce(sum(d.montant), 0) FROM depenses d WHERE d.session_caisse_id = s.id AND d.annulee_le IS NULL)
        + (SELECT coalesce(sum(pf.montant), 0) FROM paiements_fournisseurs pf WHERE pf.session_caisse_id = s.id) AS sorties
    FROM sessions_caisse s JOIN utilisateurs o ON o.id = s.ouverte_par LEFT JOIN utilisateurs f ON f.id = s.fermee_par
    WHERE s.id = ${id}`.execute(trx);
  const s = r.rows[0];
  if (!s) return null;
  return {
    id: s.id, ouverteLe: s.ouverte_le, ouvertePar: s.ouverte_par, fond: Number(s.fond_ouverture), ventes: s.ventes, especes: Number(s.especes), remboursements: Number(s.remboursements), sorties: Number(s.sorties),
    fermeeLe: s.fermee_le, fermeePar: s.fermee_par, attendues: s.especes_attendues === null ? null : Number(s.especes_attendues),
    comptees: s.especes_comptees === null ? null : Number(s.especes_comptees), note: s.note,
  };
}

/** Fond de caisse au début de la journée (monnaie laissée dans le tiroir). Ouvre la caisse si besoin. */
export async function fixerFondCaisse(trx: Trx, ctx: Contexte, fond: number): Promise<Resultat<{ id: string }>> {
  if (!entier(fond, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  const id = (await caisseOuverte(trx, ctx))!;
  await trx.updateTable('sessions_caisse').set({ fond_ouverture: fond }).where('id', '=', id).execute();
  return { ok: true, id };
}

/** Clôture : on donne les espèces comptées ; l'application calcule ce qu'il devrait y avoir et garde l'écart. */
export async function cloturerCaisse(trx: Trx, ctx: Contexte, o: { comptees: number; note?: string }): Promise<Resultat<{ id: string; ecart: number }>> {
  if (!entier(o.comptees, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  const id = await caisseOuverte(trx, ctx, false);
  if (!id) return { ok: false, raison: 'caisse_fermee' };
  const r = (await resumeCaisse(trx, id))!;
  const attendues = r.fond + r.especes - r.remboursements - r.sorties;
  await trx
    .updateTable('sessions_caisse')
    .set({ fermee_le: new Date(), fermee_par: ctx.utilisateurId, especes_attendues: attendues, especes_comptees: o.comptees, note: (o.note ?? '').trim().slice(0, 200) })
    .where('id', '=', id)
    .execute();
  return { ok: true, id, ecart: o.comptees - attendues };
}

// ───────────── Stock à vérifier ─────────────

export const listerEcarts = (trx: Trx) =>
  trx
    .selectFrom('ecarts_stock as e')
    .innerJoin('variantes as v', 'v.id', 'e.variante_id')
    .innerJoin('produits as p', 'p.id', 'v.produit_id')
    .innerJoin('documents as d', 'd.id', 'e.document_id')
    .select(['e.id', 'e.quantite', 'e.cree_le', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'd.id as document_id', 'd.type', 'd.annee', 'd.numero'])
    .where('e.traite_le', 'is', null)
    .orderBy('e.cree_le', 'desc')
    .limit(100)
    .execute();

export async function traiterEcart(trx: Trx, ctx: Contexte, id: string): Promise<void> {
  await trx.updateTable('ecarts_stock').set({ traite_le: new Date(), traite_par: ctx.utilisateurId }).where('id', '=', id).where('traite_le', 'is', null).execute();
}
