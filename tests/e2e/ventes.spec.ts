// Parcours de l'étape 3 sur un écran de téléphone de 360 px : caisse, tickets, factures, devis, avoir, clôture.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { accepterInvitation, inviterEmploye } from '../../src/lib/invitations.ts';
import { creerProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';
import { CODE_CAMERA } from './preparation.ts';

const CAPTURES = 'docs/etape-3/captures';
const MDP_VENDEUSE = 'vendeuse du magasin';
const ANNEE = new Date().getFullYear();

const problemes: string[] = [];
let horsLigne = false;
async function ouvrir(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  // Diagnostic : une réponse 404 inattendue a été vue une fois, sans pouvoir la reproduire. Son adresse est affichée.
  page.on('response', (r) => { if (r.status() === 404) console.log('404 →', r.url(), 'depuis', page.url()); });
  page.on('console', (m) => {
    // Pendant la coupure simulée, les chargements ratés sont attendus.
    if (m.type() === 'error' && !horsLigne) problemes.push(`${page.url()} : ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    if (!horsLigne) problemes.push(`${page.url()} : ${e.message}`);
  });
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
const stockDe = async (page: Page, nom: string) => {
  await page.goto(`/stock?q=${encodeURIComponent(nom)}`);
  return page.getByRole('link', { name: new RegExp(nom) }).locator('span.text-lg');
};

test.describe.configure({ mode: 'serial' });

let salim: Page, lina: Page;
let telSalim = '', telLina = '', telVoisin = '';
let adresseFacture = '';

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const magasin = await creerCommercant(admin.id, 'Boutique Salim');
  const ctx = { commercantId: magasin.commercantId, utilisateurId: magasin.proprietaireId };
  await avecCommercant(magasin.commercantId, async (trx) => {
    for (const [nomFr, nomAr, prixVente, stockInitial, codeBarres] of [['Café moulu', 'قهوة مطحونة', 25_000, 10, CODE_CAMERA], ['Thé vert', 'شاي أخضر', 12_000, 1, null]] as const) {
      const r = await creerProduit(trx, ctx, { nomFr, nomAr, categorieId: null, variantes: [{ libelle: '', codeBarres, prixAchat: 10_000, prixVente, seuil: 0, stockInitial }] });
      if (!r.ok) throw new Error(r.raison);
    }
  });
  telSalim = magasin.telephone;
  telLina = telephone();
  const inv = await inviterEmploye({ commercantId: magasin.commercantId, parUtilisateur: magasin.proprietaireId, nom: 'Lina', telephone: telLina, role: 'vendeur' });
  if (!inv.ok) throw new Error('invitation refusée');
  await accepterInvitation(inv.jeton, { motDePasse: MDP_VENDEUSE });
  telVoisin = (await creerCommercant(admin.id, 'Voisin des ventes')).telephone;
  salim = await ouvrir(browser);
  await connecter(salim, telSalim, MDP);
});

test('vente en caisse : recherche, scan, monnaie à rendre, ticket', async () => {
  await salim.goto('/caisse');
  await expect(salim.getByText('Scannez ou cherchez un produit pour commencer la vente.')).toBeVisible();
  await expect(salim.getByRole('button', { name: 'Encaisser' })).toBeDisabled();
  await salim.getByRole('searchbox', { name: 'Chercher un produit' }).fill('thé');
  await salim.getByRole('button', { name: /Thé vert/ }).click();
  // Le scan ajoute le café vu par l'appareil photo, une seule fois.
  await salim.getByRole('button', { name: 'Scanner' }).click();
  await expect(salim.getByText('Café moulu', { exact: true })).toBeVisible({ timeout: 20_000 });
  await salim.getByRole('button', { name: 'Scanner' }).click();
  await salim.getByRole('button', { name: 'Ajouter un : Café moulu' }).click();
  await expect(salim.getByText('620 DA')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/caisse-fr-clair.png`, fullPage: true });

  await salim.getByRole('button', { name: 'Encaisser' }).click();
  await salim.getByLabel('Montant reçu (DA)').fill('500');
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(salim.locator('p[role=alert]')).toHaveText('Le montant reçu est plus petit que le total.');
  await salim.getByLabel('Montant reçu (DA)').fill('1000');
  await expect(salim.getByText('À rendre : 380 DA')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/encaissement-fr-clair.png`, fullPage: true });
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(salim.getByText(`Vente enregistrée : TK-${ANNEE}-00001`)).toBeVisible();
  await expect(salim.getByText('380 DA')).toBeVisible();
  await sansDebordement(salim);

  // Le ticket est un vrai PDF ; le stock a baissé.
  const lien = await salim.getByRole('link', { name: 'Ticket (PDF)' }).getAttribute('href');
  const pdf = await salim.request.get(lien!);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(await stockDe(salim, 'Café moulu')).toHaveText('8');
  await expect(await stockDe(salim, 'Thé vert')).toHaveText('0');
});

test('facture à la caisse, et vente qui passe même si le stock connu manque', async () => {
  await salim.goto('/caisse');
  await salim.getByRole('searchbox', { name: 'Chercher un produit' }).fill('thé');
  await salim.getByRole('button', { name: /Thé vert/ }).click();
  await salim.getByRole('button', { name: 'Ajouter un : Thé vert' }).click();
  await expect(salim.getByText('stock connu : 0')).toBeVisible();
  await salim.getByRole('button', { name: 'Encaisser' }).click();
  await salim.getByLabel('Facture (le client la demande)').check();
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(salim.locator('p[role=alert]')).toContainText('Indiquez le nom du client');
  await salim.getByLabel('Nom du client').fill('Sarl Atlas');
  await salim.getByLabel('Téléphone du client').fill('0661 44 55 66');
  await salim.getByText('Client professionnel').click();
  await salim.getByLabel(/NIF/).fill('001234567890');
  await sansDebordement(salim);
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(salim.getByText(`Vente enregistrée : FA-${ANNEE}-00001`)).toBeVisible();
  await expect(salim.getByText(/Le stock connu ne suffisait pas/)).toBeVisible();
  await salim.getByRole('link', { name: 'Voir le document' }).click();
  await expect(salim.getByRole('heading', { name: `Facture FA-${ANNEE}-00001` })).toBeVisible();
  adresseFacture = new URL(salim.url()).pathname;
  await expect(salim.getByText('Payée', { exact: true })).toBeVisible();
  await expect(salim.getByText('Sarl Atlas')).toBeVisible();
  await expect(salim.getByText('Deux cent quarante dinars')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/facture-fr-clair.png`, fullPage: true });

  // Le propriétaire voit le produit « à vérifier » dans le stock.
  await salim.goto('/stock');
  await expect(salim.getByText('Stock à vérifier (1)')).toBeVisible();
  await expect(salim.getByText(/2 vendu\(s\) sans stock connu/)).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/stock-a-verifier.png`, fullPage: true });
  await salim.getByRole('button', { name: 'Vérifié' }).click();
  await expect(salim.getByText(/Stock à vérifier/)).toHaveCount(0);
});

test('sans connexion, la vente est gardée dans le téléphone puis envoyée une seule fois', async () => {
  await salim.goto('/caisse');
  await salim.getByRole('searchbox', { name: 'Chercher un produit' }).fill('café');
  await salim.getByRole('button', { name: /Café moulu/ }).click();
  horsLigne = true;
  await salim.context().setOffline(true);
  await salim.getByRole('button', { name: 'Encaisser' }).click();
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(salim.getByText(/Pas de connexion : la vente est gardée dans ce téléphone/)).toBeVisible({ timeout: 20_000 });
  await salim.getByRole('button', { name: 'Nouvelle vente' }).click();
  await expect(salim.getByText(/1 vente\(s\) en attente d'envoi/)).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/caisse-hors-connexion.png`, fullPage: true });
  await salim.context().setOffline(false);
  await salim.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(salim.getByText(/en attente d'envoi/)).toHaveCount(0, { timeout: 20_000 });
  horsLigne = false;
  await salim.goto('/factures?onglet=tickets');
  await expect(salim.locator('main ul li')).toHaveCount(2);
  await expect(await stockDe(salim, 'Café moulu')).toHaveText('7');
});

