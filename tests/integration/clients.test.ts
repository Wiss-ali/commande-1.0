// Fiche client saisie à la main et facture écrite à la main, prouvées contre une vraie base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import { enregistrerFiche, lireClient, listerClients, supprimerDonneesClient } from '../../src/lib/clients.ts';
import { creerDocument, lireDocument } from '../../src/lib/documents.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, telephone } from '../outils.ts';

let A: Contexte, B: Contexte;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const fiche = (o: Partial<Parameters<typeof enregistrerFiche>[3]> = {}) => ({ nom: 'Karim', telephone: telephone(), details: {}, note: '', ...o });

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Clients A');
  const b = await creerCommercant(admin.id, 'Clients B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
});
afterAll(fermerBD);

describe('fiche client à la main', () => {
  it('ajoute, corrige, refuse un numéro déjà pris, chiffre la note', async () => {
    const tel = telephone();
    const r = await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, null, fiche({ telephone: tel, details: { adresse: 'Oran', nif: '123' }, note: 'Paie en fin de mois' })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lu = (await chez(A, (trx) => lireClient(trx, r.id)))!;
    expect(lu).toMatchObject({ nom: 'Karim', telephone: tel, details: { adresse: 'Oran', nif: '123' }, note: 'Paie en fin de mois' });
    const brut = await chez(A, (trx) => trx.selectFrom('clients').select('note_chiffre').where('id', '=', r.id).executeTakeFirstOrThrow());
    expect(brut.note_chiffre).not.toContain('fin de mois');
    // Même numéro : refusé chez A, accepté chez B (chaque commerçant a ses clients).
    expect(await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, null, fiche({ telephone: tel })))).toEqual({ ok: false, raison: 'client_existe' });
    expect((await chez(B, (trx) => enregistrerFiche(trx, B.commercantId, null, fiche({ telephone: tel })))).ok).toBe(true);
    // B ne peut pas modifier un client de A.
    expect(await chez(B, (trx) => enregistrerFiche(trx, B.commercantId, r.id, fiche()))).toEqual({ ok: false, raison: 'introuvable' });
    // Correction : nom changé, note effacée.
    expect((await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, r.id, fiche({ nom: 'Karim B.', telephone: tel, details: { adresse: 'Oran' } })))).ok).toBe(true);
    expect(await chez(A, (trx) => lireClient(trx, r.id))).toMatchObject({ nom: 'Karim B.', note: '', details: { adresse: 'Oran' } });
    expect(await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, null, fiche({ telephone: '12' })))).toEqual({ ok: false, raison: 'telephone_invalide' });
    expect(await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, null, fiche({ nom: '  ' })))).toEqual({ ok: false, raison: 'champ_requis' });
    // Suppression des données (loi 18-07) : la note part aussi ; la fiche n'est plus modifiable.
    await chez(A, (trx) => supprimerDonneesClient(trx, r.id));
    expect(await chez(A, (trx) => lireClient(trx, r.id))).toMatchObject({ nom: '—', note: '', telephone: null, details: {} });
    expect(await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, r.id, fiche()))).toEqual({ ok: false, raison: 'introuvable' });
  });

  it('une vente sans adresse ne vide pas la fiche ; les achats sont comptés à part des commandes', async () => {
    const tel = telephone();
    const r = await chez(A, (trx) => enregistrerFiche(trx, A.commercantId, null, fiche({ nom: 'Hôtel', telephone: tel, details: { adresse: 'Alger', rc: 'RC-1' }, note: 'Lundi' })));
    if (!r.ok) throw new Error(r.raison);
    const f = await chez(A, (trx) => creerDocument(trx, A, { type: 'facture', origine: 'manuel', lignes: [{ varianteId: null, designation: 'Eau', quantite: 1, prixUnitaire: 500_00 }], acheteur: { nom: 'Hôtel', telephone: tel }, prixLibres: true, payeEnEspeces: true, modeVente: 'directe' }));
    expect(f.ok).toBe(true);
    expect(await chez(A, (trx) => lireClient(trx, r.id))).toMatchObject({ details: { adresse: 'Alger', rc: 'RC-1' }, note: 'Lundi', achats: 1 });
    const liste = await chez(A, (trx) => listerClients(trx, { recherche: tel, limite: 5 }));
    expect(liste).toMatchObject([{ id: r.id, achats: 1, commandes: 0 }]);
  });
});

describe('facture écrite à la main', () => {
  it('vente directe payée par un autre moyen que les espèces, stock sorti ; envoi : stock réservé', async () => {
    const p = await chez(A, (trx) => creerProduit(trx, A, { nomFr: 'Huile', nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: 900_00, prixVente: 1_200_00, seuil: 0, stockInitial: 10 }] }));
    if (!p.ok) throw new Error(p.raison);
    const v = (await chez(A, (trx) => lireProduit(trx, p.id)))!.variantes[0]!.id;
    const acheteur = { nom: 'SARL Atlas', telephone: telephone() };
    const d = await chez(A, (trx) => creerDocument(trx, A, { type: 'facture', origine: 'manuel', lignes: [{ varianteId: v, designation: 'Huile', quantite: 2, prixUnitaire: 1_100_00 }], acheteur, prixLibres: true, modeVente: 'directe', stock: 'vente', payeAvec: { mode: 'virement', reference: 'VIR-9' } }));
    if (!d.ok) throw new Error(d.raison);
    const doc = (await chez(A, (trx) => lireDocument(trx, d.id)))!;
    expect(doc.payeLe).not.toBeNull();
    expect(doc.timbre).toBe(0); // pas d'espèces : pas de timbre
    expect(doc.solde).toMatchObject({ net: 2_200_00, paye: 2_200_00, reste: 0 });
    const envoi = await chez(A, (trx) => creerDocument(trx, A, { type: 'facture', origine: 'manuel', lignes: [{ varianteId: v, designation: 'Huile', quantite: 3, prixUnitaire: 1_200_00 }], acheteur, prixLibres: true, modeVente: 'envoi', stock: 'reserver' }));
    expect(envoi.ok).toBe(true);
    const k = await chez(A, (trx) => trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', v).executeTakeFirstOrThrow());
    expect(k).toEqual({ quantite: 8, reservee: 3 });
  });
});
