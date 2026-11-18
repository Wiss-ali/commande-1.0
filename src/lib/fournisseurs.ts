// Fournisseurs, arrivages de marchandise et paiements aux fournisseurs.
// Un arrivage fait entrer le stock (un mouvement par article, relié à l'arrivage) et met à jour le prix d'achat
// au coût moyen pondéré. Ce qui est dû à chaque fournisseur se calcule : arrivages moins paiements.
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { caisseOuverte, prochainNumero } from './documents.ts';
import { normaliserTelephone } from './formats.ts';
import { ajouterMouvement, type Contexte } from './stock.ts';
import { MODES_ENCAISSEMENT, type ModeEncaissement } from './types-bd.ts';

export type RefusFournisseur = 'nom_requis' | 'telephone_invalide' | 'introuvable' | 'panier_vide' | 'quantite_invalide' | 'montant_invalide' | 'paiement_invalide' | 'fournisseur_requis';
type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: RefusFournisseur };

const MAX_MONTANT = 100_000_000_00;
const entier = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const propre = (s: string | undefined, max: number) => (s ?? '').trim().slice(0, max);

/**
 * Coût moyen pondéré : (stock × ancien prix + quantité reçue × prix payé) ÷ (stock + quantité).
 * Un stock négatif ou nul ne compte pas : le prix payé devient alors le prix d'achat.
 */
export function coutMoyen(stock: number, prixActuel: number, quantite: number, prixPaye: number): number {
  const s = Math.max(0, stock);
  return Math.round((s * prixActuel + quantite * prixPaye) / (s + quantite));
}

// ───────────── Fournisseurs ─────────────

export async function enregistrerFournisseur(trx: Trx, ctx: Contexte, f: { id?: string; nom: string; telephone?: string; note?: string }): Promise<Resultat<{ id: string }>> {
  const nom = propre(f.nom, 120);
  if (!nom) return { ok: false, raison: 'nom_requis' };
  let telephone: string | null = null;
  if (f.telephone?.trim()) {
    telephone = normaliserTelephone(f.telephone);
    if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  }
  const valeurs = { nom, telephone, note: propre(f.note, 300) };
  if (f.id) {
    const r = await trx.updateTable('fournisseurs').set(valeurs).where('id', '=', f.id).executeTakeFirst();
    return r.numUpdatedRows ? { ok: true, id: f.id } : { ok: false, raison: 'introuvable' };
  }
  const { id } = await trx.insertInto('fournisseurs').values({ commercant_id: ctx.commercantId, ...valeurs }).returning('id').executeTakeFirstOrThrow();
  return { ok: true, id };
}

export async function archiverFournisseur(trx: Trx, id: string, archiver: boolean): Promise<void> {
  await trx.updateTable('fournisseurs').set({ archive_le: archiver ? new Date() : null }).where('id', '=', id).execute();
}

/** Ce qui est dû : arrivages moins paiements (négatif : une avance au fournisseur). */
const du = sql<string>`coalesce((SELECT sum(a.total) FROM arrivages a WHERE a.fournisseur_id = f.id), 0)
  - coalesce((SELECT sum(p.montant) FROM paiements_fournisseurs p WHERE p.fournisseur_id = f.id), 0)`;

export interface LigneFournisseur {
  id: string;
  nom: string;
  telephone: string | null;
  du: number;
  archive: boolean;
}

export async function listerFournisseurs(trx: Trx, o: { archives?: boolean } = {}): Promise<LigneFournisseur[]> {
  const r = await trx
    .selectFrom('fournisseurs as f')
    .select(['f.id', 'f.nom', 'f.telephone', 'f.archive_le', du.as('du')])
    .where('f.archive_le', o.archives ? 'is not' : 'is', null)
    .orderBy('f.nom')
    .execute();
  return r.map((l) => ({ id: l.id, nom: l.nom, telephone: l.telephone, du: Number(l.du), archive: !!l.archive_le }));
}

