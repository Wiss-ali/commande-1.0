// Parcours de l'étape 2 sur un écran de téléphone de 360 px : produits, stock, scan, inventaire, étiquettes, import.
import { expect, test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { accepterInvitation, inviterEmploye } from '../../src/lib/invitations.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';
import { CODE_CAMERA } from './preparation.ts';

const CAPTURES = 'docs/etape-2/captures';
const MDP_VENDEUR = 'vendeur du magasin';

const problemes: string[] = [];
async function ouvrir(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
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
const stockAffiche = (page: Page) => page.locator('p.text-3xl');

test.describe.configure({ mode: 'serial' });

let nadia: Page, karim: Page, voisin: Page;
let telNadia = '', telKarim = '', telVoisin = '';
let adresseCafe = '';

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const magasin = await creerCommercant(admin.id, 'Épicerie Nadia');
  telNadia = magasin.telephone;
  telKarim = telephone();
  const inv = await inviterEmploye({ commercantId: magasin.commercantId, parUtilisateur: magasin.proprietaireId, nom: 'Karim', telephone: telKarim, role: 'vendeur' });
  if (!inv.ok) throw new Error('invitation refusée');
  await accepterInvitation(inv.jeton, { motDePasse: MDP_VENDEUR });
  telVoisin = (await creerCommercant(admin.id, 'Magasin voisin')).telephone;
  nadia = await ouvrir(browser);
  await connecter(nadia, telNadia, MDP);
});

