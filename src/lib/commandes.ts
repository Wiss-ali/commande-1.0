// Commandes à livrer et suivi du colis. Une commande s'appuie sur les documents :
//  - ses articles sont les lignes de son devis, qui réserve le stock dès la création ;
//  - « Confirmer » transforme le devis en facture (« Envoi » : stock réservé ; « Vente directe » : stock sorti) ;
//  - l'expédition sort le stock réservé, la livraison marque la facture payée, le retour crée un avoir.
// Tout s'exécute dans la transaction du commerçant : chaque étape réussit entièrement ou ne change rien.
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { chiffrer, dechiffrer, dechiffrerOuNul, empreinte } from './chiffrement.ts';
import {
  anneeAlger, creerAvoir, creerDocument, libererReservations, prochainNumero, reservationsNettes, soldeDocument, transformer, type Mentions,
} from './documents.ts';
import { normaliserTelephone } from './formats.ts';
import { ajouterMouvement, type Contexte } from './stock.ts';
import type { ModeLivraison, StatutCommande, TypeDocument } from './types-bd.ts';

export const STATUTS: readonly StatutCommande[] = ['nouvelle', 'a_confirmer', 'confirmee', 'preparee', 'expediee', 'livree', 'retournee', 'annulee'];
/** Statuts où la commande attend encore l'accord du client. */
export const A_CONFIRMER: readonly StatutCommande[] = ['nouvelle', 'a_confirmer'];
/** Statuts où le colis est encore chez le commerçant. */
export const A_EXPEDIER: readonly StatutCommande[] = ['confirmee', 'preparee'];

export type RefusCommande =
  | 'panier_vide'
  | 'quantite_invalide'
  | 'introuvable'
  | 'client_requis'
  | 'telephone_requis'
  | 'telephone_invalide'
  | 'wilaya_invalide'
  | 'commune_requise'
  | 'commune_invalide'
  | 'montant_invalide'
  | 'stock_insuffisant'
  | 'statut_invalide'
  | 'transporteur_invalide';
type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: RefusCommande };

const MAX_MONTANT = 10_000_000; // 100 000 DA de frais de livraison au plus
const numeroCommande = (c: { annee: number; numero: number }) => `${c.annee}-${c.numero}`;
export { numeroCommande };

// ───────────── Wilayas, transporteurs, frais ─────────────

export const listerWilayas = (trx: Trx) => trx.selectFrom('wilayas').select(['code', 'nom_fr', 'nom_ar']).where('active', '=', true).orderBy('code').execute();
export const listerCommunes = (trx: Trx, wilaya: number) =>
  trx.selectFrom('communes').select(['nom_fr', 'nom_ar']).where('wilaya_code', '=', wilaya).where('active', '=', true).orderBy('nom_fr').execute();

const simplifier = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Commune écrite pour une wilaya : si la wilaya a sa liste de communes, la commune doit en faire partie
 * (accents et majuscules ignorés, nom français ou arabe) et elle est rendue sous son nom officiel.
 * Sans liste pour cette wilaya, le texte saisi est gardé.
 */
export async function communeOfficielle(trx: Trx, wilaya: number, saisie: string): Promise<string | null> {
  const liste = await listerCommunes(trx, wilaya);
  if (!liste.length) return saisie;
  const cible = simplifier(saisie);
  return liste.find((c) => simplifier(c.nom_fr) === cible || (c.nom_ar && simplifier(c.nom_ar) === cible))?.nom_fr ?? null;
}

export const listerTransporteurs = (trx: Trx, tous = false) => {
  let q = trx.selectFrom('transporteurs').select(['id', 'nom', 'actif', 'connecteur']);
  if (!tous) q = q.where('actif', '=', true);
  return q.orderBy('nom').execute();
};

