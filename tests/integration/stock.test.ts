// Produits, mouvements de stock et inventaire : règles prouvées contre une vraie base.
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import {
  ajouterMouvement, annulerInventaire, archiverProduit, chercherArticles, chercherParCode, compter, creerProduit, lignesInventaire, lireProduit,
  listerMouvements, listerProduits, modifierProduit, ouvrirInventaire, resumeStock, trouverOuCreerCategorie, validerInventaire, type Contexte, type SaisieProduit,
} from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant } from '../outils.ts';

let A: Contexte, B: Contexte;
const chezA = <T>(fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(A.commercantId, fn);

const simple = (nom: string, plus: Partial<SaisieProduit['variantes'][number]> = {}): SaisieProduit => ({
  nomFr: nom, nomAr: '', categorieId: null,
  variantes: [{ libelle: '', codeBarres: null, prixAchat: 10_000, prixVente: 15_000, seuil: 0, ...plus }],
});
async function creer(saisie: SaisieProduit, ctx = A) {
  const r = await avecCommercant(ctx.commercantId, (trx) => creerProduit(trx, ctx, saisie));
  if (!r.ok) throw new Error(r.raison);
  const fiche = await avecCommercant(ctx.commercantId, (trx) => lireProduit(trx, r.id));
  return fiche!;
}

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Stock A');
  const b = await creerCommercant(admin.id, 'Stock B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
});
afterAll(fermerBD);

