'use client';
// Caisse : panier rempli par scan ou recherche, encaissement en espèces, ticket ou facture.
// Le catalogue est chargé une fois dans le téléphone : la recherche et le scan sont immédiats,
// et la vente reste possible si la connexion coupe. Une vente non envoyée est gardée dans le téléphone
// avec sa clé : elle part dès que la connexion revient, sans jamais être comptée deux fois.
import { Minus, Package, Plus, ScanLine, Search, Trash2, WifiOff, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { vendre, type ResultatVente } from '@/app/actions/ventes';
import { normaliserCode } from '@/lib/codes-barres';
import { analyserMontant, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
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
interface VenteEnAttente {
  lignes: { varianteId: string; quantite: number }[];
  facture: boolean;
  acheteur: Record<string, string> | null;
  cle: string;
  total: number;
}
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

export function Caisse({ articles, magasin }: { articles: ArticleCaisse[]; magasin: string }) {
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
  const [message, setMessage] = useState<{ ton: 'erreur' | 'info'; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fin, setFin] = useState<Fin | null>(null);
  const [attente, setAttente] = useState(0);
  const enCours = useRef(false);

  const parId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const parCode = useMemo(() => new Map(articles.flatMap((a) => (a.code ? [[a.code, a] as const] : []))), [articles]);
  const nom = useCallback((a: ArticleCaisse) => `${langue === 'ar' ? a.nomAr || a.nomFr : a.nomFr || a.nomAr}${a.libelle ? ` · ${a.libelle}` : ''}`, [langue]);
  const lignes = [...panier].flatMap(([id, quantite]) => (parId.has(id) ? [{ article: parId.get(id)!, quantite }] : []));
  const total = lignes.reduce((s, l) => s + l.article.prix * l.quantite, 0);
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
      if (q <= 0) suivant.delete(id);
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
          reponse = await vendre({ lignes: vente.lignes, facture: vente.facture, acheteur: vente.acheteur, cle: vente.cle });
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

  async function valider() {
    if (!lignes.length || envoi) return;
    if (facture && !client.nom?.trim()) return setMessage({ ton: 'erreur', texte: te('client_requis') });
    const montantRecu = recu.trim() ? analyserMontant(recu) : null;
    if (recu.trim() && (montantRecu === null || montantRecu < total)) return setMessage({ ton: 'erreur', texte: t('recuInsuffisant') });
    const vente: VenteEnAttente = {
      lignes: lignes.map((l) => ({ varianteId: l.article.id, quantite: l.quantite })),
      facture,
      acheteur: facture ? Object.fromEntries(CHAMPS_CLIENT.map((c) => [c, client[c] ?? ''])) : null,
      cle: crypto.randomUUID(),
      total,
    };
    const rendu = montantRecu === null ? null : montantRecu - total;
    setEnvoi(true);
    setMessage(null);
    // La vente est d'abord écrite dans le téléphone : une coupure au mauvais moment ne la perd pas.
    localStorage.setItem(cleFile, JSON.stringify([...lireFile(cleFile), vente]));
    let reponse: ResultatVente | null = null;
    try {
      reponse = await vendre({ lignes: vente.lignes, facture: vente.facture, acheteur: vente.acheteur, cle: vente.cle });
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
  }

  const rendu = recu.trim() ? analyserMontant(recu) : null;

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
          {lignes.map(({ article, quantite }) => (
            <li key={article.id} className="rounded-2xl border border-trait bg-surface shadow-doux p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold">{nom(article)}</p>
                <p className="shrink-0 font-bold">{formaterMontant(article.prix * quantite, langue)}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => ajouter(article.id, -1)} aria-label={t('moins', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Minus aria-hidden className="size-4" /></button>
                <span className="chiffres min-w-10 text-center text-lg font-bold">{quantite}</span>
                <button type="button" onClick={() => ajouter(article.id, 1)} aria-label={t('plus', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Plus aria-hidden className="size-4" /></button>
                <span className="flex-1 text-sm text-doux">{formaterMontant(article.prix, langue)}{quantite > article.stock ? ` · ${t('stockConnu', { n: article.stock })}` : ''}</span>
                <button type="button" onClick={() => ajouter(article.id, -quantite)} aria-label={t('retirer', { article: nom(article) })} className="inline-flex size-11 items-center justify-center rounded-lg text-terre"><Trash2 aria-hidden className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-trait px-4 py-4 text-center text-sm text-doux">{t('panierVide')}</p>
      )}

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
              <div><p className="text-sm text-doux">{t('aPayer')}</p><p className="text-3xl font-bold">{formaterMontant(total, langue)}</p></div>
              <Champ libelle={t('recu')} value={recu} onChange={(e) => setRecu(e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('recuAide')} />
              {rendu !== null && rendu >= total ? <p className="text-lg font-bold text-prim">{t('aRendre')} : {formaterMontant(rendu - total, langue)}</p> : null}
            </Carte>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t('document')}</legend>
              {[false, true].map((f) => (
                <label key={String(f)} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-trait bg-surface px-3">
                  <input type="radio" name="document" checked={facture === f} onChange={() => setFacture(f)} className="size-5 accent-prim" />
                  <span className="text-sm">{t(f ? 'avecFacture' : 'avecTicket')}</span>
                </label>
              ))}
            </fieldset>
            {facture ? (
              <Carte className="flex flex-col gap-3">
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
            <button type="button" onClick={valider} disabled={envoi} className={classeBouton.principal}>{envoi ? t('envoi') : t('valider')}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
