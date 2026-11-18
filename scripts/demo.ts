// Magasin de démonstration, pour essayer l'application sans rien saisir :
//   npm run demo
// Crée (une seule fois) un administrateur de service, un commerçant, un vendeur et quelques produits.
// À ne jamais lancer sur le site réel : les mots de passe ci-dessous sont publics.
// Sur le serveur, utiliser plutôt la boutique de démonstration de l'administration (aucun mot de passe connu).
import { bd, fermerBD } from '../src/lib/bd.ts';
import { accepterInvitation, inviterCommercant, inviterEmploye } from '../src/lib/invitations.ts';
import { hacher } from '../src/lib/mots-de-passe.ts';
import { remplirMagasin } from '../src/lib/demo.ts';
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
  // Même contenu que la boutique de démonstration de l'administrateur (src/lib/demo.ts).
  await remplirMagasin(ctx, { sousDomaine: 'magasin-demo', whatsapp: PROPRIETAIRE.telephone });
  console.log('Magasin de démonstration créé.');
}
console.log(`Propriétaire : ${PROPRIETAIRE.telephone} / ${PROPRIETAIRE.motDePasse}`);
console.log(`Vendeuse     : ${VENDEUR.telephone} / ${VENDEUR.motDePasse}`);
console.log('Boutique     : /b/magasin-demo');
await fermerBD();
