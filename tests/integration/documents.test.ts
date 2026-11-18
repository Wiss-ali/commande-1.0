// Caisse, factures et documents : règles prouvées contre une vraie base.
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import {
  changerEtatDevis, cloturerCaisse, creerAvoir, creerDocument, encaisserFacture, fixerFondCaisse, caisseOuverte, lireDocument, listerDocuments, listerEcarts,
  modifierDevis, numeroTexte, resumeCaisse, traiterEcart, transformer, vendreEnCaisse,
} from '../../src/lib/documents.ts';
import { oublierReglages } from '../../src/lib/reglages-plateforme.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, sqlProprietaire } from '../outils.ts';

let A: Contexte, B: Contexte;
let cafe: string, the: string;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const cle = () => crypto.randomUUID();
const stock = async (c: Contexte, varianteId: string) => (await chez(c, (trx) => trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', varianteId).executeTakeFirstOrThrow()));

async function article(c: Contexte, nom: string, prixVente: number, stockInitial: number, prixAchat = 0) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat, prixVente, seuil: 0, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}
const reglages = (c: Contexte, r: object) => chez(c, (trx) => trx.updateTable('commercants').set({ reglages_documents: JSON.stringify(r) }).execute());

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Docs A');
  const b = await creerCommercant(admin.id, 'Docs B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
  cafe = await article(A, 'Café', 25_000, 10, 18_000);
  the = await article(A, 'Thé', 12_000, 2, 8_000);
});
afterAll(fermerBD);

describe('vente en caisse', () => {
  it('écrit le ticket, ses lignes et la sortie de stock ensemble, et ouvre la caisse', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 2 }, { varianteId: the, quantite: 1 }], cle: cle() }));
    expect(r).toMatchObject({ ok: true, manques: 0 });
    if (!r.ok) return;
    const d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ type: 'ticket', numero: 1, total: 62_000, totalTva: 0, timbre: 0, modePaiement: 'especes', origine: 'caisse', modeVente: 'directe', acheteur: null });
    expect(d.payeLe).toBeInstanceOf(Date);
    expect(d.vendeur).toMatchObject({ nom: 'Docs A', nif: 'NIF-Docs A' });
    expect(d.lignes.map((l) => [l.designation, l.quantite, l.prixUnitaire, l.totalTtc])).toEqual([['Café', 2, 25_000, 50_000], ['Thé', 1, 12_000, 12_000]]);
    expect(numeroTexte(d)).toMatch(/^TK-\d{4}-00001$/);
    expect(await stock(A, cafe)).toEqual({ quantite: 8, reservee: 0 });
    const m = await chez(A, (trx) => trx.selectFrom('mouvements_stock').select(['type', 'quantite']).where('document_id', '=', r.id).orderBy('quantite').execute());
    expect(m).toEqual([{ type: 'vente', quantite: -2 }, { type: 'vente', quantite: -1 }]);
    // Le prix d'achat du moment est gardé sur la ligne, pour la marge.
    const couts = await chez(A, (trx) => trx.selectFrom('lignes_document').select('cout_unitaire').where('document_id', '=', r.id).orderBy('ordre').execute());
    expect(couts.map((c) => c.cout_unitaire)).toEqual(['18000', '8000']);
  });

  it('le prix vient toujours de la fiche, jamais du téléphone ; un panier faux est refusé sans rien écrire', async () => {
    const avant = await stock(A, cafe);
    const triche = await chez(A, (trx) => creerDocument(trx, A, { type: 'ticket', origine: 'caisse', lignes: [{ varianteId: cafe, quantite: 1, prixUnitaire: 1 }], payeEnEspeces: true, stock: 'vente', cle: cle() }));
    expect(triche.ok && (await chez(A, (trx) => lireDocument(trx, triche.id)))!.total).toBe(25_000);
    for (const [lignes, raison] of [
      [[], 'panier_vide'], [[{ varianteId: cafe, quantite: 0 }], 'quantite_invalide'], [[{ varianteId: cafe, quantite: 1.5 }], 'quantite_invalide'],
      [[{ varianteId: crypto.randomUUID(), quantite: 1 }], 'introuvable'],
    ] as const) {
      expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [...lignes], cle: cle() }))).toEqual({ ok: false, raison });
    }
    expect((await stock(A, cafe)).quantite).toBe(avant.quantite - 1);
  });

  it('une vente passe même si le stock connu manque : il sort jusqu\'à zéro et le manque est noté à vérifier', async () => {
    const rare = await article(A, 'Rare', 5_000, 1);
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: rare, quantite: 3 }], cle: cle() }));
    expect(r).toMatchObject({ ok: true, manques: 1 });
    expect(await stock(A, rare)).toEqual({ quantite: 0, reservee: 0 });
    const ecarts = await chez(A, listerEcarts);
    expect(ecarts.map((e) => [e.nom_fr, e.quantite, e.type])).toEqual([['Rare', 2, 'ticket']]);
    await chez(A, (trx) => traiterEcart(trx, A, ecarts[0]!.id));
    expect(await chez(A, listerEcarts)).toEqual([]);
  });

  it('la même clé ne crée jamais deux ventes (double toucher, renvoi après coupure)', async () => {
    const k = cle();
    const avant = (await stock(A, cafe)).quantite;
    const envois = await Promise.allSettled([1, 2, 3].map(() => chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], cle: k }))));
    const reussis = envois.flatMap((e) => (e.status === 'fulfilled' && e.value.ok ? [e.value] : []));
    expect(reussis.length).toBeGreaterThanOrEqual(1);
    expect(new Set(reussis.map((r) => r.id)).size).toBe(1);
    const encore = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], cle: k }));
    expect(encore).toMatchObject({ ok: true, doublon: true, id: reussis[0]!.id });
    expect((await stock(A, cafe)).quantite).toBe(avant - 1);
  });
});