export async function ajouterTransporteur(trx: Trx, ctx: Contexte, nom: string): Promise<Resultat<{ id: string }>> {
  const propre = nom.trim().slice(0, 60);
  if (!propre) return { ok: false, raison: 'transporteur_invalide' };
  const existe = await trx.selectFrom('transporteurs').select('id').where(sql<boolean>`lower(nom) = lower(${propre})`).executeTakeFirst();
  if (existe) {
    await trx.updateTable('transporteurs').set({ actif: true }).where('id', '=', existe.id).execute();
    return { ok: true, id: existe.id };
  }
  const { id } = await trx.insertInto('transporteurs').values({ commercant_id: ctx.commercantId, nom: propre }).returning('id').executeTakeFirstOrThrow();
  return { ok: true, id };
}

export async function activerTransporteur(trx: Trx, id: string, actif: boolean): Promise<void> {
  await trx.updateTable('transporteurs').set({ actif }).where('id', '=', id).execute();
}

export interface Frais {
  wilaya: number;
  domicile: number | null;
  pointRelais: number | null;
}

export async function lireFrais(trx: Trx): Promise<Map<number, Frais>> {
  const r = await trx.selectFrom('frais_livraison').select(['wilaya_code', 'domicile', 'point_relais']).execute();
  return new Map(r.map((l) => [l.wilaya_code, { wilaya: l.wilaya_code, domicile: l.domicile === null ? null : Number(l.domicile), pointRelais: l.point_relais === null ? null : Number(l.point_relais) }]));
}

const montantValide = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= MAX_MONTANT);

/** Remplace la grille des frais. Une wilaya sans aucun prix est retirée. */
export async function enregistrerFrais(trx: Trx, ctx: Contexte, grille: Frais[]): Promise<Resultat<object>> {
  const codes = new Set((await listerWilayas(trx)).map((w) => w.code));
  for (const f of grille) {
    if (!codes.has(f.wilaya)) return { ok: false, raison: 'wilaya_invalide' };
    if (!montantValide(f.domicile) || !montantValide(f.pointRelais)) return { ok: false, raison: 'montant_invalide' };
  }
  await trx.deleteFrom('frais_livraison').execute();
  const lignes = grille.filter((f) => f.domicile !== null || f.pointRelais !== null);
  if (lignes.length) {
    await trx
      .insertInto('frais_livraison')
      .values(lignes.map((f) => ({ commercant_id: ctx.commercantId, wilaya_code: f.wilaya, domicile: f.domicile, point_relais: f.pointRelais })))
      .execute();
  }
  return { ok: true };
}

export async function fraisPour(trx: Trx, wilaya: number, livraison: ModeLivraison): Promise<number | null> {
  const f = await trx.selectFrom('frais_livraison').select(['domicile', 'point_relais']).where('wilaya_code', '=', wilaya).executeTakeFirst();
  const v = livraison === 'domicile' ? f?.domicile : f?.point_relais;
  return v === null || v === undefined ? null : Number(v);
}

// ───────────── Création ─────────────

export interface SaisieCommande {
  client: { nom: string; telephone: string };
  wilaya: number;
  commune: string;
  livraison: ModeLivraison;
  adresse?: string;
  lignes: { varianteId: string; quantite: number }[];
  /** Frais de livraison en centimes. Absent : ceux de la grille de la wilaya. */
  frais?: number | null;
  note?: string;
  cle: string;
  /** Désignation de la ligne des frais sur les documents (« Livraison »), dans la langue du commerçant. */
  libelleLivraison: string;
  origine?: 'manuel' | 'boutique';
  /** Ticket de la boutique : statut « nouvelle », réservation limitée dans le temps, lien privé (empreinte). */
  ticket?: { hash: string; reservationJusqua: Date };
}

async function historiser(trx: Trx, ctx: Contexte, commandeId: string, evenement: 'creee' | 'appel_sans_reponse' | 'statut' | 'modifiee' | 'expiree', ancien?: StatutCommande, nouveau?: StatutCommande) {
  await trx
    .insertInto('historique_commande')
    .values({ commercant_id: ctx.commercantId, commande_id: commandeId, evenement, ancien_statut: ancien ?? null, nouveau_statut: nouveau ?? null, auteur: ctx.utilisateurId })
    .execute();
}

