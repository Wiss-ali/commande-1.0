// Parcours de l'étape 5 sur un écran de 360 px : accueil, rapports, export pour le comptable.
// Nommé pour passer après parcours.spec.ts, qui attend une base sans commerçant.
import { strFromU8, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { confirmerCommande, creerCommande, expedier, marquerLivree, marquerRetournee } from '../../src/lib/commandes.ts';
import { creerDocument, vendreEnCaisse } from '../../src/lib/documents.ts';
import { accepterInvitation, inviterEmploye } from '../../src/lib/invitations.ts';
import { creerProduit, lireProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';

const CAPTURES = 'docs/etape-5/captures';
const problemes: string[] = [];
async function ouvrir(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problemes.push(`${page.url()} : ${m.text()}`);
  });
  page.on('pageerror', (e) => problemes.push(`${page.url()} : ${e.message}`));
  return page;
}
async function sansDebordement(page: Page) {
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, `débordement sur ${page.url()}`).toBeLessThanOrEqual(360);
}
async function connecter(page: Page, tel: string, mdp: string) {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill(tel);
  await page.getByLabel('Mot de passe').fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

let karim: Page;
let telKarim = '', telLina = '', telSamir = '';

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const magasin = await creerCommercant(admin.id, 'Bazar Karim');
  const ctx = { commercantId: magasin.commercantId, utilisateurId: magasin.proprietaireId };
  const cle = () => crypto.randomUUID();
  await avecCommercant(magasin.commercantId, async (trx) => {
    // Module Boutique activé : sa carte dit que le site n'est pas encore en ligne.
    await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute();
    const ids: string[] = [];
    for (const [nomFr, nomAr, achat, vente, stock, seuil] of [['Sac en cuir', 'حقيبة جلدية', 3_000_00, 6_000_00, 20, 2], ['Ceinture', 'حزام', 500_00, 1_500_00, 3, 5]] as const) {
      const r = await creerProduit(trx, ctx, { nomFr, nomAr, categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: achat, prixVente: vente, seuil, stockInitial: stock }] });
      if (!r.ok) throw new Error(r.raison);
      ids.push((await lireProduit(trx, r.id))!.variantes[0]!.id);
    }
    const [sac, ceinture] = ids as [string, string];
    await vendreEnCaisse(trx, ctx, { lignes: [{ varianteId: sac, quantite: 1 }, { varianteId: ceinture, quantite: 1 }], cle: cle() });
    await creerDocument(trx, ctx, { type: 'devis', origine: 'manuel', lignes: [{ varianteId: sac, quantite: 2 }], acheteur: { nom: 'Société Atlas' }, prixLibres: true });
    for (const [wilaya, fin] of [[16, 'livree'], [16, 'retournee'], [31, 'expediee'], [25, null]] as const) {
      const c = await creerCommande(trx, ctx, { client: { nom: 'Cliente', telephone: telephone() }, wilaya, commune: 'Centre', livraison: 'domicile', lignes: [{ varianteId: sac, quantite: 1 }], frais: 600_00, cle: cle(), libelleLivraison: 'Livraison' });
      if (!c.ok) throw new Error(c.raison);
      if (!fin) continue;
      await confirmerCommande(trx, ctx, c.id, 'envoi', cle());
      await expedier(trx, ctx, c.id, {});
      if (fin === 'livree') await marquerLivree(trx, ctx, c.id);
      if (fin === 'retournee') await marquerRetournee(trx, ctx, c.id, cle());
    }
  });
  telKarim = magasin.telephone;
  telLina = telephone();
  telSamir = telephone();
  for (const [nom, tel, role] of [['Lina', telLina, 'vendeur'], ['Samir', telSamir, 'preparateur']] as const) {
    const inv = await inviterEmploye({ commercantId: magasin.commercantId, parUtilisateur: magasin.proprietaireId, nom, telephone: tel, role });
    if (!inv.ok) throw new Error('invitation refusée');
    await accepterInvitation(inv.jeton, { motDePasse: MDP });
  }
  karim = await ouvrir(browser);
  await connecter(karim, telKarim, MDP);
});

