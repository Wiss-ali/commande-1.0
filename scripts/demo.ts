// Magasin de démonstration, pour essayer l'application sans rien saisir :
//   npm run demo
// Crée (une seule fois) un administrateur de service, un commerçant, un vendeur et quelques produits.
// À ne jamais lancer sur le site réel : les mots de passe ci-dessous sont publics.
import { avecCommercant, bd, fermerBD } from '../src/lib/bd.ts';
import { accepterInvitation, inviterCommercant, inviterEmploye } from '../src/lib/invitations.ts';
import { hacher } from '../src/lib/mots-de-passe.ts';
import { creerProduit } from '../src/lib/stock.ts';
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
  console.log('Magasin de démonstration créé.');
}
console.log(`Propriétaire : ${PROPRIETAIRE.telephone} / ${PROPRIETAIRE.motDePasse}`);
console.log(`Vendeuse     : ${VENDEUR.telephone} / ${VENDEUR.motDePasse}`);
await fermerBD();
