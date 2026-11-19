// Parcours de l'étape 6 sur un écran de 360 px : le commerçant prépare et met en ligne sa boutique,
// un acheteur sans compte commande, le vendeur est prévenu et confirme. Quatre modèles, fr et ar.
import { request as http } from 'node:http';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { creerProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';

const CAPTURES = 'docs/etape-6/captures';
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
/** Page demandée avec un autre nom d'hôte (le navigateur de test ne résout pas « *.boutiques.test »). */
const parHote = (hote: string, chemin: string) => new Promise<{ statut: number; corps: string }>((fini, echec) => {
  const r = http({ host: '127.0.0.1', port: 3100, path: chemin, headers: { host: hote } }, (rep) => {
    let corps = '';
    rep.setEncoding('utf8');
    rep.on('data', (c) => (corps += c));
    rep.on('end', () => fini({ statut: rep.statusCode ?? 0, corps }));
  });
  r.on('error', echec);
  r.end();
});

test.describe.configure({ mode: 'serial' });

let yasmine: Page, acheteur: Page;
let telYasmine = '', commercantId = '', lienTicket = '';
const sd = `atelier-yasmine-${Date.now().toString(36)}`;
const telAcheteur = telephone();

test.beforeAll(async ({ browser }) => {
  const admin = await creerAdmin();
  const m = await creerCommercant(admin.id, 'Atelier Yasmine');
  commercantId = m.commercantId;
  telYasmine = m.telephone;
  const ctx = { commercantId, utilisateurId: m.proprietaireId };
  await avecCommercant(commercantId, async (trx) => {
    await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute();
    const cat = await trx.insertInto('categories').values({ commercant_id: commercantId, nom_fr: 'Bijoux', nom_ar: 'مجوهرات' }).returning('id').executeTakeFirstOrThrow();
    for (const [nomFr, nomAr, variantes, categorieId] of [
      ['Robe kabyle', 'جبة قبائلية', [{ libelle: '', stock: 3, prix: 6_500_00, barre: 8_000_00 }], null],
      ['Foulard en soie', 'وشاح حريري', [{ libelle: 'Rouge', stock: 2, prix: 1_200_00, barre: null }, { libelle: 'Bleu', stock: 0, prix: 1_200_00, barre: null }], null],
      ['Bague en argent', 'خاتم فضي', [{ libelle: '', stock: 0, prix: 2_500_00, barre: null }], cat.id],
    ] as const) {
      const r = await creerProduit(trx, ctx, { nomFr, nomAr, categorieId, variantes: variantes.map((v) => ({ libelle: v.libelle, codeBarres: null, prixAchat: 100_00, prixVente: v.prix, seuil: 0, stockInitial: v.stock })) });
      if (!r.ok) throw new Error(r.raison);
      if (variantes[0].barre) await trx.updateTable('variantes').set({ prix_barre: variantes[0].barre }).where('produit_id', '=', r.id).execute();
    }
    await trx.insertInto('frais_livraison').values({ commercant_id: commercantId, wilaya_code: 16, domicile: 500_00, point_relais: 300_00 }).execute();
  });
  yasmine = await ouvrir(browser);
  await connecter(yasmine, telYasmine, MDP);
});

test('le commerçant crée sa boutique avec l\'assistant, publie ses produits, personnalise et met en ligne', async () => {
  await yasmine.goto('/boutique');
  await expect(yasmine.getByRole('heading', { name: 'Que vendez-vous ?' })).toBeVisible();
  await yasmine.getByText('Vêtements et mode').click();
  await yasmine.getByRole('button', { name: 'Continuer' }).click();
  await yasmine.getByLabel('Nom de l\'adresse').fill('admin');
  for (let i = 0; i < 3; i++) await yasmine.getByRole('button', { name: 'Continuer' }).click();
  await expect(yasmine.getByRole('heading', { name: 'Tout est prêt' })).toBeVisible();
  await yasmine.getByText(/Publier mes \d+ produits/).click();
  await yasmine.getByRole('button', { name: 'Créer ma boutique' }).click();
  await expect(yasmine.getByText('Adresse invalide')).toBeVisible();
  await yasmine.getByRole('button', { name: 'Changer l\'adresse' }).click();
  await yasmine.getByLabel('Nom de l\'adresse').fill(sd);
  for (let i = 0; i < 3; i++) await yasmine.getByRole('button', { name: 'Continuer' }).click();
  await sansDebordement(yasmine);
  await yasmine.screenshot({ path: `${CAPTURES}/assistant-fr-clair.png`, fullPage: true });
  await yasmine.getByRole('button', { name: 'Créer ma boutique' }).click();
  await expect(yasmine.getByText('Votre boutique est créée !')).toBeVisible();
  await expect(yasmine.getByText(`http://${sd}.boutiques.test`)).toBeVisible();
  await expect(yasmine.getByText('Textes d\'exemple encore en place')).toBeVisible();
  await expect(yasmine.getByText('Coupée', { exact: true })).toBeVisible();

  for (const nom of ['Robe kabyle', 'Foulard en soie', 'Bague en argent']) await yasmine.getByRole('button', { name: `Visible dans la boutique · ${nom}` }).click();
  await yasmine.getByRole('button', { name: 'Nouveau · Robe kabyle' }).click();
  await expect(yasmine.getByText('Produits : 3 publiés')).toBeVisible();

  await yasmine.getByRole('radio', { name: 'Bordeaux' }).check({ force: true });
  await yasmine.locator('form', { hasText: 'Couleur principale' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(yasmine.getByText('Modifications enregistrées.').first()).toBeVisible();
  const textes = yasmine.locator('form', { hasText: 'Phrase d\'accroche' });
  for (const [nom, valeur] of [['slogan_fr', 'Atelier Yasmine'], ['slogan_ar', 'ورشة ياسمين'], ['accueil_fr', 'Tenues traditionnelles faites main à Tizi Ouzou.'], ['accueil_ar', 'ألبسة تقليدية مصنوعة يدويًا في تيزي وزو.'],
    ['livraison_fr', 'Livraison en 48 h dans les 69 wilayas.'], ['livraison_ar', 'التوصيل خلال 48 ساعة إلى 69 ولاية.'], ['retour_fr', 'Échange sous 7 jours.'], ['retour_ar', 'الاستبدال خلال 7 أيام.']] as const) {
    await textes.locator(`[name=${nom}]`).fill(valeur);
  }
  await textes.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(yasmine.getByText('Textes d\'exemple encore en place')).toHaveCount(0);
  const reglages = yasmine.locator('form', { hasText: 'Numéro WhatsApp' });
  await reglages.getByLabel('Numéro WhatsApp').fill('0661 22 33 44');
  await reglages.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(reglages.getByText('Modifications enregistrées.')).toBeVisible();

  await yasmine.getByRole('button', { name: 'Mettre la boutique en ligne' }).click();
  await expect(yasmine.getByText('En ligne', { exact: true }).first()).toBeVisible();
  await sansDebordement(yasmine);
  await yasmine.screenshot({ path: `${CAPTURES}/module-boutique-fr-clair.png`, fullPage: true });
  await yasmine.goto('/');
  await expect(yasmine.getByRole('link', { name: /Boutique en ligne/ })).toContainText('En ligne');
});

test('l\'acheteur voit la boutique : identité, pastilles, rupture, prix barré', async ({ browser }) => {
  acheteur = await ouvrir(browser);
  await acheteur.goto(`/b/${sd}`);
  await expect(acheteur.getByText('Atelier Yasmine').first()).toBeVisible();
  await expect(acheteur.getByText('Tenues traditionnelles faites main à Tizi Ouzou.')).toBeVisible();
  const robe = acheteur.getByRole('link', { name: /Robe kabyle/ });
  await expect(robe).toContainText('Nouveau');
  await expect(robe).toContainText('Plus que 3');
  await expect(robe).toContainText('8 000 DA');
  await expect(acheteur.getByRole('link', { name: /Bague en argent/ })).toContainText('Rupture de stock');
  await expect(acheteur.getByText('Livraison en 48 h dans les 69 wilayas.')).toBeVisible();
  await expect(acheteur.getByRole('link', { name: 'WhatsApp' }).first()).toHaveAttribute('href', 'https://wa.me/213661223344');
  await sansDebordement(acheteur);
  await acheteur.screenshot({ path: `${CAPTURES}/vitrine-fr-clair.png`, fullPage: true });

  await acheteur.getByRole('link', { name: /Bague en argent/ }).click();
  await expect(acheteur.getByRole('button', { name: 'Ajouter au panier' })).toBeDisabled();
  await acheteur.goBack();
  await acheteur.getByRole('link', { name: /Foulard en soie/ }).click();
  await acheteur.getByText('Bleu', { exact: true }).click();
  await expect(acheteur.getByRole('button', { name: 'Ajouter au panier' })).toBeDisabled();
  await acheteur.getByText('Rouge', { exact: true }).click();
  await acheteur.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(acheteur.getByRole('link', { name: 'Panier : 1 article' })).toBeVisible();
  await sansDebordement(acheteur);
  await acheteur.screenshot({ path: `${CAPTURES}/produit-fr-clair.png`, fullPage: true });
  await acheteur.goto(`/b/${sd}`);
  await acheteur.getByRole('link', { name: /Robe kabyle/ }).click();
  await acheteur.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(acheteur.getByRole('link', { name: 'Panier : 2 articles' })).toBeVisible();
});

test('commande sans compte : frais de la wilaya, carte refusée avec le message, ticket', async () => {
  await acheteur.getByRole('link', { name: 'Voir le panier' }).click();
  await acheteur.getByLabel('Nom et prénom').fill('Lydia Haddad');
  await acheteur.getByLabel('Téléphone').fill(telAcheteur);
  await acheteur.getByLabel('Wilaya').selectOption('16');
  await acheteur.locator('select[name=commune]').selectOption('Hydra');
  await expect(acheteur.getByText('8 200 DA')).toBeVisible(); // 6 500 + 1 200 + 500
  await acheteur.locator('label', { hasText: 'Point relais' }).click();
  await expect(acheteur.getByText('8 000 DA').last()).toBeVisible();
  await acheteur.locator('label', { hasText: 'À domicile' }).click();
  await acheteur.getByText('Carte CIB / Edahabia').click();
  await expect(acheteur.locator('p[role=alert]')).toHaveText('Le paiement par carte n\'est pas encore activé pour cette boutique. Choisissez le paiement à la livraison.');
  await expect(acheteur.getByRole('button', { name: 'Valider' })).toBeDisabled();
  await acheteur.getByText('Paiement à la livraison', { exact: true }).click();
  await sansDebordement(acheteur);
  await acheteur.screenshot({ path: `${CAPTURES}/panier-fr-clair.png`, fullPage: true });
  await acheteur.getByRole('button', { name: 'Valider' }).click();

  await expect(acheteur.getByRole('heading', { name: 'Votre commande est enregistrée' })).toBeVisible();
  await expect(acheteur.getByText('Ticket n° 1')).toBeVisible();
  await expect(acheteur.getByText('Appelez le vendeur et donnez-lui votre numéro de ticket pour confirmer.')).toBeVisible();
  await expect(acheteur.getByRole('link', { name: 'Appeler' })).toHaveAttribute('href', `tel:${telYasmine}`);
  await expect(acheteur.getByText('8 200 DA')).toBeVisible();
  await expect(acheteur.getByRole('link', { name: 'Panier vide' })).toBeVisible();
  lienTicket = new URL(acheteur.url()).pathname;
  expect(lienTicket).toMatch(new RegExp(`^/b/${sd}/t/[\\w-]{43}$`));
  await sansDebordement(acheteur);
  await acheteur.screenshot({ path: `${CAPTURES}/ticket-fr-clair.png`, fullPage: true });
  // Le stock est réservé : la robe n'en a plus que 2 de libres.
  await acheteur.goto(`/b/${sd}`);
  await expect(acheteur.getByRole('link', { name: /Robe kabyle/ })).toContainText('Plus que 2');
});

test('le vendeur est prévenu, retrouve le devis par le numéro du ticket, et confirme', async () => {
  await yasmine.goto('/');
  await expect(yasmine.getByRole('link', { name: 'Notifications : 1 nouvelle' })).toBeVisible();
  await yasmine.getByRole('link', { name: 'Notifications : 1 nouvelle' }).click();
  await yasmine.screenshot({ path: `${CAPTURES}/notifications-fr-clair.png`, fullPage: true });
  // Ouvrir la notification mène à la commande, et elle ne compte plus comme nouvelle.
  await yasmine.getByRole('button', { name: /Commande boutique n° 1/ }).click();
  await expect(yasmine).toHaveURL(/\/commandes\/[0-9a-f-]{36}$/);
  await expect(yasmine.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
  await yasmine.goto('/notifications');
  await expect(yasmine.getByRole('button', { name: 'Tout marquer comme vu' })).toHaveCount(0);

  await yasmine.goto('/factures?onglet=devis&n=1');
  const devis = yasmine.getByRole('link', { name: /DV-/ });
  await expect(devis).toContainText('Boutique en ligne');
  await devis.click();
  await yasmine.getByRole('link', { name: /Commande n° 1/ }).click();
  await expect(yasmine.getByText('Nouvelle', { exact: true }).first()).toBeVisible();
  await expect(yasmine.getByRole('main').getByText('Boutique en ligne')).toBeVisible();
  await expect(yasmine.getByText(/Stock réservé jusqu'au/)).toBeVisible();
  await yasmine.getByRole('button', { name: 'Envoi : préparer le colis' }).click();
  await expect(yasmine.getByText('Confirmée', { exact: true }).first()).toBeVisible();
  await acheteur.goto(lienTicket);
  await expect(acheteur.getByText(/Confirmée/)).toBeVisible();
});

test('les quatre modèles, et le produit épuisé masqué sur réglage', async () => {
  for (const [modele, nom] of [['Catalogue', 'catalogue'], ['Grandes photos', 'grandes-photos'], ['Produit unique', 'produit-unique'], ['Vitrine', 'vitrine']] as const) {
    await yasmine.goto('/boutique');
    await yasmine.getByText(modele, { exact: true }).click();
    if (nom === 'produit-unique') await yasmine.locator('select[name=produitUnique]').selectOption({ label: 'Robe kabyle' });
    await yasmine.locator('form', { hasText: 'Couleur principale' }).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(yasmine.getByText('Modifications enregistrées.').first()).toBeVisible();
    await acheteur.goto(`/b/${sd}`);
    if (nom === 'catalogue') {
      await acheteur.getByRole('link', { name: 'Bijoux' }).click();
      await expect(acheteur.getByRole('link', { name: /Bague en argent/ })).toBeVisible();
      await expect(acheteur.getByRole('link', { name: /Robe kabyle/ })).toHaveCount(0);
      await acheteur.goto(`/b/${sd}?q=foulard`);
      await expect(acheteur.getByRole('link', { name: /Foulard en soie/ })).toBeVisible();
      await acheteur.goto(`/b/${sd}`);
    }
    if (nom === 'produit-unique') {
      await expect(acheteur.getByRole('heading', { name: 'Robe kabyle' })).toBeVisible();
      await acheteur.getByRole('button', { name: 'Ajouter au panier' }).click();
      // Le formulaire de commande est sur la même page.
      await expect(acheteur.getByLabel('Nom et prénom')).toBeVisible();
    }
    await sansDebordement(acheteur);
    await acheteur.screenshot({ path: `${CAPTURES}/modele-${nom}-fr-clair.png`, fullPage: true });
  }
  await yasmine.goto('/boutique');
  await yasmine.getByText('Le masquer jusqu\'au retour du stock').click();
  await yasmine.locator('form', { hasText: 'Numéro WhatsApp' }).getByRole('button', { name: 'Enregistrer' }).click();
  await expect(yasmine.getByText('Modifications enregistrées.').last()).toBeVisible();
  await acheteur.goto(`/b/${sd}`);
  await expect(acheteur.getByRole('link', { name: /Bague en argent/ })).toHaveCount(0);
});

test('la boutique répond aussi sur son sous-domaine, avec des liens sans préfixe', async () => {
  const r = await parHote(`${sd}.boutiques.test`, '/');
  expect(r.statut).toBe(200);
  expect(r.corps).toContain('Atelier Yasmine');
  expect(r.corps).toContain('href="/panier"');
  expect(r.corps).not.toContain(`/b/${sd}/panier`);
  expect((await parHote('inconnue-zz.boutiques.test', '/')).statut).toBe(404);
});

test('boutique coupée : « momentanément indisponible » pour l\'acheteur, aperçu pour le commerçant', async () => {
  await yasmine.goto('/boutique');
  await yasmine.getByRole('button', { name: 'Couper la boutique' }).click();
  await expect(yasmine.getByText('Coupée', { exact: true })).toBeVisible();
  await acheteur.goto(`/b/${sd}`);
  await expect(acheteur.getByRole('heading', { name: 'Boutique momentanément indisponible' })).toBeVisible();
  await acheteur.goto(`/b/${sd}/panier`);
  await expect(acheteur.getByRole('heading', { name: 'Boutique momentanément indisponible' })).toBeVisible();
  await acheteur.screenshot({ path: `${CAPTURES}/indisponible-fr-clair.png`, fullPage: true });
  // Le ticket reste consultable par son lien privé.
  await acheteur.goto(lienTicket);
  await expect(acheteur.getByText('Ticket n° 1')).toBeVisible();
  await yasmine.goto(`/b/${sd}`);
  await expect(yasmine.getByText('Aperçu : votre boutique n\'est pas en ligne. Vous seul la voyez.')).toBeVisible();
  await yasmine.goto('/boutique');
  await yasmine.getByRole('button', { name: 'Mettre la boutique en ligne' }).click();
  await expect(yasmine.getByText('En ligne', { exact: true }).first()).toBeVisible();
});

test('demandes à l\'administrateur : site personnalisé et paiement par carte', async () => {
  await yasmine.goto('/boutique');
  await yasmine.getByText('Demander un site personnalisé').click();
  await yasmine.getByLabel('Votre idée (facultatif)').fill('Un site avec mon propre nom de domaine.');
  await yasmine.getByRole('button', { name: 'Envoyer la demande' }).first().click();
  await expect(yasmine.getByText(/Demande envoyée le/).first()).toBeVisible();
  await yasmine.getByText('Demander l\'activation').click();
  await yasmine.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(yasmine.getByText(/Demande envoyée le/)).toHaveCount(2);
});

test('la boutique et le module en arabe, en thème sombre', async () => {
  await acheteur.goto(`/b/${sd}`);
  await acheteur.getByRole('button', { name: /العربية/ }).click();
  await expect(acheteur.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(acheteur.getByText('ألبسة تقليدية مصنوعة يدويًا في تيزي وزو.')).toBeVisible();
  await acheteur.emulateMedia({ colorScheme: 'dark' });
  for (const [chemin, nom] of [[`/b/${sd}`, 'vitrine'], [`/b/${sd}/panier`, 'panier'], [lienTicket, 'ticket']] as const) {
    await acheteur.goto(chemin);
    await sansDebordement(acheteur);
    await acheteur.screenshot({ path: `${CAPTURES}/${nom}-ar-sombre.png`, fullPage: true });
  }
  await expect(acheteur.getByText('التذكرة رقم 1')).toBeVisible();
  // La langue se choisit dans « Plus » (et sur les pages publiques).
  await yasmine.goto('/plus');
  await yasmine.getByRole('button', { name: 'العربية' }).click();
  await expect(yasmine.locator('html')).toHaveAttribute('dir', 'rtl');
  await yasmine.goto('/plus');
  await yasmine.getByRole('button', { name: 'داكن' }).click();
  await expect(yasmine.getByRole('button', { name: 'داكن' })).toHaveAttribute('aria-pressed', 'true');
  await yasmine.goto('/boutique');
  await sansDebordement(yasmine);
  await yasmine.screenshot({ path: `${CAPTURES}/module-boutique-ar-sombre.png`, fullPage: true });
  await yasmine.goto('/plus');
  await yasmine.getByRole('button', { name: 'فاتح' }).click();
  await yasmine.goto('/plus');
  await yasmine.getByRole('button', { name: /Français/ }).click();
});

test('suppression de la boutique : adresse à retaper, adresse libérée, produits et commandes gardés', async () => {
  await yasmine.goto('/boutique');
  await yasmine.getByText('Supprimer la boutique').click();
  await yasmine.getByLabel(/Pour confirmer/).fill('autre-chose');
  await yasmine.getByRole('button', { name: 'Supprimer définitivement la boutique' }).click();
  await expect(yasmine.getByText('L\'adresse tapée ne correspond pas. Rien n\'a été supprimé.')).toBeVisible();
  await yasmine.getByLabel(/Pour confirmer/).fill(sd);
  await yasmine.getByRole('button', { name: 'Supprimer définitivement la boutique' }).click();
  await expect(yasmine.getByText(/Votre boutique a été supprimée/)).toBeVisible();
  await expect(yasmine.getByRole('heading', { name: 'Que vendez-vous ?' })).toBeVisible();
  expect((await acheteur.request.get(`/b/${sd}`)).status()).toBe(404);
  await avecCommercant(commercantId, async (trx) => {
    expect(await trx.selectFrom('boutiques').select('commercant_id').execute()).toHaveLength(0);
    expect((await trx.selectFrom('produits').select('id').where('archive_le', 'is', null).execute()).length).toBeGreaterThan(0);
    expect((await trx.selectFrom('commandes').select('id').execute()).length).toBeGreaterThan(0);
  });
});

test('aucune erreur de script ni violation de la politique de sécurité pendant tout le parcours', async () => {
  expect(problemes).toEqual([]);
});
