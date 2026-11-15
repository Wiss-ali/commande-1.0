import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { accepter } from '@/app/actions/connexion';
import { Formulaire } from '@/components/Formulaire';
import { PagePublique } from '@/components/PagePublique';
import { Champ, classeBouton, TitreSection } from '@/components/ui';
import { formaterTelephone } from '@/lib/formats';
import { lireInvitation } from '@/lib/invitations';
import { reglage } from '@/lib/reglages-plateforme';

export default async function Invitation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const t = await getTranslations('invitation');
  const tl = await getTranslations('legal');
  const tr = await getTranslations('roles');
  const lue = await lireInvitation(jeton);

  if (!lue.valide) {
    return (
      <PagePublique titre={t('invalideTitre')} sousTitre={t('invalideTexte')}>
        <Link href="/connexion" className={classeBouton.secondaire}>{t('allerConnexion')}</Link>
      </PagePublique>
    );
  }
  const i = lue.invitation;
  const proprietaire = i.type === 'commercant' || (i.type === 'reinitialisation' && i.role === 'proprietaire');
  const min = await reglage(i.type === 'employe' ? 'mdp_min_employe' : 'mdp_min_proprietaire');
  const aideMdp = i.type === 'reinitialisation' && !proprietaire ? undefined : t('motDePasseAide', { min });
  const titre = i.type === 'commercant' ? t('titreCommercant') : i.type === 'employe' ? t('titreEmploye', { magasin: i.nomCommercant }) : t('titreReinit');

  return (
    <PagePublique titre={titre} sousTitre={i.type === 'employe' && i.role ? t('roleAttribue', { role: tr(i.role) }) : undefined}>
      <Formulaire action={accepter} bouton={i.type === 'reinitialisation' ? t('boutonReinit') : t('boutonCreer')} garder>
        <input type="hidden" name="jeton" value={jeton} />
        {i.telephone ? (
          <p className="rounded-lg bg-creux px-3 py-2.5 text-sm">
            {t('identifiant')} <strong className="chiffres">{formaterTelephone(i.telephone)}</strong>
          </p>
        ) : null}
        {i.type !== 'reinitialisation' ? <Champ libelle={t('votreNom')} name="nom" defaultValue={i.nom ?? ''} autoComplete="name" maxLength={80} required /> : null}
        <Champ libelle={t('motDePasse')} name="motDePasse" type="password" autoComplete="new-password" aide={aideMdp} required />
        {i.type === 'commercant' ? (
          <>
            <Champ libelle={t('nomMagasin')} name="nomMagasin" defaultValue={i.nomCommercant} maxLength={120} required />
            <details className="rounded-xl border border-trait bg-surface p-4">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">{t('infosLegales')}</summary>
              <div className="flex flex-col gap-4 pt-3">
                <p className="text-sm text-doux">{t('infosLegalesAide')}</p>
                <TitreSection>{t('infosLegales')}</TitreSection>
                <Champ libelle={tl('formeJuridique')} name="formeJuridique" maxLength={80} />
                <Champ libelle={tl('adresse')} name="adresse" maxLength={300} />
                <Champ libelle={tl('rc')} name="rc" maxLength={40} dir="ltr" />
                <Champ libelle={tl('nif')} name="nif" maxLength={40} dir="ltr" />
                <Champ libelle={tl('nis')} name="nis" maxLength={40} dir="ltr" />
                <Champ libelle={tl('ai')} name="ai" maxLength={40} dir="ltr" />
              </div>
            </details>
          </>
        ) : null}
      </Formulaire>
    </PagePublique>
  );
}