describe('fiche produit', () => {
  it('crée un produit simple avec son stock initial et son premier mouvement', async () => {
    const p = await creer(simple('Café 250 g', { codeBarres: '6130000000019', stockInitial: 12, seuil: 5 }));
    expect(p.variantes).toHaveLength(1);
    expect(p.variantes[0]).toMatchObject({ libelle: '', code_barres: '6130000000019', prix_vente: '15000', quantite: 12, reservee: 0, seuil_alerte: 5 });
    const m = await chezA((trx) => listerMouvements(trx, { produitId: p.id, limite: 10 }));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ type: 'entree', quantite: 12, stock_apres: 12, motif: 'stock_initial', auteur: 'Propriétaire Stock A' });
  });

  it('crée des variantes, chacune avec son stock et son code', async () => {
    const p = await creer({
      nomFr: 'T-shirt', nomAr: 'قميص', categorieId: null,
      variantes: [
        { libelle: 'M', codeBarres: 'TS-M', prixAchat: 50_000, prixVente: 90_000, seuil: 2, stockInitial: 3 },
        { libelle: 'L', codeBarres: 'TS-L', prixAchat: 50_000, prixVente: 95_000, seuil: 2, stockInitial: 0 },
      ],
    });
    expect(p.variantes.map((v) => [v.libelle, v.quantite])).toEqual([['M', 3], ['L', 0]]);
    const trouve = await chezA((trx) => chercherParCode(trx, ' ts-l '.toUpperCase()));
    expect(trouve).toMatchObject({ produit_id: p.id, libelle: 'L', nom_ar: 'قميص' });
  });

  it('refuse une fiche incomplète ou incohérente, sans rien écrire', async () => {
    const essai = (s: SaisieProduit) => chezA((trx) => creerProduit(trx, A, s));
    expect(await essai(simple('  '))).toEqual({ ok: false, raison: 'nom_requis' });
    expect(await essai(simple('X', { prixVente: -1 }))).toEqual({ ok: false, raison: 'montant_invalide' });
    expect(await essai(simple('X', { prixVente: 1.5 }))).toEqual({ ok: false, raison: 'montant_invalide' });
    expect(await essai(simple('X', { stockInitial: -3 }))).toEqual({ ok: false, raison: 'quantite_invalide' });
    expect(await essai(simple('X', { codeBarres: 'é è' }))).toEqual({ ok: false, raison: 'code_barres_invalide' });
    const deux = simple('X');
    deux.variantes.push({ ...deux.variantes[0]! });
    expect(await essai(deux)).toEqual({ ok: false, raison: 'variante_libelle' });
    deux.variantes[0]!.libelle = 'Rouge';
    deux.variantes[1]!.libelle = 'rouge';
    expect(await essai(deux)).toEqual({ ok: false, raison: 'variante_double' });
    deux.variantes[1]!.libelle = 'Bleu';
    deux.variantes[0]!.codeBarres = deux.variantes[1]!.codeBarres = 'MEME';
    expect(await essai(deux)).toEqual({ ok: false, raison: 'code_barres_double' });
    expect(await chezA((trx) => chercherArticles(trx, 'X'))).toEqual([]);
  });

  it('un code-barres ne sert qu\'à un article chez un commerçant, mais reste libre chez un autre', async () => {
    await creer(simple('Savon', { codeBarres: '3017620422003' }));
    expect(await chezA((trx) => creerProduit(trx, A, simple('Autre savon', { codeBarres: '3017620422003' })))).toEqual({ ok: false, raison: 'code_barres_pris' });
    // Un UPC-A à 12 chiffres et l'EAN-13 qui commence par 0 désignent le même article.
    await creer(simple('Importé', { codeBarres: '036000291452' }));
    expect(await chezA((trx) => chercherParCode(trx, '0036000291452'))).toMatchObject({ nom_fr: 'Importé' });
    expect(await chezA((trx) => creerProduit(trx, A, simple('Doublon', { codeBarres: '0036000291452' })))).toEqual({ ok: false, raison: 'code_barres_pris' });
    const chezB = await creer(simple('Savon de B', { codeBarres: '3017620422003' }), B);
    expect(chezB.variantes[0]!.code_barres).toBe('3017620422003');
    // La base elle-même refuse le doublon, même si l'application oubliait de vérifier.
    await expect(chezA((trx) => sql`UPDATE variantes SET code_barres = '3017620422003' WHERE code_barres = '0036000291452'`.execute(trx))).rejects.toThrow(/variantes_code_unique/);
  });

  it('modifie la fiche, ajoute et retire des variantes, sans toucher aux quantités', async () => {
    const p = await creer(simple('Chaussure', { codeBarres: 'CH-1', stockInitial: 4 }));
    const v0 = p.variantes[0]!;
    const r = await chezA((trx) => modifierProduit(trx, A, p.id, {
      nomFr: 'Chaussure de ville', nomAr: 'حذاء', categorieId: null,
      variantes: [
        { id: v0.id, libelle: '42', codeBarres: 'CH-42', prixAchat: 300_000, prixVente: 500_000, seuil: 1, stockInitial: 99 },
        { libelle: '43', codeBarres: 'CH-1', prixAchat: 300_000, prixVente: 500_000, seuil: 1, stockInitial: 2 },
      ],
    }));
    expect(r).toEqual({ ok: true });
    const apres = (await chezA((trx) => lireProduit(trx, p.id)))!;
    expect(apres.nom_ar).toBe('حذاء');
    // La quantité de la variante existante n'a pas bougé : « stockInitial » ne vaut que pour une nouvelle variante.
    expect(apres.variantes.map((v) => [v.libelle, v.code_barres, v.quantite])).toEqual([['42', 'CH-42', 4], ['43', 'CH-1', 2]]);

    // Retirer une variante qui a du stock est refusé ; une fois vide, elle est archivée et son code libéré.
    const garder43 = { nomFr: 'Chaussure de ville', nomAr: 'حذاء', categorieId: null, variantes: [{ id: apres.variantes[1]!.id, libelle: '43', codeBarres: 'CH-1', prixAchat: 300_000, prixVente: 500_000, seuil: 1 }] };
    expect(await chezA((trx) => modifierProduit(trx, A, p.id, garder43))).toEqual({ ok: false, raison: 'variante_avec_stock' });
    await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v0.id, type: 'correction', quantite: -4, motif: 'erreur' }));
    expect(await chezA((trx) => modifierProduit(trx, A, p.id, garder43))).toEqual({ ok: true });
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes.map((v) => v.libelle)).toEqual(['43']);
    expect(await chezA((trx) => chercherParCode(trx, 'CH-42'))).toBeNull();
    // L'historique de la variante archivée reste lisible.
    expect((await chezA((trx) => listerMouvements(trx, { produitId: p.id, limite: 10 }))).length).toBe(3);
  });

  it('archive un produit sans rien supprimer, libère son code, puis le rétablit', async () => {
    const p = await creer(simple('Ancien modèle', { codeBarres: 'ANCIEN', stockInitial: 2 }));
    expect(await chezA((trx) => archiverProduit(trx, p.id, true))).toEqual({ ok: true });
    expect(await chezA((trx) => chercherParCode(trx, 'ANCIEN'))).toBeNull();
    expect((await chezA((trx) => listerProduits(trx, { langue: 'fr', limite: 100 }))).map((l) => l.nom_fr)).not.toContain('Ancien modèle');
    const archives = await chezA((trx) => listerProduits(trx, { filtre: 'archives', langue: 'fr', limite: 100 }));
    expect(archives.map((l) => [l.nom_fr, l.stock, l.archive])).toEqual([['Ancien modèle', 2, true]]);
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes).toHaveLength(1);

    const remplacant = await creer(simple('Nouveau modèle', { codeBarres: 'ANCIEN' }));
    expect(await chezA((trx) => archiverProduit(trx, p.id, false))).toEqual({ ok: false, raison: 'code_barres_pris' });
    await chezA((trx) => archiverProduit(trx, remplacant.id, true));
    expect(await chezA((trx) => archiverProduit(trx, p.id, false))).toEqual({ ok: true });
    expect(await chezA((trx) => chercherParCode(trx, 'ANCIEN'))).toMatchObject({ nom_fr: 'Ancien modèle', quantite: 2 });
  });
});

