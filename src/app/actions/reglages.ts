'use server';
import { revalidatePath } from 'next/cache';
import { action, actionSimple, secret, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import { chiffrerOuNul } from '@/lib/chiffrement';
import { activerTotp, changerMotDePasse, desactiverTotp, motDePasseCorrect, preparerTotp, verifierCode } from '@/lib/comptes';
import { MODULES } from '@/lib/droits';
import { journaliser } from '@/lib/journal';
import { defautMotDePasse } from '@/lib/mots-de-passe';
import { qrEnImage } from '@/lib/qr';
import { reglage } from '@/lib/reglages-plateforme';
import { supprimerSessionsUtilisateur } from '@/lib/sessions';
import { adresseTotp } from '@/lib/totp';
import { exigerEcriture, exigerUtilisateur, infoRequete } from '@/lib/web';

export const enregistrerEntreprise = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const nom = texte(f, 'nom', 120);
  if (!nom) return { erreur: 'champ_requis' };
  const id = s.commercant.id;
  const ctx = (col: string) => `commercants.${col}:${id}`;
  const { ip } = await infoRequete();
  await avecCommercant(id, async (trx) => {
    await trx.updateTable('commercants').set({
      nom,
      forme_juridique: texte(f, 'formeJuridique', 80) || null,
      telephone: texte(f, 'telephone', 30) || null,
      adresse_chiffre: chiffrerOuNul(texte(f, 'adresse', 300), ctx('adresse')),
      rc_chiffre: chiffrerOuNul(texte(f, 'rc', 40), ctx('rc')),
      nif_chiffre: chiffrerOuNul(texte(f, 'nif', 40), ctx('nif')),
      nis_chiffre: chiffrerOuNul(texte(f, 'nis', 40), ctx('nis')),
      ai_chiffre: chiffrerOuNul(texte(f, 'ai', 40), ctx('ai')),
    }).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'entreprise.modifiee', ip });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
});

export const enregistrerModules = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const modules = Object.fromEntries(MODULES.map((m) => [m, f.get(m) === 'on']));
  const { ip } = await infoRequete();
  await avecCommercant(s.commercant.id, async (trx) => {
    await trx.updateTable('commercants').set({ modules: JSON.stringify(modules) }).execute();
    await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'modules.modifies', details: modules, ip });
  });
  revalidatePath('/', 'layout');
  return { ok: true };
});

export const changerMdp = action(async (f) => {
  const s = await exigerUtilisateur();
  const nouveau = secret(f, 'nouveau');
  if (!(await motDePasseCorrect(s.utilisateur.id, secret(f, 'actuel')))) return { erreur: 'mdp_actuel_faux' };
  // Avec la double authentification active, 8 caractères suffisent (NIST SP 800-63B).
  const min = s.utilisateur.totpActif || s.utilisateur.role !== 'proprietaire' ? await reglage('mdp_min_employe') : await reglage('mdp_min_proprietaire');
  const defaut = defautMotDePasse(nouveau, min, [s.utilisateur.nom]);
  if (defaut) return { erreur: defaut };
  await changerMotDePasse(s.utilisateur.id, nouveau);
  await supprimerSessionsUtilisateur(s.utilisateur.id, s.id);
  const { ip } = await infoRequete();
  await avecCommercant(s.commercant.id, (trx) => journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'mot_de_passe.change', ip }));
  return { ok: true };
});

export const preparer2fa = action(async () => {
  const s = await exigerUtilisateur();
  if (s.utilisateur.totpActif) return { erreur: 'interdit' };
  const cle = await preparerTotp('utilisateurs', s.utilisateur.id);
  return { qr: qrEnImage(adresseTotp(cle, s.utilisateur.nom)), cle };
});

export const activer2fa = action(async (f) => {
  const s = await exigerUtilisateur();
  const codes = await activerTotp('utilisateurs', s.utilisateur.id, texte(f, 'code', 10));
  if (!codes) return { erreur: 'code_invalide' };
  const { ip } = await infoRequete();
  await avecCommercant(s.commercant.id, (trx) => journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'double_auth.activee', ip }));
  // Pas de rechargement ici : les codes de secours doivent rester à l'écran jusqu'à ce que l'utilisateur continue.
  return { ok: true, codes };
});

export const desactiver2fa = action(async (f) => {
  const s = await exigerUtilisateur();
  if (!(await motDePasseCorrect(s.utilisateur.id, secret(f, 'motDePasse')))) return { erreur: 'mdp_actuel_faux' };
  // Le mot de passe seul ne suffit pas : il faut aussi un code de l'application (ou un code de secours).
  if (!(await verifierCode('utilisateurs', s.utilisateur.id, texte(f, 'code', 20)))) return { erreur: 'code_invalide' };
  await desactiverTotp(s.utilisateur.id);
  const { ip } = await infoRequete();
  await avecCommercant(s.commercant.id, (trx) => journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'double_auth.desactivee', ip }));
  revalidatePath('/reglages/securite');
  return { ok: true };
});

export const deconnecterAppareil = actionSimple(async (f) => {
  const s = await exigerUtilisateur();
  const id = texte(f, 'id', 40);
  if (id === s.id) return;
  // Chacun ne peut déconnecter que ses propres appareils.
  await avecCommercant(s.commercant.id, (trx) => trx.deleteFrom('sessions').where('id', '=', id).where('utilisateur_id', '=', s.utilisateur.id).execute());
  revalidatePath('/reglages/securite');
});
