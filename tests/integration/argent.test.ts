// Fournisseurs et arrivages, dépenses, versements du transporteur : règles prouvées contre une vraie base.
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import { confirmerCommande, creerCommande, expedier, marquerLivree, marquerPreparee } from '../../src/lib/commandes.ts';
import { annulerDepense, colisAReverser, creerDepense, enregistrerVersement, listerVersements, totalDepenses } from '../../src/lib/depenses.ts';
import { caisseOuverte, cloturerCaisse, resumeCaisse, vendreEnCaisse } from '../../src/lib/documents.ts';
import { coutMoyen, creerArrivage, enregistrerFournisseur, lireArrivage, lireFournisseur, payerFournisseur, totalDuFournisseurs } from '../../src/lib/fournisseurs.ts';
import { periode, rapportMarge } from '../../src/lib/rapports.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, telephone } from '../outils.ts';

let A: Contexte, B: Contexte;
let huile: string, sucre: string;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const cle = () => crypto.randomUUID();
const variante = (c: Contexte, id: string) => chez(c, (trx) => trx.selectFrom('variantes as v').innerJoin('stocks as s', 's.variante_id', 'v.id').select(['v.prix_achat', 's.quantite']).where('v.id', '=', id).executeTakeFirstOrThrow());

async function article(c: Contexte, nom: string, prixVente: number, stockInitial: number, prixAchat: number) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat, prixVente, seuil: 0, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Argent A');
  const b = await creerCommercant(admin.id, 'Argent B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
  huile = await article(A, 'Huile 5 L', 120_000, 10, 100_000);
  sucre = await article(A, 'Sucre 1 kg', 12_000, 0, 0);
});
afterAll(fermerBD);

describe('arrivages et fournisseurs', () => {
  it('calcule le coût moyen pondéré, sans compter un stock négatif', () => {
    expect(coutMoyen(10, 100_000, 10, 110_000)).toBe(105_000);
    expect(coutMoyen(0, 100_000, 5, 90_000)).toBe(90_000);
    expect(coutMoyen(-3, 100_000, 5, 90_000)).toBe(90_000);
    expect(coutMoyen(1, 100, 2, 101)).toBe(101); // 100,67 arrondi
  });

  it('un arrivage fait entrer le stock, met à jour le prix d\'achat, garde la dette ; une seule fois', async () => {
    const f = await chez(A, (trx) => enregistrerFournisseur(trx, A, { nom: 'Grossiste Amine', telephone: '0661 11 22 33' }));
    if (!f.ok) throw new Error(f.raison);
    const k = cle();
    const r = await chez(A, (trx) => creerArrivage(trx, A, {
      fournisseurId: f.id, reference: 'BL-778', lignes: [{ varianteId: huile, quantite: 10, coutUnitaire: 110_000 }, { varianteId: sucre, quantite: 50, coutUnitaire: 9_000 }],
      paye: { montant: 500_000, mode: 'especes' }, cle: k,
    }));
    if (!r.ok) throw new Error(r.raison);
    expect(await chez(A, (trx) => creerArrivage(trx, A, { fournisseurId: f.id, lignes: [{ varianteId: huile, quantite: 10, coutUnitaire: 110_000 }], cle: k }))).toMatchObject({ ok: true, id: r.id, doublon: true });
    expect(await variante(A, huile)).toEqual({ prix_achat: '105000', quantite: 20 });
    expect(await variante(A, sucre)).toEqual({ prix_achat: '9000', quantite: 50 });
    const a = (await chez(A, (trx) => lireArrivage(trx, r.id)))!;
    expect(a).toMatchObject({ numero: 1, total: 1_550_000, paye: 500_000, reference: 'BL-778', fournisseur: { nom: 'Grossiste Amine' } });
    // Les entrées de stock sont reliées à l'arrivage, avec le prix payé.
    const m = await chez(A, (trx) => trx.selectFrom('mouvements_stock').select(['type', 'motif', 'quantite', 'cout_unitaire']).where('arrivage_id', '=', r.id).orderBy('quantite').execute());
    expect(m).toEqual([{ type: 'entree', motif: 'achat', quantite: 10, cout_unitaire: '110000' }, { type: 'entree', motif: 'achat', quantite: 50, cout_unitaire: '9000' }]);
    let fiche = (await chez(A, (trx) => lireFournisseur(trx, f.id)))!;
    expect(fiche).toMatchObject({ du: 1_050_000, telephone: '0661112233' });
    // Paiement en plusieurs fois ; la même clé ne paie jamais deux fois.
    const kp = cle();
    for (let i = 0; i < 2; i++) expect(await chez(A, (trx) => payerFournisseur(trx, A, f.id, { montant: 50_000, mode: 'virement', cle: kp }))).toEqual({ ok: true });
    fiche = (await chez(A, (trx) => lireFournisseur(trx, f.id)))!;
    expect(fiche.du).toBe(1_000_000);
    expect(fiche.paiements).toHaveLength(2);
    expect(await chez(A, totalDuFournisseurs)).toBe(1_000_000);
    // La vente suivante garde le nouveau prix d'achat pour la marge.
    const v = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: huile, quantite: 1 }], cle: cle() }));
    if (!v.ok) throw new Error(v.raison);
    expect((await chez(A, (trx) => trx.selectFrom('lignes_document').select('cout_unitaire').where('document_id', '=', v.id).executeTakeFirstOrThrow())).cout_unitaire).toBe('105000');
  });

  it('refuse sans rien écrire : article inconnu, quantité fausse, paiement sans fournisseur', async () => {
    const avant = await variante(A, sucre);
    for (const [a, raison] of [
      [{ lignes: [] }, 'panier_vide'],
      [{ lignes: [{ varianteId: sucre, quantite: 0, coutUnitaire: 1 }] }, 'quantite_invalide'],
      [{ lignes: [{ varianteId: crypto.randomUUID(), quantite: 1, coutUnitaire: 1 }] }, 'introuvable'],
      [{ lignes: [{ varianteId: sucre, quantite: 1, coutUnitaire: 1 }], paye: { montant: 1, mode: 'especes' } }, 'fournisseur_requis'],
    ] as const) {
      expect(await chez(A, (trx) => creerArrivage(trx, A, { fournisseurId: null, cle: cle(), ...a } as never))).toEqual({ ok: false, raison });
    }
    expect(await variante(A, sucre)).toEqual(avant);
  });

  it('un arrivage et ses lignes ne se modifient ni ne s\'effacent', async () => {
    await expect(chez(A, (trx) => sql`UPDATE arrivages SET total = 0`.execute(trx))).rejects.toThrow(/permission/);
    await expect(chez(A, (trx) => sql`DELETE FROM lignes_arrivage`.execute(trx))).rejects.toThrow(/permission/);
    await expect(chez(A, (trx) => sql`DELETE FROM paiements_fournisseurs`.execute(trx))).rejects.toThrow(/permission/);
  });
});

