// Accueil, rapports et export : les chiffres sont prouvés sur un magasin dont on connaît chaque vente.
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, fermerBD } from '../../src/lib/bd.ts';
import { annulerCommande, confirmerCommande, creerCommande, expedier, marquerLivree, marquerRetournee } from '../../src/lib/commandes.ts';
import { creerAvoir, vendreEnCaisse } from '../../src/lib/documents.ts';
import { cellule, construireArchive, csv, montantCsv } from '../../src/lib/export.ts';
import { chiffresAccueil, jourAlger, meilleursProduits, periode, periodeLibre, rapportCommandes, rapportMarge, retoursParWilaya, serieVentes } from '../../src/lib/rapports.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, telephone } from '../outils.ts';

let A: Contexte, B: Contexte;
let robe: string, foulard: string;
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const cle = () => crypto.randomUUID();
const aujourdhui = () => periode('7j');

async function article(c: Contexte, nom: string, prixAchat: number, prixVente: number, stockInitial: number, seuil = 0) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat, prixVente, seuil, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}
async function commande(wilaya: number, varianteId: string, frais: number) {
  const r = await chez(A, (trx) => creerCommande(trx, A, {
    client: { nom: 'Client', telephone: telephone() }, wilaya, commune: 'Centre', livraison: 'domicile', lignes: [{ varianteId, quantite: 1 }], frais, cle: cle(), libelleLivraison: 'Livraison',
  }));
  if (!r.ok) throw new Error(r.raison);
  return r.id;
}

beforeAll(async () => {
  const admin = await creerAdmin();
  A = (({ commercantId, proprietaireId }) => ({ commercantId, utilisateurId: proprietaireId }))(await creerCommercant(admin.id, 'Rapports A'));
  B = (({ commercantId, proprietaireId }) => ({ commercantId, utilisateurId: proprietaireId }))(await creerCommercant(admin.id, 'Rapports B'));
  robe = await article(A, 'Robe', 2_000_00, 5_000_00, 20);
  foulard = await article(A, 'Foulard', 300_00, 1_000_00, 2, 5);
  // Caisse : 2 robes + 1 foulard (11 000 DA), puis un ticket de 1 foulard annulé par un avoir.
  await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: robe, quantite: 2 }, { varianteId: foulard, quantite: 1 }], cle: cle() }));
  const annule = await chez(A, (trx) => vendreEnCaisse(trx, A, { lignes: [{ varianteId: foulard, quantite: 1 }], cle: cle() }));
  if (annule.ok) await chez(A, (trx) => creerAvoir(trx, A, annule.id, { remettreEnStock: true, cle: cle() }));
  // Commandes : Alger livrée (frais 500), Alger retournée (frais 500), Oran livrée (frais 800), une annulée, une en attente.
  for (const [wilaya, frais, fin] of [[16, 500_00, 'livree'], [16, 500_00, 'retournee'], [31, 800_00, 'livree']] as const) {
    const id = await commande(wilaya, robe, frais);
    await chez(A, (trx) => confirmerCommande(trx, A, id, 'envoi', cle()));
    await chez(A, (trx) => expedier(trx, A, id, {}));
    if (fin === 'livree') await chez(A, (trx) => marquerLivree(trx, A, id));
    else await chez(A, (trx) => marquerRetournee(trx, A, id, cle()));
  }
  const annulee = await commande(16, robe, 500_00);
  await chez(A, (trx) => annulerCommande(trx, A, annulee, cle()));
  await commande(31, robe, 800_00);
});
afterAll(fermerBD);

describe('périodes', () => {
  it('calcule les bornes à partir du jour d\'Alger', () => {
    expect(periode('7j', '2026-03-03')).toEqual({ du: '2026-02-25', au: '2026-03-03' });
    expect(periode('mois', '2026-03-15')).toEqual({ du: '2026-03-01', au: '2026-03-15' });
    expect(periode('mois_precedent', '2026-01-10')).toEqual({ du: '2025-12-01', au: '2025-12-31' });
    expect(periode('mois_precedent', '2024-03-10')).toEqual({ du: '2024-02-01', au: '2024-02-29' });
    expect(periode('annee', '2026-11-17')).toEqual({ du: '2026-01-01', au: '2026-11-17' });
    expect(periodeLibre('2026-02-01', '2026-01-01')).toBeNull();
    expect(periodeLibre('2025-01-01', '2026-06-01')).toBeNull();
    expect(periodeLibre('2026-01-01', '2026-01-31')).toEqual({ du: '2026-01-01', au: '2026-01-31' });
    // Minuit à Alger = 23 h UTC la veille.
    expect(jourAlger(new Date('2026-05-31T23:30:00Z'))).toBe('2026-06-01');
  });
});