/**
 * Commande saisie à la main (ou arrivée de la boutique) : crée le devis avec les articles et les frais
 * de livraison, réserve le stock, et enregistre la commande « à confirmer ».
 */
export async function creerCommande(trx: Trx, ctx: Contexte, s: SaisieCommande): Promise<Resultat<{ id: string; doublon?: boolean }>> {
  const deja = await trx.selectFrom('commandes').select('id').where('cle', '=', s.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id, doublon: true };
  const nom = s.client.nom.trim().slice(0, 120);
  if (!nom) return { ok: false, raison: 'client_requis' };
  if (!s.client.telephone.trim()) return { ok: false, raison: 'telephone_requis' };
  const telephone = normaliserTelephone(s.client.telephone);
  if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  const wilaya = await trx.selectFrom('wilayas').select(['code', 'nom_fr', 'nom_ar']).where('code', '=', s.wilaya).where('active', '=', true).executeTakeFirst();
  if (!wilaya) return { ok: false, raison: 'wilaya_invalide' };
  const saisie = s.commune.trim().slice(0, 80);
  if (!saisie) return { ok: false, raison: 'commune_requise' };
  const commune = await communeOfficielle(trx, wilaya.code, saisie);
  if (!commune) return { ok: false, raison: 'commune_invalide' };
  if (!s.lignes.length) return { ok: false, raison: 'panier_vide' };
  const frais = s.frais ?? (await fraisPour(trx, s.wilaya, s.livraison)) ?? 0;
  if (!montantValide(frais)) return { ok: false, raison: 'montant_invalide' };
  const adresse = (s.adresse ?? '').trim().slice(0, 200);

  const acheteur: Mentions = { nom, telephone, adresse: [adresse, commune, `${wilaya.code} ${wilaya.nom_fr}`].filter(Boolean).join(', ') };
  const lignes = [
    ...s.lignes.map((l) => ({ varianteId: l.varianteId, quantite: l.quantite })),
    ...(frais > 0 ? [{ designation: s.libelleLivraison, quantite: 1, prixUnitaire: frais }] : []),
  ];
  const d = await creerDocument(trx, ctx, { type: 'devis', origine: s.origine ?? 'manuel', lignes, acheteur, stock: 'reserver', note: s.note });
  if (!d.ok) {
    const r = d.raison;
    return { ok: false, raison: r === 'stock_reserve' ? 'stock_insuffisant' : r === 'designation_requise' ? 'panier_vide' : (r as RefusCommande) };
  }
  const devis = await trx.selectFrom('documents').select('client_id').where('id', '=', d.id).executeTakeFirstOrThrow();
  const annee = anneeAlger();
  const id = crypto.randomUUID();
  await trx
    .insertInto('commandes')
    .values({
      id, commercant_id: ctx.commercantId, annee, numero: await prochainNumero(trx, ctx.commercantId, 'commande', annee),
      statut: s.ticket ? 'nouvelle' : 'a_confirmer', origine: s.origine ?? 'manuel', devis_id: d.id, client_id: devis.client_id!,
      ticket_hash: s.ticket?.hash ?? null, reservation_jusqua: s.ticket?.reservationJusqua ?? null,
      livraison: s.livraison, wilaya_code: wilaya.code, commune,
      adresse_chiffre: adresse ? chiffrer(adresse, `commandes.adresse:${id}`) : null,
      frais_livraison: frais, note: (s.note ?? '').trim().slice(0, 500), cle: s.cle, cree_par: ctx.utilisateurId,
    })
    .execute();
  await historiser(trx, ctx, id, 'creee', undefined, s.ticket ? 'nouvelle' : 'a_confirmer');
  return { ok: true, id };
}

