'use client';
// Caisse : panier rempli par scan ou recherche, remises, encaissement (espèces, chèque, virement, CCP, à crédit),
// ticket ou facture.
// Le catalogue est chargé une fois dans le téléphone : la recherche et le scan sont immédiats,
// et la vente reste possible si la connexion coupe. Une vente non envoyée est gardée dans le téléphone
// avec sa clé : elle part dès que la connexion revient, sans jamais être comptée deux fois.
import { BadgePercent, Minus, Package, Plus, ScanLine, Search, Trash2, WifiOff, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { vendre, type ResultatVente } from '@/app/actions/ventes';
import { normaliserCode } from '@/lib/codes-barres';
import { analyserMontant, formaterMontant } from '@/lib/formats';
import { MODES_ENCAISSEMENT, type Langue, type ModeEncaissement } from '@/lib/types-bd';
import { Scanner } from './Scanner';
import { Carte, Champ, classeBouton, Message } from './ui';

export interface ArticleCaisse {
  id: string;
  nomFr: string;
  nomAr: string;
  libelle: string;
  code: string | null;
  prix: number;
  stock: number;
  photo: string | null;
}
interface Encaisse {
  mode: ModeEncaissement;
  montant: number;
  reference?: string;
}
interface VenteEnAttente {
  lignes: { varianteId: string; quantite: number; remise?: number }[];
  facture: boolean;
  acheteur: Record<string, string> | null;
  cle: string;
  total: number;
  remiseGlobale?: number;
  /** Absent : tout en espèces. */
  encaisse?: Encaisse[];
}
// « Carte » est affichée mais pas encore activée : elle ne peut pas servir à valider une vente.
type ChoixPaiement = ModeEncaissement | 'credit' | 'carte';
/** Moyens rangés dans le menu déroulant, pour garder l'écran simple (espèces et carte restent en vue). */
const AUTRES_CHOIX: readonly ChoixPaiement[] = [...MODES_ENCAISSEMENT.filter((m) => m !== 'especes'), 'credit'];

/** « 500 » → 500 DA ; « 10 % » → 10 % de la base. Null si la saisie est fausse ; 0 si vide. */
function lireRemise(saisie: string, base: number): number | null {
  const t = saisie.trim();
  if (!t) return 0;
  if (t.endsWith('%')) {
    const p = Number(t.slice(0, -1).trim().replace(',', '.'));
    if (!Number.isFinite(p) || p < 0 || p > 100) return null;
    return Math.round((base * p) / 100);
  }
  const m = analyserMontant(t);
  return m === null || m > base ? null : m;
}
const envoyer = (v: VenteEnAttente) => vendre({ lignes: v.lignes, facture: v.facture, acheteur: v.acheteur, cle: v.cle, remiseGlobale: v.remiseGlobale, encaisse: v.encaisse });
type Fin = { etat: 'envoyee'; resultat: Extract<ResultatVente, { ok: true }>; rendu: number | null } | { etat: 'gardee'; total: number; rendu: number | null };

const CHAMPS_CLIENT = ['nom', 'telephone', 'adresse', 'nif', 'rc', 'nis', 'ai'] as const;
/** Produits affichés d'un coup dans la grille (« Voir plus » pour la suite) : le téléphone reste rapide. */
const PAR_PAGE = 60;
const sansAccents = (texte: string) => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lireFile(cle: string): VenteEnAttente[] {
  try {
    const brut = JSON.parse(localStorage.getItem(cle) ?? '[]');
    return Array.isArray(brut) ? brut : [];
  } catch {
    return [];
  }
}

export function Caisse({ articles, magasin, remises }: { articles: ArticleCaisse[]; magasin: string; remises: boolean }) {
  const t = useTranslations('caisse');
  const te = useTranslations('erreurs');
  const tl = useTranslations('legal');
  const langue = useLocale() as Langue;
  const cleFile = `hanout.ventes.${magasin}`;
  const [panier, setPanier] = useState<Map<string, number>>(new Map());
  const [recherche, setRecherche] = useState('');
  const [nbVisibles, setNbVisibles] = useState(PAR_PAGE);
  const [scan, setScan] = useState(false);
  const [paiement, setPaiement] = useState(false);
  const [recu, setRecu] = useState('');
  const [facture, setFacture] = useState(false);
  const [client, setClient] = useState<Record<string, string>>({});
  const [remisesLignes, setRemisesLignes] = useState<Map<string, string>>(new Map());
  const [ligneRemise, setLigneRemise] = useState<string | null>(null);
  const [remiseTotal, setRemiseTotal] = useState('');
  const [choix, setChoix] = useState<ChoixPaiement>('especes');
  const [reference, setReference] = useState('');
  const [second, setSecond] = useState<{ mode: ModeEncaissement; montant: string } | null>(null);
  const [payeMaintenant, setPayeMaintenant] = useState('');
  const [message, setMessage] = useState<{ ton: 'erreur' | 'info'; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fin, setFin] = useState<Fin | null>(null);
  const [attente, setAttente] = useState(0);
  const enCours = useRef(false);

  const parId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const parCode = useMemo(() => new Map(articles.flatMap((a) => (a.code ? [[a.code, a] as const] : []))), [articles]);
  const nom = useCallback((a: ArticleCaisse) => `${langue === 'ar' ? a.nomAr || a.nomFr : a.nomFr || a.nomAr}${a.libelle ? ` · ${a.libelle}` : ''}`, [langue]);
  const lignes = [...panier].flatMap(([id, quantite]) => {
    const article = parId.get(id);
    if (!article) return [];
    const brut = article.prix * quantite;
    return [{ article, quantite, brut, remise: lireRemise(remisesLignes.get(id) ?? '', brut) }];
  });
  const sousTotal = lignes.reduce((s, l) => s + l.brut - (l.remise ?? 0), 0);
  const remiseGlobale = lireRemise(remiseTotal, sousTotal);
  const total = sousTotal - (remiseGlobale ?? 0);
  const remiseFausse = remiseGlobale === null || lignes.some((l) => l.remise === null);
  // Grille de la caisse : tous les produits (les plus vendus d'abord, voir la page), filtrés par la recherche.
  // Sans tenir compte des accents : « the » trouve « Thé ».
  const filtres = useMemo(() => {
    const q = sansAccents(recherche.trim());
    if (!q) return articles;
    return articles.filter((a) => sansAccents(a.nomFr).includes(q) || a.nomAr.includes(q) || sansAccents(a.libelle).includes(q) || a.code === recherche.trim());
  }, [recherche, articles]);

  const ajouter = useCallback((id: string, n = 1) => {
    setMessage(null);
    setPanier((p) => {
      const suivant = new Map(p);
      const q = (suivant.get(id) ?? 0) + n;
      if (q <= 0) {
        suivant.delete(id);
        setRemisesLignes((r) => { const m = new Map(r); m.delete(id); return m; });
      }
      else suivant.set(id, Math.min(q, 9999));
      return suivant;
    });
  }, []);

  const surCode = useCallback((code: string) => {
    const article = parCode.get(normaliserCode(code) ?? '');
    if (article) ajouter(article.id);
    else setMessage({ ton: 'erreur', texte: t('codeInconnu', { code }) });
  }, [parCode, ajouter, t]);

  // Envoie les ventes gardées dans le téléphone. Une vente n'en sort qu'après une réponse du serveur.
  const vider = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      for (const vente of lireFile(cleFile)) {
        let reponse: ResultatVente;
        try {
          reponse = await envoyer(vente);
        } catch {
          break; // toujours pas de connexion : on réessaiera
        }
        localStorage.setItem(cleFile, JSON.stringify(lireFile(cleFile).filter((v) => v.cle !== vente.cle)));
        if (!reponse.ok) setMessage({ ton: 'erreur', texte: t('gardeeRefusee', { raison: te(reponse.raison) }) });
      }
    } finally {
      enCours.current = false;
      setAttente(lireFile(cleFile).length);
    }
  }, [cleFile, t, te]);

  useEffect(() => {
    void vider();
    const minuteur = setInterval(() => void vider(), 30_000);
    window.addEventListener('online', vider);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener('online', vider);
    };
  }, [vider]);

  /** Sommes reçues selon le choix, ou un message d'erreur. Absent : tout en espèces. */
  function encaissement(): { encaisse?: Encaisse[]; especes: number } | { erreur: string } {
    const ref = reference.trim() || undefined;
    if (choix === 'carte') return { erreur: t('carteInactive') };
    if (choix === 'credit') {
      const paye = payeMaintenant.trim() ? analyserMontant(payeMaintenant) : 0;
      if (paye === null || paye >= total) return { erreur: t('payeMaintenantFaux') };
      return { encaisse: paye ? [{ mode: 'especes', montant: paye }] : [], especes: paye };
    }
    if (second) {
      const m2 = analyserMontant(second.montant);
      if (m2 === null || m2 <= 0 || m2 >= total || second.mode === choix) return { erreur: t('secondFaux') };
      const premier = { mode: choix as ModeEncaissement, montant: total - m2, reference: ref };
      return { encaisse: [premier, { mode: second.mode, montant: m2 }], especes: choix === 'especes' ? total - m2 : second.mode === 'especes' ? m2 : 0 };
    }
    if (choix === 'especes') return { especes: total };
    return { encaisse: [{ mode: choix, montant: total, reference: ref }], especes: 0 };
  }

  async function valider() {
    if (!lignes.length || envoi) return;
    if (remiseFausse || total < 0) return setMessage({ ton: 'erreur', texte: te('remise_invalide') });
    const credit = choix === 'credit';
    if ((facture || credit) && !client.nom?.trim()) return setMessage({ ton: 'erreur', texte: te(credit ? 'client_credit' : 'client_requis') });
    const e = encaissement();
    if ('erreur' in e) return setMessage({ ton: 'erreur', texte: e.erreur });
    const montantRecu = recu.trim() && e.especes ? analyserMontant(recu) : null;
    if (recu.trim() && e.especes && (montantRecu === null || montantRecu < e.especes)) return setMessage({ ton: 'erreur', texte: t('recuInsuffisant') });
    const vente: VenteEnAttente = {
      lignes: lignes.map((l) => ({ varianteId: l.article.id, quantite: l.quantite, ...(l.remise ? { remise: l.remise } : {}) })),
      facture,
      acheteur: facture || credit ? Object.fromEntries(CHAMPS_CLIENT.map((c) => [c, client[c] ?? ''])) : null,
      cle: crypto.randomUUID(),
      total,
      ...(remiseGlobale ? { remiseGlobale } : {}),
      ...(e.encaisse ? { encaisse: e.encaisse } : {}),
    };
    const rendu = montantRecu === null ? null : montantRecu - e.especes;
    setEnvoi(true);
    setMessage(null);
    // La vente est d'abord écrite dans le téléphone : une coupure au mauvais moment ne la perd pas.
    localStorage.setItem(cleFile, JSON.stringify([...lireFile(cleFile), vente]));
    let reponse: ResultatVente | null = null;
    try {
      reponse = await envoyer(vente);
    } catch {
      // Pas de réponse : la vente reste dans le téléphone et partira plus tard.
    }
    setEnvoi(false);
    if (reponse) localStorage.setItem(cleFile, JSON.stringify(lireFile(cleFile).filter((v) => v.cle !== vente.cle)));
    setAttente(lireFile(cleFile).length);
    if (reponse && !reponse.ok) return setMessage({ ton: 'erreur', texte: te(reponse.raison) });
    setFin(reponse ? { etat: 'envoyee', resultat: reponse, rendu } : { etat: 'gardee', total, rendu });
    setPanier(new Map());
    setPaiement(false);
    setRecu('');
    setFacture(false);
    setClient({});
    setRemisesLignes(new Map());
    setRemiseTotal('');
    setChoix('especes');
    setReference('');
    setSecond(null);
    setPayeMaintenant('');
  }

  const rendu = recu.trim() ? analyserMontant(recu) : null;
  // Part payée en espèces, pour la monnaie à rendre.
  const partEspeces = choix === 'especes' ? total - (second ? (analyserMontant(second.montant) ?? 0) : 0) : second?.mode === 'especes' ? (analyserMontant(second.montant) ?? 0) : choix === 'credit' ? (analyserMontant(payeMaintenant) ?? 0) : 0;

  if (fin) {
    return (
      <Carte className="flex flex-col gap-3">
        {fin.etat === 'envoyee' ? (
          <>
            <Message ton="succes">{t('venteFaite', { numero: fin.resultat.numero })}</Message>
            {fin.resultat.manques ? <Message ton="info">{t('stockAVerifier')}</Message> : null}
          </>
        ) : (
          <Message ton="info">{t('venteGardee')}</Message>
        )}
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-sm text-doux">{t('total')}</dt><dd className="text-2xl font-bold">{formaterMontant(fin.etat === 'envoyee' ? fin.resultat.total : fin.total, langue)}</dd></div>
          {fin.rendu !== null ? <div><dt className="text-sm text-doux">{t('aRendre')}</dt><dd className="text-2xl font-bold text-prim">{formaterMontant(fin.rendu, langue)}</dd></div> : null}
        </dl>
        <button type="button" onClick={() => setFin(null)} className={classeBouton.principal}>{t('nouvelleVente')}</button>
        {fin.etat === 'envoyee' ? (
          <div className="grid grid-cols-2 gap-2">
            <a href={`/factures/${fin.resultat.id}/pdf`} target="_blank" rel="noopener" className={classeBouton.secondaire}>{t('imprimer')}</a>
            <Link href={`/factures/${fin.resultat.id}`} className={classeBouton.secondaire}>{t('voirDocument')}</Link>
          </div>
        ) : null}
      </Carte>
    );
  }

  return (
    <>
      {attente ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-safran bg-safran-pale px-3 py-2.5 text-sm font-medium text-sur-safran">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          {t('enAttente', { n: attente })}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">{t('chercher')}</span>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-doux" />
            <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setNbVisibles(PAR_PAGE); }} maxLength={80} autoComplete="off" className="min-h-12 w-full rounded-xl border border-trait bg-surface ps-9 pe-3 text-base text-encre" />
          </span>
        </label>
        <button type="button" onClick={() => setScan((s) => !s)} aria-pressed={scan} className={`${classeBouton.secondaire} min-h-12`}>
          <ScanLine aria-hidden className="size-5" />
          {t('scanner')}
        </button>
      </div>
      {scan ? <Scanner onCode={surCode} /> : null}
      <div aria-live="polite">{message && !paiement ? <Message ton={message.ton}>{message.texte}</Message> : null}</div>

      {lignes.length ? (
        <ul className="flex flex-col gap-2">
          {lignes.map(({ article, quantite, brut, remise }) => (
            <li key={article.id} className="rounded-2xl border border-trait bg-surface shadow-doux p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold">{nom(article)}</p>
                <p className="shrink-0 text-end font-bold">
                  {remise ? <span className="block text-xs font-normal text-doux line-through">{formaterMontant(brut, langue)}</span> : null}
                  {formaterMontant(brut - (remise ?? 0), langue)}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => ajouter(article.id, -1)} aria-label={t('moins', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Minus aria-hidden className="size-4" /></button>
                <span className="chiffres min-w-10 text-center text-lg font-bold">{quantite}</span>
                <button type="button" onClick={() => ajouter(article.id, 1)} aria-label={t('plus', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Plus aria-hidden className="size-4" /></button>
                <span className="flex-1 text-sm text-doux">{formaterMontant(article.prix, langue)}{quantite > article.stock ? ` · ${t('stockConnu', { n: article.stock })}` : ''}</span>
                {remises ? (
                  <button type="button" onClick={() => setLigneRemise(ligneRemise === article.id ? null : article.id)} aria-expanded={ligneRemise === article.id} aria-label={t('remiseSur', { article: nom(article) })} className={`inline-flex size-11 items-center justify-center rounded-lg border ${remise ? 'border-prim text-prim' : 'border-trait'}`}><BadgePercent aria-hidden className="size-4" /></button>
                ) : null}
                <button type="button" onClick={() => ajouter(article.id, -quantite)} aria-label={t('retirer', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg text-terre"><Trash2 aria-hidden className="size-4" /></button>
              </div>
              {remises && ligneRemise === article.id ? (
                <div className="mt-2">
                  <Champ libelle={t('remiseLigne')} value={remisesLignes.get(article.id) ?? ''} onChange={(e) => { const v = e.target.value; setRemisesLignes((r) => new Map(r).set(article.id, v)); }} dir="ltr" maxLength={14} autoComplete="off" aide={remise === null ? te('remise_invalide') : t('remiseAide')} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="caisse-produits" className="flex flex-col gap-2">
        <h2 id="caisse-produits" className="text-xs font-semibold uppercase tracking-wide text-doux">{t('produits')}</h2>
        {filtres.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {filtres.slice(0, nbVisibles).map((a) => {
              const dansPanier = panier.get(a.id) ?? 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => { ajouter(a.id); if (recherche) setRecherche(''); }}
                    className={`relative flex h-full w-full flex-col gap-1 rounded-xl border bg-surface p-1.5 text-start active:scale-[.98] ${dansPanier ? 'border-prim ring-1 ring-prim' : 'border-trait'}`}
                  >
                    <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-creux text-doux">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {a.photo ? <img src={a.photo} alt="" loading="lazy" className="size-full object-cover" /> : <Package aria-hidden className="size-6" />}
                    </span>
                    <span className="line-clamp-2 text-xs font-semibold leading-snug">{nom(a)}</span>
                    <span className="mt-auto text-xs font-bold">{formaterMontant(a.prix, langue)}</span>
                    {a.stock <= 0 ? <span className="text-[11px] font-medium text-terre">{t('rupture')}</span> : null}
                    {dansPanier ? <><span aria-hidden className="chiffres absolute end-1 top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-prim px-1.5 text-xs font-bold text-sur-prim">{dansPanier}</span><span className="sr-only">{t('produitDansPanier', { n: dansPanier })}</span></> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-doux">{t('rienTrouve')}</p>
        )}
        {filtres.length > nbVisibles ? (
          <button type="button" onClick={() => setNbVisibles((n) => n + PAR_PAGE)} className={classeBouton.secondaire}>{t('voirPlus', { n: filtres.length - nbVisibles })}</button>
        ) : null}
      </section>

      <div className="sticky bottom-24 z-10 flex items-center gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3 shadow-lg md:bottom-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-doux">{t('total')}</p>
          <p className="text-2xl font-bold">{formaterMontant(total, langue)}</p>
        </div>
        <button type="button" disabled={!lignes.length} onClick={() => setPaiement(true)} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-prim shadow-prim hover:bg-prim-fort px-6 text-base font-semibold text-sur-prim disabled:opacity-60">{t('encaisser')}</button>
      </div>

      {paiement ? (
        <div role="dialog" aria-modal="true" aria-label={t('encaisser')} className="fixed inset-0 z-30 overflow-y-auto bg-fond p-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('encaisser')}</h2>
              <button type="button" onClick={() => setPaiement(false)} aria-label={t('fermer')} className="inline-flex size-11 items-center justify-center rounded-xl border border-trait bg-surface"><X aria-hidden className="size-5" /></button>
            </div>
            <Carte className="flex flex-col gap-3">
              {remises ? (
                <Champ libelle={t('remiseTotal')} value={remiseTotal} onChange={(e) => setRemiseTotal(e.target.value)} dir="ltr" maxLength={14} autoComplete="off" aide={remiseGlobale === null ? te('remise_invalide') : t('remiseAide')} />
              ) : null}
              {sousTotal !== total ? <p className="text-sm text-doux">{t('sousTotal')} : <span className="line-through">{formaterMontant(sousTotal, langue)}</span></p> : null}
              <div><p className="text-sm text-doux">{t('aPayer')}</p><p className="text-3xl font-bold">{formaterMontant(total, langue)}</p></div>
            </Carte>
            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t('modePaiement')}</legend>
              {/* Les deux moyens de tous les jours en vue ; les autres dans un menu déroulant. */}
              <div className="grid grid-cols-2 gap-2">
                {(['especes', 'carte'] as const).map((c) => (
                  <label key={c} className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-surface px-3 text-base font-semibold ${choix === c ? 'border-prim bg-prim-pale text-prim ring-1 ring-prim' : 'border-trait'}`}>
                    <input type="radio" name="choix" checked={choix === c} onChange={() => { setChoix(c); setSecond(null); }} className="sr-only" />
                    {t(`mode_${c}`)}
                  </label>
                ))}
              </div>
              <select aria-label={t('autreMoyen')} value={AUTRES_CHOIX.includes(choix) && choix !== 'carte' ? choix : ''} onChange={(e) => { const c = (e.target.value || 'especes') as ChoixPaiement; setChoix(c); if (c === 'credit') setSecond(null); }} className={`min-h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-base ${AUTRES_CHOIX.includes(choix) && choix !== 'carte' ? 'border-prim ring-1 ring-prim' : 'border-trait'}`}>
                <option value="">{t('autreMoyen')}</option>
                {AUTRES_CHOIX.filter((c) => c !== 'carte').map((c) => <option key={c} value={c}>{t(`mode_${c}`)}</option>)}
              </select>
            </fieldset>
            {choix === 'carte' ? <Message ton="info">{t('carteInactive')}</Message> : (
            <Carte className="flex flex-col gap-3">
              {choix === 'credit' ? (
                <>
                  <p className="text-sm">{t('creditTexte')}</p>
                  <Champ libelle={t('payeMaintenant')} value={payeMaintenant} onChange={(e) => setPayeMaintenant(e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('payeMaintenantAide')} />
                </>
              ) : (
                <>
                  {choix !== 'especes' ? <Champ libelle={t('reference')} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" maxLength={60} autoComplete="off" aide={t('referenceAide')} /> : null}
                  {second ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-trait p-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">{t('secondMoyen')}</span>
                        <select value={second.mode} onChange={(e) => setSecond({ ...second, mode: e.target.value as ModeEncaissement })} className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                          {MODES_ENCAISSEMENT.filter((m) => m !== choix).map((m) => <option key={m} value={m}>{t(`mode_${m}`)}</option>)}
                        </select>
                      </label>
                      <Champ libelle={t('montantSecond')} value={second.montant} onChange={(e) => setSecond({ ...second, montant: e.target.value })} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('montantSecondAide', { mode: t(`mode_${choix}`) })} />
                      <button type="button" onClick={() => setSecond(null)} className="min-h-11 self-start text-sm font-semibold text-prim underline">{t('unSeulMoyen')}</button>
                    </div>
                  ) : null}
                </>
              )}
              {partEspeces > 0 ? (
                <>
                  <Champ libelle={t('recu')} value={recu} onChange={(e) => setRecu(e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('recuAide')} />
                  {rendu !== null && rendu >= partEspeces ? <p className="text-lg font-bold text-prim">{t('aRendre')} : {formaterMontant(rendu - partEspeces, langue)}</p> : null}
                </>
              ) : null}
              {/* Payer avec deux moyens : rare, donc discret. */}
              {!second && choix !== 'credit' ? (
                <button type="button" onClick={() => setSecond({ mode: choix === 'especes' ? 'ccp' : 'especes', montant: '' })} className="min-h-11 self-start text-sm font-semibold text-prim underline">{t('deuxMoyens')}</button>
              ) : null}
            </Carte>
            )}
            {/* Un ticket de caisse est toujours remis ; la facture seulement si le client la demande. */}
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-trait bg-surface px-3">
              <input type="checkbox" checked={facture} onChange={(e) => setFacture(e.target.checked)} className="size-5 accent-prim" />
              <span className="text-sm">{t('genererFacture')}</span>
            </label>
            {facture || choix === 'credit' ? (
              <Carte className="flex flex-col gap-3">
                {choix === 'credit' ? <p className="text-sm text-doux">{t('clientCredit')}</p> : null}
                <Champ libelle={t('clientNom')} value={client.nom ?? ''} onChange={(e) => setClient({ ...client, nom: e.target.value })} maxLength={120} autoComplete="off" />
                <Champ libelle={t('clientTelephone')} value={client.telephone ?? ''} onChange={(e) => setClient({ ...client, telephone: e.target.value })} type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" />
                <details>
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-prim">{t('clientPro')}</summary>
                  <div className="flex flex-col gap-3 pt-2">
                    {(['adresse', 'nif', 'rc', 'nis', 'ai'] as const).map((c) => (
                      <Champ key={c} libelle={tl(c)} value={client[c] ?? ''} onChange={(e) => setClient({ ...client, [c]: e.target.value })} maxLength={c === 'adresse' ? 300 : 40} autoComplete="off" dir={c === 'adresse' ? undefined : 'ltr'} />
                    ))}
                  </div>
                </details>
              </Carte>
            ) : null}
            {message ? <Message ton={message.ton}>{message.texte}</Message> : null}
            <button type="button" onClick={valider} disabled={envoi || choix === 'carte'} className={classeBouton.principal}>{envoi ? t('envoi') : t('valider')}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
