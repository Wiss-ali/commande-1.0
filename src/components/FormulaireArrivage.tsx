'use client';
// Arrivage de marchandise : fournisseur, articles reçus (recherche), quantité et prix payé par unité,
// somme payée tout de suite. Le prix d'achat actuel est proposé ; le serveur calcule le coût moyen pondéré.
import { Search, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { chercherPourArrivage, enregistrerArrivage } from '@/app/actions/argent';
import { analyserMontant, formaterMontant, montantPourSaisie, nomLocal } from '@/lib/formats';
import { MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { Formulaire } from './Formulaire';
import { Carte, Champ, classeBouton, TitreSection } from './ui';

type Trouve = Awaited<ReturnType<typeof chercherPourArrivage>>[number];
interface Ligne { varianteId: string; nom: string; quantite: string; cout: string; stock: number }

export function FormulaireArrivage({ cle, fournisseurs, choisi, aujourdhui }: { cle: string; fournisseurs: { id: string; nom: string }[]; choisi?: string; aujourdhui: string }) {
  const t = useTranslations('fournisseurs');
  const td = useTranslations('pdf');
  const langue = useLocale() as Langue;
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [recherche, setRecherche] = useState('');
  const [trouves, setTrouves] = useState<Trouve[] | null>(null);
  const [fournisseur, setFournisseur] = useState(choisi ?? '');
  const chercher = async () => setTrouves(recherche.trim() ? await chercherPourArrivage(recherche) : null);
  const changer = (id: string, champ: 'quantite' | 'cout', v: string) => setLignes((x) => x.map((l) => (l.varianteId === id ? { ...l, [champ]: v } : l)));
  const total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (analyserMontant(l.cout) ?? 0), 0);
  const select = 'min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre';

  return (
    <Formulaire action={enregistrerArrivage} bouton={t('enregistrerArrivage')} garder>
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="lignes" value={JSON.stringify(lignes.map(({ varianteId, quantite, cout }) => ({ varianteId, quantite, cout })))} />
      <Carte className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('fournisseur')}</span>
          <select name="fournisseur" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className={select}>
            <option value="">{t('sansFournisseur')}</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle={t('recuLe')} name="recuLe" type="date" defaultValue={aujourdhui} dir="ltr" />
          <Champ libelle={t('reference')} name="reference" maxLength={60} dir="ltr" autoComplete="off" aide={t('referenceAide')} />
        </div>
      </Carte>

      <TitreSection>{t('articlesRecus')}</TitreSection>
      {lignes.map((l) => (
        <Carte key={l.varianteId} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-semibold">{l.nom}<span className="block text-sm font-normal text-doux">{t('stockActuel', { n: l.stock })}</span></p>
            <button type="button" onClick={() => setLignes((x) => x.filter((y) => y.varianteId !== l.varianteId))} aria-label={t('retirer', { article: l.nom })} className={`${classeBouton.danger} min-h-11 px-3`}><Trash2 aria-hidden className="size-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Champ libelle={t('quantiteRecue')} value={l.quantite} onChange={(e) => changer(l.varianteId, 'quantite', e.target.value)} inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" />
            <Champ libelle={t('prixPaye')} value={l.cout} onChange={(e) => changer(l.varianteId, 'cout', e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" />
          </div>
        </Carte>
      ))}
      <Carte className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">{t('ajouterArticle')}</span>
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} maxLength={80} autoComplete="off"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void chercher(); } }}
              className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre" />
          </label>
          <button type="button" aria-label={t('chercher')} onClick={() => void chercher()} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </div>
        {trouves ? (
          trouves.length ? (
            <ul className="flex flex-col gap-1">
              {trouves.map((a) => {
                const nom = `${nomLocal(a, langue)}${a.libelle ? ` · ${a.libelle}` : ''}`;
                return (
                  <li key={a.varianteId}>
                    <button type="button" disabled={lignes.some((l) => l.varianteId === a.varianteId)}
                      onClick={() => { setLignes((x) => [...x, { varianteId: a.varianteId, nom, quantite: '1', cout: a.prixAchat ? montantPourSaisie(a.prixAchat) : '', stock: a.quantite }]); setTrouves(null); setRecherche(''); }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-trait px-3 py-2 text-start disabled:opacity-50">
                      <span className="min-w-0 truncate text-sm font-semibold">{nom}</span>
                      <span className="shrink-0 text-sm text-doux">{t('prixAchatActuel', { prix: formaterMontant(a.prixAchat, langue) })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-doux">{t('rienTrouve')}</p>
        ) : null}
      </Carte>

      <p className="flex items-baseline justify-between rounded-2xl border border-trait bg-surface shadow-doux px-4 py-3"><span className="text-sm text-doux">{t('total')}</span><span className="text-2xl font-bold">{formaterMontant(total, langue)}</span></p>
      {fournisseur ? (
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('payeMaintenantTitre')}</h2>
          <Champ libelle={t('payeMaintenant')} name="paye" inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('payeMaintenantAide')} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('mode')}</span>
            <select name="mode" defaultValue="especes" className={select}>{MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}</select>
          </label>
          <Champ libelle={t('reference')} name="referencePaiement" maxLength={60} dir="ltr" autoComplete="off" />
        </Carte>
      ) : <p className="text-sm text-doux">{t('sansFournisseurAide')}</p>}
      <Champ libelle={t('note')} name="note" maxLength={300} autoComplete="off" />
      <p className="text-sm text-doux">{t('coutMoyenAide')}</p>
    </Formulaire>
  );
}
