// Boutique en ligne : adresse, catalogue relié au stock, tickets sans compte, expiration, anti-fraude,
// demandes, notifications, et chiffrement des notifications sur le téléphone.
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import {
  catalogue, changerSousDomaine, compterNonVues, creerTicket, demander, enregistrerAbonnement, enregistrerReglages, lireReglages, lireTicket, listerNotifications, marquerVues, ouvrirNotification,
  mettreEnLigne, PALETTE, REGLAGES_DEFAUT, trouverBoutique, verifierSousDomaine, type SaisieTicket, type Vitrine,
} from '../../src/lib/boutique.ts';
import { confirmerCommande, expirerTickets, lireCommande } from '../../src/lib/commandes.ts';
import { abonnementValide, adresseAutorisee, chiffrerMessage, creerClesVapid, jetonVapid } from '../../src/lib/push.ts';
import { creerProduit, lireProduit, type Contexte } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, telephone } from '../outils.ts';

let A: Contexte, B: Contexte;
let robe: string, cache: string, sdA = '';
const chez = <T>(c: Contexte, fn: Parameters<typeof avecCommercant<T>>[1]) => avecCommercant(c.commercantId, fn);
const stock = (v: string) => chez(A, (trx) => trx.selectFrom('stocks').select(['quantite', 'reservee']).where('variante_id', '=', v).executeTakeFirstOrThrow());

async function produit(c: Contexte, nom: string, stockInitial: number, visible: boolean) {
  const r = await chez(c, (trx) => creerProduit(trx, c, { nomFr: nom, nomAr: '', categorieId: null, variantes: [{ libelle: '', codeBarres: null, prixAchat: 1_000_00, prixVente: 3_000_00, seuil: 0, stockInitial }] }));
  if (!r.ok) throw new Error(r.raison);
  await chez(c, (trx) => trx.updateTable('produits').set({ visible_boutique: visible }).where('id', '=', r.id).execute());
  return (await chez(c, (trx) => lireProduit(trx, r.id)))!.variantes[0]!.id;
}
const ticket = (o: Partial<SaisieTicket> = {}): SaisieTicket => ({
  nom: 'Sara', telephone: telephone(), wilaya: 16, commune: 'Kouba', livraison: 'domicile', lignes: [{ varianteId: robe, quantite: 1 }],
  piege: '', appareil: crypto.randomUUID(), libelleLivraison: 'Livraison', cle: crypto.randomUUID(), ...o,
});
const perimer = (id: string) => chez(A, (trx) => trx.updateTable('commandes').set({ reservation_jusqua: new Date(Date.now() - 60_000) }).where('id', '=', id).execute());
const vitrine = async () => (await trouverBoutique(sdA))!;
const ouvrir = async () => {
  await chez(A, (trx) => trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute());
  await chez(A, (trx) => mettreEnLigne(trx, A, true));
};

beforeAll(async () => {
  const admin = await creerAdmin();
  A = (({ commercantId, proprietaireId }) => ({ commercantId, utilisateurId: proprietaireId }))(await creerCommercant(admin.id, 'Boutique A'));
  B = (({ commercantId, proprietaireId }) => ({ commercantId, utilisateurId: proprietaireId }))(await creerCommercant(admin.id, 'Boutique B'));
  robe = await produit(A, 'Robe', 3, true);
  cache = await produit(A, 'Pas publié', 10, false);
  sdA = `test-a-${Date.now().toString(36)}`;
  await chez(A, (trx) => trx.insertInto('frais_livraison').values({ commercant_id: A.commercantId, wilaya_code: 16, domicile: 500_00, point_relais: null }).execute());
});
afterAll(fermerBD);