test('accueil du propriétaire : quatre chiffres, graphique, « À faire », cartes des modules', async () => {
  await karim.goto('/');
  // Caisse 7 500 + factures livrée, retournée (annulée par son avoir) et expédiée : 7 500 + 6 600 + 6 600 − 6 600 + 6 600.
  const tuile = (nom: string) => karim.getByRole('link', { name: new RegExp(nom) }).first();
  await expect(tuile('Ventes du jour')).toContainText('20 700 DA');
  await expect(tuile('Commandes à confirmer')).toContainText('1');
  await expect(tuile('Colis en route')).toContainText('1');
  await expect(tuile('Produits en stock bas')).toContainText('1');
  await expect(karim.getByRole('heading', { name: 'Ventes des 7 derniers jours' })).toBeVisible();
  await expect(karim.getByRole('img', { name: /Graphique en barres des ventes des 7 derniers jours/ })).toBeVisible();
  await karim.getByText('Voir les chiffres').click();
  await expect(karim.locator('table tbody tr')).toHaveCount(7);
  for (const texte of ['1 commande à confirmer par téléphone', '1 devis en attente de réponse']) {
    await expect(karim.getByRole('link', { name: texte })).toBeVisible();
  }
  await expect(karim.getByRole('link', { name: /Boutique en ligne/ })).toContainText('Désactivée');
  await expect(karim.getByRole('link', { name: /Rapports/ })).toContainText('Marge du mois');
  await expect(karim.getByRole('link', { name: /^Caisse 1 vente/ })).toBeVisible();
  await sansDebordement(karim);
  await karim.screenshot({ path: `${CAPTURES}/accueil-fr-clair.png`, fullPage: true });

  await karim.getByRole('link', { name: '30 j' }).click();
  await expect(karim.getByRole('heading', { name: 'Ventes des 30 derniers jours' })).toBeVisible();
  await karim.getByRole('link', { name: '1 commande à confirmer par téléphone' }).click();
  await expect(karim).toHaveURL(/\/commandes\?f=a_confirmer$/);
});

test('rapports : marge réelle, commandes, retours par wilaya, meilleurs produits', async () => {
  await karim.goto('/rapports?p=7j');
  // Ventes HT non annulées : 7 500 + 6 600 + 6 600 = 20 700 ; achat : 3 000 + 500 + 3 000 + 3 000 = 9 500 ; livraison : 3 × 600 = 1 800.
  await expect(karim.getByText('9 400 DA').first()).toBeVisible();
  await expect(karim.getByText('1 colis retourné : 600 DA de livraison perdue.')).toBeVisible();
  await sansDebordement(karim);
  await karim.screenshot({ path: `${CAPTURES}/rapport-marge-fr-clair.png`, fullPage: true });

  await karim.getByRole('link', { name: 'Commandes', exact: true }).click();
  await expect(karim.getByText('Taux de confirmation')).toBeVisible();
  await expect(karim.getByText('100 %').first()).toBeVisible();
  await expect(karim.getByText('50 %')).toBeVisible();
  await karim.screenshot({ path: `${CAPTURES}/rapport-commandes-fr-clair.png`, fullPage: true });

  await karim.getByRole('link', { name: 'Retours', exact: true }).click();
  await expect(karim.getByText('Le plus de retours : Alger (50 %)')).toBeVisible();
  await karim.screenshot({ path: `${CAPTURES}/rapport-retours-fr-clair.png`, fullPage: true });

  await karim.getByRole('link', { name: 'Produits', exact: true }).click();
  await expect(karim.getByText('Meilleur produit')).toBeVisible();
  await expect(karim.getByText('Sac en cuir').first()).toBeVisible();
  await sansDebordement(karim);
  await karim.screenshot({ path: `${CAPTURES}/rapport-produits-fr-clair.png`, fullPage: true });

  await karim.getByRole('link', { name: 'Cette année' }).click();
  await expect(karim).toHaveURL(/r=produits&p=annee/);
});

