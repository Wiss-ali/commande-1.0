// Abonnements : formules, paiements saisis par l'administrateur, échéances, lecture seule, modules autorisés.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ajouterJours, appliquerEcheances, enregistrerFormule, enregistrerPaiement, etatDepuisFin, etatEffectif, jourAlger, modulesAutorises, modulesEffectifs,
  retoucherModules, situation, tableauAbonnements,
} from '../../src/lib/abonnements.ts';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import { mettreEnLigne, changerSousDomaine, trouverBoutique } from '../../src/lib/boutique.ts';
import { connecterUtilisateur as connecter } from '../../src/lib/comptes.ts';
import { creerSession, trouverSession } from '../../src/lib/sessions.ts';
import { creerAdmin, creerCommercant, MDP } from '../outils.ts';

const D = { grace: 5, lecture: 90, rappel: 7 };
const aujourdhui = jourAlger();
let adminId = '';
let A: Awaited<ReturnType<typeof creerCommercant>>;
let caisse = '', complet = '';
const plateforme = () => bd('plateforme');
const payer = (o: { formuleId: string; recuLe: string; montant?: number }) =>
  plateforme().transaction().execute((trx) => enregistrerPaiement(trx, adminId, { commercantId: A.commercantId, moyen: 'ccp', reference: 'CCP 123', ...o }, D));
const session = async () => {
  const { jeton } = await creerSession({ utilisateurId: A.proprietaireId, commercantId: A.commercantId }, { complete: true, appareil: 'test' });
  return trouverSession(jeton);
};

beforeAll(async () => {
  adminId = (await creerAdmin()).id;
  A = await creerCommercant(adminId, 'Abonné A');
  const c = await enregistrerFormule(plateforme(), { nom: `Caisse ${Date.now()}`, prix: 1_500_00, dureeJours: 30, modules: ['caisse', 'factures'], active: true });
  const k = await enregistrerFormule(plateforme(), { nom: `Complet ${Date.now()}`, prix: 15_000_00, dureeJours: 365, modules: ['caisse', 'factures', 'commandes', 'clients', 'rapports', 'boutique'], active: true });
  if (!c.ok || !k.ok) throw new Error('formule');
  caisse = c.id;
  complet = k.id;
});
afterAll(fermerBD);

describe('règles de dates et de modules', () => {
  it('actif, bientôt, délai de grâce, lecture seule, archivé', () => {
    const j = '2026-03-10';
    expect(etatDepuisFin(null, j, D)).toBe('sans');
    expect(etatDepuisFin('2026-04-10', j, D)).toBe('actif');
    expect(etatDepuisFin('2026-03-17', j, D)).toBe('bientot');
    expect(etatDepuisFin('2026-03-11', j, D)).toBe('bientot');
    expect(etatDepuisFin('2026-03-10', j, D)).toBe('delai');
    expect(etatDepuisFin('2026-03-06', j, D)).toBe('delai');
    expect(etatDepuisFin('2026-03-05', j, D)).toBe('lecture_seule');
    expect(etatDepuisFin(ajouterJours(j, -95), j, D)).toBe('archive');
    expect(etatEffectif('suspendu', 'actif')).toBe('suspendu');
    expect(etatEffectif('actif', 'lecture_seule')).toBe('lecture_seule');
    expect(etatEffectif('lecture_seule', 'delai')).toBe('actif');
    expect(etatEffectif('actif', 'sans')).toBe('actif');
  });

  it('modules : formule + ajouts − retraits, Stock toujours ; sans abonnement, tout', () => {
    const a = modulesAutorises(['caisse', 'factures'], ['clients'], ['factures'])!;
    expect([...a].sort()).toEqual(['caisse', 'clients', 'stock']);
    expect(modulesAutorises(null, [], [])).toBeNull();
    const choisis = { stock: true, caisse: true, factures: true, commandes: true, clients: false, rapports: true, boutique: true };
    expect(modulesEffectifs(choisis, a)).toEqual({ stock: true, caisse: true, factures: false, commandes: false, clients: false, rapports: false, boutique: false });
    expect(modulesEffectifs(choisis, null)).toEqual(choisis);
  });
});

