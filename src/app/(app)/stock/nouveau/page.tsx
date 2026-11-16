import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireProduit } from '@/components/FormulaireProduit';
import { Page } from '@/components/Page';
import { avecCommercant } from '@/lib/bd';
import { normaliserCode } from '@/lib/codes-barres';
import { peut } from '@/lib/droits';
import { nomLocal } from '@/lib/formats';
import { listerCategories } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

export default async function NouveauProduit({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const s = await pageUtilisateur('produits.creer', 'stock');
  const t = await getTranslations('produit');
  const langue = (await getLocale()) as Langue;
  // Arrivée depuis le scan d'un code inconnu : le code est déjà rempli.
  const code = normaliserCode((await searchParams).code ?? '') ?? '';
  const categories = await avecCommercant(s.commercant.id, listerCategories);
  return (
    <>
      <EnTete titre={t('nouveauTitre')} retour="/stock" />
      <Page>
        <FormulaireProduit
          voitAchat={peut(s.utilisateur.role, 'rapports')}
          variantes={[{ libelle: '', code, prixAchat: '', prixVente: '', seuil: '', stock: '' }]}
          categories={categories.map((c) => ({ id: c.id, nom: nomLocal(c, langue) }))}
        />
      </Page>
    </>
  );
}
