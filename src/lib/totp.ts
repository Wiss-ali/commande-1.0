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

/** Accepte le code courant, le précédent et le suivant (décalage d'horloge). */
export function codeTotpValide(secretBase32: string, code: string): boolean {
  const propre = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(propre)) return false;
  return totp(secretBase32, 'x').validate({ token: propre, window: 1 }) !== null;
}

export const codeTotpActuel = (secretBase32: string) => totp(secretBase32, 'x').generate();

/** Dix codes de secours à usage unique. Seules leurs empreintes sont stockées. */
export function nouveauxCodesSecours(): { clairs: string[]; hashes: string[] } {
  const clairs = Array.from({ length: 10 }, () => {
    const h = randomBytes(5).toString('hex');
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
  return { clairs, hashes: clairs.map(hacherCodeSecours) };
}
export const hacherCodeSecours = (code: string) => hacherJeton(`secours:${code.trim().toLowerCase()}`);
