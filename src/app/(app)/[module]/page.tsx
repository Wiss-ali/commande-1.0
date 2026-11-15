import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { DROIT_MODULE, MODULES } from '@/lib/droits';
import type { NomModule } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

// Page d'attente des modules pas encore construits. Chaque module la remplacera par son propre dossier.
export default async function ModuleAVenir({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const estScan = module === 'scan';
  if (!estScan && !MODULES.includes(module as NomModule)) notFound();
  const cle = (estScan ? 'stock' : module) as NomModule;
  await pageUtilisateur(DROIT_MODULE[cle], cle);
  const t = await getTranslations('aVenir');
  const tm = await getTranslations('modules');
  const nom = tm(estScan ? 'scan' : cle);
  return (
    <>
      <EnTete titre={nom} />
      <Page>
        <EtatVide titre={t('titre')} texte={t('texte', { module: nom })}>
          <Link href="/" className={`${classeBouton.secondaire} mt-2`}>{t('retour')}</Link>
        </EtatVide>
      </Page>
    </>
  );
}