test('une facture ne se modifie pas : elle s\'annule par un avoir, qui remet le stock', async () => {
  await salim.goto('/factures');
  await expect(salim.getByRole('link', { name: new RegExp(`FA-${ANNEE}-00001`) })).toContainText('Payée');
  await sansDebordement(salim);
  await salim.goto(adresseFacture);
  await salim.getByText('Annuler par un avoir').click();
  await salim.getByRole('button', { name: "Créer l'avoir" }).click();
  await expect(salim.getByRole('heading', { name: `Facture d'avoir AV-${ANNEE}-00001` })).toBeVisible();
  await expect(salim.getByText("Montant de l'avoir")).toBeVisible();
  await expect(salim.getByText('240 DA').first()).toBeVisible();
  await expect(salim.getByRole('link', { name: new RegExp(`Annule.*FA-${ANNEE}-00001`) })).toBeVisible();
  await sansDebordement(salim);
  await salim.getByRole('link', { name: new RegExp(`FA-${ANNEE}-00001`) }).click();
  await expect(salim.getByText('Annulé', { exact: true })).toBeVisible();
  await expect(salim.getByText('Annuler par un avoir')).toHaveCount(0);
  await expect(salim.getByRole('link', { name: new RegExp(`Annulé par.*AV-${ANNEE}-00001`) })).toBeVisible();
});

