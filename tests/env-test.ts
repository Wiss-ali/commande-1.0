// Environnement des tests : même serveur PostgreSQL que le développement, mais base « hanout_test ».
// Les rôles PostgreSQL sont communs à toutes les bases d'un serveur : on reprend donc les mots de passe
// du fichier .env quand il existe, pour que les tests ne changent pas ceux du développement.
import { existsSync, readFileSync } from 'node:fs';

function lireEnv(): Record<string, string> {
  if (!existsSync('.env')) return {};
  const lignes = readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l));
  return Object.fromEntries(lignes.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
}

export function envTest(urlApp: string): Record<string, string> {
  const local = lireEnv();
  const superUrl = process.env.TEST_PG ?? local.DATABASE_URL_SUPER ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  const base = (cle: string, role: string, mdp: string) => {
    const u = new URL(local[cle] ?? `postgres://${role}:${mdp}@${new URL(superUrl).host}/hanout`);
    u.pathname = '/hanout_test';
    return u.toString();
  };
  return {
    URL_APP: urlApp,
    DATABASE_URL_SUPER: superUrl,
    DATABASE_URL_PROPRIETAIRE: base('DATABASE_URL_PROPRIETAIRE', 'hanout_proprietaire', 'test_prop'),
    DATABASE_URL_APP: base('DATABASE_URL_APP', 'hanout_app', 'test_app'),
    DATABASE_URL_AUTH: base('DATABASE_URL_AUTH', 'hanout_auth', 'test_auth'),
    DATABASE_URL_PLATEFORME: base('DATABASE_URL_PLATEFORME', 'hanout_plateforme', 'test_plat'),
    DATABASE_SSL: 'off',
    // Clés réservées aux tests.
    CLES_CHIFFREMENT: '1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=,2:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
    CLE_CHIFFREMENT_ACTIVE: '2',
    CLE_HMAC: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  };
}