/** Total dû à tous les fournisseurs (les avances ne s'en déduisent pas). */
export async function totalDuFournisseurs(trx: Trx): Promise<number> {
  const r = await sql<{ total: string }>`SELECT coalesce(sum(greatest(d, 0)), 0) AS total FROM (SELECT ${du} AS d FROM fournisseurs f) t`.execute(trx);
  return Number(r.rows[0]!.total);
}

export interface FicheFournisseur extends LigneFournisseur {
  note: string;
  arrivages: { id: string; numero: number; reference: string; recuLe: Date; total: number }[];
  paiements: { id: string; montant: number; mode: ModeEncaissement; reference: string; creeLe: Date; arrivageNumero: number | null }[];
}

export async function lireFournisseur(trx: Trx, id: string): Promise<FicheFournisseur | null> {
  const f = await trx.selectFrom('fournisseurs as f').select(['f.id', 'f.nom', 'f.telephone', 'f.note', 'f.archive_le', du.as('du')]).where('f.id', '=', id).executeTakeFirst();
  if (!f) return null;
  const arrivages = await trx.selectFrom('arrivages').select(['id', 'numero', 'reference', 'recu_le', 'total']).where('fournisseur_id', '=', id).orderBy('recu_le', 'desc').orderBy('numero', 'desc').limit(100).execute();
  const paiements = await trx
    .selectFrom('paiements_fournisseurs as p')
    .leftJoin('arrivages as a', 'a.id', 'p.arrivage_id')
    .select(['p.id', 'p.montant', 'p.mode', 'p.reference', 'p.cree_le', 'a.numero'])
    .where('p.fournisseur_id', '=', id)
    .orderBy('p.cree_le', 'desc')
    .limit(100)
    .execute();
  return {
    id: f.id, nom: f.nom, telephone: f.telephone, note: f.note, du: Number(f.du), archive: !!f.archive_le,
    arrivages: arrivages.map((a) => ({ id: a.id, numero: a.numero, reference: a.reference, recuLe: a.recu_le, total: Number(a.total) })),
    paiements: paiements.map((p) => ({ id: p.id, montant: Number(p.montant), mode: p.mode, reference: p.reference, creeLe: p.cree_le, arrivageNumero: p.numero })),
  };
}

// ───────────── Paiements ─────────────

export interface PaiementFournisseur {
  montant: number;
  mode: ModeEncaissement;
  reference?: string;
}

async function enregistrerPaiement(trx: Trx, ctx: Contexte, fournisseurId: string, p: PaiementFournisseur, o: { arrivageId?: string; cle?: string }) {
  // En espèces : la somme sort de la caisse ouverte (elle compte à la clôture).
  const session = p.mode === 'especes' ? await caisseOuverte(trx, ctx) : null;
  await trx.insertInto('paiements_fournisseurs').values({
    commercant_id: ctx.commercantId, fournisseur_id: fournisseurId, arrivage_id: o.arrivageId ?? null, montant: p.montant, mode: p.mode,
    reference: propre(p.reference, 60), session_caisse_id: session, cree_par: ctx.utilisateurId, cle: o.cle ?? null,
  }).execute();
}

/** Argent versé à un fournisseur, pour un arrivage ou sur son compte. La même clé ne paie jamais deux fois. */
export async function payerFournisseur(trx: Trx, ctx: Contexte, fournisseurId: string, p: PaiementFournisseur & { cle: string }): Promise<Resultat<object>> {
  const deja = await trx.selectFrom('paiements_fournisseurs').select('id').where('cle', '=', p.cle).executeTakeFirst();
  if (deja) return { ok: true };
  if (!entier(p.montant, 1, MAX_MONTANT) || !MODES_ENCAISSEMENT.includes(p.mode)) return { ok: false, raison: 'paiement_invalide' };
  const f = await trx.selectFrom('fournisseurs').select('id').where('id', '=', fournisseurId).executeTakeFirst();
  if (!f) return { ok: false, raison: 'introuvable' };
  await enregistrerPaiement(trx, ctx, fournisseurId, p, { cle: p.cle });
  return { ok: true };
}

