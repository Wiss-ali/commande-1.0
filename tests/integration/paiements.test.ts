// Moyens de paiement, vente à crédit, remises et avoir partiel : règles prouvées contre une vraie base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import {
  caisseOuverte, clientsQuiDoivent, creerAvoir, creerDocument, dettesClient, encaisserClient, encaisserFacture, lireDocument, listerDocuments, resumeCaisse,
  soldeDocument, transformer, vendreEnCaisse,
} from '../../src/lib/documents.ts';
import { repartirRemise } from '../../src/lib/fiscal.ts';
import { oublierReglages } from '../../src/lib/reglages-plateforme.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, sqlProprietaire } from '../outils.ts';

let A: Contexte, B: Contexte;
let stylo: string, cahier: string;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const cle = () => crypto.randomUUID();
const quantite = async (c: Contexte, varianteId: string) => (await chez(c, (trx) => trx.selectFrom('stocks').select('quantite').where('variante_id', '=', varianteId).executeTakeFirstOrThrow())).quantite;
const client = { nom: 'Karim', telephone: '0661000001' };

async function article(c: Contexte, nom: string, prixVente: number, stockInitial: number, prixAchat = 0) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat, prixVente, seuil: 0, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Paie A');
  const b = await creerCommercant(admin.id, 'Paie B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
  stylo = await article(A, 'Stylo', 10_000, 100, 4_000);
  cahier = await article(A, 'Cahier', 30_000, 100, 20_000);
});
afterAll(async () => {
  await sqlProprietaire(`UPDATE reglages_plateforme SET valeur = '{"tranches": []}' WHERE cle = 'timbre'`);
  oublierReglages();
  await fermerBD();
});

describe('moyens de paiement', () => {
  it('une vente payée par virement le dit, et n\'entre pas dans la caisse', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1 }], encaisse: [{ mode: 'virement', montant: 10_000, reference: 'VIR-12' }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    const d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ modePaiement: 'virement', solde: { net: 10_000, paye: 10_000, reste: 0 } });
    expect(d.payeLe).toBeInstanceOf(Date);
    expect(d.paiements.map((p) => [p.mode, p.montant, p.reference])).toEqual([['virement', 10_000, 'VIR-12']]);
  });

  it('paiement en deux moyens : « mixte », seule la part en espèces va dans la caisse', async () => {
    const id = (await chez(A, (trx) => caisseOuverte(trx, A)))!;
    const avant = (await chez(A, (trx) => resumeCaisse(trx, id)))!.especes;
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cahier, quantite: 1 }], encaisse: [{ mode: 'especes', montant: 10_000 }, { mode: 'ccp', montant: 20_000 }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    expect((await chez(A, (trx) => lireDocument(trx, r.id)))!.modePaiement).toBe('mixte');
    expect((await chez(A, (trx) => resumeCaisse(trx, id)))!.especes - avant).toBe(10_000);
  });

  it('le droit de timbre ne porte que sur la part payée en espèces', async () => {
    // Barème d'essai (pas une règle réelle) : 1 DA par tranche de 100 DA.
    await sqlProprietaire(`UPDATE reglages_plateforme SET valeur = '{"tranches": [{"jusqua": null, "parCent": 100}]}' WHERE cle = 'timbre'`);
    oublierReglages();
    await chez(A, (trx) => trx.updateTable('commercants').set({ reglages_documents: JSON.stringify({ timbreTickets: true }) }).execute());
    const vendre = (encaisse?: { mode: 'especes' | 'cheque'; montant: number }[]) => chez(A, async (trx) => {
      const r = await vendreEnCaisse(trx, A, { lignes: [{ varianteId: cahier, quantite: 1 }], encaisse, cle: cle() });
      if (!r.ok) throw new Error(r.raison);
      return (await lireDocument(trx, r.id))!;
    });
    expect((await vendre()).timbre).toBe(300); // 300 DA en espèces : 3 DA
    expect((await vendre([{ mode: 'cheque', montant: 30_000 }])).timbre).toBe(0);
    const mixte = await vendre([{ mode: 'especes', montant: 10_000 }, { mode: 'cheque', montant: 20_000 }]);
    expect(mixte).toMatchObject({ timbre: 100, total: 30_100, solde: { reste: 0 } });
    await chez(A, (trx) => trx.updateTable('commercants').set({ reglages_documents: '{}' }).execute());
  });

  it('refuse un moyen inconnu ou plus d\'argent que le total, sans rien écrire', async () => {
    const avant = await quantite(A, stylo);
    for (const encaisse of [[{ mode: 'carte', montant: 10_000 }], [{ mode: 'especes', montant: 10_001 }], [{ mode: 'especes', montant: 0 }]]) {
      expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1 }], encaisse: encaisse as never, cle: cle() }))).toEqual({ ok: false, raison: 'paiement_invalide' });
    }
    expect(await quantite(A, stylo)).toBe(avant);
  });
});

