// Magasin de démonstration : un commerçant fictif rempli (produits, ventes, commandes, fournisseur, boutique en ligne).
// Sert au script `npm run demo` (développement) et à la boutique de démonstration de l'administrateur, ouverte d'un
// bouton dans l'administration. Une seule démo active ; « Remettre à zéro » archive l'ancienne et en crée une neuve
// (les documents émis ne s'effacent jamais, même fictifs : c'est une règle de la base).
import { randomBytes } from 'node:crypto';
import { avecCommercant, bd } from './bd.ts';
import { changerSousDomaine, enregistrerReglages, mettreEnLigne, REGLAGES_DEFAUT } from './boutique.ts';
import { ajouterTransporteur, confirmerCommande, creerCommande, enregistrerFrais, expedier, listerWilayas, marquerLivree, marquerPreparee } from './commandes.ts';
import { creerDepense } from './depenses.ts';
import { vendreEnCaisse } from './documents.ts';
import { creerArrivage, enregistrerFournisseur } from './fournisseurs.ts';
import { accepterInvitation, inviterCommercant } from './invitations.ts';
import { journaliser } from './journal.ts';
import { creerProduit, lireProduit, type Contexte } from './stock.ts';

/** Adresse de la boutique en ligne de la démo de l'administrateur. */
export const SOUS_DOMAINE_DEMO = 'boutique-demo';
const cle = () => crypto.randomUUID();

/** Remplit un magasin vide : une dizaine de produits, des ventes du jour, un crédit, des commandes, un fournisseur, la boutique. */
export async function remplirMagasin(ctx: Contexte, o: { sousDomaine: string; whatsapp?: string }): Promise<void> {
  const simple = (nomFr: string, nomAr: string, codeBarres: string | null, achat: number, vente: number, stock: number, seuil: number) =>
    ({ nomFr, nomAr, categorieId: null, variantes: [{ libelle: '', codeBarres, prixAchat: achat * 100, prixVente: vente * 100, seuil, stockInitial: stock }] });
  const tailles = (nomFr: string, nomAr: string, libelles: string[], achat: number, vente: number, stocks: number[]) =>
    ({ nomFr, nomAr, categorieId: null, variantes: libelles.map((libelle, i) => ({ libelle, codeBarres: null, prixAchat: achat * 100, prixVente: vente * 100, seuil: 1, stockInitial: stocks[i]! })) });
  const v: Record<string, string> = {};
  await avecCommercant(ctx.commercantId, async (trx) => {
    for (const p of [
      simple('Café moulu 250 g', 'قهوة مطحونة 250 غ', '6130000000015', 180, 250, 24, 6),
      simple('Thé vert 100 g', 'شاي أخضر 100 غ', '6130000000022', 80, 120, 3, 5),
      simple('Sucre 1 kg', 'سكر 1 كغ', null, 95, 110, 40, 10),
      simple('Huile 5 L', 'زيت 5 لتر', null, 1000, 1200, 12, 4),
      simple('Pâtes 500 g', 'عجائن 500 غ', null, 60, 85, 50, 10),
      simple('Lait en poudre 500 g', 'حليب مجفف 500 غ', null, 450, 560, 8, 3),
      simple('Savon de Marseille', 'صابون مرسيليا', null, 60, 90, 0, 4),
      simple('Parfum 50 ml', 'عطر 50 مل', null, 1500, 2500, 5, 2),
      tailles('T-shirt uni', 'قميص سادة', ['S', 'M', 'L'], 500, 900, [4, 6, 0]),
      tailles('Jean droit', 'سروال جينز', ['38', '40', '42'], 1800, 3200, [2, 3, 1]),
    ]) {
      const r = await creerProduit(trx, ctx, p);
      if (!r.ok) throw new Error(r.raison);
      for (const x of (await lireProduit(trx, r.id))!.variantes) v[`${p.nomFr}${x.libelle ? ` ${x.libelle}` : ''}`] = x.id;
    }
    // Ventes du jour à la caisse, dont une à crédit.
    for (const lignes of [[['Café moulu 250 g', 2], ['Sucre 1 kg', 1]], [['Huile 5 L', 1]], [['Pâtes 500 g', 4], ['Lait en poudre 500 g', 1]]] as const) {
      await vendreEnCaisse(trx, ctx, { lignes: lignes.map(([n, q]) => ({ varianteId: v[n]!, quantite: q })), cle: cle() });
    }
    await vendreEnCaisse(trx, ctx, { lignes: [{ varianteId: v['Parfum 50 ml']!, quantite: 1 }], acheteur: { nom: 'Hadj Mokhtar', telephone: '0661234567' }, encaisse: [{ mode: 'especes', montant: 100_000 }], cle: cle() });
    // Fournisseur, arrivage payé en partie, et une dépense du mois.
    const f = await enregistrerFournisseur(trx, ctx, { nom: 'Grossiste Amine', telephone: '0770112233' });
    if (f.ok) await creerArrivage(trx, ctx, { fournisseurId: f.id, reference: 'BL-1024', lignes: [{ varianteId: v['Sucre 1 kg']!, quantite: 20, coutUnitaire: 9_500 }], paye: { montant: 100_000, mode: 'especes' }, cle: cle() });
    await creerDepense(trx, ctx, { categorie: 'loyer', libelle: 'Loyer du magasin', montant: 3_000_000, mode: 'virement', parCaisse: false, cle: cle() });
  });
  // Livraison : un transporteur, les frais des 69 wilayas, et des commandes à chaque étape.
  await avecCommercant(ctx.commercantId, async (trx) => {
    const t = await ajouterTransporteur(trx, ctx, 'Yalidine');
    if (!t.ok) throw new Error(t.raison);
    const grille = (await listerWilayas(trx)).map((w) => ({ wilaya: w.code, domicile: w.code === 31 ? 40_000 : 70_000, pointRelais: w.code === 31 ? 25_000 : 45_000 }));
    await enregistrerFrais(trx, ctx, grille);
    const transporteurId = t.id;
    const commande = async (nom: string, telephone: string, wilaya: number, commune: string, varianteId: string, quantite: number) => {
      const c = await creerCommande(trx, ctx, { client: { nom, telephone }, wilaya, commune, livraison: 'domicile', lignes: [{ varianteId, quantite }], cle: cle(), libelleLivraison: 'Livraison' });
      if (!c.ok) throw new Error(c.raison);
      return c.id;
    };
    await commande('Amina', '0661000001', 16, 'Bab Ezzouar', v['T-shirt uni M']!, 2);
    const aExpedier = await commande('Yacine', '0770000002', 31, 'Bir El Djir', v['Café moulu 250 g']!, 3);
    await confirmerCommande(trx, ctx, aExpedier, 'envoi', cle());
    const livree = await commande('Sara', '0550000003', 25, 'Constantine', v['Jean droit 40']!, 1);
    await confirmerCommande(trx, ctx, livree, 'envoi', cle());
    await marquerPreparee(trx, ctx, livree);
    await expedier(trx, ctx, livree, { transporteurId, numeroSuivi: 'YAL-0001' });
    await marquerLivree(trx, ctx, livree);
  });
  // Boutique en ligne : tous les modules, produits publiés, en ligne.
  await avecCommercant(ctx.commercantId, async (trx) => {
    await trx.updateTable('commercants').set({ modules: JSON.stringify({ stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true }) }).execute();
    await trx.updateTable('produits').set({ visible_boutique: true }).execute();
    await changerSousDomaine(trx, o.sousDomaine);
    await enregistrerReglages(trx, ctx, {
      ...REGLAGES_DEFAUT,
      accueil: { fr: 'Épicerie et vêtements, livrés dans les 69 wilayas.', ar: 'بقالة وملابس، توصيل إلى 69 ولاية.' },
      livraison: { fr: 'Livraison en 48 à 72 heures. Paiement à la livraison.', ar: 'التوصيل خلال 48 إلى 72 ساعة. الدفع عند الاستلام.' },
      whatsapp: o.whatsapp ?? null,
    });
    await mettreEnLigne(trx, ctx, true);
  });
}

