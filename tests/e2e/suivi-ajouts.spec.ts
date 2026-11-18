// Parcours du lot d'ajouts n° 1 sur un écran de téléphone de 360 px : remises et moyens de paiement, vente à crédit,
// retour d'une partie, communes, pixel, fournisseurs et arrivages, dépenses, versements, photos, barre du bas, export.
import { expect, test, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { avecCommercant } from '../../src/lib/bd.ts';
import { changerSousDomaine, mettreEnLigne } from '../../src/lib/boutique.ts';
import { confirmerCommande, creerCommande, expedier, marquerLivree, marquerPreparee } from '../../src/lib/commandes.ts';
import { creerProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';

const CAPTURES = 'docs/ajouts-1/captures';
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

let karima: Page;
let telKarima = '', commercantId = '', huileId = '';
const sd = `epicerie-karima-${Date.now().toString(36)}`;

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const m = await creerCommercant(admin.id, 'Épicerie Karima');
  commercantId = m.commercantId;
  telKarima = m.telephone;
  const ctx = { commercantId, utilisateurId: m.proprietaireId };
  await avecCommercant(commercantId, async (trx) => {
    await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute();
    for (const [nomFr, nomAr, prixVente, prixAchat, stockInitial] of [['Huile 5 L', 'زيت 5 لتر', 120_000, 100_000, 10], ['Sucre 1 kg', 'سكر 1 كغ', 12_000, 9_000, 40]] as const) {
      const r = await creerProduit(trx, ctx, { nomFr, nomAr, categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat, prixVente, seuil: 0, stockInitial }] });
      if (!r.ok) throw new Error(r.raison);
      if (nomFr.startsWith('Huile')) huileId = r.id;
    }
    // Boutique en ligne, avec ses produits publiés.
    await changerSousDomaine(trx, sd);
    await mettreEnLigne(trx, ctx, true);
    await trx.updateTable('produits').set({ visible_boutique: true }).execute();
    // Deux colis livrés, dont l'argent n'est pas encore reversé par le transporteur.
    const t = await trx.insertInto('transporteurs').values({ commercant_id: commercantId, nom: 'Yalidine' }).returning('id').executeTakeFirstOrThrow();
    const variante = await trx.selectFrom('variantes').select('id').where('produit_id', '=', huileId).executeTakeFirstOrThrow();
    for (let i = 0; i < 2; i++) {
      const c = await creerCommande(trx, ctx, { client: { nom: `Cliente ${i + 1}`, telephone: telephone() }, wilaya: 16, commune: 'Kouba', livraison: 'domicile', lignes: [{ varianteId: variante.id, quantite: 1 }], frais: 50_000, cle: crypto.randomUUID(), libelleLivraison: 'Livraison' });
      if (!c.ok) throw new Error(c.raison);
      await confirmerCommande(trx, ctx, c.id, 'envoi', crypto.randomUUID());
      await marquerPreparee(trx, ctx, c.id);
      await expedier(trx, ctx, c.id, { transporteurId: t.id, numeroSuivi: `YAL-${i}` });
      await marquerLivree(trx, ctx, c.id);
    }
  });
  karima = await ouvrir(browser);
  await connecter(karima, telKarima, MDP);
});

test('caisse : remise sur un article et sur le total, paiement en deux moyens, monnaie sur la part en espèces', async () => {
  await karima.goto('/caisse');
  await karima.getByRole('button', { name: /Huile 5 L/ }).click();
  await karima.getByRole('button', { name: 'Ajouter un : Huile 5 L' }).click();
  await karima.getByRole('button', { name: 'Remise sur : Huile 5 L' }).click();
  await karima.getByLabel('Remise sur cet article').fill('10 %');
  await expect(karima.getByText('2 160 DA').first()).toBeVisible();
  await sansDebordement(karima);
  await karima.getByRole('button', { name: 'Encaisser' }).click();
  await karima.getByLabel('Remise sur le total').fill('160');
  await expect(karima.getByRole('dialog').getByText('2 000 DA', { exact: true })).toBeVisible();
  // Paiement en deux moyens : rare, donc rangé dans le menu « Autre moyen ».
  await expect(karima.getByRole('button', { name: 'Payer avec deux moyens' })).toHaveCount(0);
  await karima.getByRole('combobox', { name: /Autre moyen/ }).selectOption('deux');
  await karima.getByRole('combobox', { name: /Second moyen/ }).selectOption('ccp');
  await karima.getByLabel('Montant payé par ce second moyen (DA)').fill('500');
  await karima.getByLabel('Montant reçu (DA)').fill('2000');
  await expect(karima.getByText('À rendre : 500 DA')).toBeVisible();
  await sansDebordement(karima);
  await karima.screenshot({ path: `${CAPTURES}/caisse-paiement-fr-clair.png`, fullPage: true });
  await karima.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(karima.getByText(/Vente enregistrée : TK-/)).toBeVisible();
  await karima.getByRole('link', { name: 'Voir le document' }).click();
  await expect(karima.getByText(/Payé le .* espèces \+ CCP \/ BaridiMob/)).toBeVisible();
  await expect(karima.getByRole('heading', { name: 'Paiements' })).toBeVisible();
  await expect(karima.getByText('Remise', { exact: true })).toBeVisible();
  await sansDebordement(karima);
});

