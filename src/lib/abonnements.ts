// Abonnements des commerçants : formules (prix, durée, modules), paiements reçus hors de l'application et
// saisis par l'administrateur, état qui en découle (actif, délai, lecture seule, archivé) et modules autorisés.
// Rien n'est jamais supprimé : un paiement rouvre le compte.
import { sql, type Kysely } from 'kysely';
import type { BD, EtatCommercant, Modules, MoyenPaiement, NomModule } from './types-bd.ts';
import type { Trx } from './bd.ts';
import { MODULES } from './droits.ts';
import { reglage } from './reglages-plateforme.ts';

type Via = Kysely<BD> | Trx;

export type EtatAbonnement = 'sans' | 'actif' | 'bientot' | 'delai' | 'lecture_seule' | 'archive';
export const MOYENS: readonly MoyenPaiement[] = ['ccp', 'baridimob', 'virement', 'especes'];

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
export const ajouterJours = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ecart = (de: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
export const jourAlger = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export interface Delais {
  grace: number;
  lecture: number;
  rappel: number;
}
export async function lireDelais(): Promise<Delais> {
  return { grace: await reglage('delai_grace_jours'), lecture: await reglage('lecture_seule_jours'), rappel: await reglage('rappel_jours_1') };
}

/**
 * État d'après la date de fin (l'accès s'arrête à cette date) :
 * actif avant (« bientôt » dans les derniers jours), puis délai avec accès complet, puis lecture seule, puis archivé.
 */
export function etatDepuisFin(fin: string | null, aujourdhui: string, d: Delais): EtatAbonnement {
  if (!fin) return 'sans';
  const restant = ecart(aujourdhui, fin);
  if (restant > 0) return restant <= d.rappel ? 'bientot' : 'actif';
  const depuis = -restant;
  if (depuis < d.grace) return 'delai';
  if (depuis < d.grace + d.lecture) return 'lecture_seule';
  return 'archive';
}

/** État du compte : une suspension décidée par l'administrateur prime ; sinon l'abonnement décide (sans abonnement : inchangé). */
export function etatEffectif(base: EtatCommercant, e: EtatAbonnement): EtatCommercant {
  if (base === 'suspendu') return 'suspendu';
  if (e === 'sans') return base;
  if (e === 'lecture_seule' || e === 'archive') return e;
  return 'actif';
}

/** Modules autorisés : ceux de la formule, plus les ajouts, moins les retraits ; Stock toujours. Null : tous (pas d'abonnement). */
export function modulesAutorises(formule: NomModule[] | null, ajoutes: NomModule[], retires: NomModule[]): Set<NomModule> | null {
  if (!formule) return null;
  const s = new Set<NomModule>([...formule, ...ajoutes].filter((m) => MODULES.includes(m)));
  for (const m of retires) s.delete(m);
  s.add('stock');
  return s;
}

/** Modules réellement ouverts : choisis par le commerçant ET autorisés par son abonnement. */
export const modulesEffectifs = (choisis: Modules, autorises: Set<NomModule> | null): Modules =>
  Object.fromEntries(MODULES.map((m) => [m, !!choisis[m] && (!autorises || autorises.has(m))])) as Modules;

export interface Situation {
  formule: { id: string; nom: string; modules: NomModule[] } | null;
  debut: string | null;
  fin: string | null;
  etat: EtatAbonnement;
  /** Jours avant la fin (négatif une fois passée). */
  joursRestants: number | null;
  /** Dernier jour d'accès complet avant la lecture seule. */
  finDelai: string | null;
  ajoutes: NomModule[];
  retires: NomModule[];
  autorises: Set<NomModule> | null;
}

/** Situation d'un commerçant, lue par n'importe quel rôle qui voit ses abonnements (auth, plateforme, ou le commerçant lui-même). */
export async function situation(via: Via, commercantId: string, delais?: Delais, aujourdhui = jourAlger()): Promise<Situation> {
  const d = delais ?? (await lireDelais());
  const r = await sql<{ formule_id: string | null; nom: string | null; modules: NomModule[] | null; debut: string | null; fin: string | null; ajoutes: NomModule[]; retires: NomModule[] }>`
    SELECT f.id AS formule_id, f.nom, f.modules, to_char(a.debut, 'YYYY-MM-DD') AS debut, to_char(a.fin, 'YYYY-MM-DD') AS fin, c.modules_ajoutes AS ajoutes, c.modules_retires AS retires
    FROM commercants c
    LEFT JOIN LATERAL (SELECT * FROM abonnements x WHERE x.commercant_id = c.id ORDER BY x.fin DESC, x.cree_le DESC LIMIT 1) a ON true
    LEFT JOIN formules f ON f.id = a.formule_id
    WHERE c.id = ${commercantId}`.execute(via);
  const l = r.rows[0];
  const fin = l?.fin ?? null;
  const formule = l?.formule_id ? { id: l.formule_id, nom: l.nom!, modules: l.modules ?? [] } : null;
  return {
    formule, debut: l?.debut ?? null, fin, etat: etatDepuisFin(fin, aujourdhui, d),
    joursRestants: fin ? ecart(aujourdhui, fin) : null, finDelai: fin ? ajouterJours(fin, d.grace - 1) : null,
    ajoutes: l?.ajoutes ?? [], retires: l?.retires ?? [], autorises: modulesAutorises(formule?.modules ?? null, l?.ajoutes ?? [], l?.retires ?? []),
  };
}

// ───────────── Administration ─────────────

export interface SaisieFormule {
  id?: string;
  nom: string;
  prix: number;
  dureeJours: number;
  modules: NomModule[];
  active: boolean;
}
export type RefusAbonnement = 'champ_requis' | 'montant_invalide' | 'duree_invalide' | 'nom_pris' | 'introuvable' | 'date_invalide';

export async function enregistrerFormule(via: Via, f: SaisieFormule): Promise<{ ok: true; id: string } | { ok: false; raison: RefusAbonnement }> {
  const nom = f.nom.trim().slice(0, 60);
  if (!nom) return { ok: false, raison: 'champ_requis' };
  if (!Number.isInteger(f.prix) || f.prix < 0 || f.prix > 100_000_000) return { ok: false, raison: 'montant_invalide' };
  if (!Number.isInteger(f.dureeJours) || f.dureeJours < 1 || f.dureeJours > 1100) return { ok: false, raison: 'duree_invalide' };
  const modules = JSON.stringify([...new Set<NomModule>(['stock', ...f.modules.filter((m) => MODULES.includes(m))])]);
  const meme = await via.selectFrom('formules').select('id').where(sql<boolean>`lower(nom) = lower(${nom})`).executeTakeFirst();
  if (meme && meme.id !== f.id) return { ok: false, raison: 'nom_pris' };
  if (f.id) {
    const r = await via.updateTable('formules').set({ nom, prix: f.prix, duree_jours: f.dureeJours, modules, active: f.active }).where('id', '=', f.id).executeTakeFirst();
    return r.numUpdatedRows ? { ok: true, id: f.id } : { ok: false, raison: 'introuvable' };
  }
  const { id } = await via.insertInto('formules').values({ nom, prix: f.prix, duree_jours: f.dureeJours, modules, active: f.active }).returning('id').executeTakeFirstOrThrow();
  return { ok: true, id };
}

export const listerFormules = (via: Via) => via.selectFrom('formules').selectAll().orderBy('active', 'desc').orderBy('prix').orderBy('nom').execute();

export interface SaisiePaiement {
  commercantId: string;
  formuleId: string;
  /** Centimes ; absent : le prix de la formule. */
  montant?: number | null;
  moyen: MoyenPaiement;
  recuLe: string;
  reference?: string;
  note?: string;
}

/**
 * Paiement reçu : enregistré tel quel (jamais modifié), il ajoute une période de la formule.
 * La période suit la fin de la précédente si le paiement arrive avant la fin du délai (la date d'échéance ne bouge pas) ;
 * sinon elle commence le jour du paiement. Un compte en lecture seule ou archivé redevient actif ; une suspension reste.
 */
export async function enregistrerPaiement(trx: Trx, adminId: string, p: SaisiePaiement, delais?: Delais): Promise<{ ok: true; debut: string; fin: string } | { ok: false; raison: RefusAbonnement }> {
  const d = delais ?? (await lireDelais());
  if (!JOUR.test(p.recuLe) || Number.isNaN(Date.parse(p.recuLe)) || p.recuLe > ajouterJours(jourAlger(), 1)) return { ok: false, raison: 'date_invalide' };
  if (!MOYENS.includes(p.moyen)) return { ok: false, raison: 'champ_requis' };
  const formule = await trx.selectFrom('formules').select(['id', 'prix', 'duree_jours']).where('id', '=', p.formuleId).executeTakeFirst();
  if (!formule) return { ok: false, raison: 'introuvable' };
  const montant = p.montant ?? Number(formule.prix);
  if (!Number.isInteger(montant) || montant < 0 || montant > 100_000_000) return { ok: false, raison: 'montant_invalide' };
  const c = await trx.selectFrom('commercants').select(['id', 'etat']).where('id', '=', p.commercantId).forUpdate().executeTakeFirst();
  if (!c) return { ok: false, raison: 'introuvable' };
  const s = await situation(trx, p.commercantId, d);
  const debut = s.fin && ecart(s.fin, p.recuLe) < d.grace ? s.fin : p.recuLe;
  const fin = ajouterJours(debut, formule.duree_jours);
  const { id } = await trx.insertInto('paiements_abonnement').values({
    commercant_id: p.commercantId, formule_id: formule.id, montant, moyen: p.moyen, recu_le: p.recuLe,
    reference: (p.reference ?? '').trim().slice(0, 80), note: (p.note ?? '').trim().slice(0, 300), saisi_par: adminId,
  }).returning('id').executeTakeFirstOrThrow();
  await trx.insertInto('abonnements').values({ commercant_id: p.commercantId, formule_id: formule.id, paiement_id: id, debut, fin }).execute();
  const nouvel = etatEffectif(c.etat, etatDepuisFin(fin, jourAlger(), d));
  if (nouvel !== c.etat) await trx.updateTable('commercants').set({ etat: nouvel }).where('id', '=', c.id).execute();
  return { ok: true, debut, fin };
}

export async function retoucherModules(via: Via, commercantId: string, ajoutes: NomModule[], retires: NomModule[]): Promise<void> {
  const propre = (l: NomModule[]) => JSON.stringify([...new Set(l.filter((m) => MODULES.includes(m) && m !== 'stock'))]);
  await via.updateTable('commercants').set({ modules_ajoutes: propre(ajoutes), modules_retires: propre(retires.filter((m) => !ajoutes.includes(m))) }).where('id', '=', commercantId).execute();
}

/**
 * Applique les échéances (tâche périodique, et à chaque ouverture de l'administration) : l'état enregistré de chaque
 * commerçant suit son abonnement. Le serveur le recalcule de toute façon à chaque requête (voir sessions.ts).
 */
export async function appliquerEcheances(via: Kysely<BD>): Promise<number> {
  const d = await lireDelais();
  const aujourdhui = jourAlger();
  const r = await sql<{ id: string; etat: EtatCommercant; fin: string }>`
    SELECT c.id, c.etat, to_char(max(a.fin), 'YYYY-MM-DD') AS fin FROM commercants c JOIN abonnements a ON a.commercant_id = c.id
    WHERE c.etat <> 'suspendu' GROUP BY c.id, c.etat`.execute(via);
  let changes = 0;
  for (const l of r.rows) {
    const nouvel = etatEffectif(l.etat, etatDepuisFin(l.fin, aujourdhui, d));
    if (nouvel !== l.etat) {
      await via.updateTable('commercants').set({ etat: nouvel }).where('id', '=', l.id).where('etat', '=', l.etat).execute();
      changes++;
    }
  }
  return changes;
}

export interface TableauAbonnements {
  actifs: number;
  bientot: number;
  delai: number;
  lectureSeule: number;
  archives: number;
  sans: number;
  revenuMois: number;
  paiementsMois: number;
}

export async function tableauAbonnements(via: Kysely<BD>): Promise<TableauAbonnements> {
  const d = await lireDelais();
  const aujourdhui = jourAlger();
  const r = await sql<{ fin: string | null }>`
    SELECT to_char(max(a.fin), 'YYYY-MM-DD') AS fin FROM commercants c LEFT JOIN abonnements a ON a.commercant_id = c.id GROUP BY c.id`.execute(via);
  const t: TableauAbonnements = { actifs: 0, bientot: 0, delai: 0, lectureSeule: 0, archives: 0, sans: 0, revenuMois: 0, paiementsMois: 0 };
  for (const l of r.rows) {
    const e = etatDepuisFin(l.fin, aujourdhui, d);
    if (e === 'actif') t.actifs++;
    else if (e === 'bientot') { t.actifs++; t.bientot++; }
    else if (e === 'delai') t.delai++;
    else if (e === 'lecture_seule') t.lectureSeule++;
    else if (e === 'archive') t.archives++;
    else t.sans++;
  }
  const m = await sql<{ total: string; n: number }>`
    SELECT coalesce(sum(montant), 0) AS total, count(*)::int AS n FROM paiements_abonnement WHERE to_char(recu_le, 'YYYY-MM') = ${aujourdhui.slice(0, 7)}`.execute(via);
  t.revenuMois = Number(m.rows[0]!.total);
  t.paiementsMois = m.rows[0]!.n;
  return t;
}

export async function listerPaiements(via: Via, o: { mois?: string; commercantId?: string; limite: number }) {
  let q = via
    .selectFrom('paiements_abonnement as p').innerJoin('commercants as c', 'c.id', 'p.commercant_id').innerJoin('formules as f', 'f.id', 'p.formule_id')
    .leftJoin('abonnements as a', 'a.paiement_id', 'p.id')
    .select(['p.id', 'p.montant', 'p.moyen', 'p.reference', 'p.note', 'c.nom as commercant', 'c.id as commercant_id', 'f.nom as formule'])
    .select([sql<string>`to_char(p.recu_le, 'YYYY-MM-DD')`.as('recu_le'), sql<string | null>`to_char(a.debut, 'YYYY-MM-DD')`.as('debut'), sql<string | null>`to_char(a.fin, 'YYYY-MM-DD')`.as('fin')]);
  if (o.mois && /^\d{4}-\d{2}$/.test(o.mois)) q = q.where(sql<boolean>`to_char(p.recu_le, 'YYYY-MM') = ${o.mois}`);
  if (o.commercantId) q = q.where('p.commercant_id', '=', o.commercantId);
  return q.orderBy('p.recu_le', 'desc').orderBy('p.cree_le', 'desc').limit(o.limite).execute();
}
