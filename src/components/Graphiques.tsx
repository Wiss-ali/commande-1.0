// Graphiques de l'accueil et des rapports, dessinés par le serveur (SVG) : aucun script, rapides sur une
// connexion lente. Une seule série, dans la couleur d'action du produit ; les valeurs négatives en terre cuite.
// Survol : info-bulle native sur chaque barre (zone de toucher plus large que la barre).
// Accessibilité : description pour les lecteurs d'écran et tableau des chiffres sous le graphique.
import type { ReactNode } from 'react';

export interface Barre {
  /** Étiquette courte sous l'axe (« 17/11 »). */
  etiquette: string;
  valeur: number;
  /** Texte complet de l'info-bulle et du tableau (« 17/11/2026 : 12 500 DA »). */
  texte: string;
  /** Valeur mise en forme pour le tableau. */
  affichage: string;
}

const L = 320;
const H = 150;
const BAS = 22; // place des étiquettes
const HAUT = 8;

export function GraphiqueBarres({ titre, barres, voirChiffres, colonnes }: { titre: string; barres: Barre[]; voirChiffres: string; colonnes: [string, string] }) {
  const max = Math.max(0, ...barres.map((b) => b.valeur));
  const min = Math.min(0, ...barres.map((b) => b.valeur));
  const etendue = max - min || 1;
  const zone = H - BAS - HAUT;
  const y0 = HAUT + (max / etendue) * zone; // ligne de base
  const pas = L / Math.max(barres.length, 1);
  const largeur = Math.max(2, Math.min(28, pas - 2)); // 2 px d'écart entre barres
  const rayon = Math.min(4, largeur / 2);
  // Quelques étiquettes seulement : première, milieu, dernière.
  const montrees = new Set([0, Math.floor((barres.length - 1) / 2), barres.length - 1]);
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={titre} className="h-auto w-full overflow-visible" preserveAspectRatio="none">
        <line x1={0} x2={L} y1={y0} y2={y0} stroke="var(--trait)" strokeWidth={1} />
        {barres.map((b, i) => {
          const h = (Math.abs(b.valeur) / etendue) * zone;
          const x = i * pas + (pas - largeur) / 2;
          const r = Math.min(rayon, h);
          // Barre arrondie (4 px) du côté de la valeur, droite contre la ligne de base.
          const d = b.valeur >= 0
            ? `M${x},${y0} V${y0 - h + r} Q${x},${y0 - h} ${x + r},${y0 - h} H${x + largeur - r} Q${x + largeur},${y0 - h} ${x + largeur},${y0 - h + r} V${y0} Z`
            : `M${x},${y0} V${y0 + h - r} Q${x},${y0 + h} ${x + r},${y0 + h} H${x + largeur - r} Q${x + largeur},${y0 + h} ${x + largeur},${y0 + h - r} V${y0} Z`;
          return (
            <g key={i} className="barre">
              <title>{b.texte}</title>
              <rect x={i * pas} y={0} width={pas} height={H - BAS} fill="transparent" />
              {h > 0 ? <path d={d} fill={b.valeur >= 0 ? 'var(--vert)' : 'var(--terre)'} /> : null}
              {montrees.has(i) ? (
                <text x={i * pas + pas / 2} y={H - 6} textAnchor={i === 0 ? 'start' : i === barres.length - 1 ? 'end' : 'middle'} fontSize={10} fill="var(--doux)" className="chiffres">
                  {b.etiquette}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-vert">{voirChiffres}</summary>
        <table className="w-full text-start">
          <thead><tr className="text-doux"><th className="py-1 text-start font-medium">{colonnes[0]}</th><th className="py-1 text-end font-medium">{colonnes[1]}</th></tr></thead>
          <tbody>
            {barres.map((b, i) => (
              <tr key={i} className="border-t border-trait"><td className="chiffres py-1.5">{b.etiquette}</td><td className="py-1.5 text-end">{b.affichage}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Classement : une ligne par élément, nom et valeur écrits, barre proportionnelle. Lisible sans couleur. */
export function BarresHorizontales({ lignes }: { lignes: { cle: string; nom: ReactNode; valeur: number; affichage: ReactNode; detail?: ReactNode; ton?: 'vert' | 'terre' }[] }) {
  const max = Math.max(1, ...lignes.map((l) => Math.abs(l.valeur)));
  return (
    <ol className="flex flex-col gap-3">
      {lignes.map((l) => (
        <li key={l.cle} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{l.nom}</span>
            <span className="shrink-0 font-semibold">{l.affichage}</span>
          </div>
          {/* SVG plutôt qu'une largeur en style : la politique de sécurité interdit les styles en ligne. */}
          <svg viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden className="h-2 w-full rtl:-scale-x-100">
            <rect width={100} height={2} rx={1} fill="var(--creux)" />
            <rect width={Math.max(2, (Math.abs(l.valeur) / max) * 100)} height={2} rx={1} fill={l.ton === 'terre' ? 'var(--terre)' : 'var(--vert)'} />
          </svg>
          {l.detail ? <p className="text-xs text-doux">{l.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
