// Barre du bas : 4 entrées choisies par chaque personne parmi celles qu'elle peut ouvrir, puis « Plus ».
import { DROIT_MODULE, MODULES, peut } from './droits.ts';
import type { Modules, NomModule, Role } from './types-bd.ts';

export type EntreeBarre = 'accueil' | 'scan' | NomModule;
/** Ordre par défaut : la barre d'origine (Accueil, Caisse, Scan, Stock), complétée si une entrée manque. */
const ORDRE_DEFAUT: readonly EntreeBarre[] = ['accueil', 'caisse', 'scan', 'stock', 'commandes', 'factures', 'clients', 'boutique', 'rapports'];
export const TAILLE_BARRE = 4;

/** Entrées que cette personne peut mettre dans sa barre (selon son rôle et les modules ouverts). */
export function entreesDisponibles(role: Role, modules: Modules): EntreeBarre[] {
  const r: EntreeBarre[] = ['accueil'];
  if (modules.stock && peut(role, DROIT_MODULE.stock)) r.push('scan');
  for (const m of MODULES) if (modules[m] && peut(role, DROIT_MODULE[m])) r.push(m);
  return ORDRE_DEFAUT.filter((e) => r.includes(e));
}

/**
 * Barre affichée : le choix de la personne (sans doublon, seulement ce qu'elle peut ouvrir), sinon l'ordre par
 * défaut. Si une entrée choisie n'est plus ouverte (module retiré), la place est complétée par défaut.
 */
export function barreDe(choix: readonly string[] | null | undefined, disponibles: EntreeBarre[]): EntreeBarre[] {
  const voulue = choix?.length ? [...new Set(choix)].filter((e): e is EntreeBarre => disponibles.includes(e as EntreeBarre)).slice(0, TAILLE_BARRE) : [];
  const taille = Math.min(choix?.length ? Math.min(choix.length, TAILLE_BARRE) : TAILLE_BARRE, disponibles.length);
  for (const e of disponibles) {
    if (voulue.length >= taille) break;
    if (!voulue.includes(e)) voulue.push(e);
  }
  return voulue;
}

export const lienEntree = (e: EntreeBarre) => (e === 'accueil' ? '/' : `/${e}`);
