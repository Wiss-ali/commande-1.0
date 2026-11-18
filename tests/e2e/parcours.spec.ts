// Parcours complet de l'étape 1, sur un écran de téléphone de 360 px, en français et en arabe.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { Secret, TOTP } from 'otpauth';

const MDP_ADMIN = 'administrateur de test 2026';
const MDP_ALI = 'le magasin de ali a oran';
const MDP_SAMIR = 'huit car';
const TEL_ALI = '0550112233';
const TEL_SAMIR = '0661445566';
const CAPTURES = 'docs/etape-1/captures';

const code = (cle: string) => new TOTP({ secret: Secret.fromBase32(cle) }).generate();

// Toute violation de la politique de sécurité (CSP) ou erreur de script fait échouer le test.
const problemes: string[] = [];
async function ouvrir(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problemes.push(`${page.url()} : ${m.text()}`);
  });
  page.on('pageerror', (e) => problemes.push(`${page.url()} : ${e.message}`));
  return page;
}

/** Aucun écran ne doit déborder en largeur sur un téléphone de 360 px. */
async function sansDebordement(page: Page) {
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, `débordement sur ${page.url()}`).toBeLessThanOrEqual(360);
}

test.describe.configure({ mode: 'serial' });

let admin: Page, ali: Page, samir: Page;
let lienAli = '', lienSamir = '';

test('en-têtes de sécurité et pages protégées', async ({ browser, request }) => {
  const r = await request.get('/connexion');
  const csp = r.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).toContain("frame-ancestors 'none'");
  expect(r.headers()['x-content-type-options']).toBe('nosniff');
  expect(r.headers()['referrer-policy']).toBe('no-referrer');
  expect(r.headers()['x-powered-by']).toBeUndefined();

  const page = await ouvrir(browser);
  for (const chemin of ['/', '/reglages/equipe', '/stock']) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/connexion$/);
  }
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  await page.goto('/invitation/un-jeton-invente');
  await expect(page.getByRole('heading', { name: "Ce lien n'est plus valable" })).toBeVisible();
  await sansDebordement(page);
});

