// Preuve que les commerçants sont isolés les uns des autres par la base elle-même (Row Level Security).
import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enregistrerFormule, enregistrerPaiement, jourAlger } from '../../src/lib/abonnements.ts';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import { inviterEmploye } from '../../src/lib/invitations.ts';
import { journaliser } from '../../src/lib/journal.ts';
import { demander, enregistrerAbonnement, enregistrerReglages, marquerVues, ouvrirNotification, REGLAGES_DEFAUT } from '../../src/lib/boutique.ts';
import { ajouterTransporteur, creerCommande, enregistrerFrais } from '../../src/lib/commandes.ts';
import { creerDepense } from '../../src/lib/depenses.ts';
import { creerAvoir, vendreEnCaisse } from '../../src/lib/documents.ts';
import { creerArrivage, enregistrerFournisseur } from '../../src/lib/fournisseurs.ts';
import { creerSession } from '../../src/lib/sessions.ts';
import { compter, creerProduit, ouvrirInventaire, trouverOuCreerCategorie } from '../../src/lib/stock.ts';
import { creerAdmin, creerCommercant, sqlProprietaire, telephone } from '../outils.ts';

type C = Awaited<ReturnType<typeof creerCommercant>>;
let A: C, B: C;
let tablesCommercant: string[];

beforeAll(async () => {
  const admin = await creerAdmin();
  A = await creerCommercant(admin.id, 'Magasin A');
  B = await creerCommercant(admin.id, 'Magasin B');
  for (const c of [A, B]) {
    await inviterEmploye({ commercantId: c.commercantId, parUtilisateur: c.proprietaireId, nom: 'Employé', telephone: telephone(), role: 'vendeur' });
    await creerSession({ utilisateurId: c.proprietaireId, commercantId: c.commercantId }, { complete: true, appareil: 'test' });
    await avecCommercant(c.commercantId, (trx) => journaliser(trx, { commercantId: c.commercantId, acteurType: 'utilisateur', acteurId: c.proprietaireId, action: 'test' }));
    // Une ligne dans chaque table du stock : catégorie, produit, variante, stock, mouvement, photo, inventaire.
    await avecCommercant(c.commercantId, async (trx) => {
      const ctx = { commercantId: c.commercantId, utilisateurId: c.proprietaireId };
      const categorieId = await trouverOuCreerCategorie(trx, ctx, 'Divers');
      const p = await creerProduit(trx, ctx, { nomFr: 'Produit', nomAr: '', categorieId, variantes: [{ libelle: '', codeBarres: 'ISOLE', prixAchat: 100, prixVente: 200, seuil: 0, stockInitial: 3 }] });
      if (!p.ok) throw new Error(p.raison);
      await trx.insertInto('photos_produit').values({ commercant_id: c.commercantId, produit_id: p.id }).execute();
      const variante = await trx.selectFrom('variantes').select('id').where('produit_id', '=', p.id).executeTakeFirstOrThrow();
      await compter(trx, ctx, await ouvrirInventaire(trx, ctx), variante.id, { ajouter: 1 });
      // Une ligne dans chaque table des documents : client, caisse, compteur, facture, lignes, avoir (lien), écart de stock.
      const f = await vendreEnCaisse(trx, ctx, { lignes: [{ varianteId: variante.id, quantite: 5 }], facture: true, acheteur: { nom: 'Client', telephone: telephone() }, cle: crypto.randomUUID() });
      if (!f.ok) throw new Error(f.raison);
      await creerAvoir(trx, ctx, f.id, { remettreEnStock: true, cle: crypto.randomUUID() });
      // Commandes : transporteur, frais, commande et son historique.
      await ajouterTransporteur(trx, ctx, 'Transporteur');
      await enregistrerFrais(trx, ctx, [{ wilaya: 16, domicile: 50_000, pointRelais: 30_000 }]);
      const cmd = await creerCommande(trx, ctx, {
        client: { nom: 'Client', telephone: telephone() }, wilaya: 16, commune: 'Bab Ezzouar', livraison: 'domicile',
        lignes: [{ varianteId: variante.id, quantite: 1 }], cle: crypto.randomUUID(), libelleLivraison: 'Livraison',
      });
      if (!cmd.ok) throw new Error(cmd.raison);
      // Boutique : réglages, demande, notification, consultation, abonnement du téléphone.
      await enregistrerReglages(trx, ctx, REGLAGES_DEFAUT);
      await demander(trx, ctx, 'site_personnalise', { nom: 'X', telephone: '0550000000' });
      const notif = await trx.insertInto('notifications').values({ commercant_id: c.commercantId, type: 'commande_boutique', commande_id: cmd.id }).returning('id').executeTakeFirstOrThrow();
      await marquerVues(trx, ctx);
      await ouvrirNotification(trx, ctx, notif.id);
      await enregistrerAbonnement(trx, ctx, { endpoint: `https://fcm.googleapis.com/fcm/send/${c.commercantId}`, keys: { p256dh: 'x', auth: 'y' } });
      // Argent : fournisseur, arrivage (lignes, paiement), dépense, versement du transporteur.
      const fo = await enregistrerFournisseur(trx, ctx, { nom: 'Fournisseur' });
      if (!fo.ok) throw new Error(fo.raison);
      const ar = await creerArrivage(trx, ctx, { fournisseurId: fo.id, lignes: [{ varianteId: variante.id, quantite: 2, coutUnitaire: 100 }], paye: { montant: 100, mode: 'especes' }, cle: crypto.randomUUID() });
      if (!ar.ok) throw new Error(ar.raison);
      await creerDepense(trx, ctx, { categorie: 'loyer', montant: 1_000, mode: 'virement', parCaisse: false, cle: crypto.randomUUID() });
      await trx.insertInto('versements_transporteur').values({ commercant_id: c.commercantId, attendu: 0, recu: 0, mode: 'virement', cree_par: c.proprietaireId }).execute();
    });
  }
  // Abonnements : une formule, puis un paiement (et sa période) pour chacun, saisis par l'administrateur.
  const formule = await enregistrerFormule(bd('plateforme'), { nom: `Isolation ${Date.now()}`, prix: 100_00, dureeJours: 30, modules: [], active: true });
  if (!formule.ok) throw new Error(formule.raison);
  for (const c of [A, B]) {
    const p = await bd('plateforme').transaction().execute((trx) => enregistrerPaiement(trx, admin.id, { commercantId: c.commercantId, formuleId: formule.id, moyen: 'especes', recuLe: jourAlger() }));
    if (!p.ok) throw new Error(p.raison);
  }
  const r = await sqlProprietaire<{ table_name: string }>(
    `SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t USING (table_schema, table_name)
     WHERE c.table_schema = 'public' AND c.column_name = 'commercant_id' AND t.table_type = 'BASE TABLE' ORDER BY 1`,
  );
  tablesCommercant = r.rows.map((l) => l.table_name);
});
afterAll(fermerBD);

