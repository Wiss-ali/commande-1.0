// Aides communes aux tests d'intégration.
import pg from 'pg';
import { accepterInvitation, inviterCommercant } from '../src/lib/invitations.ts';
import { hacher } from '../src/lib/mots-de-passe.ts';

export const MDP = 'un mot de passe assez long';
let compteur = 0;
export const telephone = () => `05${String(Date.now() % 1_000_000).padStart(6, '0')}${String(compteur++ % 100).padStart(2, '0')}`;

export async function sqlProprietaire<T extends pg.QueryResultRow = pg.QueryResultRow>(texte: string, valeurs: unknown[] = []) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL_PROPRIETAIRE });
  await c.connect();
  try {
    return await c.query<T>(texte, valeurs);
  } finally {
    await c.end();
  }
}

export async function creerAdmin(identifiant = `admin-${Date.now()}-${compteur++}`) {
  const r = await sqlProprietaire<{ id: string }>('INSERT INTO administrateurs (identifiant, mot_de_passe) VALUES ($1, $2) RETURNING id', [identifiant, await hacher(MDP)]);
  return { id: r.rows[0]!.id, identifiant };
}

/** Crée un commerçant complet : invitation par l'administrateur, puis acceptation par le propriétaire. */
export async function creerCommercant(adminId: string, nom: string) {
  const tel = telephone();
  const inv = await inviterCommercant({ adminId, nomCommercant: nom, nom: `Propriétaire ${nom}`, telephone: tel });
  if (!inv.ok) throw new Error('invitation refusée');
  const acc = await accepterInvitation(inv.jeton, { motDePasse: MDP, commercant: { nom, nif: `NIF-${nom}`, adresse: `Adresse ${nom}` } });
  if (!acc.ok) throw new Error(`acceptation refusée : ${acc.raison}`);
  return { commercantId: acc.commercantId, proprietaireId: acc.utilisateurId, telephone: tel, jeton: inv.jeton };
}
