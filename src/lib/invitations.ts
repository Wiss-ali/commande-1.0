// Invitations (commerçant, employé) et liens de réinitialisation du mot de passe.
// Un lien est à usage unique, expire, peut être annulé, et son jeton n'est jamais stocké en clair.
import { sql } from 'kysely';
import { avecCommercant, bd } from './bd.ts';
import { chiffrerOuNul, hacherJeton, nouveauJeton } from './chiffrement.ts';
import { journaliser } from './journal.ts';
import { defautMotDePasse, hacher, type DefautMdp } from './mots-de-passe.ts';
import { reglage } from './reglages-plateforme.ts';
import type { Role, TypeInvitation } from './types-bd.ts';

const expiration = async () => new Date(Date.now() + (await reglage('invitation_jours')) * 86_400_000);

export async function telephonePris(telephone: string): Promise<boolean> {
  const r = await bd('auth').selectFrom('utilisateurs').select('id').where('telephone', '=', telephone).executeTakeFirst();
  return !!r;
}

/** Administration : crée le commerçant et le lien d'invitation de son propriétaire. */
export async function inviterCommercant(p: { adminId: string; nomCommercant: string; nom: string; telephone: string }) {
  if (await telephonePris(p.telephone)) return { ok: false as const, raison: 'telephone_pris' as const };
  const { jeton, hash } = nouveauJeton();
  const expire = await expiration();
  const commercantId = await bd('plateforme').transaction().execute(async (trx) => {
    const c = await trx.insertInto('commercants').values({ nom: p.nomCommercant }).returning('id').executeTakeFirstOrThrow();
    await trx.insertInto('invitations').values({
      jeton_hash: hash, type: 'commercant', commercant_id: c.id, nom: p.nom, telephone: p.telephone,
      role: 'proprietaire', expire_le: expire, cree_par_admin: p.adminId,
    }).execute();
    await journaliser(trx, { commercantId: c.id, acteurType: 'administrateur', acteurId: p.adminId, action: 'commercant.invite', objetType: 'commercant', objetId: c.id });
    return c.id;
  });
  return { ok: true as const, jeton, commercantId, expire };
}

/** Administration : nouveau lien pour un commerçant dont l'invitation a expiré ou a été perdue. */
export async function reinviterCommercant(p: { adminId: string; commercantId: string }) {
  const { jeton, hash } = nouveauJeton();
  const expire = await expiration();
  const r = await bd('plateforme').transaction().execute(async (trx) => {
    const ancienne = await trx.selectFrom('invitations').select(['nom', 'telephone', 'utilisee_le'])
      .where('commercant_id', '=', p.commercantId).where('type', '=', 'commercant').orderBy('cree_le', 'desc').executeTakeFirst();
    if (!ancienne || ancienne.utilisee_le) return false;
    await trx.updateTable('invitations').set({ annulee_le: new Date() })
      .where('commercant_id', '=', p.commercantId).where('type', '=', 'commercant').where('utilisee_le', 'is', null).where('annulee_le', 'is', null).execute();
    await trx.insertInto('invitations').values({
      jeton_hash: hash, type: 'commercant', commercant_id: p.commercantId, nom: ancienne.nom, telephone: ancienne.telephone,
      role: 'proprietaire', expire_le: expire, cree_par_admin: p.adminId,
    }).execute();
    return true;
  });
  return r ? { ok: true as const, jeton, expire } : { ok: false as const };
}

/** Administration : lien de réinitialisation pour le propriétaire d'un commerçant. */
export async function reinitialiserProprietaire(p: { adminId: string; commercantId: string }) {
  const proprietaire = await bd('plateforme').selectFrom('utilisateurs').select('id')
    .where('commercant_id', '=', p.commercantId).where('role', '=', 'proprietaire').where('supprime_le', 'is', null)
    .orderBy('cree_le').executeTakeFirst();
  if (!proprietaire) return { ok: false as const };
  const { jeton, hash } = nouveauJeton();
  const expire = new Date(Date.now() + 86_400_000);
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('invitations').set({ annulee_le: new Date() })
      .where('utilisateur_id', '=', proprietaire.id).where('utilisee_le', 'is', null).where('annulee_le', 'is', null).execute();
    await trx.insertInto('invitations').values({
      jeton_hash: hash, type: 'reinitialisation', commercant_id: p.commercantId, utilisateur_id: proprietaire.id,
      expire_le: expire, cree_par_admin: p.adminId,
    }).execute();
    await journaliser(trx, { commercantId: p.commercantId, acteurType: 'administrateur', acteurId: p.adminId, action: 'mot_de_passe.lien_cree', objetType: 'utilisateur', objetId: proprietaire.id });
  });
  return { ok: true as const, jeton, expire };
}

