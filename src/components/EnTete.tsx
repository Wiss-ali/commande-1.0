// En-tête de chaque écran : titre, retour éventuel, et bouton de langue (présent partout).
import { ArrowLeft, Languages } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { changerLangue } from '@/app/actions/preferences';

// Le nom d'une langue s'écrit toujours dans cette langue : ce n'est pas un texte à traduire.
const AUTRE = { fr: { code: 'ar', nom: 'العربية' }, ar: { code: 'fr', nom: 'Français' } } as const;

export async function BoutonLangue() {
  const langue = (await getLocale()) as 'fr' | 'ar';
  const t = await getTranslations('commun');
  const autre = AUTRE[langue];
  return (
    <form action={changerLangue}>
      <input type="hidden" name="langue" value={autre.code} />
      <button type="submit" lang={autre.code} aria-label={`${t('changerLangue')} : ${autre.nom}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-trait bg-surface px-3 text-sm font-semibold">
        <Languages aria-hidden className="size-4" />
        {autre.nom}
      </button>
    </form>
  );
}

export async function EnTete({ titre, retour, fin }: { titre: string; retour?: string; fin?: ReactNode }) {
  const t = await getTranslations('commun');
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-trait bg-surface px-4">
      {retour ? (
        <Link href={retour} aria-label={t('retour')} className="-ms-2 inline-flex size-11 items-center justify-center rounded-lg">
          <ArrowLeft aria-hidden className="directionnelle size-5" />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{titre}</h1>
      {fin}
      <BoutonLangue />
    </header>
  );
}
