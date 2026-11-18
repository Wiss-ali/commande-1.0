// Petits composants d'affichage communs. Aucun texte ici : tout vient des traductions.
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export const classeBouton = {
  principal: 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-prim px-4 text-base font-semibold text-sur-prim shadow-prim hover:bg-prim-fort active:translate-y-px disabled:opacity-60 disabled:shadow-none',
  secondaire: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-trait-fort bg-surface px-4 text-sm font-semibold text-prim hover:border-prim hover:bg-prim-pale disabled:opacity-60',
  danger: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-terre/50 bg-surface px-4 text-sm font-semibold text-terre hover:border-terre hover:bg-terre-pale disabled:opacity-60',
};

export function Champ({ libelle, aide, ...props }: { libelle: string; aide?: string } & ComponentProps<'input'>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{libelle}</span>
      <input {...props} className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3.5 text-base text-encre placeholder:text-doux/70" />
      {aide ? <span className="text-sm text-doux">{aide}</span> : null}
    </label>
  );
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-trait bg-surface shadow-doux p-4 ${className}`}>{children}</section>;
}

export function TitreSection({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-doux">{children}</h2>;
}

const TONS = {
  vert: 'bg-ok-pale text-ok',
  safran: 'bg-safran-pale text-sur-safran',
  terre: 'bg-terre-pale text-terre',
  bleu: 'bg-bleu-pale text-bleu',
  neutre: 'bg-creux text-doux',
};
// La forme change avec le ton : l'état reste lisible sans les couleurs.
const FORMES = { vert: 'rounded-full bg-current', safran: 'rotate-45 bg-current', terre: 'bg-current', bleu: 'rounded-full border-2 border-current', neutre: 'rounded-full border-2 border-current' };

export function Pastille({ ton, children }: { ton: keyof typeof TONS; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-current/15 ring-inset ${TONS[ton]}`}>
      <span aria-hidden className={`size-2 ${FORMES[ton]}`} />
      {children}
    </span>
  );
}

export function EtatVide({ titre, texte, children }: { titre: string; texte: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-trait-fort bg-surface/60 px-4 py-10 text-center">
      <p className="font-semibold">{titre}</p>
      <p className="text-sm text-doux">{texte}</p>
      {children}
    </div>
  );
}

export function LigneLien({ href, titre, aide, icone, fin }: { href: string; titre: string; aide?: string; icone?: ReactNode; fin?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl border border-trait bg-surface px-4 py-3 shadow-doux hover:border-trait-fort">
      {icone ? <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-prim-pale text-prim">{icone}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{titre}</span>
        {aide ? <span className="block text-sm text-doux">{aide}</span> : null}
      </span>
      {fin}
      <ChevronRight aria-hidden className="directionnelle size-5 shrink-0 text-doux" />
    </Link>
  );
}

export function Message({ ton, children }: { ton: 'erreur' | 'succes' | 'info'; children: ReactNode }) {
  const c = { erreur: 'border-terre/40 bg-terre-pale text-terre', succes: 'border-ok/40 bg-ok-pale text-ok', info: 'border-safran/50 bg-safran-pale text-sur-safran' }[ton];
  return (
    <p role={ton === 'erreur' ? 'alert' : 'status'} className={`rounded-xl border px-3.5 py-3 text-sm font-medium ${c}`}>
      {children}
    </p>
  );
}