describe('vente à crédit', () => {
  it('exige un client, puis se paie en plusieurs fois avec un reçu à chaque versement', async () => {
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1 }], encaisse: [], cle: cle() }))).toEqual({ ok: false, raison: 'client_credit' });
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cahier, quantite: 2 }], acheteur: client, encaisse: [{ mode: 'especes', montant: 20_000 }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    let d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ type: 'ticket', payeLe: null, solde: { net: 60_000, paye: 20_000, reste: 40_000 } });
    expect(d.clientId).not.toBeNull();
    expect(await chez(A, (trx) => dettesClient(trx, d.clientId!))).toMatchObject([{ documentId: r.id, reste: 40_000 }]);
    expect(await chez(A, (trx) => encaisserFacture(trx, A, r.id, cle(), { mode: 'especes', montant: 40_001 }))).toEqual({ ok: false, raison: 'paiement_invalide' });
    const v1 = await chez(A, (trx) => encaisserFacture(trx, A, r.id, cle(), { mode: 'ccp', montant: 15_000 }));
    expect(v1.ok).toBe(true);
    d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ payeLe: null, modePaiement: 'mixte', solde: { reste: 25_000 } });
    const k = cle();
    const v2 = await chez(A, (trx) => encaisserFacture(trx, A, r.id, k));
    if (!v2.ok) throw new Error(v2.raison);
    // Double toucher : même reçu, rien de plus.
    expect(await chez(A, (trx) => encaisserFacture(trx, A, r.id, k))).toEqual({ ok: true, id: v2.id });
    d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d.solde).toEqual({ net: 60_000, paye: 60_000, reste: 0 });
    expect(d.payeLe).toBeInstanceOf(Date);
    expect(d.liens.filter((l) => l.nature === 'regle_par')).toHaveLength(2);
    expect(await chez(A, (trx) => encaisserFacture(trx, A, r.id, cle()))).toEqual({ ok: false, raison: 'deja_paye' });
  });

  it('un versement global règle les ventes dues des plus anciennes aux plus récentes', async () => {
    const acheteur = { nom: 'Samia', telephone: '0661000002' };
    const vente = async (n: number) => {
      const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: n }], acheteur, encaisse: [], cle: cle() }));
      if (!r.ok) throw new Error(r.raison);
      return r.id;
    };
    const v1 = await vente(1);
    const v2 = await vente(2);
    const clientId = (await chez(A, (trx) => lireDocument(trx, v1)))!.clientId!;
    expect((await chez(A, clientsQuiDoivent)).find((c) => c.id === clientId)?.du).toBe(30_000);
    const r = await chez(A, (trx) => encaisserClient(trx, A, clientId, { mode: 'especes', montant: 15_000, cle: cle() }));
    expect(r.ok && r.recus.length).toBe(2);
    expect((await chez(A, (trx) => soldeDocument(trx, v1)))!.reste).toBe(0);
    expect((await chez(A, (trx) => soldeDocument(trx, v2)))!.reste).toBe(15_000);
    expect(await chez(A, (trx) => encaisserClient(trx, A, clientId, { mode: 'especes', montant: 15_001, cle: cle() }))).toEqual({ ok: false, raison: 'paiement_invalide' });
  });

  it('une facture « vente directe » transformée depuis un devis peut rester à payer', async () => {
    const devis = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: client, lignes: [{ varianteId: stylo, quantite: 1 }] }));
    if (!devis.ok) throw new Error(devis.raison);
    const f = await chez(A, (trx) => transformer(trx, A, devis.id, 'facture', { mode: 'directe', encaisse: [], cle: cle() }));
    if (!f.ok) throw new Error(f.raison);
    expect(await chez(A, (trx) => lireDocument(trx, f.id))).toMatchObject({ type: 'facture', payeLe: null, modePaiement: null, solde: { reste: 10_000 } });
  });
});

