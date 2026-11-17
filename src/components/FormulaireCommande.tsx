'use client';
// Commande prise au téléphone, en moins de 30 secondes : client, wilaya, commune, livraison, articles.
// Les frais de la wilaya s'affichent tout seuls ; une alerte apparaît si ce numéro a déjà des retours.
import { Minus, Plus, ScanLine, Search, Trash2, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { infosSaisie, nouvelleCommande } from '@/app/actions/commandes';
import { chercherCode, chercherTexte, type ArticleScan } from '@/app/actions/stock';
import { analyserMontant, formaterMontant, montantPourSaisie, nomLocal } from '@/lib/formats';
import type { Alerte } from '@/lib/commandes';
import type { Langue } from '@/lib/types-bd';
import { Formulaire } from './Formulaire';
import { Scanner } from './Scanner';
import { Carte, Champ, classeBouton, Message, TitreSection } from './ui';

interface Wilaya {
  code: number;
  nom_fr: string;
  nom_ar: string;
}

export function FormulaireCommande({ cle, wilayas, communes }: { cle: string; wilayas: Wilaya[]; communes: Record<number, string[]> }) {
  const t = useTranslations('commandes');
  const langue = useLocale() as Langue;
  const [telephone, setTelephone] = useState('');
  const [wilaya, setWilaya] = useState(0);
  const [livraison, setLivraison] = useState<'domicile' | 'point_relais'>('domicile');
  const [frais, setFrais] = useState('');
  const [fraisGrille, setFraisGrille] = useState<number | null>(null);
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  const [lignes, setLignes] = useState<{ article: ArticleScan; quantite: number }[]>([]);
  const [recherche, setRecherche] = useState('');
  const [trouves, setTrouves] = useState<ArticleScan[] | null>(null);
  const [scan, setScan] = useState(false);
  const [inconnu, setInconnu] = useState(false);

  // Frais de la grille et alerte du téléphone, demandés au serveur quand la saisie change.
  useEffect(() => {
    if (!wilaya) return;
    let actif = true;
    infosSaisie(wilaya, livraison, '')
      .then((r) => {
        if (!actif) return;
        setFraisGrille(r.frais);
        setFrais(r.frais === null ? '' : montantPourSaisie(r.frais));
      })
      .catch(() => {
        // Sans réseau : le serveur reprendra les frais de la grille à l'enregistrement.
      });
    return () => {
      actif = false;
    };
  }, [wilaya, livraison]);
  useEffect(() => {
    const chiffres = telephone.replace(/\D/g, '');
    if (chiffres.length < 9) {
      setAlerte(null);
      return;
    }
    const minuterie = setTimeout(() => {
      infosSaisie(0, 'domicile', telephone).then((r) => setAlerte(r.alerte)).catch(() => setAlerte(null));
    }, 400);
    return () => clearTimeout(minuterie);
  }, [telephone]);

  const ajouter = (a: ArticleScan, n = 1) =>
    setLignes((x) => {
      const deja = x.find((l) => l.article.varianteId === a.varianteId);
      if (!deja) return n > 0 ? [...x, { article: a, quantite: n }] : x;
      return x.map((l) => (l.article.varianteId === a.varianteId ? { ...l, quantite: l.quantite + n } : l)).filter((l) => l.quantite > 0);
    });
  const chercher = async () => setTrouves(recherche.trim() ? await chercherTexte(recherche) : null);
  const surCode = async (code: string) => {
    const a = await chercherCode(code);
    setInconnu(!a);
    if (a) ajouter(a);
  };
  const nom = (a: ArticleScan) => `${nomLocal(a, langue)}${a.libelle ? ` · ${a.libelle}` : ''}`;
  const articles = lignes.reduce((s, l) => s + Number(l.article.prixVente) * l.quantite, 0);
  const total = articles + (analyserMontant(frais) ?? 0);
  const listeCommunes = communes[wilaya] ?? [];

  return (
    <Formulaire action={nouvelleCommande} bouton={t('enregistrer')} garder>
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="lignes" value={JSON.stringify(lignes.map((l) => ({ varianteId: l.article.varianteId, quantite: l.quantite })))} />

      <Carte className="flex flex-col gap-3">
        <Champ libelle={t('telephone')} name="telephone" type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" required value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        {alerte && alerte.retours + alerte.annulations > 0 ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-terre bg-terre-pale px-3 py-2.5 text-sm font-semibold text-terre">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('alerte', { retours: alerte.retours, annulations: alerte.annulations })}
          </p>
        ) : null}
        <Champ libelle={t('nom')} name="nom" maxLength={120} autoComplete="off" required />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('wilaya')}</span>
          <select name="wilaya" required value={wilaya || ''} onChange={(e) => setWilaya(Number(e.target.value))} className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre">
            <option value="">{t('choisirWilaya')}</option>
            {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, '0')} · ${nomLocal(w, langue)}`}</option>)}
          </select>
        </label>
        <Champ libelle={t('commune')} name="commune" maxLength={80} autoComplete="off" required list={listeCommunes.length ? 'communes' : undefined} />
        {listeCommunes.length ? <datalist id="communes">{listeCommunes.map((c) => <option key={c} value={c} />)}</datalist> : null}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{t('livraison')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['domicile', 'point_relais'] as const).map((m) => (
              <label key={m} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-sm font-semibold ${livraison === m ? 'border-vert bg-vert-pale text-vert' : 'border-trait bg-surface'}`}>
                <input type="radio" name="livraison" value={m} checked={livraison === m} onChange={() => setLivraison(m)} className="sr-only" />
                {t(`mode_${m}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Champ libelle={t(livraison === 'domicile' ? 'adresse' : 'pointRelais')} name="adresse" maxLength={200} autoComplete="off" />
      </Carte>

      <TitreSection>{t('articles')}</TitreSection>
      <Carte className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">{t('ajouterArticle')}</span>
            <input
              type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} maxLength={80} autoComplete="off"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                void chercher();
              }}
              className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre"
            />
          </label>
          <button type="button" aria-label={t('chercherArticle')} onClick={() => void chercher()} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
          <button type="button" aria-label={t('scanner')} aria-pressed={scan} onClick={() => setScan((s) => !s)} className={`${classeBouton.secondaire} min-h-12 px-3`}><ScanLine aria-hidden className="size-5" /></button>
        </div>
        {scan ? <Scanner onCode={surCode} /> : null}
        {inconnu ? <Message ton="erreur">{t('codeInconnu')}</Message> : null}
        {trouves ? (
          trouves.length ? (
            <ul className="flex flex-col gap-1">
              {trouves.map((a) => (
                <li key={a.varianteId}>
                  <button type="button" onClick={() => { ajouter(a); setTrouves(null); setRecherche(''); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-trait px-3 py-2 text-start">
                    <span className="min-w-0 truncate text-sm font-semibold">{nom(a)}</span>
                    <span className="shrink-0 text-sm">{formaterMontant(BigInt(a.prixVente), langue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-doux">{t('rienTrouve')}</p>
        ) : null}
        {lignes.map(({ article, quantite }) => (
          <div key={article.varianteId} className="rounded-lg border border-trait p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold">{nom(article)}</p>
              <p className="shrink-0 font-bold">{formaterMontant(Number(article.prixVente) * quantite, langue)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => ajouter(article, -1)} aria-label={t('moins', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Minus aria-hidden className="size-4" /></button>
              <span className="chiffres min-w-10 text-center text-lg font-bold">{quantite}</span>
              <button type="button" onClick={() => ajouter(article, 1)} aria-label={t('plus', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Plus aria-hidden className="size-4" /></button>
              <span className="flex-1 text-sm text-doux">{quantite > article.quantite ? t('stockConnu', { n: article.quantite }) : ''}</span>
              <button type="button" onClick={() => ajouter(article, -quantite)} aria-label={t('retirer', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg text-terre"><Trash2 aria-hidden className="size-4" /></button>
            </div>
          </div>
        ))}
      </Carte>

      <Champ libelle={t('frais')} name="frais" value={frais} onChange={(e) => setFrais(e.target.value)} inputMode="decimal" dir="ltr" maxLength={12} autoComplete="off" aide={wilaya && fraisGrille === null ? t('fraisAbsents') : undefined} />
      <Champ libelle={t('note')} name="note" maxLength={500} autoComplete="off" />
      <p className="flex items-baseline justify-between rounded-xl border border-trait bg-surface px-4 py-3">
        <span className="text-sm text-doux">{t('totalClient')}</span>
        <span className="text-2xl font-bold">{formaterMontant(total, langue)}</span>
      </p>
    </Formulaire>
  );
}