describe('adresse et mise en ligne', () => {
  it('vérifie le nom choisi : format, noms réservés, nom déjà pris', async () => {
    expect(verifierSousDomaine(' Magasin-Ali ')).toBe('magasin-ali');
    for (const faux of ['ab', '-ali', 'ali-', 'ali--x', 'ali_x', 'été', 'admin', 'www', 'a'.repeat(41)]) expect(verifierSousDomaine(faux), faux).toBeNull();
    expect(await chez(A, (trx) => changerSousDomaine(trx, sdA))).toEqual({ ok: true, sousDomaine: sdA });
    expect(await chez(B, (trx) => changerSousDomaine(trx, sdA))).toEqual({ ok: false, raison: 'sous_domaine_pris' });
    expect(await chez(B, (trx) => mettreEnLigne(trx, B, true))).toEqual({ ok: false, raison: 'sous_domaine_requis' });
  });

  it('coupée par défaut ; en ligne seulement si le module est actif et le compte actif', async () => {
    await chez(A, (trx) => trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: false }) }).execute());
    expect((await vitrine()).disponible).toBe(false);
    await chez(A, (trx) => mettreEnLigne(trx, A, true));
    expect((await vitrine()).disponible).toBe(false); // module Boutique encore éteint
    await ouvrir();
    expect((await vitrine()).disponible).toBe(true);
    await bd('plateforme').updateTable('commercants').set({ etat: 'lecture_seule' }).where('id', '=', A.commercantId).execute();
    expect((await vitrine()).disponible).toBe(false);
    await bd('plateforme').updateTable('commercants').set({ etat: 'actif' }).where('id', '=', A.commercantId).execute();
    expect(await trouverBoutique('inconnue-xyz')).toBeNull();
  });

  it('réglages : valeurs vérifiées, liens des réseaux limités au bon site', async () => {
    const r = await chez(A, (trx) => enregistrerReglages(trx, A, {
      ...REGLAGES_DEFAUT, modele: 'catalogue', couleur: 'bleu', whatsapp: '0661 22 33 44',
      reseaux: { facebook: 'https://www.facebook.com/magasin', instagram: 'javascript:alert(1)', tiktok: 'https://evil.example/tiktok.com' },
      sections: ['contact', 'produits'], accueil: { fr: 'Bienvenue', ar: 'مرحبا' },
    }));
    expect(r).toEqual({ ok: true });
    const l = await chez(A, lireReglages);
    expect(l).toMatchObject({ modele: 'catalogue', couleur: 'bleu', whatsapp: '0661223344', reseaux: { facebook: 'https://www.facebook.com/magasin' } });
    expect(l.sections).toEqual(['contact', 'produits', 'accueil', 'conditions']);
    expect(await chez(A, (trx) => enregistrerReglages(trx, A, { ...REGLAGES_DEFAUT, couleur: '#ff0000' }))).toEqual({ ok: false, raison: 'champ_requis' });
    await chez(A, (trx) => enregistrerReglages(trx, A, { ...l, modele: 'vitrine' }));
  });

  it('chaque couleur de la palette garde un contraste d\'au moins 4,5:1 avec le texte blanc', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    for (const [nom, c] of Object.entries(PALETTE)) expect((1.05) / (lum(c.fond) + 0.05), nom).toBeGreaterThanOrEqual(4.5);
  });
});

