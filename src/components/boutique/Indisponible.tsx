// Boutique coupée, ou compte en pause : rien n'est supprimé, l'acheteur est invité à revenir.
import { getTranslations } from 'next-intl/server';

export async function Indisponible() {
  const t = await getTranslations('boutique');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <h1 className="text-lg font-semibold">{t('indisponibleTitre')}</h1>
      <p className="text-doux">{t('indisponibleTexte')}</p>
    </div>
  );
}
