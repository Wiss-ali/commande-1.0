// Petits composants d'affichage communs. Aucun texte ici : tout vient des traductions.
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export const classeBouton = {
  principal: 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-vert px-4 text-base font-semibold text-sur-vert disabled:opacity-60',
  secondaire: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-trait bg-surface px-4 text-sm font-semibold text-encre disabled:opacity-60',
  danger: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-terre bg-surface px-4 text-sm font-semibold text-terre disabled:opacity-60',
};

export function Champ({ libelle, aide, ...props }: { libelle: string; aide?: string } & ComponentProps<'input'>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{libelle}</span>
      <input {...props} className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre placeholder:text-doux" />
      {aide ? <span className="text-sm text-doux">{aide}</span> : null}
    </label>
  );
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-trait bg-surface p-4 ${className}`}>{children}</section>;
}

export function TitreSection({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-doux">{children}</h2>;
}

const TONS = {
  vert: 'bg-vert-pale text-vert',
  safran: 'bg-safran-pale text-sur-safran',
  terre: 'bg-terre-pale text-terre',
  bleu: 'bg-bleu-pale text-bleu',
  neutre: 'bg-creux text-doux',
};
// La forme change avec le ton : l'état reste lisible sans les couleurs.
const FORMES = { vert: 'rounded-full bg-current', safran: 'rotate-45 bg-current', terre: 'bg-current', bleu: 'rounded-full border-2 border-current', neutre: 'rounded-full border-2 border-current' };

export function Pastille({ ton, children }: { ton: keyof typeof TONS; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONS[ton]}`}>
      <span aria-hidden className={`size-2 ${FORMES[ton]}`} />
      {children}
    </span>
  );
}

export function EtatVide({ titre, texte, children }: { titre: string; texte: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-trait px-4 py-8 text-center">
      <p className="font-semibold">{titre}</p>
      <p className="text-sm text-doux">{texte}</p>
      {children}
    </div>
  );
}

export function LigneLien({ href, titre, aide, icone, fin }: { href: string; titre: string; aide?: string; icone?: ReactNode; fin?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-xl border border-trait bg-surface px-4 py-3">
      {icone ? <span className="text-vert">{icone}</span> : null}
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
  const c = { erreur: 'border-terre bg-terre-pale text-terre', succes: 'border-vert bg-vert-pale text-vert', info: 'border-safran bg-safran-pale text-sur-safran' }[ton];
  return (
    <p role={ton === 'erreur' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${c}`}>
      {children}
    </p>
  );
}
