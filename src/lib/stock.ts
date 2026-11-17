// Produits, variantes et stock. Toutes les fonctions s'exécutent dans la transaction d'un commerçant
// (voir `avecCommercant`) : la base refuse d'elle-même toute ligne d'un autre commerçant.
// Règle : le stock ne change que par `ajouterMouvement`. Rien d'autre n'écrit de quantité.
import { sql, type RawBuilder } from 'kysely';
import type { Trx } from './bd.ts';
import { normaliserCode } from './codes-barres.ts';
import type { Langue, MotifMouvement, TypeMouvement } from './types-bd.ts';

export interface Contexte {
  commercantId: string;
  utilisateurId: string;
}

export interface SaisieVariante {
  /** Présent pour une variante existante, absent pour une nouvelle. */
  id?: string;
  libelle: string;
  codeBarres: string | null;
  /** Centimes de dinar. */
  prixAchat: number;
  prixVente: number;
  seuil: number;
  /** Pris en compte à la création de la variante seulement. */
  stockInitial?: number;
}
export interface SaisieProduit {
  nomFr: string;
  nomAr: string;
  categorieId: string | null;
  variantes: SaisieVariante[];
}

/** Raisons de refus : ce sont aussi des clés de traduction sous « erreurs ». */
export type Refus =
  | 'nom_requis'
  | 'variante_libelle'
  | 'variante_double'
  | 'montant_invalide'
  | 'quantite_invalide'
  | 'code_barres_invalide'
  | 'code_barres_double'
  | 'code_barres_pris'
  | 'variante_avec_stock'
  | 'introuvable'
  | 'stock_insuffisant'
  | 'stock_reserve'
  | 'inventaire_termine'
  | 'inventaire_vide';

type Resultat<T> = ({ ok: true } & T) | { ok: false; raison: Refus };

export const MAX_VARIANTES = 50;
const MAX_MONTANT = 100_000_000_00; // 100 millions de dinars
const MAX_QUANTITE = 1_000_000;
const entier = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

/** Vérifie et nettoie une fiche produit. Aucune lecture en base. */
export function verifierProduit(s: SaisieProduit): Resultat<{ saisie: SaisieProduit }> {
  const nomFr = s.nomFr.trim().slice(0, 120);
  const nomAr = s.nomAr.trim().slice(0, 120);
  if (!nomFr && !nomAr) return { ok: false, raison: 'nom_requis' };
  if (s.variantes.length < 1 || s.variantes.length > MAX_VARIANTES) return { ok: false, raison: 'variante_libelle' };
  const libelles = new Set<string>();
  const codes = new Set<string>();
  const variantes: SaisieVariante[] = [];
  for (const v of s.variantes) {
    const libelle = v.libelle.trim().slice(0, 60);
    if (s.variantes.length > 1 && !libelle) return { ok: false, raison: 'variante_libelle' };
    if (libelles.has(libelle.toLowerCase())) return { ok: false, raison: 'variante_double' };
    libelles.add(libelle.toLowerCase());
    if (!entier(v.prixAchat, MAX_MONTANT) || !entier(v.prixVente, MAX_MONTANT)) return { ok: false, raison: 'montant_invalide' };
    if (!entier(v.seuil, MAX_QUANTITE) || !entier(v.stockInitial ?? 0, MAX_QUANTITE)) return { ok: false, raison: 'quantite_invalide' };
    let codeBarres: string | null = null;
    if (v.codeBarres?.trim()) {
      codeBarres = normaliserCode(v.codeBarres);
      if (!codeBarres) return { ok: false, raison: 'code_barres_invalide' };
      if (codes.has(codeBarres)) return { ok: false, raison: 'code_barres_double' };
      codes.add(codeBarres);
    }
    variantes.push({ id: v.id, libelle, codeBarres, prixAchat: v.prixAchat, prixVente: v.prixVente, seuil: v.seuil, stockInitial: v.stockInitial ?? 0 });
  }
  return { ok: true, saisie: { nomFr, nomAr, categorieId: s.categorieId, variantes } };
}

/** Vrai si l'un de ces codes est déjà porté par un autre article en vente. */
async function codePris(trx: Trx, codes: string[], sauf: string[] = []): Promise<boolean> {
  if (!codes.length) return false;
  let q = trx.selectFrom('variantes').select('id').where('code_barres', 'in', codes).where('archive_le', 'is', null);
  if (sauf.length) q = q.where('id', 'not in', sauf);
  return (await q.limit(1).execute()).length > 0;
}

