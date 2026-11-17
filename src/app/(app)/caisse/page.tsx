import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Caisse, type ArticleCaisse } from '@/components/Caisse';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide, Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { pageUtilisateur } from '@/lib/web';

const MAX_ARTICLES = 5000;

export default async function PageCaisse() {
  const s = await pageUtilisateur('vendre', 'caisse');
  const t = await getTranslations('caisse');
  const articles: ArticleCaisse[] = (
    await avecCommercant(s.commercant.id, (trx) =>
      trx
        .selectFrom('variantes as v')
        .innerJoin('produits as p', 'p.id', 'v.produit_id')
        .innerJoin('stocks as k', 'k.variante_id', 'v.id')
        .select(['v.id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'v.code_barres', 'v.prix_vente', 'k.quantite', 'k.reservee'])
        .where('v.archive_le', 'is', null)
        .orderBy('p.nom_fr')
        .limit(MAX_ARTICLES)
        .execute())
  ).map((a) => ({ id: a.id, nomFr: a.nom_fr, nomAr: a.nom_ar, libelle: a.libelle, code: a.code_barres, prix: Number(a.prix_vente), stock: a.quantite - a.reservee }));

  return (
    <>
      <EnTete titre={t('titre')} fin={<Link href="/caisse/cloture" className="inline-flex min-h-11 items-center rounded-lg border border-trait bg-surface px-3 text-sm font-semibold">{t('cloture')}</Link>} />
      <Page>
        {s.commercant.etat !== 'actif' ? (
          <Message ton="info">{t('lectureSeule')}</Message>
        ) : articles.length ? (
          <Caisse articles={articles} magasin={s.commercant.id} />
        ) : (
          <EtatVide titre={t('videTitre')} texte={t('videTexte')}>
            <Link href="/stock" className={`${classeBouton.secondaire} mt-2`}>{t('allerStock')}</Link>
          </EtatVide>
        )}
      </Page>
    </>
  );
}