describe('accueil', () => {
  it('donne les chiffres du jour, les commandes et le stock bas', async () => {
    const c = await chez(A, chiffresAccueil);
    // Ventes du jour : caisse 11 000 + factures des commandes (5 500, 5 500, 5 800) ; le ticket annulé s'efface avec son avoir.
    expect(c.ventesJour).toBe(11_000_00 + 5_500_00 + 5_500_00 + 5_800_00 - 5_500_00);
    expect(c).toMatchObject({ aConfirmer: 1, aExpedier: 0, enRoute: 0, ecarts: 0, caisseNonCloturee: false });
    expect(c.stockBas).toBe(1); // le foulard : 1 en stock, seuil 5
    const serie = await chez(A, (trx) => serieVentes(trx, 7));
    expect(serie).toHaveLength(7);
    expect(serie.at(-1)).toEqual({ jour: jourAlger(), valeur: c.ventesJour });
    expect(serie.slice(0, 6).every((p) => p.valeur === 0)).toBe(true);
  });

  it('un autre commerçant ne voit aucun de ces chiffres', async () => {
    const c = await chez(B, chiffresAccueil);
    expect(c).toMatchObject({ ventesJour: 0, nbVentesJour: 0, aConfirmer: 0, stockBas: 0, clients: 0 });
    expect((await chez(B, (trx) => rapportMarge(trx, aujourdhui()))).ventes).toBe(0);
  });
});

describe('rapports', () => {
  it('marge réelle : ventes − achat − livraison, factures annulées retirées', async () => {
    const m = await chez(A, (trx) => rapportMarge(trx, aujourdhui()));
    // Ventes non annulées : caisse 11 000 + 2 commandes livrées (5 500 + 5 800). La retournée est annulée par son avoir.
    expect(m.ventes).toBe(11_000_00 + 5_500_00 + 5_800_00);
    expect(m.achat).toBe(2 * 2_000_00 + 300_00 + 2 * 2_000_00);
    // Livraison payée pour les 3 colis expédiés, dont 500 DA perdus sur le retour.
    expect(m.livraison).toBe(500_00 + 500_00 + 800_00);
    expect(m).toMatchObject({ retours: 500_00, colisRetournes: 1, nbVentes: 3 });
    expect(m.marge).toBe(m.ventes - m.achat - m.livraison);
    expect(m.tauxMarque).toBe(Math.round((m.marge * 1000) / m.ventes));
    expect(m.serie.reduce((s, p) => s + p.valeur, 0)).toBe(m.marge);
    expect(m.pas).toBe('jour');
    expect((await chez(A, (trx) => rapportMarge(trx, periode('annee')))).pas).toBe('mois');
  });

  it('taux de confirmation et de livraison', async () => {
    const r = await chez(A, (trx) => rapportCommandes(trx, aujourdhui()));
    expect(r).toMatchObject({ creees: 5, confirmees: 3, annuleesAvant: 1, enAttente: 1, expediees: 3, livrees: 2, retournees: 1, enRoute: 0, tauxConfirmation: 75, tauxLivraison: 67 });
  });

  it('retours par wilaya et meilleurs produits', async () => {
    const w = await chez(A, (trx) => retoursParWilaya(trx, aujourdhui()));
    expect(w.map((l) => [l.code, l.expediees, l.retournees, l.taux])).toEqual([[16, 2, 1, 50], [31, 1, 0, 0]]);
    const p = await chez(A, (trx) => meilleursProduits(trx, aujourdhui()));
    expect(p.map((l) => [l.nom_fr, l.quantite, l.ventes, l.marge])).toEqual([['Robe', 4, 20_000_00, 12_000_00], ['Foulard', 1, 1_000_00, 700_00]]);
  });
});

describe('export pour le comptable', () => {
  it('cellules CSV : séparateur, guillemets, formules neutralisées, montants à virgule', () => {
    expect(cellule('Robe; rouge')).toBe('"Robe; rouge"');
    expect(cellule('dit "oui"')).toBe('"dit ""oui"""');
    expect(cellule('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(cellule('+213')).toBe("'+213");
    expect(montantCsv(125_050)).toBe('1250,50');
    expect(montantCsv(-5)).toBe('-0,05');
    const octets = csv(['A', 'B'], [['x', montantCsv(-100)]]);
    expect(Buffer.from(octets).toString('utf8')).toBe('﻿A;B\r\nx;-1,00\r\n');
  });

  it('archive : CSV des documents, lignes, stock, clients, et un PDF par document', async () => {
    const textes = new Proxy({}, { get: (_c, k) => String(k) }) as Record<string, string>;
    const r = await chez(A, (trx) => construireArchive(trx, { commercantId: A.commercantId, periode: aujourdhui(), langue: 'fr', textes }));
    if ('trop' in r) throw new Error('trop');
    const fichiers = unzipSync(r.zip);
    const noms = Object.keys(fichiers);
    // 2 tickets, 3 factures, 2 avoirs (ticket annulé, colis retourné).
    expect(r.documents).toBe(7);
    expect(noms.filter((n) => n.endsWith('.pdf'))).toHaveLength(7);
    for (const n of noms.filter((x) => x.endsWith('.pdf'))) expect(strFromU8(fichiers[n]!.subarray(0, 5))).toBe('%PDF-');
    const documents = Buffer.from(fichiers['fichierDocuments.csv']!).toString('utf8');
    expect(documents.startsWith('﻿colType;colNumero')).toBe(true);
    expect(documents.split('\r\n').filter(Boolean)).toHaveLength(8);
    expect(documents).toMatch(/AV-\d{4}-00001/);
    const stock = strFromU8(fichiers['fichierStock.csv']!);
    expect(stock).toContain('Robe;;;;');
    expect(strFromU8(fichiers['fichierClients.csv']!)).toContain('Client;05');
  }, 60_000);
});
