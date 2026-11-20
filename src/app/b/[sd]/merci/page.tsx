// Page « merci » : ouverte seulement dans un cadre invisible du ticket, juste après une commande, quand le commerçant
// a activé un pixel. Elle signale la commande (montant seulement) à Facebook / TikTok. Le cadre est isolé
// (« sandbox ») : le programme du pixel ne voit ni le ticket, ni son lien privé, ni le nom de l'acheteur.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Pixels } from '@/components/boutique/Pixels';
import { chargerVitrine } from '@/lib/vitrine-page';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Merci({ params, searchParams }: { params: Promise<{ sd: string }>; searchParams: Promise<{ v?: string }> }) {
  const c = await chargerVitrine((await params).sd);
  if (!c || c.apercu || !c.v.disponible) notFound();
  const v = (await searchParams).v ?? '';
  const montant = /^\d{1,12}$/.test(v) ? Number(v) : 0;
  const r = c.v.reglages;
  return <Pixels facebook={r.pixels.facebook} tiktok={r.pixels.tiktok} nonce={c.nonce} achat={montant} />;
}
