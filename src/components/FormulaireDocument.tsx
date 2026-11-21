'use client';
// Devis, proforma, bon de commande ou facture écrits à la main : client, lignes (articles du stock ou lignes libres), note.
// Facture : une question de plus, comme « Transformer en facture » : vente directe (payée, ou à crédit) ou envoi.
import { Plus, Search, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { chercherTexte, type ArticleScan } from '@/app/actions/stock';
import { enregistrerDocument } from '@/app/actions/ventes';
import { analyserMontant, analyserQuantite, formaterMontant, montantPourSaisie, nomLocal } from '@/lib/formats';
import { MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { Formulaire } from './Formulaire';
import { Repli } from './Repli';
import { Carte, Champ, classeBouton, TitreSection } from './ui';

export interface LigneFormulaire {
  varianteId: string | null;
  designation: string;
  quantite: string;
  prix: string;
  /** Remise sur la ligne, en DA (facultatif). */
  remise?: string;
}
interface Props {
  type: 'devis' | 'proforma' | 'bon_commande' | 'facture';
  id?: string;
  cle: string;
  lignes: LigneFormulaire[];
  client: Record<string, string>;
  note: string;
  /** Faux : vendeur sans la permission « remises » (prix de la fiche, pas de remise). */
  prixModifiables?: boolean;
}

export function FormulaireDocument({ type, id, cle, lignes: initiales, client, note, prixModifiables = true }: Props) {
  const t = useTranslations('document');
  const tl = useTranslations('legal');
  const tp = useTranslations('paiement');
  const td = useTranslations('pdf');
  const [mode, setMode] = useState<'directe' | 'envoi'>('directe');
  const langue = useLocale() as Langue;
  const [lignes, setLignes] = useState(() => initiales.map((l, i) => ({ ...l, cle: i })));
  const [prochaine, setProchaine] = useState(initiales.length);
  const [recherche, setRecherche] = useState('');
  const [trouves, setTrouves] = useState<ArticleScan[] | null>(null);
  const [remiseGlobale, setRemiseGlobale] = useState('');

  const ajouter = (l: LigneFormulaire) => {
    setLignes((x) => [...x, { ...l, cle: prochaine }]);
    setProchaine((n) => n + 1);
  };
  const changer = (c: number, champ: keyof LigneFormulaire, valeur: string) => setLignes((x) => x.map((l) => (l.cle === c ? { ...l, [champ]: valeur } : l)));
  const sousTotal = lignes.reduce((s, l) => s + (analyserMontant(l.prix) ?? 0) * (analyserQuantite(l.quantite) ?? 0) - (analyserMontant(l.remise ?? '') ?? 0), 0);
  const total = sousTotal - (analyserMontant(remiseGlobale) ?? 0);

  return (
    <Formulaire action={enregistrerDocument} bouton={t(id ? 'enregistrer' : `creer_${type}`)} garder>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="lignes" value={JSON.stringify(lignes.map(({ varianteId, designation, quantite, prix, remise }) => ({ varianteId, designation, quantite, prix, remise: remise ?? '' })))} />

      <Carte className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('client')}</h2>
        <Champ libelle={t('clientNom')} name="clientNom" defaultValue={client.nom} maxLength={120} autoComplete="off" required={type === 'facture'} aide={type === 'facture' ? t('clientNomAide') : undefined} />
        <Champ libelle={t('clientTelephone')} name="clientTelephone" defaultValue={client.telephone} type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" />
        <details open={Boolean(client.adresse || client.nif || client.rc || client.nis || client.ai)}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-prim">{t('clientPro')}</summary>
          <div className="flex flex-col gap-3 pt-2">
            <Champ libelle={tl('adresse')} name="clientAdresse" defaultValue={client.adresse} maxLength={300} autoComplete="off" />
            <Champ libelle={tl('nif')} name="clientNif" defaultValue={client.nif} maxLength={40} dir="ltr" autoComplete="off" />
            <Champ libelle={tl('rc')} name="clientRc" defaultValue={client.rc} maxLength={40} dir="ltr" autoComplete="off" />
            <Champ libelle={tl('nis')} name="clientNis" defaultValue={client.nis} maxLength={40} dir="ltr" autoComplete="off" />
            <Champ libelle={tl('ai')} name="clientAi" defaultValue={client.ai} maxLength={40} dir="ltr" autoComplete="off" />
          </div>
        </details>
      </Carte>

      <TitreSection>{t('lignes')}</TitreSection>
      {lignes.map((l, i) => (
        <Carte key={l.cle} className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Champ libelle={t('designation', { n: i + 1 })} value={l.designation} onChange={(e) => changer(l.cle, 'designation', e.target.value)} maxLength={200} autoComplete="off" />
            </div>
            <button type="button" onClick={() => setLignes((x) => x.filter((y) => y.cle !== l.cle))} aria-label={t('retirerLigne')} className={`${classeBouton.danger} min-h-12 px-3`}><Trash2 aria-hidden className="size-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Champ libelle={t('quantite')} value={l.quantite} onChange={(e) => changer(l.cle, 'quantite', e.target.value)} inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" />
            <Champ libelle={t('prix')} value={l.prix} onChange={(e) => changer(l.cle, 'prix', e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off"
              readOnly={!prixModifiables && !!l.varianteId} aide={!prixModifiables && l.varianteId ? t('prixFiche') : undefined} />
          </div>
          {prixModifiables || l.remise ? (
            <Repli titre={t('remiseSurLigne')} ouvert={Boolean(l.remise)}>
              <Champ libelle={t('remiseLigne')} value={l.remise ?? ''} onChange={(e) => changer(l.cle, 'remise', e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('remiseLigneAide')} readOnly={!prixModifiables} />
            </Repli>
          ) : null}
        </Carte>
      ))}

      <Carte className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">{t('ajouterArticle')}</span>
            <input
              type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} maxLength={80} autoComplete="off"
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                setTrouves(recherche.trim() ? await chercherTexte(recherche) : null);
              }}
              className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre"
            />
          </label>
          <button type="button" aria-label={t('chercher')} onClick={async () => setTrouves(recherche.trim() ? await chercherTexte(recherche) : null)} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
        </div>
        {trouves ? (
          trouves.length ? (
            <ul className="flex flex-col gap-1">
              {trouves.map((a) => (
                <li key={a.varianteId}>
                  <button
                    type="button"
                    onClick={() => {
                      ajouter({ varianteId: a.varianteId, designation: `${nomLocal(a, langue)}${a.libelle ? ` · ${a.libelle}` : ''}`, quantite: '1', prix: montantPourSaisie(a.prixVente) });
                      setTrouves(null);
                      setRecherche('');
                    }}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-trait px-3 py-2 text-start"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold">{nomLocal(a, langue)}{a.libelle ? ` · ${a.libelle}` : ''}</span>
                    <span className="shrink-0 text-sm">{formaterMontant(BigInt(a.prixVente), langue)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-doux">{t('rienTrouve')}</p>
          )
        ) : null}
        <button type="button" onClick={() => ajouter({ varianteId: null, designation: '', quantite: '1', prix: '' })} className={classeBouton.secondaire}><Plus aria-hidden className="size-5" />{t('ligneLibre')}</button>
      </Carte>

      {type === 'facture' ? (
        <Carte className="flex flex-col gap-3">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 font-semibold">{t('factureQuestion')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['directe', 'envoi'] as const).map((m) => (
                <label key={m} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold ${mode === m ? 'border-prim bg-prim-pale text-prim' : 'border-trait bg-surface'}`}>
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                  {t(`mode_${m}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {mode === 'directe' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tp('commentPaye')}</span>
              <select name="paiement" defaultValue="especes" className="min-h-12 rounded-xl border border-trait bg-surface px-3 text-base">
                {MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}
                <option value="credit">{tp('pasEncorePaye')}</option>
              </select>
            </label>
          ) : null}
          <p className="text-sm text-doux">{t(mode === 'directe' ? 'aideFactureDirecte' : 'aide_envoi')}</p>
        </Carte>
      ) : null}

      {/* Remise sur le total et note : rares, derrière un lien (ouvert si déjà rempli). */}
      {prixModifiables ? (
        <Repli titre={t('faireRemiseTotal')}>
          <Champ libelle={t('remiseGlobale')} name="remiseGlobale" value={remiseGlobale} onChange={(e) => setRemiseGlobale(e.target.value)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('remiseGlobaleAide')} />
        </Repli>
      ) : null}
      <Repli titre={t('ajouterNote')} ouvert={Boolean(note)}>
        <Champ libelle={t('note')} name="note" defaultValue={note} maxLength={500} autoComplete="off" />
      </Repli>
      <p className="flex items-baseline justify-between rounded-2xl border border-trait bg-surface shadow-doux px-4 py-3"><span className="text-sm text-doux">{t('total')}</span><span className="text-2xl font-bold">{formaterMontant(total, langue)}</span></p>
    </Formulaire>
  );
}