/** Propriétaire : invite un employé. Vérifie la limite d'employés de la formule. */
export async function inviterEmploye(p: { commercantId: string; parUtilisateur: string; nom: string; telephone: string; role: Exclude<Role, 'proprietaire'> }) {
  if (await telephonePris(p.telephone)) return { ok: false as const, raison: 'telephone_pris' as const };
  const { jeton, hash } = nouveauJeton();
  const expire = await expiration();
  return avecCommercant(p.commercantId, async (trx) => {
    const c = await trx.selectFrom('commercants').select('max_employes').executeTakeFirstOrThrow();
    if (c.max_employes != null) {
      const { n } = await trx.selectFrom('utilisateurs').select((eb) => eb.fn.countAll<string>().as('n'))
        .where('role', '!=', 'proprietaire').where('supprime_le', 'is', null).executeTakeFirstOrThrow();
      const { m } = await trx.selectFrom('invitations').select((eb) => eb.fn.countAll<string>().as('m'))
        .where('type', '=', 'employe').where('utilisee_le', 'is', null).where('annulee_le', 'is', null).where('expire_le', '>', new Date()).executeTakeFirstOrThrow();
      if (Number(n) + Number(m) >= c.max_employes) return { ok: false as const, raison: 'limite_employes' as const };
    }
    // Un seul lien en cours par numéro.
    await trx.updateTable('invitations').set({ annulee_le: new Date() })
      .where('telephone', '=', p.telephone).where('utilisee_le', 'is', null).where('annulee_le', 'is', null).execute();
    const inv = await trx.insertInto('invitations').values({
      jeton_hash: hash, type: 'employe', commercant_id: p.commercantId, nom: p.nom, telephone: p.telephone,
      role: p.role, expire_le: expire, cree_par_utilisateur: p.parUtilisateur,
    }).returning('id').executeTakeFirstOrThrow();
    await journaliser(trx, { commercantId: p.commercantId, acteurType: 'utilisateur', acteurId: p.parUtilisateur, action: 'employe.invite', objetType: 'invitation', objetId: inv.id, details: { role: p.role } });
    return { ok: true as const, jeton, expire };
  });
}

/** Propriétaire : lien de réinitialisation pour un de ses employés (jamais pour un propriétaire). */
export async function reinitialiserEmploye(p: { commercantId: string; parUtilisateur: string; utilisateurId: string }) {
  const { jeton, hash } = nouveauJeton();
  const expire = new Date(Date.now() + 86_400_000);
  return avecCommercant(p.commercantId, async (trx) => {
    const cible = await trx.selectFrom('utilisateurs').select(['id', 'role']).where('id', '=', p.utilisateurId).where('supprime_le', 'is', null).executeTakeFirst();
    if (!cible || cible.role === 'proprietaire') return { ok: false as const };
    await trx.updateTable('invitations').set({ annulee_le: new Date() })
      .where('utilisateur_id', '=', cible.id).where('utilisee_le', 'is', null).where('annulee_le', 'is', null).execute();
    await trx.insertInto('invitations').values({
      jeton_hash: hash, type: 'reinitialisation', commercant_id: p.commercantId, utilisateur_id: cible.id,
      expire_le: expire, cree_par_utilisateur: p.parUtilisateur,
    }).execute();
    await journaliser(trx, { commercantId: p.commercantId, acteurType: 'utilisateur', acteurId: p.parUtilisateur, action: 'mot_de_passe.lien_cree', objetType: 'utilisateur', objetId: cible.id });
    return { ok: true as const, jeton, expire };
  });
}

export interface InvitationLue {
  type: TypeInvitation;
  nomCommercant: string;
  nom: string | null;
  telephone: string | null;
  role: Role | null;
}
export type EtatInvitation = { valide: true; invitation: InvitationLue } | { valide: false };

/** Lit une invitation à partir du jeton du lien. Ne dit jamais pourquoi un lien est refusé. */
export async function lireInvitation(jeton: string): Promise<EtatInvitation> {
  if (!jeton || jeton.length > 100) return { valide: false };
  const i = await bd('auth')
    .selectFrom('invitations as i')
    .innerJoin('commercants as c', 'c.id', 'i.commercant_id')
    .select(['i.type', 'i.nom', 'i.telephone', 'i.role', 'c.nom as nom_commercant'])
    .where('i.jeton_hash', '=', hacherJeton(jeton))
    .where('i.utilisee_le', 'is', null).where('i.annulee_le', 'is', null).where('i.expire_le', '>', new Date())
    .where('c.etat', 'in', ['actif', 'lecture_seule'])
    .executeTakeFirst();
  if (!i) return { valide: false };
  return { valide: true, invitation: { type: i.type, nomCommercant: i.nom_commercant, nom: i.nom, telephone: i.telephone, role: i.role } };
}

