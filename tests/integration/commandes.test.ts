// Commandes à livrer : parcours complet du colis, stock et documents, prouvé contre une vraie base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import { lireClient, listerClients } from '../../src/lib/clients.ts';
import {
  ajouterTransporteur, alerteTelephone, annulerCommande, confirmerCommande, creerCommande, enregistrerFrais, expedier, lireCommande, listerCommandes,
  marquerLivree, marquerPreparee, marquerRetournee, noterAppel, type SaisieCommande,
} from '../../src/lib/commandes.ts';
import { lireDocument, modifierDevis } from '../../src/lib/documents.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, telephone } from '../outils.ts';

let A: Contexte, B: Contexte;
let robe: string;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const cle = () => crypto.randomUUID();
const stock = (c: Contexte, v: string) => chez(c, (trx) => trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', v).executeTakeFirstOrThrow());

async function article(c: Contexte, nom: string, prixVente: number, stockInitial: number) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: 1_000_00, prixVente, seuil: 0, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}

const saisie = (o: Partial<SaisieCommande> = {}): SaisieCommande => ({
  client: { nom: 'Amina', telephone: telephone() }, wilaya: 16, commune: 'Bab Ezzouar', livraison: 'domicile', adresse: 'Cité 5 juillet, bât. 3',
  lignes: [{ varianteId: robe, quantite: 2 }], cle: cle(), libelleLivraison: 'Livraison', ...o,
});
async function nouvelle(c: Contexte, o: Partial<SaisieCommande> = {}) {
  const r = await chez(c, (trx) => creerCommande(trx, c, saisie(o)));
  if (!r.ok) throw new Error(r.raison);
  return r.id;
}

beforeAll(async () => {
  const admin = await creerAdmin();
  const a = await creerCommercant(admin.id, 'Colis A');
  const b = await creerCommercant(admin.id, 'Colis B');
  A = { commercantId: a.commercantId, utilisateurId: a.proprietaireId };
  B = { commercantId: b.commercantId, utilisateurId: b.proprietaireId };
  robe = await article(A, 'Robe', 3_500_00, 10);
  await chez(A, (trx) => enregistrerFrais(trx, A, [{ wilaya: 16, domicile: 600_00, pointRelais: 400_00 }, { wilaya: 68, domicile: 900_00, pointRelais: null }]));
});
afterAll(fermerBD);

