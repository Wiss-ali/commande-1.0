import { AlertTriangle, ExternalLink, Globe, PartyPopper, Sparkles, Trash2 } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { basculerBoutique, basculerProduit, choisirAdresse, creerMaBoutique, enregistrerPixelsBoutique, envoyerDemande, personnaliser, supprimerMaBoutique } from '@/app/actions/boutique';
import { ApparenceBoutique } from '@/components/boutique/ApparenceBoutique';
import { CreationBoutique } from '@/components/boutique/CreationBoutique';
import { LogoBoutique } from '@/components/boutique/LogoBoutique';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { demandesDuCommercant, lireReglages, PALETTE, RESEAUX, SECTIONS } from '@/lib/boutique';
import { LISTE_ACTIVITES, styleCouleur } from '@/lib/design-boutique';
import { textesExemple } from '@/lib/exemples-boutique';
import { config } from '@/lib/config';
import { formaterDate, nomLocal } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Module Boutique en ligne : mise en ligne, adresse, modèle, personnalisation, produits publiés, paiement par carte. */
export default async function ModuleBoutique({ searchParams }: { searchParams: Promise<{ creee?: string; supprimee?: string }> }) {
  const s = await pageUtilisateur('reglages', 'boutique');
  const t = await getTranslations('boutiqueAdmin');
  const tc = await getTranslations('commun');
  const langue = (await getLocale()) as Langue;
  const sp = await searchParams;
  const nonce = (await headers()).get('x-nonce') ?? '';
  const { r, c, produits, demandes, moi } = await avecCommercant(s.commercant.id, async (trx) => ({
    r: await lireReglages(trx),
    c: await trx.selectFrom('commercants').select(['sous_domaine', 'paiement_carte_actif', 'nom', 'telephone']).executeTakeFirstOrThrow(),
    produits: await trx.selectFrom('produits').select(['id', 'nom_fr', 'nom_ar', 'visible_boutique', 'nouveau']).where('archive_le', 'is', null).orderBy('nom_fr').limit(200).execute(),
    demandes: await demandesDuCommercant(trx),
    moi: await trx.selectFrom('utilisateurs').select('telephone').where('id', '=', s.utilisateur.id).executeTakeFirst(),
  }));
  const app = config();
  const [prefixe, suffixe] = app.DOMAINE_BOUTIQUES ? [`${app.https ? 'https' : 'http'}://`, `.${app.DOMAINE_BOUTIQUES}`] : [`${app.URL_APP.replace(/\/$/, '')}/b/`, ''];
  const adresse = c.sous_domaine ? `${prefixe}${c.sous_domaine}${suffixe}` : null;
  // Couleurs des aperçus : une classe par couleur de la palette (les styles en ligne sont interdits par la CSP).
  const stylesCouleurs = <style nonce={nonce}>{Object.keys(PALETTE).map((k) => styleCouleur(k, `.b-c-${k}`)).join('')}</style>;
  const te = await getTranslations('boutiqueExemples');
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

  // Pas encore de boutique (ou supprimée) : assistant de création.
  if (!c.sous_domaine) {
    return (
      <>
        <EnTete titre={t('titre')} retour="/plus" />
        <Page>
          {stylesCouleurs}
          {sp.supprimee ? <Message ton="succes">{t('supprimeeOk')}</Message> : null}
          {ecrit ? (
            <CreationBoutique action={creerMaBoutique} nom={s.commercant.nom} prefixe={prefixe} suffixe={suffixe} nbProduits={produits.length}
              slogans={Object.fromEntries(LISTE_ACTIVITES.map((a) => [a, te(`${a}.slogan`)]))} />
          ) : <Message ton="info">{t('lectureSeule')}</Message>}
        </Page>
      </>
    );
  }

  // Textes d'exemple de l'activité encore en place : à remplacer avant de mettre en ligne.
  const ex = textesExemple(r.activite);
  const restants = (['slogan', 'accueil', 'livraison', 'retour'] as const).filter((k) => (r[k].fr && r[k].fr === ex[k].fr) || (r[k].ar && r[k].ar === ex[k].ar));
  const logoUrl = r.logoId && lienLocal ? `${lienLocal}/photo/${r.logoId}?t=p` : null;

  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        {stylesCouleurs}
        {sp.creee ? (
          <div className={`b-c-${r.couleur} flex items-start gap-3 rounded-2xl border border-prim bg-prim-pale p-4`}>
            <PartyPopper aria-hidden className="size-6 shrink-0 text-prim" />
            <div className="flex flex-col gap-1"><p className="font-semibold">{t('creeeTitre')}</p><p className="text-sm">{t('creeeTexte')}</p></div>
          </div>
        ) : null}
        {/* ───── En ligne ou coupée ───── */}
        <Carte className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className={`b-c-${r.couleur} flex min-w-0 items-center gap-2`} data-ambiance={r.ambiance}>
              <LogoBoutique nom={s.commercant.nom} forme={r.logoForme} icone={r.logoIcone} image={logoUrl} taille="s" avecNom={r.logoForme !== 'texte' || !!logoUrl} />
            </div>
            <Pastille ton={r.enLigne ? 'vert' : 'neutre'}>{t(r.enLigne ? 'enLigne' : 'coupee')}</Pastille>
          </div>
          <h2 className="flex items-center gap-2 font-semibold"><Globe aria-hidden className="size-5 text-prim" />{t('etat')}</h2>
          <p className="text-sm text-doux">{t(r.enLigne ? 'enLigneTexte' : 'coupeeTexte')}</p>
          {restants.length && !r.enLigne ? <Message ton="info">{t('avantEnLigne')}</Message> : null}
          {ecrit ? (
            <Formulaire action={basculerBoutique} bouton={t(r.enLigne ? 'couper' : 'mettreEnLigne')} style={r.enLigne ? 'danger' : 'principal'} garder>
              <input type="hidden" name="enLigne" value={r.enLigne ? 'non' : 'oui'} />
            </Formulaire>
          ) : null}
          {lienLocal ? <a href={lienLocal} target="_blank" rel="noopener" className={classeBouton.secondaire}><ExternalLink aria-hidden className="size-4" />{t(r.enLigne ? 'voir' : 'apercu')}</a> : null}
        </Carte>

        {/* ───── Apparence : modèle, logo, couleur, ambiance, bannière (aperçu en direct) ───── */}
        <TitreSection>{t('apparenceTitre')}</TitreSection>
        {ecrit ? (
          <ApparenceBoutique action={personnaliser} nom={s.commercant.nom} slogan={r.slogan[langue] || r.slogan.fr}
            initial={{ modele: r.modele, couleur: r.couleur, ambiance: r.ambiance, forme: r.logoForme, icone: r.logoIcone, produitUniqueId: r.produitUniqueId }}
            logo={logoUrl} banniere={r.banniereId && lienLocal ? `${lienLocal}/photo/${r.banniereId}?t=p` : null}
            produits={produits.filter((p) => p.visible_boutique).map((p) => ({ id: p.id, nom: nomLocal(p, langue) }))} />
        ) : null}

        {/* ───── Textes : les textes d'exemple de l'activité sont signalés jusqu'à ce qu'ils soient remplacés ───── */}
        <TitreSection>{t('textes')}</TitreSection>
        {restants.length ? (
          <div className="flex items-start gap-3 rounded-2xl border border-safran bg-safran-pale p-4 text-sur-safran">
            <AlertTriangle aria-hidden className="size-5 shrink-0" />
            <div className="flex flex-col gap-1 text-sm"><p className="font-semibold">{t('exemplesTitre')}</p><p>{t('exemplesTexte', { liste: restants.map((k) => t(`texte_${k}`)).join(', ') })}</p></div>
          </div>
        ) : null}
        {ecrit ? (
          <Formulaire action={personnaliser} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
            <input type="hidden" name="partie" value="textes" />
            {(['slogan', 'accueil', 'livraison', 'retour'] as const).map((k) => (
              <Carte key={k} className={`flex flex-col gap-3 ${restants.includes(k) ? 'border-safran' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t(`texte_${k}`)}</h3>
                  {restants.includes(k) ? <Pastille ton="safran">{t('exemple')}</Pastille> : null}
                </div>
                <p className="-mt-2 text-sm text-doux">{t(`texteAide_${k}`)}</p>
                {(['fr', 'ar'] as const).map((l) => {
                  const max = k === 'slogan' ? 80 : k === 'accueil' ? 500 : 1000;
                  return (
                    <label key={l} className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">{t(l === 'fr' ? 'enFrancais' : 'enArabe')}</span>
                      {k === 'slogan'
                        ? <input name={`${k}_${l}`} defaultValue={r[k][l]} maxLength={max} lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className="min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre" />
                        : <textarea name={`${k}_${l}`} defaultValue={r[k][l]} maxLength={max} lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className={champTexte} />}
                    </label>
                  );
                })}
              </Carte>
            ))}
          </Formulaire>
        ) : null}

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


        {/* ───── Réglages : sections, contact, stock ───── */}
        <TitreSection>{t('personnaliserTitre')}</TitreSection>
        {ecrit ? (
        <Formulaire action={personnaliser} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <input type="hidden" name="partie" value="reglages" />
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
        ) : null}

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

        {/* ───── Mesure des publicités (pixels), désactivée tant que rien n'est collé ───── */}
        <details className="rounded-2xl border border-trait bg-surface shadow-doux" open={Boolean(r.pixels.facebook || r.pixels.tiktok)}>
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 font-semibold">
            {t('pixelsTitre')}
            <Pastille ton={r.pixels.facebook || r.pixels.tiktok ? 'vert' : 'neutre'}>{t(r.pixels.facebook || r.pixels.tiktok ? 'pixelsActifs' : 'pixelsInactifs')}</Pastille>
          </summary>
          <div className="flex flex-col gap-3 p-4 pt-0">
            <p className="text-sm text-doux">{t('pixelsTexte')}</p>
            <Formulaire action={enregistrerPixelsBoutique} bouton={t('pixelsEnregistrer')} succes={t('pixelsEnregistres')} garder>
              <Champ libelle={t('pixelFacebook')} name="pixelFacebook" defaultValue={r.pixels.facebook ?? ''} inputMode="numeric" dir="ltr" maxLength={30} autoComplete="off" aide={t('pixelFacebookAide')} />
              <Champ libelle={t('pixelTiktok')} name="pixelTiktok" defaultValue={r.pixels.tiktok ?? ''} dir="ltr" maxLength={40} autoComplete="off" aide={t('pixelTiktokAide')} />
            </Formulaire>
          </div>
        </details>

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

        {/* ───── Supprimer la boutique : il faut retaper l'adresse ───── */}
        {ecrit ? (
          <details className="rounded-2xl border border-terre/40 bg-surface">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-terre"><Trash2 aria-hidden className="size-5" />{t('supprimerTitre')}</summary>
            <div className="flex flex-col gap-3 p-4 pt-0">
              <p className="text-sm">{t('supprimerTexte')}</p>
              <ul className="list-disc ps-5 text-sm text-doux">
                <li>{t('supprimerEfface')}</li>
                <li>{t('supprimerGarde')}</li>
                <li>{t('supprimerAdresse')}</li>
              </ul>
              <Formulaire action={supprimerMaBoutique} bouton={t('supprimerBouton')} style="danger">
                <Champ libelle={t('supprimerConfirmer', { adresse: c.sous_domaine })} name="confirmation" dir="ltr" autoComplete="off" maxLength={60} required />
              </Formulaire>
            </div>
          </details>
        ) : null}
      </Page>
    </>
  );
}
