'use client';
// Assistant de création d'une boutique, en cinq étapes courtes : activité, adresse, modèle, logo et couleurs, résumé.
// L'aperçu suit chaque choix. À la fin, la boutique est créée coupée, avec des textes d'exemple à remplacer.
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { ACTIVITES, adresseProposee } from '@/lib/design-boutique';
import type { Etat } from '@/lib/etat';
import type { AmbianceBoutique, FormeLogo, ModeleBoutique } from '@/lib/types-bd';
import { classeBouton, Message } from '../ui';
import { ApercuMini } from './ApercuMini';
import { ChoixActivite, ChoixAmbiance, ChoixCouleur, ChoixLogo, ChoixModele } from './ChoixDesign';

const ETAPES = ['activite', 'adresse', 'modele', 'logo', 'resume'] as const;

interface Props {
  action: (etat: Etat, f: FormData) => Promise<Etat>;
  nom: string;
  /** Adresse publique sans le nom (« https://…/b/ » ou « https:// » + « .domaine »). */
  prefixe: string;
  suffixe: string;
  /** Slogans d'exemple par activité, dans la langue de l'écran (aperçu). */
  slogans: Record<string, string>;
  nbProduits: number;
}

export function CreationBoutique({ action, nom, prefixe, suffixe, slogans, nbProduits }: Props) {
  const t = useTranslations('boutiqueAdmin');
  const te = useTranslations('erreurs');
  const [etat, envoyer, enCours] = useActionState(action, {});
  const [etape, setEtape] = useState(0);
  const [activite, setActivite] = useState('autre');
  const [adresse, setAdresse] = useState(adresseProposee(nom));
  const [modele, setModele] = useState<ModeleBoutique>('vitrine');
  const [couleur, setCouleur] = useState(ACTIVITES.autre!.couleur);
  const [ambiance, setAmbiance] = useState<AmbianceBoutique>(ACTIVITES.autre!.ambiance);
  const [forme, setForme] = useState<FormeLogo>('rond');
  const [icone, setIcone] = useState<string | null>(ACTIVITES.autre!.icone);
  const [publier, setPublier] = useState(true);
  const haut = useRef<HTMLFormElement>(null);
  const premier = useRef(true);
  // Chaque nouvelle étape commence en haut de l'écran.
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    haut.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [etape]);
  const adresseOk = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(adresse) && !adresse.includes('--');
  const erreurAdresse = etat.erreur?.startsWith('sous_domaine');

  /** Choisir une activité propose aussi son icône, sa couleur et son ambiance (modifiables ensuite). */
  function choisirActivite(a: string) {
    setActivite(a);
    const d = ACTIVITES[a];
    if (d) { setCouleur(d.couleur); setAmbiance(d.ambiance); setIcone(d.icone); }
  }
  const cle = ETAPES[etape]!;
  const suivant = () => setEtape((e) => Math.min(e + 1, ETAPES.length - 1));

  return (
    <form
      ref={haut}
      action={envoyer}
      onSubmit={(e) => {
        e.preventDefault();
        if (cle !== 'resume') return suivant();
        const f = new FormData();
        for (const [k, v] of Object.entries({ activite, sousDomaine: adresse, modele, couleur, ambiance, logoForme: forme, logoIcone: icone ?? '', publierTout: publier ? 'oui' : 'non' })) f.set(k, v);
        startTransition(() => envoyer(f));
      }}
      className={`b-c-${couleur} grid scroll-mt-20 gap-6 md:grid-cols-[1fr_18rem] md:items-start`}
    >
      <div className="flex min-w-0 flex-col gap-5">
        {/* Progression */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-prim">{t('assistant.etape', { n: etape + 1, total: ETAPES.length })}</p>
          <div className="flex gap-1.5" aria-hidden>
            {ETAPES.map((x, i) => <span key={x} className={`h-1.5 flex-1 rounded-full ${i <= etape ? 'bg-prim' : 'bg-trait'}`} />)}
          </div>
          <h2 className="pt-2 text-2xl font-bold">{t(`assistant.${cle}Titre`)}</h2>
          <p className="text-doux">{t(`assistant.${cle}Texte`)}</p>
        </div>

        {cle === 'activite' ? <ChoixActivite valeur={activite} choisir={choisirActivite} /> : null}

        {cle === 'adresse' ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('sousDomaine')}</span>
              <span className="flex min-h-12 items-center overflow-hidden rounded-xl border border-trait bg-surface focus-within:border-prim focus-within:ring-2 focus-within:ring-prim/30" dir="ltr">
                {prefixe ? <span className="hidden shrink-0 ps-3 text-sm text-doux sm:inline">{prefixe}</span> : null}
                <input value={adresse} onChange={(e) => setAdresse(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={40} autoComplete="off" autoFocus required aria-invalid={!adresseOk || erreurAdresse} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base font-semibold outline-none sm:ps-0.5" />
                {suffixe ? <span className="shrink-0 pe-3 text-sm text-doux">{suffixe}</span> : null}
              </span>
            </label>
            <p className="text-sm text-doux">{t('sousDomaineAide')}</p>
            <p className="break-all text-sm font-semibold text-prim" dir="ltr">{prefixe}{adresse || '…'}{suffixe}</p>
            {erreurAdresse ? <Message ton="erreur">{te(etat.erreur!)}</Message> : null}
          </div>
        ) : null}

        {cle === 'modele' ? <ChoixModele valeur={modele} choisir={setModele} /> : null}

        {cle === 'logo' ? (
          <div className="flex flex-col gap-6">
            <ChoixLogo nom={nom} forme={forme} icone={icone} choisirForme={setForme} choisirIcone={setIcone} />
            <ChoixCouleur valeur={couleur} choisir={setCouleur} />
            <ChoixAmbiance valeur={ambiance} choisir={setAmbiance} />
            <p className="text-sm text-doux">{t('assistant.logoImage')}</p>
          </div>
        ) : null}

        {cle === 'resume' ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-trait bg-surface p-4 text-sm">
              <dt className="text-doux">{t('assistant.activiteTitre')}</dt><dd className="font-semibold">{t(`activite.${activite}`)}</dd>
              <dt className="text-doux">{t('adresseTitre')}</dt><dd className="break-all font-semibold" dir="ltr">{prefixe}{adresse}{suffixe}</dd>
              <dt className="text-doux">{t('modeleTitre')}</dt><dd className="font-semibold">{t(`modele.${modele}`)}</dd>
              <dt className="text-doux">{t('ambianceTitre')}</dt><dd className="font-semibold">{t(`ambiance.${ambiance}`)} · {t(`couleurs.${couleur}`)}</dd>
            </dl>
            {nbProduits ? (
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-trait bg-surface px-4 py-3">
                <input type="checkbox" checked={publier} onChange={(e) => setPublier(e.target.checked)} className="size-5 accent-prim" />
                <span className="text-sm"><span className="block font-semibold">{t('assistant.publierTout', { n: nbProduits })}</span><span className="block text-doux">{t('assistant.publierToutAide')}</span></span>
              </label>
            ) : <Message ton="info">{t('assistant.aucunProduit')}</Message>}
            <Message ton="info">{t('assistant.textesExemple')}</Message>
          </div>
        ) : null}

        {etat.erreur && !(erreurAdresse && cle === 'adresse') ? <Message ton="erreur">{te(etat.erreur)}</Message> : null}

        <div className="flex gap-2">
          {etape > 0 ? (
            <button type="button" onClick={() => setEtape(etape - 1)} className={classeBouton.secondaire}><ArrowLeft aria-hidden className="directionnelle size-4" />{t('assistant.precedent')}</button>
          ) : null}
          <button type="submit" disabled={enCours || (cle === 'adresse' && !adresseOk)} className={`${classeBouton.principal} flex-1`}>
            {cle === 'resume' ? <><Rocket aria-hidden className="size-5" />{enCours ? t('assistant.creation') : t('assistant.creer')}</> : <>{t('assistant.suivant')}<ArrowRight aria-hidden className="directionnelle size-4" /></>}
          </button>
        </div>
        {erreurAdresse && cle !== 'adresse' ? <button type="button" onClick={() => setEtape(1)} className="self-start text-sm font-semibold text-prim underline">{t('assistant.corrigerAdresse')}</button> : null}
      </div>

      <div className="flex flex-col gap-2 md:sticky md:top-20">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-doux">{t('apercuDirect')}</p>
        <ApercuMini nom={nom} couleur={couleur} ambiance={ambiance} forme={forme} icone={icone} modele={modele} slogan={slogans[activite] ?? ''} libelleBouton={t('apercuBouton')} libelleProduits={t('apercuProduits')} />
      </div>
    </form>
  );
}
