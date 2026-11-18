// Nommé pour passer après parcours.spec.ts, qui attend une base sans commerçant.
// Parcours de l'étape 4 sur un écran de téléphone de 360 px : réglages de livraison, commande prise au
// téléphone, appels, « Envoi », préparation, expédition, retour, alerte du numéro, clients.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { accepterInvitation, inviterEmploye } from '../../src/lib/invitations.ts';
import { creerProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';

const CAPTURES = 'docs/etape-4/captures';
const MDP_PREPARATEUR = 'preparateur du magasin';

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
const stockRobe = async (commercantId: string) =>
  avecCommercant(commercantId, (trx) =>
    trx.selectFrom('stocks as s').innerJoin('variantes as v', 'v.id', 's.variante_id').innerJoin('produits as p', 'p.id', 'v.produit_id')
      .select(['s.quantite', 's.reservee']).where('p.nom_fr', '=', 'Robe kabyle').executeTakeFirstOrThrow());

test.describe.configure({ mode: 'serial' });

let nadia: Page;
let commercantId = '';
let telNadia = '', telSamir = '', telVoisin = '';
const telCliente = telephone();
let adresseCommande = '';

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const magasin = await creerCommercant(admin.id, 'Atelier Nadia');
  commercantId = magasin.commercantId;
  const ctx = { commercantId, utilisateurId: magasin.proprietaireId };
  await avecCommercant(commercantId, async (trx) => {
    const r = await creerProduit(trx, ctx, { nomFr: 'Robe kabyle', nomAr: 'جبة قبائلية', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: 2_000_00, prixVente: 4_500_00, seuil: 0, stockInitial: 5 }] });
    if (!r.ok) throw new Error(r.raison);
  });
  telNadia = magasin.telephone;
  telSamir = telephone();
  const inv = await inviterEmploye({ commercantId, parUtilisateur: magasin.proprietaireId, nom: 'Samir', telephone: telSamir, role: 'preparateur' });
  if (!inv.ok) throw new Error('invitation refusée');
  await accepterInvitation(inv.jeton, { motDePasse: MDP_PREPARATEUR });
  telVoisin = (await creerCommercant(admin.id, 'Voisin des colis')).telephone;
  nadia = await ouvrir(browser);
  await connecter(nadia, telNadia, MDP);
});

test('réglages de livraison : transporteur et frais par wilaya', async () => {
  await nadia.goto('/reglages');
  await nadia.getByRole('link', { name: /Livraison/ }).click();
  await nadia.getByLabel('Nom du transporteur (Yalidine, ZR Express…)').fill('Yalidine');
  await nadia.getByRole('button', { name: 'Ajouter le transporteur' }).click();
  await expect(nadia.getByText('Yalidine', { exact: true })).toBeVisible();
  // Même prix partout, puis Alger moins cher.
  const remplir = nadia.locator('section', { hasText: 'Même prix partout' });
  await remplir.getByLabel('Domicile').fill('700');
  await remplir.getByLabel('Point relais').fill('450');
  await nadia.getByRole('button', { name: 'Remplir toutes les wilayas' }).click();
  await expect(nadia.getByLabel('Domicile · Bou Saâda')).toHaveValue('700');
  await expect(nadia.getByLabel('Point relais · El Abiodh Sidi Cheikh')).toHaveValue('450');
  await nadia.getByLabel('Domicile · Alger').fill('500');
  await nadia.getByLabel('Point relais · Tamanrasset').fill('');
  await nadia.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(nadia.getByText('Modifications enregistrées.')).toBeVisible();
  await nadia.reload();
  await expect(nadia.getByLabel('Domicile · Alger')).toHaveValue('500');
  await expect(nadia.getByLabel('Point relais · Tamanrasset')).toHaveValue('');
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/livraison-fr-clair.png`, fullPage: true });
});

test('commande prise au téléphone : frais de la wilaya, total, stock réservé', async () => {
  await nadia.goto('/commandes');
  await expect(nadia.getByText('Aucune commande à confirmer')).toBeVisible();
  await nadia.getByRole('link', { name: 'Nouvelle commande' }).click();
  await nadia.getByLabel('Téléphone du client').fill(telCliente);
  await nadia.getByLabel('Nom du client').fill('Amina Belkacem');
  await nadia.getByLabel('Wilaya').selectOption('16');
  await nadia.locator('select[name=commune]').selectOption('Bab Ezzouar');
  await expect(nadia.getByLabel('Frais de livraison (DA)')).toHaveValue('500');
  await nadia.getByText('Point relais', { exact: true }).click();
  await expect(nadia.getByLabel('Frais de livraison (DA)')).toHaveValue('450');
  await nadia.getByText('À domicile', { exact: true }).click();
  await expect(nadia.getByLabel('Frais de livraison (DA)')).toHaveValue('500');
  await nadia.getByLabel('Adresse (facultatif)').fill('Cité 5 juillet, bâtiment 3');
  await nadia.getByLabel('Ajouter un article').fill('robe');
  await nadia.getByRole('button', { name: 'Chercher' }).click();
  await nadia.getByRole('button', { name: /Robe kabyle/ }).click();
  await nadia.getByRole('button', { name: 'Un de plus : Robe kabyle' }).click();
  await expect(nadia.getByText('9 500 DA')).toBeVisible();
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/commande-nouvelle-fr-clair.png`, fullPage: true });
  await nadia.getByRole('button', { name: 'Enregistrer la commande' }).click();
  await expect(nadia.getByText('À confirmer', { exact: true }).first()).toBeVisible();
  adresseCommande = new URL(nadia.url()).pathname;
  expect(adresseCommande).toMatch(/^\/commandes\/[0-9a-f-]{36}$/);
  await expect(nadia.getByText('Bab Ezzouar')).toBeVisible();
  await expect(nadia.getByText('9 500 DA').first()).toBeVisible();
  expect(await stockRobe(commercantId)).toEqual({ quantite: 5, reservee: 2 });
});