describe('remises', () => {
  it('répartit une remise au centime près, sans jamais dépasser une ligne', () => {
    expect(repartirRemise([10_000, 20_000, 30_000], 1_000)).toEqual([167, 333, 500]);
    expect(repartirRemise([100, 100, 100], 100).reduce((s, p) => s + p, 0)).toBe(100);
    expect(repartirRemise([50, 50], 500)).toEqual([50, 50]);
    expect(repartirRemise([0, 0], 10)).toEqual([0, 0]);
  });

  it('remise sur une ligne et sur le total : chaque ligne garde sa TVA juste', async () => {
    await chez(A, (trx) => trx.updateTable('commercants').set({ reglages_documents: JSON.stringify({ assujettiTva: true, tauxDefaut: 1900 }) }).execute());
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 2, remise: 2_000 }, { varianteId: cahier, quantite: 1 }], remiseGlobale: 4_800, cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    const d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    // 20 000 − 2 000 = 18 000 et 30 000 ; remise totale de 4 800 répartie au prorata : 1 800 et 3 000.
    expect(d.lignes.map((l) => [l.remise, l.totalTtc])).toEqual([[3_800, 16_200], [3_000, 27_000]]);
    expect(d.total).toBe(43_200);
    expect(d.totalHt + d.totalTva).toBe(43_200);
    expect(d.lignes[0]!.totalHt).toBe(Math.round((16_200 * 10_000) / 11_900));
    await chez(A, (trx) => trx.updateTable('commercants').set({ reglages_documents: '{}' }).execute());
  });

  it('refuse une remise plus grande que la ligne ou que le total', async () => {
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1, remise: 10_001 }], cle: cle() }))).toEqual({ ok: false, raison: 'remise_invalide' });
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1 }], remiseGlobale: 10_001, cle: cle() }))).toEqual({ ok: false, raison: 'remise_invalide' });
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1, remise: -1 }], cle: cle() }))).toEqual({ ok: false, raison: 'remise_invalide' });
  });

  it('la remise d\'un devis passe telle quelle sur la facture', async () => {
    const devis = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: client, lignes: [{ varianteId: cahier, quantite: 3, remise: 5_000 }] }));
    if (!devis.ok) throw new Error(devis.raison);
    const f = await chez(A, (trx) => transformer(trx, A, devis.id, 'facture', { mode: 'directe', cle: cle() }));
    if (!f.ok) throw new Error(f.raison);
    expect((await chez(A, (trx) => lireDocument(trx, f.id)))!.lignes.map((l) => [l.quantite, l.remise, l.totalTtc])).toEqual([[3, 5_000, 85_000]]);
  });
});

