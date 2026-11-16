// Modèle Excel à remplir pour l'import, avec les titres dans la langue de l'utilisateur et deux exemples.
import { getLocale, getTranslations } from 'next-intl/server';
import { peut } from '@/lib/droits';
import { COLONNES } from '@/lib/import-produits';
import { ecrireXlsx } from '@/lib/tableur';
import { sessionUtilisateur } from '@/lib/web';

export async function GET() {
  const s = await sessionUtilisateur();
  if (!s?.complete || !peut(s.utilisateur.role, 'stock.corriger')) return new Response(null, { status: 401 });
  const t = await getTranslations('import');
  const arabe = (await getLocale()) === 'ar';
  const classeur = ecrireXlsx(
    [
      COLONNES.map((c) => t(`colonne.${c}`)),
      [t('exemple1'), arabe ? '' : 'قهوة مطحونة 250 غ', '', t('exempleCategorie'), '6130000000015', 180, 250, 24, 6],
      [t('exemple2'), '', 'M', '', '', 500, 900, 3, 1],
      [t('exemple2'), '', 'L', '', '', 500, 900, 2, 1],
    ],
    { droiteAGauche: arabe, largeurs: [28, 24, 12, 16, 18, 14, 14, 10, 14] },
  );
  return new Response(new Uint8Array(classeur), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="hanout-produits.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
