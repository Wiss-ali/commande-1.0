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
