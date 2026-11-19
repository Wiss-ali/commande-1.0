'use client';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePanier } from './panier';

export function CompteurPanier({ sd, base }: { sd: string; base: string }) {
  const t = useTranslations('boutique');
  const n = usePanier(sd).reduce((s, l) => s + l.quantite, 0);
  return (
    <Link href={`${base}/panier`} aria-label={t('panierCompte', { n })} className="b-bouton relative inline-flex min-h-11 min-w-11 items-center justify-center bg-prim text-sur-prim">
      <ShoppingBag aria-hidden className="size-5" />
      {n ? <span className="chiffres absolute -end-1.5 -top-1.5 rounded-full bg-surface px-1.5 text-xs font-bold text-prim ring-2 ring-prim">{n}</span> : null}
    </Link>
  );
}
