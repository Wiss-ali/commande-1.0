'use client';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePanier } from './panier';

export function CompteurPanier({ sd, base }: { sd: string; base: string }) {
  const t = useTranslations('boutique');
  const n = usePanier(sd).reduce((s, l) => s + l.quantite, 0);
  return (
    <Link href={`${base}/panier`} aria-label={t('panierCompte', { n })} className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-trait bg-surface">
      <ShoppingBag aria-hidden className="size-5" />
      {n ? <span className="chiffres absolute -end-1.5 -top-1.5 rounded-full bg-vert px-1.5 text-xs font-bold text-sur-vert">{n}</span> : null}
    </Link>
  );
}