test('stock vide, puis création d\'un produit simple', async () => {
  await nadia.goto('/stock');
  await expect(nadia.getByText("Aucun produit pour l'instant")).toBeVisible();
  await sansDebordement(nadia);
  await nadia.getByRole('link', { name: 'Ajouter un produit' }).click();
  await expect(nadia.getByRole('heading', { name: 'Nouveau produit' })).toBeVisible();
  await sansDebordement(nadia);

  // Fiche incomplète : message clair, et la saisie reste en place.
  await nadia.getByLabel('Nom en français').fill('Café moulu 250 g');
  await nadia.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(nadia.locator('p[role=alert]')).toHaveText('Indiquez le prix de vente.');
  await nadia.getByLabel('Prix de vente (DA)').fill('abc');
  await nadia.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(nadia.locator('p[role=alert]')).toContainText('Prix invalide');
  await expect(nadia.getByLabel('Nom en français')).toHaveValue('Café moulu 250 g');

  await nadia.getByLabel('Nom en arabe').fill('قهوة مطحونة');
  await nadia.getByLabel('Catégorie').selectOption({ label: 'Nouvelle catégorie…' });
  await nadia.getByLabel('Nom de la nouvelle catégorie').fill('Épicerie');
  await nadia.getByLabel('Prix de vente (DA)').fill('250');
  await nadia.getByLabel("Prix d'achat (DA)").fill('180,50');
  await nadia.getByLabel('Code-barres').fill(CODE_CAMERA);
  await nadia.getByLabel('Quantité en stock').fill('12');
  await nadia.getByLabel("Seuil d'alerte").fill('5');
  const photo = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#0e6b4e' } }).png().toBuffer();
  await nadia.locator('input[type=file]').first().setInputFiles({ name: 'cafe.png', mimeType: 'image/png', buffer: photo });
  await expect(nadia.getByRole('button', { name: 'Retirer' })).toBeVisible();
  await nadia.screenshot({ path: `${CAPTURES}/produit-nouveau.png`, fullPage: true });
  await nadia.getByRole('button', { name: 'Créer le produit' }).click();

  await expect(nadia.getByRole('heading', { name: 'Café moulu 250 g' })).toBeVisible();
  adresseCafe = new URL(nadia.url()).pathname;
  await expect(stockAffiche(nadia)).toHaveText('12');
  await expect(nadia.getByText('En stock', { exact: true }).last()).toBeVisible();
  await expect(nadia.getByText('180,50 DA')).toBeVisible();
  await expect(nadia.getByText('Épicerie', { exact: true })).toBeVisible();
  await expect(nadia.getByText('Entrée · stock de départ')).toBeVisible();
  // La photo a été réécrite par le serveur en WebP.
  const image = nadia.locator('main img').first();
  await expect(image).toBeVisible();
  const reponse = await nadia.request.get((await image.getAttribute('src'))!);
  expect(reponse.headers()['content-type']).toBe('image/webp');
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/produit-fr-clair.png`, fullPage: true });
});

test('entrée et sortie de stock, avec historique et refus de passer sous zéro', async () => {
  await nadia.getByText('Entrée de stock').click();
  await nadia.getByLabel('Quantité reçue').fill('6');
  await nadia.getByLabel("Nouveau prix d'achat (DA)").fill('190');
  await nadia.getByRole('button', { name: 'Ajouter au stock' }).click();
  await expect(stockAffiche(nadia)).toHaveText('18');
  await expect(nadia.getByText('190 DA')).toBeVisible();

  await nadia.getByText('Sortie : casse, perte, erreur').click();
  await nadia.getByLabel('Quantité à retirer').fill('100');
  await nadia.getByRole('button', { name: 'Retirer du stock' }).click();
  await expect(nadia.locator('p[role=alert]')).toHaveText("Il n'y a pas assez de stock.");
  await nadia.getByLabel('Quantité à retirer').fill('2');
  await nadia.getByLabel('Raison').selectOption({ label: 'casse' });
  await nadia.getByRole('button', { name: 'Retirer du stock' }).click();
  await expect(stockAffiche(nadia)).toHaveText('16');
  await expect(nadia.getByText('Correction · casse')).toBeVisible();
  await expect(nadia.getByText('Entrée · réception')).toBeVisible();
  await sansDebordement(nadia);
});

test('produit avec variantes, liste, recherche et filtres', async () => {
  await nadia.goto('/stock/nouveau');
  await nadia.getByLabel('Nom en français').fill('T-shirt uni');
  await nadia.getByLabel('Ce produit existe en plusieurs tailles ou couleurs').check();
  await nadia.getByLabel('Variante 1').fill('M');
  await nadia.getByLabel('Prix de vente (DA)').fill('900');
  await nadia.getByLabel('Quantité en stock').fill('3');
  await nadia.getByLabel("Seuil d'alerte").fill('1');
  await nadia.getByRole('button', { name: 'Ajouter une variante' }).click();
  await nadia.getByLabel('Variante 2').fill('L');
  // La nouvelle variante reprend le prix de la précédente.
  await expect(nadia.getByLabel('Prix de vente (DA)').nth(1)).toHaveValue('900');
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(nadia.getByRole('heading', { name: 'T-shirt uni' })).toBeVisible();
  await expect(stockAffiche(nadia)).toHaveText(['3', '0']);

  await nadia.goto('/stock');
  const lignes = nadia.locator('main ul').first().locator('li');
  await expect(lignes).toHaveCount(2);
  await expect(lignes.nth(1)).toContainText('2 variantes');
  await expect(lignes.nth(1)).toContainText('Stock bas'); // une taille est à zéro
  await expect(nadia.getByText('Valeur du stock au prix d\'achat :')).toContainText('3 040 DA'); // 16 × 190
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/stock-fr-clair.png`, fullPage: true });

  await nadia.getByRole('link', { name: /^Stock bas/ }).click();
  await expect(lignes).toHaveCount(1);
  await expect(lignes).toContainText('T-shirt uni');
  await nadia.getByRole('link', { name: /^Rupture/ }).click();
  await expect(nadia.getByText('Aucun produit trouvé')).toBeVisible();
  await nadia.goto('/stock');
  await nadia.getByRole('searchbox').fill(CODE_CAMERA);
  await nadia.getByRole('searchbox').press('Enter');
  await expect(lignes).toHaveCount(1);
  await expect(lignes).toContainText('Café moulu 250 g');
});