test("l'administrateur active sa double authentification et invite un commerçant", async ({ browser }) => {
  admin = await ouvrir(browser);
  await admin.goto('/admin/connexion');
  await admin.getByLabel('Identifiant').fill('admin@test.dz');
  await admin.getByLabel('Mot de passe').fill('mauvais mot de passe');
  await admin.getByRole('button', { name: 'Se connecter' }).click();
  await expect(admin.locator('p[role=alert]')).toHaveText('Numéro ou mot de passe incorrect.');
  await admin.getByLabel('Mot de passe').fill(MDP_ADMIN);
  await admin.getByRole('button', { name: 'Se connecter' }).click();

  // Première connexion : la double authentification est imposée, l'administration reste fermée.
  await expect(admin).toHaveURL(/\/admin\/connexion\/activation$/);
  await admin.goto('/admin');
  await expect(admin).toHaveURL(/\/admin\/connexion\/activation$/);
  await admin.getByRole('button', { name: 'Activer' }).click();
  const cle = (await admin.locator('code').innerText()).trim();
  await admin.getByLabel('Code à 6 chiffres').fill('000000');
  await admin.getByRole('button', { name: 'Confirmer' }).click();
  await expect(admin.locator('p[role=alert]')).toContainText('Code incorrect');
  await admin.getByLabel('Code à 6 chiffres').fill(code(cle));
  await admin.getByRole('button', { name: 'Confirmer' }).click();
  await expect(admin.getByText('Vos codes de secours')).toBeVisible();
  await expect(admin.locator('ul[dir=ltr] li')).toHaveCount(10);
  await sansDebordement(admin);
  await admin.getByRole('link', { name: "J'ai noté mes codes, continuer" }).click();
  await expect(admin.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(admin.getByText('Aucun commerçant')).toBeVisible();

  await admin.getByLabel('Nom du magasin').fill('Magasin Ali');
  await admin.getByLabel('Nom du propriétaire').fill('Ali');
  await admin.getByLabel('Téléphone du propriétaire').fill('123');
  await admin.getByRole('button', { name: 'Créer et obtenir le lien' }).click();
  await expect(admin.locator('p[role=alert]')).toContainText('Numéro invalide');
  await expect(admin.getByLabel('Nom du magasin')).toHaveValue('Magasin Ali'); // la saisie n'est pas perdue
  await admin.getByLabel('Téléphone du propriétaire').fill('0550 11 22 33');
  await admin.getByRole('button', { name: 'Créer et obtenir le lien' }).click();
  lienAli = await admin.getByLabel('Copier le lien').inputValue();
  expect(lienAli).toMatch(/\/invitation\/[\w-]{43}$/);
  await expect(admin.getByText('Invitation en attente')).toBeVisible();
  await sansDebordement(admin);
  await admin.screenshot({ path: `${CAPTURES}/admin.png`, fullPage: true });
});

test('le commerçant accepte son invitation et arrive sur son espace', async ({ browser }) => {
  ali = await ouvrir(browser);
  await ali.goto(lienAli);
  await expect(ali.getByRole('heading', { name: 'Créez votre espace' })).toBeVisible();
  await expect(ali.getByText('0550 12 34 56').or(ali.getByText('0550 11 22 33'))).toBeVisible();
  await ali.getByLabel('Choisissez un mot de passe').fill('court');
  await ali.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(ali.locator('p[role=alert]')).toHaveText('Mot de passe trop court.');
  await ali.getByLabel('Choisissez un mot de passe').fill(MDP_ALI);
  await ali.getByText('Informations légales').first().click();
  await ali.getByLabel('Numéro d\'identification fiscale (NIF)').fill('000123456789012');
  await sansDebordement(ali);
  await ali.screenshot({ path: `${CAPTURES}/invitation.png`, fullPage: true });
  await ali.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(ali.getByRole('heading', { name: 'Bonjour, Ali' })).toBeVisible();
  await expect(ali.getByText('Magasin Ali')).toBeVisible();
  const nav = ali.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link')).toHaveText(['Accueil', 'Caisse', 'Scan', 'Stock', 'Plus']);
  await sansDebordement(ali);
  await ali.screenshot({ path: `${CAPTURES}/accueil-fr-clair.png` });

  // Le lien ne sert qu'une fois.
  const autre = await ouvrir(browser);
  await autre.goto(lienAli);
  await expect(autre.getByRole('heading', { name: "Ce lien n'est plus valable" })).toBeVisible();
  await autre.context().close();

  // Les numéros légaux saisis se retrouvent dans les réglages (déchiffrés pour leur propriétaire).
  await ali.goto('/reglages/entreprise');
  await expect(ali.getByLabel('Numéro d\'identification fiscale (NIF)')).toHaveValue('000123456789012');
  await ali.getByLabel('Forme juridique').fill('Personne physique');
  await ali.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ali.getByRole('status')).toHaveText('Modifications enregistrées.');
  await sansDebordement(ali);
});

