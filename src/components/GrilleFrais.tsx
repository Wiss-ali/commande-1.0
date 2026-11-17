'use client';
// Frais de livraison par wilaya : à domicile et en point relais. Une case vide : mode non proposé.
// « Remplir partout » met le même prix dans toutes les wilayas, à corriger ensuite au cas par cas.
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { enregistrerGrille } from '@/app/actions/commandes';
import { nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { Formulaire } from './Formulaire';
import { Carte, classeBouton } from './ui';

interface Ligne {
  code: number;
  nom_fr: string;
  nom_ar: string;
  domicile: string;
  relais: string;
}

export function GrilleFrais({ lignes: initiales }: { lignes: Ligne[] }) {
  const t = useTranslations('livraison');
  const tc = useTranslations('commun');
  const langue = useLocale() as Langue;
  const [lignes, setLignes] = useState(initiales);
  const [tousDomicile, setTousDomicile] = useState('');
  const [tousRelais, setTousRelais] = useState('');
  const changer = (code: number, champ: 'domicile' | 'relais', v: string) => setLignes((x) => x.map((l) => (l.code === code ? { ...l, [champ]: v } : l)));
  const champ = 'min-h-11 w-full min-w-0 rounded-lg border border-trait bg-surface px-2 text-base text-encre';

  return (
    <Formulaire action={enregistrerGrille} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
      <Carte className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('remplirTitre')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('domicile')}</span><input value={tousDomicile} onChange={(e) => setTousDomicile(e.target.value)} inputMode="decimal" dir="ltr" maxLength={10} className={champ} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('relais')}</span><input value={tousRelais} onChange={(e) => setTousRelais(e.target.value)} inputMode="decimal" dir="ltr" maxLength={10} className={champ} /></label>
        </div>
        <button type="button" onClick={() => setLignes((x) => x.map((l) => ({ ...l, domicile: tousDomicile, relais: tousRelais })))} className={classeBouton.secondaire}>{t('remplir')}</button>
      </Carte>
      <div className="rounded-xl border border-trait bg-surface">
        <div className="grid grid-cols-[1fr_6rem_6rem] gap-2 border-b border-trait px-3 py-2 text-xs font-semibold text-doux">
          <span>{t('wilaya')}</span><span>{t('domicile')}</span><span>{t('relais')}</span>
        </div>
        {lignes.map((l) => (
          <div key={l.code} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-2 border-b border-trait px-3 py-1.5 last:border-0">
            <span className="min-w-0 truncate text-sm"><span className="chiffres text-doux">{String(l.code).padStart(2, '0')}</span> {nomLocal(l, langue)}</span>
            <input name={`domicile_${l.code}`} value={l.domicile} onChange={(e) => changer(l.code, 'domicile', e.target.value)} aria-label={`${t('domicile')} · ${nomLocal(l, langue)}`} inputMode="decimal" dir="ltr" maxLength={10} className={champ} />
            <input name={`relais_${l.code}`} value={l.relais} onChange={(e) => changer(l.code, 'relais', e.target.value)} aria-label={`${t('relais')} · ${nomLocal(l, langue)}`} inputMode="decimal" dir="ltr" maxLength={10} className={champ} />
          </div>
        ))}
      </div>
    </Formulaire>
  );
}
