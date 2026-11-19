// Textes d'exemple d'une boutique, lus dans les deux fichiers de traduction (français et arabe) quelle que soit
// la langue de l'écran : la boutique est créée avec les deux versions, et l'écran signale celles encore en place.
import ar from '../../messages/ar.json';
import fr from '../../messages/fr.json';
import type { TextesExemple } from './boutique.ts';
import { ACTIVITES } from './design-boutique.ts';

type Exemples = Record<string, Record<keyof TextesExemple, string>>;

export function textesExemple(activite: string): TextesExemple {
  const a = ACTIVITES[activite] ? activite : 'autre';
  const lire = (m: { boutiqueExemples: Exemples }) => m.boutiqueExemples[a]!;
  const f = lire(fr as { boutiqueExemples: Exemples });
  const r = lire(ar as { boutiqueExemples: Exemples });
  return { slogan: { fr: f.slogan, ar: r.slogan }, accueil: { fr: f.accueil, ar: r.accueil }, livraison: { fr: f.livraison, ar: r.livraison }, retour: { fr: f.retour, ar: r.retour } };
}
