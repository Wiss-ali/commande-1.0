// Étape 8 : page d'état, contrôle des certificats des sous-domaines, suppression des données d'un client.
// Nommé pour passer après parcours.spec.ts, qui attend une base sans commerçant.
import { expect, test } from '@playwright/test';
import { avecCommercant } from '../../src/lib/bd.ts';
import { changerSousDomaine } from '../../src/lib/boutique.ts';
import { creerCommande } from '../../src/lib/commandes.ts';
import { creerProduit, lireProduit } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, MDP, telephone } from '../outils.ts';

test.describe.configure({ mode: 'serial' });

let tel = '', sd = '', clientId = '';
const telClient = telephone();

test.beforeAll(async () => {
  const admin = await creerAdmin();
  const m = await creerCommercant(admin.id, 'Magasin Vérif');
  tel = m.telephone;
  sd = `verif-${Date.now().toString(36)}`;
  const ctx = { commercantId: m.commercantId, utilisateurId: m.proprietaireId };
  await avecCommercant(m.commercantId, async (trx) => {
    await changerSousDomaine(trx, sd);
    const p = await creerProduit(trx, ctx, { nomFr: 'Article', nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: 0, prixVente: 100_00, seuil: 0, stockInitial: 5 }] });
    if (!p.ok) throw new Error(p.raison);
    const v = (await lireProduit(trx, p.id))!.variantes[0]!.id;
    const c = await creerCommande(trx, ctx, { client: { nom: 'Nadia Ouali', telephone: telClient }, wilaya: 16, commune: 'Kouba', livraison: 'domicile', adresse: 'Rue des Oliviers', lignes: [{ varianteId: v, quantite: 1 }], cle: crypto.randomUUID(), libelleLivraison: 'Livraison' });
    if (!c.ok) throw new Error(c.raison);
    clientId = (await trx.selectFrom('commandes').select('client_id').where('id', '=', c.id).executeTakeFirstOrThrow()).client_id;
  });
});

test('page d\'état : « ok » pour tous, le détail seulement avec le jeton', async ({ request }) => {
  const r = await request.get('/etat');
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ etat: 'ok' });
  const faux = await request.get('/etat', { headers: { Authorization: 'Bearer jeton-faux-de-test-2026' } });
  expect(await faux.json()).toEqual({ etat: 'ok' });
  const d = await request.get('/etat', { headers: { Authorization: 'Bearer jeton-etat-de-test-2026' } });
  expect(await d.json()).toMatchObject({ etat: 'ok', application: 'ok', base: 'ok' });
});

test('certificats HTTPS : seulement pour une boutique qui existe', async ({ request }) => {
  expect((await request.get(`/api/tls-autorise?domain=${sd}.boutiques.test`)).status()).toBe(200);
  expect((await request.get('/api/tls-autorise?domain=inconnue-zz.boutiques.test')).status()).toBe(403);
  expect((await request.get('/api/tls-autorise?domain=admin.boutiques.test')).status()).toBe(403);
  expect((await request.get(`/api/tls-autorise?domain=${sd}.autre-domaine.dz`)).status()).toBe(403);
  expect((await request.get('/api/tls-autorise')).status()).toBe(403);
});

test('le propriétaire supprime les données d\'un client à sa demande', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('Numéro de téléphone').fill(tel);
  await page.getByLabel('Mot de passe').fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: /^Bonjour/ })).toBeVisible();
  await page.goto(`/clients/${clientId}`);
  await expect(page.getByText('Nadia Ouali').first()).toBeVisible();
  await page.getByText('Supprimer les données de ce client').click();
  await page.getByLabel('Le client a demandé la suppression de ses données').check();
  await page.getByRole('button', { name: 'Supprimer ses données' }).click();
  await expect(page.getByText(/Données personnelles supprimées le/)).toBeVisible();
  await expect(page.getByText('Nadia Ouali')).toHaveCount(0);
  await page.goto(`/clients?q=${telClient}`);
  await expect(page.getByText('Aucun client trouvé')).toBeVisible();
});
