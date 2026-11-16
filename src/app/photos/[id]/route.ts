// Sert la photo d'un produit, uniquement à un utilisateur connecté du commerçant concerné.
import { avecCommercant } from '@/lib/bd';
import { lirePhoto } from '@/lib/photos';
import { sessionUtilisateur } from '@/lib/web';

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessionUtilisateur();
  if (!s?.complete) return new Response(null, { status: 401 });
  const { id } = await params;
  const petite = new URL(requete.url).searchParams.get('t') === 'p';
  const image = await avecCommercant(s.commercant.id, (trx) => lirePhoto(trx, s.commercant.id, id, petite));
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      // L'adresse change quand la photo change : le téléphone peut la garder longtemps.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
