// Chiffres de l'accueil et des rapports. Rien n'est recopié : tout est calculé à partir des documents,
// des commandes et du stock, à l'heure d'Alger. Les montants restent des entiers (centimes).
import { sql } from 'kysely';
import type { Trx } from './bd.ts';

export const FUSEAU = 'Africa/Algiers';
/** Date du jour à Alger, « AAAA-MM-JJ ». */
export const jourAlger = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const decaler = (jour: string, jours: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
};

export type CodePeriode = '7j' | '30j' | 'mois' | 'mois_precedent' | 'annee';
export const PERIODES: readonly CodePeriode[] = ['7j', '30j', 'mois', 'mois_precedent', 'annee'];
export interface Periode {
  du: string;
  au: string;
}

/** Bornes d'une période, jours compris, à l'heure d'Alger. */
export function periode(code: CodePeriode, aujourdhui = jourAlger()): Periode {
  const [a, m] = aujourdhui.split('-').map(Number) as [number, number];
  switch (code) {
    case '7j': return { du: decaler(aujourdhui, -6), au: aujourdhui };
    case '30j': return { du: decaler(aujourdhui, -29), au: aujourdhui };
    case 'mois': return { du: `${aujourdhui.slice(0, 7)}-01`, au: aujourdhui };
    case 'mois_precedent': {
      const debut = m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`;
      return { du: debut, au: decaler(`${aujourdhui.slice(0, 7)}-01`, -1) };
    }
    case 'annee': return { du: `${a}-01-01`, au: aujourdhui };
  }
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/** Période saisie à la main (export) : dates valides, dans l'ordre, un an au plus. */
export function periodeLibre(du: string, au: string): Periode | null {
  if (!JOUR.test(du) || !JOUR.test(au) || Number.isNaN(Date.parse(du)) || Number.isNaN(Date.parse(au)) || du > au) return null;
  if (Date.parse(au) - Date.parse(du) > 366 * 86_400_000) return null;
  return { du, au };
}

const jourDe = (colonne: string) => sql.raw(`(${colonne} AT TIME ZONE '${FUSEAU}')::date`);
const dans = (colonne: string, p: Periode) => sql`${jourDe(colonne)} BETWEEN ${p.du}::date AND ${p.au}::date`;
/** Facture ou ticket pas annulé par un avoir. */
const nonAnnule = (alias: string) => sql.raw(`NOT EXISTS (SELECT 1 FROM liens_documents l WHERE l.source_id = ${alias}.id AND l.nature = 'corrige_par')`);

// ───────────── Accueil ─────────────

export interface ChiffresAccueil {
  ventesJour: number;
  nbVentesJour: number;
  aConfirmer: number;
  aExpedier: number;
  enRoute: number;
  stockBas: number;
  ruptures: number;
  ecarts: number;
  devisEnAttente: number;
  /** Caisse ouverte un jour passé et jamais clôturée. */
  caisseNonCloturee: boolean;
  clients: number;
}

export async function chiffresAccueil(trx: Trx): Promise<ChiffresAccueil> {
  const aujourdhui = jourAlger();
  const r = await sql<{
    ventes: string; nb: number; a_confirmer: number; a_expedier: number; en_route: number; ecarts: number; devis: number; caisse: boolean; clients: number;
  }>`
    SELECT
      (SELECT coalesce(sum(total), 0) FROM documents WHERE type IN ('facture', 'ticket', 'avoir') AND ${jourDe('emis_le')} = ${aujourdhui}::date) AS ventes,
      (SELECT count(*) FROM documents WHERE type IN ('facture', 'ticket') AND ${jourDe('emis_le')} = ${aujourdhui}::date)::int AS nb,
      (SELECT count(*) FROM commandes WHERE statut IN ('nouvelle', 'a_confirmer'))::int AS a_confirmer,
      (SELECT count(*) FROM commandes WHERE statut IN ('confirmee', 'preparee'))::int AS a_expedier,
      (SELECT count(*) FROM commandes WHERE statut = 'expediee')::int AS en_route,
      (SELECT count(*) FROM ecarts_stock WHERE traite_le IS NULL)::int AS ecarts,
      (SELECT count(*) FROM documents d WHERE d.type = 'devis' AND d.etat = 'en_attente' AND NOT EXISTS (SELECT 1 FROM commandes c WHERE c.devis_id = d.id))::int AS devis,
      EXISTS (SELECT 1 FROM sessions_caisse WHERE fermee_le IS NULL AND ${jourDe('ouverte_le')} < ${aujourdhui}::date) AS caisse,
      (SELECT count(*) FROM clients)::int AS clients`.execute(trx);
  const s = await sql<{ bas: number; rupture: number }>`
    SELECT (count(*) FILTER (WHERE stock > 0 AND alertes > 0))::int AS bas, (count(*) FILTER (WHERE stock <= 0))::int AS rupture
    FROM (SELECT sum(s.quantite) AS stock, count(*) FILTER (WHERE s.quantite <= v.seuil_alerte) AS alertes
          FROM produits p JOIN variantes v ON v.produit_id = p.id AND v.archive_le IS NULL JOIN stocks s ON s.variante_id = v.id
          WHERE p.archive_le IS NULL GROUP BY p.id) t`.execute(trx);
  const l = r.rows[0]!;
  const st = s.rows[0]!;
  return {
    ventesJour: Number(l.ventes), nbVentesJour: l.nb, aConfirmer: l.a_confirmer, aExpedier: l.a_expedier, enRoute: l.en_route,
    stockBas: st.bas + st.rupture, ruptures: st.rupture, ecarts: l.ecarts, devisEnAttente: l.devis, caisseNonCloturee: l.caisse, clients: l.clients,
  };
}

export interface PointSerie {
  jour: string;
  valeur: number;
}

/** Ventes encaissées ou facturées par jour (tickets, factures, moins les avoirs), jours sans vente compris. */
export async function serieVentes(trx: Trx, jours: 7 | 30): Promise<PointSerie[]> {
  const au = jourAlger();
  const du = decaler(au, -(jours - 1));
  const r = await sql<{ jour: string; valeur: string }>`
    SELECT to_char(j, 'YYYY-MM-DD') AS jour, coalesce(sum(d.total), 0) AS valeur
    FROM generate_series(${du}::date, ${au}::date, interval '1 day') j
    LEFT JOIN documents d ON d.type IN ('facture', 'ticket', 'avoir') AND ${jourDe('d.emis_le')} = j::date
    GROUP BY j ORDER BY j`.execute(trx);
  return r.rows.map((l) => ({ jour: l.jour, valeur: Number(l.valeur) }));
}

// ───────────── Rapports ─────────────

export interface RapportMarge {
  /** Ventes hors taxe des factures et tickets non annulés (livraison facturée comprise). */
  ventes: number;
  achat: number;
  /** Livraison des colis expédiés pendant la période (payée au transporteur, que le colis arrive ou revienne). */
  livraison: number;
  /** Part de la livraison perdue sur les colis retournés. */
  retours: number;
  colisRetournes: number;
  marge: number;
  /** Taux de marque en dixièmes de pour cent (marge / ventes). Null sans vente. */
  tauxMarque: number | null;
  nbVentes: number;
  panierMoyen: number | null;
  serie: PointSerie[];
  /** Regroupement de la série : par jour ou par mois. */
  pas: 'jour' | 'mois';
}

export async function rapportMarge(trx: Trx, p: Periode): Promise<RapportMarge> {
  const v = await sql<{ ventes: string; ttc: string; achat: string; nb: number }>`
    SELECT coalesce(sum(d.total_ht), 0) AS ventes, coalesce(sum(d.total), 0) AS ttc, count(*)::int AS nb,
      coalesce((SELECT sum(l.quantite * l.cout_unitaire) FROM lignes_document l JOIN documents x ON x.id = l.document_id
        WHERE x.type IN ('facture', 'ticket') AND ${dans('x.emis_le', p)} AND ${nonAnnule('x')}), 0) AS achat
    FROM documents d WHERE d.type IN ('facture', 'ticket') AND ${dans('d.emis_le', p)} AND ${nonAnnule('d')}`.execute(trx);
  const c = await sql<{ livraison: string; retours: string; nb: number }>`
    SELECT coalesce(sum(frais_livraison), 0) AS livraison,
      coalesce(sum(frais_livraison) FILTER (WHERE statut = 'retournee'), 0) AS retours,
      (count(*) FILTER (WHERE statut = 'retournee'))::int AS nb
    FROM commandes WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)}`.execute(trx);
  const pas = Date.parse(p.au) - Date.parse(p.du) > 62 * 86_400_000 ? 'mois' : 'jour';
  const tronquer = sql.raw(pas === 'mois' ? `date_trunc('month', jours.j)` : 'jours.j');
  const serie = await sql<{ jour: string; valeur: string }>`
    WITH jours AS (SELECT j::date AS j FROM generate_series(${p.du}::date, ${p.au}::date, interval '1 day') j),
    ventes AS (
      SELECT ${jourDe('d.emis_le')} AS j, sum(d.total_ht) - coalesce(sum((SELECT sum(l.quantite * l.cout_unitaire) FROM lignes_document l WHERE l.document_id = d.id)), 0) AS m
      FROM documents d WHERE d.type IN ('facture', 'ticket') AND ${dans('d.emis_le', p)} AND ${nonAnnule('d')} GROUP BY 1),
    livraisons AS (
      SELECT ${jourDe('expediee_le')} AS j, sum(frais_livraison) AS f FROM commandes WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)} GROUP BY 1)
    SELECT to_char(${tronquer}, 'YYYY-MM-DD') AS jour, coalesce(sum(v.m), 0) - coalesce(sum(lv.f), 0) AS valeur
    FROM jours LEFT JOIN ventes v ON v.j = jours.j LEFT JOIN livraisons lv ON lv.j = jours.j
    GROUP BY 1 ORDER BY 1`.execute(trx);
  const l = v.rows[0]!;
  const lc = c.rows[0]!;
  const ventes = Number(l.ventes);
  const marge = ventes - Number(l.achat) - Number(lc.livraison);
  return {
    ventes, achat: Number(l.achat), livraison: Number(lc.livraison), retours: Number(lc.retours), colisRetournes: lc.nb, marge,
    tauxMarque: ventes > 0 ? Math.round((marge * 1000) / ventes) : null,
    nbVentes: l.nb, panierMoyen: l.nb ? Math.round(Number(l.ttc) / l.nb) : null,
    serie: serie.rows.map((s) => ({ jour: s.jour, valeur: Number(s.valeur) })), pas,
  };
}

export interface RapportCommandes {
  creees: number;
  confirmees: number;
  annuleesAvant: number;
  enAttente: number;
  expediees: number;
  livrees: number;
  retournees: number;
  enRoute: number;
  /** Pour cent, arrondi. Null s'il n'y a encore rien de décidé. */
  tauxConfirmation: number | null;
  tauxLivraison: number | null;
}

export async function rapportCommandes(trx: Trx, p: Periode): Promise<RapportCommandes> {
  const r = await sql<{ creees: number; confirmees: number; annulees: number; attente: number; expediees: number; livrees: number; retournees: number; route: number }>`
    SELECT
      (count(*) FILTER (WHERE ${dans('cree_le', p)}))::int AS creees,
      (count(*) FILTER (WHERE ${dans('cree_le', p)} AND facture_id IS NOT NULL))::int AS confirmees,
      (count(*) FILTER (WHERE ${dans('cree_le', p)} AND facture_id IS NULL AND statut = 'annulee'))::int AS annulees,
      (count(*) FILTER (WHERE ${dans('cree_le', p)} AND statut IN ('nouvelle', 'a_confirmer')))::int AS attente,
      (count(*) FILTER (WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)}))::int AS expediees,
      (count(*) FILTER (WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)} AND statut = 'livree'))::int AS livrees,
      (count(*) FILTER (WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)} AND statut = 'retournee'))::int AS retournees,
      (count(*) FILTER (WHERE expediee_le IS NOT NULL AND ${dans('expediee_le', p)} AND statut = 'expediee'))::int AS route
    FROM commandes`.execute(trx);
  const l = r.rows[0]!;
  const decidees = l.confirmees + l.annulees;
  const arrivees = l.livrees + l.retournees;
  return {
    creees: l.creees, confirmees: l.confirmees, annuleesAvant: l.annulees, enAttente: l.attente,
    expediees: l.expediees, livrees: l.livrees, retournees: l.retournees, enRoute: l.route,
    tauxConfirmation: decidees ? Math.round((l.confirmees * 100) / decidees) : null,
    tauxLivraison: arrivees ? Math.round((l.livrees * 100) / arrivees) : null,
  };
}

export interface RetoursWilaya {
  code: number;
  nom_fr: string;
  nom_ar: string;
  expediees: number;
  livrees: number;
  retournees: number;
  taux: number | null;
}

export async function retoursParWilaya(trx: Trx, p: Periode): Promise<RetoursWilaya[]> {
  const r = await sql<Omit<RetoursWilaya, 'taux'>>`
    SELECT w.code, w.nom_fr, w.nom_ar, count(*)::int AS expediees,
      (count(*) FILTER (WHERE c.statut = 'livree'))::int AS livrees,
      (count(*) FILTER (WHERE c.statut = 'retournee'))::int AS retournees
    FROM commandes c JOIN wilayas w ON w.code = c.wilaya_code
    WHERE c.expediee_le IS NOT NULL AND ${dans('c.expediee_le', p)}
    GROUP BY w.code, w.nom_fr, w.nom_ar
    ORDER BY retournees DESC, expediees DESC, w.code`.execute(trx);
  return r.rows.map((l) => ({ ...l, taux: l.livrees + l.retournees ? Math.round((l.retournees * 100) / (l.livrees + l.retournees)) : null }));
}

export interface ProduitVendu {
  produitId: string;
  nom_fr: string;
  nom_ar: string;
  quantite: number;
  ventes: number;
  marge: number;
}

export async function meilleursProduits(trx: Trx, p: Periode, limite = 10): Promise<ProduitVendu[]> {
  const r = await sql<{ produit_id: string; nom_fr: string; nom_ar: string; quantite: number; ventes: string; achat: string }>`
    SELECT pr.id AS produit_id, pr.nom_fr, pr.nom_ar, sum(l.quantite)::int AS quantite, sum(l.total_ht) AS ventes, sum(l.quantite * l.cout_unitaire) AS achat
    FROM lignes_document l
    JOIN documents d ON d.id = l.document_id
    JOIN variantes v ON v.id = l.variante_id
    JOIN produits pr ON pr.id = v.produit_id
    WHERE d.type IN ('facture', 'ticket') AND ${dans('d.emis_le', p)} AND ${nonAnnule('d')}
    GROUP BY pr.id, pr.nom_fr, pr.nom_ar
    ORDER BY sum(l.total_ht) DESC, pr.nom_fr
    LIMIT ${limite}`.execute(trx);
  return r.rows.map((l) => ({ produitId: l.produit_id, nom_fr: l.nom_fr, nom_ar: l.nom_ar, quantite: l.quantite, ventes: Number(l.ventes), marge: Number(l.ventes) - Number(l.achat) }));
}