async function categorieValide(trx: Trx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const c = await trx.selectFrom('categories').select('id').where('id', '=', id).executeTakeFirst();
  return c?.id ?? null;
}

async function ajouterVariante(trx: Trx, ctx: Contexte, produitId: string, v: SaisieVariante, ordre: number, motif: MotifMouvement): Promise<string> {
  const { id } = await trx
    .insertInto('variantes')
    .values({ commercant_id: ctx.commercantId, produit_id: produitId, libelle: v.libelle, code_barres: v.codeBarres, prix_achat: v.prixAchat, prix_vente: v.prixVente, seuil_alerte: v.seuil, ordre })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (v.stockInitial) await ajouterMouvement(trx, ctx, { varianteId: id, type: 'entree', quantite: v.stockInitial, motif, coutUnitaire: v.prixAchat });
  return id;
}

export async function creerProduit(trx: Trx, ctx: Contexte, saisie: SaisieProduit, motif: MotifMouvement = 'stock_initial'): Promise<Resultat<{ id: string }>> {
  const v = verifierProduit(saisie);
  if (!v.ok) return v;
  const s = v.saisie;
  if (await codePris(trx, s.variantes.flatMap((x) => (x.codeBarres ? [x.codeBarres] : [])))) return { ok: false, raison: 'code_barres_pris' };
  const { id } = await trx
    .insertInto('produits')
    .values({ commercant_id: ctx.commercantId, nom_fr: s.nomFr, nom_ar: s.nomAr, categorie_id: await categorieValide(trx, s.categorieId) })
    .returning('id')
    .executeTakeFirstOrThrow();
  for (const [i, variante] of s.variantes.entries()) await ajouterVariante(trx, ctx, id, variante, i, motif);
  return { ok: true, id };
}

/**
 * Modifie la fiche. Les variantes absentes de la saisie sont archivées (refusé s'il leur reste du stock).
 * Les quantités ne se modifient jamais ici : seulement par un mouvement.
 */
export async function modifierProduit(trx: Trx, ctx: Contexte, id: string, saisie: SaisieProduit): Promise<Resultat<object>> {
  const v = verifierProduit(saisie);
  if (!v.ok) return v;
  const s = v.saisie;
  const produit = await trx.selectFrom('produits').select('id').where('id', '=', id).where('archive_le', 'is', null).executeTakeFirst();
  if (!produit) return { ok: false, raison: 'introuvable' };
  const actuelles = await trx
    .selectFrom('variantes as v')
    .innerJoin('stocks as s', 's.variante_id', 'v.id')
    .select(['v.id', 's.quantite'])
    .where('v.produit_id', '=', id)
    .where('v.archive_le', 'is', null)
    .execute();
  const connues = new Set(actuelles.map((a) => a.id));
  if (s.variantes.some((x) => x.id && !connues.has(x.id))) return { ok: false, raison: 'introuvable' };
  const gardees = new Set(s.variantes.flatMap((x) => (x.id ? [x.id] : [])));
  const retirees = actuelles.filter((a) => !gardees.has(a.id));
  if (retirees.some((a) => a.quantite > 0)) return { ok: false, raison: 'variante_avec_stock' };
  const codes = s.variantes.flatMap((x) => (x.codeBarres ? [x.codeBarres] : []));
  if (await codePris(trx, codes, [...connues])) return { ok: false, raison: 'code_barres_pris' };

  await trx.updateTable('produits').set({ nom_fr: s.nomFr, nom_ar: s.nomAr, categorie_id: await categorieValide(trx, s.categorieId) }).where('id', '=', id).execute();
  if (retirees.length) {
    // Le code est rendu en même temps : il pourra servir à un autre article.
    await trx.updateTable('variantes').set({ archive_le: new Date(), code_barres: null }).where('id', 'in', retirees.map((r) => r.id)).execute();
  }
  // Les codes sont d'abord retirés : deux variantes peuvent ainsi échanger leurs codes.
  if (gardees.size) await trx.updateTable('variantes').set({ code_barres: null }).where('id', 'in', [...gardees]).execute();
  for (const [i, variante] of s.variantes.entries()) {
    if (variante.id) {
      await trx
        .updateTable('variantes')
        .set({ libelle: variante.libelle, code_barres: variante.codeBarres, prix_achat: variante.prixAchat, prix_vente: variante.prixVente, seuil_alerte: variante.seuil, ordre: i })
        .where('id', '=', variante.id)
        .execute();
    } else {
      await ajouterVariante(trx, ctx, id, variante, i, 'stock_initial');
    }
  }
  return { ok: true };
}

