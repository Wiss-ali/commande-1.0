import { getTranslations } from 'next-intl/server';
import { basculerTransporteur, nouveauTransporteur } from '@/app/actions/commandes';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { GrilleFrais } from '@/components/GrilleFrais';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { lireFrais, listerTransporteurs, listerWilayas } from '@/lib/commandes';
import { montantPourSaisie } from '@/lib/formats';
import { pageUtilisateur } from '@/lib/web';

export default async function Livraison() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('livraison');
  const { transporteurs, wilayas, frais } = await avecCommercant(s.commercant.id, async (trx) => ({
    transporteurs: await listerTransporteurs(trx, true), wilayas: await listerWilayas(trx), frais: await lireFrais(trx),
  }));
  const prix = (v: number | null | undefined) => (v === null || v === undefined ? '' : montantPourSaisie(v));
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <TitreSection>{t('transporteurs')}</TitreSection>
        <p className="text-sm text-doux">{t('transporteursAide')}</p>
        {transporteurs.length ? (
          <ul className="flex flex-col gap-2">
            {transporteurs.map((tr) => (
              <li key={tr.id} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-trait bg-surface px-4 py-2">
                <span className={`font-semibold ${tr.actif ? '' : 'text-doux line-through'}`}>{tr.nom}</span>
                <form action={basculerTransporteur}>
                  <input type="hidden" name="id" value={tr.id} />
                  <input type="hidden" name="actif" value={tr.actif ? 'non' : 'oui'} />
                  <button type="submit" className={classeBouton.secondaire}>{t(tr.actif ? 'desactiver' : 'activer')}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <Carte>
          <Formulaire action={nouveauTransporteur} bouton={t('ajouter')} style="secondaire">
            <Champ libelle={t('nomTransporteur')} name="nom" maxLength={60} autoComplete="off" required />
          </Formulaire>
        </Carte>

        <TitreSection>{t('frais')}</TitreSection>
        <p className="text-sm text-doux">{t('fraisAide')}</p>
        <GrilleFrais lignes={wilayas.map((w) => ({ ...w, domicile: prix(frais.get(w.code)?.domicile), relais: prix(frais.get(w.code)?.pointRelais) }))} />
      </Page>
    </>
  );
}
