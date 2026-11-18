import { getLocale, getTranslations } from 'next-intl/server';
import { sauverFormule } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, Pastille, TitreSection } from '@/components/ui';
import { listerFormules } from '@/lib/abonnements';
import { bd } from '@/lib/bd';
import { MODULES } from '@/lib/droits';
import { formaterMontant, montantPourSaisie } from '@/lib/formats';
import type { Langue, NomModule } from '@/lib/types-bd';
import { exigerAdmin } from '@/lib/web';

/** Formules d'abonnement : prix, durée et modules compris. Le module Stock est toujours compris. */
export default async function Formules() {
  await exigerAdmin();
  const t = await getTranslations('adminFormules');
  const tm = await getTranslations('modules');
  const tc = await getTranslations('commun');
  const langue = (await getLocale()) as Langue;
  const formules = await listerFormules(bd('plateforme'));
  const champs = (f?: { id: string; nom: string; prix: string; duree_jours: number; modules: NomModule[]; active: boolean }) => (
    <>
      {f ? <input type="hidden" name="id" value={f.id} /> : null}
      <Champ libelle={t('nom')} name="nom" defaultValue={f?.nom} maxLength={60} required autoComplete="off" />
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle={t('prix')} name="prix" defaultValue={f ? montantPourSaisie(f.prix) : ''} inputMode="decimal" dir="ltr" maxLength={12} required autoComplete="off" />
        <Champ libelle={t('duree')} name="duree" defaultValue={f ? String(f.duree_jours) : '30'} inputMode="numeric" dir="ltr" maxLength={4} required autoComplete="off" aide={t('dureeAide')} />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{t('modules')}</legend>
        {MODULES.map((m) => (
          <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" name={`module_${m}`} defaultChecked={m === 'stock' || !!f?.modules.includes(m)} disabled={m === 'stock'} className="size-5 accent-prim" />
            <span className="text-sm">{tm(m)}{m === 'stock' ? ` · ${t('toujours')}` : ''}</span>
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" name="active" defaultChecked={f ? f.active : true} className="size-5 accent-prim" /><span className="text-sm">{t('active')}</span></label>
    </>
  );
  return (
    <>
      <EnTete admin titre={t('titre')} retour="/admin" />
      <Page>
        <p className="text-sm text-doux">{t('texte')}</p>
        {formules.map((f) => (
          <details key={f.id} className="rounded-2xl border border-trait bg-surface shadow-doux">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0"><span className="block font-semibold">{f.nom}</span><span className="block text-sm text-doux">{formaterMontant(BigInt(f.prix), langue)} · {t('jours', { n: f.duree_jours })} · {f.modules.map((m) => tm(m)).join(', ')}</span></span>
              <Pastille ton={f.active ? 'vert' : 'neutre'}>{t(f.active ? 'activeCourt' : 'inactive')}</Pastille>
            </summary>
            <div className="p-4 pt-0"><Formulaire action={sauverFormule} bouton={tc('enregistrer')} succes={tc('enregistre')} garder>{champs(f)}</Formulaire></div>
          </details>
        ))}
        {!formules.length ? <p className="text-sm text-doux">{t('aucune')}</p> : null}
        <TitreSection>{t('nouvelle')}</TitreSection>
        <Carte><Formulaire action={sauverFormule} bouton={t('creer')} succes={tc('enregistre')}>{champs()}</Formulaire></Carte>
      </Page>
    </>
  );
}
