// Suites du test « comme un commerçant » (docs/test-commercant/01-rapport.md), sur un téléphone de 360 px :
// nouvelle facture sans passer par un devis, ajout et correction d'un client, panier de la caisse replié
// (les 3 derniers articles en haut), montants rapides, stock et catégories dans la grille, « achats » des clients.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { creerProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP } from '../outils.ts';

const problemes: string[] = [];
async function ouvrir(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on('console', (m) => { if (m.type() === 'error') problemes.push(`${page.url()} : ${m.text()}`); });
  page.on('pageerror', (e) => problemes.push(`${page.url()} : ${e.message}`));
  return page;
}
async function sansDebordement(page: Page) {
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, `débordement sur ${page.url()}`).toBeLessThanOrEqual(360);
}

test.describe.configure({ mode: 'serial' });

let nadia: Page;

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const m = await creerCommercant(admin.id, 'Superette Nadia');
  const ctx = { commercantId: m.commercantId, utilisateurId: m.proprietaireId };
  await avecCommercant(m.commercantId, async (trx) => {
    await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: false }) }).execute();
    const epicerie = await trx.insertInto('categories').values({ commercant_id: m.commercantId, nom_fr: 'Épicerie' }).returning('id').executeTakeFirstOrThrow();
    const boissons = await trx.insertInto('categories').values({ commercant_id: m.commercantId, nom_fr: 'Boissons' }).returning('id').executeTakeFirstOrThrow();
    const produits = [['Huile 5 L', epicerie.id, 120_000, 10], ['Sucre 1 kg', epicerie.id, 12_000, 40], ['Farine 1 kg', epicerie.id, 9_000, 30], ['Eau 1,5 L', boissons.id, 4_000, 60], ['Jus orange', boissons.id, 15_000, 0]] as const;
    for (const [nomFr, categorieId, prixVente, stockInitial] of produits) {
      const r = await creerProduit(trx, ctx, { nomFr, nomAr: '', categorieId, variantes: [{ libelle: '', codeBarres: null, prixAchat: Math.round(prixVente * 0.8), prixVente, seuil: 0, stockInitial }] });
      if (!r.ok) throw new Error(r.raison);
    }
  });
  nadia = await ouvrir(browser);
  await nadia.goto('/connexion');
  await nadia.getByLabel('Numéro de téléphone').fill(m.telephone);
  await nadia.getByLabel('Mot de passe').fill(MDP);
  await nadia.getByRole('button', { name: 'Se connecter' }).click();
  await expect(nadia.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
});

test('caisse : les 3 derniers articles en haut, le reste replié ; stock et catégories dans la grille', async () => {
  await nadia.goto('/caisse');
  const grille = nadia.getByRole('region', { name: 'Produits' });
  await expect(grille.getByRole('button', { name: /Huile 5 L.*Stock : 10/ })).toBeVisible();
  await expect(grille.getByRole('button', { name: /Jus orange.*Rupture/ })).toBeVisible();
  // Filtre par catégorie.
  await nadia.getByRole('button', { name: 'Boissons' }).click();
  await expect(grille.getByRole('button', { name: /Huile 5 L/ })).toHaveCount(0);
  await expect(grille.getByRole('button', { name: /Eau 1,5 L/ })).toBeVisible();
  await nadia.getByRole('button', { name: 'Tout', exact: true }).click();
  for (const n of ['Huile 5 L', 'Sucre 1 kg', 'Farine 1 kg', 'Eau 1,5 L']) await grille.getByRole('button', { name: new RegExp(n) }).click();
  const panier = nadia.getByRole('region', { name: 'Panier' });
  // Le dernier touché en haut ; le 4e (le plus ancien) est replié.
  await expect(panier.getByRole('listitem')).toHaveCount(3);
  await expect(panier.getByRole('listitem').first()).toContainText('Eau 1,5 L');
  await expect(panier.getByText('Huile 5 L')).toHaveCount(0);
  // Retoucher un produit déjà dans le panier le remonte en haut.
  await grille.getByRole('button', { name: /Farine 1 kg/ }).click();
  await expect(panier.getByRole('listitem').first()).toContainText('Farine 1 kg');
  await panier.getByRole('button', { name: /Voir 1 autre ligne \(5 articles en tout\)/ }).click();
  await expect(panier.getByRole('listitem')).toHaveCount(4);
  await expect(panier.getByText('Huile 5 L')).toBeVisible();
  await panier.getByRole('button', { name: 'Replier le panier' }).click();
  await expect(panier.getByRole('listitem')).toHaveCount(3);
  await sansDebordement(nadia);
  // Montants rapides : compte exact, puis billets. Total : 1 200 + 120 + 2 × 90 + 40 = 1 540 DA.
  await nadia.getByRole('button', { name: 'Encaisser' }).click();
  const rapides = nadia.getByRole('group', { name: 'Montants rapides' });
  await expect(rapides.getByRole('button')).toHaveText(['Compte exact', '1 600', '2 000', '5 000']);
  await rapides.getByRole('button', { name: '2 000' }).click();
  await expect(nadia.getByLabel('Montant reçu (DA)')).toHaveValue('2000');
  await expect(nadia.getByText('À rendre : 460 DA')).toBeVisible();
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(nadia.getByText(/Vente enregistrée : TK-/)).toBeVisible();
});