test('export pour le comptable : une archive ZIP avec les PDF et les tableaux', async () => {
  await karim.goto('/rapports');
  await karim.getByRole('link', { name: 'Exporter pour le comptable' }).click();
  await expect(karim.getByRole('heading', { name: 'Export pour le comptable' })).toBeVisible();
  await sansDebordement(karim);
  await karim.screenshot({ path: `${CAPTURES}/export-fr-clair.png`, fullPage: true });
  const [telechargement] = await Promise.all([karim.waitForEvent('download'), karim.getByRole('button', { name: 'Télécharger l\'archive' }).click()]);
  expect(telechargement.suggestedFilename()).toMatch(/^hanout-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.zip$/);
  const fichiers = unzipSync(new Uint8Array(await readFile((await telechargement.path())!)));
  const noms = Object.keys(fichiers);
  // 1 ticket, 3 factures, 1 avoir.
  expect(noms.filter((n) => n.endsWith('.pdf'))).toHaveLength(5);
  expect(noms).toEqual(expect.arrayContaining(['documents.csv', 'lignes.csv', 'stock.csv', 'clients.csv']));
  expect(noms.some((n) => n.startsWith('pdf/factures/FA-'))).toBe(true);
  expect(strFromU8(fichiers['stock.csv']!)).toContain('Sac en cuir;حقيبة جلدية');
  // Période à l'envers : refusée avec un message clair.
  await karim.goto('/rapports/export/archive?du=2026-05-01&au=2026-04-01');
  await expect(karim.getByText('Période invalide')).toBeVisible();
});

test('la vendeuse voit les ventes mais pas les rapports ; le préparateur ne voit pas l\'argent', async ({ browser }) => {
  const lina = await ouvrir(browser);
  await connecter(lina, telLina, MDP);
  await expect(lina.getByRole('link', { name: /Ventes du jour/ })).toBeVisible();
  await expect(lina.getByRole('link', { name: /Rapports/ })).toHaveCount(0);
  await lina.goto('/rapports');
  await expect(lina).toHaveURL(/acces-refuse/);
  expect((await lina.request.get('/rapports/export/archive?du=2026-01-01&au=2026-01-31')).status()).toBe(401);
  await lina.context().close();

  const samir = await ouvrir(browser);
  await connecter(samir, telSamir, MDP);
  await expect(samir.getByRole('link', { name: /Colis en route/ })).toBeVisible();
  await expect(samir.getByRole('link', { name: /Ventes du jour/ })).toHaveCount(0);
  await expect(samir.getByRole('link', { name: /Commandes à confirmer/ })).toHaveCount(0);
  await expect(samir.getByRole('img', { name: /Graphique/ })).toHaveCount(0);
  await expect(samir.getByText('20 700 DA')).toHaveCount(0);
  await sansDebordement(samir);
  await samir.screenshot({ path: `${CAPTURES}/accueil-preparateur.png`, fullPage: true });
  await samir.context().close();
});

test('accueil et rapports en arabe, en thème sombre', async () => {
  // La langue se choisit dans « Plus » (et sur les pages publiques).
  await karim.goto('/plus');
  await karim.getByRole('button', { name: 'العربية' }).click();
  await expect(karim.locator('html')).toHaveAttribute('dir', 'rtl');
  await karim.goto('/plus');
  await karim.getByRole('button', { name: 'داكن' }).click();
  await expect(karim.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');
  const ecrans: [string, string][] = [
    ['/', 'accueil'], ['/rapports?r=marge&p=7j', 'rapport-marge'], ['/rapports?r=commandes&p=7j', 'rapport-commandes'],
    ['/rapports?r=retours&p=7j', 'rapport-retours'], ['/rapports?r=produits&p=7j', 'rapport-produits'], ['/rapports/export', 'export'],
  ];
  for (const [chemin, nom] of ecrans) {
    await karim.goto(chemin);
    await expect(karim.locator('h1')).toBeVisible();
    await sansDebordement(karim);
    await karim.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await karim.goto('/');
  await expect(karim.getByText('مبيعات اليوم', { exact: true })).toBeVisible();
  await expect(karim.getByText('مبيعات اليوم: 1')).toBeVisible();
  await karim.goto('/plus');
  await karim.getByRole('button', { name: 'فاتح' }).click();
  await karim.goto('/plus');
  await karim.getByRole('button', { name: /Français/ }).click();
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