test('devis : création, modification, refus, puis « Vente directe »', async () => {
  await salim.goto('/factures?onglet=devis');
  await expect(salim.getByText('Aucun devis')).toBeVisible();
  await salim.getByRole('link', { name: 'Nouveau devis' }).click();
  await salim.getByRole('button', { name: 'Créer le devis' }).click();
  await expect(salim.locator('p[role=alert]')).toHaveText('Ajoutez au moins un produit.');
  await salim.getByLabel('Nom du client').fill('Karim B.');
  await salim.getByRole('searchbox', { name: 'Ajouter un produit du stock' }).fill('café');
  await salim.getByRole('searchbox', { name: 'Ajouter un produit du stock' }).press('Enter');
  await salim.getByRole('button', { name: /Café moulu/ }).click();
  await salim.getByLabel('Quantité').fill('2');
  await salim.getByLabel('Prix unitaire TTC (DA)').fill('240'); // prix négocié
  await salim.getByRole('button', { name: 'Ajouter une ligne libre' }).click();
  await salim.getByLabel('Ligne 2 : désignation').fill('Livraison');
  await salim.getByLabel('Prix unitaire TTC (DA)').nth(1).fill('400');
  await expect(salim.getByText('880 DA')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/devis-nouveau-fr-clair.png`, fullPage: true });
  await salim.getByRole('button', { name: 'Créer le devis' }).click();
  await expect(salim.getByRole('heading', { name: `Devis DV-${ANNEE}-00001` })).toBeVisible();
  await expect(salim.getByText('En attente', { exact: true })).toBeVisible();
  await expect(salim.getByText('Huit cent quatre-vingts dinars')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/devis-fr-clair.png`, fullPage: true });

  await salim.getByRole('link', { name: 'Modifier' }).click();
  await expect(salim.getByLabel('Nom du client')).toHaveValue('Karim B.');
  await salim.getByLabel('Quantité').first().fill('3');
  await salim.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(salim.getByText('1 120 DA').first()).toBeVisible();
  await salim.getByRole('button', { name: 'Refuser' }).click();
  await expect(salim.getByText('Refusé', { exact: true })).toBeVisible();
  await expect(salim.getByRole('button', { name: 'Vente directe' })).toHaveCount(0);
  await salim.getByRole('button', { name: 'Rouvrir le devis' }).click();

  // Le devis n'a pas touché au stock ; la vente directe le sort et paie la facture.
  await expect(await stockDe(salim, 'Café moulu')).toHaveText('7');
  await salim.goto('/factures?onglet=devis');
  await salim.getByRole('link', { name: new RegExp(`DV-${ANNEE}-00001`) }).click();
  await salim.getByRole('button', { name: 'Vente directe' }).click();
  await expect(salim.getByRole('heading', { name: `Facture FA-${ANNEE}-00002` })).toBeVisible();
  await expect(salim.getByText('Payée', { exact: true })).toBeVisible();
  await expect(salim.getByText('Karim B.')).toBeVisible();
  await salim.getByRole('link', { name: new RegExp(`Vient de.*DV-${ANNEE}-00001`) }).click();
  await expect(salim.getByText('Transformé en facture', { exact: true })).toBeVisible();
  await expect(salim.getByRole('link', { name: 'Modifier' })).toHaveCount(0);
  await expect(await stockDe(salim, 'Café moulu')).toHaveText('4');
});

