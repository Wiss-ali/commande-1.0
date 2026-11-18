// Lien entre les sessions et le navigateur : cookies, vérification des droits, redirections.
// Chaque page et chaque action serveur passe par `exigerUtilisateur` ou `exigerAdmin`.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { config } from './config';
import { autorise, type Droit } from './droits';
import { tronquerIp } from './journal';
import { creerSession, supprimerSession, trouverSession, type SessionAdmin, type SessionUtilisateur } from './sessions';
import type { NomModule } from './types-bd';

type Type = 'utilisateur' | 'administrateur';

// En HTTPS, le préfixe __Host- garantit que le cookie n'est envoyé qu'à ce site, en HTTPS, pour tout le site.
const nomCookie = (type: Type) => `${config().https ? '__Host-' : ''}hanout${type === 'administrateur' ? '-admin' : ''}`;

export async function poserSession(type: Type, jeton: string, expire: Date): Promise<void> {
  (await cookies()).set(nomCookie(type), jeton, { httpOnly: true, secure: config().https, sameSite: 'lax', path: '/', expires: expire });
}

export async function fermerSession(type: Type): Promise<void> {
  const boite = await cookies();
  const jeton = boite.get(nomCookie(type))?.value;
  if (jeton) await supprimerSession(jeton);
  boite.delete(nomCookie(type));
}

export const sessionUtilisateur = cache(async (): Promise<SessionUtilisateur | null> => {
  const jeton = (await cookies()).get(nomCookie('utilisateur'))?.value;
  const s = jeton ? await trouverSession(jeton) : null;
  return s?.type === 'utilisateur' ? s : null;
});

export const sessionAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const jeton = (await cookies()).get(nomCookie('administrateur'))?.value;
  const s = jeton ? await trouverSession(jeton) : null;
  return s?.type === 'administrateur' ? s : null;
});

export class Interdit extends Error {
  constructor() {
    super('interdit');
  }
}

/** Exige un utilisateur connecté (code de double authentification saisi), et au besoin un droit et un module actif. */
export async function exigerUtilisateur(droit?: Droit, module?: NomModule): Promise<SessionUtilisateur> {
  const s = await sessionUtilisateur();
  if (!s) redirect('/connexion');
  if (!s.complete) redirect('/connexion/code');
  if (droit && !autorise(s.utilisateur, droit)) throw new Interdit();
  if (module && !s.commercant.modules[module]) throw new Interdit();
  return s;
}

/** Pour les pages : comme `exigerUtilisateur`, mais affiche la page « Accès refusé » au lieu d'une erreur. */
export async function pageUtilisateur(droit?: Droit, module?: NomModule): Promise<SessionUtilisateur> {
  try {
    return await exigerUtilisateur(droit, module);
  } catch (e) {
    if (e instanceof Interdit) redirect('/acces-refuse');
    throw e;
  }
}

/** Comme `exigerUtilisateur`, et refuse en plus toute écriture quand le compte est en lecture seule. */
export async function exigerEcriture(droit?: Droit, module?: NomModule): Promise<SessionUtilisateur> {
  const s = await exigerUtilisateur(droit, module);
  if (s.commercant.etat !== 'actif') throw new Interdit();
  return s;
}

/** Exige l'administrateur de la plateforme, avec sa double authentification. */
export async function exigerAdmin(): Promise<SessionAdmin> {
  const s = await sessionAdmin();
  if (!s) redirect('/admin/connexion');
  if (!s.complete) redirect(s.administrateur.totpActif ? '/admin/connexion/code' : '/admin/connexion/activation');
  return s;
}

/** Adresse tronquée et appareil (« Chrome · Android ») de la requête en cours. */
export async function infoRequete(): Promise<{ ip: string | null; appareil: string }> {
  const h = await headers();
  const ip = tronquerIp(h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip'));
  const ua = h.get('user-agent') ?? '';
  const navigateur = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  const systeme = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { ip, appareil: [navigateur, systeme].filter(Boolean).join(' · ') };
}

export const adresseLien = (jeton: string) => `${config().URL_APP.replace(/\/$/, '')}/invitation/${jeton}`;

/** Ouvre une session et pose son cookie. Un nouveau jeton est créé à chaque étape de la connexion. */
export async function ouvrirSession(
  titulaire: { utilisateurId: string; commercantId: string } | { administrateurId: string },
  complete: boolean,
): Promise<void> {
  const type: Type = 'administrateurId' in titulaire ? 'administrateur' : 'utilisateur';
  await fermerSession(type);
  const { appareil } = await infoRequete();
  const { jeton, expire } = await creerSession(titulaire, { complete, appareil });
  await poserSession(type, jeton, expire);
}

// Appareils où la personne s'est déjà connectée (voir `retenirAppareil`) : cookie séparé de la session,
// qui reste après la déconnexion. Il ne connecte personne : il évite seulement d'être bloqué par les échecs des autres.
const nomCookieAppareil = () => `${config().https ? '__Host-' : ''}hanout-appareil`;

export async function appareilsConnus(): Promise<string[]> {
  const v = (await cookies()).get(nomCookieAppareil())?.value ?? '';
  return v.length > 1000 ? [] : v.split('~').filter((j) => /^[\w-]{10,40}\.[\w-]{20,60}$/.test(j));
}

export async function poserAppareils(jetons: string[]): Promise<void> {
  (await cookies()).set(nomCookieAppareil(), jetons.join('~'), { httpOnly: true, secure: config().https, sameSite: 'lax', path: '/', maxAge: 180 * 24 * 3600 });
}