test('nouvelle facture directement depuis Factures, payée par virement ; puis une facture à crédit', async () => {
  await nadia.goto('/factures');
  await nadia.getByRole('link', { name: 'Nouvelle facture' }).click();
  await expect(nadia.getByRole('heading', { name: 'Nouvelle facture' })).toBeVisible();
  await nadia.getByLabel('Nom du client').fill('SARL Atlas');
  await nadia.getByLabel('Téléphone du client').fill('0661 22 33 44');
  await nadia.getByLabel('Ajouter un produit du stock').fill('sucre');
  await nadia.getByRole('button', { name: 'Chercher' }).click();
  await nadia.getByRole('button', { name: /Sucre 1 kg/ }).click();
  await nadia.getByLabel('Quantité').fill('10');
  await nadia.getByLabel('Comment le client paie').selectOption('virement');
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Créer la facture' }).click();
  await expect(nadia.getByRole('heading', { name: /^Facture FA-/ })).toBeVisible();
  await expect(nadia.getByText('Payée', { exact: true })).toBeVisible();
  await expect(nadia.getByText(/Payé le .* virement/)).toBeVisible();
  // Le stock est sorti (40 − 1 vendu en caisse − 10).
  await nadia.goto('/stock?q=Sucre');
  await expect(nadia.getByRole('link', { name: /Sucre 1 kg/ }).locator('span.text-lg')).toHaveText('29');

  // À crédit : la facture reste à payer et le client doit la somme.
  await nadia.goto('/factures/nouveau?type=facture');
  await nadia.getByLabel('Nom du client').fill('Karim Boulangerie');
  await nadia.getByLabel('Téléphone du client').fill('0770 11 22 33');
  await nadia.getByRole('button', { name: 'Ajouter une ligne libre' }).click();
  await nadia.getByLabel('Ligne 1 : désignation').fill('Livraison de farine');
  await nadia.getByLabel('Prix unitaire TTC (DA)').fill('3000');
  await nadia.getByLabel('Comment le client paie').selectOption('credit');
  await nadia.getByRole('button', { name: 'Créer la facture' }).click();
  await expect(nadia.getByText('À payer', { exact: true }).first()).toBeVisible();
  // Sans nom de client, une facture est refusée.
  await nadia.goto('/factures/nouveau?type=facture');
  await expect(nadia.getByLabel('Nom du client')).toHaveAttribute('required', '');
});

test('clients : ajouter, corriger, numéro déjà pris refusé ; « achats » comptés à part des commandes', async () => {
  await nadia.goto('/clients');
  // Karim a acheté par facture (à crédit) : 1 achat, pas « aucune commande ».
  await expect(nadia.getByRole('link', { name: /Karim Boulangerie/ })).toContainText('1 achat');
  await expect(nadia.getByRole('link', { name: /Karim Boulangerie/ })).toContainText('Doit 3 000 DA');
  await nadia.getByRole('link', { name: 'Ajouter un client' }).click();
  await nadia.getByLabel('Nom du client').fill('Hôtel El Djazair');
  await nadia.getByLabel('Téléphone (facultatif)').fill('0770 11 22 33'); // déjà à Karim
  await nadia.getByRole('button', { name: 'Ajouter le client' }).click();
  await expect(nadia.getByText('Un client a déjà ce numéro. Cherchez-le dans la liste.')).toBeVisible();
  await nadia.getByLabel('Téléphone (facultatif)').fill('0555 66 77 88');
  await nadia.getByText('Client professionnel : adresse, NIF, RC…').click();
  await nadia.getByLabel('Adresse').fill('1 rue Didouche Mourad, Alger');
  await nadia.getByLabel(/Note/).fill('Commande chaque lundi');
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Ajouter le client' }).click();
  await expect(nadia.getByRole('heading', { name: 'Hôtel El Djazair' })).toBeVisible();
  await expect(nadia.getByText('Commande chaque lundi')).toBeVisible();
  await expect(nadia.getByText('1 rue Didouche Mourad, Alger')).toBeVisible();
  await nadia.getByRole('link', { name: 'Modifier' }).click();
  await expect(nadia.getByLabel('Adresse')).toHaveValue('1 rue Didouche Mourad, Alger'); // volet ouvert : déjà rempli
  await nadia.getByLabel('Nom du client').fill('Hôtel El Djazaïr');
  await nadia.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(nadia.getByRole('heading', { name: 'Hôtel El Djazaïr' })).toBeVisible();
  await expect(nadia.getByText('0555 66 77 88')).toBeVisible();
  await sansDebordement(nadia);
  // Une vente au même numéro, sans adresse, n'efface pas l'adresse saisie sur la fiche.
  await nadia.goto('/factures/nouveau?type=facture');
  await nadia.getByLabel('Nom du client').fill('Hôtel El Djazaïr');
  await nadia.getByLabel('Téléphone du client').fill('0555667788');
  await nadia.getByRole('button', { name: 'Ajouter une ligne libre' }).click();
  await nadia.getByLabel('Ligne 1 : désignation').fill('Eau minérale');
  await nadia.getByLabel('Prix unitaire TTC (DA)').fill('500');
  await nadia.getByRole('button', { name: 'Créer la facture' }).click();
  await expect(nadia.getByRole('heading', { name: /^Facture FA-/ })).toBeVisible();
  await nadia.goto('/clients?q=0555667788');
  await nadia.getByRole('link', { name: /Hôtel El Djazaïr/ }).click();
  await expect(nadia.getByText('1 rue Didouche Mourad, Alger')).toBeVisible();
  await expect(nadia.getByText('Commande chaque lundi')).toBeVisible();
});

test('les nouveaux écrans en arabe', async () => {
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'العربية' }).click();
  await expect(nadia.locator('html')).toHaveAttribute('lang', 'ar');
  for (const chemin of ['/clients/nouveau', '/factures/nouveau?type=facture', '/caisse']) {
    await nadia.goto(chemin);
    await sansDebordement(nadia);
  }
  await expect(nadia.getByRole('button', { name: 'الكل', exact: true })).toBeVisible();
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'Français' }).click();
});

test('aucune erreur de script pendant tout le parcours', () => {
  expect(problemes).toEqual([]);
});
