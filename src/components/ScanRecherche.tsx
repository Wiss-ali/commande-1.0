'use client';
// Écran Scan : un code lu ouvre l'article correspondant, ou propose de créer le produit.
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { chercherCode, type ArticleScan } from '@/app/actions/stock';
import { formaterMontant, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { PastilleStock } from './PastilleStock';
import { Scanner } from './Scanner';
import { Carte, classeBouton, Message } from './ui';

type Resultat = { code: string; article: ArticleScan | null } | { code: string; erreur: true };

export function ScanRecherche({ peutCreer }: { peutCreer: boolean }) {
  const t = useTranslations('scan');
  const langue = useLocale() as Langue;
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const surCode = useCallback(async (code: string) => {
    try {
      setResultat({ code, article: await chercherCode(code) });
    } catch {
      setResultat({ code, erreur: true });
    }
  }, []);

  return (
    <>
      <Scanner onCode={surCode} />
      <div aria-live="polite">
        {resultat && 'erreur' in resultat ? <Message ton="erreur">{t('erreurReseau')}</Message> : null}
        {resultat && 'article' in resultat && resultat.article ? (
          <Carte className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{nomLocal(resultat.article, langue)}</p>
                {resultat.article.libelle ? <p className="text-sm text-doux">{resultat.article.libelle}</p> : null}
                <p className="chiffres text-sm text-doux">{resultat.code}</p>
              </div>
              <PastilleStock etat={resultat.article.etat} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-doux">{t('enStock')}</dt><dd className="chiffres text-xl font-bold">{resultat.article.quantite}</dd></div>
              <div><dt className="text-doux">{t('prix')}</dt><dd className="text-xl font-bold">{formaterMontant(BigInt(resultat.article.prixVente), langue)}</dd></div>
            </dl>
            <Link href={`/stock/${resultat.article.produitId}`} className={classeBouton.principal}>{t('voirFiche')}</Link>
          </Carte>
        ) : null}
        {resultat && 'article' in resultat && !resultat.article ? (
          <Carte className="flex flex-col gap-3">
            <p className="font-semibold">{t('inconnuTitre')}</p>
            <p className="text-sm text-doux">{t('inconnuTexte')} <span className="chiffres font-semibold text-encre">{resultat.code}</span></p>
            {peutCreer ? <Link href={`/stock/nouveau?code=${encodeURIComponent(resultat.code)}`} className={classeBouton.principal}>{t('creerProduit')}</Link> : null}
          </Carte>
        ) : null}
      </div>
    </>
  );
}