describe('création', () => {
  it('crée le devis avec les frais de la wilaya, réserve le stock, et la commande « à confirmer »', async () => {
    const avant = await stock(A, robe);
    const id = await nouvelle(A);
    const c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    expect(c).toMatchObject({ statut: 'a_confirmer', frais: 600_00, total: 7_600_00, commune: 'Bab Ezzouar', adresse: 'Cité 5 juillet, bât. 3', wilaya: { code: 16 } });
    expect(c.lignes.map((l) => l.designation)).toEqual(['Robe', 'Livraison']);
    expect(c.historique).toHaveLength(1);
    expect(await stock(A, robe)).toEqual({ quantite: avant.quantite, reservee: avant.reservee + 2 });
  });

  it('prend les frais du point relais, et rien si la wilaya n\'a pas de prix', async () => {
    const relais = (await chez(A, async (trx) => lireCommande(trx, await nouvelle(A, { livraison: 'point_relais', lignes: [{ varianteId: robe, quantite: 1 }] }))))!;
    expect(relais.frais).toBe(400_00);
    const sansPrix = (await chez(A, async (trx) => lireCommande(trx, await nouvelle(A, { wilaya: 68, commune: 'Bou Saâda', livraison: 'point_relais', lignes: [{ varianteId: robe, quantite: 1 }] }))))!;
    expect(sansPrix.frais).toBe(0);
    expect(sansPrix.lignes).toHaveLength(1);
    for (const id of [relais.id, sansPrix.id]) await chez(A, (trx) => annulerCommande(trx, A, id, cle()));
  });

  it('la commune est choisie dans la liste de la wilaya, écrite sous son nom officiel (accents et majuscules ignorés)', async () => {
    const c = (await chez(A, async (trx) => lireCommande(trx, await nouvelle(A, { wilaya: 68, commune: '  bou saâda ', lignes: [{ varianteId: robe, quantite: 1 }] }))))!;
    expect(c.commune).toBe('Bou Saada');
    const ar = (await chez(A, async (trx) => lireCommande(trx, await nouvelle(A, { commune: 'القبة', lignes: [{ varianteId: robe, quantite: 1 }] }))))!;
    expect(ar.commune).toBe('Kouba');
    expect((await chez(A, (trx) => trx.selectFrom('communes').select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirstOrThrow())).n).toBe('1541');
    for (const id of [c.id, ar.id]) await chez(A, (trx) => annulerCommande(trx, A, id, cle()));
  });

  it('refuse sans rien écrire : téléphone, wilaya, commune, stock insuffisant', async () => {
    const avant = await stock(A, robe);
    for (const [o, raison] of [
      [{ client: { nom: 'X', telephone: '' } }, 'telephone_requis'],
      [{ client: { nom: 'X', telephone: '12345' } }, 'telephone_invalide'],
      [{ wilaya: 70 }, 'wilaya_invalide'],
      [{ commune: ' ' }, 'commune_requise'],
      // La commune doit appartenir à la wilaya choisie (liste officielle des communes).
      [{ commune: 'Oran' }, 'commune_invalide'],
      [{ commune: 'Centre' }, 'commune_invalide'],
      [{ lignes: [{ varianteId: robe, quantite: 999 }] }, 'stock_insuffisant'],
    ] as const) {
      expect(await chez(A, (trx) => creerCommande(trx, A, saisie(o as Partial<SaisieCommande>)))).toEqual({ ok: false, raison });
    }
    expect(await stock(A, robe)).toEqual(avant);
    // Le stock insuffisant n'a consommé ni numéro de devis ni numéro de commande.
    const compteurs = await chez(A, (trx) => trx.selectFrom('compteurs_documents').select(['type', 'dernier']).execute());
    const devis = compteurs.find((c) => c.type === 'devis')!.dernier;
    const commandes = compteurs.find((c) => c.type === 'commande')!.dernier;
    expect(devis).toBe(commandes);
  });

  it('un double toucher ne crée qu\'une commande', async () => {
    const s = saisie({ lignes: [{ varianteId: robe, quantite: 1 }] });
    const r1 = await chez(A, (trx) => creerCommande(trx, A, s));
    const r2 = await chez(A, (trx) => creerCommande(trx, A, s));
    expect(r1.ok && r2.ok && r1.id === r2.id && r2.doublon).toBe(true);
    if (r1.ok) await chez(A, (trx) => annulerCommande(trx, A, r1.id, cle()));
  });
});

