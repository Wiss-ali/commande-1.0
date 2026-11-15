'use client';
// État d'erreur commun : dit quoi faire, sans détail technique.
import { useTranslations } from 'next-intl';
import { classeBouton } from '@/components/ui';

export default function Erreur({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('pageErreur');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t('titre')}</h1>
      <p className="text-doux">{t('texte')}</p>
      <button type="button" onClick={reset} className={classeBouton.principal}>{t('reessayer')}</button>
    </main>
  );
}
