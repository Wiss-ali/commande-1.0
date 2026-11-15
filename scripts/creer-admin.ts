// Crée le compte administrateur de la plateforme. À lancer une fois, à l'installation :
//   npm run admin:creer -- <identifiant>
// Le mot de passe est demandé au clavier (ou lu dans ADMIN_MOT_DE_PASSE pour les tests).
import { createInterface } from 'node:readline/promises';
import pg from 'pg';
import { defautMotDePasse, hacher } from '../src/lib/mots-de-passe.ts';

const identifiant = process.argv[2]?.trim().toLowerCase();
if (!identifiant || identifiant.length < 3) {
  console.error('Usage : npm run admin:creer -- <identifiant>');
  process.exit(1);
}
let mdp = process.env.ADMIN_MOT_DE_PASSE;
if (!mdp) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  mdp = await rl.question('Mot de passe (15 caractères au minimum) : ');
  rl.close();
}
const defaut = defautMotDePasse(mdp, 15, [identifiant]);
if (defaut) {
  console.error(`Mot de passe refusé : ${defaut}`);
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_PROPRIETAIRE,
  ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : undefined,
});
await client.connect();
try {
  await client.query(
    `INSERT INTO administrateurs (identifiant, mot_de_passe) VALUES ($1, $2)
     ON CONFLICT (identifiant) DO UPDATE SET mot_de_passe = EXCLUDED.mot_de_passe, echecs = 0, bloque_jusqua = NULL`,
    [identifiant, await hacher(mdp)],
  );
  console.log(`Administrateur « ${identifiant} » prêt. La double authentification sera demandée à la première connexion.`);
} finally {
  await client.end();
}
