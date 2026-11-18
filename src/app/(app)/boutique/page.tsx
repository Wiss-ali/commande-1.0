import { ExternalLink, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { basculerBoutique, basculerProduit, choisirAdresse, choisirModele, envoyerDemande, personnaliser } from '@/app/actions/boutique';
import { ChampPhoto } from '@/components/ChampPhoto';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { demandesDuCommercant, lireReglages, MODELES, PALETTE, RESEAUX, SECTIONS } from '@/lib/boutique';
import { config } from '@/lib/config';
import { formaterDate, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Module Boutique en ligne : mise en ligne, adresse, modèle, personnalisation, produits publiés, paiement par carte. */
export default async function ModuleBoutique() {
  const s = await pageUtilisateur('reglages', 'boutique');
  const t = await getTranslations('boutiqueAdmin');
  const tc = await getTranslations('commun');
  const langue = (await getLocale()) as Langue;
  const { r, c, produits, demandes, moi } = await avecCommercant(s.commercant.id, async (trx) => ({
    r: await lireReglages(trx),
    c: await trx.selectFrom('commercants').select(['sous_domaine', 'paiement_carte_actif', 'nom', 'telephone']).executeTakeFirstOrThrow(),
    produits: await trx.selectFrom('produits').select(['id', 'nom_fr', 'nom_ar', 'visible_boutique', 'nouveau']).where('archive_le', 'is', null).orderBy('nom_fr').limit(200).execute(),
    demandes: await demandesDuCommercant(trx),
    moi: await trx.selectFrom('utilisateurs').select('telephone').where('id', '=', s.utilisateur.id).executeTakeFirst(),
  }));
  const app = config();
  const adresse = c.sous_domaine
    ? app.DOMAINE_BOUTIQUES ? `${app.https ? 'https' : 'http'}://${c.sous_domaine}.${app.DOMAINE_BOUTIQUES}` : `${app.URL_APP.replace(/\/$/, '')}/b/${c.sous_domaine}`
    : null;
  const lienLocal = c.sous_domaine ? `/b/${c.sous_domaine}` : null;
  const ouverte = (type: string) => demandes.find((d) => d.type === type && d.etat === 'nouvelle');
  const ecrit = s.commercant.etat === 'actif';
  const publies = produits.filter((p) => p.visible_boutique).length;
  const champTexte = 'min-h-24 w-full rounded-xl border border-trait bg-surface px-3 py-2 text-base text-encre';
  const coordonnees = (
    <>
      <Champ libelle={t('demandeNom')} name="nom" defaultValue={s.utilisateur.nom} maxLength={120} required />
      <Champ libelle={t('demandeTelephone')} name="telephone" defaultValue={c.telephone ?? moi?.telephone ?? ''} type="tel" inputMode="tel" dir="ltr" maxLength={30} required />
    </>
  );

  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        {/* ───── En ligne ou coupée ───── */}
        <Carte className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Globe aria-hidden className="size-5 text-prim" /><h2 className="font-semibold">{t('etat')}</h2></div>
            <Pastille ton={r.enLigne ? 'vert' : 'neutre'}>{t(r.enLigne ? 'enLigne' : 'coupee')}</Pastille>
          </div>
          <p className="text-sm text-doux">{t(r.enLigne ? 'enLigneTexte' : 'coupeeTexte')}</p>
          {ecrit ? (
            <Formulaire action={basculerBoutique} bouton={t(r.enLigne ? 'couper' : 'mettreEnLigne')} style={r.enLigne ? 'danger' : 'principal'} garder>
              <input type="hidden" name="enLigne" value={r.enLigne ? 'non' : 'oui'} />
            </Formulaire>
          ) : null}
          {lienLocal ? <a href={lienLocal} target="_blank" rel="noopener" className={classeBouton.secondaire}><ExternalLink aria-hidden className="size-4" />{t(r.enLigne ? 'voir' : 'apercu')}</a> : null}
        </Carte>

        {/* ───── Adresse ───── */}
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('adresseTitre')}</h2>
          {adresse ? <p className="break-all text-sm font-semibold text-prim" dir="ltr">{adresse}</p> : <Message ton="info">{t('adresseVide')}</Message>}
          {ecrit ? (
            <Formulaire action={choisirAdresse} bouton={tc('enregistrer')} style="secondaire" succes={tc('enregistre')} garder>
              <Champ libelle={t('sousDomaine')} name="sousDomaine" defaultValue={c.sous_domaine ?? ''} maxLength={40} dir="ltr" autoComplete="off" aide={t('sousDomaineAide')} required />
            </Formulaire>
          ) : null}
        </Carte>

        {/* ───── Modèle ───── */}
        <TitreSection>{t('modeleTitre')}</TitreSection>
        <Formulaire action={choisirModele} bouton={t('choisirModele')} style="secondaire" succes={tc('enregistre')} garder>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t('modeleTitre')}</legend>
            {MODELES.map((m) => (
              <label key={m} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border border-trait bg-surface shadow-doux p-3 has-[:checked]:border-prim has-[:checked]:bg-prim-pale">
                <input type="radio" name="modele" value={m} defaultChecked={r.modele === m} className="mt-1 size-5 accent-prim" />
                <span><span className="block font-semibold">{t(`modele.${m}`)}</span><span className="block text-sm text-doux">{t(`modeleTexte.${m}`)}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('produitUnique')}</span>
            <select name="produitUnique" defaultValue={r.produitUniqueId ?? ''} className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre">
              <option value="">{t('premierProduit')}</option>
              {produits.filter((p) => p.visible_boutique).map((p) => <option key={p.id} value={p.id}>{nomLocal(p, langue)}</option>)}
            </select>
          </label>
        </Formulaire>
        <Carte className="flex flex-col gap-3 border-dashed">
          <div className="flex items-center gap-2"><Sparkles aria-hidden className="size-5 text-prim" /><h2 className="font-semibold">{t('sitePersoTitre')}</h2></div>
          <p className="text-sm">{t('sitePersoTexte')}</p>
          {ouverte('site_personnalise') ? <Message ton="info">{t('demandeEnvoyee', { date: formaterDate(ouverte('site_personnalise')!.cree_le) })}</Message> : ecrit ? (
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-prim">{t('sitePersoBouton')}</summary>
              <Formulaire action={envoyerDemande} bouton={t('envoyerDemande')} succes={t('demandeOk')}>
                <input type="hidden" name="type" value="site_personnalise" />
                {coordonnees}
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('demandeMessage')}</span><textarea name="message" maxLength={500} className={champTexte} /></label>
              </Formulaire>
            </details>
          ) : null}
        </Carte>

        {/* ───── Personnalisation ───── */}
        <TitreSection>{t('personnaliserTitre')}</TitreSection>
        <Formulaire action={personnaliser} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <Carte className="flex flex-col gap-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t('couleur')}</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PALETTE).map(([cle, p]) => (
                  <label key={cle} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-trait px-3 has-[:checked]:border-encre has-[:checked]:ring-2 has-[:checked]:ring-encre">
                    <input type="radio" name="couleur" value={cle} defaultChecked={r.couleur === cle} className="sr-only" />
                    <svg aria-hidden viewBox="0 0 20 20" className="size-5"><circle cx={10} cy={10} r={10} fill={p.fond} /></svg>
                    <span className="text-sm">{t(`couleurs.${cle}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <ChampPhoto nom="logo" libelle={t('logo')} actuelle={r.logoId && lienLocal ? `${lienLocal}/photo/${r.logoId}?t=p` : null} />
            <ChampPhoto nom="banniere" libelle={t('banniere')} actuelle={r.banniereId && lienLocal ? `${lienLocal}/photo/${r.banniereId}?t=p` : null} />
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h3 className="font-semibold">{t('textes')}</h3>
            {(['accueil', 'livraison', 'retour'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-2">
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t(`texte_${k}`)} (FR)</span><textarea name={`${k}_fr`} defaultValue={r[k].fr} maxLength={k === 'accueil' ? 500 : 1000} lang="fr" dir="ltr" className={champTexte} /></label>
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t(`texte_${k}`)} (AR)</span><textarea name={`${k}_ar`} defaultValue={r[k].ar} maxLength={k === 'accueil' ? 500 : 1000} lang="ar" dir="rtl" className={champTexte} /></label>
              </div>
            ))}
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h3 className="font-semibold">{t('ordreSections')}</h3>
            {SECTIONS.map((x) => (
              <label key={x} className="flex items-center justify-between gap-3">
                <span className="text-sm">{t(`section.${x}`)}</span>
                <select name={`position_${x}`} defaultValue={r.sections.indexOf(x) + 1} className="min-h-11 rounded-xl border border-trait bg-surface px-3">
                  {SECTIONS.map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </label>
            ))}
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h3 className="font-semibold">{t('contactTitre')}</h3>
            <Champ libelle={t('whatsapp')} name="whatsapp" defaultValue={r.whatsapp ?? ''} type="tel" inputMode="tel" dir="ltr" maxLength={30} />
            {RESEAUX.map((n) => <Champ key={n} libelle={t(`reseau.${n}`)} name={`reseau_${n}`} defaultValue={r.reseaux[n] ?? ''} type="url" dir="ltr" maxLength={200} placeholder={`https://www.${n}.com/…`} />)}
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h3 className="font-semibold">{t('stockTitre')}</h3>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t('ruptures')}</legend>
              {(['visible', 'masque'] as const).map((m) => (
                <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3"><input type="radio" name="ruptures" value={m} defaultChecked={r.ruptures === m} className="size-5 accent-prim" /><span className="text-sm">{t(`rupture_${m}`)}</span></label>
              ))}
            </fieldset>
            <Champ libelle={t('plusQue')} name="plusQue" defaultValue={String(r.plusQue)} inputMode="numeric" dir="ltr" maxLength={2} aide={t('plusQueAide')} />
            <Champ libelle={t('reservation')} name="reservationHeures" defaultValue={String(r.reservationHeures)} inputMode="numeric" dir="ltr" maxLength={3} aide={t('reservationAide')} />
          </Carte>
        </Formulaire>

        {/* ───── Produits publiés ───── */}
        <TitreSection>{t('produitsTitre', { n: publies })}</TitreSection>
        {produits.length ? (
          <ul className="flex flex-col gap-2">
            {produits.map((p) => (
              <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border border-trait bg-surface shadow-doux px-3 py-2">
                <Link href={`/stock/${p.id}`} className="min-w-0 flex-1 truncate font-semibold">{nomLocal(p, langue)}</Link>
                {(['visible_boutique', 'nouveau'] as const).map((champ) => (
                  <form key={champ} action={basculerProduit}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="champ" value={champ} />
                    <input type="hidden" name="valeur" value={p[champ] ? 'non' : 'oui'} />
                    <button type="submit" aria-pressed={p[champ]} aria-label={`${t(champ === 'nouveau' ? 'nouveau' : 'visible')} · ${nomLocal(p, langue)}`} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${p[champ] ? 'border-prim bg-prim-pale text-prim' : 'border-trait text-doux'}`}>
                      {t(champ === 'nouveau' ? 'nouveau' : 'visible')}
                    </button>
                  </form>
                ))}
              </li>
            ))}
          </ul>
        ) : <Message ton="info">{t('aucunProduit')}</Message>}

        {/* ───── Paiement par carte ───── */}
        <TitreSection>{t('carteTitre')}</TitreSection>
        <Carte className="flex flex-col gap-3">
          <p className="text-sm">{t(c.paiement_carte_actif ? 'carteActive' : 'carteInactive')}</p>
          {!c.paiement_carte_actif ? (ouverte('paiement_carte') ? <Message ton="info">{t('demandeEnvoyee', { date: formaterDate(ouverte('paiement_carte')!.cree_le) })}</Message> : ecrit ? (
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-prim">{t('demanderActivation')}</summary>
              <Formulaire action={envoyerDemande} bouton={t('envoyerDemande')} succes={t('demandeOk')}>
                <input type="hidden" name="type" value="paiement_carte" />
                {coordonnees}
              </Formulaire>
            </details>
          ) : null) : null}
        </Carte>
      </Page>
    </>
  );
}
