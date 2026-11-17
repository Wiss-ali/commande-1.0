// Accès à PostgreSQL. Trois connexions, une par rôle :
//  - app        : données d'un commerçant, toujours dans une transaction qui fixe le commerçant (RLS) ;
//  - auth       : comptes, sessions, invitations (avant de savoir qui est connecté) ;
//  - plateforme : administration de la plateforme.
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import { config } from './config.ts';
import { optionsSsl } from './ssl-base.ts';
import type { BD } from './types-bd.ts';

export type RoleBD = 'app' | 'auth' | 'plateforme';
export type Trx = Transaction<BD>;

const cache = globalThis as unknown as { __hanoutBD?: Partial<Record<RoleBD, Kysely<BD>>> };

export function bd(role: RoleBD): Kysely<BD> {
  cache.__hanoutBD ??= {};
  let k = cache.__hanoutBD[role];
  if (!k) {
    const c = config();
    const url = { app: c.DATABASE_URL_APP, auth: c.DATABASE_URL_AUTH, plateforme: c.DATABASE_URL_PLATEFORME }[role];
    const pool = new pg.Pool({
      connectionString: url,
      max: role === 'app' ? 10 : 4,
      ssl: c.DATABASE_SSL === 'require' ? optionsSsl() : undefined,
    });
    k = new Kysely<BD>({ dialect: new PostgresDialect({ pool }) });
    cache.__hanoutBD[role] = k;
  }
  return k;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Exécute `fn` dans une transaction limitée à un commerçant.
 * Le commerçant est fixé pour la transaction seulement : il ne peut pas « rester » sur la connexion.
 * C'est le seul moyen d'utiliser la connexion « app ».
 */
export async function avecCommercant<T>(commercantId: string, fn: (trx: Trx) => Promise<T>): Promise<T> {
  if (!UUID.test(commercantId)) throw new Error('Identifiant de commerçant invalide');
  return bd('app').transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.commercant_id', ${commercantId}, true)`.execute(trx);
    return fn(trx);
  });
}

export async function fermerBD(): Promise<void> {
  const tous = Object.values(cache.__hanoutBD ?? {});
  cache.__hanoutBD = {};
  await Promise.all(tous.map((k) => k.destroy()));
}
