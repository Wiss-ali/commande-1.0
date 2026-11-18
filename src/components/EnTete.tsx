// En-tête de chaque écran : titre, retour éventuel. Le commerçant choisit sa langue dans « Plus » ;
// l'administration et les pages publiques (connexion, boutique) gardent le bouton de langue.
import { ArrowLeft, Bell, Languages } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { changerLangue } from '@/app/actions/preferences';
import { avecCommercant } from '@/lib/bd';
import { compterNonVues } from '@/lib/boutique';
import { autorise } from '@/lib/droits';
import { sessionUtilisateur } from '@/lib/web';

// Le nom d'une langue s'écrit toujours dans cette langue : ce n'est pas un texte à traduire.
const AUTRE = { fr: { code: 'ar', nom: 'العربية' }, ar: { code: 'fr', nom: 'Français' } } as const;

export async function BoutonLangue() {
  const langue = (await getLocale()) as 'fr' | 'ar';
  const t = await getTranslations('commun');
  const autre = AUTRE[langue];
  return (
    <form action={changerLangue}>
      <input type="hidden" name="langue" value={autre.code} />
      <button type="submit" lang={autre.code} aria-label={`${t('changerLangue')} : ${autre.nom}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-trait bg-surface px-3 text-sm font-semibold">
        <Languages aria-hidden className="size-4" />
        {autre.nom}
      </button>
    </form>
  );
}

/** Cloche des notifications (nouvelles commandes de la boutique), pour les personnes qui vendent. */
async function Cloche() {
  const s = await sessionUtilisateur();
  if (!s?.complete || !autorise(s.utilisateur, 'vendre') || !s.commercant.modules.commandes) return null;
  const n = await avecCommercant(s.commercant.id, (trx) => compterNonVues(trx, s.utilisateur.id));
  const t = await getTranslations('notifications');
  return (
    <Link href="/notifications" aria-label={t('cloche', { n })} className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-trait bg-surface">
      <Bell aria-hidden className="size-5" />
      {n ? <span className="chiffres absolute -end-1.5 -top-1.5 rounded-full bg-terre px-1.5 text-xs font-bold text-white ring-2 ring-surface">{n > 99 ? '99+' : n}</span> : null}
    </Link>
  );
}

export async function EnTete({ titre, retour, fin, admin }: { titre: string; retour?: string; fin?: ReactNode; admin?: boolean }) {
  const t = await getTranslations('commun');
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-trait bg-surface/85 px-4 backdrop-blur-md">
      {retour ? (
        <Link href={retour} aria-label={t('retour')} className="-ms-2 inline-flex size-11 items-center justify-center rounded-xl hover:bg-prim-pale">
          <ArrowLeft aria-hidden className="directionnelle size-5" />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{titre}</h1>
      {fin}
      {admin ? <BoutonLangue /> : <Cloche />}
    </header>
  );
}
