'use client';
// Fiche produit : l'essentiel d'abord (nom, prix, quantité) ; le reste (autre langue, catégorie, photo,
// code-barres, alerte, TVA) sous « Plus de détails », ouvert tout seul s'il est déjà rempli.
import { Plus, ScanLine, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { enregistrerProduit } from '@/app/actions/stock';
import { ChampPhoto } from './ChampPhoto';
import { Formulaire } from './Formulaire';
import { Repli } from './Repli';
import { Scanner } from './Scanner';
import { Carte, Champ, classeBouton } from './ui';

export interface VarianteSaisie {
  id?: string;
  libelle: string;
  code: string;
  prixAchat: string;
  prixVente: string;
  seuil: string;
  stock: string;
  /** Stock actuel d'une variante existante (affiché, non modifiable ici). */
  quantite?: number;
}
interface Props {
  produit?: { id: string; nomFr: string; nomAr: string; categorieId: string | null; photo: string | null };
  variantes: VarianteSaisie[];
  categories: { id: string; nom: string }[];
  /** Faux pour le vendeur : il ne voit ni ne saisit le prix d'achat. */
  voitAchat: boolean;
  /** Présent quand le commerçant facture la TVA : taux du produit (vide = taux par défaut). */
  tva?: { taux: string; defaut: string };
}

const VIDE: VarianteSaisie = { libelle: '', code: '', prixAchat: '', prixVente: '', seuil: '', stock: '' };
const NOUVELLE = '__nouvelle';

export function FormulaireProduit({ produit, variantes: initiales, categories, voitAchat, tva }: Props) {
  const t = useTranslations('produit');
  const langue = useLocale();
  const [lignes, setLignes] = useState(() => initiales.map((v, i) => ({ ...v, cle: i })));
  const [prochaine, setProchaine] = useState(initiales.length);
  const [plusieurs, setPlusieurs] = useState(initiales.length > 1 || Boolean(initiales[0]?.libelle));
  const [categorie, setCategorie] = useState(produit?.categorieId ?? '');
  const [scan, setScan] = useState<number | null>(null); // clé de la ligne dont on scanne le code

  const changer = (cle: number, champ: keyof VarianteSaisie, valeur: string) => setLignes((l) => l.map((v) => (v.cle === cle ? { ...v, [champ]: valeur } : v)));
  const ajouter = () => {
    // Une nouvelle variante reprend les prix de la précédente : c'est le cas le plus courant.
    const modele = lignes[lignes.length - 1] ?? VIDE;
    setLignes((l) => [...l, { ...VIDE, prixAchat: modele.prixAchat, prixVente: modele.prixVente, seuil: modele.seuil, cle: prochaine }]);
    setProchaine((n) => n + 1);
  };
  const visibles = plusieurs ? lignes : lignes.slice(0, 1);
  const envoyees = visibles.map(({ id, libelle, code, prixAchat, prixVente, seuil, stock }) => ({ id, libelle: plusieurs ? libelle : '', code, prixAchat, prixVente, seuil, stock }));

  const nomFr = <Champ libelle={t('nomFr')} name="nomFr" defaultValue={produit?.nomFr} maxLength={120} autoComplete="off" lang="fr" dir="ltr" aide={langue === 'ar' ? t('nomAide') : undefined} />;
  const nomAr = <Champ libelle={t('nomAr')} name="nomAr" defaultValue={produit?.nomAr} maxLength={120} autoComplete="off" lang="ar" dir="rtl" aide={langue === 'ar' ? undefined : t('nomAide')} />;

  return (
    <>
      <Formulaire action={enregistrerProduit} bouton={t(produit ? 'enregistrer' : 'creer')} garder>
        {produit ? <input type="hidden" name="id" value={produit.id} /> : null}
        <input type="hidden" name="variantes" value={JSON.stringify(envoyees)} />
        <Carte className="flex flex-col gap-4">
          {langue === 'ar' ? nomAr : nomFr}
          {produit && produit[langue === 'ar' ? 'nomFr' : 'nomAr'] ? (langue === 'ar' ? nomFr : nomAr) : null}
        </Carte>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-3">
          <input type="checkbox" checked={plusieurs} onChange={(e) => setPlusieurs(e.target.checked)} className="size-5 accent-prim" />
          <span className="text-sm font-medium">{t('plusieurs')}</span>
        </label>

        {visibles.map((v, i) => (
          <Carte key={v.cle} className="flex flex-col gap-4">
            {plusieurs ? (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Champ libelle={t('variante', { n: i + 1 })} value={v.libelle} onChange={(e) => changer(v.cle, 'libelle', e.target.value)} maxLength={60} placeholder={t('varianteExemple')} autoComplete="off" />
                </div>
                {lignes.length > 1 ? (
                  <button type="button" onClick={() => setLignes((l) => l.filter((x) => x.cle !== v.cle))} aria-label={t('retirerVariante')} className={`${classeBouton.danger} min-h-12 px-3`}>
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle={t('prixVente')} value={v.prixVente} onChange={(e) => changer(v.cle, 'prixVente', e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" />
              {voitAchat ? <Champ libelle={t('prixAchat')} value={v.prixAchat} onChange={(e) => changer(v.cle, 'prixAchat', e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" /> : null}
            </div>
            {v.id ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('stockActuel')}</span>
                <span className="chiffres text-lg font-bold">{v.quantite ?? 0}</span>
                {i === 0 ? <span className="text-sm text-doux">{t('aideStockActuel')}</span> : null}
              </div>
            ) : (
              <Champ libelle={t('stockInitial')} value={v.stock} onChange={(e) => changer(v.cle, 'stock', e.target.value)} inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" />
            )}
            <Repli titre={t('codeEtAlerte')} ouvert={Boolean(v.code || v.seuil)}>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Champ libelle={t('codeBarres')} value={v.code} onChange={(e) => changer(v.cle, 'code', e.target.value)} dir="ltr" maxLength={64} autoComplete="off" />
                </div>
                <button type="button" onClick={() => setScan(v.cle)} className={`${classeBouton.secondaire} min-h-12`}>
                  <ScanLine aria-hidden className="size-5" />
                  {t('scanner')}
                </button>
              </div>
              <Champ libelle={t('seuil')} value={v.seuil} onChange={(e) => changer(v.cle, 'seuil', e.target.value)} inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" aide={t('aideSeuil')} />
            </Repli>
          </Carte>
        ))}
        {plusieurs && lignes.length < 50 ? (
          <button type="button" onClick={ajouter} className={classeBouton.secondaire}>
            <Plus aria-hidden className="size-5" />
            {t('ajouterVariante')}
          </button>
        ) : null}

        <Repli encadre titre={t('plusDetails')} ouvert={Boolean(produit?.categorieId || produit?.photo || tva?.taux)}>
          <p className="text-sm text-doux">{t('plusDetailsAide')}</p>
          {produit && produit[langue === 'ar' ? 'nomFr' : 'nomAr'] ? null : (langue === 'ar' ? nomFr : nomAr)}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('categorie')}</span>
            <select name="categorieId" value={categorie} onChange={(e) => setCategorie(e.target.value)} className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre">
              <option value="">{t('sansCategorie')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              <option value={NOUVELLE}>{t('nouvelleCategorie')}</option>
            </select>
          </label>
          {categorie === NOUVELLE ? <Champ libelle={t('nomCategorie')} name="nouvelleCategorie" maxLength={60} autoComplete="off" /> : null}
          {tva ? <Champ libelle={t('tauxTva')} name="tauxTva" defaultValue={tva.taux} inputMode="decimal" dir="ltr" maxLength={6} autoComplete="off" aide={t('tauxTvaAide', { taux: tva.defaut })} /> : null}
          <ChampPhoto actuelle={produit?.photo ?? null} />
        </Repli>
      </Formulaire>

      {scan !== null ? (
        <div role="dialog" aria-modal="true" aria-label={t('scanner')} className="fixed inset-0 z-30 flex flex-col gap-3 overflow-y-auto bg-fond p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('scannerTitre')}</h2>
            <button type="button" onClick={() => setScan(null)} aria-label={t('fermer')} className="inline-flex size-11 items-center justify-center rounded-xl border border-trait bg-surface">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <Scanner
            onCode={(code) => {
              changer(scan, 'code', code);
              setScan(null);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
