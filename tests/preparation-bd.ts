// Prépare une base de test vide avant les tests : rôles, base, migrations.
import { execFileSync } from 'node:child_process';
import pg from 'pg';

export default async function preparer() {
  const env = process.env;
  const superClient = new pg.Client({ connectionString: env.DATABASE_URL_SUPER });
  await superClient.connect();
  await superClient.query('DROP DATABASE IF EXISTS hanout_test WITH (FORCE)');
  await superClient.end();
  const lancer = (script: string, ...args: string[]) => execFileSync('npx', ['tsx', script, ...args], { env, stdio: 'pipe' });
  lancer('scripts/init-roles.ts');
  lancer('scripts/migrer.ts', 'monter');
}
