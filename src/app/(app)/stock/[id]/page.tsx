import { randomUUID } from 'node:crypto';
import { Archive, ArchiveRestore, Pencil, Tags } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { basculerArchive, donnerCodeInterne, mouvementStock } from '@/app/actions/stock';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { ListeMouvements } from '@/components/ListeMouvements';
import { Page } from '@/components/Page';
import { PastilleStock } from '@/components/PastilleStock';
import { Carte, Champ, classeBouton, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { autorise, peut } from '@/lib/droits';
import { formaterMontant, nomLocal } from '@/lib/formats';
import { etatVariante, lireProduit, listerMouvements } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;
const MOTIFS = ['casse', 'perte', 'perime', 'erreur', 'autre'] as const;
const ERREURS = ['code_barres_pris'];

export default async function Produit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const s = await pageUtilisateur('preparer', 'stock');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('produit');
  const tm = await getTranslations('mouvement');
  const te = await getTranslations('erreurs');
  const langue = (await getLocale()) as Langue;
  const { produit, mouvements } = await avecCommercant(s.commercant.id, async (trx) => ({
    produit: await lireProduit(trx, id),
    mouvements: await listerMouvements(trx, { produitId: id, limite: 6 }),
  }));
  if (!produit) notFound();
  const gere = peut(s.utilisateur.role, 'stock.corriger');
  const fiche = autorise(s.utilisateur, 'produits.gerer');
  const voitAchat = peut(s.utilisateur.role, 'rapports');
  const ecrit = s.commercant.etat === 'actif' && !produit.archive;
  const { erreur: demandee } = await searchParams;
  const erreur = ERREURS.find((e) => e === demandee);
  const nom = nomLocal(produit, langue);
  const autreNom = langue === 'ar' ? produit.nom_fr : produit.nom_ar;
  const categorie = produit.categorie_id ? nomLocal({ nom_fr: produit.categorie_fr ?? '', nom_ar: produit.categorie_ar ?? '' }, langue) : '';

  return (
    <>
      <EnTete titre={nom} retour="/stock" />
      <Page>
        {erreur ? <Message ton="erreur">{te(erreur)}</Message> : null}
        {produit.archive ? <Message ton="info">{t('archive')}</Message> : null}
        <Carte className="flex items-center gap-4">
          {produit.photo_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/photos/${produit.photo_id}`} alt="" className="size-24 shrink-0 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{nom}</p>
            {autreNom && autreNom !== nom ? <p className="text-sm text-doux" lang={langue === 'ar' ? 'fr' : 'ar'} dir="auto">{autreNom}</p> : null}
            {categorie ? <p className="mt-1"><Pastille ton="neutre">{categorie}</Pastille></p> : null}
          </div>
        </Carte>

        {produit.variantes.map((v) => (
          <Carte key={v.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {v.libelle ? <h2 className="font-semibold">{v.libelle}</h2> : null}
                <p className="text-sm text-doux">{t('enStock')}</p>
                <p className="chiffres text-3xl font-bold">{v.quantite}</p>
                {v.reservee > 0 ? <p className="text-sm text-doux">{t('reserve', { n: v.reservee })}</p> : null}
              </div>
              <PastilleStock etat={etatVariante(v.quantite, v.seuil_alerte)} />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div><dt className="text-doux">{t('prixVente')}</dt><dd className="font-semibold">{formaterMontant(BigInt(v.prix_vente), langue)}</dd></div>
              {voitAchat ? <div><dt className="text-doux">{t('prixAchat')}</dt><dd className="font-semibold">{formaterMontant(BigInt(v.prix_achat), langue)}</dd></div> : null}
              <div><dt className="text-doux">{t('codeBarres')}</dt><dd className="chiffres font-semibold">{v.code_barres ?? '—'}</dd></div>
              <div><dt className="text-doux">{t('seuil')}</dt><dd className="chiffres font-semibold">{v.seuil_alerte}</dd></div>
            </dl>
            {fiche && ecrit && !v.code_barres ? (
              <form action={donnerCodeInterne}>
                <input type="hidden" name="variante" value={v.id} />
                <button type="submit" className={classeBouton.secondaire}>{t('creerCode')}</button>
              </form>
            ) : null}
            {ecrit ? (
              <>
                <details className="rounded-lg border border-trait">
                  <summary className="flex min-h-12 cursor-pointer items-center px-3 font-semibold text-vert">{tm('entreeTitre')}</summary>
                  <div className="p-3 pt-0">
                    <Formulaire action={mouvementStock} bouton={tm('entreeBouton')} succes={tm('enregistre')}>
                      <input type="hidden" name="sens" value="entree" />
                      <input type="hidden" name="variante" value={v.id} />
                      <input type="hidden" name="cle" value={randomUUID()} />
                      <Champ libelle={tm('quantiteRecue')} name="quantite" inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" required />
                      {voitAchat ? <Champ libelle={tm('prixAchat')} name="prix" inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={tm('prixAchatAide')} /> : null}
                      <Champ libelle={tm('note')} name="note" maxLength={200} autoComplete="off" />
                    </Formulaire>
                  </div>
                </details>
                {gere ? (
                  <details className="rounded-lg border border-trait">
                    <summary className="flex min-h-12 cursor-pointer items-center px-3 font-semibold text-terre">{tm('sortieTitre')}</summary>
                    <div className="p-3 pt-0">
                      <Formulaire action={mouvementStock} bouton={tm('sortieBouton')} succes={tm('enregistre')} style="danger">
                        <input type="hidden" name="sens" value="sortie" />
                        <input type="hidden" name="variante" value={v.id} />
                        <input type="hidden" name="cle" value={randomUUID()} />
                        <Champ libelle={tm('quantiteSortie')} name="quantite" inputMode="numeric" dir="ltr" maxLength={7} autoComplete="off" required />
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium">{tm('raison')}</span>
                          <select name="motif" className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre">
                            {MOTIFS.map((m) => <option key={m} value={m}>{tm(`motif.${m}`)}</option>)}
                          </select>
                        </label>
                        <Champ libelle={tm('note')} name="note" maxLength={200} autoComplete="off" />
                      </Formulaire>
                    </div>
                  </details>
                ) : null}
              </>
            ) : null}
          </Carte>
        ))}

        {fiche && s.commercant.etat === 'actif' ? (
          <div className="flex flex-wrap gap-2">
            {produit.archive ? null : <Link href={`/stock/${id}/modifier`} className={classeBouton.secondaire}><Pencil aria-hidden className="size-4" />{t('modifier')}</Link>}
            {produit.archive ? null : <Link href={`/stock/etiquettes?produit=${id}`} className={classeBouton.secondaire}><Tags aria-hidden className="size-4" />{t('etiquettes')}</Link>}
            {gere ? <form action={basculerArchive}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archiver" value={produit.archive ? '0' : '1'} />
              <button type="submit" className={produit.archive ? classeBouton.secondaire : classeBouton.danger}>
                {produit.archive ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
                {t(produit.archive ? 'retablir' : 'archiver')}
              </button>
            </form> : null}
          </div>
        ) : null}

        <TitreSection>{tm('derniers')}</TitreSection>
        {mouvements.length ? (
          <>
            <ListeMouvements mouvements={mouvements.slice(0, 5)} />
            {mouvements.length > 5 ? <Link href={`/stock/mouvements?produit=${id}`} className={classeBouton.secondaire}>{tm('toutVoir')}</Link> : null}
          </>
        ) : (
          <p className="text-sm text-doux">{tm('aucun')}</p>
        )}
      </Page>
    </>
  );
}
