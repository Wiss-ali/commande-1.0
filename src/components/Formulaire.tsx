'use client';
// Formulaire relié à une action serveur : message d'erreur traduit, bouton en attente, résultat (lien, codes).
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, startTransition, type ReactNode } from 'react';
import type { Etat } from '@/lib/etat';
import { LienPartage } from './LienPartage';
import { classeBouton, Message } from './ui';

interface Props {
  action: (etat: Etat, f: FormData) => Promise<Etat>;
  bouton: string;
  children?: ReactNode;
  /** Message affiché quand l'action réussit. */
  succes?: string;
  /** Texte affiché au-dessus du lien renvoyé par l'action. */
  texteLien?: string;
  style?: keyof typeof classeBouton;
  /** Garde les valeurs saisies après une réussite (par défaut le formulaire est vidé). */
  garder?: boolean;
}

export function Formulaire({ action, bouton, children, succes, texteLien, style = 'principal', garder }: Props) {
  const t = useTranslations();
  const [etat, envoyer, enCours] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.ok && !garder) ref.current?.reset();
  }, [etat, garder]);

  return (
    <form
      ref={ref}
      action={envoyer}
      // Envoi par script : les valeurs saisies restent en place si le serveur renvoie une erreur.
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
      className="flex flex-col gap-4"
    >
      {children}
      {etat.erreur ? <Message ton="erreur">{t(`erreurs.${etat.erreur}`)}</Message> : null}
      {etat.ok && succes ? <Message ton="succes">{succes}</Message> : null}
      <button type="submit" disabled={enCours} className={classeBouton[style]}>
        {enCours ? t('commun.patienter') : bouton}
      </button>
      {etat.lien ? <LienPartage lien={etat.lien} texte={texteLien ?? ''} /> : null}
    </form>
  );
}