test('« Envoi » réserve le stock ; l\'encaissement crée le reçu', async () => {
  await salim.goto('/factures/nouveau?type=devis');
  await salim.getByRole('searchbox', { name: 'Ajouter un produit du stock' }).fill('café');
  await salim.getByRole('searchbox', { name: 'Ajouter un produit du stock' }).press('Enter');
  await salim.getByRole('button', { name: /Café moulu/ }).click();
  await salim.getByRole('button', { name: 'Créer le devis' }).click();
  // Devis sans client : la facture demande son nom.
  await salim.getByRole('button', { name: 'Envoi', exact: true }).click();
  await expect(salim.locator('p[role=alert]')).toContainText('Indiquez le nom du client');
  await salim.getByLabel('Nom du client').nth(1).fill('Client de Sétif');
  await salim.getByRole('button', { name: 'Envoi', exact: true }).click();
  await expect(salim.getByRole('heading', { name: `Facture FA-${ANNEE}-00003` })).toBeVisible();
  await expect(salim.getByText('À payer', { exact: true })).toBeVisible();
  await expect(salim.getByText('Paiement à la livraison.')).toBeVisible();
  const facture = new URL(salim.url()).pathname;
  await sansDebordement(salim);
  await salim.goto('/stock?q=café');
  await salim.getByRole('link', { name: /Café moulu/ }).click();
  await expect(salim.getByText('dont 1 réservés')).toBeVisible();

  await salim.goto(facture);
  await salim.getByRole('button', { name: 'Encaisser en espèces' }).click();
  await expect(salim.getByRole('heading', { name: `Reçu de paiement RC-${ANNEE}-00001` })).toBeVisible();
  await salim.getByRole('link', { name: new RegExp(`Règle.*FA-${ANNEE}-00003`) }).click();
  await expect(salim.getByText('Payée', { exact: true })).toBeVisible();
  await expect(salim.getByRole('button', { name: 'Encaisser en espèces' })).toHaveCount(0);
});

