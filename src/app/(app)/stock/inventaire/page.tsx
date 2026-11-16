import { getTranslations } from 'next-intl/server';
import { annulerInv, demarrerInventaire, validerInv } from '@/app/actions/stock';
import { EcartsInventaire } from '@/components/EcartsInventaire';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { InventaireComptage } from '@/components/InventaireComptage';
import { Page } from '@/components/Page';
import { Carte, classeBouton, LigneLien, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { peut } from '@/lib/droits';
import { formaterDate } from '@/lib/formats';
import { lignesInventaire } from '@/lib/stock';
import { pageUtilisateur } from '@/lib/web';

export default async function Inventaire() {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('inventaire');
  const { ouvert, lignes, passes } = await avecCommercant(s.commercant.id, async (trx) => {
    const enCours = await trx.selectFrom('inventaires').select(['id', 'cree_le']).where('etat', '=', 'en_cours').executeTakeFirst();
    return {
      ouvert: enCours,
      lignes: enCours ? await lignesInventaire(trx, enCours.id) : [],
      passes: await trx.selectFrom('inventaires as i').innerJoin('utilisateurs as u', 'u.id', 'i.cree_par').select(['i.id', 'i.etat', 'i.termine_le', 'u.nom'])
        .where('i.etat', '<>', 'en_cours').orderBy('i.termine_le', 'desc').limit(20).execute(),
    };
  });
  const valide = peut(s.utilisateur.role, 'stock.corriger');
  const ecrit = s.commercant.etat === 'actif';
  const ecarts = lignes.filter((l) => l.comptee !== l.theorique).length;

  return (
    <>
      <EnTete titre={t('titre')} retour="/stock" />
      <Page>
        {ouvert ? (
          <>
            <InventaireComptage inventaireId={ouvert.id} lignes={lignes} />
            {lignes.length ? (
              <>
                <TitreSection>{t('ecartsTitre')}</TitreSection>
                <EcartsInventaire lignes={lignes} />
                {valide && ecrit ? (
                  <Carte className="flex flex-col gap-3">
                    <p className="text-sm">{t('validerTexte', { n: ecarts })}</p>
                    <Formulaire action={validerInv} bouton={t('valider')}>
                      <input type="hidden" name="inventaire" value={ouvert.id} />
                    </Formulaire>
                  </Carte>
                ) : (
                  <Message ton="info">{t('validerProprietaire')}</Message>
                )}
              </>
            ) : null}
            {valide && ecrit ? (
              <form action={annulerInv}>
                <input type="hidden" name="inventaire" value={ouvert.id} />
                <button type="submit" className={`${classeBouton.danger} w-full`}>{t('annuler')}</button>
              </form>
            ) : null}
          </>
        ) : (
          <Carte className="flex flex-col gap-3">
            <p className="font-semibold">{t('debutTitre')}</p>
            <p className="text-sm text-doux">{t('debutTexte')}</p>
            {ecrit ? (
              <form action={demarrerInventaire}>
                <button type="submit" className={classeBouton.principal}>{t('commencer')}</button>
              </form>
            ) : null}
          </Carte>
        )}

        {passes.length ? (
          <>
            <TitreSection>{t('passes')}</TitreSection>
            <div className="flex flex-col gap-2">
              {passes.map((i) => (
                <LigneLien key={i.id} href={`/stock/inventaire/${i.id}`} titre={i.termine_le ? formaterDate(i.termine_le) : ''} aide={i.nom}
                  fin={<Pastille ton={i.etat === 'valide' ? 'vert' : 'neutre'}>{t(i.etat === 'valide' ? 'etatValide' : 'etatAnnule')}</Pastille>} />
              ))}
            </div>
          </>
        ) : null}
      </Page>
    </>
  );
}