// ───────────── Changements de statut ─────────────

async function commandeVerrouillee(trx: Trx, id: string) {
  return trx.selectFrom('commandes').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
}

async function changerStatut(trx: Trx, ctx: Contexte, id: string, ancien: StatutCommande, nouveau: StatutCommande, valeurs: Record<string, unknown> = {}) {
  await trx.updateTable('commandes').set({ ...valeurs, statut: nouveau }).where('id', '=', id).execute();
  await historiser(trx, ctx, id, 'statut', ancien, nouveau);
}

/** « Pas de réponse » : une tentative d'appel de plus. */
export async function noterAppel(trx: Trx, ctx: Contexte, id: string): Promise<Resultat<{ tentatives: number }>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (!A_CONFIRMER.includes(c.statut)) return { ok: false, raison: 'statut_invalide' };
  const tentatives = c.tentatives_appel + 1;
  await trx.updateTable('commandes').set({ tentatives_appel: tentatives, dernier_appel_le: new Date(), statut: 'a_confirmer' }).where('id', '=', id).execute();
  await historiser(trx, ctx, id, 'appel_sans_reponse');
  return { ok: true, tentatives };
}

/**
 * Le client a dit oui. Une seule question : « Envoi » ou « Vente directe ».
 * Le devis devient une facture ; la réservation du devis passe à la facture (envoi) ou le stock sort (vente directe).
 */
export async function confirmerCommande(trx: Trx, ctx: Contexte, id: string, mode: 'envoi' | 'directe', cle: string): Promise<Resultat<{ factureId: string }>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.facture_id && c.statut !== 'a_confirmer' && c.statut !== 'nouvelle') return { ok: true, factureId: c.facture_id };
  if (!A_CONFIRMER.includes(c.statut)) return { ok: false, raison: 'statut_invalide' };
  const r = await transformer(trx, ctx, c.devis_id, 'facture', { mode, cle, depuisCommande: true });
  if (!r.ok) return { ok: false, raison: r.raison === 'stock_reserve' ? 'stock_insuffisant' : r.raison === 'deja_transforme' ? 'statut_invalide' : (r.raison as RefusCommande) };
  const nouveau: StatutCommande = mode === 'envoi' ? 'confirmee' : 'livree';
  await changerStatut(trx, ctx, id, c.statut, nouveau, { facture_id: r.id, ...(mode === 'directe' ? { livree_le: new Date() } : {}) });
  return { ok: true, factureId: r.id };
}

/** Le colis est prêt (articles rassemblés et emballés). */
export async function marquerPreparee(trx: Trx, ctx: Contexte, id: string): Promise<Resultat<object>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.statut === 'preparee') return { ok: true };
  if (c.statut !== 'confirmee') return { ok: false, raison: 'statut_invalide' };
  await changerStatut(trx, ctx, id, c.statut, 'preparee');
  return { ok: true };
}

/**
 * Remis au transporteur : le stock réservé sort pour de bon (libération puis vente, rattachées à la facture).
 * Transporteur et numéro de suivi sont saisis à la main ; un connecteur d'API pourra les remplir plus tard.
 */
export async function expedier(trx: Trx, ctx: Contexte, id: string, o: { transporteurId?: string | null; numeroSuivi?: string }): Promise<Resultat<object>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.statut === 'expediee') return { ok: true };
  if (!A_EXPEDIER.includes(c.statut) || !c.facture_id) return { ok: false, raison: 'statut_invalide' };
  if (o.transporteurId) {
    const t = await trx.selectFrom('transporteurs').select('id').where('id', '=', o.transporteurId).executeTakeFirst();
    if (!t) return { ok: false, raison: 'transporteur_invalide' };
  }
  for (const [varianteId, net] of await reservationsNettes(trx, c.facture_id)) {
    const a = await ajouterMouvement(trx, ctx, { varianteId, type: 'liberation', quantite: -net, documentId: c.facture_id });
    const b = await ajouterMouvement(trx, ctx, { varianteId, type: 'vente', quantite: -net, documentId: c.facture_id });
    // La réservation garantit le stock : un échec ici est une incohérence, on annule toute l'opération.
    if (a !== 'ok' || b !== 'ok') throw new Error('expedition_stock');
  }
  await changerStatut(trx, ctx, id, c.statut, 'expediee', {
    expediee_le: new Date(), transporteur_id: o.transporteurId || null, numero_suivi: (o.numeroSuivi ?? '').trim().slice(0, 60) || null,
  });
  return { ok: true };
}

