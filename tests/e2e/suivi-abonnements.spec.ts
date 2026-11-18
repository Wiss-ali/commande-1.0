// Parcours de l'étape 7 sur un écran de 360 px : l'administrateur crée les formules, enregistre un paiement,
// retouche les modules ; le commerçant voit son abonnement, ses rappels, la lecture seule.
// Nommé pour passer après parcours.spec.ts, qui attend une base sans commerçant.
import { Secret, TOTP } from 'otpauth';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ajouterJours, enregistrerFormule, enregistrerPaiement, jourAlger } from '../../src/lib/abonnements.ts';
import { bd } from '../../src/lib/bd.ts';
import { creerAdmin, creerCommercant, MDP } from '../outils.ts';

const CAPTURES = 'docs/etape-7/captures';
const code = (cle: string) => new TOTP({ secret: Secret.fromBase32(cle) }).generate();
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
async function connecter(page: Page, tel: string) {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill(tel);
  await page.getByLabel('Mot de passe').fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

let admin: Page, ahmed: Page;
let identifiant = '', telAhmed = '', telFini = '', telBientot = '', idAhmed = '';
const nomCaisse = `Caisse ${Date.now().toString(36)}`;

test.beforeAll(async ({ browser }) => {
  const a = await creerAdmin();
  identifiant = a.identifiant;
  const m = await creerCommercant(a.id, 'Épicerie Ahmed');
  telAhmed = m.telephone;
  idAhmed = m.commercantId;
  // Deux autres commerçants : abonnement fini depuis 10 jours, et abonnement qui finit dans 3 jours.
  const f = await enregistrerFormule(bd('plateforme'), { nom: `Mensuel ${Date.now().toString(36)}`, prix: 2_000_00, dureeJours: 30, modules: ['caisse', 'factures', 'commandes'], active: true });
  if (!f.ok) throw new Error(f.raison);
  const fini = await creerCommercant(a.id, 'Boutique finie');
  const bientot = await creerCommercant(a.id, 'Boutique bientôt');
  telFini = fini.telephone;
  telBientot = bientot.telephone;
  for (const [id, recuLe] of [[fini.commercantId, ajouterJours(jourAlger(), -40)], [bientot.commercantId, ajouterJours(jourAlger(), -27)]] as const) {
    const r = await bd('plateforme').transaction().execute((trx) => enregistrerPaiement(trx, a.id, { commercantId: id, formuleId: f.id, moyen: 'ccp', recuLe }));
    if (!r.ok) throw new Error(r.raison);
  }
  admin = await ouvrir(browser);
  await admin.goto('/admin/connexion');
  await admin.getByLabel('Identifiant').fill(identifiant);
  await admin.getByLabel('Mot de passe').fill(MDP);
  await admin.getByRole('button', { name: 'Se connecter' }).click();
  await admin.getByRole('button', { name: 'Activer' }).click();
  const cle = (await admin.locator('code').innerText()).trim();
  await admin.getByLabel('Code à 6 chiffres').fill(code(cle));
  await admin.getByRole('button', { name: 'Confirmer' }).click();
  await admin.getByRole('link', { name: "J'ai noté mes codes, continuer" }).click();
  await expect(admin.getByRole('heading', { name: 'Administration' })).toBeVisible();
});

test('l\'administrateur crée deux formules', async () => {
  await admin.getByRole('link', { name: /Formules/ }).click();
  for (const [nom, prix, duree, modules] of [[nomCaisse, '1500', '30', ['Caisse', 'Factures']], [`Complet ${nomCaisse}`, '15000', '365', ['Caisse', 'Factures', 'Commandes', 'Clients', 'Rapports', 'Boutique en ligne']]] as const) {
    const f = admin.locator('form').filter({ has: admin.getByRole('button', { name: 'Créer la formule' }) });
    await f.getByLabel('Nom de la formule').fill(nom);
    await f.getByLabel('Prix d\'une période (DA)').fill(prix);
    await f.getByLabel('Durée (jours)').fill(duree);
    for (const m of modules) await f.getByLabel(m, { exact: true }).check();
    await f.getByRole('button', { name: 'Créer la formule' }).click();
    await expect(admin.getByText(nom, { exact: true })).toBeVisible();
  }
  await sansDebordement(admin);
  await admin.screenshot({ path: `${CAPTURES}/admin-formules.png`, fullPage: true });
});

test('sans abonnement, le commerçant a tous ses modules', async ({ browser }) => {
  ahmed = await ouvrir(browser);
  await connecter(ahmed, telAhmed);
  await expect(ahmed.getByRole('main').locator('a[href="/commandes"]')).toBeVisible();
});

test('paiement reçu par BaridiMob : abonnement ouvert, modules limités à la formule', async () => {
  await admin.goto(`/admin/commercants/${idAhmed}`);
  await expect(admin.getByText('Sans abonnement')).toBeVisible();
  await admin.getByText('Enregistrer un paiement reçu').click();
  const valeur = await admin.locator('select[name=formule] option', { hasText: `${nomCaisse} ·` }).first().getAttribute('value');
  await admin.locator('select[name=formule]').selectOption(valeur!);
  await admin.locator('select[name=moyen]').selectOption('baridimob');
  await admin.getByLabel('Référence (numéro du versement)').fill('BM-2026-778');
  await admin.getByRole('button', { name: 'Enregistrer le paiement' }).click();
  await expect(admin.getByText('Paiement enregistré, abonnement prolongé.')).toBeVisible();
  await admin.reload();
  await expect(admin.locator('section', { hasText: 'Période en cours' }).getByText('Actif', { exact: true })).toBeVisible();
  await expect(admin.getByText('BM-2026-778')).toBeVisible();
  await sansDebordement(admin);
  await admin.screenshot({ path: `${CAPTURES}/admin-commercant.png`, fullPage: true });

  await ahmed.goto('/');
  await expect(ahmed.locator('a[href="/commandes"]')).toHaveCount(0);
  await expect(ahmed.getByRole('link', { name: /^Caisse/ }).first()).toBeVisible();
  await ahmed.goto('/commandes');
  await expect(ahmed).toHaveURL(/acces-refuse/);
  await ahmed.goto('/reglages/modules');
  await expect(ahmed.getByText('Non compris dans votre abonnement').first()).toBeVisible();
  await ahmed.screenshot({ path: `${CAPTURES}/modules-fr-clair.png`, fullPage: true });
  await ahmed.goto('/reglages/abonnement');
  await expect(ahmed.getByText(nomCaisse, { exact: true })).toBeVisible();
  await expect(ahmed.getByText('Encore 30 jours')).toBeVisible();
  await sansDebordement(ahmed);
  await ahmed.screenshot({ path: `${CAPTURES}/abonnement-fr-clair.png`, fullPage: true });
});

test('retouche : l\'administrateur ajoute le module Clients pour ce commerçant seul', async () => {
  await admin.locator('select[name=retouche_clients]').selectOption('ajoute');
  await admin.locator('form', { hasText: 'Selon la formule' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Modifications enregistrées.')).toBeVisible();
  await ahmed.goto('/clients');
  await expect(ahmed.getByRole('heading', { name: 'Clients' })).toBeVisible();
});

test('rappel avant la fin, puis lecture seule après le délai', async ({ browser }) => {
  const bientot = await ouvrir(browser);
  await connecter(bientot, telBientot);
  await expect(bientot.getByText(/Votre abonnement se termine le .* \(dans 3 jours\)/)).toBeVisible();
  await bientot.screenshot({ path: `${CAPTURES}/rappel-fr-clair.png` });
  await bientot.context().close();

  const fini = await ouvrir(browser);
  await connecter(fini, telFini);
  await expect(fini.getByText('Votre abonnement est terminé : le compte est en lecture seule.')).toBeVisible();
  await fini.goto('/caisse');
  await expect(fini.getByText(/lecture seule/).first()).toBeVisible();
  await fini.context().close();
});

test('tableau de l\'administration : filtres, revenu du mois, paiements, délais, wilayas', async () => {
  await admin.goto('/admin');
  await expect(admin.getByRole('link', { name: /Revenu du mois/ })).toContainText('DA');
  await admin.getByRole('link', { name: 'Bientôt', exact: true }).click();
  await expect(admin.getByRole('link', { name: /Boutique bientôt/ })).toBeVisible();
  await expect(admin.getByRole('link', { name: /Épicerie Ahmed/ })).toHaveCount(0);
  await admin.getByRole('link', { name: 'Lecture seule', exact: true }).click();
  await expect(admin.getByRole('link', { name: /Boutique finie/ })).toContainText('Lecture seule');
  await sansDebordement(admin);
  await admin.screenshot({ path: `${CAPTURES}/admin-tableau.png`, fullPage: true });

  await admin.goto('/admin/paiements');
  await expect(admin.getByText('BM-2026-778', { exact: false })).toBeVisible();
  await admin.screenshot({ path: `${CAPTURES}/admin-paiements.png`, fullPage: true });

  await admin.goto('/admin/reglages');
  await admin.getByLabel('Délai après la fin (jours, accès complet)').fill('7');
  await admin.locator('form', { hasText: 'Délai après la fin' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Modifications enregistrées.').first()).toBeVisible();
  await admin.getByLabel('Délai après la fin (jours, accès complet)').fill('5');
  await admin.locator('form', { hasText: 'Délai après la fin' }).getByRole('button', { name: 'Enregistrer' }).click();

  await admin.goto('/admin/wilayas');
  await expect(admin.getByLabel('Nom en arabe 69')).toHaveValue('الأبيض سيدي الشيخ');
  await admin.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Modifications enregistrées.')).toBeVisible();
  await sansDebordement(admin);
});

test('administration et abonnement en arabe, en thème sombre', async () => {
  // La langue se choisit dans « Plus » (et sur les pages publiques).
  await ahmed.goto('/plus');
  await ahmed.getByRole('button', { name: 'العربية' }).click();
  await expect(ahmed.locator('html')).toHaveAttribute('dir', 'rtl');
  await ahmed.emulateMedia({ colorScheme: 'dark' });
  await ahmed.goto('/reglages/abonnement');
  await sansDebordement(ahmed);
  await ahmed.screenshot({ path: `${CAPTURES}/abonnement-ar-sombre.png`, fullPage: true });
  await admin.getByRole('button', { name: /العربية/ }).click();
  await expect(admin.locator('html')).toHaveAttribute('dir', 'rtl');
  await admin.emulateMedia({ colorScheme: 'dark' });
  for (const [chemin, nom] of [['/admin', 'admin-tableau'], ['/admin/formules', 'admin-formules'], [`/admin/commercants/${idAhmed}`, 'admin-commercant']] as const) {
    await admin.goto(chemin);
    await sansDebordement(admin);
    await admin.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await admin.getByRole('button', { name: /Français/ }).click();
  await ahmed.goto('/plus');
  await ahmed.getByRole('button', { name: /Français/ }).click();
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
