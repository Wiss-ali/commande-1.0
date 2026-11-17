// Page d'état interne : application, base de données, dernière sauvegarde.
// Sans jeton : seulement « ok » ou « erreur » (code 200 ou 503), pour la surveillance. Avec le jeton ETAT_JETON :
// le détail. Aucune donnée personnelle, aucun secret.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { bd } from '@/lib/bd';

export const dynamic = 'force-dynamic';

/** Fichier écrit par scripts/sauvegarde.sh à chaque sauvegarde réussie (ou échouée). */
async function derniereSauvegarde(): Promise<{ le: string | null; ok: boolean; ageHeures: number | null }> {
  const dossier = process.env.DOSSIER_SAUVEGARDES;
  if (!dossier) return { le: null, ok: false, ageHeures: null };
  try {
    const d = JSON.parse(await readFile(join(dossier, 'derniere.json'), 'utf8')) as { le?: string; ok?: boolean };
    const age = d.le ? (Date.now() - Date.parse(d.le)) / 3_600_000 : null;
    return { le: d.le ?? null, ok: !!d.ok, ageHeures: age === null ? null : Math.round(age) };
  } catch {
    return { le: null, ok: false, ageHeures: null };
  }
}

function jetonValide(requete: Request): boolean {
  const attendu = process.env.ETAT_JETON;
  const recu = requete.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!attendu || attendu.length < 16 || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

export async function GET(requete: Request) {
  let base = false;
  try {
    await sql`SELECT 1`.execute(bd('auth'));
    base = true;
  } catch {
    base = false;
  }
  const sauvegarde = await derniereSauvegarde();
  // Une sauvegarde par jour : plus de 26 heures sans sauvegarde réussie est une panne (si elles sont configurées).
  const sauvegardeOk = !process.env.DOSSIER_SAUVEGARDES || (sauvegarde.ok && sauvegarde.ageHeures !== null && sauvegarde.ageHeures <= 26);
  // « ?base » : l'application et la base seulement (vérification de santé du conteneur pendant une mise à jour).
  const ok = base && (new URL(requete.url).searchParams.has('base') || sauvegardeOk);
  const corps = jetonValide(requete)
    ? { etat: ok ? 'ok' : 'erreur', application: 'ok', base: base ? 'ok' : 'erreur', sauvegarde: { ...sauvegarde, ok: sauvegardeOk }, version: process.env.VERSION_APP ?? null }
    : { etat: ok ? 'ok' : 'erreur' };
  return Response.json(corps, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
