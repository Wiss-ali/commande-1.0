// Enveloppes communes des actions serveur : aucune erreur technique n'est montrée à l'utilisateur,
// et rien de personnel n'est écrit dans les journaux techniques.
import { unstable_rethrow } from 'next/navigation';
import type { Etat } from './etat';
import { Interdit } from './web';

function enErreur(e: unknown): Etat {
  unstable_rethrow(e); // laisse passer les redirections
  if (e instanceof Interdit) return { erreur: 'interdit' };
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  console.error(`[action] ${e instanceof Error ? e.name : 'Erreur'} ${code}`.trim());
  return { erreur: 'inconnue' };
}

/** Action d'un formulaire avec message de retour (utilisée avec le composant Formulaire). */
export function action(fn: (f: FormData) => Promise<Etat>) {
  return async (_precedent: Etat, f: FormData): Promise<Etat> => {
    try {
      return await fn(f);
    } catch (e) {
      return enErreur(e);
    }
  };
}

/** Action d'un simple bouton, sans message de retour. */
export function actionSimple(fn: (f: FormData) => Promise<void>) {
  return async (f: FormData): Promise<void> => {
    try {
      await fn(f);
    } catch (e) {
      enErreur(e);
    }
  };
}

export const texte = (f: FormData, nom: string, max = 200): string => {
  const v = f.get(nom);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
};
/** Mot de passe : jamais raccourci ni nettoyé. */
export const secret = (f: FormData, nom: string): string => {
  const v = f.get(nom);
  return typeof v === 'string' ? v : '';
};
