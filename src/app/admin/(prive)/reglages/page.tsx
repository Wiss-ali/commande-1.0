import { getTranslations } from 'next-intl/server';
import { enregistrerTimbre } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, Message } from '@/components/ui';
import { lireBaremeTimbre } from '@/lib/fiscal';
import { montantPourSaisie } from '@/lib/formats';
import { reglageBrut } from '@/lib/reglages-plateforme';
import { exigerAdmin } from '@/lib/web';

export default async function ReglagesPlateforme() {
  await exigerAdmin();
  const t = await getTranslations('adminReglages');
  const tc = await getTranslations('commun');
  const b = lireBaremeTimbre(await reglageBrut('timbre'));
  const valeur = (c: number | null | undefined) => (c ? montantPourSaisie(c) : '');
  return (
    <>
      <EnTete admin titre={t('titre')} retour="/admin" />
      <Page>
        <Message ton="info">{t('avertissement')}</Message>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('timbreTitre')}</h2>
          <p className="text-sm text-doux">{t('timbreTexte')}</p>
          <Formulaire action={enregistrerTimbre} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
            <Champ libelle={t('exonere')} name="exonere" defaultValue={valeur(b.exonereJusqua)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" />
            {[1, 2, 3, 4].map((i) => (
              <fieldset key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-trait p-3">
                <legend className="px-1 text-sm font-medium">{t('tranche', { n: i })}</legend>
                <Champ libelle={t('jusqua')} name={`jusqua${i}`} defaultValue={valeur(b.tranches[i - 1]?.jusqua)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" />
                <Champ libelle={t('parCent')} name={`parCent${i}`} defaultValue={b.tranches[i - 1] ? montantPourSaisie(b.tranches[i - 1]!.parCent) : ''} inputMode="decimal" dir="ltr" maxLength={8} autoComplete="off" />
              </fieldset>
            ))}
            <p className="text-sm text-doux">{t('trancheAide')}</p>
            <Champ libelle={t('minimum')} name="minimum" defaultValue={valeur(b.minimum)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" />
            <Champ libelle={t('plafond')} name="plafond" defaultValue={valeur(b.plafond)} inputMode="decimal" dir="ltr" maxLength={14} autoComplete="off" aide={t('plafondAide')} />
          </Formulaire>
        </Carte>
      </Page>
    </>
  );
}
