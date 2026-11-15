import { getTranslations } from 'next-intl/server';
import { enregistrerEntreprise } from '@/app/actions/reglages';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Champ } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { dechiffrerOuNul } from '@/lib/chiffrement';
import { pageUtilisateur } from '@/lib/web';

export default async function Entreprise() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('entreprise');
  const tl = await getTranslations('legal');
  const tc = await getTranslations('commun');
  const c = await avecCommercant(s.commercant.id, (trx) => trx.selectFrom('commercants').selectAll().executeTakeFirstOrThrow());
  const clair = (col: 'adresse' | 'rc' | 'nif' | 'nis' | 'ai') => dechiffrerOuNul(c[`${col}_chiffre`], `commercants.${col}:${c.id}`) ?? '';
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <Formulaire action={enregistrerEntreprise} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <Champ libelle={t('nom')} name="nom" defaultValue={c.nom} maxLength={120} required />
          <Champ libelle={tl('formeJuridique')} name="formeJuridique" defaultValue={c.forme_juridique ?? ''} maxLength={80} />
          <Champ libelle={tl('adresse')} name="adresse" defaultValue={clair('adresse')} maxLength={300} />
          <Champ libelle={tl('telephone')} name="telephone" type="tel" dir="ltr" defaultValue={c.telephone ?? ''} maxLength={30} />
          <Champ libelle={tl('rc')} name="rc" dir="ltr" defaultValue={clair('rc')} maxLength={40} />
          <Champ libelle={tl('nif')} name="nif" dir="ltr" defaultValue={clair('nif')} maxLength={40} />
          <Champ libelle={tl('nis')} name="nis" dir="ltr" defaultValue={clair('nis')} maxLength={40} />
          <Champ libelle={tl('ai')} name="ai" dir="ltr" defaultValue={clair('ai')} maxLength={40} aide={t('chiffre')} />
        </Formulaire>
      </Page>
    </>
  );
}
