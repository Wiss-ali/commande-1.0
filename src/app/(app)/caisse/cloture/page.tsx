import { getLocale, getTranslations } from 'next-intl/server';
import { cloturer, definirFond } from '@/app/actions/ventes';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, LigneLien, Message, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { caisseOuverte, resumeCaisse } from '@/lib/documents';
import { peut } from '@/lib/droits';
import { formaterDate, formaterHeure, formaterMontant, montantPourSaisie } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

export default async function Cloture() {
  const s = await pageUtilisateur('vendre', 'caisse');
  const t = await getTranslations('cloture');
  const langue = (await getLocale()) as Langue;
  const proprietaire = peut(s.utilisateur.role, 'rapports');
  const { ouverte, passees } = await avecCommercant(s.commercant.id, async (trx) => {
    const id = await caisseOuverte(trx, { commercantId: s.commercant.id, utilisateurId: s.utilisateur.id }, false);
    return {
      ouverte: id ? await resumeCaisse(trx, id) : null,
      passees: proprietaire
        ? await trx.selectFrom('sessions_caisse as c').innerJoin('utilisateurs as u', 'u.id', 'c.fermee_par').select(['c.id', 'c.fermee_le', 'c.especes_attendues', 'c.especes_comptees', 'u.nom'])
            .where('c.fermee_le', 'is not', null).orderBy('c.fermee_le', 'desc').limit(30).execute()
        : [],
    };
  });
  const ecrit = s.commercant.etat === 'actif';

  return (
    <>
      <EnTete titre={t('titre')} retour="/caisse" />
      <Page>
        {ouverte ? (
          <>
            <Carte className="flex flex-col gap-2">
              <p className="text-sm text-doux">{t('ouverte', { nom: ouverte.ouvertePar })} <span className="chiffres">{formaterDate(ouverte.ouverteLe)} {formaterHeure(ouverte.ouverteLe)}</span></p>
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-sm text-doux">{t('ventes')}</dt><dd className="chiffres text-2xl font-bold">{ouverte.ventes}</dd></div>
                <div><dt className="text-sm text-doux">{t('fond')}</dt><dd className="text-2xl font-bold">{formaterMontant(ouverte.fond, langue)}</dd></div>
              </dl>
            </Carte>
            {ecrit ? (
              <>
                <details className="rounded-xl border border-trait bg-surface">
                  <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-vert">{t('changerFond')}</summary>
                  <div className="p-4 pt-0">
                    <Formulaire action={definirFond} bouton={t('enregistrerFond')} succes={t('fondEnregistre')} style="secondaire" garder>
                      <Champ libelle={t('fondChamp')} name="fond" defaultValue={montantPourSaisie(ouverte.fond)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('fondAide')} />
                    </Formulaire>
                  </div>
                </details>
                <Carte className="flex flex-col gap-3">
                  <h2 className="font-semibold">{t('compterTitre')}</h2>
                  {/* Le montant attendu n'est pas montré avant le comptage : on compte sans être influencé. */}
                  <p className="text-sm text-doux">{t('compterTexte')}</p>
                  <Formulaire action={cloturer} bouton={t('cloturer')}>
                    <Champ libelle={t('comptees')} name="comptees" inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" required />
                    <Champ libelle={t('note')} name="note" maxLength={200} autoComplete="off" />
                  </Formulaire>
                </Carte>
              </>
            ) : null}
          </>
        ) : (
          <Message ton="info">{t('aucune')}</Message>
        )}

        {passees.length ? (
          <>
            <TitreSection>{t('passees')}</TitreSection>
            <div className="flex flex-col gap-2">
              {passees.map((c) => {
                const ecart = Number(c.especes_comptees) - Number(c.especes_attendues);
                return (
                  <LigneLien key={c.id} href={`/caisse/cloture/${c.id}`} titre={c.fermee_le ? `${formaterDate(c.fermee_le)} ${formaterHeure(c.fermee_le)}` : ''} aide={c.nom}
                    fin={<Pastille ton={ecart === 0 ? 'vert' : 'safran'}>{ecart === 0 ? t('juste') : formaterMontant(ecart, langue)}</Pastille>} />
                );
              })}
            </div>
          </>
        ) : null}
      </Page>
    </>
  );
}
