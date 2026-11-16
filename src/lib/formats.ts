// Formats d'affichage et de saisie communs aux deux langues. Utilisable côté serveur et côté navigateur.
import type { Langue } from './types-bd.ts';

const INSECABLE = ' ';

/**
 * Montant en centimes de dinar → « 12 500 DA » ou « 12 500 د.ج ». Chiffres 0-9 dans les deux langues.
 * L'espace insécable entre les groupes de chiffres est obligatoire : avec une espace normale,
 * l'arabe afficherait les groupes à l'envers (« 500 12 »).
 */
export function formaterMontant(centimes: number | bigint, langue: Langue): string {
  const n = BigInt(centimes);
  const negatif = n < 0n;
  const abs = negatif ? -n : n;
  const entier = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE);
  const reste = abs % 100n;
  const decimales = reste === 0n ? '' : `,${reste.toString().padStart(2, '0')}`;
  const nombre = `${negatif ? '-' : ''}${entier}${decimales}`;
  // En arabe, le nombre est isolé (U+2066 … U+2069) pour rester écrit de gauche à droite :
  // l'espace insécable seule ne suffit pas, les groupes de chiffres s'affichent sinon à l'envers (« 200 1 »).
  return langue === 'ar' ? `\u2066${nombre}\u2069${INSECABLE}د.ج` : `${nombre}${INSECABLE}DA`;
}

/** Nombre entier avec séparateur de milliers insécable. */
export const formaterNombre = (n: number) => Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE);

/** Date au format JJ/MM/AAAA, à l'heure d'Alger. */
export function formaterDate(date: Date): string {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Algiers', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')}`;
}

/** Heure HH:MM, à l'heure d'Alger. */
export function formaterHeure(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Algiers', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

/**
 * Téléphone algérien : renvoie les 10 chiffres (« 0550123456 ») ou null si le numéro est invalide.
 * Accepte les espaces, points, tirets, et les préfixes +213 ou 00213.
 */
export function normaliserTelephone(saisie: string): string | null {
  // Les chiffres arabes (٠-٩) sont acceptés à la saisie et convertis.
  let t = saisie.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\s.\-()]/g, '');
  if (t.startsWith('+213')) t = `0${t.slice(4)}`;
  else if (t.startsWith('00213')) t = `0${t.slice(5)}`;
  return /^0\d{9}$/.test(t) ? t : null;
}

/** « 0550123456 » → « 0550 12 34 56 » (espaces insécables). */
export function formaterTelephone(t: string): string {
  return /^0\d{9}$/.test(t) ? [t.slice(0, 4), t.slice(4, 6), t.slice(6, 8), t.slice(8)].join(INSECABLE) : t;
}

/** Remplace les chiffres arabes (٠-٩) par 0-9 : acceptés à la saisie, jamais stockés. */
export const chiffresLatins = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

/**
 * Montant saisi (« 1 250 », « 1250,50 », « 1250.5 ») → centimes de dinar, ou null si la saisie est invalide.
 * Une saisie vide vaut null : à l'appelant de décider si le champ est obligatoire.
 */
export function analyserMontant(saisie: string): number | null {
  const t = chiffresLatins(saisie).replace(/[\s\u00a0\u202f]/g, '').replace(/(DA|د\.ج)$/i, '').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(t)) return null;
  const [entier, decimales = ''] = t.split('.');
  return Number(entier) * 100 + Number(decimales.padEnd(2, '0'));
}

/** Quantité entière saisie, entre 0 et 1 000 000, ou null. */
export function analyserQuantite(saisie: string): number | null {
  const t = chiffresLatins(saisie).replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d{1,7}$/.test(t)) return null;
  const n = Number(t);
  return n <= 1_000_000 ? n : null;
}

/** Centimes → texte pour un champ de saisie (« 1250 » ou « 1250,50 »). */
export function montantPourSaisie(centimes: number | string | bigint): string {
  const n = BigInt(centimes);
  const reste = n % 100n;
  return `${n / 100n}${reste === 0n ? '' : `,${reste.toString().padStart(2, '0')}`}`;
}

/** Nom d'un produit ou d'une catégorie dans la langue de l'écran, avec repli sur l'autre langue. */
export const nomLocal = (o: { nom_fr: string; nom_ar: string }, langue: Langue) => (langue === 'ar' ? o.nom_ar || o.nom_fr : o.nom_fr || o.nom_ar);