/** Archive (ou rétablit) un produit. Rien n'est supprimé : l'historique reste. */
export async function archiverProduit(trx: Trx, id: string, archiver: boolean): Promise<Resultat<object>> {
  const p = await trx.selectFrom('produits').select(['id', 'archive_le']).where('id', '=', id).executeTakeFirst();
  if (!p) return { ok: false, raison: 'introuvable' };
  if (archiver) {
    if (p.archive_le) return { ok: true };
    const quand = new Date();
    await trx.updateTable('produits').set({ archive_le: quand }).where('id', '=', id).execute();
    await trx.updateTable('variantes').set({ archive_le: quand }).where('produit_id', '=', id).where('archive_le', 'is', null).execute();
    return { ok: true };
  }
  if (!p.archive_le) return { ok: true };
  // Seules les variantes archivées avec le produit reviennent, si leurs codes sont toujours libres.
  const variantes = await trx.selectFrom('variantes').select(['id', 'code_barres']).where('produit_id', '=', id).where('archive_le', '=', p.archive_le).execute();
  if (await codePris(trx, variantes.flatMap((x) => (x.code_barres ? [x.code_barres] : [])))) return { ok: false, raison: 'code_barres_pris' };
  await trx.updateTable('variantes').set({ archive_le: null }).where('produit_id', '=', id).where('archive_le', '=', p.archive_le).execute();
  await trx.updateTable('produits').set({ archive_le: null }).where('id', '=', id).execute();
  return { ok: true };
}

export interface Mouvement {
  varianteId: string;
  type: TypeMouvement;
  /** Signée : positive pour une entrée, négative pour une sortie. */
  quantite: number;
  motif?: MotifMouvement;
  note?: string;
  coutUnitaire?: number;
  inventaireId?: string;
  /** Document à l'origine du mouvement (ticket, facture, avoir…). */
  documentId?: string;
  /** Clé d'idempotence : la même clé ne crée jamais deux mouvements. */
  cle?: string;
}

/** Seul chemin pour changer une quantité en stock. Renvoie « doublon » si la clé a déjà servi. */
export async function ajouterMouvement(trx: Trx, ctx: Contexte, m: Mouvement): Promise<'ok' | 'doublon' | 'introuvable' | 'quantite_invalide' | 'stock_insuffisant' | 'stock_reserve'> {
  if (!Number.isInteger(m.quantite) || m.quantite === 0 || Math.abs(m.quantite) > MAX_QUANTITE) return 'quantite_invalide';
  if (m.cle) {
    const deja = await trx.selectFrom('mouvements_stock').select('id').where('cle', '=', m.cle).executeTakeFirst();
    if (deja) return 'doublon';
  }
  const s = await trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', m.varianteId).executeTakeFirst();
  if (!s) return 'introuvable';
  // Contrôle pour donner un message clair ; la base revérifie de toute façon (contraintes sur « stocks »).
  if (m.type === 'reservation' || m.type === 'liberation') {
    const reservee = s.reservee + m.quantite;
    if (reservee > s.quantite) return 'stock_insuffisant';
    if (reservee < 0) return 'stock_reserve';
  } else {
    const quantite = s.quantite + m.quantite;
    if (quantite < 0) return 'stock_insuffisant';
    if (quantite < s.reservee) return 'stock_reserve';
  }
  await trx
    .insertInto('mouvements_stock')
    .values({
      commercant_id: ctx.commercantId,
      variante_id: m.varianteId,
      type: m.type,
      quantite: m.quantite,
      motif: m.motif ?? null,
      note: (m.note ?? '').trim().slice(0, 200),
      cout_unitaire: m.coutUnitaire ?? null,
      auteur_id: ctx.utilisateurId,
      inventaire_id: m.inventaireId ?? null,
      document_id: m.documentId ?? null,
      cle: m.cle ?? null,
    })
    .execute();
  return 'ok';
}

