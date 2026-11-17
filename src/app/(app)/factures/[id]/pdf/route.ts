// PDF d'un document, en français ou en arabe, pour un utilisateur connecté du commerçant concerné.
import { avecCommercant } from '@/lib/bd';
import { lireDocument, mentionsVendeur, numeroTexte } from '@/lib/documents';
import { peut } from '@/lib/droits';
import { enPdf, htmlDocument } from '@/lib/pdf';
import { sessionUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessionUtilisateur();
  if (!s?.complete || !peut(s.utilisateur.role, 'vendre')) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const choix = new URL(requete.url).searchParams.get('langue');
  const langue = choix === 'ar' || choix === 'fr' ? choix : s.utilisateur.langue;
  const lu = await avecCommercant(s.commercant.id, async (trx) => {
    const document = await lireDocument(trx, id);
    return document ? { document, reglages: (await mentionsVendeur(trx, s.commercant.id)).reglages } : null;
  });
  if (!lu) return new Response(null, { status: 404 });
  const pdf = await enPdf(htmlDocument(lu.document, langue, lu.reglages));
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${numeroTexte(lu.document)}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