test('appel sans réponse, puis « Envoi » : la facture est créée, le stock reste réservé', async () => {
  await nadia.getByRole('button', { name: 'Pas de réponse' }).click();
  await expect(nadia.getByText('1 appel sans réponse')).toBeVisible();
  await nadia.getByRole('button', { name: 'Envoi : préparer le colis' }).click();
  await expect(nadia.getByText('Confirmée', { exact: true }).first()).toBeVisible();
  await expect(nadia.getByRole('link', { name: /Facture/ })).toBeVisible();
  expect(await stockRobe(commercantId)).toEqual({ quantite: 5, reservee: 2 });
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/commande-confirmee-fr-clair.png`, fullPage: true });
  // La facture renvoie à la commande, et ne peut pas être annulée ni encaissée en dehors d'elle.
  await nadia.getByRole('link', { name: /Facture/ }).click();
  await expect(nadia.getByRole('link', { name: /Commande n°/ })).toBeVisible();
  await expect(nadia.getByText('Annuler par un avoir')).toHaveCount(0);
  await nadia.goBack();
});

test('le préparateur prépare et expédie, sans voir l\'argent ni les clients', async ({ browser }) => {
  const samir = await ouvrir(browser);
  await connecter(samir, telSamir, MDP_PREPARATEUR);
  await samir.goto('/commandes');
  await expect(samir.getByRole('link', { name: 'Nouvelle commande' })).toHaveCount(0);
  await samir.getByRole('link', { name: /Amina Belkacem/ }).click();
  await samir.getByRole('button', { name: 'Colis prêt' }).click();
  await expect(samir.getByText('Préparée', { exact: true }).first()).toBeVisible();
  await samir.getByLabel('Transporteur').selectOption({ label: 'Yalidine' });
  await samir.getByLabel('Numéro de suivi').fill('YAL-2026-0042');
  await samir.getByRole('button', { name: 'Colis expédié' }).click();
  await expect(samir.getByText('Expédiée', { exact: true }).first()).toBeVisible();
  await expect(samir.getByText('YAL-2026-0042')).toBeVisible();
  await expect(samir.getByRole('button', { name: 'Livré et payé' })).toHaveCount(0);
  await expect(samir.getByRole('button', { name: 'Colis retourné' })).toHaveCount(0);
  expect(await stockRobe(commercantId)).toEqual({ quantite: 3, reservee: 0 });
  await samir.goto('/clients');
  await expect(samir).toHaveURL(/acces-refuse/);
  await samir.context().close();
});

test('colis retourné : avoir automatique, stock remis', async () => {
  await nadia.goto(adresseCommande);
  await nadia.getByRole('button', { name: 'Colis retourné' }).click();
  await expect(nadia.getByText('Retournée', { exact: true }).first()).toBeVisible();
  await expect(nadia.getByRole('link', { name: /Facture d'avoir|Avoir/ })).toBeVisible();
  expect(await stockRobe(commercantId)).toEqual({ quantite: 5, reservee: 0 });
  await nadia.screenshot({ path: `${CAPTURES}/commande-retournee-fr-clair.png`, fullPage: true });
});

test('même numéro, nouvelle commande : l\'alerte apparaît pendant la saisie', async () => {
  await nadia.goto('/commandes/nouvelle');
  // Écrit autrement (avec +213) : c'est le même numéro.
  await nadia.getByLabel('Téléphone du client').fill(`+213 ${telCliente.slice(1)}`);
  await expect(nadia.getByRole('alert').filter({ hasText: '1 colis retourné' })).toBeVisible();
  await nadia.getByLabel('Nom du client').fill('Amina Belkacem');
  await nadia.getByLabel('Wilaya').selectOption('68');
  await nadia.locator('select[name=commune]').selectOption('Bou Saada');
  await expect(nadia.getByLabel('Frais de livraison (DA)')).toHaveValue('700');
  await nadia.getByLabel('Ajouter un article').fill('robe');
  await nadia.getByLabel('Ajouter un article').press('Enter');
  await nadia.getByRole('button', { name: /Robe kabyle/ }).click();
  await nadia.getByRole('button', { name: 'Enregistrer la commande' }).click();
  await expect(nadia).toHaveURL(/\/commandes\/[0-9a-f-]{36}$/);
  await expect(nadia.getByRole('alert').filter({ hasText: '1 colis retourné' })).toBeVisible();
  // Annulée avant confirmation : le stock réservé revient.
  expect(await stockRobe(commercantId)).toEqual({ quantite: 5, reservee: 1 });
  await nadia.getByText('Annuler la commande', { exact: true }).click();
  await nadia.getByRole('button', { name: 'Oui, annuler la commande' }).click();
  await expect(nadia.getByText('Annulée', { exact: true }).first()).toBeVisible();
  expect(await stockRobe(commercantId)).toEqual({ quantite: 5, reservee: 0 });
  await nadia.goto('/commandes?f=terminees');
  await expect(nadia.getByRole('link', { name: /Amina Belkacem/ })).toHaveCount(2);
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/commandes-fr-clair.png`, fullPage: true });
});