describe('numérotation', () => {
  it('est continue, sans trou, même quand des ventes échouent ou arrivent en même temps', async () => {
    const c = await creerCommercant((await creerAdmin()).id, 'Docs N');
    const N: Contexte = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
    const v = await article(N, 'Article', 1_000, 1000);
    // Vente qui échoue en cours de route : le numéro pris est rendu avec le reste de la transaction.
    await expect(chez(N, async (trx) => {
      await vendreEnCaisse(trx, N, { lignes: [{ varianteId: v, quantite: 1 }], cle: cle() });
      throw new Error('panne');
    })).rejects.toThrow('panne');
    await Promise.all(Array.from({ length: 12 }, () => chez(N, (trx) => vendreEnCaisse(trx, N, { lignes: [{ varianteId: v, quantite: 1 }], cle: cle() }))));
    const numeros = (await chez(N, (trx) => listerDocuments(trx, { types: ['ticket'], limite: 50 }))).map((d) => d.numero).sort((x, y) => x - y);
    expect(numeros).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect((await stock(N, v)).quantite).toBe(988);
    // Chaque type a sa propre suite ; chaque commerçant aussi.
    const f = await chez(N, (trx) => vendreEnCaisse(trx, N, { lignes: [{ varianteId: v, quantite: 1 }], facture: true, acheteur: { nom: 'Client' }, cle: cle() }));
    expect(f.ok && (await chez(N, (trx) => lireDocument(trx, f.id)))!.numero).toBe(1);
  });
});