describe('configuration de la base', () => {
  it('chaque table d\'un commerçant a la RLS activée, forcée, et une règle pour le rôle de l\'application', async () => {
    expect(tablesCommercant).toEqual(expect.arrayContaining(['utilisateurs', 'sessions', 'invitations', 'journal_actions', 'categories', 'produits', 'variantes', 'stocks', 'mouvements_stock', 'photos_produit', 'inventaires', 'lignes_inventaire', 'clients', 'sessions_caisse', 'compteurs_documents', 'documents', 'lignes_document', 'liens_documents', 'ecarts_stock', 'transporteurs', 'frais_livraison', 'commandes', 'historique_commande', 'boutiques', 'demandes', 'notifications', 'notifications_vues', 'notifications_lues', 'abonnements_push', 'paiements_abonnement', 'abonnements', 'paiements']));
    for (const table of [...tablesCommercant, 'commercants']) {
      const t = await sqlProprietaire<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass', [table]);
      expect(t.rows[0], table).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      const p = await sqlProprietaire<{ qual: string | null; with_check: string | null }>(
        `SELECT qual, with_check FROM pg_policies WHERE tablename = $1 AND 'hanout_app' = ANY(roles)`, [table]);
      expect(p.rows.length, `règle manquante sur ${table}`).toBeGreaterThan(0);
      for (const regle of p.rows) expect(`${regle.qual} ${regle.with_check}`, table).toContain('app_commercant()');
    }
  });

  it('aucune table n\'est ouverte sans RLS au rôle de l\'application, sauf les réglages communs', async () => {
    const r = await sqlProprietaire<{ table_name: string }>(
      `SELECT DISTINCT g.table_name FROM information_schema.role_table_grants g
       JOIN pg_class c ON c.relname = g.table_name AND c.relnamespace = 'public'::regnamespace
       WHERE g.grantee = 'hanout_app' AND g.table_schema = 'public' AND NOT c.relrowsecurity AND c.relkind = 'r'`);
    expect(r.rows.map((l) => l.table_name)).toEqual(['reglages_plateforme']);
  });

  it('chaque vue lisible par l\'application s\'exécute avec les droits de l\'utilisateur (l\'isolation s\'applique)', async () => {
    const r = await sqlProprietaire<{ relname: string; reloptions: string[] | null }>(
      `SELECT DISTINCT c.relname, c.reloptions FROM information_schema.role_table_grants g
       JOIN pg_class c ON c.relname = g.table_name AND c.relnamespace = 'public'::regnamespace
       WHERE g.grantee = 'hanout_app' AND c.relkind = 'v'`);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const v of r.rows) expect(v.reloptions ?? [], v.relname).toContain('security_invoker=true');
  });

  it('les wilayas sont lisibles par tous les commerçants, mais pas modifiables', async () => {
    const w = await avecCommercant(A.commercantId, (trx) => trx.selectFrom('wilayas').select('code').execute());
    expect(w).toHaveLength(69);
    await expect(avecCommercant(A.commercantId, (trx) => sql`UPDATE wilayas SET nom_fr = 'X'`.execute(trx))).rejects.toThrow(/permission denied/);
  });

  it('les rôles de l\'application ne sont ni propriétaires des tables, ni super-utilisateurs, ni dispensés de RLS', async () => {
    const roles = await sqlProprietaire<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('hanout_app', 'hanout_auth', 'hanout_plateforme')`);
    expect(roles.rows).toHaveLength(3);
    for (const r of roles.rows) expect(r, r.rolname).toMatchObject({ rolsuper: false, rolbypassrls: false });
    const possedees = await sqlProprietaire(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner IN ('hanout_app', 'hanout_auth', 'hanout_plateforme')`);
    expect(possedees.rows).toEqual([]);
  });
});