export interface Acceptation {
  motDePasse: string;
  nom?: string;
  commercant?: { nom: string; formeJuridique?: string; adresse?: string; rc?: string; nif?: string; nis?: string; ai?: string };
}
export type ResultatAcceptation =
  | { ok: true; utilisateurId: string; commercantId: string }
  | { ok: false; raison: 'lien_invalide' | 'telephone_pris' | DefautMdp };

/** Accepte une invitation ou un lien de réinitialisation. Tout se fait dans une seule transaction. */
export async function accepterInvitation(jeton: string, a: Acceptation): Promise<ResultatAcceptation> {
  const hash = hacherJeton(jeton);
  const r = await bd('auth').transaction().execute(async (trx): Promise<ResultatAcceptation> => {
    // Verrou sur la ligne : deux envois simultanés ne peuvent pas utiliser le lien deux fois.
    const q = await sql<{ id: string; type: TypeInvitation; commercant_id: string; utilisateur_id: string | null; nom: string | null; telephone: string | null; role: Role | null }>`
      SELECT i.id, i.type, i.commercant_id, i.utilisateur_id, i.nom, i.telephone, i.role
      FROM invitations i JOIN commercants c ON c.id = i.commercant_id
      WHERE i.jeton_hash = ${hash} AND i.utilisee_le IS NULL AND i.annulee_le IS NULL AND i.expire_le > now()
        AND c.etat IN ('actif', 'lecture_seule')
      FOR UPDATE OF i`.execute(trx);
    const inv = q.rows[0];
    if (!inv) return { ok: false, raison: 'lien_invalide' };

    const nom = (a.nom ?? inv.nom ?? '').trim();
    const roleFinal = inv.type === 'reinitialisation'
      ? (await trx.selectFrom('utilisateurs').select('role').where('id', '=', inv.utilisateur_id!).executeTakeFirst())?.role
      : inv.role;
    if (!roleFinal) return { ok: false, raison: 'lien_invalide' };
    const min = await reglage(roleFinal === 'proprietaire' ? 'mdp_min_proprietaire' : 'mdp_min_employe');
    const defaut = defautMotDePasse(a.motDePasse, min, [nom, inv.telephone ?? '']);
    if (defaut) return { ok: false, raison: defaut };
    const hache = await hacher(a.motDePasse);

    let utilisateurId: string;
    if (inv.type === 'reinitialisation') {
      utilisateurId = inv.utilisateur_id!;
      await trx.updateTable('utilisateurs').set({ mot_de_passe: hache, echecs: 0, bloque_jusqua: null }).where('id', '=', utilisateurId).execute();
      // Tous les appareils sont déconnectés.
      await trx.deleteFrom('sessions').where('utilisateur_id', '=', utilisateurId).execute();
    } else {
      if (!nom || !inv.telephone) return { ok: false, raison: 'lien_invalide' };
      const pris = await trx.selectFrom('utilisateurs').select('id').where('telephone', '=', inv.telephone).executeTakeFirst();
      if (pris) return { ok: false, raison: 'telephone_pris' };
      const u = await trx.insertInto('utilisateurs')
        .values({ commercant_id: inv.commercant_id, nom, telephone: inv.telephone, mot_de_passe: hache, role: inv.role! })
        .returning('id').executeTakeFirstOrThrow();
      utilisateurId = u.id;
    }
    await trx.updateTable('invitations').set({ utilisee_le: new Date() }).where('id', '=', inv.id).execute();
    await journaliser(trx, {
      commercantId: inv.commercant_id, acteurType: 'utilisateur', acteurId: utilisateurId,
      action: inv.type === 'reinitialisation' ? 'mot_de_passe.reinitialise' : 'invitation.acceptee', details: { type: inv.type },
    });
    return { ok: true, utilisateurId, commercantId: inv.commercant_id };
  });

  // Informations du commerçant, saisies par le propriétaire à l'acceptation : écrites sous son identité.
  if (r.ok && a.commercant) {
    const c = a.commercant;
    const ctx = (col: string) => `commercants.${col}:${r.commercantId}`;
    await avecCommercant(r.commercantId, (trx) =>
      trx.updateTable('commercants').set({
        nom: c.nom,
        forme_juridique: c.formeJuridique || null,
        adresse_chiffre: chiffrerOuNul(c.adresse, ctx('adresse')),
        rc_chiffre: chiffrerOuNul(c.rc, ctx('rc')),
        nif_chiffre: chiffrerOuNul(c.nif, ctx('nif')),
        nis_chiffre: chiffrerOuNul(c.nis, ctx('nis')),
        ai_chiffre: chiffrerOuNul(c.ai, ctx('ai')),
      }).execute(),
    );
  }
  return r;
}