describe('factures', () => {
  it('exige un acheteur, fige les mentions du vendeur et chiffre les données personnelles', async () => {
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, cle: cle() }))).toEqual({ ok: false, raison: 'client_requis' });
    expect(await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'X', telephone: '123' }, cle: cle() }))).toEqual({ ok: false, raison: 'telephone_invalide' });
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'Sarl Atlas', telephone: '0550 99 88 77', nif: '001234', adresse: 'Oran' }, cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    // Le commerçant change de nom après coup : la facture garde l'ancien.
    await chez(A, (trx) => trx.updateTable('commercants').set({ nom: 'Docs A renommé' }).execute());
    const d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d.vendeur.nom).toBe('Docs A');
    expect(d.acheteur).toEqual({ nom: 'Sarl Atlas', telephone: '0550998877', nif: '001234', adresse: 'Oran' });
    await chez(A, (trx) => trx.updateTable('commercants').set({ nom: 'Docs A' }).execute());
    // En base : ni le téléphone, ni le NIF, ni l'adresse en clair.
    await sqlProprietaire('ALTER TABLE documents NO FORCE ROW LEVEL SECURITY; ALTER TABLE clients NO FORCE ROW LEVEL SECURITY');
    try {
      const brut = await sqlProprietaire<{ t: string }>(`SELECT d.acheteur_chiffre || d.vendeur_chiffre || c.telephone_chiffre || c.details_chiffre || c.telephone_hmac AS t FROM documents d JOIN clients c ON c.id = d.client_id WHERE d.id = $1`, [r.id]);
      for (const secret of ['0550998877', '001234', 'Oran', 'NIF-Docs A']) expect(brut.rows[0]!.t).not.toContain(secret);
    } finally {
      await sqlProprietaire('ALTER TABLE documents FORCE ROW LEVEL SECURITY; ALTER TABLE clients FORCE ROW LEVEL SECURITY');
    }
    // Le même téléphone retrouve le même client.
    const r2 = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'Atlas', telephone: '+213550998877' }, cle: cle() }));
    expect(r2.ok).toBe(true);
    expect(await chez(A, (trx) => trx.selectFrom('clients').select('nom').execute())).toEqual([{ nom: 'Atlas' }]);
  });

  it('calcule la TVA par produit à partir du prix TTC, et le timbre selon le barème de l\'administrateur', async () => {
    const c = await creerCommercant((await creerAdmin()).id, 'Docs T');
    const T: Contexte = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
    const normal = await article(T, 'Normal', 119_000, 10);
    const reduit = await article(T, 'Réduit', 10_900, 10);
    await chez(T, (trx) => trx.updateTable('produits').set({ taux_tva: 900 }).where('nom_fr', '=', 'Réduit').execute());
    await reglages(T, { assujettiTva: true, tauxDefaut: 1900, timbreFactures: true });
    const vendre = (facture: boolean) => chez(T, (trx) => vendreEnCaisse(trx, T, { lignes: [{ varianteId: normal, quantite: 2 }, { varianteId: reduit, quantite: 1 }], facture, acheteur: { nom: 'Client' }, cle: cle() }));
    // Barème vide : aucun timbre, même si le commerçant l'a activé.
    const sans = await vendre(true);
    expect(sans.ok && (await chez(T, (trx) => lireDocument(trx, sans.id)))).toMatchObject({ totalHt: 210_000, totalTva: 38_900, timbre: 0, total: 248_900 });
    await bd('plateforme').updateTable('reglages_plateforme').set({ valeur: JSON.stringify({ exonereJusqua: 30_000, tranches: [{ jusqua: 3_000_000, parCent: 100 }, { jusqua: null, parCent: 200 }], minimum: 500, plafond: null }) }).where('cle', '=', 'timbre').execute();
    oublierReglages();
    try {
      const avec = await vendre(true);
      const d = avec.ok ? (await chez(T, (trx) => lireDocument(trx, avec.id)))! : null;
      // 2 489 DA → 25 tranches de 100 DA commencées × 1 DA = 25 DA.
      expect(d).toMatchObject({ timbre: 2_500, total: 251_400 });
      expect(d!.lignes.map((l) => [l.tauxTva, l.totalHt])).toEqual([[1900, 200_000], [900, 10_000]]);
      // Le ticket n'a pas de timbre : le commerçant ne l'a activé que pour les factures.
      const ticket = await vendre(false);
      expect(ticket.ok && (await chez(T, (trx) => lireDocument(trx, ticket.id)))!.timbre).toBe(0);
    } finally {
      await bd('plateforme').updateTable('reglages_plateforme').set({ valeur: JSON.stringify({ tranches: [] }) }).where('cle', '=', 'timbre').execute();
      oublierReglages();
    }
  });

  it('une facture émise ne se modifie pas et ne se supprime pas, même directement en base', async () => {
    const r = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'Fixe' }, cle: cle() }));
    if (!r.ok) throw new Error(r.raison);
    for (const requete of [
      sql`UPDATE documents SET total = 1 WHERE id = ${r.id}`,
      sql`UPDATE documents SET numero = 999 WHERE id = ${r.id}`,
      sql`UPDATE documents SET emis_le = now() - interval '1 year' WHERE id = ${r.id}`,
      sql`UPDATE documents SET paye_le = NULL WHERE id = ${r.id}`,
      sql`UPDATE documents SET etat = 'refuse' WHERE id = ${r.id}`,
      sql`UPDATE lignes_document SET quantite = 99 WHERE document_id = ${r.id}`,
      sql`DELETE FROM lignes_document WHERE document_id = ${r.id}`,
      sql`INSERT INTO lignes_document (commercant_id, document_id, designation, quantite, prix_unitaire, total_ht, total_ttc) VALUES (${A.commercantId}, ${r.id}, 'Ajout', 1, 1, 1, 1)`,
    ]) {
      await expect(chez(A, (trx) => requete.execute(trx)), requete.compile(bd('app')).sql).rejects.toThrow(/document_fige|check constraint/);
    }
    await expect(chez(A, (trx) => sql`DELETE FROM documents WHERE id = ${r.id}`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chez(A, (trx) => sql`DELETE FROM liens_documents`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chez(A, (trx) => sql`UPDATE compteurs_documents SET dernier = 0`.execute(trx))).resolves.toBeDefined(); // le compteur reste sous le contrôle de l'application…
    await chez(A, (trx) => sql`UPDATE compteurs_documents SET dernier = (SELECT max(numero) FROM documents d WHERE d.type = compteurs_documents.type)`.execute(trx));
    // … mais un numéro ne peut jamais être réutilisé.
    await expect(chez(A, (trx) => sql`UPDATE compteurs_documents SET dernier = 0 WHERE type = 'facture'`.execute(trx).then(() => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'Y' }, cle: cle() })))).rejects.toThrow(/documents_commercant_id_type_annee_numero_key/);
  });

  it('se corrige par un avoir : numéro propre, lien, stock remis, espèces rendues ; une seule fois', async () => {
    const avant = (await stock(A, cafe)).quantite;
    const f = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 3 }], facture: true, acheteur: { nom: 'Retour' }, cle: cle() }));
    if (!f.ok) throw new Error(f.raison);
    const k = cle();
    const av = await chez(A, (trx) => creerAvoir(trx, A, f.id, { remettreEnStock: true, cle: k }));
    if (!av.ok) throw new Error(av.raison);
    expect(await chez(A, (trx) => creerAvoir(trx, A, f.id, { remettreEnStock: true, cle: k }))).toMatchObject({ ok: true, id: av.id });
    expect(await chez(A, (trx) => creerAvoir(trx, A, f.id, { remettreEnStock: true, cle: cle() }))).toEqual({ ok: false, raison: 'deja_annule' });
    const d = (await chez(A, (trx) => lireDocument(trx, av.id)))!;
    expect(d).toMatchObject({ type: 'avoir', total: -75_000, modePaiement: 'especes', acheteur: { nom: 'Retour' } });
    expect(d.liens).toEqual([expect.objectContaining({ id: f.id, type: 'facture', nature: 'corrige_par', sens: 'origine' })]);
    expect((await chez(A, (trx) => lireDocument(trx, f.id)))!.liens).toEqual([expect.objectContaining({ id: av.id, type: 'avoir', sens: 'suite' })]);
    expect((await stock(A, cafe)).quantite).toBe(avant);
    expect((await chez(A, (trx) => listerDocuments(trx, { types: ['facture'], limite: 50 }))).find((x) => x.id === f.id)!.annule).toBe(true);
    // Sans remise en stock (article cassé) : le stock ne revient pas.
    const t = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], cle: cle() }));
    if (!t.ok) throw new Error(t.raison);
    expect((await chez(A, (trx) => creerAvoir(trx, A, t.id, { remettreEnStock: false, cle: cle() }))).ok).toBe(true);
    expect((await stock(A, cafe)).quantite).toBe(avant - 1);
  });
});

