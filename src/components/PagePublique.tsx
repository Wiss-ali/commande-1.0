// Cadre des pages sans connexion : nom du produit, bouton de langue, contenu centré.
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BoutonLangue } from './EnTete';

export async function PagePublique({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  const t = await getTranslations('commun');
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
      <div className="flex min-h-16 items-center justify-between">
        <span className="text-xl font-bold text-vert">{t('nomApp')}</span>
        <BoutonLangue />
      </div>
      <main className="flex flex-1 flex-col gap-5 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{titre}</h1>
          {sousTitre ? <p className="text-doux">{sousTitre}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