/** Erreur de la base → raison lisible, quand deux actions simultanées ont contourné les contrôles ci-dessus. */
export function refusDepuisErreur(e: unknown): Refus | null {
  const c = typeof e === 'object' && e && 'constraint' in e ? String((e as { constraint: unknown }).constraint) : '';
  if (c === 'stock_insuffisant') return 'stock_insuffisant';
  if (c === 'stock_reserve') return 'stock_reserve';
  if (c === 'variantes_code_unique') return 'code_barres_pris';
  if (e instanceof Error && e.message.includes('inventaire_termine')) return 'inventaire_termine';
  return null;
}

// ───────────── Lectures ─────────────

export type EtatStock = 'ok' | 'bas' | 'rupture';
/** État d'un article : en rupture à zéro, bas quand il atteint son seuil d'alerte. */
export const etatVariante = (quantite: number, seuil: number): EtatStock => (quantite <= 0 ? 'rupture' : quantite <= seuil ? 'bas' : 'ok');
/** État d'un produit : en rupture quand tout est à zéro, bas dès qu'une variante manque ou atteint son seuil. */
export const etatProduit = (p: { stock: number; nb_rupture: number; nb_bas: number }): EtatStock => (p.stock <= 0 ? 'rupture' : p.nb_rupture > 0 || p.nb_bas > 0 ? 'bas' : 'ok');

export interface LigneProduit {
  id: string;
  nom_fr: string;
  nom_ar: string;
  archive: boolean;
  photo_id: string | null;
  nb_variantes: number;
  stock: number;
  nb_rupture: number;
  nb_bas: number;
  prix_min: string;
  prix_max: string;
}
export type FiltreStock = 'tous' | 'bas' | 'rupture' | 'archives';

const pourLike = (s: string) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

/** Agrégat d'un produit sur ses variantes : commun à la liste et au résumé. */
const DEPUIS_PRODUITS = sql`
  FROM produits p
  JOIN variantes v ON v.produit_id = p.id AND v.archive_le IS NOT DISTINCT FROM p.archive_le
  JOIN stocks s ON s.variante_id = v.id`;

export async function listerProduits(
  trx: Trx,
  o: { recherche?: string; filtre?: FiltreStock; categorieId?: string | null; langue: Langue; limite: number; decalage?: number },
): Promise<LigneProduit[]> {
  const conditions: RawBuilder<unknown>[] = [o.filtre === 'archives' ? sql`p.archive_le IS NOT NULL` : sql`p.archive_le IS NULL`];
  const recherche = o.recherche?.trim();
  if (recherche) {
    const motif = pourLike(recherche);
    const code = normaliserCode(recherche) ?? '';
    conditions.push(sql`(p.nom_fr ILIKE ${motif} OR p.nom_ar ILIKE ${motif} OR EXISTS (
      SELECT 1 FROM variantes x WHERE x.produit_id = p.id AND (x.code_barres = ${code} OR x.libelle ILIKE ${motif})))`);
  }
  if (o.categorieId) conditions.push(sql`p.categorie_id = ${o.categorieId}`);
  const groupe = o.filtre === 'rupture'
    ? sql`HAVING sum(s.quantite) = 0`
    : o.filtre === 'bas'
      ? sql`HAVING sum(s.quantite) > 0 AND count(*) FILTER (WHERE s.quantite <= v.seuil_alerte) > 0`
      : sql``;
  const nom = o.langue === 'ar' ? sql`coalesce(nullif(p.nom_ar, ''), p.nom_fr)` : sql`coalesce(nullif(p.nom_fr, ''), p.nom_ar)`;
  const r = await sql<LigneProduit>`
    SELECT p.id, p.nom_fr, p.nom_ar, p.archive_le IS NOT NULL AS archive,
      (SELECT ph.id FROM photos_produit ph WHERE ph.produit_id = p.id ORDER BY ph.ordre, ph.cree_le DESC LIMIT 1) AS photo_id,
      count(v.id)::int AS nb_variantes,
      sum(s.quantite)::int AS stock,
      (count(*) FILTER (WHERE s.quantite = 0))::int AS nb_rupture,
      (count(*) FILTER (WHERE s.quantite > 0 AND s.quantite <= v.seuil_alerte))::int AS nb_bas,
      min(v.prix_vente) AS prix_min, max(v.prix_vente) AS prix_max
    ${DEPUIS_PRODUITS}
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY p.id ${groupe}
    ORDER BY lower(${nom}), p.id
    LIMIT ${o.limite} OFFSET ${o.decalage ?? 0}`.execute(trx);
  return r.rows;
}