describe('devis et chaîne des documents', () => {
  it('un devis a sa numérotation, se modifie tant qu\'il est en attente, ne touche pas au stock', async () => {
    const avant = await stock(A, cafe);
    const r = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: { nom: 'Prospect', telephone: '0661000001' }, lignes: [{ varianteId: cafe, quantite: 4, prixUnitaire: 24_000 }, { designation: 'Livraison', quantite: 1, prixUnitaire: 40_000 }] }));
    if (!r.ok) throw new Error(r.raison);
    let d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ type: 'devis', etat: 'en_attente', total: 136_000, payeLe: null, modePaiement: null });
    expect(d.valideJusqua).not.toBeNull();
    expect(numeroTexte(d)).toMatch(/^DV-\d{4}-00001$/);
    expect(await chez(A, (trx) => modifierDevis(trx, A, r.id, { lignes: [{ varianteId: cafe, quantite: 2, prixUnitaire: 24_000 }], acheteur: { nom: 'Prospect', telephone: '0661000001' }, note: 'Remise accordée' }))).toEqual({ ok: true });
    d = (await chez(A, (trx) => lireDocument(trx, r.id)))!;
    expect(d).toMatchObject({ total: 48_000, numero: 1, note: 'Remise accordée' });
    expect(await stock(A, cafe)).toEqual(avant);
    expect(await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, lignes: [{ designation: '', quantite: 1, prixUnitaire: 1 }] }))).toEqual({ ok: false, raison: 'designation_requise' });

    // Refusé, puis rouvert.
    expect(await chez(A, (trx) => changerEtatDevis(trx, A, r.id, 'refuse'))).toEqual({ ok: true });
    expect(await chez(A, (trx) => modifierDevis(trx, A, r.id, { lignes: [{ varianteId: cafe, quantite: 1 }] }))).toEqual({ ok: false, raison: 'devis_non_modifiable' });
    expect(await chez(A, (trx) => transformer(trx, A, r.id, 'facture', { mode: 'directe', cle: cle() }))).toEqual({ ok: false, raison: 'deja_transforme' });
    expect(await chez(A, (trx) => changerEtatDevis(trx, A, r.id, 'en_attente'))).toEqual({ ok: true });

    // « Transformer en facture », vente directe : stock sorti, payée, devis marqué transformé, lien dans les deux sens.
    const k = cle();
    const f = await chez(A, (trx) => transformer(trx, A, r.id, 'facture', { mode: 'directe', cle: k }));
    if (!f.ok) throw new Error(f.raison);
    expect(await chez(A, (trx) => transformer(trx, A, r.id, 'facture', { mode: 'directe', cle: k }))).toMatchObject({ ok: true, id: f.id });
    expect(await chez(A, (trx) => transformer(trx, A, r.id, 'facture', { mode: 'directe', cle: cle() }))).toEqual({ ok: false, raison: 'deja_transforme' });
    const facture = (await chez(A, (trx) => lireDocument(trx, f.id)))!;
    expect(facture).toMatchObject({ type: 'facture', total: 48_000, modeVente: 'directe', modePaiement: 'especes', acheteur: { nom: 'Prospect' } });
    expect(facture.lignes[0]).toMatchObject({ prixUnitaire: 24_000, quantite: 2 }); // le prix négocié du devis, pas celui de la fiche
    expect(facture.liens).toEqual([expect.objectContaining({ id: r.id, type: 'devis', nature: 'transforme_en', sens: 'origine' })]);
    expect((await chez(A, (trx) => lireDocument(trx, r.id)))!.etat).toBe('transforme');
    expect((await stock(A, cafe)).quantite).toBe(avant.quantite - 2);
    await expect(chez(A, (trx) => sql`UPDATE lignes_document SET quantite = 9 WHERE document_id = ${r.id}`.execute(trx))).rejects.toThrow(/document_fige/);
  });

  it('« Envoi » réserve le stock et laisse la facture à payer ; l\'encaissement crée le reçu', async () => {
    const colis = await article(A, 'Colis', 30_000, 5);
    const dv = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: { nom: 'Loin' }, lignes: [{ varianteId: colis, quantite: 2 }] }));
    if (!dv.ok) throw new Error(dv.raison);
    const f = await chez(A, (trx) => transformer(trx, A, dv.id, 'facture', { mode: 'envoi', cle: cle() }));
    if (!f.ok) throw new Error(f.raison);
    expect(await stock(A, colis)).toEqual({ quantite: 5, reservee: 2 });
    expect((await chez(A, (trx) => lireDocument(trx, f.id)))!).toMatchObject({ modeVente: 'envoi', modePaiement: 'a_la_livraison', payeLe: null });
    // Pas assez de stock libre pour un second envoi : refusé, rien n'est écrit.
    const dv2 = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: { nom: 'Trop' }, lignes: [{ varianteId: colis, quantite: 4 }] }));
    if (!dv2.ok) throw new Error(dv2.raison);
    expect(await chez(A, (trx) => transformer(trx, A, dv2.id, 'facture', { mode: 'envoi', cle: cle() }))).toEqual({ ok: false, raison: 'stock_insuffisant' });
    expect((await chez(A, (trx) => lireDocument(trx, dv2.id)))!.etat).toBe('en_attente');

    const k = cle();
    const recu = await chez(A, (trx) => encaisserFacture(trx, A, f.id, k));
    if (!recu.ok) throw new Error(recu.raison);
    expect(await chez(A, (trx) => encaisserFacture(trx, A, f.id, k))).toEqual({ ok: true, id: recu.id });
    expect(await chez(A, (trx) => encaisserFacture(trx, A, f.id, cle()))).toEqual({ ok: false, raison: 'deja_paye' });
    expect((await chez(A, (trx) => lireDocument(trx, recu.id)))!).toMatchObject({ type: 'recu', total: 60_000, modePaiement: 'especes', lignes: [] });
    expect((await chez(A, (trx) => lireDocument(trx, f.id)))!.payeLe).toBeInstanceOf(Date);
    // Annuler la facture d'envoi libère la réservation.
    expect((await chez(A, (trx) => creerAvoir(trx, A, f.id, { remettreEnStock: true, cle: cle() }))).ok).toBe(true);
    expect(await stock(A, colis)).toEqual({ quantite: 5, reservee: 0 });
  });

  it('devis → proforma → bon de livraison → facture : le stock ne sort qu\'une fois', async () => {
    const lot = await article(A, 'Lot', 10_000, 20);
    const dv = await chez(A, (trx) => creerDocument(trx, A, { type: 'devis', origine: 'manuel', prixLibres: true, acheteur: { nom: 'Chaîne' }, lignes: [{ varianteId: lot, quantite: 5 }] }));
    if (!dv.ok) throw new Error(dv.raison);
    const pf = await chez(A, (trx) => transformer(trx, A, dv.id, 'proforma', { cle: cle() }));
    if (!pf.ok) throw new Error(pf.raison);
    expect((await stock(A, lot)).quantite).toBe(20); // une proforma ne touche ni au stock ni au chiffre d'affaires
    expect(await chez(A, (trx) => transformer(trx, A, pf.id, 'devis', { cle: cle() }))).toEqual({ ok: false, raison: 'transformation_impossible' });
    const bl = await chez(A, (trx) => transformer(trx, A, pf.id, 'bon_livraison', { cle: cle() }));
    if (!bl.ok) throw new Error(bl.raison);
    expect((await stock(A, lot)).quantite).toBe(15);
    const fa = await chez(A, (trx) => transformer(trx, A, bl.id, 'facture', { mode: 'directe', cle: cle() }));
    if (!fa.ok) throw new Error(fa.raison);
    expect((await stock(A, lot)).quantite).toBe(15);
    const facture = (await chez(A, (trx) => lireDocument(trx, fa.id)))!;
    expect(facture.liens.map((l) => [l.type, l.sens])).toEqual([['bon_livraison', 'origine']]);
    // L'avoir de cette facture remet le stock sorti par le bon de livraison.
    expect((await chez(A, (trx) => creerAvoir(trx, A, fa.id, { remettreEnStock: true, cle: cle() }))).ok).toBe(true);
    expect((await stock(A, lot)).quantite).toBe(20);
  });
});

