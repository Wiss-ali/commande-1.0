// Codes-barres : nettoyage de la saisie, clé de contrôle, codes internes. Utilisable côté serveur et navigateur.
import { chiffresLatins } from './formats.ts';

/** Clé de contrôle GS1 (EAN-8, UPC-A, EAN-13) des chiffres donnés sans la clé. */
export function cleControle(sansCle: string): number {
  let somme = 0;
  for (let i = 0; i < sansCle.length; i++) {
    // Le chiffre le plus à droite compte triple, puis un sur deux.
    somme += Number(sansCle[sansCle.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (somme % 10)) % 10;
}

const cleJuste = (code: string) => cleControle(code.slice(0, -1)) === Number(code.slice(-1));

/**
 * Code scanné ou saisi → forme stockée, ou null s'il est inutilisable.
 * Un UPC-A (12 chiffres) est le même article que l'EAN-13 qui commence par 0 : selon le lecteur,
 * l'un ou l'autre est renvoyé. On garde toujours la forme à 13 chiffres.
 */
export function normaliserCode(saisie: string): string | null {
  const code = chiffresLatins(saisie).trim().replace(/\s+/g, '');
  if (!/^[\x21-\x7E]{1,64}$/.test(code)) return null;
  if (/^\d{12}$/.test(code) && cleJuste(code)) return `0${code}`;
  return code;
}

export type Symbologie = 'ean13' | 'ean8' | 'code128' | 'qrcode';

/** Type de code-barres à imprimer pour ce code : EAN quand il est valide, sinon Code 128. */
export function symbologie(code: string): Exclude<Symbologie, 'qrcode'> {
  if (/^\d{13}$/.test(code) && cleJuste(code)) return 'ean13';
  if (/^\d{8}$/.test(code) && cleJuste(code)) return 'ean8';
  return 'code128';
}

/**
 * Code interne pour un produit sans code-barres : EAN-13 commençant par 2.
 * La plage 200-299 est réservée par GS1 à l'usage interne d'un magasin : aucun produit du commerce ne la porte.
 */
export function codeInterne(aleatoire: () => number = Math.random): string {
  let corps = '2';
  for (let i = 0; i < 11; i++) corps += Math.floor(aleatoire() * 10);
  return corps + cleControle(corps);
}