test('proforma → bon de livraison → facture, sans ressaisie', async () => {
  await salim.goto('/factures?onglet=autres');
  await salim.getByRole('link', { name: 'Facture proforma' }).click();
  await salim.getByLabel('Nom du client').fill('Banque du client');
  await salim.getByRole('button', { name: 'Ajouter une ligne libre' }).click();
  await salim.getByLabel('Ligne 1 : désignation').fill('Lot de 10 cartons');
  await salim.getByLabel('Prix unitaire TTC (DA)').fill('15000');
  await salim.getByRole('button', { name: 'Créer la proforma' }).click();
  await expect(salim.getByRole('heading', { name: `Facture proforma PF-${ANNEE}-00001` })).toBeVisible();
  await salim.getByText('Créer un autre document').click();
  await salim.getByRole('button', { name: 'Créer : Bon de livraison' }).click();
  await expect(salim.getByRole('heading', { name: `Bon de livraison BL-${ANNEE}-00001` })).toBeVisible();
  await salim.getByRole('button', { name: 'Vente directe' }).click();
  await expect(salim.getByRole('heading', { name: `Facture FA-${ANNEE}-00004` })).toBeVisible();
  await expect(salim.getByText('15 000 DA').first()).toBeVisible();
  await expect(salim.getByRole('link', { name: new RegExp(`Vient de.*BL-${ANNEE}-00001`) })).toBeVisible();
  await salim.goto('/factures?onglet=autres');
  await expect(salim.locator('main ul li')).toHaveCount(4); // proforma, bon de livraison, avoir, reçu
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/factures-autres-fr-clair.png`, fullPage: true });
});

test('la vendeuse vend et facture, mais n\'annule rien et ne touche pas aux réglages', async ({ browser }) => {
  lina = await ouvrir(browser);
  await connecter(lina, telLina, MDP_VENDEUSE);
  await lina.goto(adresseFacture);
  await expect(lina.getByRole('heading', { name: `Facture FA-${ANNEE}-00001` })).toBeVisible();
  await lina.goto('/factures');
  await lina.getByRole('link', { name: new RegExp(`FA-${ANNEE}-00004`) }).click();
  await expect(lina.getByText('Annuler par un avoir')).toHaveCount(0);
  for (const chemin of ['/reglages/facturation', '/admin/reglages']) {
    await lina.goto(chemin);
    await expect(lina).not.toHaveURL(new RegExp(`${chemin}$`));
  }
  await lina.goto('/caisse');
  await lina.getByRole('searchbox', { name: 'Chercher un produit' }).fill('café');
  await lina.getByRole('button', { name: /Café moulu/ }).click();
  await lina.getByRole('button', { name: 'Encaisser' }).click();
  await lina.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(lina.getByText(`Vente enregistrée : TK-${ANNEE}-00003`)).toBeVisible();
});

test('TVA : une fois activée, la facture sépare le hors taxe et la taxe', async () => {
  await salim.goto('/reglages');
  await salim.getByRole('link', { name: /Facturation/ }).click();
  await salim.getByLabel(/Je facture la TVA/).check();
  await salim.getByLabel('Taux de TVA par défaut (%)').fill('abc');
  await salim.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(salim.locator('p[role=alert]')).toContainText('Taux invalide');
  await salim.getByLabel('Taux de TVA par défaut (%)').fill('19');
  await salim.getByLabel('Texte en bas des documents').fill('Merci de votre visite');
  await salim.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(salim.getByText('Modifications enregistrées.')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/facturation-fr-clair.png`, fullPage: true });
  // Le taux se règle aussi par produit.
  await salim.goto('/stock?q=thé');
  await salim.getByRole('link', { name: /Thé vert/ }).click();
  await salim.getByRole('link', { name: 'Modifier' }).click();
  await salim.getByLabel('TVA de ce produit (%)').fill('9');
  await salim.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(salim.getByRole('heading', { name: 'Thé vert' })).toBeVisible();

  await salim.goto('/caisse');
  for (const produit of ['café', 'thé']) {
    await salim.getByRole('searchbox', { name: 'Chercher un produit' }).fill(produit);
    await salim.getByRole('button', { name: new RegExp(produit === 'café' ? 'Café moulu' : 'Thé vert') }).click();
  }
  await salim.getByRole('button', { name: 'Encaisser' }).click();
  await salim.getByLabel('Facture (le client la demande)').check();
  await salim.getByLabel('Nom du client').fill('Client TVA');
  await salim.getByRole('button', { name: 'Valider la vente' }).click();
  await salim.getByRole('link', { name: 'Voir le document' }).click();
  // 250 TTC à 19 % → 210,08 HT ; 120 TTC à 9 % → 110,09 HT.
  await expect(salim.getByText('320,17 DA')).toBeVisible();
  await expect(salim.getByText('49,83 DA')).toBeVisible();
  await expect(salim.getByText('370 DA').first()).toBeVisible();
  await expect(salim.getByText(/TVA 19\s%/)).toBeVisible();
  await expect(salim.getByText(/TVA 9\s%/)).toBeVisible();
});