/** Le client a reçu et payé : la facture est payée (paiement à la livraison). */
export async function marquerLivree(trx: Trx, ctx: Contexte, id: string): Promise<Resultat<object>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.statut === 'livree') return { ok: true };
  if (c.statut !== 'expediee' || !c.facture_id) return { ok: false, raison: 'statut_invalide' };
  const maintenant = new Date();
  // La somme reçue par le livreur est notée comme un paiement « à la livraison » (hors caisse du jour).
  const solde = await soldeDocument(trx, c.facture_id);
  if (solde && solde.reste > 0) {
    await trx.insertInto('paiements').values({ commercant_id: ctx.commercantId, document_id: c.facture_id, montant: solde.reste, mode: 'a_la_livraison', cree_par: ctx.utilisateurId }).execute();
  }
  await trx.updateTable('documents').set({ paye_le: maintenant, mode_paiement: 'a_la_livraison' }).where('id', '=', c.facture_id).where('paye_le', 'is', null).execute();
  await changerStatut(trx, ctx, id, c.statut, 'livree', { livree_le: maintenant });
  return { ok: true };
}

/** Le colis revient : la facture est annulée par un avoir et les articles retournent en stock. */
export async function marquerRetournee(trx: Trx, ctx: Contexte, id: string, cle: string): Promise<Resultat<{ avoirId: string }>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.statut === 'retournee' && c.avoir_id) return { ok: true, avoirId: c.avoir_id };
  if (c.statut !== 'expediee' || !c.facture_id) return { ok: false, raison: 'statut_invalide' };
  const a = await creerAvoir(trx, ctx, c.facture_id, { remettreEnStock: true, cle });
  if (!a.ok) return { ok: false, raison: 'statut_invalide' };
  await changerStatut(trx, ctx, id, c.statut, 'retournee', { retournee_le: new Date(), avoir_id: a.id });
  return { ok: true, avoirId: a.id };
}

/**
 * Annulation avant l'expédition : le stock réservé est libéré.
 * Si la facture existe déjà (commande confirmée), elle est annulée par un avoir, jamais supprimée.
 */
export async function annulerCommande(trx: Trx, ctx: Contexte, id: string, cle: string): Promise<Resultat<object>> {
  const c = await commandeVerrouillee(trx, id);
  if (!c) return { ok: false, raison: 'introuvable' };
  if (c.statut === 'annulee') return { ok: true };
  if (A_CONFIRMER.includes(c.statut)) {
    await trx.updateTable('documents').set({ etat: 'refuse' }).where('id', '=', c.devis_id).where('etat', '=', 'en_attente').execute();
    await libererReservations(trx, ctx, c.devis_id);
    await changerStatut(trx, ctx, id, c.statut, 'annulee');
    return { ok: true };
  }
  if (A_EXPEDIER.includes(c.statut) && c.facture_id) {
    const a = await creerAvoir(trx, ctx, c.facture_id, { remettreEnStock: false, cle });
    if (!a.ok) return { ok: false, raison: 'statut_invalide' };
    await changerStatut(trx, ctx, id, c.statut, 'annulee', { avoir_id: a.id });
    return { ok: true };
  }
  return { ok: false, raison: 'statut_invalide' };
}

// ───────────── Alertes et lectures ─────────────

