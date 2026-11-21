// Fiche client saisie à la main : nom, téléphone, adresse et numéros légaux (client professionnel), note.
import { getTranslations } from 'next-intl/server';
import { enregistrerClient } from '@/app/actions/clients';
import type { DetailsClient } from '@/lib/clients';
import { Formulaire } from './Formulaire';
import { Repli } from './Repli';
import { Carte, Champ } from './ui';

export async function FormulaireClient({ id, nom = '', telephone = '', details = {}, note = '' }: { id?: string; nom?: string; telephone?: string; details?: DetailsClient; note?: string }) {
  const t = await getTranslations('clients');
  const tl = await getTranslations('legal');
  const pro = Boolean(details.adresse || details.nif || details.rc || details.nis || details.ai);
  return (
    <Carte>
      <Formulaire action={enregistrerClient} bouton={t(id ? 'enregistrer' : 'creer')} garder>
        {id ? <input type="hidden" name="id" value={id} /> : null}
        <Champ libelle={t('nom')} name="nom" defaultValue={nom} maxLength={120} autoComplete="off" required />
        <Champ libelle={t('telephone')} name="telephone" defaultValue={telephone} type="tel" inputMode="tel" dir="ltr" maxLength={30} autoComplete="off" placeholder="0550 12 34 56" aide={t('telephoneAide')} />
        <Repli titre={t('pro')} ouvert={pro}>
          <Champ libelle={t('adresse')} name="adresse" defaultValue={details.adresse} maxLength={300} autoComplete="off" />
          <Champ libelle={tl('nif')} name="nif" defaultValue={details.nif} maxLength={40} dir="ltr" autoComplete="off" />
          <Champ libelle={tl('rc')} name="rc" defaultValue={details.rc} maxLength={40} dir="ltr" autoComplete="off" />
          <Champ libelle={tl('nis')} name="nis" defaultValue={details.nis} maxLength={40} dir="ltr" autoComplete="off" />
          <Champ libelle={tl('ai')} name="ai" defaultValue={details.ai} maxLength={40} dir="ltr" autoComplete="off" />
        </Repli>
        <Champ libelle={t('note')} name="note" defaultValue={note} maxLength={500} autoComplete="off" aide={t('noteAide')} />
      </Formulaire>
    </Carte>
  );
}