describe('paiements et échéances', () => {
  it('refuse une formule au nom déjà pris, un prix ou une durée invalides', async () => {
    const f = await plateforme().selectFrom('formules').select('nom').where('id', '=', caisse).executeTakeFirstOrThrow();
    expect(await enregistrerFormule(plateforme(), { nom: f.nom.toUpperCase(), prix: 1, dureeJours: 30, modules: [], active: true })).toEqual({ ok: false, raison: 'nom_pris' });
    expect(await enregistrerFormule(plateforme(), { nom: 'X', prix: -1, dureeJours: 30, modules: [], active: true })).toEqual({ ok: false, raison: 'montant_invalide' });
    expect(await enregistrerFormule(plateforme(), { nom: 'Y', prix: 1, dureeJours: 0, modules: [], active: true })).toEqual({ ok: false, raison: 'duree_invalide' });
  });

  it('sans abonnement : tous les modules, compte actif', async () => {
    const s = await session();
    expect(s?.type === 'utilisateur' && s.commercant.etat).toBe('actif');
    expect(s?.type === 'utilisateur' && s.commercant.modules.rapports).toBe(true);
  });

  it('un paiement ouvre une période ; le suivant la prolonge sans décaler l\'échéance', async () => {
    const r1 = await payer({ formuleId: caisse, recuLe: aujourdhui });
    expect(r1).toEqual({ ok: true, debut: aujourdhui, fin: ajouterJours(aujourdhui, 30) });
    // Paiement reçu en avance : la nouvelle période commence à la fin de la précédente.
    const r2 = await payer({ formuleId: caisse, recuLe: aujourdhui, montant: 1_400_00 });
    expect(r2).toEqual({ ok: true, debut: ajouterJours(aujourdhui, 30), fin: ajouterJours(aujourdhui, 60) });
    const s = await situation(plateforme(), A.commercantId, D);
    expect(s).toMatchObject({ etat: 'actif', fin: ajouterJours(aujourdhui, 60), joursRestants: 60 });
    expect(s.formule?.id).toBe(caisse);
    // Les montants payés sont gardés tels quels, et ne se modifient plus.
    const p = await plateforme().selectFrom('paiements_abonnement').select('montant').where('commercant_id', '=', A.commercantId).orderBy('cree_le').execute();
    expect(p.map((x) => Number(x.montant))).toEqual([1_500_00, 1_400_00]);
    await expect(plateforme().updateTable('paiements_abonnement').set({ montant: 0 }).where('commercant_id', '=', A.commercantId).execute()).rejects.toThrow(/permission denied|ligne_figee/);
  });

  it('la formule limite les modules ouverts ; l\'administrateur peut retoucher', async () => {
    let s = await session();
    if (s?.type !== 'utilisateur') throw new Error('session');
    expect(s.commercant.modules).toMatchObject({ stock: true, caisse: true, factures: true, commandes: false, rapports: false, boutique: false });
    await retoucherModules(plateforme(), A.commercantId, ['rapports'], ['factures', 'stock']);
    s = await session();
    if (s?.type !== 'utilisateur') throw new Error('session');
    expect(s.commercant.modules).toMatchObject({ stock: true, caisse: true, factures: false, rapports: true });
    // Le commerçant ne peut pas changer ses modules autorisés lui-même.
    await expect(avecCommercant(A.commercantId, (trx) => trx.updateTable('commercants').set({ modules_ajoutes: '["boutique"]' }).execute())).rejects.toThrow(/permission denied/);
    await retoucherModules(plateforme(), A.commercantId, [], []);
  });

  it('boutique : coupée si le module n\'est pas dans l\'abonnement', async () => {
    const sd = `abonne-${Date.now().toString(36)}`;
    await avecCommercant(A.commercantId, async (trx) => {
      await changerSousDomaine(trx, sd);
      await mettreEnLigne(trx, { commercantId: A.commercantId, utilisateurId: A.proprietaireId }, true);
      await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute();
    });
    expect((await trouverBoutique(sd))!.disponible).toBe(false);
    await payer({ formuleId: complet, recuLe: aujourdhui });
    expect((await trouverBoutique(sd))!.disponible).toBe(true);
  });

  it('après la fin et le délai : lecture seule (connexion possible), puis archivé (connexion refusée) ; un paiement rouvre', async () => {
    // Commerçant dont l'abonnement est fini depuis 10 jours.
    const B = await creerCommercant(adminId, 'Abonné B');
    const vieux = ajouterJours(aujourdhui, -40);
    const r = await plateforme().transaction().execute((trx) => enregistrerPaiement(trx, adminId, { commercantId: B.commercantId, formuleId: caisse, moyen: 'especes', recuLe: vieux }, D));
    expect(r).toMatchObject({ ok: true, fin: ajouterJours(aujourdhui, -10) });
    const { jeton } = await creerSession({ utilisateurId: B.proprietaireId, commercantId: B.commercantId }, { complete: true, appareil: 'test' });
    const s = await trouverSession(jeton);
    expect(s?.type === 'utilisateur' && s.commercant.etat).toBe('lecture_seule');
    await appliquerEcheances(plateforme());
    expect((await plateforme().selectFrom('commercants').select('etat').where('id', '=', B.commercantId).executeTakeFirstOrThrow()).etat).toBe('lecture_seule');
    expect((await connecter({ telephone: B.telephone, motDePasse: MDP, ip: null })).ok).toBe(true);
    // Paiement après la fin du délai : la nouvelle période commence le jour du paiement, le compte redevient actif.
    const r2 = await plateforme().transaction().execute((trx) => enregistrerPaiement(trx, adminId, { commercantId: B.commercantId, formuleId: caisse, moyen: 'baridimob', recuLe: aujourdhui }, D));
    expect(r2).toEqual({ ok: true, debut: aujourdhui, fin: ajouterJours(aujourdhui, 30) });
    expect((await plateforme().selectFrom('commercants').select('etat').where('id', '=', B.commercantId).executeTakeFirstOrThrow()).etat).toBe('actif');

    // Fin il y a 200 jours : archivé, plus de connexion. Rien n'est supprimé.
    const C = await creerCommercant(adminId, 'Abonné C');
    await plateforme().transaction().execute((trx) => enregistrerPaiement(trx, adminId, { commercantId: C.commercantId, formuleId: caisse, moyen: 'virement', recuLe: ajouterJours(aujourdhui, -230) }, D));
    expect((await connecter({ telephone: C.telephone, motDePasse: MDP, ip: null })).ok).toBe(false);
    expect(await plateforme().selectFrom('utilisateurs').select('id').where('commercant_id', '=', C.commercantId).execute()).toHaveLength(1);
  });

  it('refuse une date de paiement dans le futur, une formule inconnue', async () => {
    expect(await payer({ formuleId: caisse, recuLe: ajouterJours(aujourdhui, 10) })).toEqual({ ok: false, raison: 'date_invalide' });
    expect(await payer({ formuleId: crypto.randomUUID(), recuLe: aujourdhui })).toEqual({ ok: false, raison: 'introuvable' });
  });

  it('le commerçant voit ses paiements, pas ceux des autres ; le tableau compte le revenu du mois', async () => {
    const A2 = await creerCommercant(adminId, 'Abonné D');
    const vus = await avecCommercant(A2.commercantId, (trx) => trx.selectFrom('paiements_abonnement').select('id').execute());
    expect(vus).toEqual([]);
    const miens = await avecCommercant(A.commercantId, (trx) => trx.selectFrom('paiements_abonnement').select('id').execute());
    expect(miens).toHaveLength(3);
    await expect(avecCommercant(A.commercantId, (trx) => trx.insertInto('abonnements').values({ commercant_id: A.commercantId, formule_id: caisse, paiement_id: crypto.randomUUID(), debut: aujourdhui, fin: ajouterJours(aujourdhui, 1) }).execute())).rejects.toThrow(/permission denied/);
    const t = await tableauAbonnements(plateforme());
    expect(t.revenuMois).toBeGreaterThanOrEqual(1_500_00 + 1_400_00 + 15_000_00);
    expect(t.sans).toBeGreaterThanOrEqual(1);
  });
});
