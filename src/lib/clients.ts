// Clients du commerçant : historique, total dépensé, taux de retour. Rien n'est recopié :
// tout est calculé à partir des documents et des commandes.
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { randomUUID } from 'node:crypto';
import { chiffrer, dechiffrerOuNul, empreinte } from './chiffrement.ts';
import { normaliserTelephone } from './formats.ts';
import type { TypeDocument } from './types-bd.ts';

export interface LigneClient {
  id: string;
  nom: string;
  commandes: number;
  /** Factures et tickets (achats en magasin ou par facture). */
  achats: number;
  depense: number;
  du: number;
  dernier: Date | null;
}

/** Total acheté par un client : ses factures et tickets, moins ce que les avoirs ont rendu. */
const depense = sql<string>`coalesce((SELECT sum(s.net) FROM soldes_documents s WHERE s.client_id = cl.id), 0)`;
/** Ce que le client doit encore (vente à crédit, facture à payer), hors colis payés à la livraison. */
const du = sql<string>`coalesce((SELECT sum(s.net - s.paye) FROM soldes_documents s WHERE s.client_id = cl.id
  AND (s.mode_vente IS NULL OR s.mode_vente <> 'envoi') AND s.net > s.paye), 0)`;

export async function listerClients(trx: Trx, o: { recherche?: string; limite: number }): Promise<LigneClient[]> {
  let q = trx
    .selectFrom('clients as cl')
    .select(['cl.id', 'cl.nom'])
    .select(sql<number>`(SELECT count(*) FROM commandes c WHERE c.client_id = cl.id)::int`.as('commandes'))
    .select(sql<number>`(SELECT count(*) FROM documents d WHERE d.client_id = cl.id AND d.type IN ('facture', 'ticket'))::int`.as('achats'))
    .select(depense.as('depense'))
    .select(du.as('du'))
    .select(sql<Date | null>`(SELECT max(d.emis_le) FROM documents d WHERE d.client_id = cl.id)`.as('dernier'));
  const r = (o.recherche ?? '').trim();
  if (r) {
    const tel = normaliserTelephone(r);
    q = tel ? q.where('cl.telephone_hmac', '=', empreinte(tel, 'clients.telephone')) : q.where('cl.nom', 'ilike', `%${r.replace(/[%_\\]/g, '\\$&')}%`);
  }
  const lignes = await q.orderBy(sql`(SELECT max(d.emis_le) FROM documents d WHERE d.client_id = cl.id)`, (ob) => ob.desc().nullsLast()).orderBy('cl.nom').limit(o.limite).execute();
  return lignes.map((l) => ({ ...l, depense: Number(l.depense), du: Number(l.du) }));
}

export interface FicheClient {
  id: string;
  nom: string;
  telephone: string | null;
  details: DetailsClient;
  note: string;
  creeLe: Date;
  depense: number;
  du: number;
  achats: number;
  commandes: number;
  livrees: number;
  retournees: number;
  annulees: number;
  /** Retours sur les colis arrivés au bout (livrés ou retournés), en pour cent ; null s'il n'y en a pas. */
  tauxRetour: number | null;
  supprimeLe: Date | null;
  documents: { id: string; type: TypeDocument; annee: number; numero: number; total: number; emisLe: Date; annule: boolean }[];
}

export async function lireClient(trx: Trx, id: string): Promise<FicheClient | null> {
  const c = await trx
    .selectFrom('clients as cl')
    .select(['cl.id', 'cl.nom', 'cl.telephone_chiffre', 'cl.details_chiffre', 'cl.note_chiffre', 'cl.cree_le', 'cl.supprime_le'])
    .select(depense.as('depense'))
    .select(du.as('du'))
    .where('cl.id', '=', id)
    .executeTakeFirst();
  if (!c) return null;
  const s = await trx
    .selectFrom('commandes')
    .select([
      sql<number>`count(*)::int`.as('total'),
      sql<number>`count(*) FILTER (WHERE statut = 'livree')::int`.as('livrees'),
      sql<number>`count(*) FILTER (WHERE statut = 'retournee')::int`.as('retournees'),
      sql<number>`count(*) FILTER (WHERE statut = 'annulee')::int`.as('annulees'),
    ])
    .where('client_id', '=', id)
    .executeTakeFirstOrThrow();
  const docs = await trx
    .selectFrom('documents as d')
    .select(['d.id', 'd.type', 'd.annee', 'd.numero', 'd.total', 'd.emis_le'])
    .select((eb) => eb.exists(eb.selectFrom('soldes_documents as s').select('s.document_id').whereRef('s.document_id', '=', 'd.id').where(sql<boolean>`s.net = 0`)).as('annule'))
    .where('d.client_id', '=', id)
    .orderBy('d.emis_le', 'desc')
    .limit(100)
    .execute();
  const arrives = s.livrees + s.retournees;
  return {
    id: c.id, nom: c.nom, telephone: dechiffrerOuNul(c.telephone_chiffre, `clients.telephone:${c.id}`),
    details: lireDetails(dechiffrerOuNul(c.details_chiffre, `clients.details:${c.id}`)), note: dechiffrerOuNul(c.note_chiffre, `clients.note:${c.id}`) ?? '', creeLe: c.cree_le, supprimeLe: c.supprime_le,
    depense: Number(c.depense), du: Number(c.du),
    achats: docs.filter((d) => (d.type === 'facture' || d.type === 'ticket') && !d.annule).length,
    commandes: s.total, livrees: s.livrees, retournees: s.retournees, annulees: s.annulees,
    tauxRetour: arrives ? Math.round((s.retournees * 100) / arrives) : null,
    documents: docs.map((d) => ({ id: d.id, type: d.type, annee: d.annee, numero: d.numero, total: Number(d.total), emisLe: d.emis_le, annule: !!d.annule })),
  };
}

