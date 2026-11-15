// Invitations, connexion, blocage, double authentification, sessions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import { activerTotp, connecterAdmin, connecterUtilisateur, preparerTotp, verifierCode } from '../../src/lib/comptes.ts';
import { accepterInvitation, inviterCommercant, inviterEmploye, lireInvitation, reinitialiserEmploye, reinitialiserProprietaire, reinviterCommercant } from '../../src/lib/invitations.ts';
import { autoriser } from '../../src/lib/limites.ts';
import { creerSession, supprimerSession, trouverSession } from '../../src/lib/sessions.ts';
import { codeTotpActuel } from '../../src/lib/totp.ts';
import { creerAdmin, creerCommercant, MDP, sqlProprietaire, telephone } from '../outils.ts';

let admin: Awaited<ReturnType<typeof creerAdmin>>;
beforeAll(async () => {
  admin = await creerAdmin();
});
afterAll(fermerBD);

describe('invitation d\'un commerçant', () => {
  it('le lien sert une seule fois', async () => {
    const tel = telephone();
    const inv = await inviterCommercant({ adminId: admin.id, nomCommercant: 'Unique', nom: 'Ali', telephone: tel });
    if (!inv.ok) throw new Error();
    expect(await lireInvitation(inv.jeton)).toMatchObject({ valide: true, invitation: { type: 'commercant', telephone: tel } });
    expect((await accepterInvitation(inv.jeton, { motDePasse: MDP })).ok).toBe(true);
    expect(await lireInvitation(inv.jeton)).toEqual({ valide: false });
    expect(await accepterInvitation(inv.jeton, { motDePasse: MDP })).toEqual({ ok: false, raison: 'lien_invalide' });
  });

  it('deux acceptations simultanées ne créent qu\'un compte', async () => {
    const inv = await inviterCommercant({ adminId: admin.id, nomCommercant: 'Double clic', nom: 'Ali', telephone: telephone() });
    if (!inv.ok) throw new Error();
    const r = await Promise.all([accepterInvitation(inv.jeton, { motDePasse: MDP }), accepterInvitation(inv.jeton, { motDePasse: MDP })]);
    expect(r.filter((x) => x.ok)).toHaveLength(1);
  });

  it('un lien expiré, annulé ou inventé est refusé', async () => {
    const inv = await inviterCommercant({ adminId: admin.id, nomCommercant: 'Expiré', nom: 'Ali', telephone: telephone() });
    if (!inv.ok) throw new Error();
    await sqlProprietaire('ALTER TABLE invitations NO FORCE ROW LEVEL SECURITY');
    await sqlProprietaire(`UPDATE invitations SET expire_le = now() - interval '1 minute' WHERE commercant_id = $1`, [inv.commercantId]);
    await sqlProprietaire('ALTER TABLE invitations FORCE ROW LEVEL SECURITY');
    expect(await lireInvitation(inv.jeton)).toEqual({ valide: false });
    expect((await accepterInvitation(inv.jeton, { motDePasse: MDP })).ok).toBe(false);
    expect(await lireInvitation('jeton-invente')).toEqual({ valide: false });

    const nouveau = await reinviterCommercant({ adminId: admin.id, commercantId: inv.commercantId });
    if (!nouveau.ok) throw new Error();
    const encore = await reinviterCommercant({ adminId: admin.id, commercantId: inv.commercantId });
    expect(await lireInvitation(nouveau.jeton)).toEqual({ valide: false }); // annulé par le lien suivant
    expect(encore.ok && (await lireInvitation(encore.jeton)).valide).toBe(true);
  });

  it('refuse un mot de passe trop court ou trop courant, et un numéro déjà utilisé', async () => {
    const tel = telephone();
    const inv = await inviterCommercant({ adminId: admin.id, nomCommercant: 'Mdp', nom: 'Ali', telephone: tel });
    if (!inv.ok) throw new Error();
    expect(await accepterInvitation(inv.jeton, { motDePasse: 'douze lettres' })).toEqual({ ok: false, raison: 'mdp_trop_court' });
    expect(await accepterInvitation(inv.jeton, { motDePasse: 'motdepassemotdepasse' })).toEqual({ ok: false, raison: 'mdp_trop_courant' });
    expect((await lireInvitation(inv.jeton)).valide).toBe(true); // le lien reste utilisable après un refus
    expect((await accepterInvitation(inv.jeton, { motDePasse: MDP })).ok).toBe(true);
    expect(await inviterCommercant({ adminId: admin.id, nomCommercant: 'Autre', nom: 'Ali', telephone: tel })).toEqual({ ok: false, raison: 'telephone_pris' });
  });
});