describe('clôture de caisse', () => {
  it('compte le fond, les ventes en espèces et les remboursements, garde l\'écart, puis se fige', async () => {
    const c = await creerCommercant((await creerAdmin()).id, 'Docs C');
    const C: Contexte = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
    const v = await article(C, 'Pain', 2_000, 100);
    expect(await chez(C, (trx) => cloturerCaisse(trx, C, { comptees: 0 }))).toEqual({ ok: false, raison: 'caisse_fermee' });
    expect((await chez(C, (trx) => fixerFondCaisse(trx, C, 500_000))).ok).toBe(true);
    const vente = (n: number) => chez(C, (trx) => vendreEnCaisse(trx, C, { lignes: [{ varianteId: v, quantite: n }], cle: cle() }));
    await vente(5);
    const t = await vente(3);
    if (!t.ok) throw new Error(t.raison);
    await chez(C, (trx) => creerAvoir(trx, C, t.id, { remettreEnStock: true, cle: cle() }));
    // Un devis ou une facture « envoi » n'entre pas dans la caisse.
    await chez(C, (trx) => creerDocument(trx, C, { type: 'devis', origine: 'manuel', prixLibres: true, lignes: [{ varianteId: v, quantite: 50 }] }));
    const id = (await chez(C, (trx) => caisseOuverte(trx, C, false)))!;
    expect(await chez(C, (trx) => resumeCaisse(trx, id))).toMatchObject({ fond: 500_000, ventes: 2, especes: 16_000, remboursements: 6_000, fermeeLe: null });
    expect(await chez(C, (trx) => cloturerCaisse(trx, C, { comptees: 509_000, note: 'manque 10 DA' }))).toEqual({ ok: true, id, ecart: -1_000 });
    expect(await chez(C, (trx) => resumeCaisse(trx, id))).toMatchObject({ attendues: 510_000, comptees: 509_000, note: 'manque 10 DA' });
    await expect(chez(C, (trx) => sql`UPDATE sessions_caisse SET especes_comptees = 510000`.execute(trx))).rejects.toThrow(/caisse_cloturee/);
    // La vente suivante ouvre une nouvelle journée.
    await vente(1);
    expect(await chez(C, (trx) => caisseOuverte(trx, C, false))).not.toBe(id);
  });
});