describe('dépenses et caisse', () => {
  it('une dépense payée par la caisse et un fournisseur payé en espèces diminuent les espèces attendues', async () => {
    const c = await creerCommercant((await creerAdmin()).id, 'Argent C');
    const C: Contexte = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
    const pain = await article(C, 'Pain', 2_000, 100, 1_000);
    await chez(C, (trx) => vendreEnCaisse(trx, C, { lignes: [{ varianteId: pain, quantite: 10 }], cle: cle() }));
    const d = await chez(C, (trx) => creerDepense(trx, C, { categorie: 'transport', montant: 3_000, mode: 'especes', parCaisse: true, cle: cle() }));
    expect(d.ok).toBe(true);
    // Payée autrement : n'entre pas dans la caisse.
    await chez(C, (trx) => creerDepense(trx, C, { categorie: 'loyer', montant: 2_000_000, mode: 'virement', parCaisse: false, cle: cle() }));
    expect(await chez(C, (trx) => creerDepense(trx, C, { categorie: 'loyer', montant: 1, mode: 'cheque', parCaisse: true, cle: cle() }))).toEqual({ ok: false, raison: 'paiement_invalide' });
    expect(await chez(C, (trx) => creerDepense(trx, C, { categorie: 'cadeau' as never, montant: 1, mode: 'especes', parCaisse: false, cle: cle() }))).toEqual({ ok: false, raison: 'categorie_invalide' });
    const f = await chez(C, (trx) => enregistrerFournisseur(trx, C, { nom: 'Boulangerie' }));
    if (!f.ok) throw new Error(f.raison);
    await chez(C, (trx) => payerFournisseur(trx, C, f.id, { montant: 5_000, mode: 'especes', cle: cle() }));
    // Une dépense saisie par erreur s'annule : elle ne compte plus.
    const erreur = await chez(C, (trx) => creerDepense(trx, C, { categorie: 'autre', montant: 9_999, mode: 'especes', parCaisse: true, cle: cle() }));
    if (!erreur.ok) throw new Error(erreur.raison);
    expect(await chez(C, (trx) => annulerDepense(trx, C, erreur.id))).toEqual({ ok: true });
    expect(await chez(C, (trx) => annulerDepense(trx, C, erreur.id))).toEqual({ ok: false, raison: 'introuvable' });
    const id = (await chez(C, (trx) => caisseOuverte(trx, C, false)))!;
    expect(await chez(C, (trx) => resumeCaisse(trx, id))).toMatchObject({ especes: 20_000, sorties: 8_000 });
    expect(await chez(C, (trx) => cloturerCaisse(trx, C, { comptees: 12_000 }))).toEqual({ ok: true, id, ecart: 0 });
    // Après la clôture, une dépense de cette caisse ne s'annule plus, même en écrivant dans la base.
    if (!d.ok) throw new Error();
    expect(await chez(C, (trx) => annulerDepense(trx, C, d.id))).toEqual({ ok: false, raison: 'caisse_cloturee' });
    await expect(chez(C, (trx) => sql`UPDATE depenses SET annulee_le = now(), annulee_par = ${C.utilisateurId} WHERE id = ${d.id}`.execute(trx))).rejects.toThrow(/caisse_cloturee/);
    await expect(chez(C, (trx) => sql`UPDATE depenses SET montant = 1 WHERE id = ${d.id}`.execute(trx))).rejects.toThrow(/permission/);
    // Bénéfice net : la marge moins les dépenses (annulées exclues).
    const p = periode('7j');
    expect((await chez(C, (trx) => totalDepenses(trx, p))).total).toBe(2_003_000);
    expect((await chez(C, (trx) => rapportMarge(trx, p))).marge).toBe(10_000);
  });
});