describe('équipe', () => {
  it('le propriétaire invite un employé, qui se connecte avec son propre mot de passe', async () => {
    const c = await creerCommercant(admin.id, 'Équipe');
    const tel = telephone();
    const inv = await inviterEmploye({ commercantId: c.commercantId, parUtilisateur: c.proprietaireId, nom: 'Samir', telephone: tel, role: 'vendeur' });
    if (!inv.ok) throw new Error();
    expect(await accepterInvitation(inv.jeton, { motDePasse: 'huit car' })).toMatchObject({ ok: true, commercantId: c.commercantId });
    const cx = await connecterUtilisateur({ telephone: tel, motDePasse: 'huit car', ip: '10.0.0.1' });
    expect(cx).toMatchObject({ ok: true, commercantId: c.commercantId, totpActif: false });
    await avecCommercant(c.commercantId, async (trx) => {
      const u = await trx.selectFrom('utilisateurs').select(['nom', 'role']).where('telephone', '=', tel).executeTakeFirstOrThrow();
      expect(u).toEqual({ nom: 'Samir', role: 'vendeur' });
    });
  });

  it('respecte la limite d\'employés de la formule', async () => {
    const c = await creerCommercant(admin.id, 'Limite');
    await bd('plateforme').updateTable('commercants').set({ max_employes: 1 }).where('id', '=', c.commercantId).execute();
    const p = { commercantId: c.commercantId, parUtilisateur: c.proprietaireId, nom: 'E', role: 'preparateur' as const };
    expect((await inviterEmploye({ ...p, telephone: telephone() })).ok).toBe(true);
    expect(await inviterEmploye({ ...p, telephone: telephone() })).toEqual({ ok: false, raison: 'limite_employes' });
  });

  it('mot de passe oublié : le lien change le mot de passe et déconnecte tous les appareils', async () => {
    const c = await creerCommercant(admin.id, 'Oubli');
    const tel = telephone();
    const inv = await inviterEmploye({ commercantId: c.commercantId, parUtilisateur: c.proprietaireId, nom: 'Nora', telephone: tel, role: 'vendeur' });
    if (!inv.ok) throw new Error();
    const acc = await accepterInvitation(inv.jeton, { motDePasse: 'ancien mot' });
    if (!acc.ok) throw new Error();
    const s = await creerSession({ utilisateurId: acc.utilisateurId, commercantId: c.commercantId }, { complete: true, appareil: 'test' });

    const lien = await reinitialiserEmploye({ commercantId: c.commercantId, parUtilisateur: c.proprietaireId, utilisateurId: acc.utilisateurId });
    if (!lien.ok) throw new Error();
    expect((await accepterInvitation(lien.jeton, { motDePasse: 'nouveau mot' })).ok).toBe(true);
    expect(await trouverSession(s.jeton)).toBeNull();
    expect((await connecterUtilisateur({ telephone: tel, motDePasse: 'ancien mot', ip: null })).ok).toBe(false);
    expect((await connecterUtilisateur({ telephone: tel, motDePasse: 'nouveau mot', ip: null })).ok).toBe(true);

    // Un propriétaire ne peut pas être réinitialisé par ce chemin, ni l'employé d'un autre commerçant.
    expect((await reinitialiserEmploye({ commercantId: c.commercantId, parUtilisateur: c.proprietaireId, utilisateurId: c.proprietaireId })).ok).toBe(false);
    const autre = await creerCommercant(admin.id, 'Voisin');
    expect((await reinitialiserEmploye({ commercantId: autre.commercantId, parUtilisateur: autre.proprietaireId, utilisateurId: acc.utilisateurId })).ok).toBe(false);
    // L'administrateur, lui, peut réinitialiser un propriétaire.
    const lienAdmin = await reinitialiserProprietaire({ adminId: admin.id, commercantId: c.commercantId });
    expect(lienAdmin.ok && (await accepterInvitation(lienAdmin.jeton, { motDePasse: 'trop court' }))).toEqual({ ok: false, raison: 'mdp_trop_court' });
  });
});

