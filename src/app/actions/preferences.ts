'use server';
// Langue et thème : mémorisés dans un cookie, et sur le compte pour la langue.
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { entreesDisponibles, TAILLE_BARRE, type EntreeBarre } from '@/lib/barre';
import type { Etat } from '@/lib/etat';
import { avecCommercant } from '@/lib/bd';
import { config } from '@/lib/config';
import { sessionUtilisateur } from '@/lib/web';

const UN_AN = 365 * 24 * 3600;

export async function changerLangue(f: FormData): Promise<void> {
  const langue = f.get('langue') === 'ar' ? 'ar' : 'fr';
  (await cookies()).set('langue', langue, { path: '/', maxAge: UN_AN, sameSite: 'lax', secure: config().https });
  const s = await sessionUtilisateur();
  if (s?.complete) {
    await avecCommercant(s.commercant.id, (trx) => trx.updateTable('utilisateurs').set({ langue }).where('id', '=', s.utilisateur.id).execute());
  }
  revalidatePath('/', 'layout');
}

export async function changerTheme(f: FormData): Promise<void> {
  const theme = f.get('theme');
  const boite = await cookies();
  if (theme === 'clair' || theme === 'sombre') boite.set('theme', theme, { path: '/', maxAge: UN_AN, sameSite: 'lax', secure: config().https });
  else boite.delete('theme');
  revalidatePath('/', 'layout');
}

/**
 * Barre du bas de la personne connectée : 1 à 4 entrées, sans doublon, parmi celles qu'elle peut ouvrir.
 * « Par défaut » efface le choix (Accueil, Caisse, Scan, Stock, complétés si besoin).
 */
export async function enregistrerBarre(_etat: Etat, f: FormData): Promise<Etat> {
  const s = await sessionUtilisateur();
  if (!s?.complete) return { erreur: 'interdit' };
  let barre: string[] | null = null;
  if (f.get('defaut') !== '1') {
    const disponibles = entreesDisponibles(s.utilisateur.role, s.commercant.modules);
    const choix = f.getAll('entree').map(String).filter(Boolean);
    if (!choix.length || choix.length > TAILLE_BARRE || new Set(choix).size !== choix.length || !choix.every((e) => disponibles.includes(e as EntreeBarre))) return { erreur: 'barre_invalide' };
    barre = choix;
  }
  await avecCommercant(s.commercant.id, (trx) => trx.updateTable('utilisateurs').set({ barre_bas: barre }).where('id', '=', s.utilisateur.id).execute());
  revalidatePath('/', 'layout');
  return { ok: true };
}