export interface Alerte {
  retours: number;
  annulations: number;
}

/** Commandes déjà retournées ou annulées par ce client chez ce commerçant (jamais chez un autre). */
export async function alerteClient(trx: Trx, clientId: string, sauf?: string): Promise<Alerte> {
  let q = trx
    .selectFrom('commandes')
    .select([
      sql<number>`count(*) FILTER (WHERE statut = 'retournee')::int`.as('retours'),
      sql<number>`count(*) FILTER (WHERE statut = 'annulee')::int`.as('annulations'),
    ])
    .where('client_id', '=', clientId);
  if (sauf) q = q.where('id', '<>', sauf);
  const r = await q.executeTakeFirstOrThrow();
  return { retours: r.retours, annulations: r.annulations };
}

/** Même contrôle à partir d'un numéro tapé (avant de créer la commande). */
export async function alerteTelephone(trx: Trx, saisie: string): Promise<Alerte | null> {
  const tel = normaliserTelephone(saisie);
  if (!tel) return null;
  const client = await trx.selectFrom('clients').select('id').where('telephone_hmac', '=', empreinte(tel, 'clients.telephone')).executeTakeFirst();
  return client ? alerteClient(trx, client.id) : { retours: 0, annulations: 0 };
}

export const aAlerte = (a: Alerte | null | undefined) => !!a && a.retours + a.annulations > 0;

export interface LigneCommande {
  id: string;
  annee: number;
  numero: number;
  statut: StatutCommande;
  client: string;
  wilaya_code: number;
  commune: string;
  total: string;
  tentatives_appel: number;
  cree_le: Date;
  retours: number;
}

export type FiltreCommandes = 'a_confirmer' | 'a_expedier' | 'en_cours' | 'terminees' | 'toutes';
const FILTRES: Record<FiltreCommandes, readonly StatutCommande[]> = {
  a_confirmer: A_CONFIRMER,
  a_expedier: A_EXPEDIER,
  en_cours: ['expediee'],
  terminees: ['livree', 'retournee', 'annulee'],
  toutes: STATUTS,
};

export async function listerCommandes(trx: Trx, o: { filtre: FiltreCommandes; recherche?: string; clientId?: string; limite: number }): Promise<LigneCommande[]> {
  let q = trx
    .selectFrom('commandes as c')
    .innerJoin('clients as cl', 'cl.id', 'c.client_id')
    .innerJoin('documents as d', 'd.id', 'c.devis_id')
    .select(['c.id', 'c.annee', 'c.numero', 'c.statut', 'cl.nom as client', 'c.wilaya_code', 'c.commune', 'd.total', 'c.tentatives_appel', 'c.cree_le'])
    .select((eb) =>
      eb.selectFrom('commandes as r').select(sql<number>`count(*)::int`.as('n')).whereRef('r.client_id', '=', 'c.client_id').whereRef('r.id', '<>', 'c.id').where('r.statut', 'in', ['retournee', 'annulee']).as('retours'),
    )
    .where('c.statut', 'in', [...FILTRES[o.filtre]]);
  if (o.clientId) q = q.where('c.client_id', '=', o.clientId);
  const r = (o.recherche ?? '').trim();
  if (r) {
    const tel = normaliserTelephone(r);
    const numero = /^\d{1,6}$/.test(r.replace(/^.*-/, '')) && !tel ? Number(r.replace(/^.*-/, '')) : null;
    q = q.where((eb) =>
      eb.or([
        eb('cl.nom', 'ilike', `%${r.replace(/[%_\\]/g, '\\$&')}%`),
        ...(tel ? [eb('cl.telephone_hmac', '=', empreinte(tel, 'clients.telephone'))] : []),
        ...(numero ? [eb('c.numero', '=', numero)] : []),
      ]),
    );
  }
  const lignes = await q.orderBy('c.cree_le', 'desc').limit(o.limite).execute();
  return lignes.map((l) => ({ ...l, retours: Number(l.retours ?? 0) }));
}

