// Boutique coupée, ou compte en pause : rien n'est supprimé, l'acheteur est invité à revenir.
import { Moon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function Indisponible() {
  const t = await getTranslations('boutique');
  return (
    <div className="b-hero b-carte flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Moon aria-hidden className="size-10 text-prim" />
      <h1 className="b-titre text-2xl font-bold">{t('indisponibleTitre')}</h1>
      <p className="b-hero-doux text-doux">{t('indisponibleTexte')}</p>
    </div>
  );
}
