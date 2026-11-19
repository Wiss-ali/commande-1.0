// Connexion des commerçants et de l'administrateur, double authentification.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { etatEffectif, situation } from './abonnements.ts';
import { bd } from './bd.ts';
import { chiffrer, dechiffrer, empreinte } from './chiffrement.ts';
import { journaliserAuth } from './journal.ts';
import { autoriser, compterEssai, limiteAtteinte, oublierEssais } from './limites.ts';
import { aRehacher, hacher, verifier, verifierFactice } from './mots-de-passe.ts';
import { reglage } from './reglages-plateforme.ts';
import { hacherCodeSecours, pasTotpValide, nouveauSecretTotp, nouveauxCodesSecours } from './totp.ts';

export type EchecConnexion = 'identifiants' | 'bloque' | 'trop_de_tentatives';
export type ResultatConnexion =
  | { ok: true; id: string; commercantId: string | null; totpActif: boolean }
  | { ok: false; raison: EchecConnexion };

type Table = 'utilisateurs' | 'administrateurs';

const reussite = (table: Table, id: string, nouveauHache?: string) =>
  bd('auth')
    .updateTable(table)
    .set({ echecs: 0, bloque_jusqua: null, ...(nouveauHache ? { mot_de_passe: nouveauHache } : {}) })
    .where('id', '=', id)
    .execute();

// ───────────── Appareils reconnus ─────────────
// Après une connexion réussie, le téléphone garde un jeton signé (cookie), lié au compte et à son mot de passe.
// Les échecs depuis un appareil inconnu ne bloquent jamais un appareil reconnu : un inconnu qui tape de faux mots
// de passe ne peut pas empêcher le vrai titulaire d'entrer. Changer de mot de passe annule ces jetons.
const MAX_APPAREILS = 5;
const signatureAppareil = (id: string, hache: string, nonce: string) => empreinte(`${id}:${nonce}:${hache}`, 'appareil-connu');

function appareilReconnu(id: string, hache: string, jetons: readonly string[]): string | null {
  for (const j of jetons) {
    const [nonce, sig] = j.split('.');
    if (!nonce || !sig) continue;
    const attendue = Buffer.from(signatureAppareil(id, hache, nonce));
    const recue = Buffer.from(sig);
    if (attendue.length === recue.length && timingSafeEqual(attendue, recue)) return nonce;
  }
  return null;
}

/** Ajoute un jeton pour cet appareil (en retirant les anciens jetons de la même personne). Renvoie la liste à garder. */
export async function retenirAppareil(utilisateurId: string, anciens: readonly string[]): Promise<string[]> {
  const u = await bd('auth').selectFrom('utilisateurs').select('mot_de_passe').where('id', '=', utilisateurId).executeTakeFirst();
  if (!u) return [...anciens].slice(0, MAX_APPAREILS);
  const nonce = randomBytes(16).toString('base64url');
  const autres = anciens.filter((j) => !appareilReconnu(utilisateurId, u.mot_de_passe, [j]));
  return [`${nonce}.${signatureAppareil(utilisateurId, u.mot_de_passe, nonce)}`, ...autres].slice(0, MAX_APPAREILS);
}

/** Échecs permis par numéro et par heure, toutes adresses confondues (sauf depuis un appareil reconnu). */
const ECHECS_MAX_NUMERO = 20;