describe('versements du transporteur', () => {
  it('les colis livrés attendent leur versement ; un versement les regroupe, garde les frais retenus, une seule fois', async () => {
    const t = await chez(A, (trx) => trx.insertInto('transporteurs').values({ commercant_id: A.commercantId, nom: 'Yalidine' }).returning('id').executeTakeFirstOrThrow());
    const colis: string[] = [];
    for (let i = 0; i < 2; i++) {
      const c = await chez(A, (trx) => creerCommande(trx, A, { client: { nom: `Client ${i}`, telephone: telephone() }, wilaya: 16, commune: 'Kouba', livraison: 'domicile', lignes: [{ varianteId: huile, quantite: 1 }], frais: 50_000, cle: cle(), libelleLivraison: 'Livraison' }));
      if (!c.ok) throw new Error(c.raison);
      await chez(A, async (trx) => {
        await confirmerCommande(trx, A, c.id, 'envoi', cle());
        await marquerPreparee(trx, A, c.id);
        await expedier(trx, A, c.id, { transporteurId: t.id, numeroSuivi: `YAL-${i}` });
        await marquerLivree(trx, A, c.id);
      });
      colis.push(c.id);
    }
    const attente = await chez(A, colisAReverser);
    expect(attente.map((c) => [c.montant, c.transporteur])).toEqual([[170_000, 'Yalidine'], [170_000, 'Yalidine']]);
    const k = cle();
    const v = await chez(A, (trx) => enregistrerVersement(trx, A, { commandes: colis, recu: 300_000, mode: 'virement', cle: k }));
    expect(v).toMatchObject({ ok: true, frais: 40_000 });
    expect(await chez(A, (trx) => enregistrerVersement(trx, A, { commandes: colis, recu: 300_000, mode: 'virement', cle: k }))).toMatchObject({ ok: true, frais: 40_000 });
    expect(await chez(A, colisAReverser)).toEqual([]);
    expect(await chez(A, (trx) => enregistrerVersement(trx, A, { commandes: colis, recu: 1, mode: 'especes', cle: cle() }))).toEqual({ ok: false, raison: 'colis_invalides' });
    expect((await chez(A, listerVersements))[0]).toMatchObject({ attendu: 340_000, recu: 300_000, colis: 2, transporteur: 'Yalidine' });
  });
});

describe('isolation', () => {
  it('un commerçant ne voit ni les fournisseurs, ni les arrivages, ni les dépenses, ni les versements d\'un autre', async () => {
    for (const table of ['fournisseurs', 'arrivages', 'lignes_arrivage', 'paiements_fournisseurs', 'depenses', 'versements_transporteur'] as const) {
      expect(await chez(B, (trx) => trx.selectFrom(table).select('commercant_id').execute()), table).toEqual([]);
    }
    expect(await chez(B, colisAReverser)).toEqual([]);
    expect(await chez(B, (trx) => creerArrivage(trx, B, { fournisseurId: null, lignes: [{ varianteId: huile, quantite: 1, coutUnitaire: 1 }], cle: cle() }))).toEqual({ ok: false, raison: 'introuvable' });
    const fa = await chez(A, (trx) => trx.selectFrom('fournisseurs').select('id').executeTakeFirstOrThrow());
    expect(await chez(B, (trx) => payerFournisseur(trx, B, fa.id, { montant: 1, mode: 'especes', cle: cle() }))).toEqual({ ok: false, raison: 'introuvable' });
  });
});
