'use client';
// Mesure des publicités (pixel Facebook / Instagram, pixel TikTok), seulement si le commerçant l'a activée.
// Aucune donnée de l'acheteur n'est envoyée : la page vue, le produit et le montant de la commande seulement.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

type Evenement = 'ViewContent' | 'AddToCart' | 'Purchase';
type Fenetre = Window & { fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void; page: () => void } };
// TikTok : « PlaceAnOrder » pour une commande payée à la livraison.
const TIKTOK: Record<Evenement, string> = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', Purchase: 'PlaceAnOrder' };

/** Signale un événement aux pixels chargés ; ne fait rien si aucun pixel n'est actif. */
export function signalerPub(evenement: Evenement, d: { valeur: number; produitId?: string }) {
  const w = window as Fenetre;
  const value = d.valeur / 100;
  w.fbq?.('track', evenement, { value, currency: 'DZD', ...(d.produitId ? { content_ids: [d.produitId], content_type: 'product' } : {}) });
  w.ttq?.track(TIKTOK[evenement], { value, currency: 'DZD', ...(d.produitId ? { content_id: d.produitId, content_type: 'product' } : {}) });
}

/** Signale un événement une fois, à l'affichage de la page (produit vu, commande passée). */
export function SignalPub({ evenement, valeur, produitId }: { evenement: Evenement; valeur: number; produitId?: string }) {
  useEffect(() => signalerPub(evenement, { valeur, produitId }), [evenement, valeur, produitId]);
  return null;
}

/** Page vue à chaque changement de page dans la boutique (la première est signalée par le code de départ). */
export function SuiviPages() {
  const chemin = usePathname();
  const premiere = useRef(true);
  useEffect(() => {
    if (premiere.current) { premiere.current = false; return; }
    const w = window as Fenetre;
    w.fbq?.('track', 'PageView');
    w.ttq?.page();
  }, [chemin]);
  return null;
}
