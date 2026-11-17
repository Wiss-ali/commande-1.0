'use client';
// Après un ticket réussi, le panier est vidé dans le téléphone de l'acheteur.
import { useEffect } from 'react';
import { ecrirePanier } from './panier';

export function ViderPanier({ sd }: { sd: string }) {
  useEffect(() => ecrirePanier(sd, []), [sd]);
  return null;
}
