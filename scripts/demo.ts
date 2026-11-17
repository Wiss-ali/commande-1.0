// Magasin de démonstration, pour essayer l'application sans rien saisir :
//   npm run demo
// Crée (une seule fois) un administrateur de service, un commerçant, un vendeur et quelques produits.
// À ne jamais lancer sur le site réel : les mots de passe ci-dessous sont publics.
import { avecCommercant, bd, fermerBD } from '../src/lib/bd.ts';
import { accepterInvitation, inviterCommercant, inviterEmploye } from '../src/lib/invitations.ts';
import { hacher } from '../src/lib/mots-de-passe.ts';
import { ajouterTransporteur, confirmerCommande, creerCommande, enregistrerFrais, listerWilayas } from '../src/lib/commandes.ts';
import { creerProduit, lireProduit } from '../src/lib/stock.ts';
import pg from 'pg';

const PROPRIETAIRE = { telephone: '0550000001', motDePasse: 'hanout demo' };
const VENDEUR = { telephone: '0550000002', motDePasse: 'hanout vente' };

const deja = await bd('auth').selectFrom('utilisateurs').select('id').where('telephone', '=', PROPRIETAIRE.telephone).executeTakeFirst();
if (deja) {
  console.log('Le magasin de démonstration existe déjà.');
} else {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL_PROPRIETAIRE });
  await c.connect();
  const admin = await c.query<{ id: string }>(
    `INSERT INTO administrateurs (identifiant, mot_de_passe) VALUES ('demo@hanout.local', $1)
     ON CONFLICT (identifiant) DO UPDATE SET identifiant = EXCLUDED.identifiant RETURNING id`,
    [await hacher(crypto.randomUUID())],
  );
  await c.end();
  const inv = await inviterCommercant({ adminId: admin.rows[0]!.id, nomCommercant: 'Magasin Démo', nom: 'Ali', telephone: PROPRIETAIRE.telephone });
  if (!inv.ok) throw new Error('invitation refusée');
  const acc = await accepterInvitation(inv.jeton, {
    motDePasse: PROPRIETAIRE.motDePasse,
    commercant: { nom: 'Magasin Démo', formeJuridique: 'Personne physique', adresse: '12 rue Larbi Ben M\'hidi, Oran', rc: '31/00-0000000A00', nif: '000000000000000' },
  });
  if (!acc.ok) throw new Error(acc.raison);
  const ctx = { commercantId: acc.commercantId, utilisateurId: acc.utilisateurId };
  const employe = await inviterEmploye({ commercantId: ctx.commercantId, parUtilisateur: ctx.utilisateurId, nom: 'Lina', telephone: VENDEUR.telephone, role: 'vendeur' });
  if (employe.ok) await accepterInvitation(employe.jeton, { motDePasse: VENDEUR.motDePasse });
  const simple = (nomFr: string, nomAr: string, codeBarres: string | null, prixAchat: number, prixVente: number, stockInitial: number, seuil: number) =>
    ({ nomFr, nomAr, categorieId: null, variantes: [{ libelle: '', codeBarres, prixAchat: prixAchat * 100, prixVente: prixVente * 100, seuil, stockInitial }] });
  await avecCommercant(ctx.commercantId, async (trx) => {
    for (const p of [
      simple('Café moulu 250 g', 'قهوة مطحونة 250 غ', '6130000000015', 180, 250, 24, 6),
      simple('Thé vert 100 g', 'شاي أخضر 100 غ', '6130000000022', 80, 120, 3, 5),
      simple('Sucre 1 kg', 'سكر 1 كغ', null, 95, 110, 40, 10),
      simple('Savon de Marseille', 'صابون', null, 60, 90, 0, 4),
      { nomFr: 'T-shirt uni', nomAr: 'قميص سادة', categorieId: null, variantes: ['S', 'M', 'L'].map((libelle, i) => ({ libelle, codeBarres: null, prixAchat: 50_000, prixVente: 90_000, seuil: 1, stockInitial: [4, 6, 0][i]! })) },
    ]) {
      const r = await creerProduit(trx, ctx, p);
      if (!r.ok) throw new Error(r.raison);
    }
  });
  // Livraison et deux commandes : une à confirmer, une confirmée à expédier.
  await avecCommercant(ctx.commercantId, async (trx) => {
    await ajouterTransporteur(trx, ctx, 'Yalidine');
    const grille = (await listerWilayas(trx)).map((w) => ({ wilaya: w.code, domicile: w.code === 31 ? 40_000 : 70_000, pointRelais: w.code === 31 ? 25_000 : 45_000 }));
    await enregistrerFrais(trx, ctx, grille);
    const tshirt = await trx.selectFrom('produits').select('id').where('nom_fr', '=', 'T-shirt uni').executeTakeFirstOrThrow();
    const m = (await lireProduit(trx, tshirt.id))!.variantes.find((v) => v.libelle === 'M')!.id;
    const cafe = await trx.selectFrom('variantes as v').innerJoin('produits as p', 'p.id', 'v.produit_id').select('v.id').where('p.nom_fr', '=', 'Café moulu 250 g').executeTakeFirstOrThrow();
    const a = await creerCommande(trx, ctx, { client: { nom: 'Amina', telephone: '0661000001' }, wilaya: 16, commune: 'Bab Ezzouar', livraison: 'domicile', lignes: [{ varianteId: m, quantite: 2 }], cle: crypto.randomUUID(), libelleLivraison: 'Livraison' });
    const b = await creerCommande(trx, ctx, { client: { nom: 'Yacine', telephone: '0770000002' }, wilaya: 31, commune: 'Bir El Djir', livraison: 'point_relais', lignes: [{ varianteId: cafe.id, quantite: 3 }], cle: crypto.randomUUID(), libelleLivraison: 'Livraison' });
    if (!a.ok || !b.ok) throw new Error('commande refusée');
    await confirmerCommande(trx, ctx, b.id, 'envoi', crypto.randomUUID());
  });
  console.log('Magasin de démonstration créé.');
}
console.log(`Propriétaire : ${PROPRIETAIRE.telephone} / ${PROPRIETAIRE.motDePasse}`);
console.log(`Vendeuse     : ${VENDEUR.telephone} / ${VENDEUR.motDePasse}`);
await fermerBD();
