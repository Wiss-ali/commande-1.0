'use server';
// Langue et thème : mémorisés dans un cookie, et sur le compte pour la langue.
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
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
