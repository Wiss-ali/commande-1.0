import { getTranslations } from 'next-intl/server';
import { activer2fa, changerMdp, deconnecterAppareil, desactiver2fa, preparer2fa } from '@/app/actions/reglages';
import { Activation2fa } from '@/components/Activation2fa';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, Pastille } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { peut } from '@/lib/droits';
import { formaterDate, formaterHeure } from '@/lib/formats';
import { pageUtilisateur } from '@/lib/web';

export default async function Securite() {
  const s = await pageUtilisateur();
  const t = await getTranslations('securite');
  const tc = await getTranslations('commun');
  const appareils = await avecCommercant(s.commercant.id, (trx) =>
    trx.selectFrom('sessions').select(['id', 'appareil', 'vue_le']).where('utilisateur_id', '=', s.utilisateur.id).where('expire_le', '>', new Date()).orderBy('vue_le', 'desc').execute());
  return (
    <>
      <EnTete titre={t('titre')} retour={peut(s.utilisateur.role, 'reglages') ? '/reglages' : '/plus'} />
      <Page>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('mdpTitre')}</h2>
          <Formulaire action={changerMdp} bouton={t('mdpBouton')} succes={t('mdpChange')}>
            <Champ libelle={t('mdpActuel')} name="actuel" type="password" autoComplete="current-password" required />
            <Champ libelle={t('mdpNouveau')} name="nouveau" type="password" autoComplete="new-password" required />
          </Formulaire>
        </Carte>

        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('a2fTitre')}</h2>
          {s.utilisateur.totpActif ? (
            <>
              <Pastille ton="vert">{t('a2fActive')}</Pastille>
              <Formulaire action={desactiver2fa} bouton={t('a2fDesactiver')} style="danger">
                <Champ libelle={t('a2fMdp')} name="motDePasse" type="password" autoComplete="current-password" required />
                <Champ libelle={t('a2fCode')} name="code" inputMode="numeric" dir="ltr" autoComplete="one-time-code" maxLength={20} required aide={t('a2fCodeAide')} />
              </Formulaire>
            </>
          ) : (
            <>
              <p className="text-sm text-doux">{t('a2fInactive')}</p>
              <Activation2fa preparer={preparer2fa} activer={activer2fa} suite={{ href: '/reglages/securite', libelle: tc('continuer') }} />
            </>
          )}
        </Carte>

        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('appareilsTitre')}</h2>
          <ul className="flex flex-col divide-y divide-trait">
            {appareils.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.appareil || t('appareilInconnu')}</p>
                  <p className="text-sm text-doux">{t('activite', { date: `${formaterDate(a.vue_le)} ${formaterHeure(a.vue_le)}` })}</p>
                </div>
                {a.id === s.id ? (
                  <Pastille ton="vert">{t('appareilActuel')}</Pastille>
                ) : (
                  <form action={deconnecterAppareil}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={classeBouton.secondaire}>{t('deconnecter')}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Carte>
      </Page>
    </>
  );
}
