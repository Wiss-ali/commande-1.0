import { getTranslations } from 'next-intl/server';
import { enregistrerFacturation } from '@/app/actions/ventes';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, Message } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { lireBaremeTimbre, lireReglagesDocuments } from '@/lib/fiscal';
import { reglageBrut } from '@/lib/reglages-plateforme';
import { pageUtilisateur } from '@/lib/web';

export default async function Facturation() {
  const s = await pageUtilisateur('reglages');
  const t = await getTranslations('facturation');
  const tc = await getTranslations('commun');
  const r = lireReglagesDocuments((await avecCommercant(s.commercant.id, (trx) => trx.selectFrom('commercants').select('reglages_documents').executeTakeFirstOrThrow())).reglages_documents);
  const baremeVide = lireBaremeTimbre(await reglageBrut('timbre')).tranches.length === 0;
  const coche = (nom: string, libelle: string, defaut: boolean) => (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-trait px-3 py-2.5">
      <input type="checkbox" name={nom} defaultChecked={defaut} className="mt-0.5 size-5 accent-prim" />
      <span className="text-sm">{libelle}</span>
    </label>
  );
  return (
    <>
      <EnTete titre={t('titre')} retour="/reglages" />
      <Page>
        <Message ton="info">{t('avertissement')}</Message>
        <Formulaire action={enregistrerFacturation} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('tvaTitre')}</h2>
            {coche('assujettiTva', t('assujetti'), r.assujettiTva)}
            <Champ libelle={t('tauxDefaut')} name="tauxDefaut" defaultValue={r.tauxDefaut ? String(r.tauxDefaut / 100).replace('.', ',') : ''} inputMode="decimal" dir="ltr" maxLength={6} autoComplete="off" aide={t('tauxDefautAide')} />
            <Champ libelle={t('mentionSansTva')} name="mentionSansTva" defaultValue={r.mentionSansTva} maxLength={200} autoComplete="off" aide={t('mentionSansTvaAide')} />
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('timbreTitre')}</h2>
            <p className="text-sm text-doux">{t(baremeVide ? 'timbreVide' : 'timbreTexte')}</p>
            {coche('timbreFactures', t('timbreFactures'), r.timbreFactures)}
            {coche('timbreTickets', t('timbreTickets'), r.timbreTickets)}
          </Carte>
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('documentsTitre')}</h2>
            <Champ libelle={t('validite')} name="validiteDevisJours" defaultValue={r.validiteDevisJours} inputMode="numeric" dir="ltr" maxLength={3} autoComplete="off" />
            <Champ libelle={t('piedDePage')} name="piedDePage" defaultValue={r.piedDePage} maxLength={300} autoComplete="off" aide={t('piedDePageAide')} />
          </Carte>
        </Formulaire>
      </Page>
    </>
  );
}
