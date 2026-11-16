# Journal du projet

Entrées les plus récentes en haut. Une entrée par action importante.

## 16/11/2026 — Étape 2 (produits, stock, scan) terminée

- Décisions du propriétaire :
  - **Pas de double authentification imposée aux commerçants** : trop compliquée pour eux. Elle reste proposée dans Réglages › Sécurité (c'était déjà le cas : facultative). Elle reste obligatoire pour l'administrateur de la plateforme, comme le demande le cahier des charges.
  - **« Tu peux faire les recherches et lancer sans me demander »** : la recherche avant chaque module est toujours faite et écrite, mais on n'attend plus la validation de la liste avant de coder. L'arrêt en fin d'étape reste.
- Recherche : `docs/etape-2/01-recherche-stock.md`. Bilan : `docs/etape-2/02-bilan.md`.
- Vérifications (`npm run verifier`) : 75 tests unitaires et d'intégration, 22 parcours de bout en bout, `npm audit` sans faille.
- Choix techniques à connaître pour la suite :
  - Migration `0002_stock` : `categories`, `produits`, `variantes`, `stocks`, `mouvements_stock`, `photos_produit`, `inventaires`, `lignes_inventaire`.
  - **Le stock ne change que par `ajouterMouvement` (`src/lib/stock.ts`).** Le rôle `hanout_app` n'a que la lecture sur `stocks` ; un déclencheur `SECURITY DEFINER` applique chaque mouvement. Comme la RLS est forcée, ce déclencheur a sa propre règle (`declencheur`) limitée au commerçant de la transaction.
  - Types de mouvement prêts pour les étapes suivantes : `vente` (−), `retour` (+), `reservation` (+ sur la quantité réservée), `liberation` (−). Expédier un article réservé = `liberation` puis `vente` dans la même transaction.
  - Ne jamais insérer un mouvement avec `ON CONFLICT DO NOTHING` sans raison : l'idempotence passe par la colonne `cle` (index unique) et le contrôle fait dans `ajouterMouvement`.
  - Une erreur de la base annule toute la transaction : les fonctions contrôlent avant d'écrire et renvoient une raison (`Refus`, aussi clé de traduction sous `erreurs`). `refusDepuisErreur` traduit les contraintes quand deux actions se croisent.
  - Montants en arabe : `formaterMontant` isole le nombre (U+2066…U+2069). Dans un test, comparer avec ces caractères.
  - Scan : `src/components/Scanner.tsx` (`onCode`). Le fichier WebAssembly est copié dans `public/wasm` par `scripts/copier-wasm.ts` (avant `dev` et `build`), la CSP autorise `wasm-unsafe-eval`. Réutilisable tel quel pour la caisse et les colis.
  - Photos : réduites dans le navigateur, revérifiées et réécrites en WebP par `sharp`, rangées dans `DOSSIER_FICHIERS` (hors base), servies par `/photos/[id]` après contrôle de la session.
  - Excel : lecteur et écrivain maison dans `src/lib/tableur.ts` (`fflate`), sans la bibliothèque `xlsx` (faille connue). `ecrireXlsx` servira aux exports de l'étape 5.
  - Une page `notFound()` répond 200 avec l'écran « introuvable » (affichage progressif de Next.js) : dans un test, vérifier le contenu, pas le code HTTP.
  - Tests de bout en bout : fausse caméra de Chromium, image créée dans `tests/e2e/preparation.ts`. `tests/e2e/stock.spec.ts` crée ses propres commerçants avec `tests/outils.ts`.
- Environnement : après un redémarrage du conteneur, relancer `pg_ctlcluster 16 main start`. Le mot de passe local de `postgres` a été mis à `postgres` (`su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\""`).
- Branche de travail : `claude/adoring-ptolemy-sn6zzz`. `main` n'a pas été mis à jour pendant cette session (pas d'autorisation de pousser dessus).

## 15/11/2026 — Correction : les tests changeaient les mots de passe de la base de développement

- Les rôles PostgreSQL sont communs à toutes les bases d'un serveur. Les tests recréaient les rôles avec leurs propres mots de passe, ce qui cassait la connexion de la base de développement.
- Corrigé dans `tests/env-test.ts` : les tests reprennent les mots de passe du fichier `.env` et ne changent que le nom de la base (`hanout_test`).

## 15/11/2026 — Étape 1 (socle) terminée