describe('parcours d\'un colis', () => {
  it('appel sans réponse, confirmation « Envoi », préparation, expédition, livraison', async () => {
    const depart = await stock(A, robe);
    const id = await nouvelle(A);
    expect(await chez(A, (trx) => noterAppel(trx, A, id))).toEqual({ ok: true, tentatives: 1 });
    expect(await chez(A, (trx) => noterAppel(trx, A, id))).toEqual({ ok: true, tentatives: 2 });

    const conf = await chez(A, (trx) => confirmerCommande(trx, A, id, 'envoi', cle()));
    expect(conf.ok).toBe(true);
    // La réservation est passée du devis à la facture : toujours 2 réservés, pas 4.
    expect(await stock(A, robe)).toEqual({ quantite: depart.quantite, reservee: depart.reservee + 2 });
    let c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    expect(c.statut).toBe('confirmee');
    expect(c.facture).toMatchObject({ payeLe: null });
    expect(await chez(A, (trx) => noterAppel(trx, A, id))).toEqual({ ok: false, raison: 'statut_invalide' });

    expect(await chez(A, (trx) => marquerPreparee(trx, A, id))).toEqual({ ok: true });
    const t = await chez(A, (trx) => ajouterTransporteur(trx, A, 'Yalidine'));
    expect(await chez(A, (trx) => expedier(trx, A, id, { transporteurId: t.ok ? t.id : null, numeroSuivi: 'YAL-123' }))).toEqual({ ok: true });
    expect(await stock(A, robe)).toEqual({ quantite: depart.quantite - 2, reservee: depart.reservee });

    expect(await chez(A, (trx) => marquerLivree(trx, A, id))).toEqual({ ok: true });
    c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    expect(c).toMatchObject({ statut: 'livree', transporteur: 'Yalidine', numeroSuivi: 'YAL-123', tentatives: 2 });
    const f = (await chez(A, (trx) => lireDocument(trx, c.facture!.id)))!;
    expect(f).toMatchObject({ modePaiement: 'a_la_livraison', total: 7_600_00 });
    expect(f.payeLe).not.toBeNull();
    expect(c.historique.map((h) => h.nouveau ?? h.evenement)).toEqual(['livree', 'expediee', 'preparee', 'confirmee', 'appel_sans_reponse', 'appel_sans_reponse', 'a_confirmer']);
  });

  it('retour : avoir automatique, stock remis, et alerte pour ce téléphone', async () => {
    const tel = telephone();
    const depart = await stock(A, robe);
    const id = await nouvelle(A, { client: { nom: 'Karim', telephone: tel } });
    await chez(A, (trx) => confirmerCommande(trx, A, id, 'envoi', cle()));
    await chez(A, (trx) => expedier(trx, A, id, {}));
    const r = await chez(A, (trx) => marquerRetournee(trx, A, id, cle()));
    expect(r.ok).toBe(true);
    expect(await stock(A, robe)).toEqual(depart);
    const c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    expect(c.statut).toBe('retournee');
    expect(c.avoir).not.toBeNull();
    expect((await chez(A, (trx) => lireDocument(trx, c.avoir!.id)))!.total).toBe(-7_600_00);

    // Nouvelle commande du même numéro (écrit autrement) : l'alerte apparaît.
    expect(await chez(A, (trx) => alerteTelephone(trx, `+213 ${tel.slice(1)}`))).toEqual({ retours: 1, annulations: 0 });
    const id2 = await nouvelle(A, { client: { nom: 'Karim', telephone: tel } });
    expect((await chez(A, (trx) => lireCommande(trx, id2)))!.alerte).toEqual({ retours: 1, annulations: 0 });
    // Le commerçant B ne voit rien de ce client.
    expect(await chez(B, (trx) => alerteTelephone(trx, tel))).toEqual({ retours: 0, annulations: 0 });
    await chez(A, (trx) => annulerCommande(trx, A, id2, cle()));

    const fiche = (await chez(A, (trx) => lireClient(trx, c.client.id)))!;
    expect(fiche).toMatchObject({ commandes: 2, retournees: 1, annulees: 1, tauxRetour: 100, depense: 0, telephone: tel });
  });

  it('vente directe : facture payée, stock sorti, commande livrée tout de suite', async () => {
    const depart = await stock(A, robe);
    const id = await nouvelle(A, { lignes: [{ varianteId: robe, quantite: 1 }] });
    expect((await chez(A, (trx) => confirmerCommande(trx, A, id, 'directe', cle()))).ok).toBe(true);
    expect(await stock(A, robe)).toEqual({ quantite: depart.quantite - 1, reservee: depart.reservee });
    const c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    expect(c.statut).toBe('livree');
    expect(c.facture!.payeLe).not.toBeNull();
  });

  it('annulation avant et après confirmation : le stock réservé est libéré, la facture annulée par un avoir', async () => {
    const depart = await stock(A, robe);
    const avant = await nouvelle(A);
    expect(await chez(A, (trx) => annulerCommande(trx, A, avant, cle()))).toEqual({ ok: true });
    const apres = await nouvelle(A);
    await chez(A, (trx) => confirmerCommande(trx, A, apres, 'envoi', cle()));
    expect(await chez(A, (trx) => annulerCommande(trx, A, apres, cle()))).toEqual({ ok: true });
    expect(await stock(A, robe)).toEqual(depart);
    const c = (await chez(A, (trx) => lireCommande(trx, apres)))!;
    expect(c.avoir).not.toBeNull();
    // Une commande expédiée ne s'annule plus : elle revient en retour.
    const partie = await nouvelle(A, { lignes: [{ varianteId: robe, quantite: 1 }] });
    await chez(A, (trx) => confirmerCommande(trx, A, partie, 'envoi', cle()));
    await chez(A, (trx) => expedier(trx, A, partie, {}));
    expect(await chez(A, (trx) => annulerCommande(trx, A, partie, cle()))).toEqual({ ok: false, raison: 'statut_invalide' });
    await chez(A, (trx) => marquerRetournee(trx, A, partie, cle()));
  });

  it('modifier les articles d\'une commande à confirmer ajuste la réservation', async () => {
    const depart = await stock(A, robe);
    const id = await nouvelle(A);
    const c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    const r = await chez(A, (trx) => modifierDevis(trx, A, c.devis.id, {
      lignes: [{ varianteId: robe, quantite: 3 }, { designation: 'Livraison', quantite: 1, prixUnitaire: 600_00 }],
      acheteur: { nom: 'Amina', telephone: c.client.telephone! },
    }));
    expect(r).toEqual({ ok: true });
    expect(await stock(A, robe)).toEqual({ quantite: depart.quantite, reservee: depart.reservee + 3 });
    const trop = await chez(A, (trx) => modifierDevis(trx, A, c.devis.id, { lignes: [{ varianteId: robe, quantite: 500 }], acheteur: { nom: 'Amina' } }));
    expect(trop).toEqual({ ok: false, raison: 'stock_insuffisant' });
    expect(await stock(A, robe)).toEqual({ quantite: depart.quantite, reservee: depart.reservee + 3 });
    await chez(A, (trx) => annulerCommande(trx, A, id, cle()));
    expect(await stock(A, robe)).toEqual(depart);
  });
});