describe('catalogue et tickets', () => {
  it('ne montre que les produits publiés, avec leur stock libre', async () => {
    const v = await vitrine();
    const p = await chez(A, (trx) => catalogue(trx, { commercantId: A.commercantId, reglages: v.reglages }));
    expect(p.map((x) => x.nom_fr)).toEqual(['Robe']);
    expect(p[0]!.disponible).toBe(3);
  });

  it('un ticket crée un devis « Boutique en ligne » et une commande « Nouvelle », réserve le stock et prévient le vendeur', async () => {
    const r = await creerTicket(await vitrine(), ticket({ lignes: [{ varianteId: robe, quantite: 2 }] }));
    if (!r.ok) throw new Error(r.raison);
    expect(await stock(robe)).toEqual({ quantite: 3, reservee: 2 });
    const c = (await chez(A, (trx) => lireCommande(trx, r.commandeId)))!;
    expect(c).toMatchObject({ statut: 'nouvelle', origine: 'boutique', total: 6_500_00, frais: 500_00 });
    const devis = await chez(A, (trx) => trx.selectFrom('documents').select(['origine', 'etat']).where('id', '=', c.devis.id).executeTakeFirstOrThrow());
    expect(devis).toEqual({ origine: 'boutique', etat: 'en_attente' });
    expect(await chez(A, (trx) => compterNonVues(trx, A.utilisateurId))).toBe(1);
    await chez(A, (trx) => marquerVues(trx, A));
    expect(await chez(A, (trx) => compterNonVues(trx, A.utilisateurId))).toBe(0);
    // Le lien privé retrouve le ticket, sans le téléphone de l'acheteur.
    const t = (await lireTicket(A.commercantId, r.jeton))!;
    expect(t).toMatchObject({ numero: r.numero, statut: 'nouvelle', nom: 'Sara', total: 6_500_00 });
    expect(JSON.stringify(t)).not.toMatch(/05\d{8}/);
    expect(await lireTicket(A.commercantId, 'x'.repeat(43))).toBeNull();
    expect(await lireTicket(B.commercantId, r.jeton)).toBeNull();
    // Le catalogue ne propose plus que l'article restant.
    expect((await chez(A, async (trx) => catalogue(trx, { commercantId: A.commercantId, reglages: (await vitrine()).reglages })))[0]!.disponible).toBe(1);
    // Le vendeur confirme comme pour une commande prise au téléphone.
    expect((await chez(A, (trx) => confirmerCommande(trx, A, r.commandeId, 'envoi', crypto.randomUUID()))).ok).toBe(true);
    expect(await stock(robe)).toEqual({ quantite: 3, reservee: 2 });
    expect((await lireTicket(A.commercantId, r.jeton))!.statut).toBe('confirmee');
  });

  it('refuse : robot, téléphone invalide, produit non publié, stock épuisé, boutique coupée', async () => {
    const v = await vitrine();
    expect(await creerTicket(v, ticket({ piege: 'http://spam' }))).toEqual({ ok: false, raison: 'refuse' });
    expect(await creerTicket(v, ticket({ telephone: '123' }))).toEqual({ ok: false, raison: 'telephone_invalide' });
    expect(await creerTicket(v, ticket({ lignes: [{ varianteId: cache, quantite: 1 }] }))).toEqual({ ok: false, raison: 'produit_indisponible' });
    expect(await creerTicket(v, ticket({ lignes: [{ varianteId: robe, quantite: 5 }] }))).toEqual({ ok: false, raison: 'stock_insuffisant' });
    expect(await creerTicket({ ...v, disponible: false }, ticket())).toEqual({ ok: false, raison: 'boutique_indisponible' });
  });

  it('limite les tickets par téléphone et par appareil', async () => {
    const v = await vitrine();
    const tel = telephone();
    const t = (o: Partial<SaisieTicket>) => creerTicket(v, ticket({ telephone: tel, lignes: [{ varianteId: robe, quantite: 1 }], ...o }));
    // Le stock (1 article libre) fait échouer les suivants, mais chaque essai compte.
    for (let i = 0; i < 3; i++) expect(await t({})).not.toEqual({ ok: false, raison: 'trop_de_tickets' });
    expect(await t({})).toEqual({ ok: false, raison: 'trop_de_tickets' });
    const appareil = crypto.randomUUID();
    for (let i = 0; i < 5; i++) await creerTicket(v, ticket({ appareil, telephone: telephone() }));
    expect(await creerTicket(v, ticket({ appareil, telephone: telephone() }))).toEqual({ ok: false, raison: 'trop_de_tickets' });
    // Remise à zéro pour la suite des tests.
    for (const c of await chez(A, (trx) => trx.selectFrom('commandes').select('id').where('statut', '=', 'nouvelle').execute())) {
      await perimer(c.id);
    }
    await chez(A, (trx) => expirerTickets(trx, A));
  });

  it('sans confirmation à temps : devis expiré, stock libéré, commande annulée', async () => {
    const avant = await stock(robe);
    const r = await creerTicket(await vitrine(), ticket());
    if (!r.ok) throw new Error(r.raison);
    expect((await stock(robe)).reservee).toBe(avant.reservee + 1);
    await perimer(r.commandeId);
    // La simple lecture du ticket (ou du catalogue) fait expirer ce qui est périmé.
    expect((await lireTicket(A.commercantId, r.jeton))!.statut).toBe('annulee');
    expect(await stock(robe)).toEqual(avant);
    const c = (await chez(A, (trx) => lireCommande(trx, r.commandeId)))!;
    expect(c.historique[0]).toMatchObject({ evenement: 'expiree', nouveau: 'annulee' });
    const etat = await chez(A, (trx) => trx.selectFrom('documents').select('etat').where('id', '=', c.devis.id).executeTakeFirstOrThrow());
    expect(etat.etat).toBe('expire');
  });

  it('ouvrir une notification la marque comme lue pour cette personne seulement ; une commande traitée n\'est plus « nouvelle »', async () => {
    const pull = await produit(A, 'Pull', 5, true);
    const r = await creerTicket(await vitrine(), ticket({ lignes: [{ varianteId: pull, quantite: 1 }] }));
    if (!r.ok) throw new Error(r.raison);
    const avant = await chez(A, (trx) => compterNonVues(trx, A.utilisateurId));
    const n = (await chez(A, (trx) => listerNotifications(trx, A.utilisateurId))).find((x) => x.commande_id === r.commandeId)!;
    expect(n.nouvelle).toBe(true);
    expect(await chez(A, (trx) => ouvrirNotification(trx, A, n.id))).toBe(r.commandeId);
    await chez(A, (trx) => ouvrirNotification(trx, A, n.id)); // deux fois : sans erreur
    expect(await chez(A, (trx) => compterNonVues(trx, A.utilisateurId))).toBe(avant - 1);
    expect((await chez(A, (trx) => listerNotifications(trx, A.utilisateurId))).find((x) => x.id === n.id)!.nouvelle).toBe(false);
    // Un autre commerçant ne peut pas ouvrir cette notification.
    expect(await chez(B, (trx) => ouvrirNotification(trx, B, n.id))).toBeNull();
    // Commande annulée par quelqu'un d'autre : plus rien à faire, elle n'est plus comptée.
    const r2 = await creerTicket(await vitrine(), ticket({ lignes: [{ varianteId: pull, quantite: 1 }] }));
    if (!r2.ok) throw new Error(r2.raison);
    const avec = await chez(A, (trx) => compterNonVues(trx, A.utilisateurId));
    await chez(A, (trx) => trx.updateTable('commandes').set({ statut: 'annulee' }).where('id', '=', r2.commandeId).execute());
    expect(await chez(A, (trx) => compterNonVues(trx, A.utilisateurId))).toBe(avec - 1);
  });

  it('produit épuisé : affiché en rupture, ou masqué selon le réglage', async () => {
    const epuise = await produit(A, 'Épuisé', 0, true);
    void epuise;
    const v = await vitrine();
    const visibles = await chez(A, (trx) => catalogue(trx, { commercantId: A.commercantId, reglages: v.reglages }));
    expect(visibles.find((p) => p.nom_fr === 'Épuisé')?.disponible).toBe(0);
    const masques = await chez(A, (trx) => catalogue(trx, { commercantId: A.commercantId, reglages: { ...v.reglages, ruptures: 'masque' } }));
    expect(masques.find((p) => p.nom_fr === 'Épuisé')).toBeUndefined();
  });
});