test('retour d\'une partie de la vente : avoir pour un seul article, stock remis, argent rendu', async () => {
  await expect(await stockDe(karima, 'Huile 5 L')).toHaveText('6'); // 10 − 2 colis − 2 vendus
  await karima.goBack();
  await karima.goto('/factures?onglet=tickets');
  await karima.getByRole('link', { name: /TK-/ }).first().click();
  await karima.getByText('Annuler par un avoir').click();
  await karima.getByLabel(/Huile 5 L \(au plus 2\)/).fill('1');
  await karima.getByRole('button', { name: 'Faire l\'avoir de ces articles' }).click();
  await expect(karima.getByRole('heading', { name: /Facture d'avoir AV-/ })).toBeVisible();
  await expect(karima.getByText(/Remboursé le/)).toBeVisible();
  await sansDebordement(karima);
  await expect(await stockDe(karima, 'Huile 5 L')).toHaveText('7');
});

test('vente à crédit : le client doit, il paie plus tard en une fois', async () => {
  await karima.goto('/caisse');
  await karima.getByRole('button', { name: /Sucre 1 kg/ }).click();
  await karima.getByRole('button', { name: 'Ajouter un : Sucre 1 kg' }).click();
  await karima.getByRole('button', { name: 'Encaisser' }).click();
  // La carte est visible mais pas encore activée : la vente ne peut pas être validée avec elle.
  await karima.locator('label', { hasText: 'Carte' }).click();
  await expect(karima.getByText('Le paiement par carte n\'est pas encore activé. Choisissez un autre moyen.')).toBeVisible();
  await expect(karima.getByRole('button', { name: 'Valider la vente' })).toBeDisabled();
  await karima.getByRole('combobox', { name: /Autre moyen/ }).selectOption('credit');
  await karima.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(karima.locator('p[role=alert]')).toHaveText('Pour une vente à crédit, indiquez le nom du client.');
  await karima.getByLabel('Payé maintenant en espèces (DA)').fill('40');
  await karima.getByLabel('Nom du client').fill('Hadj Mokhtar');
  await karima.getByLabel('Téléphone du client').fill('0661 23 45 67');
  await sansDebordement(karima);
  await karima.getByRole('button', { name: 'Valider la vente' }).click();
  await expect(karima.getByText(/Vente enregistrée : TK-/)).toBeVisible();

  await karima.goto('/');
  await expect(karima.getByRole('link', { name: 'Vos clients vous doivent 200 DA' })).toBeVisible();
  await karima.goto('/clients?filtre=doivent');
  await expect(karima.getByText('Vos clients vous doivent 200 DA au total.')).toBeVisible();
  await karima.getByRole('link', { name: /Hadj Mokhtar/ }).click();
  await expect(karima.getByText('Il vous doit encore')).toBeVisible();
  await sansDebordement(karima);
  await karima.screenshot({ path: `${CAPTURES}/client-credit-fr-clair.png`, fullPage: true });
  await karima.getByLabel('Montant reçu (DA)').fill('200');
  await karima.getByRole('button', { name: 'Enregistrer le versement' }).click();
  await expect(karima.getByText('Versement enregistré. Les reçus sont dans ses documents.')).toBeVisible();
  await karima.reload();
  await expect(karima.getByText('Il vous doit encore')).toHaveCount(0);
});

test('fournisseur et arrivage : le stock entre, le prix d\'achat devient la moyenne, la dette est suivie', async () => {
  await karima.goto('/stock');
  await karima.getByRole('link', { name: 'Fournisseurs' }).click();
  await expect(karima).toHaveURL(/\/stock\/fournisseurs$/);
  await karima.getByLabel('Nom', { exact: true }).fill('Grossiste Amine');
  await karima.getByLabel('Téléphone', { exact: true }).fill('0770 11 22 33');
  await karima.getByRole('button', { name: 'Ajouter le fournisseur' }).click();
  await expect(karima.getByRole('heading', { name: 'Grossiste Amine' })).toBeVisible();
  const fiche = karima.url();
  await karima.goto(`/stock/arrivages/nouveau?fournisseur=${fiche.split('/').pop()}`);
  await karima.getByLabel('Ajouter un article (nom ou code)').fill('Huile');
  await karima.getByRole('button', { name: 'Chercher' }).click();
  await karima.getByRole('button', { name: /Huile 5 L/ }).click();
  await karima.getByLabel('Quantité reçue').fill('7');
  await karima.getByLabel('Prix payé par unité (DA)').fill('1100');
  await karima.getByLabel('Payé maintenant (DA)').fill('5000');
  await sansDebordement(karima);
  await karima.screenshot({ path: `${CAPTURES}/arrivage-fr-clair.png`, fullPage: true });
  await karima.getByRole('button', { name: 'Enregistrer l\'arrivage' }).click();
  await expect(karima.getByRole('heading', { name: 'Arrivage n° 1' })).toBeVisible();
  await expect(karima.getByText('7 700 DA').first()).toBeVisible();
  await expect(await stockDe(karima, 'Huile 5 L')).toHaveText('14');
  await karima.goto(fiche);
  await expect(karima.getByText('2 700 DA')).toBeVisible(); // 7 700 − 5 000
  // Prix d'achat : (7 × 1 000 + 7 × 1 100) ÷ 14 = 1 050 DA.
  await karima.goto(`/stock/${huileId}`);
  await expect(karima.getByText('1 050 DA').first()).toBeVisible();
});

test('dépense payée par la caisse et bénéfice net dans les rapports', async () => {
  await karima.goto('/caisse');
  await karima.getByRole('link', { name: 'Dépenses' }).click();
  await karima.getByLabel('Type de dépense').selectOption('transport');
  await karima.getByLabel('Montant (DA)').fill('300');
  await karima.getByLabel('Détail (facultatif)').fill('Taxi pour le marché');
  await karima.getByRole('button', { name: 'Enregistrer la dépense' }).click();
  await expect(karima.getByText('Dépense enregistrée.')).toBeVisible();
  await expect(karima.getByText('Transport · Taxi pour le marché')).toBeVisible();
  await sansDebordement(karima);
  await karima.goto('/rapports');
  await expect(karima.getByText('Bénéfice net (marge moins dépenses)')).toBeVisible();
  await expect(karima.getByText('Transport', { exact: true })).toBeVisible();
});

test('argent des colis livrés : versement du transporteur avec ses frais', async () => {
  await karima.goto('/commandes');
  await karima.getByRole('link', { name: 'Argent reçu' }).click();
  await expect(karima.getByText('2 colis livrés pas encore reversés par le transporteur')).toBeVisible();
  await karima.getByLabel('Somme reçue (DA)').fill('3000');
  await sansDebordement(karima);
  await karima.screenshot({ path: `${CAPTURES}/versement-fr-clair.png`, fullPage: true });
  await karima.getByRole('button', { name: 'Enregistrer le versement' }).click();
  await expect(karima.getByText('Versement enregistré.')).toBeVisible();
  await expect(karima.getByText(/frais retenus 400\sDA/)).toBeVisible();
});

test('commande au téléphone : la commune se choisit dans la liste de la wilaya', async () => {
  await karima.goto('/commandes/nouvelle');
  await karima.locator('select[name=wilaya]').selectOption('16');
  await expect(karima.locator('select[name=commune] option', { hasText: 'Kouba' })).toHaveCount(1);
  await karima.locator('select[name=wilaya]').selectOption('68');
  await expect(karima.locator('select[name=commune] option', { hasText: 'Bou Saada' })).toHaveCount(1);
  await expect(karima.locator('select[name=commune] option', { hasText: 'Kouba' })).toHaveCount(0);
});

test('pixel publicitaire : désactivé par défaut, puis chargé seulement sur la boutique', async () => {
  const avant = await karima.request.get(`/b/${sd}`);
  expect(await avant.text()).not.toContain('fbevents.js');
  await karima.goto('/boutique');
  await karima.getByText('Mesure des publicités (Facebook, TikTok)').click();
  await karima.getByLabel('Identifiant du pixel Facebook / Instagram').fill('12345<script>');
  await karima.getByRole('button', { name: 'Enregistrer les pixels' }).click();
  await expect(karima.locator('p[role=alert]').filter({ hasText: 'Identifiant de pixel invalide' })).toBeVisible();
  await karima.getByLabel('Identifiant du pixel Facebook / Instagram').fill('123456789012345');
  await karima.getByRole('button', { name: 'Enregistrer les pixels' }).click();
  await expect(karima.getByText('Enregistré. Les pixels sont actifs sur votre boutique en ligne.')).toBeVisible();
  const apres = await karima.request.get(`/b/${sd}`);
  const html = await apres.text();
  expect(html).toContain('fbevents.js');
  expect(html).toContain('"123456789012345"');
  expect(html).toContain('Cette boutique mesure l');
  expect(apres.headers()['content-security-policy']).toContain('https://www.facebook.com');
  // L'espace de gestion ne s'ouvre jamais à ces adresses.
  const gestion = await karima.request.get('/stock');
  expect(gestion.headers()['content-security-policy']).not.toContain('facebook');
});

test('plusieurs photos par produit, en galerie dans la boutique', async () => {
  await karima.goto(`/stock/${huileId}`);
  await karima.getByText(/Photos \(0 sur 6\)/).click();
  for (const couleur of ['#0e6b4e', '#b45309']) {
    const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: couleur } }).png().toBuffer();
    await karima.locator('details input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: photo });
    await karima.getByRole('button', { name: 'Ajouter cette photo' }).click();
    await expect(karima.locator('details img[alt^="Photo "]')).toHaveCount(couleur === '#0e6b4e' ? 1 : 2, { timeout: 15_000 });
  }
  await expect(karima.getByText('Principale')).toBeVisible();
  await sansDebordement(karima);
  const page = await karima.request.get(`/b/${sd}/p/${huileId}`);
  expect((await page.text()).match(/\/photo\/[0-9a-f-]{36}"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
});

test('barre du bas choisie par la personne, et export pour le comptable depuis Factures', async () => {
  await karima.goto('/plus');
  await karima.getByRole('link', { name: /Barre du bas/ }).click();
  await karima.getByLabel('Place 2').selectOption('commandes');
  await karima.getByRole('button', { name: 'Enregistrer ma barre' }).click();
  await expect(karima.getByText('Enregistré.')).toBeVisible();
  const barre = karima.getByRole('navigation', { name: 'Navigation principale' });
  await expect(barre.getByRole('link', { name: 'Commandes' })).toBeVisible();
  await expect(barre.getByRole('link', { name: 'Caisse' })).toHaveCount(0);
  await sansDebordement(karima);
  await karima.goto('/factures');
  await karima.getByRole('link', { name: 'Exporter' }).click();
  await expect(karima.getByRole('heading', { name: /comptable/i })).toBeVisible();
});

test('les nouveaux écrans en arabe, en thème sombre', async () => {
  await karima.goto('/plus');
  await karima.getByRole('button', { name: 'العربية' }).click();
  await karima.getByRole('button', { name: 'Sombre' }).or(karima.getByRole('button', { name: 'داكن' })).click();
  for (const [chemin, nom] of [['/caisse/depenses', 'depenses'], ['/stock/fournisseurs', 'fournisseurs'], ['/stock/arrivages/nouveau', 'arrivage'], ['/commandes/versements', 'versements'], ['/clients', 'clients'], ['/reglages/barre', 'barre']] as const) {
    await karima.goto(chemin);
    await expect(karima.locator('html')).toHaveAttribute('dir', 'rtl');
    await sansDebordement(karima);
    await karima.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await karima.goto('/caisse');
  await karima.getByRole('button', { name: /زيت 5 لتر/ }).click();
  await karima.getByRole('button', { name: /تحصيل|Encaisser/ }).last().click();
  await sansDebordement(karima);
  await karima.screenshot({ path: `${CAPTURES}/caisse-paiement-ar-sombre.png`, fullPage: true });
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
