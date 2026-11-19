'use client';
// Choix du design d'une boutique, partagés par l'assistant de création et l'écran « Apparence » : activité, modèle,
// logo (forme et icône), couleur, ambiance. Chaque choix est un vrai bouton radio : le formulaire l'envoie tel quel.
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ACTIVITES, AMBIANCES, FORMES_LOGO, ICONES_LOGO, LISTE_ACTIVITES, PALETTE, type IconeLogo } from '@/lib/design-boutique';
import type { AmbianceBoutique, FormeLogo, ModeleBoutique } from '@/lib/types-bd';
import { ICONES, LogoBoutique } from './LogoBoutique';
import './boutique.css';

const MODELES: ModeleBoutique[] = ['vitrine', 'catalogue', 'grandes_photos', 'produit_unique'];

function Tuile({ name, value, checked, onChange, children, className = '', label }: { name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode; className?: string; label?: string }) {
  return (
    <label aria-label={label} className={`relative flex cursor-pointer rounded-2xl border bg-surface transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-prim ${checked ? 'border-prim ring-1 ring-prim bg-prim-pale/40' : 'border-trait hover:border-trait-fort'} ${className}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      {checked ? <span aria-hidden className="absolute -end-1.5 -top-1.5 flex size-5 ring-2 ring-surface items-center justify-center rounded-full bg-prim text-sur-prim"><Check className="size-3.5" strokeWidth={3} /></span> : null}
    </label>
  );
}

export function ChoixActivite({ valeur, choisir }: { valeur: string; choisir: (a: string) => void }) {
  const t = useTranslations('boutiqueAdmin');
  return (
    <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <legend className="sr-only">{t('assistant.activiteTitre')}</legend>
      {LISTE_ACTIVITES.map((a) => {
        const Icone = ICONES[ACTIVITES[a]!.icone];
        return (
          <Tuile key={a} name="activite" value={a} checked={valeur === a} onChange={() => choisir(a)} className="min-h-24 flex-col items-center justify-center gap-2 p-3 text-center">
            <Icone aria-hidden className="size-7 text-prim" />
            <span className="text-sm font-semibold">{t(`activite.${a}`)}</span>
          </Tuile>
        );
      })}
    </fieldset>
  );
}

/** Petit dessin de la mise en page de chaque modèle. */
function DessinModele({ modele }: { modele: ModeleBoutique }) {
  const bloc = 'rounded-[3px] bg-prim/25';
  return (
    <span aria-hidden className="flex aspect-[4/5] w-full flex-col gap-1 overflow-hidden rounded-lg border border-trait bg-fond p-1.5">
      <span className="h-1.5 w-1/2 rounded-full bg-encre/30" />
      {modele === 'grandes_photos' ? (
        <><span className={`${bloc} h-1/2`} /><span className={`${bloc} flex-1`} /></>
      ) : modele === 'produit_unique' ? (
        <><span className={`${bloc} aspect-square`} /><span className="h-1.5 w-2/3 rounded-full bg-encre/30" /><span className="mt-auto h-3 rounded bg-prim" /></>
      ) : (
        <>
          {modele === 'catalogue' ? <span className="flex gap-1"><span className="h-2 flex-1 rounded-full border border-trait-fort" /><span className="h-2 w-3 rounded-full bg-prim" /></span> : <span className={`${bloc} h-5`} />}
          <span className="grid flex-1 grid-cols-2 gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className={bloc} />)}</span>
        </>
      )}
    </span>
  );
}

export function ChoixModele({ valeur, choisir }: { valeur: ModeleBoutique; choisir: (m: ModeleBoutique) => void }) {
  const t = useTranslations('boutiqueAdmin');
  return (
    <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <legend className="sr-only">{t('modeleTitre')}</legend>
      {MODELES.map((m) => (
        <Tuile key={m} name="modele" value={m} checked={valeur === m} onChange={() => choisir(m)} className="flex-col gap-2 p-2.5">
          <DessinModele modele={m} />
          <span className="text-sm font-semibold">{t(`modele.${m}`)}</span>
          <span className="text-xs leading-snug text-doux">{t(`modeleTexte.${m}`)}</span>
        </Tuile>
      ))}
    </fieldset>
  );
}

export function ChoixLogo({ nom, forme, icone, choisirForme, choisirIcone }: { nom: string; forme: FormeLogo; icone: string | null; choisirForme: (f: FormeLogo) => void; choisirIcone: (i: string | null) => void }) {
  const t = useTranslations('boutiqueAdmin');
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('logoForme')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMES_LOGO.map((f) => (
            <Tuile key={f} name="logoForme" value={f} checked={forme === f} onChange={() => choisirForme(f)} label={t(`forme.${f}`)} className="min-h-20 items-center justify-center overflow-hidden p-3">
              <LogoBoutique nom={nom} forme={f} icone={icone} taille="m" className="max-w-full text-sm" />
            </Tuile>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('logoIcone')}</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
          <Tuile name="logoIcone" value="" checked={icone === null} onChange={() => choisirIcone(null)} label={t('initiales')} className="aspect-square items-center justify-center">
            <span className="b-titre text-sm font-bold text-prim">{t('initialesCourt')}</span>
          </Tuile>
          {ICONES_LOGO.map((i) => {
            const Icone = ICONES[i as IconeLogo];
            return (
              <Tuile key={i} name="logoIcone" value={i} checked={icone === i} onChange={() => choisirIcone(i)} label={t(`icone.${i}`)} className="aspect-square items-center justify-center">
                <Icone aria-hidden className="size-6 text-prim" />
              </Tuile>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export function ChoixCouleur({ valeur, choisir }: { valeur: string; choisir: (c: string) => void }) {
  const t = useTranslations('boutiqueAdmin');
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t('couleur')}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Object.entries(PALETTE).map(([cle, p]) => (
          <label key={cle} title={t(`couleurs.${cle}`)} className={`flex aspect-square cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-encre ${valeur === cle ? 'ring-2 ring-encre' : ''}`}>
            <input type="radio" name="couleur" value={cle} checked={valeur === cle} onChange={() => choisir(cle)} aria-label={t(`couleurs.${cle}`)} className="sr-only" />
            <svg aria-hidden viewBox="0 0 40 40" className="size-full"><circle cx={20} cy={20} r={20} fill={p.fond} /><path d="M20 0a20 20 0 0 1 0 40z" fill={p.pale} opacity={0.35} />{valeur === cle ? <path d="M13 20.5l4.5 4.5 9-9.5" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /> : null}</svg>
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-doux">{t(`couleurs.${valeur}`)}</p>
    </fieldset>
  );
}

export function ChoixAmbiance({ valeur, choisir }: { valeur: AmbianceBoutique; choisir: (a: AmbianceBoutique) => void }) {
  const t = useTranslations('boutiqueAdmin');
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t('ambianceTitre')}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AMBIANCES.map((a) => (
          <Tuile key={a} name="ambiance" value={a} checked={valeur === a} onChange={() => choisir(a)} className="flex-col gap-1 p-3">
            <span data-ambiance={a} className="flex flex-col gap-1">
              <span className="b-titre text-2xl font-bold text-prim">{t('ambianceExemple')}</span>
              <span className="b-bouton h-2 w-12 bg-prim" />
            </span>
            <span className="text-sm font-semibold">{t(`ambiance.${a}`)}</span>
            <span className="text-xs leading-snug text-doux">{t(`ambianceTexte.${a}`)}</span>
          </Tuile>
        ))}
      </div>
    </fieldset>
  );
}
