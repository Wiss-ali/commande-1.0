import { sql } from 'kysely';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Caisse, type ArticleCaisse } from '@/components/Caisse';
import { peutRemiser } from '@/lib/droits';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide, Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { pageUtilisateur } from '@/lib/web';

const MAX_ARTICLES = 5000;

export default async function PageCaisse() {
  const s = await pageUtilisateur('vendre', 'caisse');
  const t = await getTranslations('caisse');
  // Tous les produits, les plus vendus des 90 derniers jours en premier, puis par ordre alphabétique.
  const lignes = await avecCommercant(s.commercant.id, (trx) =>
    sql<{ id: string; nom_fr: string; nom_ar: string; libelle: string; code_barres: string | null; prix_vente: string; disponible: number; photo_id: string | null; categorie_id: string | null; cat_fr: string | null; cat_ar: string | null }>`
      SELECT v.id, p.nom_fr, p.nom_ar, v.libelle, p.categorie_id, c.nom_fr AS cat_fr, c.nom_ar AS cat_ar, v.code_barres, v.prix_vente, (k.quantite - k.reservee)::int AS disponible,
        (SELECT ph.id FROM photos_produit ph WHERE ph.produit_id = p.id ORDER BY ph.ordre, ph.cree_le DESC LIMIT 1) AS photo_id
      FROM variantes v
      JOIN produits p ON p.id = v.produit_id
      JOIN stocks k ON k.variante_id = v.id
      LEFT JOIN categories c ON c.id = p.categorie_id
      LEFT JOIN (
        SELECT l.variante_id, sum(l.quantite) AS vendus
        FROM lignes_document l JOIN documents d ON d.id = l.document_id
        WHERE d.type IN ('ticket', 'facture') AND d.emis_le > now() - interval '90 days'
        GROUP BY l.variante_id
      ) ventes ON ventes.variante_id = v.id
      WHERE v.archive_le IS NULL
      ORDER BY coalesce(ventes.vendus, 0) DESC, p.nom_fr, v.libelle
      LIMIT ${MAX_ARTICLES}`.execute(trx));
  const articles: ArticleCaisse[] = lignes.rows.map((a) => ({
    id: a.id, nomFr: a.nom_fr, nomAr: a.nom_ar, libelle: a.libelle, code: a.code_barres, prix: Number(a.prix_vente), stock: a.disponible,
    photo: a.photo_id ? `/photos/${a.photo_id}?t=p` : null, categorie: a.categorie_id,
  }));
  // Catégories utilisées par au moins un produit : boutons de filtre de la caisse (seulement s'il y en a deux ou plus).
  const categories = [...new Map(lignes.rows.filter((a) => a.categorie_id).map((a) => [a.categorie_id!, { id: a.categorie_id!, nomFr: a.cat_fr ?? '', nomAr: a.cat_ar ?? '' }])).values()]
    .sort((x, y) => (x.nomFr || x.nomAr).localeCompare(y.nomFr || y.nomAr, 'fr'));

  return (
    <>
      <EnTete titre={t('titre')} fin={
        <span className="flex gap-2">
          <Link href="/caisse/depenses" className="inline-flex min-h-11 items-center rounded-xl border border-trait bg-surface px-3 text-sm font-semibold">{t('depenses')}</Link>
          <Link href="/caisse/cloture" className="inline-flex min-h-11 items-center rounded-xl border border-trait bg-surface px-3 text-sm font-semibold">{t('cloture')}</Link>
        </span>
      } />
      <Page>
        {s.commercant.etat !== 'actif' ? (
          <Message ton="info">{t('lectureSeule')}</Message>
        ) : articles.length ? (
          <Caisse articles={articles} categories={categories} magasin={s.commercant.id} remises={peutRemiser(s.utilisateur)} />
        ) : (
          <EtatVide titre={t('videTitre')} texte={t('videTexte')}>
            <Link href="/stock" className={`${classeBouton.secondaire} mt-2`}>{t('allerStock')}</Link>
          </EtatVide>
        )}
      </Page>
    </>
  );
}
