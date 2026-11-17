// Clients du commerçant : historique, total dépensé, taux de retour. Rien n'est recopié :
// tout est calculé à partir des documents et des commandes.
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { dechiffrerOuNul, empreinte } from './chiffrement.ts';
import { normaliserTelephone } from './formats.ts';
import type { TypeDocument } from './types-bd.ts';

export interface LigneClient {
  id: string;
  nom: string;
  commandes: number;
  depense: number;
  dernier: Date | null;
}

/** Total payé par un client : factures non annulées par un avoir. */
const depense = sql<string>`coalesce((SELECT sum(d.total) FROM documents d WHERE d.client_id = cl.id AND d.type = 'facture'
  AND NOT EXISTS (SELECT 1 FROM liens_documents l WHERE l.source_id = d.id AND l.nature = 'corrige_par')), 0)`;

export async function listerClients(trx: Trx, o: { recherche?: string; limite: number }): Promise<LigneClient[]> {
  let q = trx
    .selectFrom('clients as cl')
    .select(['cl.id', 'cl.nom'])
    .select(sql<number>`(SELECT count(*) FROM commandes c WHERE c.client_id = cl.id)::int`.as('commandes'))
    .select(depense.as('depense'))
    .select(sql<Date | null>`(SELECT max(d.emis_le) FROM documents d WHERE d.client_id = cl.id)`.as('dernier'));
  const r = (o.recherche ?? '').trim();
  if (r) {
    const tel = normaliserTelephone(r);
    q = tel ? q.where('cl.telephone_hmac', '=', empreinte(tel, 'clients.telephone')) : q.where('cl.nom', 'ilike', `%${r.replace(/[%_\\]/g, '\\$&')}%`);
  }
  const lignes = await q.orderBy(sql`(SELECT max(d.emis_le) FROM documents d WHERE d.client_id = cl.id)`, (ob) => ob.desc().nullsLast()).orderBy('cl.nom').limit(o.limite).execute();
  return lignes.map((l) => ({ ...l, depense: Number(l.depense) }));
}

export interface FicheClient {
  id: string;
  nom: string;
  telephone: string | null;
  creeLe: Date;
  depense: number;
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
    .select(['cl.id', 'cl.nom', 'cl.telephone_chiffre', 'cl.cree_le', 'cl.supprime_le'])
    .select(depense.as('depense'))
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
    .select((eb) => eb.exists(eb.selectFrom('liens_documents as l').select('l.cible_id').whereRef('l.source_id', '=', 'd.id').where('l.nature', '=', 'corrige_par')).as('annule'))
    .where('d.client_id', '=', id)
    .orderBy('d.emis_le', 'desc')
    .limit(100)
    .execute();
  const arrives = s.livrees + s.retournees;
  return {
    id: c.id, nom: c.nom, telephone: dechiffrerOuNul(c.telephone_chiffre, `clients.telephone:${c.id}`), creeLe: c.cree_le, supprimeLe: c.supprime_le,
    depense: Number(c.depense),
    achats: docs.filter((d) => d.type === 'facture' && !d.annule).length,
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
  const r = await trx.updateTable('clients').set({ nom: '—', telephone_chiffre: null, telephone_hmac: null, details_chiffre: null, supprime_le: new Date() })
    .where('id', '=', id).where('supprime_le', 'is', null).executeTakeFirst();
  if (!r.numUpdatedRows) return false;
  await trx.updateTable('commandes').set({ adresse_chiffre: null }).where('client_id', '=', id).execute();
  return true;
}
