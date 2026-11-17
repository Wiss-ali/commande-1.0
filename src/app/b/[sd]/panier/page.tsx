import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CommandeBoutique } from '@/components/boutique/CommandeBoutique';
import { avecCommercant } from '@/lib/bd';
import { listerWilayas } from '@/lib/commandes';
import { chargerVitrine } from '@/lib/vitrine-page';
import { Indisponible } from '@/components/boutique/Indisponible';

export default async function Panier({ params }: { params: Promise<{ sd: string }> }) {
  const c = await chargerVitrine((await params).sd);
  if (!c) notFound();
  if (!c.v.disponible && !c.apercu) return <Indisponible />;
  const t = await getTranslations('boutique');
  const wilayas = await avecCommercant(c.v.commercantId, listerWilayas);
  return (
    <>
      <h1 className="text-2xl font-bold">{t('panier')}</h1>
      <CommandeBoutique sd={c.v.sousDomaine} base={c.base} cle={randomUUID()} wilayas={wilayas} apercu={c.apercu} />
    </>
  );
}