describe('mouvements de stock', () => {
  it('chaque mouvement change le stock et garde son auteur, son motif et le stock obtenu', async () => {
    const p = await creer(simple('Thé', { stockInitial: 10 }));
    const v = p.variantes[0]!.id;
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'entree', quantite: 5, motif: 'achat', coutUnitaire: 12_000 }))).toBe('ok');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'correction', quantite: -2, motif: 'casse', note: 'tombé du rayon' }))).toBe('ok');
    const m = await chezA((trx) => listerMouvements(trx, { produitId: p.id, limite: 10 }));
    expect(m.map((x) => [x.type, x.quantite, x.stock_apres, x.motif])).toEqual([
      ['correction', -2, 13, 'casse'], ['entree', 5, 15, 'achat'], ['entree', 10, 10, 'stock_initial'],
    ]);
    expect(m[0]!.note).toBe('tombé du rayon');
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]!.quantite).toBe(13);
  });

  it('le stock ne passe jamais sous zéro, ni par l\'application ni directement en base', async () => {
    const p = await creer(simple('Sucre', { stockInitial: 3 }));
    const v = p.variantes[0]!.id;
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'vente', quantite: -4 }))).toBe('stock_insuffisant');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'vente', quantite: 0 }))).toBe('quantite_invalide');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'vente', quantite: 1.5 }))).toBe('quantite_invalide');
    // Sans passer par le contrôle de l'application : la contrainte de la base refuse, et rien n'est écrit.
    await expect(chezA((trx) =>
      trx.insertInto('mouvements_stock').values({ commercant_id: A.commercantId, variante_id: v, type: 'vente', quantite: -4, auteur_id: A.utilisateurId }).execute(),
    )).rejects.toThrow(/stock_insuffisant/);
    // Le signe doit correspondre au type.
    await expect(chezA((trx) =>
      trx.insertInto('mouvements_stock').values({ commercant_id: A.commercantId, variante_id: v, type: 'vente', quantite: 2, auteur_id: A.utilisateurId }).execute(),
    )).rejects.toThrow(/check constraint/);
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]!.quantite).toBe(3);
    expect((await chezA((trx) => listerMouvements(trx, { produitId: p.id, limite: 10 })))).toHaveLength(1);
  });

  it('le rôle de l\'application ne peut ni écrire le stock directement, ni modifier ou effacer un mouvement', async () => {
    await expect(chezA((trx) => sql`UPDATE stocks SET quantite = 999`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chezA((trx) => sql`INSERT INTO stocks (variante_id, commercant_id) VALUES (gen_random_uuid(), ${A.commercantId})`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chezA((trx) => sql`DELETE FROM stocks`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chezA((trx) => sql`UPDATE mouvements_stock SET quantite = 1`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chezA((trx) => sql`DELETE FROM mouvements_stock`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(chezA((trx) => sql`DELETE FROM produits`.execute(trx))).rejects.toThrow(/permission denied/);
  });

  it('un mouvement ne peut pas viser l\'article d\'un autre commerçant, ni porter l\'auteur d\'un autre', async () => {
    const deB = await creer(simple('Produit de B', { stockInitial: 5 }), B);
    const vB = deB.variantes[0]!.id;
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: vB, type: 'entree', quantite: 1 }))).toBe('introuvable');
    await expect(chezA((trx) =>
      trx.insertInto('mouvements_stock').values({ commercant_id: A.commercantId, variante_id: vB, type: 'entree', quantite: 1, auteur_id: A.utilisateurId }).execute(),
    )).rejects.toThrow(/stock_introuvable|foreign key/);
    const deA = await creer(simple('Produit de A'));
    await expect(chezA((trx) =>
      trx.insertInto('mouvements_stock').values({ commercant_id: A.commercantId, variante_id: deA.variantes[0]!.id, type: 'entree', quantite: 1, auteur_id: B.utilisateurId }).execute(),
    )).rejects.toThrow(/foreign key/);
    expect((await avecCommercant(B.commercantId, (trx) => lireProduit(trx, deB.id)))!.variantes[0]!.quantite).toBe(5);
    expect(await chezA((trx) => lireProduit(trx, deB.id))).toBeNull();
  });

  it('la même clé ne crée jamais deux mouvements (double toucher)', async () => {
    const p = await creer(simple('Lait', { stockInitial: 1 }));
    const v = p.variantes[0]!.id;
    const cle = crypto.randomUUID();
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'entree', quantite: 6, cle }))).toBe('ok');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'entree', quantite: 6, cle }))).toBe('doublon');
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]!.quantite).toBe(7);
    // Deux envois au même instant : la base n'en garde qu'un.
    const cle2 = crypto.randomUUID();
    const envois = await Promise.allSettled([1, 2, 3].map(() => chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'entree', quantite: 1, cle: cle2 }))));
    expect(envois.filter((e) => e.status === 'fulfilled' && e.value === 'ok')).toHaveLength(1);
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]!.quantite).toBe(8);
  });

  it('la réservation bloque du stock sans le sortir (prêt pour les commandes)', async () => {
    const p = await creer(simple('Montre', { stockInitial: 2 }));
    const v = p.variantes[0]!.id;
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'reservation', quantite: 2 }))).toBe('ok');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'reservation', quantite: 1 }))).toBe('stock_insuffisant');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'correction', quantite: -1, motif: 'perte' }))).toBe('stock_reserve');
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]).toMatchObject({ quantite: 2, reservee: 2 });
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'liberation', quantite: -2 }))).toBe('ok');
    expect(await chezA((trx) => ajouterMouvement(trx, A, { varianteId: v, type: 'liberation', quantite: -1 }))).toBe('stock_reserve');
    expect((await chezA((trx) => lireProduit(trx, p.id)))!.variantes[0]).toMatchObject({ quantite: 2, reservee: 0 });
  });
});

