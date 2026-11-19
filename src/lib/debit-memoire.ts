// Limite de débit en mémoire, pour le proxy (chaque requête) : sans base de données, donc sans coût.
// Chaque copie de l'application compte de son côté : la limite réelle est au plus le double, ce qui suffit
// contre un robot qui sature le site. Les limites sont larges : en Algérie, beaucoup de téléphones partagent
// la même adresse (réseau mobile, cybercafé).
const compteurs = new Map<string, { debut: number; n: number }>();
const MAX_CLES = 50_000;

/** Compte une requête ; faux si `max` est dépassé dans la fenêtre (en millisecondes). */
export function autoriserMemoire(cle: string, max: number, fenetre: number, maintenant = Date.now()): boolean {
  let c = compteurs.get(cle);
  if (!c || maintenant - c.debut >= fenetre) {
    if (!c && compteurs.size >= MAX_CLES) {
      // Mémoire bornée : on retire les compteurs périmés, et tout si cela ne suffit pas.
      for (const [k, v] of compteurs) if (maintenant - v.debut >= fenetre) compteurs.delete(k);
      if (compteurs.size >= MAX_CLES) compteurs.clear();
    }
    c = { debut: maintenant, n: 0 };
    compteurs.set(cle, c);
  }
  c.n += 1;
  return c.n <= max;
}

export const viderCompteursMemoire = () => compteurs.clear();
