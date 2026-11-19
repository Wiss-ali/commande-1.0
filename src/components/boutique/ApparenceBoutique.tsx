'use client';
// Écran « Apparence » d'une boutique existante : modèle, logo (dessiné ou envoyé), bannière, couleur, ambiance,
// avec un aperçu qui suit chaque choix. Enregistré par l'action « personnaliser ».
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Etat } from '@/lib/etat';
import type { AmbianceBoutique, FormeLogo, ModeleBoutique } from '@/lib/types-bd';
import { ChampPhoto } from '../ChampPhoto';
import { Formulaire } from '../Formulaire';
import { ApercuMini } from './ApercuMini';
import { ChoixAmbiance, ChoixCouleur, ChoixLogo, ChoixModele } from './ChoixDesign';

interface Props {
  action: (etat: Etat, f: FormData) => Promise<Etat>;
  nom: string;
  slogan: string;
  initial: { modele: ModeleBoutique; couleur: string; ambiance: AmbianceBoutique; forme: FormeLogo; icone: string | null; produitUniqueId: string | null };
  logo: string | null;
  banniere: string | null;
  produits: { id: string; nom: string }[];
}

export function ApparenceBoutique({ action, nom, slogan, initial, logo, banniere, produits }: Props) {
  const t = useTranslations('boutiqueAdmin');
  const tc = useTranslations('commun');
  const [modele, setModele] = useState(initial.modele);
  const [couleur, setCouleur] = useState(initial.couleur);
  const [ambiance, setAmbiance] = useState(initial.ambiance);
  const [forme, setForme] = useState(initial.forme);
  const [icone, setIcone] = useState(initial.icone);
  const carte = 'flex flex-col gap-4 rounded-2xl border border-trait bg-surface p-4 shadow-doux';
  return (
    <div className={`b-c-${couleur}`}>
      <Formulaire action={action} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
        <input type="hidden" name="partie" value="apparence" />
        <div className="grid gap-4 md:grid-cols-[1fr_18rem] md:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <div className={carte}>
              <h3 className="font-semibold">{t('modeleTitre')}</h3>
              <ChoixModele valeur={modele} choisir={setModele} />
              {modele === 'produit_unique' ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t('produitUnique')}</span>
                  <select name="produitUnique" defaultValue={initial.produitUniqueId ?? ''} className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre">
                    <option value="">{t('premierProduit')}</option>
                    {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <div className={carte}>
              <h3 className="font-semibold">{t('logo')}</h3>
              <ChoixLogo nom={nom} forme={forme} icone={icone} choisirForme={setForme} choisirIcone={setIcone} />
              <ChampPhoto nom="logo" libelle={t('logoImage')} actuelle={logo} />
            </div>
            <div className={carte}>
              <ChoixCouleur valeur={couleur} choisir={setCouleur} />
              <ChoixAmbiance valeur={ambiance} choisir={setAmbiance} />
              <ChampPhoto nom="banniere" libelle={t('banniere')} actuelle={banniere} />
              <p className="-mt-2 text-sm text-doux">{t('banniereAide')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:sticky md:top-20">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-doux">{t('apercuDirect')}</p>
            <ApercuMini nom={nom} couleur={couleur} ambiance={ambiance} forme={forme} icone={icone} modele={modele} slogan={slogan} logo={logo} banniere={banniere} libelleBouton={t('apercuBouton')} libelleProduits={t('apercuProduits')} />
          </div>
        </div>
      </Formulaire>
    </div>
  );
}