/**
 * Supprime les données personnelles d'un client à sa demande (loi 18-07) : nom remplacé, téléphone, empreinte,
 * détails et adresses de livraison effacés. Les factures et documents émis gardent leur copie figée de l'acheteur :
 * ce sont des documents comptables, conservés pendant la durée légale réglée par l'administrateur.
 */
export async function supprimerDonneesClient(trx: Trx, id: string): Promise<boolean> {
  const r = await trx.updateTable('clients').set({ nom: '—', telephone_chiffre: null, telephone_hmac: null, details_chiffre: null, note_chiffre: null, supprime_le: new Date() })
    .where('id', '=', id).where('supprime_le', 'is', null).executeTakeFirst();
  if (!r.numUpdatedRows) return false;
  await trx.updateTable('commandes').set({ adresse_chiffre: null }).where('client_id', '=', id).execute();
  return true;
}

/** Adresse et numéros légaux d'un client professionnel (repris sur ses factures). */
export interface DetailsClient { adresse?: string; nif?: string; rc?: string; nis?: string; ai?: string }
const CHAMPS_DETAILS = ['adresse', 'nif', 'rc', 'nis', 'ai'] as const;

function lireDetails(json: string | null): DetailsClient {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.fromEntries(CHAMPS_DETAILS.filter((k) => typeof o[k] === 'string' && o[k]).map((k) => [k, o[k] as string]));
  } catch {
    return {};
  }
}

type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: 'champ_requis' | 'telephone_invalide' | 'introuvable' | 'client_existe' };

export interface SaisieClient { nom: string; telephone: string; details: DetailsClient; note: string }

/**
 * Ajoute un client à la main, ou corrige sa fiche (nom, téléphone, adresse, numéros légaux, note).
 * Un numéro déjà pris par un autre client est refusé : un client = un numéro. Les documents déjà émis
 * gardent leur copie figée de l'acheteur.
 */
export async function enregistrerFiche(trx: Trx, commercantId: string, id: string | null, c: SaisieClient): Promise<Resultat<{ id: string }>> {
  const nom = c.nom.trim().slice(0, 120);
  if (!nom) return { ok: false, raison: 'champ_requis' };
  let telephone: string | null = null;
  if (c.telephone.trim()) {
    telephone = normaliserTelephone(c.telephone);
    if (!telephone) return { ok: false, raison: 'telephone_invalide' };
  }
  const cible = id ?? randomUUID();
  if (id) {
    const actuel = await trx.selectFrom('clients').select(['id', 'supprime_le']).where('id', '=', id).executeTakeFirst();
    if (!actuel || actuel.supprime_le) return { ok: false, raison: 'introuvable' };
  }
  const hmac = telephone ? empreinte(telephone, 'clients.telephone') : null;
  if (hmac) {
    const autre = await trx.selectFrom('clients').select('id').where('telephone_hmac', '=', hmac).where('id', '<>', cible).executeTakeFirst();
    if (autre) return { ok: false, raison: 'client_existe' };
  }
  const details = Object.fromEntries(CHAMPS_DETAILS.map((k) => [k, (c.details[k] ?? '').trim().slice(0, k === 'adresse' ? 300 : 40)]).filter(([, v]) => v));
  const note = c.note.trim().slice(0, 500);
  const valeurs = {
    nom,
    telephone_chiffre: telephone ? chiffrer(telephone, `clients.telephone:${cible}`) : null,
    telephone_hmac: hmac,
    details_chiffre: Object.keys(details).length ? chiffrer(JSON.stringify(details), `clients.details:${cible}`) : null,
    note_chiffre: note ? chiffrer(note, `clients.note:${cible}`) : null,
  };
  if (id) await trx.updateTable('clients').set(valeurs).where('id', '=', id).execute();
  else await trx.insertInto('clients').values({ id: cible, commercant_id: commercantId, ...valeurs }).execute();
  return { ok: true, id: cible };
}