describe('liste, recherche et alertes', () => {
  it('filtre le stock bas et les ruptures, cherche par nom, variante ou code, et calcule le résumé', async () => {
    const c = await creerCommercant((await creerAdmin()).id, 'Stock C');
    const C: Contexte = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
    const chezC = <T>(fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(C.commercantId, fn);
    await creer(simple('Abricot sec', { stockInitial: 20, seuil: 5, prixAchat: 10_000 }), C);
    await creer(simple('Biscuit', { stockInitial: 3, seuil: 5, prixAchat: 20_000, codeBarres: '6130000000026' }), C);
    await creer(simple('Chocolat', { stockInitial: 0, seuil: 5 }), C);
    await creer({ nomFr: 'Datte', nomAr: 'تمر', categorieId: null, variantes: [
      { libelle: '500 g', codeBarres: null, prixAchat: 30_000, prixVente: 50_000, seuil: 0, stockInitial: 4 },
      { libelle: '1 kg', codeBarres: null, prixAchat: 60_000, prixVente: 90_000, seuil: 0, stockInitial: 0 },
    ] }, C);
    const noms = async (o: Partial<Parameters<typeof listerProduits>[1]>) => (await chezC((trx) => listerProduits(trx, { langue: 'fr', limite: 50, ...o }))).map((l) => l.nom_fr);
    expect(await noms({})).toEqual(['Abricot sec', 'Biscuit', 'Chocolat', 'Datte']);
    expect(await noms({ filtre: 'bas' })).toEqual(['Biscuit', 'Datte']); // Datte : une variante est à zéro
    expect(await noms({ filtre: 'rupture' })).toEqual(['Chocolat']);
    expect(await noms({ recherche: 'bisc' })).toEqual(['Biscuit']);
    expect(await noms({ recherche: 'تمر' })).toEqual(['Datte']);
    expect(await noms({ recherche: '1 kg' })).toEqual(['Datte']);
    expect(await noms({ recherche: '6130000000026' })).toEqual(['Biscuit']);
    expect(await noms({ recherche: '100%' })).toEqual([]); // les caractères spéciaux de recherche sont neutralisés
    expect(await noms({ limite: 2, decalage: 2 })).toEqual(['Chocolat', 'Datte']);
    const datte = (await chezC((trx) => listerProduits(trx, { recherche: 'Datte', langue: 'fr', limite: 5 })))[0]!;
    expect(datte).toMatchObject({ nb_variantes: 2, stock: 4, nb_rupture: 1, prix_min: '50000', prix_max: '90000' });
    // Valeur au prix d'achat : 20×100 + 3×200 + 4×300 = 3 800 DA.
    expect(await chezC(resumeStock)).toEqual({ produits: 4, bas: 2, rupture: 1, valeur: 380_000 });
    const cat = await chezC((trx) => trouverOuCreerCategorie(trx, C, 'Épicerie'));
    expect(await chezC((trx) => trouverOuCreerCategorie(trx, C, 'épicerie'))).toBe(cat);
  });
});

describe('inventaire', () => {
  it('compte par scan, montre les écarts, corrige le stock à la validation, puis se fige', async () => {
    const d = await creerCommercant((await creerAdmin()).id, 'Stock D');
    const D: Contexte = { commercantId: d.commercantId, utilisateurId: d.proprietaireId };
    const chezD = <T>(fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(D.commercantId, fn);
    const juste = (await creer(simple('Juste', { stockInitial: 5 }), D)).variantes[0]!.id;
    const manque = (await creer(simple('Manque', { stockInitial: 8 }), D)).variantes[0]!.id;
    const surplus = (await creer(simple('Surplus', { stockInitial: 1 }), D)).variantes[0]!.id;
    const oublie = (await creer(simple('Non compté', { stockInitial: 7 }), D)).variantes[0]!.id;

    const inv = await chezD((trx) => ouvrirInventaire(trx, D));
    expect(await chezD((trx) => ouvrirInventaire(trx, D))).toBe(inv); // un seul inventaire ouvert à la fois
    expect(await chezD((trx) => validerInventaire(trx, D, inv))).toEqual({ ok: false, raison: 'inventaire_vide' });
    for (let i = 0; i < 5; i++) await chezD((trx) => compter(trx, D, inv, juste, { ajouter: 1 }));
    expect(await chezD((trx) => compter(trx, D, inv, manque, { ajouter: 1 }))).toEqual({ ok: true, quantite: 1 });
    expect(await chezD((trx) => compter(trx, D, inv, manque, { fixer: 6 }))).toEqual({ ok: true, quantite: 6 });
    await chezD((trx) => compter(trx, D, inv, surplus, { fixer: 4 }));
    expect(await chezD((trx) => compter(trx, D, inv, surplus, { fixer: -1 }))).toEqual({ ok: false, raison: 'quantite_invalide' });
    expect(await chezD((trx) => compter(trx, D, inv, A.utilisateurId, { ajouter: 1 }))).toEqual({ ok: false, raison: 'introuvable' });

    const ecarts = Object.fromEntries((await chezD((trx) => lignesInventaire(trx, inv))).map((l) => [l.nom_fr, l.comptee - l.theorique]));
    expect(ecarts).toEqual({ Juste: 0, Manque: -2, Surplus: 3 });

    expect(await chezD((trx) => validerInventaire(trx, D, inv))).toEqual({ ok: true, corrections: 2 });
    const stock = async (v: string) => (await chezD((trx) => trx.selectFrom('stocks').select('quantite').where('variante_id', '=', v).executeTakeFirstOrThrow())).quantite;
    expect([await stock(juste), await stock(manque), await stock(surplus), await stock(oublie)]).toEqual([5, 6, 4, 7]);
    const corrections = await chezD((trx) => listerMouvements(trx, { type: 'correction', limite: 10 }));
    expect(corrections.map((m) => [m.nom_fr, m.quantite, m.motif]).sort()).toEqual([['Manque', -2, 'inventaire'], ['Surplus', 3, 'inventaire']]);

    // Terminé : plus rien ne bouge, même en écrivant directement dans la base.
    expect(await chezD((trx) => compter(trx, D, inv, juste, { ajouter: 1 }))).toEqual({ ok: false, raison: 'inventaire_termine' });
    expect(await chezD((trx) => validerInventaire(trx, D, inv))).toEqual({ ok: false, raison: 'inventaire_termine' });
    await expect(chezD((trx) => sql`UPDATE lignes_inventaire SET quantite_comptee = 0`.execute(trx))).rejects.toThrow(/inventaire_termine/);
    await expect(chezD((trx) => sql`DELETE FROM lignes_inventaire`.execute(trx))).rejects.toThrow(/inventaire_termine/);
    await expect(chezD((trx) => sql`UPDATE inventaires SET etat = 'en_cours'`.execute(trx))).rejects.toThrow(/inventaire_termine/);
    // Les écarts affichés restent ceux du jour de la validation, même si le stock change ensuite.
    await chezD((trx) => ajouterMouvement(trx, D, { varianteId: manque, type: 'entree', quantite: 10 }));
    const fige = (await chezD((trx) => lignesInventaire(trx, inv))).find((l) => l.nom_fr === 'Manque')!;
    expect([fige.comptee, fige.theorique]).toEqual([6, 8]);

    // Un inventaire annulé ne corrige rien, et on peut en rouvrir un autre.
    const inv2 = await chezD((trx) => ouvrirInventaire(trx, D));
    expect(inv2).not.toBe(inv);
    await chezD((trx) => compter(trx, D, inv2, oublie, { fixer: 0 }));
    await chezD((trx) => annulerInventaire(trx, D, inv2));
    expect(await stock(oublie)).toBe(7);
    expect(await chezD((trx) => ouvrirInventaire(trx, D))).not.toBe(inv2);
  });
});