describe('listes et isolation', () => {
  it('filtre par statut et cherche par téléphone ou numéro', async () => {
    const tel = telephone();
    const id = await nouvelle(A, { client: { nom: 'Yacine Bouzid', telephone: tel }, lignes: [{ varianteId: robe, quantite: 1 }] });
    const c = (await chez(A, (trx) => lireCommande(trx, id)))!;
    const parTel = await chez(A, (trx) => listerCommandes(trx, { filtre: 'toutes', recherche: tel, limite: 10 }));
    expect(parTel.map((l) => l.id)).toEqual([id]);
    const parNumero = await chez(A, (trx) => listerCommandes(trx, { filtre: 'a_confirmer', recherche: String(c.numero), limite: 10 }));
    expect(parNumero.map((l) => l.id)).toContain(id);
    expect((await chez(A, (trx) => listerCommandes(trx, { filtre: 'terminees', recherche: tel, limite: 10 })))).toEqual([]);
    expect((await chez(A, (trx) => listerClients(trx, { recherche: 'bouzid', limite: 10 }))).map((l) => l.nom)).toEqual(['Yacine Bouzid']);
    await chez(A, (trx) => annulerCommande(trx, A, id, cle()));
  });

  it('B ne voit ni ne change les commandes de A', async () => {
    const id = await nouvelle(A, { lignes: [{ varianteId: robe, quantite: 1 }] });
    expect(await chez(B, (trx) => lireCommande(trx, id))).toBeNull();
    expect(await chez(B, (trx) => annulerCommande(trx, B, id, cle()))).toEqual({ ok: false, raison: 'introuvable' });
    expect(await chez(B, (trx) => listerCommandes(trx, { filtre: 'toutes', limite: 50 }))).toEqual([]);
    expect(await chez(B, (trx) => creerCommande(trx, B, saisie({ lignes: [{ varianteId: robe, quantite: 1 }] })))).toEqual({ ok: false, raison: 'introuvable' });
    await chez(A, (trx) => annulerCommande(trx, A, id, cle()));
  });
});
