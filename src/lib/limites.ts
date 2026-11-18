// Limites de débit, comptées en base pour rester justes même avec plusieurs copies de l'application.
import { sql } from 'kysely';
import { bd } from './bd.ts';
import { empreinte } from './chiffrement.ts';

/**
 * Compte un essai. Renvoie false si la limite est dépassée pour cette fenêtre de temps.
 * La clé (adresse, téléphone…) n'est stockée que sous forme d'empreinte.
 */
export async function autoriser(usage: string, sujet: string, max: number, fenetreSecondes: number): Promise<boolean> {
  const cle = empreinte(sujet, `limite:${usage}`);
  const r = await sql<{ compteur: number }>`
    INSERT INTO limites_debit (cle, debut, compteur) VALUES (${cle}, now(), 1)
    ON CONFLICT (cle) DO UPDATE SET
      compteur = CASE WHEN limites_debit.debut < now() - make_interval(secs => ${fenetreSecondes}) THEN 1 ELSE limites_debit.compteur + 1 END,
      debut    = CASE WHEN limites_debit.debut < now() - make_interval(secs => ${fenetreSecondes}) THEN now() ELSE limites_debit.debut END
    RETURNING compteur`.execute(bd('auth'));
  return (r.rows[0]?.compteur ?? 1) <= max;
}

export async function purgerLimites(): Promise<void> {
  await sql`DELETE FROM limites_debit WHERE debut < now() - interval '1 day'`.execute(bd('auth'));
}

/** Vrai si le compteur a déjà atteint `max` dans sa fenêtre en cours (sans compter un essai de plus). */
export async function limiteAtteinte(usage: string, sujet: string, max: number, fenetreSecondes: number): Promise<boolean> {
  const cle = empreinte(sujet, `limite:${usage}`);
  const r = await sql<{ compteur: number }>`
    SELECT compteur FROM limites_debit WHERE cle = ${cle} AND debut >= now() - make_interval(secs => ${fenetreSecondes})`.execute(bd('auth'));
  return (r.rows[0]?.compteur ?? 0) >= max;
}

/** Ajoute un essai au compteur (par exemple un échec de connexion). */
export async function compterEssai(usage: string, sujet: string, fenetreSecondes: number): Promise<void> {
  await autoriser(usage, sujet, Number.MAX_SAFE_INTEGER, fenetreSecondes);
}

/** Remet un compteur à zéro (par exemple après une connexion réussie). */
export async function oublierEssais(usage: string, sujet: string): Promise<void> {
  await sql`DELETE FROM limites_debit WHERE cle = ${empreinte(sujet, `limite:${usage}`)}`.execute(bd('auth'));
}