export async function connecterUtilisateur(p: { telephone: string; motDePasse: string; ip: string | null; appareils?: readonly string[] }): Promise<ResultatConnexion> {
  // Robots : limite par adresse.
  if (!(await autoriser('connexion-ip', p.ip ?? 'inconnue', 30, 600))) return { ok: false, raison: 'trop_de_tentatives' };
  const u = await bd('auth')
    .selectFrom('utilisateurs as u')
    .innerJoin('commercants as c', 'c.id', 'u.commercant_id')
    .select(['u.id', 'u.commercant_id', 'u.mot_de_passe', 'u.totp_actif', 'u.desactive', 'u.supprime_le', 'c.etat'])
    .where('u.telephone', '=', p.telephone)
    .executeTakeFirst();

  // État d'après l'abonnement : un compte archivé (fin de la lecture seule) ne se connecte plus ; rien n'est effacé.
  const etat = u ? etatEffectif(u.etat, (await situation(bd('auth'), u.commercant_id)).etat) : null;
  const actif = u && !u.desactive && !u.supprime_le && etat !== 'suspendu' && etat !== 'archive' ? u : null;
  const connu = actif ? appareilReconnu(actif.id, actif.mot_de_passe, p.appareils ?? []) : null;

  // Blocage après plusieurs échecs : pour ce numéro depuis cet appareil (ou cette adresse) seulement, jamais pour
  // le compte entier. Les échecs sont comptés de la même façon que le numéro existe ou non : rien n'est révélé.
  const minutes = await reglage('connexion_blocage_minutes');
  const source = `${p.telephone}|${connu ? `appareil:${connu}` : `ip:${p.ip ?? 'inconnue'}`}`;
  if (await limiteAtteinte('echecs-source', source, await reglage('connexion_echecs_max'), minutes * 60)) return { ok: false, raison: 'bloque' };
  // Attaque ciblée depuis beaucoup d'adresses : limite par numéro, qui ne gêne pas un appareil reconnu.
  if (!connu && (await limiteAtteinte('echecs-tel', p.telephone, ECHECS_MAX_NUMERO, 3600))) return { ok: false, raison: 'trop_de_tentatives' };
  const echouer = async () => {
    await compterEssai('echecs-source', source, minutes * 60);
    await compterEssai('echecs-tel', p.telephone, 3600);
  };

  if (!actif) {
    await verifierFactice(p.motDePasse);
    await echouer();
    return { ok: false, raison: 'identifiants' };
  }
  if (!(await verifier(actif.mot_de_passe, p.motDePasse))) {
    await echouer();
    await journaliserAuth({ commercantId: actif.commercant_id, acteurType: 'anonyme', action: 'connexion.echec', objetType: 'utilisateur', objetId: actif.id, ip: p.ip });
    return { ok: false, raison: 'identifiants' };
  }
  await oublierEssais('echecs-source', source);
  await reussite('utilisateurs', actif.id, aRehacher(actif.mot_de_passe) ? await hacher(p.motDePasse) : undefined);
  await journaliserAuth({ commercantId: actif.commercant_id, acteurType: 'utilisateur', acteurId: actif.id, action: 'connexion.reussie', ip: p.ip });
  return { ok: true, id: actif.id, commercantId: actif.commercant_id, totpActif: actif.totp_actif };
}

export async function connecterAdmin(p: { identifiant: string; motDePasse: string; ip: string | null }): Promise<ResultatConnexion> {
  if (!(await autoriser('admin-ip', p.ip ?? 'inconnue', 10, 600))) return { ok: false, raison: 'trop_de_tentatives' };
  // Blocage après plusieurs échecs : pour cet identifiant depuis cette adresse seulement, jamais pour le compte entier.
  // Un inconnu qui tape de faux mots de passe ne peut donc pas empêcher l'administrateur d'entrer depuis chez lui.
  // Les échecs sont comptés de la même façon que l'identifiant existe ou non : la réponse ne le révèle pas.
  const minutes = await reglage('connexion_blocage_minutes');
  const source = `${p.identifiant}|ip:${p.ip ?? 'inconnue'}`;
  if (await limiteAtteinte('admin-echecs', source, await reglage('connexion_echecs_max'), minutes * 60)) return { ok: false, raison: 'bloque' };
  const a = await bd('auth').selectFrom('administrateurs').selectAll().where('identifiant', '=', p.identifiant).executeTakeFirst();
  if (!a) {
    await verifierFactice(p.motDePasse);
    await compterEssai('admin-echecs', source, minutes * 60);
    return { ok: false, raison: 'identifiants' };
  }
  if (!(await verifier(a.mot_de_passe, p.motDePasse))) {
    await compterEssai('admin-echecs', source, minutes * 60);
    await journaliserAuth({ commercantId: null, acteurType: 'anonyme', action: 'admin.connexion.echec', ip: p.ip });
    return { ok: false, raison: 'identifiants' };
  }
  await oublierEssais('admin-echecs', source);
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
    .set({ totp_secret_chiffre: chiffrer(secret, contexteTotp(table, id)), totp_actif: false, totp_dernier_pas: null })
    .where('id', '=', id)
    .execute();
  return secret;
}

