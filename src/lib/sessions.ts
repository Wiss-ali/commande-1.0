// Sessions côté serveur. Le navigateur ne reçoit qu'un jeton aléatoire ; la base n'en garde que l'empreinte.
import { sql } from 'kysely';
import { etatEffectif, modulesEffectifs, situation } from './abonnements.ts';
import { bd } from './bd.ts';
import { hacherJeton, nouveauJeton } from './chiffrement.ts';
import { reglage } from './reglages-plateforme.ts';
import type { EtatCommercant, Langue, Modules, Role } from './types-bd.ts';

export interface SessionUtilisateur {
  type: 'utilisateur';
  id: string;
  complete: boolean; // faux tant que le code de double authentification n'est pas saisi
  utilisateur: { id: string; nom: string; role: Role; langue: Langue; totpActif: boolean; gereProduits: boolean };
  commercant: { id: string; nom: string; etat: EtatCommercant; modules: Modules };
}
export interface SessionAdmin {
  type: 'administrateur';
  id: string;
  complete: boolean;
  administrateur: { id: string; identifiant: string; totpActif: boolean };
}
export type Session = SessionUtilisateur | SessionAdmin;

type Titulaire = { utilisateurId: string; commercantId: string } | { administrateurId: string };

export async function creerSession(t: Titulaire, opts: { complete: boolean; appareil: string }): Promise<{ jeton: string; expire: Date }> {
  const { jeton, hash } = nouveauJeton();
  const duree =
    'administrateurId' in t
      ? (await reglage('session_heures_administrateur')) * 3_600_000
      : (await reglage('session_jours_utilisateur')) * 86_400_000;
  // Une session incomplète (en attente du code) ne vit que dix minutes.
  const expire = new Date(Date.now() + (opts.complete ? duree : 600_000));
  await bd('auth')
    .insertInto('sessions')
    .values({
      jeton_hash: hash,
      utilisateur_id: 'utilisateurId' in t ? t.utilisateurId : null,
      commercant_id: 'utilisateurId' in t ? t.commercantId : null,
      administrateur_id: 'administrateurId' in t ? t.administrateurId : null,
      mfa_ok: opts.complete,
      appareil: opts.appareil.slice(0, 60),
      expire_le: expire,
    })
    .execute();
  return { jeton, expire };
}

export async function trouverSession(jeton: string): Promise<Session | null> {
  if (!jeton || jeton.length > 100) return null;
  const s = await bd('auth')
    .selectFrom('sessions as s')
    .leftJoin('utilisateurs as u', 'u.id', 's.utilisateur_id')
    .leftJoin('commercants as c', 'c.id', 's.commercant_id')
    .leftJoin('administrateurs as a', 'a.id', 's.administrateur_id')
    .select([
      's.id', 's.mfa_ok', 's.vue_le', 's.utilisateur_id', 's.administrateur_id',
      'u.nom as u_nom', 'u.role', 'u.langue', 'u.totp_actif as u_totp', 'u.gere_produits', 'u.desactive', 'u.supprime_le',
      'c.id as c_id', 'c.nom as c_nom', 'c.etat', 'c.modules',
      'a.identifiant', 'a.totp_actif as a_totp',
    ])
    .where('s.jeton_hash', '=', hacherJeton(jeton))
    .where('s.expire_le', '>', new Date())
    .executeTakeFirst();
  if (!s) return null;

  // Inactivité trop longue : la session est fermée (1 heure pour l'administrateur, 7 jours pour un commerçant, réglables).
  const inactivite = s.administrateur_id ? (await reglage('inactivite_minutes_administrateur')) * 60_000 : (await reglage('inactivite_heures_utilisateur')) * 3_600_000;
  if (Date.now() - s.vue_le.getTime() > inactivite) {
    await bd('auth').deleteFrom('sessions').where('id', '=', s.id).execute();
    return null;
  }

  // Dernière activité : mise à jour au plus toutes les cinq minutes.
  if (Date.now() - s.vue_le.getTime() > 300_000) {
    await bd('auth').updateTable('sessions').set({ vue_le: new Date() }).where('id', '=', s.id).execute();
  }

  if (s.administrateur_id && s.identifiant != null) {
    return { type: 'administrateur', id: s.id, complete: s.mfa_ok, administrateur: { id: s.administrateur_id, identifiant: s.identifiant, totpActif: !!s.a_totp } };
  }
  if (s.utilisateur_id && s.c_id && s.role && s.u_nom != null && s.langue && s.etat && s.modules) {
    // L'abonnement décide de l'état réel (lecture seule après le délai) et des modules ouverts, à chaque requête.
    const ab = await situation(bd('auth'), s.c_id);
    const etat = etatEffectif(s.etat, ab.etat);
    // Compte bloqué, supprimé, ou commerçant suspendu ou archivé : la session ne vaut plus rien.
    if (s.desactive || s.supprime_le || etat === 'suspendu' || etat === 'archive') return null;
    return {
      type: 'utilisateur',
      id: s.id,
      complete: s.mfa_ok,
      utilisateur: { id: s.utilisateur_id, nom: s.u_nom, role: s.role, langue: s.langue, totpActif: !!s.u_totp, gereProduits: !!s.gere_produits },
      commercant: { id: s.c_id, nom: s.c_nom ?? '', etat, modules: modulesEffectifs(s.modules, ab.autorises) },
    };
  }
  return null;
}

export async function supprimerSession(jeton: string): Promise<void> {
  await bd('auth').deleteFrom('sessions').where('jeton_hash', '=', hacherJeton(jeton)).execute();
}

/** Déconnecte tous les appareils d'un utilisateur (changement de mot de passe, blocage…). */
export async function supprimerSessionsUtilisateur(utilisateurId: string, saufSessionId?: string): Promise<void> {
  let q = bd('auth').deleteFrom('sessions').where('utilisateur_id', '=', utilisateurId);
  if (saufSessionId) q = q.where('id', '!=', saufSessionId);
  await q.execute();
}

export async function purgerSessions(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expire_le < now()`.execute(bd('auth'));
}
