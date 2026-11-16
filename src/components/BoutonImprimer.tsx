'use client';
import { Printer } from 'lucide-react';
import { classeBouton } from './ui';

export function BoutonImprimer({ texte }: { texte: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={classeBouton.principal}>
      <Printer aria-hidden className="size-5" />
      {texte}
    </button>
  );
}
