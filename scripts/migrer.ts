// Applique ou annule les migrations de db/migrations (fichiers NNNN_nom.up.sql et .down.sql).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { optionsSsl } from '../src/lib/ssl-base.ts';

const dossier = join(import.meta.dirname, '..', 'db', 'migrations');

export async function migrer(sens: 'monter' | 'descendre', url = process.env.DATABASE_URL_PROPRIETAIRE): Promise<string[]> {
  if (!url) throw new Error('Variable manquante : DATABASE_URL_PROPRIETAIRE');
  const ssl = optionsSsl();
  const client = new pg.Client({ connectionString: url, ssl });
  await client.connect();
  const faites: string[] = [];
  try {
    await client.query('CREATE TABLE IF NOT EXISTS migrations (nom text PRIMARY KEY, appliquee_le timestamptz NOT NULL DEFAULT now())');
    const deja = new Set((await client.query('SELECT nom FROM migrations')).rows.map((r) => r.nom as string));
    const noms = readdirSync(dossier).filter((f) => f.endsWith('.up.sql')).map((f) => f.replace('.up.sql', '')).sort();
    const cibles = sens === 'monter' ? noms.filter((n) => !deja.has(n)) : noms.filter((n) => deja.has(n)).slice(-1);
    for (const nom of cibles) {
      const sql = readFileSync(join(dossier, `${nom}.${sens === 'monter' ? 'up' : 'down'}.sql`), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(sens === 'monter' ? 'INSERT INTO migrations (nom) VALUES ($1)' : 'DELETE FROM migrations WHERE nom = $1', [nom]);
        await client.query('COMMIT');
        faites.push(nom);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.end();
  }
  return faites;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const sens = process.argv[2] === 'descendre' ? 'descendre' : 'monter';
  const faites = await migrer(sens);
  console.log(faites.length ? `${sens} : ${faites.join(', ')}` : 'Rien à faire.');
}
