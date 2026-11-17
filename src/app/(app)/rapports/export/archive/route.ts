// Archive ZIP pour le comptable. Réservée au propriétaire (droit « rapports ») ; chaque export est journalisé,
// car il contient des données personnelles (noms et téléphones des clients).
import { avecCommercant } from '@/lib/bd';
import { config } from '@/lib/config';
import { autorise } from '@/lib/droits';
import { construireArchive } from '@/lib/export';
import { journaliser } from '@/lib/journal';
import { periodeLibre } from '@/lib/rapports';
import { infoRequete, sessionUtilisateur } from '@/lib/web';
import fr from '../../../../../../messages/fr.json';
import ar from '../../../../../../messages/ar.json';

const TEXTES = { fr: { ...fr.pdf, ...fr.export }, ar: { ...ar.pdf, ...ar.export } } as Record<'fr' | 'ar', Record<string, string>>;

export async function GET(requete: Request) {
  const s = await sessionUtilisateur();
  if (!s?.complete || !autorise(s.utilisateur, 'rapports') || !s.commercant.modules.rapports) return new Response(null, { status: 401 });
  const url = new URL(requete.url);
  const p = periodeLibre(url.searchParams.get('du') ?? '', url.searchParams.get('au') ?? '');
  // Adresse publique de l'application : derrière un proxy, l'adresse de la requête peut être interne.
  const retour = (erreur: string) => Response.redirect(new URL(`/rapports/export?erreur=${erreur}`, config().URL_APP), 303);
  if (!p) return retour('periode');
  const langue = url.searchParams.get('langue') === 'ar' ? 'ar' : 'fr';
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const a = await construireArchive(trx, { commercantId: s.commercant.id, periode: p, langue, textes: TEXTES[langue] });
    if (!('trop' in a)) {
      await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'export.archive', details: { du: p.du, au: p.au, documents: a.documents }, ip });
    }
    return a;
  });
  if ('trop' in r) return retour('trop');
  return new Response(new Uint8Array(r.zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="hanout-${p.du}-${p.au}.zip"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