/** Démo active de l'administrateur : le commerçant et son propriétaire, ou null. */
export async function demoActive(): Promise<{ commercantId: string; utilisateurId: string } | null> {
  const r = await bd('auth')
    .selectFrom('commercants as c')
    .innerJoin('utilisateurs as u', (j) => j.onRef('u.commercant_id', '=', 'c.id').on('u.role', '=', 'proprietaire'))
    .select(['c.id', 'u.id as utilisateur_id'])
    .where('c.demo', '=', true).where('c.etat', '<>', 'archive')
    .executeTakeFirst();
  return r ? { commercantId: r.id, utilisateurId: r.utilisateur_id } : null;
}

/** Numéro fictif libre (le compte de démonstration ne sert jamais à se connecter avec un mot de passe). */
async function telephoneLibre(): Promise<string> {
  for (;;) {
    const tel = `0599${String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, '0')}`;
    const pris = await bd('auth').selectFrom('utilisateurs').select('id').where('telephone', '=', tel).executeTakeFirst();
    if (!pris) return tel;
  }
}

/**
 * Crée la démo de l'administrateur si elle n'existe pas. Le compte a un mot de passe aléatoire que personne ne
 * connaît : on n'y entre que par le bouton de l'administration (administrateur connecté, double authentification).
 */
export async function assurerDemo(adminId: string): Promise<{ commercantId: string; utilisateurId: string }> {
  const deja = await demoActive();
  if (deja) return deja;
  const inv = await inviterCommercant({ adminId, nomCommercant: 'Boutique de démonstration', nom: 'Démo', telephone: await telephoneLibre() });
  if (!inv.ok) throw new Error('demo_invitation');
  const acc = await accepterInvitation(inv.jeton, {
    motDePasse: randomBytes(24).toString('base64url'),
    commercant: { nom: 'Boutique de démonstration', formeJuridique: 'Personne physique', adresse: '12 rue Larbi Ben M\'hidi, Oran', rc: '31/00-0000000A00', nif: '000000000000000' },
  });
  if (!acc.ok) throw new Error(acc.raison);
  await bd('plateforme').updateTable('commercants').set({ demo: true }).where('id', '=', acc.commercantId).execute();
  const ctx = { commercantId: acc.commercantId, utilisateurId: acc.utilisateurId };
  await remplirMagasin(ctx, { sousDomaine: SOUS_DOMAINE_DEMO });
  await bd('plateforme').transaction().execute((trx) => journaliser(trx, { commercantId: null, acteurType: 'administrateur', acteurId: adminId, action: 'demo.creee', objetType: 'commercant', objetId: acc.commercantId }));
  return ctx;
}

/** Remet la démo à zéro : l'ancienne est archivée (sa boutique libère son adresse), une neuve est créée. */
export async function remettreDemo(adminId: string): Promise<{ commercantId: string; utilisateurId: string }> {
  const ancienne = await demoActive();
  if (ancienne) {
    await bd('plateforme').updateTable('commercants').set({ etat: 'archive', sous_domaine: null }).where('id', '=', ancienne.commercantId).where('demo', '=', true).execute();
    await bd('auth').deleteFrom('sessions').where('commercant_id', '=', ancienne.commercantId).execute();
  }
  return assurerDemo(adminId);
}