/** Active la double authentification si le code est bon. Renvoie les codes de secours, affichés une seule fois. */
export async function activerTotp(table: Table, id: string, code: string): Promise<string[] | null> {
  const l = await bd('auth').selectFrom(table).select(['totp_secret_chiffre', 'totp_actif']).where('id', '=', id).executeTakeFirst();
  if (!l?.totp_secret_chiffre || l.totp_actif) return null;
  const pas = pasTotpValide(dechiffrer(l.totp_secret_chiffre, contexteTotp(table, id)), code);
  if (pas === null) return null;
  const { clairs, hashes } = nouveauxCodesSecours();
  // Le code d'activation compte comme utilisé : il ne servira pas une seconde fois à la connexion.
  await bd('auth').updateTable(table).set({ totp_actif: true, codes_secours: hashes, totp_dernier_pas: pas }).where('id', '=', id).execute();
  return clairs;
}

export async function desactiverTotp(id: string): Promise<void> {
  await bd('auth').updateTable('utilisateurs').set({ totp_actif: false, totp_secret_chiffre: null, codes_secours: [], totp_dernier_pas: null }).where('id', '=', id).execute();
}

/** Vérifie un code à 6 chiffres ou un code de secours (consommé s'il est utilisé). */
export async function verifierCode(table: Table, id: string, code: string): Promise<boolean> {
  // Deviner un code à 6 chiffres : 5 essais par 10 minutes et 20 par jour (moins de 0,01 % de chances par jour),
  // et chaque erreur est notée dans le journal.
  const sujet = `${table}:${id}`;
  if (!(await autoriser('code-2fa', sujet, 5, 600)) || !(await autoriser('code-2fa-jour', sujet, 20, 86_400))) return false;
  const ok = await codeCorrect(table, id, code);
  if (ok) await oublierEssais('code-2fa', sujet);
  else {
    const commercant = table === 'utilisateurs' ? (await bd('auth').selectFrom('utilisateurs').select('commercant_id').where('id', '=', id).executeTakeFirst())?.commercant_id ?? null : null;
    await journaliserAuth({ commercantId: commercant, acteurType: 'anonyme', action: table === 'utilisateurs' ? 'double_auth.echec' : 'admin.double_auth.echec', objetType: table === 'utilisateurs' ? 'utilisateur' : 'administrateur', objetId: id });
  }
  return ok;
}

async function codeCorrect(table: Table, id: string, code: string): Promise<boolean> {
  const l = await bd('auth').selectFrom(table).select(['totp_secret_chiffre', 'totp_actif', 'codes_secours']).where('id', '=', id).executeTakeFirst();
  if (!l?.totp_actif || !l.totp_secret_chiffre) return false;
  const pas = pasTotpValide(dechiffrer(l.totp_secret_chiffre, contexteTotp(table, id)), code);
  if (pas !== null) {
    // Un code ne sert qu'une fois : refusé si ce code (ou un plus récent) a déjà été accepté, même en double envoi.
    const r = await sql`UPDATE ${sql.table(table)} SET totp_dernier_pas = ${pas} WHERE id = ${id} AND (totp_dernier_pas IS NULL OR totp_dernier_pas < ${pas})`.execute(bd('auth'));
    return (r.numAffectedRows ?? 0n) > 0n;
  }
  const h = hacherCodeSecours(code);
  if (!l.codes_secours.includes(h)) return false;
  // Retrait du code dans la même requête : il ne peut servir qu'une fois, même en cas de double envoi.
  const r = await sql`UPDATE ${sql.table(table)} SET codes_secours = array_remove(codes_secours, ${h}) WHERE id = ${id} AND ${h} = ANY(codes_secours)`.execute(bd('auth'));
  return (r.numAffectedRows ?? 0n) > 0n;
}

/** Vérifie le mot de passe actuel d'un utilisateur (avant une action sensible). */
export async function motDePasseCorrect(utilisateurId: string, motDePasse: string): Promise<boolean> {
  // Téléphone resté ouvert : pas plus de 5 essais du mot de passe actuel par quart d'heure.
  if (!(await autoriser('mdp-actuel', utilisateurId, 5, 900))) return false;
  const u = await bd('auth').selectFrom('utilisateurs').select('mot_de_passe').where('id', '=', utilisateurId).executeTakeFirst();
  return !!u && (await verifier(u.mot_de_passe, motDePasse));
}

export async function changerMotDePasse(utilisateurId: string, nouveau: string): Promise<void> {
  await bd('auth').updateTable('utilisateurs').set({ mot_de_passe: await hacher(nouveau), echecs: 0, bloque_jusqua: null }).where('id', '=', utilisateurId).execute();
}