describe('un commerçant ne voit que ses données', () => {
  it('sans commerçant fixé, la connexion de l\'application ne voit rien', async () => {
    for (const table of [...tablesCommercant, 'commercants']) {
      const r = await sql<{ n: string }>`SELECT count(*) AS n FROM ${sql.table(table)}`.execute(bd('app'));
      expect(r.rows[0]?.n, table).toBe('0');
    }
  });

  it('A lit ses lignes dans chaque table, et aucune de B', async () => {
    for (const table of tablesCommercant) {
      await avecCommercant(A.commercantId, async (trx) => {
        const r = await sql<{ commercant_id: string }>`SELECT DISTINCT commercant_id FROM ${sql.table(table)}`.execute(trx);
        expect(r.rows.map((l) => l.commercant_id), table).toEqual([A.commercantId]);
        const viaFiltre = await sql<{ n: string }>`SELECT count(*) AS n FROM ${sql.table(table)} WHERE commercant_id = ${B.commercantId}`.execute(trx);
        expect(viaFiltre.rows[0]?.n, table).toBe('0');
      });
    }
    await avecCommercant(A.commercantId, async (trx) => {
      const c = await trx.selectFrom('commercants').select(['id', 'nom']).execute();
      expect(c).toEqual([{ id: A.commercantId, nom: 'Magasin A' }]);
    });
  });

  it('le commerçant fixé ne reste pas sur la connexion après la transaction', async () => {
    await avecCommercant(A.commercantId, (trx) => trx.selectFrom('utilisateurs').select('id').execute());
    for (let i = 0; i < 12; i++) {
      const r = await bd('app').selectFrom('utilisateurs').select('id').execute();
      expect(r).toEqual([]);
    }
  });
});

describe('un commerçant ne peut ni modifier ni supprimer les données d\'un autre', () => {
  it('A ne peut pas modifier un utilisateur ni le commerçant B', async () => {
    await avecCommercant(A.commercantId, async (trx) => {
      const u = await trx.updateTable('utilisateurs').set({ nom: 'Piraté' }).where('id', '=', B.proprietaireId).executeTakeFirst();
      expect(u.numUpdatedRows).toBe(0n);
      const tous = await trx.updateTable('utilisateurs').set({ desactive: true }).where('commercant_id', '=', B.commercantId).executeTakeFirst();
      expect(tous.numUpdatedRows).toBe(0n);
      const c = await trx.updateTable('commercants').set({ nom: 'Piraté' }).where('id', '=', B.commercantId).executeTakeFirst();
      expect(c.numUpdatedRows).toBe(0n);
    });
    const verif = await sqlProprietaire('SELECT 1'); // la connexion propriétaire reste utilisable
    expect(verif.rowCount).toBe(1);
    await avecCommercant(B.commercantId, async (trx) => {
      const u = await trx.selectFrom('utilisateurs').select(['nom', 'desactive']).where('id', '=', B.proprietaireId).executeTakeFirstOrThrow();
      expect(u.nom).toBe('Propriétaire Magasin B');
      expect(u.desactive).toBe(false);
    });
  });

  it('A ne peut pas supprimer les sessions de B', async () => {
    await avecCommercant(A.commercantId, async (trx) => {
      const r = await trx.deleteFrom('sessions').where('commercant_id', '=', B.commercantId).executeTakeFirst();
      expect(r.numDeletedRows).toBe(0n);
    });
    await avecCommercant(B.commercantId, async (trx) => {
      expect((await trx.selectFrom('sessions').select('id').execute()).length).toBeGreaterThan(0);
    });
  });

  it('A ne peut pas écrire une ligne au nom de B', async () => {
    await expect(avecCommercant(A.commercantId, (trx) =>
      journaliser(trx, { commercantId: B.commercantId, acteurType: 'utilisateur', action: 'faux' }))).rejects.toThrow(/row-level security/);
    await expect(avecCommercant(A.commercantId, (trx) =>
      trx.insertInto('invitations').values({ jeton_hash: 'x'.repeat(64), type: 'employe', commercant_id: B.commercantId, nom: 'X', telephone: telephone(), role: 'vendeur', expire_le: new Date(Date.now() + 1000) }).execute(),
    )).rejects.toThrow(/row-level security/);
  });

  it('A ne peut pas déplacer une de ses lignes chez B', async () => {
    await expect(avecCommercant(A.commercantId, (trx) =>
      sql`UPDATE invitations SET annulee_le = now(), commercant_id = ${B.commercantId}`.execute(trx))).rejects.toThrow(/permission denied|row-level security/);
  });
});