test('le scan par l\'appareil photo retrouve le produit ; un code inconnu propose de le créer', async () => {
  await nadia.goto('/scan');
  // La fausse caméra montre le code-barres du café : il est lu par le lecteur WebAssembly.
  await expect(nadia.getByText('Café moulu 250 g')).toBeVisible({ timeout: 20_000 });
  await expect(nadia.getByText('250 DA')).toBeVisible();
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/scan-fr-clair.png`, fullPage: true });

  await nadia.getByLabel('Ou tapez le code').fill('9999999999999');
  await nadia.getByRole('button', { name: 'Valider' }).click();
  await expect(nadia.getByText('Code inconnu')).toBeVisible();
  await nadia.getByRole('link', { name: 'Créer un produit avec ce code' }).click();
  await expect(nadia.getByLabel('Code-barres')).toHaveValue('9999999999999');

  // Dans la fiche, le bouton « Scanner » remplit le code avec ce que voit l'appareil photo.
  await nadia.getByRole('button', { name: 'Scanner' }).click();
  await expect(nadia.getByRole('dialog')).toBeVisible();
  await expect(nadia.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
  await expect(nadia.getByLabel('Code-barres')).toHaveValue(CODE_CAMERA);
  await nadia.getByLabel('Nom en français').fill('Doublon');
  await nadia.getByLabel('Prix de vente (DA)').fill('10');
  await nadia.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(nadia.locator('p[role=alert]')).toHaveText('Ce code-barres est déjà utilisé par un autre produit.');
});

test('inventaire : comptage par scan, écarts, validation par le propriétaire', async () => {
  await nadia.goto('/stock/inventaire');
  await nadia.getByRole('button', { name: 'Commencer un inventaire' }).click();
  // La caméra voit le café : il est compté une seule fois tant qu'il reste devant l'objectif.
  await expect(nadia.getByText('Café moulu 250 g : 1 compté(s)')).toBeVisible({ timeout: 20_000 });
  const quantite = nadia.getByLabel('Quantité comptée de Café moulu 250 g');
  await expect(quantite).toHaveValue('1');
  await quantite.fill('15');
  await quantite.press('Enter');
  await expect(nadia.getByText('Café moulu 250 g : 15 compté(s)')).toBeVisible();

  // Produit sans code-barres : on le cherche par son nom.
  await nadia.getByRole('searchbox', { name: 'Produit sans code-barres ?' }).fill('shirt');
  await nadia.getByRole('searchbox', { name: 'Produit sans code-barres ?' }).press('Enter');
  await nadia.getByRole('listitem').filter({ hasText: 'T-shirt uni · L' }).getByRole('button', { name: 'Compter' }).click();
  await expect(nadia.getByText('T-shirt uni · L : 1 compté(s)')).toBeVisible();
  await expect(nadia.getByText('Articles comptés (2)')).toBeVisible();
  const ecarts = nadia.locator('table tbody tr');
  await expect(ecarts.filter({ hasText: 'Café' })).toContainText('−1');
  await expect(ecarts.filter({ hasText: 'T-shirt' })).toContainText('+1');
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/inventaire-fr-clair.png`, fullPage: true });

  await nadia.getByRole('button', { name: "Valider l'inventaire" }).click();
  await expect(nadia.getByText('2 articles comptés, 2 corrigés.')).toBeVisible();
  await sansDebordement(nadia);
  await nadia.goto(adresseCafe);
  await expect(stockAffiche(nadia)).toHaveText('15');
  await expect(nadia.getByText('Correction · inventaire')).toBeVisible();
  await nadia.goto(`/stock/mouvements?produit=${adresseCafe.split('/').pop()}`);
  await expect(nadia.locator('main ul li')).toHaveCount(4);
  await sansDebordement(nadia);
});

