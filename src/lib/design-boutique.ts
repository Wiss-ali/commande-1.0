// Design des boutiques en ligne : couleurs, ambiances, logos dessinés et activités. Ce fichier ne touche pas à la
// base : il sert aussi bien au serveur qu'aux écrans du navigateur (assistant de création, aperçus).
import type { AmbianceBoutique, FormeLogo } from './types-bd.ts';

/**
 * Couleurs principales proposées : chacune garde un contraste d'au moins 4,5:1 avec le texte blanc des boutons
 * (vérifié par un test). Le commerçant choisit une clé, jamais une couleur libre.
 */
export const PALETTE: Record<string, { fond: string; pale: string }> = {
  emeraude: { fond: '#0e6b4e', pale: '#dcefe6' },
  canard: { fond: '#0f766e', pale: '#d5efec' },
  bleu: { fond: '#1d4ed8', pale: '#dbe5fb' },
  marine: { fond: '#1e3a8a', pale: '#dde4f6' },
  violet: { fond: '#6b21a8', pale: '#eadcf5' },
  rose: { fond: '#be185d', pale: '#fbe0ec' },
  bordeaux: { fond: '#9b1c31', pale: '#f6dde1' },
  terre: { fond: '#a63a24', pale: '#f6e0da' },
  ocre: { fond: '#92580a', pale: '#f6ead3' },
  olive: { fond: '#4d6b12', pale: '#e5edd5' },
  encre: { fond: '#1f2937', pale: '#e3e6ea' },
};

/** Ambiances : polices des titres et forme des coins. Le texte courant reste lisible (Inter, IBM Plex Sans Arabic). */
export const AMBIANCES: readonly AmbianceBoutique[] = ['moderne', 'elegant', 'chaleureux', 'audacieux'];

/** Formes du logo dessiné par l'application quand le commerçant n'envoie pas d'image. */
export const FORMES_LOGO: readonly FormeLogo[] = ['rond', 'carre', 'contour', 'texte'];

/** Icônes proposées pour le logo dessiné (noms des icônes dans components/boutique/LogoBoutique.tsx). */
export const ICONES_LOGO = [
  'sac', 'vetement', 'beaute', 'bijou', 'montre', 'chaussure', 'telephone', 'maison', 'panier', 'cafe', 'gateau', 'fleur', 'feuille', 'enfant', 'sport', 'livre',
  'cadeau', 'coeur', 'etoile', 'couronne', 'ciseaux', 'palette', 'voiture', 'magasin',
] as const;
export type IconeLogo = (typeof ICONES_LOGO)[number];

/**
 * Activités : chacune propose une icône, une couleur, une ambiance et des textes d'exemple (fichiers de traduction,
 * « boutiqueExemples.<activité> ») que le commerçant remplace par les siens.
 */
export const ACTIVITES: Record<string, { icone: IconeLogo; couleur: string; ambiance: AmbianceBoutique }> = {
  vetements: { icone: 'vetement', couleur: 'encre', ambiance: 'elegant' },
  beaute: { icone: 'beaute', couleur: 'rose', ambiance: 'chaleureux' },
  bijoux: { icone: 'bijou', couleur: 'bordeaux', ambiance: 'elegant' },
  electronique: { icone: 'telephone', couleur: 'marine', ambiance: 'audacieux' },
  epicerie: { icone: 'panier', couleur: 'emeraude', ambiance: 'chaleureux' },
  maison: { icone: 'maison', couleur: 'terre', ambiance: 'moderne' },
  enfants: { icone: 'enfant', couleur: 'canard', ambiance: 'chaleureux' },
  autre: { icone: 'sac', couleur: 'bleu', ambiance: 'moderne' },
};
export const LISTE_ACTIVITES = Object.keys(ACTIVITES);

/** Initiales du magasin pour le logo dessiné : deux premières lettres des deux premiers mots (ou du seul mot). */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/[\s\-_.']+/u).filter((m) => /\p{L}|\p{N}/u.test(m));
  if (!mots.length) return '?';
  const lettre = (m: string) => [...m].find((c) => /\p{L}|\p{N}/u.test(c)) ?? '';
  const r = mots.length === 1 ? [...mots[0]!].filter((c) => /\p{L}|\p{N}/u.test(c)).slice(0, 2).join('') : lettre(mots[0]!) + lettre(mots[1]!);
  return r.toLocaleUpperCase('fr');
}

/** Nom d'adresse proposé à partir du nom du magasin : sans accents, minuscules, tirets. */
export function adresseProposee(nom: string): string {
  const s = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 40).replace(/-+$/, '');
  return s.length >= 3 ? s : '';
}

/** Feuille de style d'une boutique : couleur choisie (clair et sombre). Insérée avec le nonce de la page (CSP). */
export function styleCouleur(cle: string, selecteur = '.boutique'): string {
  const c = PALETTE[cle] ?? PALETTE.emeraude!;
  return `${selecteur}{--prim:${c.fond};--prim-fort:${c.fond};--prim-pale:${c.pale};--sur-prim:#fff;--ombre-prim:none;--b-fond:${c.fond};--b-pale:${c.pale}}`
    + `@media (prefers-color-scheme:dark){:root:not([data-theme=clair]) ${selecteur}{--prim:${c.pale};--prim-fort:${c.pale};--sur-prim:${c.fond};--prim-pale:${c.fond}}}`
    + `:root[data-theme=sombre] ${selecteur}{--prim:${c.pale};--prim-fort:${c.pale};--sur-prim:${c.fond};--prim-pale:${c.fond}}`;
}
