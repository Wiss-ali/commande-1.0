// Mots de passe : Argon2id, règles NIST SP 800-63B révision 4 (longueur, pas de règle de composition,
// refus des mots de passe courants).
import { hash, verify } from '@node-rs/argon2';
import { COURANTS } from './mots-de-passe-courants.ts';

// Réglage minimum recommandé par OWASP pour Argon2id. Modifiable ici ; les anciens hachages
// sont refaits à la connexion suivante.
const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32, algorithm: 2 } as const;
const PREFIXE = `$argon2id$v=19$m=${PARAMS.memoryCost},t=${PARAMS.timeCost},p=${PARAMS.parallelism}$`;
export const LONGUEUR_MAX = 128;

export const hacher = (mdp: string) => hash(mdp, PARAMS);

export async function verifier(hache: string, mdp: string): Promise<boolean> {
  try {
    return await verify(hache, mdp);
  } catch {
    return false;
  }
}

export const aRehacher = (hache: string) => !hache.startsWith(PREFIXE);

// Hachage factice : la vérification prend le même temps que le compte existe ou non.
let factice: Promise<string> | undefined;
export async function verifierFactice(mdp: string): Promise<void> {
  factice ??= hacher('compte-inexistant-compte-inexistant');
  await verifier(await factice, mdp);
}

export type DefautMdp = 'mdp_trop_court' | 'mdp_trop_long' | 'mdp_trop_courant';

/** Vérifie un nouveau mot de passe. `contexte` : nom, téléphone… qu'il ne doit pas reprendre tel quel. */
export function defautMotDePasse(mdp: string, longueurMin: number, contexte: string[] = []): DefautMdp | null {
  const n = [...mdp].length;
  if (n < longueurMin) return 'mdp_trop_court';
  if (n > LONGUEUR_MAX) return 'mdp_trop_long';
  const bas = mdp.toLowerCase();
  if (COURANTS.has(bas)) return 'mdp_trop_courant';
  if (/^(.)\1+$/.test(mdp)) return 'mdp_trop_courant';
  if (contexte.some((c) => c && bas === c.toLowerCase())) return 'mdp_trop_courant';
  return null;
}
