'use client';
// Panier de l'acheteur, gardé dans son téléphone (aucun compte). Les prix affichés ne sont qu'indicatifs :
// le serveur reprend toujours le prix de la fiche au moment du ticket.
import { useSyncExternalStore } from 'react';

export interface LignePanier {
  varianteId: string;
  produitId: string;
  nom: string;
  libelle: string;
  prix: number;
  quantite: number;
  max: number;
}

const cle = (sd: string) => `hanout.panier.${sd}`;
const EVENEMENT = 'hanout-panier';

function lire(sd: string): LignePanier[] {
  try {
    const v = JSON.parse(localStorage.getItem(cle(sd)) ?? '[]');
    return Array.isArray(v) ? v.slice(0, 50) : [];
  } catch {
    return [];
  }
}
// Même tableau tant que le contenu ne change pas (exigé par useSyncExternalStore).
const memo = new Map<string, { brut: string | null; valeur: LignePanier[] }>();
function instantane(sd: string): LignePanier[] {
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(cle(sd));
  } catch {
    brut = null;
  }
  const m = memo.get(sd);
  if (m && m.brut === brut) return m.valeur;
  const valeur = lire(sd);
  memo.set(sd, { brut, valeur });
  return valeur;
}
const VIDE: LignePanier[] = [];

export function ecrirePanier(sd: string, lignes: LignePanier[]): void {
  try {
    if (lignes.length) localStorage.setItem(cle(sd), JSON.stringify(lignes));
    else localStorage.removeItem(cle(sd));
  } catch {
    // Stockage refusé (navigation privée) : le panier reste vide.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function ajouterAuPanier(sd: string, l: Omit<LignePanier, 'quantite'>, quantite: number): void {
  const lignes = lire(sd);
  const deja = lignes.find((x) => x.varianteId === l.varianteId);
  if (deja) deja.quantite = Math.min(l.max, deja.quantite + quantite);
  else lignes.push({ ...l, quantite: Math.min(l.max, quantite) });
  ecrirePanier(sd, lignes.filter((x) => x.quantite > 0));
}

export function usePanier(sd: string): LignePanier[] {
  return useSyncExternalStore(
    (rappel) => {
      window.addEventListener(EVENEMENT, rappel);
      window.addEventListener('storage', rappel);
      return () => {
        window.removeEventListener(EVENEMENT, rappel);
        window.removeEventListener('storage', rappel);
      };
    },
    () => instantane(sd),
    () => VIDE,
  );
}