test('étiquettes : code interne pour un produit sans code-barres, puis planche à imprimer', async () => {
  await nadia.goto('/stock/etiquettes');
  await expect(nadia.getByText('2 article(s) sans code-barres.')).toBeVisible();
  await nadia.getByRole('button', { name: 'Créer un code' }).first().click();
  await expect(nadia.getByText('1 article(s) sans code-barres.')).toBeVisible();
  await nadia.getByRole('button', { name: 'Créer un code' }).click();
  await expect(nadia.getByText(/sans code-barres/)).toHaveCount(0);
  // Les codes internes commencent par 2 (plage réservée aux magasins).
  await expect(nadia.locator('label span.chiffres').filter({ hasText: /^2\d{12}$/ })).toHaveCount(2);
  await nadia.getByLabel(/Café moulu/).fill('3');
  await nadia.getByLabel(/T-shirt uni · M/).fill('2');
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Préparer les étiquettes' }).click();
  await expect(nadia.getByRole('button', { name: 'Imprimer 5 étiquettes' })).toBeVisible();
  await expect(nadia.locator('li.etiquette')).toHaveCount(5);
  await expect(nadia.locator('li.etiquette').first()).toContainText('250 DA');
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/etiquettes-fr-clair.png`, fullPage: true });
});

test('import depuis Excel : aperçu, lignes fausses signalées, pas de doublon', async () => {
  await nadia.goto('/stock/import');
  const modele = await nadia.request.get('/stock/import/modele');
  expect(modele.headers()['content-type']).toContain('spreadsheetml');
  await nadia.locator('input[type=file]').setInputFiles('tests/fixtures/produits.xlsx');
  await expect(nadia.getByText('3 produits prêts à être importés (4 articles)')).toBeVisible();
  await expect(nadia.getByText('2 lignes ignorées')).toBeVisible();
  await expect(nadia.getByText('Ligne 8')).toBeVisible();
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/import-fr-clair.png`, fullPage: true });
  await nadia.getByRole('button', { name: 'Importer 3 produits' }).click();
  // Le café du fichier porte le code d'un produit déjà en stock : il n'est pas créé une seconde fois.
  await expect(nadia.getByText('2 produits ajoutés au stock (3 articles).')).toBeVisible();
  await expect(nadia.getByText('produit déjà présent dans le stock')).toBeVisible();
  await nadia.goto('/stock');
  await expect(nadia.locator('main ul').first().locator('li')).toHaveCount(4);
  await expect(nadia.getByRole('link', { name: /Savon/ })).toContainText('1 200 DA');

  await nadia.goto('/stock/import');
  await nadia.locator('input[type=file]').setInputFiles({ name: 'faux.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK ceci n\'est pas un fichier Excel') });
  await expect(nadia.locator('p[role=alert]')).toContainText('Ce fichier ne peut pas être lu');
});

