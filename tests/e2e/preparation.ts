// Base de test neuve et compte administrateur, avant les tests de bout en bout.
import { execFileSync } from 'node:child_process';
import preparerBD from '../preparation-bd.ts';

export default async function preparer() {
  await preparerBD();
  execFileSync('npx', ['tsx', 'scripts/creer-admin.ts', 'admin@test.dz'], { env: process.env, stdio: 'pipe' });
}
