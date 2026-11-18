import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { enregistrerWilayas } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Message } from '@/components/ui';
import { bd } from '@/lib/bd';
import { exigerAdmin } from '@/lib/web';

/** Liste officielle des wilayas, modifiable (noms, wilaya proposée ou non). Le numéro ne change pas. */
export default async function Wilayas() {
  await exigerAdmin();
  const t = await getTranslations('adminWilayas');
  const tc = await getTranslations('commun');
  const wilayas = await bd('plateforme').selectFrom('wilayas').selectAll().orderBy('code').execute();
  const champ = 'min-h-11 w-full min-w-0 rounded-xl border border-trait bg-surface px-2 text-sm text-encre';
  return (
    <>
      <EnTete admin titre={t('titre')} retour="/admin" />
      <Page>
        <Message ton="info">{t('texte')}</Message>
        <Formulaire action={enregistrerWilayas} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>
          <ul className="flex flex-col gap-2">
            {wilayas.map((w) => (
              <li key={w.code} className="flex flex-col gap-1.5 rounded-2xl border border-trait bg-surface shadow-doux p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-3"><span className="chiffres font-semibold">{String(w.code).padStart(2, '0')}</span><Link href={`/admin/wilayas/${w.code}`} className="text-sm font-semibold text-prim underline">{t('communes')}</Link></span>
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`active_${w.code}`} defaultChecked={w.active} className="size-5 accent-prim" />{t('active')}</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name={`fr_${w.code}`} defaultValue={w.nom_fr} aria-label={`${t('nomFr')} ${w.code}`} maxLength={60} required lang="fr" dir="ltr" className={champ} />
                  <input name={`ar_${w.code}`} defaultValue={w.nom_ar} aria-label={`${t('nomAr')} ${w.code}`} maxLength={60} required lang="ar" dir="rtl" className={champ} />
                </div>
              </li>
            ))}
          </ul>
        </Formulaire>
      </Page>
    </>
  );
}
