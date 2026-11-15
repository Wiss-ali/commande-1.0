'use client';
// Affiche un lien à transmettre : copie et partage par WhatsApp. Le lien n'est affiché qu'une fois.
import { Copy, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { classeBouton, Message } from './ui';

export function LienPartage({ lien, texte }: { lien: string; texte: string }) {
  const t = useTranslations('commun');
  const [copie, setCopie] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-vert bg-vert-pale p-3">
      {texte ? <p className="text-sm font-medium text-vert">{texte}</p> : null}
      <input readOnly dir="ltr" value={lien} aria-label={t('copier')} onFocus={(e) => e.currentTarget.select()} className="min-h-11 w-full rounded-lg border border-trait bg-surface px-3 text-sm text-encre" />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={classeBouton.secondaire}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(lien);
              setCopie(true);
            } catch {
              setCopie(false);
            }
          }}
        >
          <Copy aria-hidden className="size-4" />
          {copie ? t('copie') : t('copier')}
        </button>
        <a className={classeBouton.secondaire} href={`https://wa.me/?text=${encodeURIComponent(lien)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden className="size-4" />
          {t('whatsapp')}
        </a>
      </div>
      {copie ? <span className="sr-only" role="status">{t('copie')}</span> : null}
      <noscript><Message ton="info">{lien}</Message></noscript>
    </div>
  );
}