export async function compterParFiltre(trx: Trx): Promise<Record<'a_confirmer' | 'a_expedier' | 'en_cours', number>> {
  const r = await trx.selectFrom('commandes').select(['statut', sql<number>`count(*)::int`.as('n')]).where('statut', 'in', [...A_CONFIRMER, ...A_EXPEDIER, 'expediee']).groupBy('statut').execute();
  const n = (s: readonly StatutCommande[]) => r.filter((l) => s.includes(l.statut)).reduce((t, l) => t + l.n, 0);
  return { a_confirmer: n(A_CONFIRMER), a_expedier: n(A_EXPEDIER), en_cours: n(['expediee']) };
}

export interface DocLie {
  id: string;
  type: TypeDocument;
  annee: number;
  numero: number;
}

export interface CommandeComplete {
  id: string;
  annee: number;
  numero: number;
  statut: StatutCommande;
  origine: 'manuel' | 'boutique';
  client: { id: string; nom: string; telephone: string | null };
  livraison: ModeLivraison;
  wilaya: { code: number; nom_fr: string; nom_ar: string };
  commune: string;
  adresse: string | null;
  frais: number;
  total: number;
  tentatives: number;
  dernierAppel: Date | null;
  reservationJusqua: Date | null;
  transporteur: string | null;
  numeroSuivi: string | null;
  expedieeLe: Date | null;
  livreeLe: Date | null;
  retourneeLe: Date | null;
  note: string;
  creeLe: Date;
  devis: DocLie;
  facture: (DocLie & { payeLe: Date | null }) | null;
  avoir: DocLie | null;
  lignes: { varianteId: string | null; designation: string; quantite: number; totalTtc: number }[];
  historique: { evenement: string; ancien: StatutCommande | null; nouveau: StatutCommande | null; auteur: string; le: Date }[];
  alerte: Alerte;
}