test('clôture de caisse : on compte d\'abord, l\'écart est gardé', async () => {
  await salim.goto('/caisse');
  await salim.getByRole('link', { name: 'Clôture' }).click();
  await expect(salim.getByText('Compter et clôturer')).toBeVisible();
  await expect(salim.getByText('Espèces attendues')).toHaveCount(0); // pas montrées avant le comptage
  await salim.getByText('Changer le fond de caisse').click();
  await salim.getByLabel('Fond de caisse (DA)').fill('5000');
  await salim.getByRole('button', { name: 'Enregistrer le fond' }).click();
  await expect(salim.getByText('5 000 DA')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/cloture-fr-clair.png`, fullPage: true });
  await salim.getByLabel('Espèces comptées (DA)').fill('5000');
  await salim.getByLabel('Note (facultatif)').fill('Comptage du soir');
  await salim.getByRole('button', { name: 'Clôturer la caisse' }).click();
  await expect(salim.getByRole('heading', { name: 'Rapport de clôture' })).toBeVisible();
  // Encaissé : 620 + 240 + 250 + 1 120 + 250 + 15 000 + 250 + 370, moins l'avoir de 240.
  await expect(salim.getByText('18 100 DA')).toBeVisible();
  await expect(salim.getByText('-240 DA')).toBeVisible();
  await expect(salim.getByText('22 860 DA')).toBeVisible();
  await expect(salim.getByText('Il manque 17 860 DA dans la caisse.')).toBeVisible();
  await expect(salim.getByText('Comptage du soir')).toBeVisible();
  await sansDebordement(salim);
  await salim.screenshot({ path: `${CAPTURES}/cloture-rapport-fr-clair.png`, fullPage: true });
  await salim.goto('/caisse/cloture');
  await expect(salim.getByText('La caisse est fermée.')).toBeVisible();
  await expect(salim.getByText('Clôtures précédentes')).toBeVisible();
});

test('un autre commerçant ne voit ni les documents ni les PDF', async ({ browser }) => {
  const voisin = await ouvrir(browser);
  expect((await voisin.request.get(`${adresseFacture}/pdf`)).status()).toBe(401);
  await connecter(voisin, telVoisin, MDP);
  expect((await voisin.request.get(`${adresseFacture}/pdf`)).status()).toBe(404);
  await voisin.goto(adresseFacture);
  await expect(voisin.getByText(`FA-${ANNEE}-00001`)).toHaveCount(0);
  await voisin.goto('/factures');
  await expect(voisin.getByText('Aucune facture')).toBeVisible();
  await voisin.context().close();
});

test('tous les écrans de la caisse et des factures en arabe, en thème sombre', async () => {
  await salim.goto('/factures');
  await salim.getByRole('button', { name: /العربية/ }).click();
  await expect(salim.locator('html')).toHaveAttribute('dir', 'rtl');
  await salim.goto('/plus');
  await salim.getByRole('button', { name: 'داكن' }).click();
  await expect(salim.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');
  const ecrans: [string, string][] = [
    ['/caisse', 'caisse'], ['/caisse/cloture', 'cloture'], ['/factures', 'factures'], ['/factures?onglet=devis', 'devis-liste'], ['/factures?onglet=autres', 'autres'],
    [adresseFacture, 'facture'], ['/factures/nouveau?type=devis', 'devis-nouveau'], ['/reglages/facturation', 'facturation'],
  ];
  for (const [chemin, nom] of ecrans) {
    await salim.goto(chemin);
    await expect(salim.locator('h1')).toBeVisible();
    await sansDebordement(salim);
    await salim.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await salim.goto(adresseFacture);
  await expect(salim.getByText('مائتان وأربعون دينار جزائري')).toBeVisible();
  // Le PDF arabe sort bien.
  const pdf = await salim.request.get(`${adresseFacture}/pdf?langue=ar`);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await salim.goto('/plus');
  await salim.getByRole('button', { name: 'فاتح' }).click();
  await salim.getByRole('button', { name: /Français/ }).click();
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
