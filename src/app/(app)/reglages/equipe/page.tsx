import { getTranslations } from 'next-intl/server';
import { annulerInvitation, basculerBlocage, changerRole, inviter, lienMotDePasse, supprimerEmploye } from '@/app/actions/equipe';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, EtatVide, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterTelephone } from '@/lib/formats';
import { reglage } from '@/lib/reglages-plateforme';
import { pageUtilisateur } from '@/lib/web';

export default async function Equipe() {
  const s = await pageUtilisateur('equipe');
  const t = await getTranslations('equipe');
  const tr = await getTranslations('roles');
  const jours = await reglage('invitation_jours');
  const { membres, attente } = await avecCommercant(s.commercant.id, async (trx) => ({
    membres: await trx.selectFrom('utilisateurs').select(['id', 'nom', 'telephone', 'role', 'desactive']).where('supprime_le', 'is', null).orderBy('cree_le').execute(),
    attente: await trx.selectFrom('invitations').select(['id', 'nom', 'telephone', 'role', 'expire_le'])
      .where('type', '=', 'employe').where('utilisee_le', 'is', null).where('annulee_le', 'is', null).where('expire_le', '>', new Date()).orderBy('cree_le', 'desc').execute(),
  }));
  const employes = membres.filter((m) => m.role !== 'proprietaire');

  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('inviterTitre')}</h2>
          <Formulaire action={inviter} bouton={t('boutonInviter')} texteLien={t('lienPret', { jours })}>
            <Champ libelle={t('nom')} name="nom" maxLength={80} autoComplete="off" required />
            <Champ libelle={t('telephone')} name="telephone" type="tel" inputMode="tel" dir="ltr" placeholder="0550 12 34 56" autoComplete="off" required />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t('role')}</legend>
              {(['vendeur', 'preparateur'] as const).map((r) => (
                <label key={r} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-trait px-3 py-2.5">
                  <input type="radio" name="role" value={r} defaultChecked={r === 'vendeur'} className="mt-1 size-5 accent-vert" />
                  <span className="text-sm">{t(r === 'vendeur' ? 'roleVendeur' : 'rolePreparateur')}</span>
                </label>
              ))}
            </fieldset>
          </Formulaire>
        </Carte>

        {attente.length ? (
          <>
            <TitreSection>{t('enAttente')}</TitreSection>
            <ul className="flex flex-col gap-2">
              {attente.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-trait bg-surface px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.nom}</p>
                    <p className="text-sm text-doux">
                      <span className="chiffres">{formaterTelephone(i.telephone ?? '')}</span> · {i.role ? tr(i.role) : ''}
                    </p>
                    <p className="text-sm text-doux">{t('expire', { date: formaterDate(i.expire_le) })}</p>
                  </div>
                  <form action={annulerInvitation}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className={classeBouton.secondaire}>{t('annulerInvitation')}</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <TitreSection>{t('membres')}</TitreSection>
        <ul className="flex flex-col gap-2">
          {membres.map((m) => (
            <li key={m.id} className="rounded-xl border border-trait bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{m.nom}{m.id === s.utilisateur.id ? ` (${t('vous')})` : ''}</p>
                <Pastille ton={m.role === 'proprietaire' ? 'vert' : 'bleu'}>{tr(m.role)}</Pastille>
                {m.desactive ? <Pastille ton="terre">{t('bloque')}</Pastille> : null}
              </div>
              <p className="chiffres text-sm text-doux">{formaterTelephone(m.telephone ?? '')}</p>
              {m.role !== 'proprietaire' ? (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-vert">{t('actions')}</summary>
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <form action={changerRole}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="role" value={m.role === 'vendeur' ? 'preparateur' : 'vendeur'} />
                        <button type="submit" className={classeBouton.secondaire}>{t(m.role === 'vendeur' ? 'passerPreparateur' : 'passerVendeur')}</button>
                      </form>
                      <form action={basculerBlocage}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="bloquer" value={m.desactive ? '0' : '1'} />
                        <button type="submit" className={classeBouton.secondaire}>{t(m.desactive ? 'debloquer' : 'bloquer')}</button>
                      </form>
                      <form action={supprimerEmploye}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className={classeBouton.danger}>{t('supprimer')}</button>
                      </form>
                    </div>
                    <Formulaire action={lienMotDePasse} bouton={t('nouveauMdp')} style="secondaire" texteLien={t('lienReinitPret')} garder>
                      <input type="hidden" name="id" value={m.id} />
                    </Formulaire>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        {employes.length === 0 && attente.length === 0 ? <EtatVide titre={t('videTitre')} texte={t('videTexte')} /> : null}
      </Page>
    </>
  );
}