describe('avoir partiel', () => {
  it('rend une partie : stock remis pour ces articles seulement, espèces rendues, puis le reste ; jamais plus', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 3 }, { varianteId: cahier, quantite: 1 }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    const [lStylo, lCahier] = (await chez(A, (trx) => lireDocument(trx, r.id)))!.lignes;
    const s0 = await quantite(A, stylo);
    const c0 = await quantite(A, cahier);
    const av = await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle(), lignes: [{ ligneId: lStylo!.id, quantite: 1 }] }));
    expect(av).toMatchObject({ ok: true, rembourse: 10_000 });
    expect(await quantite(A, stylo)).toBe(s0 + 1);
    expect(await quantite(A, cahier)).toBe(c0);
    expect(await chez(A, (trx) => soldeDocument(trx, r.id))).toEqual({ net: 50_000, paye: 50_000, reste: 0 });
    // Pas encore annulé : il reste une partie de la vente.
    expect((await chez(A, (trx) => listerDocuments(trx, { types: ['ticket'], limite: 1 })))[0]).toMatchObject({ id: r.id, annule: false });
    expect(await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle(), lignes: [{ ligneId: lStylo!.id, quantite: 3 }] }))).toEqual({ ok: false, raison: 'retour_invalide' });
    expect(await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle(), lignes: [{ ligneId: crypto.randomUUID(), quantite: 1 }] }))).toEqual({ ok: false, raison: 'retour_invalide' });
    // Le reste : tout ce qui n'a pas été rendu.
    const fin = await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle() }));
    expect(fin).toMatchObject({ ok: true, rembourse: 50_000 });
    expect(await quantite(A, stylo)).toBe(s0 + 3);
    expect(await quantite(A, cahier)).toBe(c0 + 1);
    expect(await chez(A, (trx) => soldeDocument(trx, r.id))).toEqual({ net: 0, paye: 0, reste: 0 });
    expect((await chez(A, (trx) => listerDocuments(trx, { types: ['ticket'], limite: 1 })))[0]).toMatchObject({ id: r.id, annule: true });
    expect(await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle() }))).toEqual({ ok: false, raison: 'deja_annule' });
    void lCahier;
  });

  it('les parts rendues retombent juste, même avec une remise qui ne se divise pas', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 3, remise: 100 }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    const ligne = (await chez(A, (trx) => lireDocument(trx, r.id)))!.lignes[0]!;
    for (let i = 0; i < 3; i++) {
      const av = await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: false, cle: cle(), lignes: [{ ligneId: ligne.id, quantite: 1 }] }));
      expect(av.ok).toBe(true);
    }
    expect((await chez(A, (trx) => soldeDocument(trx, r.id)))!.net).toBe(0);
  });

  it('sur une vente à crédit, l\'avoir diminue la dette au lieu de rendre de l\'argent', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cahier, quantite: 2 }], acheteur: { nom: 'Yacine', telephone: '0661000003' }, encaisse: [{ mode: 'especes', montant: 10_000 }], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    const ligne = (await chez(A, (trx) => lireDocument(trx, r.id)))!.lignes[0]!;
    const av = await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle(), lignes: [{ ligneId: ligne.id, quantite: 1 }] }));
    expect(av).toMatchObject({ ok: true, rembourse: 0 });
    expect(await chez(A, (trx) => soldeDocument(trx, r.id))).toEqual({ net: 30_000, paye: 10_000, reste: 20_000 });
    // Rendre le second cahier : la vente vaut 0 ; le client avait payé 100 DA, on les lui rend.
    const fin = await chez(A, (trx) => creerAvoir(trx, A, r.id, { remettreEnStock: true, cle: cle() }));
    expect(fin).toMatchObject({ ok: true, rembourse: 10_000 });
    expect(await chez(A, (trx) => soldeDocument(trx, r.id))).toEqual({ net: 0, paye: 0, reste: 0 });
  });
});

describe('isolation', () => {
  it('un commerçant ne voit ni les paiements ni les dettes d\'un autre, et ne peut pas encaisser chez lui', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: stylo, quantite: 1 }], acheteur: { nom: 'Privé', telephone: '0661000009' }, encaisse: [], cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    expect(await chez(B, (trx) => trx.selectFrom('paiements').select('id').execute())).toEqual([]);
    expect(await chez(B, (trx) => trx.selectFrom('soldes_documents').select('document_id').execute())).toEqual([]);
    expect(await chez(B, clientsQuiDoivent)).toEqual([]);
    expect(await chez(B, (trx) => encaisserFacture(trx, B, r.id, cle()))).toEqual({ ok: false, raison: 'introuvable' });
    await expect(chez(B, (trx) => trx.insertInto('paiements').values({ commercant_id: A.commercantId, document_id: r.id, montant: 1, mode: 'cheque', cree_par: B.utilisateurId }).execute())).rejects.toThrow(/row-level security/);
    // Un paiement ne se modifie ni ne s'efface.
    await expect(chez(A, (trx) => trx.updateTable('paiements').set({ montant: 1 }).where('document_id', '=', r.id).execute())).rejects.toThrow(/permission/);
    await expect(chez(A, (trx) => trx.deleteFrom('paiements').execute())).rejects.toThrow(/permission/);
  });
});