describe('demandes, isolation, notifications sur le téléphone', () => {
  it('une demande d\'activation à la fois ; l\'administrateur les voit, l\'autre commerçant non', async () => {
    expect(await chez(A, (trx) => demander(trx, A, 'paiement_carte', { nom: 'Ali', telephone: '0550123456' }))).toEqual({ ok: true });
    expect(await chez(A, (trx) => demander(trx, A, 'paiement_carte', { nom: 'Ali', telephone: '0550123456' }))).toEqual({ ok: false, raison: 'demande_en_cours' });
    expect(await chez(A, (trx) => demander(trx, A, 'site_personnalise', { nom: 'Ali', telephone: '0550123456', message: 'Un site à mon nom' }))).toEqual({ ok: true });
    const vues = await bd('plateforme').selectFrom('demandes').select(['type', 'nom']).where('commercant_id', '=', A.commercantId).execute();
    expect(vues).toHaveLength(2);
    expect(await chez(B, (trx) => trx.selectFrom('demandes').select('id').execute())).toEqual([]);
    expect(await chez(B, (trx) => trx.selectFrom('notifications').select('id').execute())).toEqual([]);
    // Le commerçant ne peut pas activer lui-même le paiement par carte.
    await expect(chez(A, (trx) => trx.updateTable('commercants').set({ paiement_carte_actif: true }).execute())).rejects.toThrow(/permission denied/);
  });

  it('chiffre le message comme le navigateur l\'attend (RFC 8291) et signe le jeton VAPID', async () => {
    // Le « navigateur » : sa paire de clés et son secret.
    const ua = createECDH('prime256v1');
    ua.generateKeys();
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const abonnement = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: Buffer.from(auth).toString('base64url') } };
    expect(abonnementValide(abonnement)).toBe(true);
    const corps = chiffrerMessage(abonnement, '{"titre":"Nouvelle commande"}');
    // Déchiffrement côté navigateur.
    const sel = corps.subarray(0, 16);
    expect(corps.readUInt32BE(16)).toBe(4096);
    const lg = corps.readUInt8(20);
    const asPub = corps.subarray(21, 21 + lg);
    const h = (k: Buffer | Uint8Array, ...d: Buffer[]) => createHmac('sha256', k).update(Buffer.concat(d)).digest();
    const partage = ua.computeSecret(asPub);
    const ikm = h(h(Buffer.from(auth), partage), Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1]));
    const prk = h(sel, ikm);
    const cek = h(prk, Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])).subarray(0, 16);
    const nonce = h(prk, Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])).subarray(0, 12);
    const chiffre = corps.subarray(21 + lg);
    const d = createDecipheriv('aes-128-gcm', cek, nonce);
    d.setAuthTag(chiffre.subarray(-16));
    const clair = Buffer.concat([d.update(chiffre.subarray(0, -16)), d.final()]);
    expect(clair.subarray(0, -1).toString()).toBe('{"titre":"Nouvelle commande"}');
    expect(clair.at(-1)).toBe(2);

    const cles = { ...creerClesVapid(), contact: 'https://exemple.dz' };
    const jwt = jetonVapid(abonnement.endpoint, cles, 1_700_000_000_000);
    const [e, c, sig] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 12 * 3600, sub: 'https://exemple.dz' });
    const pub = Buffer.from(cles.publique, 'base64url');
    const cle = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${e}.${c}`), { key: cle, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true);
  });

  it('n\'envoie qu\'aux services de notification connus, et garde l\'abonnement chiffré', async () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) expect(adresseAutorisee(ok), ok).toBe(true);
    for (const non of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.dz/x', 'https://evil.dz/push.apple.com', 'https://fcm.googleapis.com:8443/x']) expect(adresseAutorisee(non), non).toBe(false);
    const ua = createECDH('prime256v1');
    ua.generateKeys();
    const ab = { endpoint: 'https://fcm.googleapis.com/fcm/send/secret-123', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };
    await chez(A, (trx) => enregistrerAbonnement(trx, A, ab));
    await chez(A, (trx) => enregistrerAbonnement(trx, A, ab)); // le même téléphone n'est gardé qu'une fois
    const lignes = await chez(A, (trx) => trx.selectFrom('abonnements_push').select('abonnement_chiffre').execute());
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.abonnement_chiffre).not.toContain('secret-123');
  });
});

void (null as unknown as Vitrine);
