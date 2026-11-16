'use client';
// Import de produits : le fichier est lu dans le navigateur, l'utilisateur voit ce qui sera créé
// et ce qui pose problème, puis confirme. Le serveur refait l'analyse de son côté.
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { importerTableau, type ResultatImport } from '@/app/actions/stock';
import { formaterMontant, nomLocal } from '@/lib/formats';
import { analyserTableau, type Analyse, type ErreurImport } from '@/lib/import-produits';
import { lireTableur, TableurIllisible } from '@/lib/tableur';
import type { Langue } from '@/lib/types-bd';
import { Carte, classeBouton, Message, TitreSection } from './ui';

const APERCU = 5;
const MAX_ERREURS = 30;

export function ImportProduits() {
  const t = useTranslations('import');
  const te = useTranslations('erreurs');
  const langue = useLocale() as Langue;
  const [lignes, setLignes] = useState<string[][] | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function choisir(fichier: File | undefined) {
    setAnalyse(null);
    setResultat(null);
    setErreur(null);
    if (!fichier) return;
    try {
      const lues = lireTableur(new Uint8Array(await fichier.arrayBuffer()));
      setLignes(lues);
      setAnalyse(analyserTableau(lues));
    } catch (e) {
      setErreur(e instanceof TableurIllisible ? e.message : 'fichier_illisible');
    }
  }

  async function importer() {
    if (!lignes) return;
    setEnCours(true);
    try {
      setResultat(await importerTableau(lignes));
      setAnalyse(null);
    } catch {
      setResultat({ ok: false, raison: 'inconnue' });
    } finally {
      setEnCours(false);
    }
  }

  const listeErreurs = (erreurs: ErreurImport[]) => (
    <ul className="flex flex-col gap-1 text-sm">
      {erreurs.slice(0, MAX_ERREURS).map((e, i) => (
        <li key={i}><span className="font-semibold">{t('ligne', { n: e.ligne })}</span> : {te(e.raison)}</li>
      ))}
      {erreurs.length > MAX_ERREURS ? <li className="text-doux">{t('etAutres', { n: erreurs.length - MAX_ERREURS })}</li> : null}
    </ul>
  );
  const articles = analyse?.groupes.reduce((n, g) => n + g.variantes.length, 0) ?? 0;

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t('choisir')}</span>
        <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void choisir(e.target.files?.[0])} className="min-h-12 w-full rounded-lg border border-trait bg-surface p-2 text-sm file:me-3 file:min-h-9 file:rounded-md file:border-0 file:bg-vert-pale file:px-3 file:font-semibold file:text-vert" />
      </label>
      <div aria-live="polite" className="flex flex-col gap-4">
        {erreur ? <Message ton="erreur">{te(erreur)}</Message> : null}

        {analyse?.manquantes.length ? (
          <Message ton="erreur">{t('colonnesManquantes', { colonnes: analyse.manquantes.map((c) => t(`colonne.${c}`)).join(', ') })}</Message>
        ) : null}

        {analyse && !analyse.manquantes.length ? (
          <>
            <Carte className="flex flex-col gap-3">
              <p className="font-semibold">{t('pret', { produits: analyse.groupes.length, articles })}</p>
              <p className="text-sm text-doux">{t('colonnesLues', { colonnes: analyse.reconnues.map((c) => t(`colonne.${c}`)).join(', ') })}</p>
              <ul className="flex flex-col divide-y divide-trait text-sm">
                {analyse.groupes.slice(0, APERCU).map((g) => (
                  <li key={g.lignes[0]} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate font-medium">{nomLocal({ nom_fr: g.nomFr, nom_ar: g.nomAr }, langue)}{g.variantes.length > 1 ? ` (${g.variantes.length})` : ''}</span>
                    <span className="shrink-0">{formaterMontant(g.variantes[0]!.prixVente, langue)}</span>
                  </li>
                ))}
                {analyse.groupes.length > APERCU ? <li className="py-2 text-doux">{t('etAutres', { n: analyse.groupes.length - APERCU })}</li> : null}
              </ul>
            </Carte>
            {analyse.erreurs.length ? (
              <Carte className="flex flex-col gap-2">
                <p className="font-semibold text-terre">{t('lignesIgnorees', { n: analyse.erreurs.length })}</p>
                {listeErreurs(analyse.erreurs)}
              </Carte>
            ) : null}
            {analyse.groupes.length ? (
              <button type="button" onClick={importer} disabled={enCours} className={classeBouton.principal}>
                {enCours ? t('enCours') : t('importer', { n: analyse.groupes.length })}
              </button>
            ) : null}
          </>
        ) : null}

        {resultat && !resultat.ok ? <Message ton="erreur">{te(resultat.raison)}</Message> : null}
        {resultat?.ok ? (
          <>
            <Message ton="succes">{t('fait', { produits: resultat.bilan.produits, articles: resultat.bilan.articles })}</Message>
            {resultat.bilan.ignorees.length ? (
              <>
                <TitreSection>{t('lignesIgnorees', { n: resultat.bilan.ignorees.length })}</TitreSection>
                <Carte>{listeErreurs(resultat.bilan.ignorees)}</Carte>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
