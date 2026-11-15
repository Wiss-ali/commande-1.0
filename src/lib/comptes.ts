// Connexion des commerçants et de l'administrateur, double authentification.
import { sql } from 'kysely';
import { bd } from './bd.ts';
import { chiffrer, dechiffrer } from './chiffrement.ts';
import { journaliserAuth } from './journal.ts';
import { autoriser } from './limites.ts';
import { aRehacher, hacher, verifier, verifierFactice } from './mots-de-passe.ts';
import { reglage } from './reglages-plateforme.ts';
import { codeTotpValide, hacherCodeSecours, nouveauSecretTotp, nouveauxCodesSecours } from './totp.ts';

export type EchecConnexion = 'identifiants' | 'bloque' | 'trop_de_tentatives';
export type ResultatConnexion =
  | { ok: true; id: string; commercantId: string | null; totpActif: boolean }
  | { ok: false; raison: EchecConnexion };

type Table = 'utilisateurs' | 'administrateurs';

async function echec(table: Table, id: string): Promise<void> {
  const max = await reglage('connexion_echecs_max');
  const minutes = await reglage('connexion_blocage_minutes');
  // Au-delà du nombre d'échecs permis, le compte est bloqué quelques minutes, puis le compteur repart.
  await sql`
    UPDATE ${sql.table(table)} SET
      bloque_jusqua = CASE WHEN echecs + 1 >= ${max} THEN now() + make_interval(mins => ${minutes}) ELSE bloque_jusqua END,
      echecs = CASE WHEN echecs + 1 >= ${max} THEN 0 ELSE echecs + 1 END
    WHERE id = ${id}`.execute(bd('auth'));
}

const reussite = (table: Table, id: string, nouveauHache?: string) =>
  bd('auth')
    .updateTable(table)
    .set({ echecs: 0, bloque_jusqua: null, ...(nouveauHache ? { mot_de_passe: nouveauHache } : {}) })
    .where('id', '=', id)
    .execute();

export async function connecterUtilisateur(p: { telephone: string; motDePasse: string; ip: string | null }): Promise<ResultatConnexion> {
  // Deux limites : par adresse (robots) et par numéro (attaque ciblée depuis plusieurs adresses).
  if (!(await autoriser('connexion-ip', p.ip ?? 'inconnue', 30, 600)) || !(await autoriser('connexion-tel', p.telephone, 20, 600))) {
    return { ok: false, raison: 'trop_de_tentatives' };
  }
  const u = await bd('auth')
    .selectFrom('utilisateurs as u')
    .innerJoin('commercants as c', 'c.id', 'u.commercant_id')
    .select(['u.id', 'u.commercant_id', 'u.mot_de_passe', 'u.totp_actif', 'u.bloque_jusqua', 'u.desactive', 'u.supprime_le', 'c.etat'])
    .where('u.telephone', '=', p.telephone)
    .executeTakeFirst();

  if (!u || u.desactive || u.supprime_le || u.etat === 'suspendu' || u.etat === 'archive') {
    await verifierFactice(p.motDePasse);
    return { ok: false, raison: 'identifiants' };
  }
  if (u.bloque_jusqua && u.bloque_jusqua > new Date()) return { ok: false, raison: 'bloque' };
  if (!(await verifier(u.mot_de_passe, p.motDePasse))) {
    await echec('utilisateurs', u.id);
    await journaliserAuth({ commercantId: u.commercant_id, acteurType: 'anonyme', action: 'connexion.echec', objetType: 'utilisateur', objetId: u.id, ip: p.ip });
    return { ok: false, raison: 'identifiants' };
  }
  await reussite('utilisateurs', u.id, aRehacher(u.mot_de_passe) ? await hacher(p.motDePasse) : undefined);
  await journaliserAuth({ commercantId: u.commercant_id, acteurType: 'utilisateur', acteurId: u.id, action: 'connexion.reussie', ip: p.ip });
  return { ok: true, id: u.id, commercantId: u.commercant_id, totpActif: u.totp_actif };
}

