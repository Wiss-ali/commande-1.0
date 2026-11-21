'use client';
// Volet replié : ce qui sert rarement reste caché derrière un lien (« Faire une remise », « Plus de détails »).
// Les champs restent dans la page (et dans le formulaire) même quand le volet est fermé.
// L'état ouvert de départ est figé : effacer un champ en tapant ne referme pas le volet sous les doigts.
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export function Repli({ titre, ouvert = false, encadre = false, fin, children }: {
  titre: ReactNode;
  /** Ouvert au départ (une valeur est déjà saisie, par exemple). */
  ouvert?: boolean;
  /** Volet en carte (réglages), au lieu d'un simple lien. */
  encadre?: boolean;
  /** Pastille ou indication à droite du titre (volet encadré). */
  fin?: ReactNode;
  children: ReactNode;
}) {
  const [depart] = useState(ouvert);
  if (encadre) {
    return (
      <details open={depart} className="group rounded-2xl border border-trait bg-surface shadow-doux">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><ChevronDown aria-hidden className="size-4 shrink-0 text-prim transition-transform group-open:rotate-180" />{titre}</span>
          {fin}
        </summary>
        <div className="flex flex-col gap-3 p-4 pt-0">{children}</div>
      </details>
    );
  }
  return (
    <details open={depart} className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-prim [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        {titre}
      </summary>
      <div className="flex flex-col gap-3 pt-2">{children}</div>
    </details>
  );
}
