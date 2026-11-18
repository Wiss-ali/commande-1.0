'use client';
// Panier et formulaire de commande sans compte : nom, téléphone, wilaya, commune. Paiement à la livraison.
// L'option carte est visible, mais jamais traitée : un message invite à choisir le paiement à la livraison.
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { commander, fraisLivraison } from '@/app/actions/boutique-publique';
import type { Etat } from '@/lib/etat';
import { formaterMontant, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { ecrirePanier, usePanier } from './panier';

interface Wilaya {
  code: number;
  nom_fr: string;
  nom_ar: string;
}

export function CommandeBoutique({ sd, base, cle, wilayas, apercu }: { sd: string; base: string; cle: string; wilayas: Wilaya[]; apercu: boolean }) {
  const t = useTranslations('boutique');
  const te = useTranslations('erreurs');
  const langue = useLocale() as Langue;
  const lignes = usePanier(sd);
  const [etat, envoyer, enCours] = useActionState<Etat, FormData>(commander, {});
  const [wilaya, setWilaya] = useState(0);
  const [livraison, setLivraison] = useState<'domicile' | 'point_relais'>('domicile');
  const [frais, setFrais] = useState<{ domicile: number | null; relais: number | null; communes: { nom_fr: string; nom_ar: string }[] }>({ domicile: null, relais: null, communes: [] });
  const [paiement, setPaiement] = useState<'livraison' | 'carte'>('livraison');

  useEffect(() => {
    if (!wilaya) return;
    let actif = true;
    fraisLivraison(sd, wilaya, livraison).then((f) => {
      if (!actif) return;
      setFrais(f);
      if (f.relais === null) setLivraison('domicile');
    }).catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [sd, wilaya, livraison]);

  const changer = (varianteId: string, delta: number) =>
    ecrirePanier(sd, lignes.map((l) => (l.varianteId === varianteId ? { ...l, quantite: Math.max(0, Math.min(l.max, l.quantite + delta)) } : l)).filter((l) => l.quantite > 0));
  const articles = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
  const prixLivraison = (livraison === 'domicile' ? frais.domicile : frais.relais) ?? 0;
  const champ = 'min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre';

  if (!lignes.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-trait px-4 py-8 text-center">
        <p className="font-semibold">{t('panierVide')}</p>
        <a href={base || '/'} className="inline-flex min-h-11 items-center rounded-lg border border-trait px-4 text-sm font-semibold">{t('continuer')}</a>
      </div>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="boutique" value={sd} />
      <input type="hidden" name="base" value={base} />
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="lignes" value={JSON.stringify(lignes.map((l) => ({ varianteId: l.varianteId, quantite: l.quantite })))} />
      {/* Piège à robots : invisible et hors du parcours au clavier ; un humain ne le remplit jamais. */}
      <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>Site web<input type="text" name="site_web" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
        {lignes.map((l) => (
          <li key={l.varianteId} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold">{l.nom}{l.libelle ? ` · ${l.libelle}` : ''}</p>
              <p className="shrink-0 font-bold">{formaterMontant(l.prix * l.quantite, langue)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => changer(l.varianteId, -1)} aria-label={t('moins', { article: l.nom })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait"><Minus aria-hidden className="size-4" /></button>
              <span className="chiffres min-w-8 text-center font-bold">{l.quantite}</span>
              <button type="button" onClick={() => changer(l.varianteId, 1)} disabled={l.quantite >= l.max} aria-label={t('plus', { article: l.nom })} className="inline-flex size-11 items-center justify-center rounded-lg border border-trait disabled:opacity-40"><Plus aria-hidden className="size-4" /></button>
              <span className="flex-1" />
              <button type="button" onClick={() => changer(l.varianteId, -l.quantite)} aria-label={t('retirer', { article: l.nom })} className="inline-flex size-11 items-center justify-center rounded-lg text-terre"><Trash2 aria-hidden className="size-4" /></button>
            </div>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-4">
        <h2 className="font-semibold">{t('vosCoordonnees')}</h2>
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('nom')}</span><input name="nom" required maxLength={120} autoComplete="name" className={champ} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('telephone')}</span><input name="telephone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" dir="ltr" placeholder="0550 12 34 56" className={champ} /></label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('wilaya')}</span>
          <select name="wilaya" required value={wilaya || ''} onChange={(e) => setWilaya(Number(e.target.value))} className={champ}>
            <option value="">{t('choisirWilaya')}</option>
            {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, '0')} · ${nomLocal(w, langue)}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('commune')}</span>
          {/* Liste des communes de la wilaya choisie ; saisie libre seulement si la wilaya n'a pas encore sa liste. */}
          {frais.communes.length ? (
            <select key={wilaya} name="commune" required defaultValue="" className={champ}>
              <option value="">{t('choisirCommune')}</option>
              {frais.communes.map((c) => <option key={c.nom_fr} value={c.nom_fr}>{langue === 'ar' && c.nom_ar ? c.nom_ar : c.nom_fr}</option>)}
            </select>
          ) : (
            <input name="commune" required maxLength={80} autoComplete="address-level2" disabled={!wilaya} className={champ} />
          )}
        </label>
        {frais.relais !== null ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{t('livraison')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['domicile', 'point_relais'] as const).map((m) => (
                <label key={m} className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-lg border px-2 text-sm font-semibold ${livraison === m ? 'border-prim bg-prim-pale text-prim' : 'border-trait'}`}>
                  <input type="radio" name="livraison" value={m} checked={livraison === m} onChange={() => setLivraison(m)} className="sr-only" />
                  {t(`mode_${m}`)}
                  <span className="text-xs font-normal">{formaterMontant((m === 'domicile' ? frais.domicile : frais.relais) ?? 0, langue)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : <input type="hidden" name="livraison" value="domicile" />}
      </section>

      <fieldset className="flex flex-col gap-2 rounded-2xl border border-trait bg-surface shadow-doux p-4">
        <legend className="sr-only">{t('paiement')}</legend>
        <p className="font-semibold">{t('paiement')}</p>
        {(['livraison', 'carte'] as const).map((p) => (
          <label key={p} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 ${paiement === p ? 'border-prim bg-prim-pale' : 'border-trait'}`}>
            <input type="radio" name="paiement" value={p} checked={paiement === p} onChange={() => setPaiement(p)} className="size-5 accent-prim" />
            <span className="text-sm font-semibold">{t(`paiement_${p}`)}</span>
          </label>
        ))}
        {paiement === 'carte' ? <p role="alert" className="rounded-lg border border-safran bg-safran-pale px-3 py-2.5 text-sm font-medium text-sur-safran">{t('carteInactive')}</p> : null}
      </fieldset>

      <dl className="flex flex-col gap-1.5 rounded-2xl border border-trait bg-surface shadow-doux px-4 py-3 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-doux">{t('articles')}</dt><dd>{formaterMontant(articles, langue)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-doux">{t('fraisLivraison')}</dt><dd>{wilaya ? formaterMontant(prixLivraison, langue) : '—'}</dd></div>
        <div className="flex items-baseline justify-between gap-3 text-xl font-bold"><dt>{t('total')}</dt><dd>{formaterMontant(articles + prixLivraison, langue)}</dd></div>
      </dl>
      {apercu ? <p role="status" className="rounded-lg border border-safran bg-safran-pale px-3 py-2.5 text-sm text-sur-safran">{t('apercuCommande')}</p> : null}
      {etat.erreur ? <p role="alert" className="rounded-lg border border-terre bg-terre-pale px-3 py-2.5 text-sm font-medium text-terre">{etat.erreur === 'carte_inactive' ? t('carteInactive') : te.has(etat.erreur) ? te(etat.erreur) : te('inconnue')}</p> : null}
      <button type="submit" disabled={enCours || paiement === 'carte'} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-prim shadow-prim hover:bg-prim-fort px-4 text-base font-semibold text-sur-prim disabled:opacity-50">
        {enCours ? t('patienter') : t('valider')}
      </button>
      <p className="text-center text-xs text-doux">{t('mentionPaiement')}</p>
    </form>
  );
}
