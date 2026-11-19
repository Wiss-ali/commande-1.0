// Aperçu réduit d'une boutique dans un cadre de téléphone : il suit en direct les choix du commerçant
// (modèle, couleur, ambiance, logo, phrase d'accroche). Les produits sont des exemples dessinés.
import type { AmbianceBoutique, FormeLogo, ModeleBoutique } from '@/lib/types-bd';
import { LogoBoutique } from './LogoBoutique';

interface Props {
  nom: string;
  couleur: string;
  ambiance: AmbianceBoutique;
  forme: FormeLogo;
  icone: string | null;
  modele: ModeleBoutique;
  slogan: string;
  logo?: string | null;
  banniere?: string | null;
  libelleBouton: string;
  libelleProduits: string;
}

export function ApercuMini({ nom, couleur, ambiance, forme, icone, modele, slogan, logo, banniere, libelleBouton, libelleProduits }: Props) {
  const compact = modele === 'catalogue' || modele === 'produit_unique';
  return (
    <div aria-hidden className={`b-c-${couleur} mx-auto w-full max-w-[17rem] select-none rounded-[2rem] border-[6px] border-encre/85 bg-fond shadow-xl`} data-ambiance={ambiance}>
      <div className="flex h-[30rem] flex-col overflow-hidden rounded-[1.6rem]">
        <div className="flex items-center gap-2 border-b border-trait bg-surface px-3 py-2.5 text-sm">
          <LogoBoutique nom={nom} forme={forme} icone={icone} image={logo} taille="s" avecNom={forme !== 'texte' || !!logo} className="min-w-0 flex-1" />
          <span className="b-bouton size-7 shrink-0 bg-prim" />
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-2.5">
          {banniere ? (
            <div className={`b-carte relative flex shrink-0 items-end overflow-hidden ${compact ? 'h-20' : 'h-36'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banniere} alt="" className="absolute inset-0 size-full object-cover" />
              <span className="b-voile absolute inset-0" />
              <p className="b-titre relative p-3 text-base font-bold leading-tight text-white">{slogan || nom}</p>
            </div>
          ) : (
            <div className={`b-hero b-carte flex shrink-0 flex-col gap-2 px-3 ${compact ? 'py-3' : 'items-center py-5 text-center'}`}>
              {!compact ? <LogoBoutique nom={nom} forme={forme === 'texte' ? 'rond' : forme} icone={icone} image={logo} taille="m" /> : null}
              <p className="b-titre text-base font-bold leading-tight">{slogan || nom}</p>
              <span className="b-bouton b-hero-bouton inline-flex self-center bg-prim px-3 py-1 text-[0.65rem] font-semibold text-sur-prim">{libelleBouton}</span>
            </div>
          )}
          {modele === 'produit_unique' ? (
            <div className="flex flex-col gap-1.5">
              <span className="b-carte b-sans-photo aspect-[4/3]" />
              <span className="h-2 w-2/3 rounded-full bg-encre/25" />
              <span className="b-bouton h-6 bg-prim" />
            </div>
          ) : (
            <>
              <p className="b-titre text-sm font-bold">{libelleProduits}</p>
              {modele === 'catalogue' ? <span className="b-bouton h-6 shrink-0 border border-trait-fort bg-surface" /> : null}
              <div className={modele === 'grandes_photos' ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2'}>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className="b-carte flex flex-col overflow-hidden border border-trait bg-surface">
                    <span className={`b-sans-photo ${modele === 'grandes_photos' ? 'aspect-[16/9]' : 'aspect-square'}`} />
                    <span className="flex flex-col gap-1 p-1.5"><span className="h-1.5 w-3/4 rounded-full bg-encre/25" /><span className="h-1.5 w-1/3 rounded-full bg-prim" /></span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