export async function lireCommande(trx: Trx, id: string): Promise<CommandeComplete | null> {
  const c = await trx
    .selectFrom('commandes as c')
    .innerJoin('clients as cl', 'cl.id', 'c.client_id')
    .innerJoin('wilayas as w', 'w.code', 'c.wilaya_code')
    .innerJoin('documents as dv', 'dv.id', 'c.devis_id')
    .leftJoin('documents as f', 'f.id', 'c.facture_id')
    .leftJoin('documents as av', 'av.id', 'c.avoir_id')
    .leftJoin('transporteurs as t', 't.id', 'c.transporteur_id')
    .select([
      'c.id', 'c.annee', 'c.numero', 'c.statut', 'c.origine', 'c.livraison', 'c.commune', 'c.adresse_chiffre', 'c.frais_livraison', 'c.tentatives_appel',
      'c.dernier_appel_le', 'c.reservation_jusqua', 'c.numero_suivi', 'c.expediee_le', 'c.livree_le', 'c.retournee_le', 'c.note', 'c.cree_le',
      'cl.id as client_id', 'cl.nom as client_nom', 'cl.telephone_chiffre',
      'w.code as w_code', 'w.nom_fr as w_fr', 'w.nom_ar as w_ar',
      'dv.id as dv_id', 'dv.annee as dv_annee', 'dv.numero as dv_numero', 'dv.total as dv_total',
      'f.id as f_id', 'f.annee as f_annee', 'f.numero as f_numero', 'f.total as f_total', 'f.paye_le as f_paye',
      'av.id as av_id', 'av.annee as av_annee', 'av.numero as av_numero',
      't.nom as transporteur',
    ])
    .where('c.id', '=', id)
    .executeTakeFirst();
  if (!c) return null;
  const docLignes = await trx
    .selectFrom('lignes_document')
    .select(['variante_id', 'designation', 'quantite', 'total_ttc'])
    .where('document_id', '=', c.f_id ?? c.dv_id)
    .orderBy('ordre')
    .execute();
  const historique = await trx
    .selectFrom('historique_commande as h')
    .innerJoin('utilisateurs as u', 'u.id', 'h.auteur')
    .select(['h.evenement', 'h.ancien_statut', 'h.nouveau_statut', 'u.nom as auteur', 'h.le'])
    .where('h.commande_id', '=', id)
    .orderBy('h.le', 'desc')
    .orderBy('h.id', 'desc')
    .execute();
  return {
    id: c.id, annee: c.annee, numero: c.numero, statut: c.statut, origine: c.origine,
    client: { id: c.client_id, nom: c.client_nom, telephone: dechiffrerOuNul(c.telephone_chiffre, `clients.telephone:${c.client_id}`) },
    livraison: c.livraison, wilaya: { code: c.w_code, nom_fr: c.w_fr, nom_ar: c.w_ar }, commune: c.commune,
    adresse: c.adresse_chiffre ? dechiffrer(c.adresse_chiffre, `commandes.adresse:${id}`) : null,
    frais: Number(c.frais_livraison), total: Number(c.f_total ?? c.dv_total), tentatives: c.tentatives_appel, dernierAppel: c.dernier_appel_le, reservationJusqua: c.reservation_jusqua,
    transporteur: c.transporteur, numeroSuivi: c.numero_suivi, expedieeLe: c.expediee_le, livreeLe: c.livree_le, retourneeLe: c.retournee_le,
    note: c.note, creeLe: c.cree_le,
    devis: { id: c.dv_id, type: 'devis', annee: c.dv_annee, numero: c.dv_numero },
    facture: c.f_id ? { id: c.f_id, type: 'facture', annee: c.f_annee!, numero: c.f_numero!, payeLe: c.f_paye ?? null } : null,
    avoir: c.av_id ? { id: c.av_id, type: 'avoir', annee: c.av_annee!, numero: c.av_numero! } : null,
    lignes: docLignes.map((l) => ({ varianteId: l.variante_id, designation: l.designation, quantite: l.quantite, totalTtc: Number(l.total_ttc) })),
    historique: historique.map((h) => ({ evenement: h.evenement, ancien: h.ancien_statut, nouveau: h.nouveau_statut, auteur: h.auteur, le: h.le })),
    alerte: await alerteClient(trx, c.client_id, id),
  };
}

/** Commande liée à un document (devis, facture ou avoir), pour le lien « Voir la commande ». */
export async function commandeDuDocument(trx: Trx, documentId: string): Promise<{ id: string; annee: number; numero: number } | null> {
  return (
    (await trx
      .selectFrom('commandes')
      .select(['id', 'annee', 'numero'])
      .where((eb) => eb.or([eb('devis_id', '=', documentId), eb('facture_id', '=', documentId), eb('avoir_id', '=', documentId)]))
      .executeTakeFirst()) ?? null
  );
}

/**
 * Tickets de la boutique non confirmés à temps : le devis passe « expiré », le stock réservé est libéré,
 * la commande est annulée. Appelé avant chaque lecture qui dépend du stock disponible, et par la tâche périodique.
 */
export async function expirerTickets(trx: Trx, ctx: Contexte): Promise<number> {
  const perimees = await trx
    .selectFrom('commandes')
    .select(['id', 'devis_id'])
    .where('statut', '=', 'nouvelle')
    .where('reservation_jusqua', '<', new Date())
    .forUpdate()
    .skipLocked()
    .execute();
  for (const c of perimees) {
    await trx.updateTable('documents').set({ etat: 'expire' }).where('id', '=', c.devis_id).where('etat', '=', 'en_attente').execute();
    await libererReservations(trx, ctx, c.devis_id);
    await trx.updateTable('commandes').set({ statut: 'annulee' }).where('id', '=', c.id).execute();
    await historiser(trx, ctx, c.id, 'expiree', 'nouvelle', 'annulee');
  }
  return perimees.length;
}
