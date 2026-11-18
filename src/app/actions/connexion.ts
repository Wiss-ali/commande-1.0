'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { action, actionSimple, secret, texte } from '@/lib/actions';
import { connecterUtilisateur, retenirAppareil, verifierCode } from '@/lib/comptes';
import { config } from '@/lib/config';
import { normaliserTelephone } from '@/lib/formats';
import { accepterInvitation, lireInvitation } from '@/lib/invitations';
import { appareilsConnus, fermerSession, infoRequete, ouvrirSession, poserAppareils, sessionUtilisateur } from '@/lib/web';
import { bd } from '@/lib/bd';

async function reprendreLangue(utilisateurId: string) {
  // À la connexion, l'application reprend la langue mémorisée sur le compte.
  const u = await bd('auth').selectFrom('utilisateurs').select('langue').where('id', '=', utilisateurId).executeTakeFirst();
  if (u) (await cookies()).set('langue', u.langue, { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax', secure: config().https });
}

/** Connexion complète : ce téléphone devient un appareil reconnu pour cette personne. */
async function connexionComplete(utilisateurId: string) {
  await poserAppareils(await retenirAppareil(utilisateurId, await appareilsConnus()));
  await reprendreLangue(utilisateurId);
}

export const seConnecter = action(async (f) => {
  const telephone = normaliserTelephone(texte(f, 'telephone', 30));
  const motDePasse = secret(f, 'motDePasse');
  if (!telephone || !motDePasse) return { erreur: 'identifiants' };
  const { ip } = await infoRequete();
  const r = await connecterUtilisateur({ telephone, motDePasse, ip, appareils: await appareilsConnus() });
  if (!r.ok) return { erreur: r.raison };
  await ouvrirSession({ utilisateurId: r.id, commercantId: r.commercantId! }, !r.totpActif);
  if (r.totpActif) redirect('/connexion/code');
  await connexionComplete(r.id);
  redirect('/');
});

export const verifierCodeConnexion = action(async (f) => {
  const s = await sessionUtilisateur();
  if (!s) redirect('/connexion');
  if (s.complete) redirect('/');
  if (!(await verifierCode('utilisateurs', s.utilisateur.id, texte(f, 'code', 20)))) return { erreur: 'code_invalide' };
  await ouvrirSession({ utilisateurId: s.utilisateur.id, commercantId: s.commercant.id }, true);
  await connexionComplete(s.utilisateur.id);
  redirect('/');
});

export const seDeconnecter = actionSimple(async () => {
  await fermerSession('utilisateur');
  redirect('/connexion');
});

export const accepter = action(async (f) => {
  const jeton = texte(f, 'jeton', 100);
  const lue = await lireInvitation(jeton);
  if (!lue.valide) return { erreur: 'lien_invalide' };
  const type = lue.invitation.type;
  const nom = texte(f, 'nom', 80);
  if (type !== 'reinitialisation' && !nom) return { erreur: 'champ_requis' };
  const nomMagasin = texte(f, 'nomMagasin', 120);
  if (type === 'commercant' && !nomMagasin) return { erreur: 'champ_requis' };

  const r = await accepterInvitation(jeton, {
    motDePasse: secret(f, 'motDePasse'),
    nom: type === 'reinitialisation' ? undefined : nom,
    commercant: type === 'commercant'
      ? { nom: nomMagasin, formeJuridique: texte(f, 'formeJuridique', 80), adresse: texte(f, 'adresse', 300), rc: texte(f, 'rc', 40), nif: texte(f, 'nif', 40), nis: texte(f, 'nis', 40), ai: texte(f, 'ai', 40) }
      : undefined,
  });
  if (!r.ok) return { erreur: r.raison };
  // Après une réinitialisation, on repasse par la connexion (et par le code si la double authentification est active).
  if (type === 'reinitialisation') {
    await fermerSession('utilisateur');
    redirect('/connexion');
  }
  await ouvrirSession({ utilisateurId: r.utilisateurId, commercantId: r.commercantId }, true);
  redirect('/');
});
