// Dépenses du magasin (loyer, électricité, salaires…) et versements du transporteur.
// Une dépense payée avec l'argent de la caisse ouverte diminue les espèces attendues à la clôture.
// Un versement regroupe des colis livrés : la somme reçue, et l'écart (frais retenus par le transporteur).
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { caisseOuverte } from './documents.ts';
import type { Periode } from './rapports.ts';
import type { Contexte } from './stock.ts';
import { CATEGORIES_DEPENSE, MODES_ENCAISSEMENT, type CategorieDepense, type ModeEncaissement } from './types-bd.ts';

const MAX_MONTANT = 100_000_000_00;
const entier = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourValide = (j: string | undefined) => (j && JOUR.test(j) && !Number.isNaN(Date.parse(j)) ? j : undefined);

// ───────────── Dépenses ─────────────

export interface NouvelleDepense {
  categorie: CategorieDepense;
  libelle?: string;
  montant: number;
  /** « AAAA-MM-JJ » ; aujourd'hui par défaut. */
  depenseLe?: string;
  mode: ModeEncaissement;
  /** Payée avec l'argent de la caisse ouverte (espèces seulement). */
  parCaisse: boolean;
  cle: string;
}

export async function creerDepense(trx: Trx, ctx: Contexte, d: NouvelleDepense): Promise<{ ok: true; id: string } | { ok: false; raison: 'montant_invalide' | 'categorie_invalide' | 'paiement_invalide' }> {
  const deja = await trx.selectFrom('depenses').select('id').where('cle', '=', d.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id };
  if (!CATEGORIES_DEPENSE.includes(d.categorie)) return { ok: false, raison: 'categorie_invalide' };
  if (!entier(d.montant, 1, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  if (!MODES_ENCAISSEMENT.includes(d.mode) || (d.parCaisse && d.mode !== 'especes')) return { ok: false, raison: 'paiement_invalide' };
  const jour = jourValide(d.depenseLe);
  const { id } = await trx.insertInto('depenses').values({
    commercant_id: ctx.commercantId, categorie: d.categorie, libelle: (d.libelle ?? '').trim().slice(0, 120), montant: d.montant,
    ...(jour ? { depense_le: jour } : {}), mode: d.mode, session_caisse_id: d.parCaisse ? await caisseOuverte(trx, ctx) : null,
    cree_par: ctx.utilisateurId, cle: d.cle,
  }).returning('id').executeTakeFirstOrThrow();
  return { ok: true, id };
}

/** Annule une dépense saisie par erreur (trace gardée). Impossible après la clôture de sa caisse. */
export async function annulerDepense(trx: Trx, ctx: Contexte, id: string): Promise<{ ok: true } | { ok: false; raison: 'introuvable' | 'caisse_cloturee' }> {
  const d = await trx.selectFrom('depenses as d').leftJoin('sessions_caisse as s', 's.id', 'd.session_caisse_id').select(['d.annulee_le', 's.fermee_le']).where('d.id', '=', id).executeTakeFirst();
  if (!d || d.annulee_le) return { ok: false, raison: 'introuvable' };
  if (d.fermee_le) return { ok: false, raison: 'caisse_cloturee' };
  await trx.updateTable('depenses').set({ annulee_le: new Date(), annulee_par: ctx.utilisateurId }).where('id', '=', id).execute();
  return { ok: true };
}

export interface LigneDepense {
  id: string;
  categorie: CategorieDepense;
  libelle: string;
  montant: number;
  depenseLe: Date;
  mode: ModeEncaissement;
  parCaisse: boolean;
  caisseCloturee: boolean;
  annulee: boolean;
  auteur: string;
}

export async function listerDepenses(trx: Trx, p: Periode, o: { auteurId?: string } = {}): Promise<LigneDepense[]> {
  let q = trx
    .selectFrom('depenses as d')
    .innerJoin('utilisateurs as u', 'u.id', 'd.cree_par')
    .leftJoin('sessions_caisse as s', 's.id', 'd.session_caisse_id')
    .select(['d.id', 'd.categorie', 'd.libelle', 'd.montant', 'd.depense_le', 'd.mode', 'd.session_caisse_id', 'd.annulee_le', 's.fermee_le', 'u.nom'])
    .where(sql<boolean>`d.depense_le BETWEEN ${p.du}::date AND ${p.au}::date`);
  if (o.auteurId) q = q.where('d.cree_par', '=', o.auteurId);
  const r = await q.orderBy('d.depense_le', 'desc').orderBy('d.cree_le', 'desc').limit(300).execute();
  return r.map((d) => ({
    id: d.id, categorie: d.categorie, libelle: d.libelle, montant: Number(d.montant), depenseLe: d.depense_le, mode: d.mode,
    parCaisse: !!d.session_caisse_id, caisseCloturee: !!d.fermee_le, annulee: !!d.annulee_le, auteur: d.nom,
  }));
}

/** Total des dépenses d'une période (annulées exclues), et par catégorie. */
export async function totalDepenses(trx: Trx, p: Periode): Promise<{ total: number; parCategorie: { categorie: CategorieDepense; montant: number }[] }> {
  const r = await sql<{ categorie: CategorieDepense; montant: string }>`
    SELECT categorie, sum(montant) AS montant FROM depenses
    WHERE annulee_le IS NULL AND depense_le BETWEEN ${p.du}::date AND ${p.au}::date
    GROUP BY categorie ORDER BY sum(montant) DESC`.execute(trx);
  const parCategorie = r.rows.map((l) => ({ categorie: l.categorie, montant: Number(l.montant) }));
  return { total: parCategorie.reduce((s, l) => s + l.montant, 0), parCategorie };
}

// ───────────── Versements du transporteur ─────────────

export interface ColisAReverser {
  commandeId: string;
  numero: number;
  client: string;
  livreeLe: Date | null;
  transporteurId: string | null;
  transporteur: string | null;
  montant: number;
}

/** Colis livrés dont l'argent n'a pas encore été reversé par le transporteur. */
export async function colisAReverser(trx: Trx): Promise<ColisAReverser[]> {
  const r = await trx
    .selectFrom('commandes as c')
    .innerJoin('clients as cl', 'cl.id', 'c.client_id')
    .innerJoin('documents as f', 'f.id', 'c.facture_id')
    .leftJoin('transporteurs as t', 't.id', 'c.transporteur_id')
    .select(['c.id', 'c.numero', 'cl.nom', 'c.livree_le', 'c.transporteur_id', 't.nom as transporteur', 'f.total'])
    .where('c.statut', '=', 'livree')
    .where('c.versement_id', 'is', null)
    .orderBy('c.livree_le')
    .limit(500)
    .execute();
  return r.map((c) => ({ commandeId: c.id, numero: c.numero, client: c.nom, livreeLe: c.livree_le, transporteurId: c.transporteur_id, transporteur: c.transporteur, montant: Number(c.total) }));
}

export interface NouveauVersement {
  commandes: string[];
  recu: number;
  mode: ModeEncaissement;
  reference?: string;
  /** « AAAA-MM-JJ » ; aujourd'hui par défaut. */
  recuLe?: string;
  note?: string;
  cle: string;
}

/**
 * Enregistre un versement : les colis choisis (livrés, pas encore reversés) y sont rattachés, avec la somme
 * reçue. L'écart avec ce que les clients ont payé est gardé (frais retenus par le transporteur).
 */
export async function enregistrerVersement(trx: Trx, ctx: Contexte, v: NouveauVersement): Promise<{ ok: true; id: string; frais: number } | { ok: false; raison: 'colis_invalides' | 'montant_invalide' | 'paiement_invalide' }> {
  const deja = await trx.selectFrom('versements_transporteur').select(['id', 'attendu', 'recu']).where('cle', '=', v.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id, frais: Number(deja.attendu) - Number(deja.recu) };
  const ids = [...new Set(v.commandes)];
  if (!ids.length || ids.length > 500) return { ok: false, raison: 'colis_invalides' };
  if (!entier(v.recu, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  if (!MODES_ENCAISSEMENT.includes(v.mode)) return { ok: false, raison: 'paiement_invalide' };
  // Verrou sur les commandes : un même colis ne peut pas entrer dans deux versements.
  const colis = await trx
    .selectFrom('commandes as c')
    .innerJoin('documents as f', 'f.id', 'c.facture_id')
    .select(['c.id', 'c.transporteur_id', 'f.total'])
    .where('c.id', 'in', ids).where('c.statut', '=', 'livree').where('c.versement_id', 'is', null)
    .forUpdate('c')
    .execute();
  if (colis.length !== ids.length) return { ok: false, raison: 'colis_invalides' };
  const attendu = colis.reduce((s, c) => s + Number(c.total), 0);
  const transporteurs = [...new Set(colis.map((c) => c.transporteur_id).filter(Boolean))];
  const jour = jourValide(v.recuLe);
  const { id } = await trx.insertInto('versements_transporteur').values({
    commercant_id: ctx.commercantId, transporteur_id: transporteurs.length === 1 ? transporteurs[0]! : null, ...(jour ? { recu_le: jour } : {}),
    attendu, recu: v.recu, mode: v.mode, reference: (v.reference ?? '').trim().slice(0, 60), note: (v.note ?? '').trim().slice(0, 300), cree_par: ctx.utilisateurId, cle: v.cle,
  }).returning('id').executeTakeFirstOrThrow();
  await trx.updateTable('commandes').set({ versement_id: id }).where('id', 'in', ids).execute();
  return { ok: true, id, frais: attendu - v.recu };
}

export async function listerVersements(trx: Trx, limite = 50) {
  const r = await trx
    .selectFrom('versements_transporteur as v')
    .leftJoin('transporteurs as t', 't.id', 'v.transporteur_id')
    .select(['v.id', 'v.recu_le', 'v.attendu', 'v.recu', 'v.mode', 'v.reference', 't.nom as transporteur'])
    .select(sql<number>`(SELECT count(*) FROM commandes c WHERE c.versement_id = v.id)::int`.as('colis'))
    .orderBy('v.recu_le', 'desc').orderBy('v.cree_le', 'desc')
    .limit(limite)
    .execute();
  return r.map((v) => ({ id: v.id, recuLe: v.recu_le, attendu: Number(v.attendu), recu: Number(v.recu), mode: v.mode, reference: v.reference, transporteur: v.transporteur, colis: v.colis }));
}

/** Frais retenus par les transporteurs sur une période (date des versements) : un vrai coût de livraison. */
export async function fraisRetenus(trx: Trx, p: Periode): Promise<number> {
  const r = await sql<{ f: string }>`SELECT coalesce(sum(attendu - recu), 0) AS f FROM versements_transporteur WHERE recu_le BETWEEN ${p.du}::date AND ${p.au}::date`.execute(trx);
  return Number(r.rows[0]!.f);
}

