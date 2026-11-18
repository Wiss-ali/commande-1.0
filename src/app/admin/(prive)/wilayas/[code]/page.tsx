import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { enregistrerCommunes } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Message } from '@/components/ui';
import { bd } from '@/lib/bd';
import { exigerAdmin } from '@/lib/web';

/** Communes d'une wilaya : noms modifiables, commune proposée ou non, ajout d'une commune. */
export default async function CommunesWilaya({ params }: { params: Promise<{ code: string }> }) {
  await exigerAdmin();
  const code = Number((await params).code);
  if (!Number.isInteger(code) || code < 1 || code > 99) notFound();
  const t = await getTranslations('adminWilayas');
  const tc = await getTranslations('commun');
  const wilaya = await bd('plateforme').selectFrom('wilayas').select(['code', 'nom_fr']).where('code', '=', code).executeTakeFirst();
  if (!wilaya) notFound();
  const communes = await bd('plateforme').selectFrom('communes').selectAll().where('wilaya_code', '=', code).orderBy('nom_fr').execute();
  const champ = 'min-h-11 w-full min-w-0 rounded-xl border border-trait bg-surface px-2 text-sm text-encre';
  return (
    <>
      <EnTete admin titre={t('communesDe', { wilaya: `${String(code).padStart(2, '0')} · ${wilaya.nom_fr}` })} retour="/admin/wilayas" />
      <Page>
        <Message ton="info">{t('communesTexte')}</Message>
        <Formulaire action={enregistrerCommunes} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <input type="hidden" name="wilaya" value={code} />
          <ul className="flex flex-col gap-2">
            {communes.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 rounded-2xl border border-trait bg-surface shadow-doux p-2">
                <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name={`active_${c.id}`} defaultChecked={c.active} className="size-5 accent-prim" />{t('active')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input name={`fr_${c.id}`} defaultValue={c.nom_fr} aria-label={`${t('nomFr')} ${c.nom_fr}`} maxLength={80} required lang="fr" dir="ltr" className={champ} />
                  <input name={`ar_${c.id}`} defaultValue={c.nom_ar} aria-label={`${t('nomAr')} ${c.nom_fr}`} maxLength={80} lang="ar" dir="rtl" className={champ} />
                </div>
              </li>
            ))}
            <li className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-trait p-2">
              <p className="text-sm font-semibold">{t('ajouterCommune')}</p>
              <div className="grid grid-cols-2 gap-2">
                <input name="nouvelle_fr" aria-label={`${t('ajouterCommune')} : ${t('nomFr')}`} maxLength={80} lang="fr" dir="ltr" className={champ} />
                <input name="nouvelle_ar" aria-label={`${t('ajouterCommune')} : ${t('nomAr')}`} maxLength={80} lang="ar" dir="rtl" className={champ} />
              </div>
            </li>
          </ul>
        </Formulaire>
      </Page>
    </>
  );
}