test('le vendeur : droits accordés par la propriétaire, jamais de prix d\'achat ni de correction', async ({ browser }) => {
  karim = await ouvrir(browser);
  await connecter(karim, telKarim, MDP_VENDEUR);
  await karim.goto('/stock');
  // Sans le droit accordé par la propriétaire, il n'ajoute ni ne modifie aucun produit.
  await expect(karim.getByRole('link', { name: 'Ajouter un produit' })).toHaveCount(0);
  for (const chemin of ['/stock/nouveau', `${adresseCafe}/modifier`]) {
    await karim.goto(chemin);
    await expect(karim).toHaveURL(/\/acces-refuse$/);
  }
  // La propriétaire lui accorde la gestion des produits depuis l'écran Équipe.
  await nadia.goto('/reglages/equipe');
  await nadia.getByText('Actions').click();
  await nadia.getByRole('button', { name: 'Autoriser à gérer les produits' }).click();
  await expect(nadia.getByText('Gère les produits', { exact: true })).toBeVisible();
  await sansDebordement(nadia);
  await karim.goto('/stock');
  await karim.getByRole('link', { name: 'Ajouter un produit' }).click();
  await expect(karim.getByLabel("Prix d'achat (DA)")).toHaveCount(0);
  await karim.getByLabel('Nom en français').fill('Stylo bleu');
  await karim.getByLabel('Prix de vente (DA)').fill('40');
  await karim.getByLabel('Quantité en stock').fill('50');
  await sansDebordement(karim);
  await karim.getByRole('button', { name: 'Créer le produit' }).click();
  await expect(karim.getByRole('heading', { name: 'Stylo bleu' })).toBeVisible();
  await expect(stockAffiche(karim)).toHaveText('50');
  // Il modifie un prix de vente ; le prix d'achat, qu'il ne voit pas, reste intact (vérifié plus bas côté propriétaire).
  await karim.goto(`${adresseCafe}/modifier`);
  await expect(karim.getByLabel("Prix d'achat (DA)")).toHaveCount(0);
  await karim.getByLabel('Prix de vente (DA)').fill('260');
  await karim.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(karim.getByText('260 DA')).toBeVisible();
  await expect(karim.getByRole('button', { name: 'Archiver' })).toHaveCount(0);
  await karim.goto('/stock');
  await expect(karim.getByText('Valeur du stock')).toHaveCount(0);
  await expect(karim.getByRole('link', { name: /Importer/ })).toHaveCount(0);
  await karim.goto(adresseCafe);
  await expect(karim.getByText("Prix d'achat")).toHaveCount(0);
  await expect(karim.getByText('190 DA')).toHaveCount(0);
  await expect(karim.getByText('Sortie : casse, perte, erreur')).toHaveCount(0);
  await expect(karim.getByRole('button', { name: 'Archiver' })).toHaveCount(0);
  await karim.getByText('Entrée de stock').click();
  await expect(karim.getByLabel("Nouveau prix d'achat (DA)")).toHaveCount(0);
  await karim.getByLabel('Quantité reçue').fill('5');
  await karim.getByRole('button', { name: 'Ajouter au stock' }).click();
  await expect(stockAffiche(karim)).toHaveText('20');
  await expect(karim.getByText(/^Karim ·/)).toBeVisible();
  for (const chemin of ['/stock/import']) {
    await karim.goto(chemin);
    await expect(karim).toHaveURL(/\/acces-refuse$/);
  }
  // Il peut compter un inventaire, mais pas le valider.
  await karim.goto('/stock/inventaire');
  await karim.getByRole('button', { name: 'Commencer un inventaire' }).click();
  await expect(karim.getByText(/Café moulu 250 g : 1 compté/)).toBeVisible({ timeout: 20_000 });
  await expect(karim.getByText("Le propriétaire du magasin doit valider l'inventaire pour corriger le stock.")).toBeVisible();
  await expect(karim.getByRole('button', { name: "Valider l'inventaire" })).toHaveCount(0);
  await sansDebordement(karim);
  await nadia.goto('/stock/inventaire');
  await nadia.getByRole('button', { name: 'Annuler cet inventaire' }).click();
  await expect(nadia.getByRole('button', { name: 'Commencer un inventaire' })).toBeVisible();
});

test('un autre commerçant ne voit ni les produits ni les photos', async ({ browser }) => {
  await nadia.goto(adresseCafe);
  const adressePhoto = (await nadia.locator('main img').first().getAttribute('src'))!;
  voisin = await ouvrir(browser);
  expect((await voisin.request.get(adressePhoto)).status()).toBe(401); // sans connexion
  await connecter(voisin, telVoisin, MDP);
  expect((await voisin.request.get(adressePhoto)).status()).toBe(404);
  await voisin.goto(adresseCafe);
  await expect(voisin.getByRole('heading', { name: "Page introuvable" })).toBeVisible();
  await expect(voisin.getByText('Café moulu')).toHaveCount(0);
  await voisin.goto(`${adresseCafe}/modifier`);
  await expect(voisin.getByRole('heading', { name: "Page introuvable" })).toBeVisible();
  await voisin.goto(`/stock/mouvements?produit=${adresseCafe.split('/').pop()}`);
  await expect(voisin.getByText('Aucun mouvement')).toBeVisible();
  await voisin.goto('/stock');
  await expect(voisin.getByText("Aucun produit pour l'instant")).toBeVisible();
  await voisin.context().close();
});

