import { Download } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, classeBouton, Message } from '@/components/ui';
import { periode, type CodePeriode } from '@/lib/rapports';
import { redirect } from 'next/navigation';
import { pageUtilisateur } from '@/lib/web';

/** Export pour le comptable : une période, une langue pour les PDF, un bouton. Le téléchargement est une simple adresse. */
export default async function Export({ searchParams }: { searchParams: Promise<{ periode?: string; erreur?: string; depuis?: string }> }) {
  // Accessible depuis Rapports ou depuis Factures (propriétaire seulement) : l'un des deux modules suffit.
  const s = await pageUtilisateur('rapports');
  if (!s.commercant.modules.rapports && !s.commercant.modules.factures) redirect('/acces-refuse');
  const t = await getTranslations('export');
  const langue = await getLocale();
  const params = await searchParams;
  const code: CodePeriode = params.periode === 'mois_precedent' ? 'mois_precedent' : 'mois';
  const retour = params.depuis === 'factures' || !s.commercant.modules.rapports ? '/factures' : '/rapports';
  const p = periode(code);
  const champ = 'min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre';
  return (
    <>
      <EnTete titre={t('titre')} retour={retour} />
      <Page>
        <p className="text-sm text-doux">{t('texte')}</p>
        {params.erreur ? <Message ton="erreur">{t(params.erreur === 'trop' ? 'trop' : 'periodeInvalide')}</Message> : null}
        <Carte>
          <form action="/rapports/export/archive" method="get" className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('du')}</span><input type="date" name="du" defaultValue={p.du} required className={champ} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t('au')}</span><input type="date" name="au" defaultValue={p.au} required className={champ} /></label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('langue')}</span>
              <select name="langue" defaultValue={langue} className={champ}>
                <option value="fr" lang="fr">Français</option>
                <option value="ar" lang="ar">العربية</option>
              </select>
            </label>
            <button type="submit" className={classeBouton.principal}><Download aria-hidden className="size-5" />{t('telecharger')}</button>
          </form>
        </Carte>
        <Carte>
          <h2 className="font-semibold">{t('contenuTitre')}</h2>
          <ul className="mt-2 list-disc ps-5 text-sm">
            <li>{t('contenuPdf')}</li>
            <li>{t('contenuDocuments')}</li>
            <li>{t('contenuLignes')}</li>
            <li>{t('contenuStock')}</li>
            <li>{t('contenuClients')}</li>
          </ul>
          <p className="mt-2 text-sm text-doux">{t('excel')}</p>
        </Carte>
      </Page>
    </>
  );
}
