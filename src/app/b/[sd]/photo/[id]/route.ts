// Photo publique d'une boutique : seulement celle d'un produit publié, ou le logo et la bannière.
import { avecCommercant } from '@/lib/bd';
import { photoPublique } from '@/lib/boutique';
import { lirePhoto } from '@/lib/photos';
import { chargerVitrine } from '@/lib/vitrine-page';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(requete: Request, { params }: { params: Promise<{ sd: string; id: string }> }) {
  const { sd, id } = await params;
  const c = await chargerVitrine(sd);
  if (!c || (!c.v.disponible && !c.apercu) || !UUID.test(id)) return new Response(null, { status: 404 });
  const petite = new URL(requete.url).searchParams.get('t') === 'p';
  const image = await avecCommercant(c.v.commercantId, async (trx) => ((await photoPublique(trx, id)) ? lirePhoto(trx, c.v.commercantId, id, petite) : null));
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'public, max-age=86400' },
  });
}