test('modifier, archiver et rétablir un produit', async () => {
  await nadia.goto(adresseCafe);
  await nadia.getByRole('link', { name: 'Modifier' }).click();
  await expect(nadia.getByLabel('Nom en arabe')).toHaveValue('قهوة مطحونة');
  await expect(nadia.getByLabel("Prix d'achat (DA)")).toHaveValue('190');
  await nadia.getByLabel('Prix de vente (DA)').fill('270');
  await sansDebordement(nadia);
  await nadia.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(nadia.getByText('270 DA')).toBeVisible();
  await expect(stockAffiche(nadia)).toHaveText('20'); // modifier la fiche ne touche pas au stock

  await nadia.getByRole('button', { name: 'Archiver' }).click();
  await expect(nadia).toHaveURL(/\/stock$/);
  await expect(nadia.getByRole('link', { name: /Café moulu/ })).toHaveCount(0);
  await nadia.getByRole('link', { name: 'Archivés' }).click();
  await nadia.getByRole('link', { name: /Café moulu/ }).click();
  await expect(nadia.getByText('Ce produit est archivé')).toBeVisible();
  await nadia.getByRole('button', { name: 'Rétablir le produit' }).click();
  await expect(nadia.getByRole('link', { name: 'Modifier' })).toBeVisible();
});

test('tous les écrans du stock en arabe, de droite à gauche, en thème sombre', async () => {
  await nadia.goto('/stock');
  await nadia.getByRole('button', { name: /العربية/ }).click();
  await expect(nadia.locator('html')).toHaveAttribute('dir', 'rtl');
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'داكن' }).click();
  await expect(nadia.locator('html')).toHaveAttribute('data-theme', 'sombre');
  const ecrans: [string, string][] = [
    ['/stock', 'stock'], [adresseCafe, 'produit'], [`${adresseCafe}/modifier`, 'produit-modifier'], ['/stock/nouveau', 'produit-nouveau'], ['/stock/mouvements', 'mouvements'],
    ['/stock/inventaire', 'inventaire'], ['/stock/etiquettes', 'etiquettes'], ['/stock/import', 'import'], ['/scan', 'scan'], ['/', 'accueil'],
  ];
  for (const [chemin, nom] of ecrans) {
    await nadia.goto(chemin);
    await expect(nadia.locator('h1')).toBeVisible();
    await sansDebordement(nadia);
    if (nom === 'scan') await expect(nadia.getByText('قهوة مطحونة')).toBeVisible({ timeout: 20_000 });
    await nadia.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  // Le nom arabe du produit et le montant en dinars sont affichés dans la langue de l'écran.
  await nadia.goto('/stock');
  await expect(nadia.getByRole('link', { name: /قهوة مطحونة/ })).toContainText(/270\u2069\u00a0د\.ج/);
  await expect(nadia.getByRole('link', { name: /مخزون منخفض/ }).first()).toBeVisible();
  // Un montant à plusieurs groupes de chiffres reste dans le bon ordre en arabe : le « 1 » est à gauche du « 200 ».
  const savon = nadia.getByRole('link', { name: /Savon/ });
  await expect(savon).toContainText(/1\u00a0200/);
  await savon.screenshot({ path: `${CAPTURES}/montant-ar.png` });
  await nadia.goto('/');
  await expect(nadia.getByText(/تنبيهات: \d/)).toBeVisible();
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'فاتح' }).click();
  await nadia.getByRole('button', { name: /Français/ }).click();
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
