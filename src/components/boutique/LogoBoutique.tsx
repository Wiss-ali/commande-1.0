// Logo d'une boutique : l'image envoyée par le commerçant, ou un logo dessiné par l'application (forme + icône ou
// initiales) dans la couleur de la boutique. Utilisé dans la boutique, dans l'assistant de création et les aperçus.
import {
  Baby, BookOpen, Cake, Car, Coffee, Crown, Dumbbell, Flower2, Footprints, Gem, Gift, Heart, Leaf, Palette, Scissors, Shirt, ShoppingBag, ShoppingBasket, Smartphone,
  Sofa, Sparkles, Star, Store, Watch, type LucideIcon,
} from 'lucide-react';
import { initiales, type IconeLogo } from '@/lib/design-boutique';
import type { FormeLogo } from '@/lib/types-bd';

export const ICONES: Record<IconeLogo, LucideIcon> = {
  sac: ShoppingBag, vetement: Shirt, beaute: Sparkles, bijou: Gem, montre: Watch, chaussure: Footprints, telephone: Smartphone, maison: Sofa, panier: ShoppingBasket,
  cafe: Coffee, gateau: Cake, fleur: Flower2, feuille: Leaf, enfant: Baby, sport: Dumbbell, livre: BookOpen, cadeau: Gift, coeur: Heart, etoile: Star, couronne: Crown,
  ciseaux: Scissors, palette: Palette, voiture: Car, magasin: Store,
};

const TAILLES = { s: { boite: 'size-9', icone: 'size-5', texte: 'text-sm' }, m: { boite: 'size-12', icone: 'size-6', texte: 'text-base' }, l: { boite: 'size-20', icone: 'size-10', texte: 'text-2xl' } } as const;

interface Props {
  nom: string;
  forme: FormeLogo;
  icone: string | null;
  /** Adresse de l'image envoyée par le commerçant ; prioritaire sur le logo dessiné. */
  image?: string | null;
  taille?: keyof typeof TAILLES;
  /** Affiche aussi le nom à côté du logo (en-tête de la boutique). */
  avecNom?: boolean;
  className?: string;
}

export function LogoBoutique({ nom, forme, icone, image, taille = 'm', avecNom, className = '' }: Props) {
  const t = TAILLES[taille];
  const Icone = icone ? ICONES[icone as IconeLogo] : undefined;
  const nomEcrit = avecNom ? <span className="b-titre truncate font-bold">{nom}</span> : null;
  if (image) {
    return (
      <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" width={80} height={80} className={`${t.boite} shrink-0 rounded-xl object-cover`} />
        {nomEcrit}
      </span>
    );
  }
  // « Texte » : le nom seul, précédé d'une petite icône ; pas de pastille.
  if (forme === 'texte') {
    return (
      <span className={`flex min-w-0 items-center gap-1.5 text-prim ${className}`}>
        {Icone ? <Icone aria-hidden className={`${t.icone} shrink-0`} strokeWidth={2.25} /> : null}
        <span className={`b-titre truncate font-bold ${taille === 'l' ? 'text-3xl' : taille === 'm' ? 'text-xl' : 'text-lg'}`}>{nom}</span>
      </span>
    );
  }
  const boite = forme === 'contour'
    ? 'rounded-full border-2 border-prim bg-prim-pale text-prim'
    : `${forme === 'rond' ? 'rounded-full' : 'rounded-[28%]'} bg-prim text-sur-prim`;
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span aria-hidden className={`${t.boite} ${boite} flex shrink-0 items-center justify-center`}>
        {Icone ? <Icone className={t.icone} strokeWidth={2} /> : <span className={`b-titre ${t.texte} font-bold leading-none`}>{initiales(nom)}</span>}
      </span>
      {nomEcrit}
    </span>
  );
}