describe('isolation', () => {
  it('un commerçant ne lit, ne transforme et n\'annule aucun document d\'un autre', async () => {
    const f = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: cafe, quantite: 1 }], facture: true, acheteur: { nom: 'Privé', telephone: '0550000042' }, cle: cle() }));
    if (!f.ok) throw new Error(f.raison);
    expect(await chez(B, (trx) => lireDocument(trx, f.id))).toBeNull();
    expect(await chez(B, (trx) => listerDocuments(trx, { types: ['facture', 'ticket', 'devis'], limite: 10 }))).toEqual([]);
    expect(await chez(B, (trx) => creerAvoir(trx, B, f.id, { remettreEnStock: true, cle: cle() }))).toEqual({ ok: false, raison: 'introuvable' });
    expect(await chez(B, (trx) => encaisserFacture(trx, B, f.id, cle()))).toEqual({ ok: false, raison: 'introuvable' });
    expect(await chez(B, (trx) => vendreEnCaisse(trx, B, { lignes: [{ varianteId: cafe, quantite: 1 }], cle: cle() }))).toEqual({ ok: false, raison: 'introuvable' });
    expect(await chez(B, (trx) => trx.selectFrom('clients').select('id').execute())).toEqual([]);
    await expect(chez(B, (trx) => sql`INSERT INTO liens_documents (commercant_id, source_id, cible_id, nature) VALUES (${B.commercantId}, ${f.id}, ${f.id}, 'corrige_par')`.execute(trx))).rejects.toThrow(/foreign key/);
  });
});