export interface ResumeStock {
  produits: number;
  bas: number;
  rupture: number;
  /** Valeur du stock au prix d'achat, en centimes. Réservée au propriétaire : à ne pas afficher aux autres. */
  valeur: number;
}

export async function resumeStock(trx: Trx): Promise<ResumeStock> {
  const r = await sql<{ produits: number; bas: number; rupture: number; valeur: string }>`
    SELECT count(*)::int AS produits,
      (count(*) FILTER (WHERE stock > 0 AND alertes > 0))::int AS bas,
      (count(*) FILTER (WHERE stock = 0))::int AS rupture,
      coalesce(sum(valeur), 0) AS valeur
    FROM (
      SELECT sum(s.quantite) AS stock, count(*) FILTER (WHERE s.quantite <= v.seuil_alerte) AS alertes, sum(s.quantite * v.prix_achat) AS valeur
      ${DEPUIS_PRODUITS}
      WHERE p.archive_le IS NULL
      GROUP BY p.id
    ) t`.execute(trx);
  const l = r.rows[0]!;
  return { produits: l.produits, bas: l.bas, rupture: l.rupture, valeur: Number(l.valeur) };
}

export interface FicheVariante {
  id: string;
  libelle: string;
  code_barres: string | null;
  prix_achat: string;
  prix_vente: string;
  seuil_alerte: number;
  quantite: number;
  reservee: number;
}
export interface FicheProduit {
  id: string;
  nom_fr: string;
  nom_ar: string;
  categorie_id: string | null;
  categorie_fr: string | null;
  categorie_ar: string | null;
  archive: boolean;
  photo_id: string | null;
  variantes: FicheVariante[];
}

export async function lireProduit(trx: Trx, id: string): Promise<FicheProduit | null> {
  const p = await trx
    .selectFrom('produits as p')
    .leftJoin('categories as c', 'c.id', 'p.categorie_id')
    .select(['p.id', 'p.nom_fr', 'p.nom_ar', 'p.categorie_id', 'p.archive_le', 'c.nom_fr as categorie_fr', 'c.nom_ar as categorie_ar'])
    .where('p.id', '=', id)
    .executeTakeFirst();
  if (!p) return null;
  let q = trx
    .selectFrom('variantes as v')
    .innerJoin('stocks as s', 's.variante_id', 'v.id')
    .select(['v.id', 'v.libelle', 'v.code_barres', 'v.prix_achat', 'v.prix_vente', 'v.seuil_alerte', 's.quantite', 's.reservee'])
    .where('v.produit_id', '=', id);
  q = p.archive_le ? q.where('v.archive_le', '=', p.archive_le) : q.where('v.archive_le', 'is', null);
  const variantes = await q.orderBy('v.ordre').orderBy('v.cree_le').execute();
  const photo = await trx.selectFrom('photos_produit').select('id').where('produit_id', '=', id).orderBy('ordre').orderBy('cree_le', 'desc').executeTakeFirst();
  const { archive_le, ...reste } = p;
  return { ...reste, archive: archive_le !== null, photo_id: photo?.id ?? null, variantes };
}

export interface ArticleTrouve {
  variante_id: string;
  produit_id: string;
  nom_fr: string;
  nom_ar: string;
  libelle: string;
  code_barres: string | null;
  prix_vente: string;
  quantite: number;
  reservee: number;
  seuil_alerte: number;
}

const ARTICLE = ['v.id as variante_id', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'v.code_barres', 'v.prix_vente', 's.quantite', 's.reservee', 'v.seuil_alerte'] as const;
const articles = (trx: Trx) =>
  trx.selectFrom('variantes as v').innerJoin('produits as p', 'p.id', 'v.produit_id').innerJoin('stocks as s', 's.variante_id', 'v.id').select(ARTICLE).where('v.archive_le', 'is', null);

/** Article en vente qui porte ce code-barres, ou null. */
export async function chercherParCode(trx: Trx, saisie: string): Promise<ArticleTrouve | null> {
  const code = normaliserCode(saisie);
  if (!code) return null;
  return (await articles(trx).where('v.code_barres', '=', code).executeTakeFirst()) ?? null;
}

