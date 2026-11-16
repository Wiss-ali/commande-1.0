import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { FormulaireProduit } from '@/components/FormulaireProduit';
import { Page } from '@/components/Page';
import { avecCommercant } from '@/lib/bd';
import { montantPourSaisie, nomLocal } from '@/lib/formats';
import { lireProduit, listerCategories } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ModifierProduit({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('stock.corriger', 'stock');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('produit');
  const langue = (await getLocale()) as Langue;
  const { produit, categories } = await avecCommercant(s.commercant.id, async (trx) => ({ produit: await lireProduit(trx, id), categories: await listerCategories(trx) }));
  if (!produit || produit.archive) notFound();
  return (
    <>
      <EnTete titre={t('modifierTitre')} retour={`/stock/${id}`} />
      <Page>
        <FormulaireProduit
          voitAchat
          produit={{ id, nomFr: produit.nom_fr, nomAr: produit.nom_ar, categorieId: produit.categorie_id, photo: produit.photo_id ? `/photos/${produit.photo_id}?t=p` : null }}
          variantes={produit.variantes.map((v) => ({
            id: v.id, libelle: v.libelle, code: v.code_barres ?? '', prixAchat: montantPourSaisie(v.prix_achat), prixVente: montantPourSaisie(v.prix_vente),
            seuil: String(v.seuil_alerte), stock: '', quantite: v.quantite,
          }))}
          categories={categories.map((c) => ({ id: c.id, nom: nomLocal(c, langue) }))}
        />
      </Page>
    </>
  );
}