// ───────────── Arrivages ─────────────

export interface NouvelArrivage {
  fournisseurId: string | null;
  reference?: string;
  /** « AAAA-MM-JJ » ; aujourd'hui par défaut. */
  recuLe?: string;
  lignes: { varianteId: string; quantite: number; coutUnitaire: number }[];
  note?: string;
  /** Somme payée tout de suite (le reste est dû au fournisseur). */
  paye?: PaiementFournisseur | null;
  cle: string;
}

/**
 * Enregistre un arrivage en une seule transaction : numéro, lignes, entrée en stock de chaque article (reliée à
 * l'arrivage), nouveau prix d'achat au coût moyen pondéré, et paiement éventuel. Rien n'est écrit si une ligne est fausse.
 */
export async function creerArrivage(trx: Trx, ctx: Contexte, a: NouvelArrivage): Promise<Resultat<{ id: string; doublon?: boolean }>> {
  const deja = await trx.selectFrom('arrivages').select('id').where('cle', '=', a.cle).executeTakeFirst();
  if (deja) return { ok: true, id: deja.id, doublon: true };
  if (!a.lignes.length || a.lignes.length > 200) return { ok: false, raison: 'panier_vide' };
  for (const l of a.lignes) {
    if (!entier(l.quantite, 1, 100_000)) return { ok: false, raison: 'quantite_invalide' };
    if (!entier(l.coutUnitaire, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  }
  if (a.fournisseurId) {
    const f = await trx.selectFrom('fournisseurs').select('id').where('id', '=', a.fournisseurId).executeTakeFirst();
    if (!f) return { ok: false, raison: 'introuvable' };
  }
  const ids = [...new Set(a.lignes.map((l) => l.varianteId))];
  const fiches = await trx.selectFrom('variantes as v').innerJoin('stocks as s', 's.variante_id', 'v.id').select(['v.id', 'v.prix_achat', 's.quantite']).where('v.id', 'in', ids).execute();
  if (fiches.length !== ids.length) return { ok: false, raison: 'introuvable' };
  const total = a.lignes.reduce((s, l) => s + l.quantite * l.coutUnitaire, 0);
  if (!entier(total, 0, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
  if (a.paye) {
    // Un paiement se rattache à un fournisseur : sans fournisseur, l'achat n'est pas suivi dans les dettes.
    if (!a.fournisseurId) return { ok: false, raison: 'fournisseur_requis' };
    if (!entier(a.paye.montant, 1, MAX_MONTANT) || !MODES_ENCAISSEMENT.includes(a.paye.mode)) return { ok: false, raison: 'paiement_invalide' };
  }
  const recuLe = a.recuLe && /^\d{4}-\d{2}-\d{2}$/.test(a.recuLe) && !Number.isNaN(Date.parse(a.recuLe)) ? a.recuLe : undefined;

  // Un seul compteur par commerçant pour les arrivages (année 0).
  const numero = await prochainNumero(trx, ctx.commercantId, 'arrivage', 0);
  const { id } = await trx.insertInto('arrivages').values({
    commercant_id: ctx.commercantId, numero, fournisseur_id: a.fournisseurId, reference: propre(a.reference, 60), ...(recuLe ? { recu_le: recuLe } : {}),
    total, note: propre(a.note, 300), cree_par: ctx.utilisateurId, cle: a.cle,
  }).returning('id').executeTakeFirstOrThrow();
  await trx.insertInto('lignes_arrivage').values(a.lignes.map((l) => ({ commercant_id: ctx.commercantId, arrivage_id: id, variante_id: l.varianteId, quantite: l.quantite, cout_unitaire: l.coutUnitaire }))).execute();

  // Prix d'achat au coût moyen pondéré, ligne après ligne (le même article peut être sur deux lignes).
  const etat = new Map(fiches.map((f) => [f.id, { stock: f.quantite, prix: Number(f.prix_achat) }]));
  for (const l of a.lignes) {
    const e = etat.get(l.varianteId)!;
    e.prix = coutMoyen(e.stock, e.prix, l.quantite, l.coutUnitaire);
    e.stock += l.quantite;
    const r = await ajouterMouvement(trx, ctx, { varianteId: l.varianteId, type: 'entree', motif: 'achat', quantite: l.quantite, coutUnitaire: l.coutUnitaire, arrivageId: id });
    if (r !== 'ok') throw new Error(`arrivage_stock_${r}`);
  }
  for (const [varianteId, e] of etat) await trx.updateTable('variantes').set({ prix_achat: e.prix }).where('id', '=', varianteId).execute();
  if (a.paye && a.fournisseurId) await enregistrerPaiement(trx, ctx, a.fournisseurId, a.paye, { arrivageId: id });
  return { ok: true, id };
}

export interface ArrivageComplet {
  id: string;
  numero: number;
  fournisseur: { id: string; nom: string } | null;
  reference: string;
  recuLe: Date;
  total: number;
  note: string;
  creePar: string;
  creeLe: Date;
  paye: number;
  lignes: { varianteId: string; produitId: string; nomFr: string; nomAr: string; libelle: string; quantite: number; coutUnitaire: number }[];
}

export async function lireArrivage(trx: Trx, id: string): Promise<ArrivageComplet | null> {
  const a = await trx
    .selectFrom('arrivages as a')
    .leftJoin('fournisseurs as f', 'f.id', 'a.fournisseur_id')
    .innerJoin('utilisateurs as u', 'u.id', 'a.cree_par')
    .select(['a.id', 'a.numero', 'a.reference', 'a.recu_le', 'a.total', 'a.note', 'a.cree_le', 'f.id as f_id', 'f.nom as f_nom', 'u.nom as cree_par'])
    .select(sql<string>`coalesce((SELECT sum(p.montant) FROM paiements_fournisseurs p WHERE p.arrivage_id = a.id), 0)`.as('paye'))
    .where('a.id', '=', id)
    .executeTakeFirst();
  if (!a) return null;
  const lignes = await trx
    .selectFrom('lignes_arrivage as l')
    .innerJoin('variantes as v', 'v.id', 'l.variante_id')
    .innerJoin('produits as p', 'p.id', 'v.produit_id')
    .select(['l.variante_id', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'l.quantite', 'l.cout_unitaire'])
    .where('l.arrivage_id', '=', id)
    .execute();
  return {
    id: a.id, numero: a.numero, fournisseur: a.f_id ? { id: a.f_id, nom: a.f_nom! } : null, reference: a.reference, recuLe: a.recu_le, total: Number(a.total),
    note: a.note, creePar: a.cree_par, creeLe: a.cree_le, paye: Number(a.paye),
    lignes: lignes.map((l) => ({ varianteId: l.variante_id, produitId: l.produit_id, nomFr: l.nom_fr, nomAr: l.nom_ar, libelle: l.libelle, quantite: l.quantite, coutUnitaire: Number(l.cout_unitaire) })),
  };
}

export async function listerArrivages(trx: Trx, limite = 50) {
  const r = await trx
    .selectFrom('arrivages as a')
    .leftJoin('fournisseurs as f', 'f.id', 'a.fournisseur_id')
    .select(['a.id', 'a.numero', 'a.reference', 'a.recu_le', 'a.total', 'f.nom as fournisseur'])
    .orderBy('a.recu_le', 'desc').orderBy('a.numero', 'desc')
    .limit(limite)
    .execute();
  return r.map((a) => ({ id: a.id, numero: a.numero, reference: a.reference, recuLe: a.recu_le, total: Number(a.total), fournisseur: a.fournisseur }));
}