export async function connecterAdmin(p: { identifiant: string; motDePasse: string; ip: string | null }): Promise<ResultatConnexion> {
  if (!(await autoriser('admin-ip', p.ip ?? 'inconnue', 10, 600))) return { ok: false, raison: 'trop_de_tentatives' };
  const a = await bd('auth').selectFrom('administrateurs').selectAll().where('identifiant', '=', p.identifiant).executeTakeFirst();
  if (!a) {
    await verifierFactice(p.motDePasse);
    return { ok: false, raison: 'identifiants' };
  }
  if (a.bloque_jusqua && a.bloque_jusqua > new Date()) return { ok: false, raison: 'bloque' };
  if (!(await verifier(a.mot_de_passe, p.motDePasse))) {
    await echec('administrateurs', a.id);
    await journaliserAuth({ commercantId: null, acteurType: 'anonyme', action: 'admin.connexion.echec', ip: p.ip });
    return { ok: false, raison: 'identifiants' };
  }
  await reussite('administrateurs', a.id, aRehacher(a.mot_de_passe) ? await hacher(p.motDePasse) : undefined);
  await journaliserAuth({ commercantId: null, acteurType: 'administrateur', acteurId: a.id, action: 'admin.connexion.reussie', ip: p.ip });
  return { ok: true, id: a.id, commercantId: null, totpActif: a.totp_actif };
}

// ───────────── Double authentification ─────────────

const contexteTotp = (table: Table, id: string) => `${table}.totp:${id}`;

/** Prépare l'activation : crée un secret (pas encore actif) et le renvoie pour l'afficher en QR code. */
export async function preparerTotp(table: Table, id: string): Promise<string> {
  const secret = nouveauSecretTotp();
  await bd('auth')
    .updateTable(table)
    .set({ totp_secret_chiffre: chiffrer(secret, contexteTotp(table, id)), totp_actif: false })
    .where('id', '=', id)
    .execute();
  return secret;
}

/** Active la double authentification si le code est bon. Renvoie les codes de secours, affichés une seule fois. */
export async function activerTotp(table: Table, id: string, code: string): Promise<string[] | null> {
  const l = await bd('auth').selectFrom(table).select(['totp_secret_chiffre', 'totp_actif']).where('id', '=', id).executeTakeFirst();
  if (!l?.totp_secret_chiffre || l.totp_actif) return null;
  if (!codeTotpValide(dechiffrer(l.totp_secret_chiffre, contexteTotp(table, id)), code)) return null;
  const { clairs, hashes } = nouveauxCodesSecours();
  await bd('auth').updateTable(table).set({ totp_actif: true, codes_secours: hashes }).where('id', '=', id).execute();
  return clairs;
}

export async function desactiverTotp(id: string): Promise<void> {
  await bd('auth').updateTable('utilisateurs').set({ totp_actif: false, totp_secret_chiffre: null, codes_secours: [] }).where('id', '=', id).execute();
}

/** Vérifie un code à 6 chiffres ou un code de secours (consommé s'il est utilisé). */
export async function verifierCode(table: Table, id: string, code: string): Promise<boolean> {
  if (!(await autoriser('code-2fa', `${table}:${id}`, 8, 600))) return false;
  const l = await bd('auth').selectFrom(table).select(['totp_secret_chiffre', 'totp_actif', 'codes_secours']).where('id', '=', id).executeTakeFirst();
  if (!l?.totp_actif || !l.totp_secret_chiffre) return false;
  if (codeTotpValide(dechiffrer(l.totp_secret_chiffre, contexteTotp(table, id)), code)) return true;
  const h = hacherCodeSecours(code);
  if (!l.codes_secours.includes(h)) return false;
  // Retrait du code dans la même requête : il ne peut servir qu'une fois, même en cas de double envoi.
  const r = await sql`UPDATE ${sql.table(table)} SET codes_secours = array_remove(codes_secours, ${h}) WHERE id = ${id} AND ${h} = ANY(codes_secours)`.execute(bd('auth'));
  return (r.numAffectedRows ?? 0n) > 0n;
}

/** Vérifie le mot de passe actuel d'un utilisateur (avant une action sensible). */
export async function motDePasseCorrect(utilisateurId: string, motDePasse: string): Promise<boolean> {
  const u = await bd('auth').selectFrom('utilisateurs').select('mot_de_passe').where('id', '=', utilisateurId).executeTakeFirst();
  return !!u && (await verifier(u.mot_de_passe, motDePasse));
}

export async function changerMotDePasse(utilisateurId: string, nouveau: string): Promise<void> {
  await bd('auth').updateTable('utilisateurs').set({ mot_de_passe: await hacher(nouveau), echecs: 0, bloque_jusqua: null }).where('id', '=', utilisateurId).execute();
}