test('vente directe depuis une commande : payée et livrée tout de suite', async () => {
  await nadia.goto('/commandes/nouvelle');
  await nadia.getByLabel('Téléphone du client').fill(telephone());
  await nadia.getByLabel('Nom du client').fill('Yacine');
  await nadia.getByLabel('Wilaya').selectOption('31');
  await nadia.locator('select[name=commune]').selectOption('Bir El Djir');
  await nadia.getByLabel('Frais de livraison (DA)').fill('0');
  await nadia.getByLabel('Ajouter un article').fill('robe');
  await nadia.getByLabel('Ajouter un article').press('Enter');
  await nadia.getByRole('button', { name: /Robe kabyle/ }).click();
  await nadia.getByRole('button', { name: 'Enregistrer la commande' }).click();
  await expect(nadia).toHaveURL(/\/commandes\/[0-9a-f-]{36}$/);
  await expect(nadia.getByText('4 500 DA').first()).toBeVisible();
  await nadia.getByRole('button', { name: 'Vente directe : payé maintenant' }).click();
  await expect(nadia.getByText('Livrée', { exact: true }).first()).toBeVisible();
  expect(await stockRobe(commercantId)).toEqual({ quantite: 4, reservee: 0 });
});

test('fiche client : historique, total dépensé, taux de retour', async () => {
  await nadia.goto('/clients');
  await nadia.getByRole('searchbox').fill(telCliente);
  await nadia.getByRole('searchbox').press('Enter');
  await nadia.getByRole('link', { name: /Amina Belkacem/ }).click();
  await expect(nadia.getByText('100 %')).toBeVisible();
  await expect(nadia.getByRole('link', { name: /Commande n°/ })).toHaveCount(2);
  await sansDebordement(nadia);
  await nadia.screenshot({ path: `${CAPTURES}/client-fr-clair.png`, fullPage: true });
});

test('un autre commerçant ne voit pas les commandes', async ({ browser }) => {
  const voisin = await ouvrir(browser);
  await connecter(voisin, telVoisin, MDP);
  await voisin.goto(adresseCommande);
  await expect(voisin.getByText('Page introuvable')).toBeVisible();
  await voisin.goto('/commandes?f=toutes');
  await expect(voisin.getByText('Aucune commande', { exact: true })).toBeVisible();
  await voisin.goto('/clients');
  await expect(voisin.getByText('Amina Belkacem')).toHaveCount(0);
  await voisin.context().close();
});

test('les écrans des commandes et des clients en arabe, en thème sombre', async () => {
  // La langue se choisit dans « Plus » (et sur les pages publiques).
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'العربية' }).click();
  await expect(nadia.locator('html')).toHaveAttribute('dir', 'rtl');
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'داكن' }).click();
  await expect(nadia.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');
  const ecrans: [string, string][] = [
    ['/commandes?f=terminees', 'commandes'], ['/commandes/nouvelle', 'commande-nouvelle'], [adresseCommande, 'commande'],
    ['/clients', 'clients'], ['/reglages/livraison', 'livraison'],
  ];
  for (const [chemin, nom] of ecrans) {
    await nadia.goto(chemin);
    await expect(nadia.locator('h1')).toBeVisible();
    await sansDebordement(nadia);
    await nadia.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await nadia.goto(adresseCommande);
  await expect(nadia.getByText('مُرجَعة').first()).toBeVisible();
  await nadia.goto('/commandes/nouvelle');
  await nadia.getByLabel('الولاية').selectOption('69');
  await expect(nadia.getByLabel('الولاية').locator('option:checked')).toHaveText('69 · الأبيض سيدي الشيخ');
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: 'فاتح' }).click();
  await nadia.goto('/plus');
  await nadia.getByRole('button', { name: /Français/ }).click();
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
