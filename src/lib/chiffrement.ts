// Chiffrement champ par champ en AES-256-GCM.
// Format stocké : v1.<numéro de clé>.<iv>.<texte chiffré + étiquette>, en base64url.
// Le « contexte » (table, colonne, identifiant) est lié au texte chiffré : une valeur copiée
// dans une autre ligne ne se déchiffre pas.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from './config.ts';

function cles(): Map<string, Buffer> {
  const m = new Map<string, Buffer>();
  for (const morceau of config().CLES_CHIFFREMENT.split(',')) {
    const i = morceau.indexOf(':');
    const id = morceau.slice(0, i).trim();
    const cle = Buffer.from(morceau.slice(i + 1).trim(), 'base64');
    if (!/^\d+$/.test(id) || cle.length !== 32) throw new Error('CLES_CHIFFREMENT : chaque clé doit faire 32 octets');
    m.set(id, cle);
  }
  return m;
}

export function chiffrer(clair: string, contexte: string): string {
  const id = config().CLE_CHIFFREMENT_ACTIVE;
  const cle = cles().get(id);
  if (!cle) throw new Error('Clé de chiffrement active introuvable');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cle, iv);
  c.setAAD(Buffer.from(contexte, 'utf8'));
  const corps = Buffer.concat([c.update(clair, 'utf8'), c.final(), c.getAuthTag()]);
  return `v1.${id}.${iv.toString('base64url')}.${corps.toString('base64url')}`;
}

export function dechiffrer(valeur: string, contexte: string): string {
  const [version, id, ivTexte, corpsTexte] = valeur.split('.');
  if (version !== 'v1' || !id || !ivTexte || !corpsTexte) throw new Error('Valeur chiffrée illisible');
  const cle = cles().get(id);
  if (!cle) throw new Error('Clé de chiffrement inconnue');
  const corps = Buffer.from(corpsTexte, 'base64url');
  const d = createDecipheriv('aes-256-gcm', cle, Buffer.from(ivTexte, 'base64url'));
  d.setAAD(Buffer.from(contexte, 'utf8'));
  d.setAuthTag(corps.subarray(corps.length - 16));
  return Buffer.concat([d.update(corps.subarray(0, corps.length - 16)), d.final()]).toString('utf8');
}

export const chiffrerOuNul = (v: string | null | undefined, contexte: string) => (v ? chiffrer(v, contexte) : null);
export const dechiffrerOuNul = (v: string | null | undefined, contexte: string) => (v ? dechiffrer(v, contexte) : null);

/** Vrai si la valeur n'est pas chiffrée avec la clé active (à rechiffrer lors d'un renouvellement). */
export const cleAncienne = (valeur: string) => valeur.split('.')[1] !== config().CLE_CHIFFREMENT_ACTIVE;

/** Empreinte de recherche : permet de retrouver une valeur exacte sans la stocker en clair. */
export function empreinte(valeur: string, usage: string): string {
  return createHmac('sha256', Buffer.from(config().CLE_HMAC, 'base64')).update(`${usage}\n${valeur}`).digest('base64url');
}

/** Jeton aléatoire impossible à deviner (256 bits) et son empreinte, seule stockée en base. */
export function nouveauJeton(): { jeton: string; hash: string } {
  const jeton = randomBytes(32).toString('base64url');
  return { jeton, hash: hacherJeton(jeton) };
}
export const hacherJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
