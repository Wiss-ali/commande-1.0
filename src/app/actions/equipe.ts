'use server';
import { revalidatePath } from 'next/cache';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant, type Trx } from '@/lib/bd';
import { normaliserTelephone } from '@/lib/formats';
import { inviterEmploye, reinitialiserEmploye } from '@/lib/invitations';
import { journaliser } from '@/lib/journal';
import { supprimerSessionsUtilisateur } from '@/lib/sessions';
import { adresseLien, exigerEcriture, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export const inviter = action(async (f) => {
  const s = await exigerEcriture('equipe');
  const nom = texte(f, 'nom', 80);
  const telephone = normaliserTelephone(texte(f, 'telephone', 30));
  const role = f.get('role') === 'preparateur' ? 'preparateur' : 'vendeur';
  if (!nom) return { erreur: 'champ_requis' };
  if (!telephone) return { erreur: 'telephone_invalide' };
  const r = await inviterEmploye({ commercantId: s.commercant.id, parUtilisateur: s.utilisateur.id, nom, telephone, role, gereProduits: f.get('gereProduits') === 'on' });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/reglages/equipe');
  return { ok: true, lien: adresseLien(r.jeton) };
});

export const lienMotDePasse = action(async (f) => {
  const s = await exigerEcriture('equipe');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'inconnue' };
  const r = await reinitialiserEmploye({ commercantId: s.commercant.id, parUtilisateur: s.utilisateur.id, utilisateurId: id });
  return r.ok ? { ok: true, lien: adresseLien(r.jeton) } : { erreur: 'interdit' };
});

/** Applique un changement à un employé du commerçant. Jamais à soi-même ni à un propriétaire. */
async function surEmploye(f: FormData, nomAction: string, changer: (trx: Trx, id: string) => Promise<void>): Promise<string | null> {
  const s = await exigerEcriture('equipe');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id) || id === s.utilisateur.id) return null;
  const { ip } = await infoRequete();
  const fait = await avecCommercant(s.commercant.id, async (trx) => {
    const cible = await trx.selectFrom('utilisateurs').select('role').where('id', '=', id).where('supprime_le', 'is', null).executeTakeFirst();
    if (!cible || cible.role === 'proprietaire') return false;
    await changer(trx, id);
    await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: nomAction, objetType: 'utilisateur', objetId: id, ip });
    return true;
  });
  revalidatePath('/reglages/equipe');
  return fait ? id : null;
}

export const changerRole = actionSimple(async (f) => {
  const role = f.get('role') === 'preparateur' ? 'preparateur' : 'vendeur';
  await surEmploye(f, `employe.role.${role}`, async (trx, id) => {
    await trx.updateTable('utilisateurs').set({ role }).where('id', '=', id).execute();
  });
});

export const basculerProduits = actionSimple(async (f) => {
  const accorder = f.get('accorder') === '1';
  await surEmploye(f, accorder ? 'employe.produits.accorde' : 'employe.produits.retire', async (trx, id) => {
    await trx.updateTable('utilisateurs').set({ gere_produits: accorder }).where('id', '=', id).where('role', '=', 'vendeur').execute();
  });
});

export const basculerRemises = actionSimple(async (f) => {
  const accorder = f.get('accorder') === '1';
  await surEmploye(f, accorder ? 'employe.remises.accorde' : 'employe.remises.retire', async (trx, id) => {
    await trx.updateTable('utilisateurs').set({ peut_remiser: accorder }).where('id', '=', id).where('role', '=', 'vendeur').execute();
  });
});

export const basculerBlocage = actionSimple(async (f) => {
  const bloquer = f.get('bloquer') === '1';
  const id = await surEmploye(f, bloquer ? 'employe.bloque' : 'employe.debloque', async (trx, cible) => {
    await trx.updateTable('utilisateurs').set({ desactive: bloquer }).where('id', '=', cible).execute();
  });
  if (id && bloquer) await supprimerSessionsUtilisateur(id);
});

export const supprimerEmploye = actionSimple(async (f) => {
  // Le compte est fermé et son numéro libéré. Son nom reste attaché à ce qu'il a fait (ventes, mouvements de stock).
  const id = await surEmploye(f, 'employe.supprime', async (trx, cible) => {
    await trx.updateTable('utilisateurs').set({ supprime_le: new Date(), desactive: true, telephone: null }).where('id', '=', cible).execute();
  });
  if (id) await supprimerSessionsUtilisateur(id);
});

export const annulerInvitation = actionSimple(async (f) => {
  const s = await exigerEcriture('equipe');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) =>
    trx.updateTable('invitations').set({ annulee_le: new Date() }).where('id', '=', id).where('utilisee_le', 'is', null).execute());
  revalidatePath('/reglages/equipe');
});
