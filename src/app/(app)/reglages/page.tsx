import { Building2, LayoutGrid, ReceiptText, ShieldCheck, Truck, UsersRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { LigneLien } from '@/components/ui';
import { pageUtilisateur } from '@/lib/web';

export default async function Reglages() {
  await pageUtilisateur('reglages');
  const t = await getTranslations('reglages');
  return (
    <>
      <EnTete titre={t('titre')} retour="/plus" />
      <Page>
        <LigneLien href="/reglages/entreprise" titre={t('entreprise')} aide={t('entrepriseAide')} icone={<Building2 aria-hidden className="size-5" />} />
        <LigneLien href="/reglages/facturation" titre={t('facturation')} aide={t('facturationAide')} icone={<ReceiptText aria-hidden className="size-5" />} />
        <LigneLien href="/reglages/livraison" titre={t('livraison')} aide={t('livraisonAide')} icone={<Truck aria-hidden className="size-5" />} />
        <LigneLien href="/reglages/equipe" titre={t('equipe')} aide={t('equipeAide')} icone={<UsersRound aria-hidden className="size-5" />} />
        <LigneLien href="/reglages/modules" titre={t('modules')} aide={t('modulesAide')} icone={<LayoutGrid aria-hidden className="size-5" />} />
        <LigneLien href="/reglages/securite" titre={t('securite')} aide={t('securiteAide')} icone={<ShieldCheck aria-hidden className="size-5" />} />
      </Page>
    </>
  );
}