/** Articles dont le nom, la variante ou le code contient le texte (pour choisir sans scanner). */
export async function chercherArticles(trx: Trx, texte: string, limite = 20): Promise<ArticleTrouve[]> {
  const t = texte.trim();
  if (!t) return [];
  const motif = pourLike(t);
  return articles(trx)
    .where((eb) => eb.or([eb('p.nom_fr', 'ilike', motif), eb('p.nom_ar', 'ilike', motif), eb('v.libelle', 'ilike', motif), eb('v.code_barres', '=', normaliserCode(t) ?? '')]))
    .orderBy('p.nom_fr')
    .orderBy('v.ordre')
    .limit(limite)
    .execute();
}

export interface LigneMouvement {
  id: string;
  type: TypeMouvement;
  quantite: number;
  stock_apres: number;
  motif: MotifMouvement | null;
  note: string;
  cree_le: Date;
  auteur: string;
  produit_id: string;
  nom_fr: string;
  nom_ar: string;
  libelle: string;
}

export async function listerMouvements(trx: Trx, o: { produitId?: string; type?: TypeMouvement; limite: number; decalage?: number }): Promise<LigneMouvement[]> {
  let q = trx
    .selectFrom('mouvements_stock as m')
    .innerJoin('variantes as v', 'v.id', 'm.variante_id')
    .innerJoin('produits as p', 'p.id', 'v.produit_id')
    .innerJoin('utilisateurs as u', 'u.id', 'm.auteur_id')
    .select(['m.id', 'm.type', 'm.quantite', 'm.stock_apres', 'm.motif', 'm.note', 'm.cree_le', 'u.nom as auteur', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle']);
  if (o.produitId) q = q.where('p.id', '=', o.produitId);
  if (o.type) q = q.where('m.type', '=', o.type);
  return q.orderBy('m.cree_le', 'desc').orderBy('m.id').limit(o.limite).offset(o.decalage ?? 0).execute();
}

// ───────────── Catégories ─────────────

export const listerCategories = (trx: Trx) => trx.selectFrom('categories').select(['id', 'nom_fr', 'nom_ar']).orderBy('nom_fr').orderBy('nom_ar').execute();

/** Catégorie portant ce nom (dans l'une des deux langues), créée au besoin. */
export async function trouverOuCreerCategorie(trx: Trx, ctx: Contexte, nom: string): Promise<string | null> {
  const n = nom.trim().slice(0, 60);
  if (!n) return null;
  const c = await trx
    .selectFrom('categories')
    .select('id')
    .where((eb) => eb.or([eb(eb.fn('lower', ['nom_fr']), '=', n.toLowerCase()), eb('nom_ar', '=', n)]))
    .executeTakeFirst();
  if (c) return c.id;
  const arabe = /[؀-ۿ]/.test(n);
  const cree = await trx.insertInto('categories').values({ commercant_id: ctx.commercantId, nom_fr: arabe ? '' : n, nom_ar: arabe ? n : '' }).returning('id').executeTakeFirstOrThrow();
  return cree.id;
}

// ───────────── Inventaire ─────────────

/** L'inventaire ouvert du commerçant, créé s'il n'y en a pas (un seul à la fois). */
export async function ouvrirInventaire(trx: Trx, ctx: Contexte): Promise<string> {
  const ouvert = await trx.selectFrom('inventaires').select('id').where('etat', '=', 'en_cours').executeTakeFirst();
  if (ouvert) return ouvert.id;
  const { id } = await trx.insertInto('inventaires').values({ commercant_id: ctx.commercantId, cree_par: ctx.utilisateurId }).returning('id').executeTakeFirstOrThrow();
  return id;
}

/** Compte un article : `ajouter` s'additionne (un scan = +1), `fixer` remplace la quantité comptée. */
export async function compter(trx: Trx, ctx: Contexte, inventaireId: string, varianteId: string, c: { ajouter: number } | { fixer: number }): Promise<Resultat<{ quantite: number }>> {
  const n = 'ajouter' in c ? c.ajouter : c.fixer;
  if (!entier(n, MAX_QUANTITE)) return { ok: false, raison: 'quantite_invalide' };
  const inv = await trx.selectFrom('inventaires').select('etat').where('id', '=', inventaireId).executeTakeFirst();
  if (!inv) return { ok: false, raison: 'introuvable' };
  if (inv.etat !== 'en_cours') return { ok: false, raison: 'inventaire_termine' };
  const variante = await trx.selectFrom('variantes').select('id').where('id', '=', varianteId).where('archive_le', 'is', null).executeTakeFirst();
  if (!variante) return { ok: false, raison: 'introuvable' };
  const ligne = await trx
    .insertInto('lignes_inventaire')
    .values({ commercant_id: ctx.commercantId, inventaire_id: inventaireId, variante_id: varianteId, quantite_comptee: n, compte_par: ctx.utilisateurId })
    .onConflict((oc) =>
      oc.columns(['inventaire_id', 'variante_id']).doUpdateSet({
        quantite_comptee: 'ajouter' in c ? sql<number>`lignes_inventaire.quantite_comptee + ${n}` : n,
        compte_par: ctx.utilisateurId,
      }))
    .returning('quantite_comptee')
    .executeTakeFirstOrThrow();
  return { ok: true, quantite: ligne.quantite_comptee };
}

export async function retirerLigneInventaire(trx: Trx, inventaireId: string, varianteId: string): Promise<void> {
  await trx.deleteFrom('lignes_inventaire').where('inventaire_id', '=', inventaireId).where('variante_id', '=', varianteId).execute();
}

export interface LigneInventaire {
  variante_id: string;
  produit_id: string;
  nom_fr: string;
  nom_ar: string;
  libelle: string;
  comptee: number;
  /** Stock connu : figé à la validation, sinon le stock du moment. */
  theorique: number;
}

export async function lignesInventaire(trx: Trx, inventaireId: string): Promise<LigneInventaire[]> {
  return trx
    .selectFrom('lignes_inventaire as l')
    .innerJoin('variantes as v', 'v.id', 'l.variante_id')
    .innerJoin('produits as p', 'p.id', 'v.produit_id')
    .innerJoin('stocks as s', 's.variante_id', 'v.id')
    .select(['v.id as variante_id', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'l.quantite_comptee as comptee', sql<number>`coalesce(l.quantite_theorique, s.quantite)`.as('theorique')])
    .where('l.inventaire_id', '=', inventaireId)
    .orderBy('l.modifie_le', 'desc')
    .execute();
}

/**
 * Valide l'inventaire : pour chaque article compté, le stock devient la quantité comptée,
 * par un mouvement de correction « inventaire ». Les articles non comptés ne changent pas.
 */
export async function validerInventaire(trx: Trx, ctx: Contexte, inventaireId: string): Promise<Resultat<{ corrections: number }>> {
  const inv = await trx.selectFrom('inventaires').select('etat').where('id', '=', inventaireId).executeTakeFirst();
  if (!inv) return { ok: false, raison: 'introuvable' };
  if (inv.etat !== 'en_cours') return { ok: false, raison: 'inventaire_termine' };
  const lignes = await sql<{ variante_id: string; ecart: number; reservee: number; comptee: number }>`
    UPDATE lignes_inventaire l SET quantite_theorique = s.quantite
    FROM stocks s WHERE s.variante_id = l.variante_id AND l.inventaire_id = ${inventaireId}
    RETURNING l.variante_id, l.quantite_comptee - s.quantite AS ecart, s.reservee, l.quantite_comptee AS comptee`.execute(trx);
  if (!lignes.rows.length) return { ok: false, raison: 'inventaire_vide' };
  if (lignes.rows.some((l) => l.comptee < l.reservee)) return { ok: false, raison: 'stock_reserve' };
  const ecarts = lignes.rows.filter((l) => l.ecart !== 0);
  if (ecarts.length) {
    await trx
      .insertInto('mouvements_stock')
      .values(ecarts.map((l) => ({ commercant_id: ctx.commercantId, variante_id: l.variante_id, type: 'correction' as const, quantite: l.ecart, motif: 'inventaire' as const, auteur_id: ctx.utilisateurId, inventaire_id: inventaireId })))
      .execute();
  }
  await trx.updateTable('inventaires').set({ etat: 'valide', termine_par: ctx.utilisateurId, termine_le: new Date() }).where('id', '=', inventaireId).execute();
  return { ok: true, corrections: ecarts.length };
}

export async function annulerInventaire(trx: Trx, ctx: Contexte, inventaireId: string): Promise<void> {
  await trx.updateTable('inventaires').set({ etat: 'annule', termine_par: ctx.utilisateurId, termine_le: new Date() }).where('id', '=', inventaireId).where('etat', '=', 'en_cours').execute();
}
