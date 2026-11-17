// Connexion chiffrée (TLS) à PostgreSQL. « require » : le certificat du serveur est toujours vérifié ;
// DATABASE_SSL_CA donne le certificat de l'autorité locale quand la base a un certificat créé à l'installation.
import { readFileSync } from 'node:fs';

export function optionsSsl(): { rejectUnauthorized: true; ca?: string } | undefined {
  if (process.env.DATABASE_SSL !== 'require') return undefined;
  const ca = process.env.DATABASE_SSL_CA;
  return { rejectUnauthorized: true, ...(ca ? { ca: readFileSync(ca, 'utf8') } : {}) };
}
