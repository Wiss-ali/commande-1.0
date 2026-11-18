// Double authentification par code à 6 chiffres (TOTP) et codes de secours.
import { randomBytes } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { hacherJeton } from './chiffrement.ts';

const EMETTEUR = 'Hanout';

const totp = (secretBase32: string, compte: string) =>
  new TOTP({ issuer: EMETTEUR, label: compte, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secretBase32) });

export const nouveauSecretTotp = () => new Secret({ size: 20 }).base32;

/** Adresse otpauth:// à afficher en QR code. */
export const adresseTotp = (secretBase32: string, compte: string) => totp(secretBase32, compte).toString();

/**
 * Accepte le code courant, le précédent et le suivant (décalage d'horloge).
 * Renvoie la tranche de 30 secondes du code (pour refuser qu'il serve deux fois), ou null s'il est faux.
 */
export function pasTotpValide(secretBase32: string, code: string, maintenant = Date.now()): number | null {
  const propre = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(propre)) return null;
  const ecart = totp(secretBase32, 'x').validate({ token: propre, window: 1, timestamp: maintenant });
  return ecart === null ? null : Math.floor(maintenant / 30_000) + ecart;
}

export const codeTotpValide = (secretBase32: string, code: string): boolean => pasTotpValide(secretBase32, code) !== null;

export const codeTotpActuel = (secretBase32: string, maintenant = Date.now()) => totp(secretBase32, 'x').generate({ timestamp: maintenant });

/** Dix codes de secours à usage unique. Seules leurs empreintes sont stockées. */
export function nouveauxCodesSecours(): { clairs: string[]; hashes: string[] } {
  const clairs = Array.from({ length: 10 }, () => {
    const h = randomBytes(5).toString('hex');
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
  return { clairs, hashes: clairs.map(hacherCodeSecours) };
}
export const hacherCodeSecours = (code: string) => hacherJeton(`secours:${code.trim().toLowerCase()}`);