describe('ce que le rôle de l\'application ne peut jamais faire', () => {
  it('lire un mot de passe ou un secret de double authentification', async () => {
    await expect(avecCommercant(A.commercantId, (trx) => sql`SELECT mot_de_passe FROM utilisateurs`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`SELECT totp_secret_chiffre FROM utilisateurs`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`SELECT jeton_hash FROM sessions`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`SELECT jeton_hash FROM invitations`.execute(trx))).rejects.toThrow(/permission denied/);
  });

  it('activer le paiement par carte, changer son état ou sa limite d\'employés', async () => {
    for (const requete of [
      sql`UPDATE commercants SET paiement_carte_actif = true`,
      sql`UPDATE commercants SET etat = 'actif'`,
      sql`UPDATE commercants SET max_employes = 999`,
    ]) {
      await expect(avecCommercant(A.commercantId, (trx) => requete.execute(trx))).rejects.toThrow(/permission denied/);
    }
  });

  it('créer un compte directement, créer un commerçant, ou une invitation de commerçant', async () => {
    await expect(avecCommercant(A.commercantId, (trx) =>
      sql`INSERT INTO utilisateurs (commercant_id, nom, telephone, mot_de_passe, role) VALUES (${A.commercantId}, 'X', '0599999999', 'x', 'proprietaire')`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`INSERT INTO commercants (nom) VALUES ('Faux')`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) =>
      trx.insertInto('invitations').values({ jeton_hash: 'y'.repeat(64), type: 'commercant', commercant_id: A.commercantId, nom: 'X', telephone: telephone(), role: 'proprietaire', expire_le: new Date(Date.now() + 1000) }).execute(),
    )).rejects.toThrow(/row-level security/);
  });

  it('lire les administrateurs, ou modifier et effacer le journal', async () => {
    await expect(avecCommercant(A.commercantId, (trx) => sql`SELECT * FROM administrateurs`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`UPDATE journal_actions SET action = 'x'`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(avecCommercant(A.commercantId, (trx) => sql`DELETE FROM journal_actions`.execute(trx))).rejects.toThrow(/permission denied/);
    await expect(sql`DELETE FROM journal_actions`.execute(bd('plateforme'))).rejects.toThrow(/permission denied/);
    await expect(sql`DELETE FROM journal_actions`.execute(bd('auth'))).rejects.toThrow(/permission denied/);
  });

  it('contourner la RLS en changeant de rôle ou en la désactivant', async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL_APP });
    await c.connect();
    try {
      await expect(c.query('SET ROLE hanout_proprietaire')).rejects.toThrow(/permission denied/);
      await expect(c.query('ALTER TABLE utilisateurs DISABLE ROW LEVEL SECURITY')).rejects.toThrow(/must be owner/);
      await expect(c.query('SET row_security = off; SELECT * FROM utilisateurs')).rejects.toThrow(/row-level security/);
    } finally {
      await c.end();
    }
  });
});

describe('données chiffrées', () => {
  it('les numéros légaux et l\'adresse du commerçant ne sont jamais écrits en clair', async () => {
    await sqlProprietaire('ALTER TABLE commercants NO FORCE ROW LEVEL SECURITY');
    try {
      const r = await sqlProprietaire<{ nif_chiffre: string; adresse_chiffre: string }>('SELECT nif_chiffre, adresse_chiffre FROM commercants WHERE id = $1', [A.commercantId]);
      expect(r.rows[0]!.nif_chiffre).toMatch(/^v1\.2\./);
      expect(r.rows[0]!.nif_chiffre).not.toContain('NIF-Magasin A');
      expect(r.rows[0]!.adresse_chiffre).not.toContain('Adresse');
    } finally {
      await sqlProprietaire('ALTER TABLE commercants FORCE ROW LEVEL SECURITY');
    }
  });
});
