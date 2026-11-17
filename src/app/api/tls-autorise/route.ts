// Point de contrôle de Caddy avant de demander un certificat HTTPS (« On-Demand TLS ») :
// 200 seulement pour le domaine principal ou le sous-domaine d'une boutique qui existe.
// Sans ce contrôle, n'importe qui pourrait faire demander des milliers de certificats, et l'autorité bloquerait le serveur.
import { bd } from '@/lib/bd';
import { verifierSousDomaine } from '@/lib/boutique';

export const dynamic = 'force-dynamic';

export async function GET(requete: Request) {
  const domaine = (new URL(requete.url).searchParams.get('domain') ?? '').toLowerCase();
  const racine = process.env.DOMAINE_BOUTIQUES;
  if (!racine || !domaine.endsWith(`.${racine}`)) return new Response(null, { status: 403 });
  const nom = verifierSousDomaine(domaine.slice(0, -racine.length - 1));
  if (!nom) return new Response(null, { status: 403 });
  const existe = await bd('auth').selectFrom('commercants').select('id').where('sous_domaine', '=', nom).executeTakeFirst();
  return new Response(null, { status: existe ? 200 : 403 });
}