describe('connexion', () => {
  it('donne la même réponse pour un compte inconnu et un mauvais mot de passe', async () => {
    const c = await creerCommercant(admin.id, 'Connexion');
    expect(await connecterUtilisateur({ telephone: c.telephone, motDePasse: 'faux', ip: null })).toEqual({ ok: false, raison: 'identifiants' });
    expect(await connecterUtilisateur({ telephone: '0500000000', motDePasse: 'faux', ip: null })).toEqual({ ok: false, raison: 'identifiants' });
    expect((await connecterUtilisateur({ telephone: c.telephone, motDePasse: MDP, ip: null })).ok).toBe(true);
  });

  it('bloque le compte après cinq échecs, même avec le bon mot de passe ensuite', async () => {
    const c = await creerCommercant(admin.id, 'Blocage');
    for (let i = 0; i < 5; i++) await connecterUtilisateur({ telephone: c.telephone, motDePasse: 'faux', ip: `10.1.${i}.1` });
    expect(await connecterUtilisateur({ telephone: c.telephone, motDePasse: MDP, ip: '10.1.9.1' })).toEqual({ ok: false, raison: 'bloque' });
  });

  it('refuse un compte bloqué par le propriétaire ou un commerçant suspendu, et coupe leurs sessions', async () => {
    const c = await creerCommercant(admin.id, 'Suspendu');
    const s = await creerSession({ utilisateurId: c.proprietaireId, commercantId: c.commercantId }, { complete: true, appareil: 'test' });
    expect((await trouverSession(s.jeton))?.type).toBe('utilisateur');
    await bd('plateforme').updateTable('commercants').set({ etat: 'suspendu' }).where('id', '=', c.commercantId).execute();
    expect(await trouverSession(s.jeton)).toBeNull();
    expect((await connecterUtilisateur({ telephone: c.telephone, motDePasse: MDP, ip: null })).ok).toBe(false);
  });

  it('limite le nombre d\'essais par adresse', async () => {
    const resultats = [];
    for (let i = 0; i < 4; i++) resultats.push(await autoriser('test', '41.1.1.0', 3, 60));
    expect(resultats).toEqual([true, true, true, false]);
  });
});

describe('sessions', () => {
  it('une session supprimée ou expirée ne vaut plus rien', async () => {
    const c = await creerCommercant(admin.id, 'Sessions');
    const s = await creerSession({ utilisateurId: c.proprietaireId, commercantId: c.commercantId }, { complete: true, appareil: 'test' });
    expect(await trouverSession(s.jeton)).toMatchObject({ complete: true, utilisateur: { role: 'proprietaire' }, commercant: { nom: 'Sessions' } });
    await supprimerSession(s.jeton);
    expect(await trouverSession(s.jeton)).toBeNull();
    expect(await trouverSession('')).toBeNull();
    const courte = await creerSession({ utilisateurId: c.proprietaireId, commercantId: c.commercantId }, { complete: false, appareil: 'test' });
    expect(courte.expire.getTime() - Date.now()).toBeLessThan(11 * 60_000);
    expect(await trouverSession(courte.jeton)).toMatchObject({ complete: false });
  });
});

describe('double authentification', () => {
  it('administrateur : activation, code valide, code de secours à usage unique', async () => {
    expect(await connecterAdmin({ identifiant: admin.identifiant, motDePasse: MDP, ip: '10.9.9.9' })).toMatchObject({ ok: true, totpActif: false });
    expect((await connecterAdmin({ identifiant: admin.identifiant, motDePasse: 'faux', ip: '10.9.9.9' })).ok).toBe(false);

    const secret = await preparerTotp('administrateurs', admin.id);
    expect(await activerTotp('administrateurs', admin.id, '000000')).toBeNull();
    const codes = await activerTotp('administrateurs', admin.id, codeTotpActuel(secret));
    expect(codes).toHaveLength(10);
    expect(await connecterAdmin({ identifiant: admin.identifiant, motDePasse: MDP, ip: '10.9.9.9' })).toMatchObject({ ok: true, totpActif: true });

    expect(await verifierCode('administrateurs', admin.id, codeTotpActuel(secret))).toBe(true);
    expect(await verifierCode('administrateurs', admin.id, '123456')).toBe(false);
    expect(await verifierCode('administrateurs', admin.id, codes![0]!)).toBe(true);
    expect(await verifierCode('administrateurs', admin.id, codes![0]!)).toBe(false);

    const stocke = await sqlProprietaire<{ totp_secret_chiffre: string }>('SELECT totp_secret_chiffre FROM administrateurs WHERE id = $1', [admin.id]);
    expect(stocke.rows[0]!.totp_secret_chiffre).not.toContain(secret);
  });
});
