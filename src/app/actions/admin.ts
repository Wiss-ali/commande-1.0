'use server';
// Actions réservées à l'administrateur de la plateforme. Chacune revérifie sa session et sa double authentification.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { action, actionSimple, secret, texte } from '@/lib/actions';
import { bd } from '@/lib/bd';
import { activerTotp, connecterAdmin, preparerTotp, verifierCode } from '@/lib/comptes';
import { normaliserTelephone } from '@/lib/formats';
import { inviterCommercant, reinitialiserProprietaire, reinviterCommercant } from '@/lib/invitations';
import { journaliser } from '@/lib/journal';
import { qrEnImage } from '@/lib/qr';
import { adresseTotp } from '@/lib/totp';
import { adresseLien, exigerAdmin, fermerSession, infoRequete, ouvrirSession, sessionAdmin } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export const adminConnexion = action(async (f) => {
  const identifiant = texte(f, 'identifiant', 100).toLowerCase();
  const motDePasse = secret(f, 'motDePasse');
  if (!identifiant || !motDePasse) return { erreur: 'identifiants' };
  const { ip } = await infoRequete();
  const r = await connecterAdmin({ identifiant, motDePasse, ip });
  if (!r.ok) return { erreur: r.raison };
  // La session reste incomplète tant que le code n'est pas saisi : la double authentification est obligatoire.
  await ouvrirSession({ administrateurId: r.id }, false);
  redirect(r.totpActif ? '/admin/connexion/code' : '/admin/connexion/activation');
});

export const adminCode = action(async (f) => {
  const s = await sessionAdmin();
  if (!s) redirect('/admin/connexion');
  if (!(await verifierCode('administrateurs', s.administrateur.id, texte(f, 'code', 20)))) return { erreur: 'code_invalide' };
  await ouvrirSession({ administrateurId: s.administrateur.id }, true);
  redirect('/admin');
});

export const adminPreparer2fa = action(async () => {
  const s = await sessionAdmin();
  if (!s || s.administrateur.totpActif) return { erreur: 'interdit' };
  const cle = await preparerTotp('administrateurs', s.administrateur.id);
  return { qr: qrEnImage(adresseTotp(cle, s.administrateur.identifiant)), cle };
});

export const adminActiver2fa = action(async (f) => {
  const s = await sessionAdmin();
  if (!s || s.administrateur.totpActif) return { erreur: 'interdit' };
  const codes = await activerTotp('administrateurs', s.administrateur.id, texte(f, 'code', 10));
  if (!codes) return { erreur: 'code_invalide' };
  await ouvrirSession({ administrateurId: s.administrateur.id }, true);
  return { ok: true, codes };
});

export const adminDeconnexion = actionSimple(async () => {
  await fermerSession('administrateur');
  redirect('/admin/connexion');
});

export const creerCommercant = action(async (f) => {
  const s = await exigerAdmin();
  const nomCommercant = texte(f, 'nomMagasin', 120);
  const nom = texte(f, 'nom', 80);
  const telephone = normaliserTelephone(texte(f, 'telephone', 30));
  if (!nomCommercant || !nom) return { erreur: 'champ_requis' };
  if (!telephone) return { erreur: 'telephone_invalide' };
  const r = await inviterCommercant({ adminId: s.administrateur.id, nomCommercant, nom, telephone });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/admin');
  return { ok: true, lien: adresseLien(r.jeton) };
});

export const nouveauLien = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'inconnue' };
  const r = await reinviterCommercant({ adminId: s.administrateur.id, commercantId: id });
  return r.ok ? { ok: true, lien: adresseLien(r.jeton) } : { erreur: 'lien_invalide' };
});

export const lienProprietaire = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'inconnue' };
  const r = await reinitialiserProprietaire({ adminId: s.administrateur.id, commercantId: id });
  return r.ok ? { ok: true, lien: adresseLien(r.jeton) } : { erreur: 'inconnue' };
});

export const changerEtat = actionSimple(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  const etat = f.get('etat') === 'suspendu' ? 'suspendu' : 'actif';
  if (!UUID.test(id)) return;
  const { ip } = await infoRequete();
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('commercants').set({ etat }).where('id', '=', id).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: `commercant.${etat}`, objetType: 'commercant', objetId: id, ip });
  });
  revalidatePath('/admin', 'layout');
});

export const changerMaxEmployes = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  const saisie = texte(f, 'max', 6);
  if (!UUID.test(id) || (saisie && !/^\d{1,4}$/.test(saisie))) return { erreur: 'champ_requis' };
  const max = saisie ? Number(saisie) : null;
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('commercants').set({ max_employes: max }).where('id', '=', id).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'commercant.max_employes', details: { max } });
  });
  return { ok: true };
});