- Le propriétaire a validé la liste de l'étape 1 et choisi le **téléphone** comme identifiant de connexion.
- Code écrit et testé : voir `docs/etape-1/02-bilan.md` (fait, pas fait, à essayer, schéma des liens).
- Résultat des vérifications (`npm run verifier`) : types corrects, 43 tests unitaires et d'intégration, construction, 10 parcours de bout en bout. `npm audit` : aucune faille connue.
- Choix techniques à connaître pour la suite :
  - Quatre rôles PostgreSQL : `hanout_proprietaire` (migrations), `hanout_app` (données d'un commerçant, RLS), `hanout_auth` (comptes, sessions, invitations), `hanout_plateforme` (administration).
  - La connexion « app » ne s'utilise que par `avecCommercant(id, fn)` dans `src/lib/bd.ts`.
  - Le rôle `hanout_app` n'a pas le droit de lire les mots de passe ni les secrets : toujours nommer les colonnes, jamais `selectAll()` sur `utilisateurs`, `sessions`, `invitations`.
  - Chaque nouvelle table d'un commerçant doit avoir `commercant_id`, la RLS forcée et une règle pour `hanout_app` : le test `tests/integration/isolation.test.ts` les parcourt toutes et échoue sinon.
  - Pages : `pageUtilisateur(droit, module)`. Actions serveur : `exigerUtilisateur` ou `exigerEcriture`, enveloppées par `action()` ou `actionSimple()` de `src/lib/actions.ts`.
  - Tout texte passe par `messages/fr.json` et `messages/ar.json` ; un test vérifie que les clés sont identiques et que l'arabe est bien en arabe.
  - Montants : `formaterMontant` (espaces insécables). Chiffres et téléphones : classe CSS `chiffres`.
  - Next.js 16 : `src/proxy.ts` remplace `middleware.ts`. TypeScript 7 fonctionne avec Next.js 16.
  - Après une action serveur avec `revalidatePath`, un composant client peut être remplacé : ne pas y garder un résultat à afficher (cause du défaut des codes de secours).
- Environnement de travail : PostgreSQL 16 local, à relancer avec `pg_ctlcluster 16 main start` après un redémarrage du conteneur. Le fichier `.env` local n'est pas dans le dépôt : le recréer depuis `.env.example`, puis `npm run db:roles` et `npm run db:migrer`.
- Docker : fichiers écrits, non testés (service indisponible ici).

## 15/11/2026 — Étape 0 validée, recherche de l'étape 1

- Le propriétaire a répondu « ok pour tout ». Décisions enregistrées :
  - Nom du produit : Hanout.
  - Boutique sans registre du commerce : avertissement, pas de blocage.
  - Droit de timbre : réglage par tranches.
  - Total en lettres sur les factures ; facture récapitulative et bon de transfert « plus tard ».
  - PDF produits par Chromium côté serveur.
  - Une commande de la boutique = un devis, vu dans Commandes et dans Devis.
  - Maquettes acceptées (couleurs, police, disposition).
  - Ajouts au cahier des charges : import de produits depuis Excel (étape 2), clôture de caisse (étape 3), mot de passe oublié (étape 1). Vente à crédit, fournisseurs, dépenses, plusieurs magasins : version 2.
  - Équipe : le propriétaire crée les comptes de ses employés par lien d'invitation. Droits : le vendeur vend et prépare ; le préparateur prépare, scanne et fait l'inventaire ; seul le propriétaire voit les prix d'achat, la marge, les rapports, corrige le stock et accède aux réglages.
  - Nombre d'employés limité selon la formule d'abonnement, réglable par l'administrateur.
- Écrit `docs/etape-1/01-recherche-socle.md` : recherche et liste des fonctions de l'étape 1. En attente de validation avant de coder.
- PostgreSQL 18 retenu (la 19 est encore en test). Next.js 16 : `proxy.ts` remplace `middleware.ts`.

## 15/11/2026 — Étape 0 livrée

- Écrit `docs/etape-0/maquettes.html` : accueil, commandes, scan, facture, boutique. Bouton de langue et de thème. Vérifié par capture d'écran en français clair et en arabe sombre.
- Leçon pour le code : en arabe, un montant écrit « 48 500 » avec une espace normale s'affiche à l'envers (« 500 48 »). Il faut une espace insécable entre les groupes de chiffres. À intégrer dans la fonction de formatage des montants dès l'étape 1.
- Écrit `02-plan.md` et `03-schema.md`. Choix proposés au-delà du cahier des charges : Kysely pour la base, comptes codés maison, PDF par Chromium, Caddy, worker sur file PostgreSQL, empreinte HMAC du téléphone pour la recherche.
- Écrit `01-recherche.md`. Contradictions signalées au propriétaire : droit de timbre par tranches depuis 2025, total en lettres exigé sur la facture, facture récapitulative et bon de transfert absents du cahier des charges, loi 18-05 (registre du commerce et hébergement en Algérie obligatoires pour vendre en ligne), loi 18-07 (déclaration à l'ANPDP).
- Confirmé : 69 wilayas, conservation 10 ans (article 12 du Code de commerce).
- Sites non joignables depuis la session : `commerce.gov.dz`, `legal-doctrine.com`, `cheatsheetseries.owasp.org`. Les points concernés sont marqués « à vérifier ».

## 15/11/2026 — Démarrage

- Le propriétaire a confirmé : supprimer tout l'ancien projet PHP (17 fichiers, logos compris), y compris sur `main`, et mettre le nouveau projet à la place.
- Ancien projet supprimé par un commit normal : il reste récupérable dans l'historique git (dernier commit de l'ancien projet : `79b8679`).
- Étapes numérotées de 0 à 8 au lieu de 1 à 9, pour correspondre aux renvois du cahier des charges.
- Créé `CLAUDE.md`, `docs/CAHIER-DES-CHARGES.md` et ce journal.
