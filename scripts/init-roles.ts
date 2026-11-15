// Crée (ou met à jour) les rôles PostgreSQL et la base. À lancer une fois, avec un compte super-utilisateur.
import pg from 'pg';

function lire(nom: string): URL {
  const v = process.env[nom];
  if (!v) throw new Error(`Variable manquante : ${nom}`);
  return new URL(v);
}

const superUrl = lire('DATABASE_URL_SUPER');
const roles = {
  hanout_proprietaire: lire('DATABASE_URL_PROPRIETAIRE'),
  hanout_app: lire('DATABASE_URL_APP'),
  hanout_auth: lire('DATABASE_URL_AUTH'),
  hanout_plateforme: lire('DATABASE_URL_PLATEFORME'),
};
const base = roles.hanout_proprietaire.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(base)) throw new Error('Nom de base invalide');

const client = new pg.Client({ connectionString: superUrl.toString() });
await client.connect();
try {
  for (const [role, url] of Object.entries(roles)) {
    if (url.username !== role) throw new Error(`L'utilisateur de la connexion doit être ${role}`);
    const mdp = client.escapeLiteral(decodeURIComponent(url.password));
    const existe = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    const options = `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${mdp}`;
    await client.query(`${existe.rowCount ? 'ALTER' : 'CREATE'} ROLE ${role} ${options}`);
  }
  const bd = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [base]);
  if (!bd.rowCount) await client.query(`CREATE DATABASE ${base} OWNER hanout_proprietaire`);
  await client.query(`REVOKE ALL ON DATABASE ${base} FROM PUBLIC`);
  await client.query(`GRANT CONNECT ON DATABASE ${base} TO hanout_app, hanout_auth, hanout_plateforme`);
  console.log(`Rôles et base « ${base} » prêts.`);
} finally {
  await client.end();
}