test("l'arabe s'affiche de droite à gauche, et le choix est mémorisé", async () => {
  // La langue se choisit dans « Plus » (et sur les pages publiques).
  await ali.goto('/plus');
  await ali.getByRole('button', { name: 'العربية' }).click();
  await expect(ali.locator('html')).toHaveAttribute('dir', 'rtl');
  await ali.goto('/');
  await expect(ali.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(ali.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(ali.getByRole('heading', { name: 'مرحبا، Ali' })).toBeVisible();
  await expect(ali.getByRole('navigation').getByRole('link')).toHaveText(['الرئيسية', 'الصندوق', 'مسح', 'المخزون', 'المزيد']);
  await sansDebordement(ali);
  await ali.reload();
  await expect(ali.locator('html')).toHaveAttribute('dir', 'rtl');

  for (const chemin of ['/plus', '/reglages', '/reglages/equipe', '/reglages/modules', '/reglages/securite', '/reglages/entreprise', '/stock', '/scan']) {
    await ali.goto(chemin);
    await expect(ali.locator('h1')).toHaveText(/[؀-ۿ]/);
    await sansDebordement(ali);
  }
  // Thème sombre, mémorisé lui aussi.
  await ali.goto('/plus');
  await ali.getByRole('button', { name: 'داكن' }).click();
  await expect(ali.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ali.locator('html')).toHaveAttribute('data-theme', 'sombre');
  await ali.goto('/');
  await expect(ali.locator('html')).toHaveAttribute('data-theme', 'sombre');
  await ali.screenshot({ path: `${CAPTURES}/accueil-ar-sombre.png` });
  await ali.goto('/reglages/equipe');
  await ali.screenshot({ path: `${CAPTURES}/equipe-ar-sombre.png`, fullPage: true });

  await ali.goto('/plus');
  await ali.getByRole('button', { name: 'فاتح' }).click();
  await ali.goto('/plus');
  await ali.getByRole('button', { name: /Français/ }).click();
  await expect(ali.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('le propriétaire invite un préparateur, qui ne voit que ce que son rôle permet', async ({ browser }) => {
  await ali.goto('/reglages/equipe');
  await expect(ali.getByText('Aucun employé pour l\'instant')).toBeVisible();
  await ali.getByLabel("Nom de l'employé").fill('Samir');
  await ali.getByLabel('Son numéro de téléphone').fill(TEL_ALI);
  await ali.getByLabel(/Préparateur/).check();
  await ali.getByRole('button', { name: "Créer le lien d'invitation" }).click();
  await expect(ali.locator('p[role=alert]')).toHaveText('Ce numéro a déjà un compte.');
  await ali.getByLabel('Son numéro de téléphone').fill(TEL_SAMIR);
  await ali.getByRole('button', { name: "Créer le lien d'invitation" }).click();
  lienSamir = await ali.getByLabel('Copier le lien').inputValue();
  await expect(ali.getByText('Invitations en attente')).toBeVisible();
  await sansDebordement(ali);
  await ali.screenshot({ path: `${CAPTURES}/equipe-fr-clair.png`, fullPage: true });

  samir = await ouvrir(browser);
  await samir.goto(lienSamir);
  await expect(samir.getByRole('heading', { name: 'Rejoignez Magasin Ali' })).toBeVisible();
  await expect(samir.getByText('Votre rôle : Préparateur')).toBeVisible();
  await samir.getByLabel('Choisissez un mot de passe').fill(MDP_SAMIR);
  await samir.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(samir.getByRole('heading', { name: 'Bonjour, Samir' })).toBeVisible();

  // Un préparateur n'a ni la caisse, ni les réglages, ni l'équipe.
  // Barre par défaut complétée jusqu'à 4 entrées parmi ce qu'il peut ouvrir (ici : les commandes à préparer).
  await expect(samir.getByRole('navigation').getByRole('link')).toHaveText(['Accueil', 'Scan', 'Stock', 'Commandes', 'Plus']);
  await expect(samir.getByRole('link', { name: 'Inviter mon équipe' })).toHaveCount(0);
  for (const chemin of ['/caisse', '/reglages', '/reglages/equipe', '/reglages/entreprise', '/reglages/modules', '/rapports']) {
    await samir.goto(chemin);
    await expect(samir).toHaveURL(/\/acces-refuse$/);
  }
  await expect(samir.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  // Il voit le stock, mais ne peut ni créer un produit ni importer.
  await samir.goto('/stock');
  await expect(samir.getByText("Le propriétaire du magasin n'a pas encore ajouté de produit.")).toBeVisible();
  await expect(samir.getByRole('link', { name: 'Ajouter un produit' })).toHaveCount(0);
  for (const chemin of ['/stock/nouveau', '/stock/import']) {
    await samir.goto(chemin);
    await expect(samir).toHaveURL(/\/acces-refuse$/);
  }
  await samir.goto('/reglages/securite');
  await expect(samir.getByRole('heading', { name: 'Sécurité' })).toBeVisible();
});

test('désactiver un module le retire des menus', async () => {
  await ali.goto('/reglages/modules');
  await ali.getByLabel('Caisse').uncheck();
  await ali.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ali.getByRole('status')).toBeVisible();
  await expect(ali.getByRole('navigation').getByRole('link')).toHaveText(['Accueil', 'Scan', 'Stock', 'Commandes', 'Plus']);
  await ali.goto('/caisse');
  await expect(ali).toHaveURL(/\/acces-refuse$/);
  await ali.goto('/reglages/modules');
  await ali.getByLabel('Caisse').check();
  await ali.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ali.getByRole('navigation').getByRole('link')).toHaveCount(5);
});

test('bloquer un employé le déconnecte tout de suite', async () => {
  await ali.goto('/reglages/equipe');
  await ali.getByText('Actions').click();
  await ali.getByRole('button', { name: 'Bloquer' }).click();
  await expect(ali.getByText('Bloqué', { exact: true })).toBeVisible();
  await samir.goto('/');
  await expect(samir).toHaveURL(/\/connexion$/);
  await samir.getByLabel('Numéro de téléphone').fill(TEL_SAMIR);
  await samir.getByLabel('Mot de passe').fill(MDP_SAMIR);
  await samir.getByRole('button', { name: 'Se connecter' }).click();
  await expect(samir.locator('p[role=alert]')).toHaveText('Numéro ou mot de passe incorrect.');

  // Débloqué, puis « mot de passe oublié » : le lien donne un nouveau mot de passe.
  // Le volet « Actions » reste ouvert après chaque action.
  await ali.getByRole('button', { name: 'Débloquer' }).click();
  await expect(ali.getByText('Bloqué', { exact: true })).toHaveCount(0);
  await ali.getByRole('button', { name: 'Mot de passe oublié' }).click();
  const lien = await ali.getByLabel('Copier le lien').inputValue();
  await samir.goto(lien);
  await expect(samir.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();
  await samir.getByLabel('Choisissez un mot de passe').fill('nouveau mot');
  await samir.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  await expect(samir).toHaveURL(/\/connexion$/);
  await samir.getByLabel('Numéro de téléphone').fill(TEL_SAMIR);
  await samir.getByLabel('Mot de passe').fill('nouveau mot');
  await samir.getByRole('button', { name: 'Se connecter' }).click();
  await expect(samir.getByRole('heading', { name: 'Bonjour, Samir' })).toBeVisible();
});

test('double authentification du commerçant, puis déconnexion', async () => {
  await ali.goto('/reglages/securite');
  await ali.getByRole('button', { name: 'Activer' }).click();
  const cle = (await ali.locator('code').innerText()).trim();
  await ali.getByLabel('Code à 6 chiffres').fill(code(cle));
  await ali.getByRole('button', { name: 'Confirmer' }).click();
  await expect(ali.getByText('Vos codes de secours')).toBeVisible();
  const secours = (await ali.locator('ul[dir=ltr] li').first().innerText()).trim();
  await sansDebordement(ali);

  await ali.goto('/plus');
  await ali.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(ali).toHaveURL(/\/connexion$/);
  await ali.goto('/');
  await expect(ali).toHaveURL(/\/connexion$/);

  await ali.getByLabel('Numéro de téléphone').fill('+213 550 11 22 33');
  await ali.getByLabel('Mot de passe').fill(MDP_ALI);
  await ali.getByRole('button', { name: 'Se connecter' }).click();
  await expect(ali).toHaveURL(/\/connexion\/code$/);
  await ali.goto('/reglages'); // le mot de passe seul ne suffit pas
  await expect(ali).toHaveURL(/\/connexion\/code$/);
  await ali.getByLabel('Code').fill('111111');
  await ali.getByRole('button', { name: 'Vérifier' }).click();
  await expect(ali.locator('p[role=alert]')).toContainText('Code incorrect');
  await ali.getByLabel('Code').fill(secours);
  await ali.getByRole('button', { name: 'Vérifier' }).click();
  await expect(ali.getByRole('heading', { name: 'Bonjour, Ali' })).toBeVisible();
});

test("suspendre un commerçant coupe l'accès de toute son équipe", async () => {
  await admin.goto('/admin');
  await admin.getByRole('link', { name: /Magasin Ali/ }).click();
  await expect(admin.getByText('Samir')).toBeVisible();
  await sansDebordement(admin);
  await admin.getByRole('button', { name: 'Suspendre' }).click();
  await expect(admin.getByText('Suspendu', { exact: true })).toBeVisible();
  for (const p of [ali, samir]) {
    await p.goto('/');
    await expect(p).toHaveURL(/\/connexion$/);
  }
  await admin.getByRole('button', { name: 'Réactiver' }).click();
  await expect(admin.getByText('Actif', { exact: true })).toBeVisible();
});

test("l'administrateur saisit le barème du droit de timbre : aucune valeur n'est écrite dans le code", async () => {
  await admin.goto('/admin');
  await admin.getByRole('link', { name: /Réglages fiscaux/ }).click();
  await expect(admin.getByLabel("Exonéré jusqu'à (DA)")).toHaveValue(''); // vide au départ : aucun timbre
  await admin.getByLabel('DA par tranche de 100 DA').first().fill('abc');
  await admin.locator('form', { hasText: 'Tranche 1' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.locator('p[role=alert]')).toContainText('Prix invalide');
  await admin.getByLabel("Exonéré jusqu'à (DA)").fill('300');
  await admin.getByLabel("Jusqu'à (DA)").first().fill('30000');
  await admin.getByLabel('DA par tranche de 100 DA').first().fill('1');
  await admin.getByLabel('DA par tranche de 100 DA').nth(1).fill('1,5');
  await admin.getByLabel('Montant minimum (DA)').fill('5');
  await admin.locator('form', { hasText: 'Tranche 1' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Modifications enregistrées.')).toBeVisible();
  await sansDebordement(admin);
  await admin.reload();
  await expect(admin.getByLabel("Jusqu'à (DA)").first()).toHaveValue('30000');
  await expect(admin.getByLabel('DA par tranche de 100 DA').nth(1)).toHaveValue('1,50');
  // Remis à vide pour la suite des tests.
  for (const champ of ["Exonéré jusqu'à (DA)", 'Montant minimum (DA)']) await admin.getByLabel(champ).fill('');
  for (const i of [0, 1]) await admin.getByLabel('DA par tranche de 100 DA').nth(i).fill('');
  await admin.getByLabel("Jusqu'à (DA)").first().fill('');
  await admin.locator('form', { hasText: 'Tranche 1' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Modifications enregistrées.')).toBeVisible();
});

test("boutique de démonstration : ouverte d'un bouton, jamais comptée, remise à zéro à la demande", async () => {
  await admin.goto('/admin');
  const actifs = await admin.getByRole('link', { name: 'Abonnements actifs' }).textContent();
  await admin.getByRole('button', { name: 'Ouvrir la boutique de démonstration' }).click();
  await expect(admin.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
  await expect(admin.getByText('Boutique de démonstration : données fictives.')).toBeVisible();
  await admin.goto('/stock');
  await expect(admin.getByRole('link', { name: /Huile 5 L/ })).toBeVisible();
  await sansDebordement(admin);
  // La session de l'administration est restée ouverte ; la démo n'est comptée nulle part.
  await admin.getByRole('link', { name: "Retour à l'administration" }).click();
  await expect(admin.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Abonnements actifs' })).toHaveText(actifs ?? '');
  await expect(admin.getByRole('link', { name: /Boutique de démonstration/ })).toHaveCount(0);
  await admin.getByText('Remettre à zéro', { exact: true }).click();
  await admin.getByRole('button', { name: 'Remettre la démo à zéro' }).click();
  await expect(admin.locator('p[role=alert]')).toHaveText('Cochez la case pour confirmer.');
  await admin.getByLabel('Je veux remettre la démo à zéro').check();
  await admin.getByRole('button', { name: 'Remettre la démo à zéro' }).click();
  await expect(admin.getByText('La démo est comme neuve.')).toBeVisible();
  await sansDebordement(admin);
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
