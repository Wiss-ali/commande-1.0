# Journal du projet

Entrées les plus récentes en haut. Une entrée par action importante.

## 17/11/2026 — Demande : modules choisis par l'administrateur (reportée à l'étape 7)

- Le propriétaire veut pouvoir donner un compte avec seulement certains modules (ex. caisse et factures). Aujourd'hui, c'est le commerçant qui choisit ses modules.
- Proposition faite (à discuter à l'étape 7, module abonnements) : modules par formule, réglables par commerçant ; fiche produit toujours disponible. Notée dans `ETAT.md`, question 6.

## 17/11/2026 — Vérification et réponses reportées à la fin

- Le propriétaire vérifiera tout à la fin du projet, et répondra aux questions ouvertes à la fin aussi.
- En attendant, choix par défaut prudents et réversibles (liste dans `ETAT.md`) : pas de timbre ni de TVA tant
  qu'ils ne sont pas saisis ; avoir partiel et versements du transporteur pour plus tard ; guide d'installation
  et serveur de test à l'étape 8.
- Chaque étape garde son bilan et sa liste « à essayer », pour la vérification finale.

## 17/11/2026 — Étape 5 (accueil, rapports, export pour le comptable) terminée

- Le propriétaire a confirmé que l'acheteur d'une boutique ne crée jamais de compte (déjà prévu, étape 6), puis a dit « tu peux continuer » : **étape 4 validée**.
- Recherche : `docs/etape-5/01-recherche-accueil-rapports.md`. Bilan : `docs/etape-5/02-bilan.md`.
- Vérifications : 117 tests unitaires et d'intégration, 53 parcours de bout en bout. `npm audit` signale `picomatch` (ReDoS, aucune version corrigée publiée), tiré par `vitest` et `next-intl` → `@parcel/watcher` ; jamais appelé avec une saisie utilisateur. Ne pas lancer `npm audit fix --force` (il rétrograde vitest) ; mettre à jour dès qu'une correction sort.
- Choix techniques à connaître pour la suite :
  - `src/lib/rapports.ts` : tous les calculs, jours à l'heure d'Alger (`AT TIME ZONE 'Africa/Algiers'`), périodes `periode(code)` et `periodeLibre`.
  - **Marge réelle** = Σ `total_ht` des factures et tickets non annulés (pas de lien `corrige_par`) − Σ `quantite × cout_unitaire` de leurs lignes − Σ `commandes.frais_livraison` des colis expédiés dans la période (livrés ou retournés). Les frais facturés servent de coût de livraison (pas de coût réel par transporteur).
  - Taux de confirmation = confirmées ÷ (confirmées + annulées avant confirmation) ; taux de livraison = livrées ÷ (livrées + retournées).
  - Accueil : `chiffresAccueil` ; `nbVentesJour` ne compte que les ventes de la caisse (carte Caisse).
  - Graphiques : `src/components/Graphiques.tsx`, SVG dessiné par le serveur. **Pas d'attribut `style`** (la CSP l'interdit) : les largeurs passent par des attributs SVG.
  - Export : `src/lib/export.ts` + route `/rapports/export/archive` (GET, droit `rapports`, journalisé `export.archive`). CSV : BOM UTF-8, `;`, virgule décimale, formules neutralisées par une apostrophe. PDF produits 4 par 4 (≈ 0,1 s chacun) ; 500 documents au plus.
  - Les en-têtes et noms de fichiers de l'archive viennent de `messages/*.json`, espaces `export` et `pdf`. Le test des traductions exige de l'arabe dans chaque texte arabe : les noms de fichiers arabes sont en arabe.
  - Sur l'accueil, le choix 7 j / 30 j est un `div role="group"`, pas un `nav` (le test de la barre du bas cherche la seule navigation de la page).
  - Tests de bout en bout : après le clic sur « داكن », attendre `aria-pressed="true"` avant de changer de page, sinon la capture reste en clair.

## 17/11/2026 — Étape 4 (commandes à livrer, colis, clients) terminée

- Le propriétaire a demandé de reprendre la branche `claude/adoring-ptolemy-sn6zzz` et de continuer : pris comme la **validation de l'étape 3**. Travail poursuivi sur la branche `claude/vigilant-gates-3k9mjn` (partie de l'étape 3, même historique).
- Recherche : `docs/etape-4/01-recherche-commandes.md`. Bilan : `docs/etape-4/02-bilan.md`. Les sites web n'étaient pas joignables depuis le conteneur : sources lues via les résumés du moteur de recherche.
- Vérifications : 109 tests unitaires et d'intégration, 47 parcours de bout en bout, `npm audit` sans faille.
- Choix techniques à connaître pour la suite :
  - Migration `0006_commandes` : `wilayas` (69, numéros 59 à 69 selon le décret 26-206), `communes` (vide), `transporteurs`, `frais_livraison`, `commandes`, `historique_commande`. Les données de `wilayas` sont insérées avant d'activer la RLS (la RLS forcée bloque aussi le propriétaire des tables).
  - **Une commande = un devis + une ligne `commandes`.** Les articles sont les lignes du devis ; les frais de livraison sont une ligne libre du devis. Le colis (transporteur, suivi, dates) est dans `commandes`. Numéro de commande : compteur `commande` dans `compteurs_documents`.
  - Le devis d'une commande **réserve** le stock (`creerDocument` avec `stock: 'reserver'`). `transformer` rend les réservations de toute la chaîne d'origine avant de réserver ou de sortir pour le nouveau document (`chaineOrigines`, `reservationsNettes`, `libererReservations`).
  - `stockLibreSuffit` vérifie le stock **avant toute écriture** : un refus n'écrit rien et ne consomme aucun numéro (défaut corrigé de l'étape 3 pour « Envoi »).
  - `modifierDevis` réajuste la réservation d'un devis qui en a une ; `changerEtatDevis(trx, ctx, …)` libère la réservation au refus et refuse le devis d'une commande.
  - Expédition : `liberation` puis `vente` rattachées à la facture. `creerAvoir` libère ce qui reste réservé (net) et remet en stock ce qui est sorti.
  - Livraison : `paye_le` + `mode_paiement = 'a_la_livraison'` sur la facture, sans reçu ni caisse.
  - Le devis et la facture d'une commande ne se transforment, ne s'annulent et ne s'encaissent que depuis la commande (`transformer(..., { depuisCommande })`, contrôles dans `actions/ventes.ts`, boutons masqués sur la fiche du document).
  - Droits : créer, confirmer, appel, livrer, retour, annuler = `vendre` ; préparer et expédier = `preparer`.
  - Interface des connecteurs transporteurs : `src/lib/transporteurs.ts` (vide).
  - Tests de bout en bout : `tests/e2e/suivi-commandes.spec.ts` doit passer **après** `parcours.spec.ts`, qui attend une base sans commerçant (les fichiers passent par ordre alphabétique).

## 17/11/2026 — Magasin de démonstration ; changement de conversation

- Ajouté `scripts/demo.ts` (`npm run demo`) : un magasin rempli pour essayer sans rien saisir.
- L'aperçu lancé dans la session ne s'est pas affiché chez le propriétaire, qui n'a pas Docker. Il continue dans une nouvelle conversation. La question « comment essayer » est notée dans `ETAT.md`.

## 17/11/2026 — Étape 3 (caisse, factures, documents) terminée

- Recherche : `docs/etape-3/01-recherche-caisse-factures.md`. Bilan : `docs/etape-3/02-bilan.md`.
- Vérifications (`npm run verifier`) : 97 tests unitaires et d'intégration, 36 parcours de bout en bout, `npm audit` sans faille.
- Choix techniques à connaître pour la suite :
  - Migration `0005_documents` : `clients`, `sessions_caisse`, `compteurs_documents`, `documents`, `lignes_document`, `liens_documents`, `ecarts_stock` ; colonnes `commercants.reglages_documents` et `produits.taux_tva`.
  - **Tout document passe par `creerDocument` (`src/lib/documents.ts`)** : numéro, lignes, stock et liens dans la même transaction. `vendreEnCaisse`, `transformer`, `creerAvoir`, `encaisserFacture` s'appuient dessus.
  - **Prix de vente = prix TTC.** `calculerLigne` (`src/lib/fiscal.ts`) en déduit le hors taxe. Montants négatifs pour un avoir.
  - Aucune règle fiscale dans le code : TVA dans `commercants.reglages_documents` (schéma Zod `schemaReglagesDocuments`), barème du timbre dans `reglages_plateforme` (clé `timbre`, vide au départ), lu par `reglageBrut`.
  - Numérotation : `prochainNumero` fait un `INSERT … ON CONFLICT DO UPDATE` sur le compteur, dans la transaction du document. Année prise à l'heure d'Alger.
  - Documents figés : déclencheurs `document_fige` et `ligne_document_figee`. Les lignes ne s'ajoutent que dans la transaction qui crée le document (colonne `transaction_creation`).
  - Stock : une vente sort `min(quantité, stock libre)` et écrit le manque dans `ecarts_stock` (décision du 17/11). Un « Envoi » fait une `reservation` et refuse s'il n'y a pas assez de stock libre. `stock_sorti` évite de sortir deux fois le stock dans une chaîne (bon de livraison puis facture).
  - **Pour l'étape 4** : une facture `mode_vente = 'envoi'` porte les réservations (mouvements liés par `document_id`). L'expédition devra faire `liberation` puis `vente` ; la livraison, l'encaissement (`encaisserFacture`) ; le retour, un avoir ou un mouvement `retour`.
  - Caisse : toute somme encaissée en espèces porte `session_caisse_id` (caisse ouverte d'elle-même à la première vente). `resumeCaisse` additionne les documents de la journée.
  - PDF : `src/lib/pdf.ts` écrit une page HTML (textes de `messages/*.json`, espace `pdf`) et lance le « headless shell » de Chromium en ligne de commande. Le Chromium complet de l'environnement se bloque avec `--print-to-pdf` ; le headless shell fonctionne. Variable `CHEMIN_CHROMIUM` pour forcer un chemin.
  - Dans un PDF arabe : les montants gardent le sens de la langue (classe `m`), les textes libres sont isolés par `<bdi>`.
  - Caisse hors connexion : file dans `localStorage` (`hanout.ventes.<commerçant>`), chaque vente a sa clé d'idempotence ; elle n'est retirée de la file qu'après une réponse du serveur.
  - Piège Tailwind rencontré : ajouter `w-auto` après une classe qui contient `w-full` ne la remplace pas. Écrire les classes complètes.
  - Droits : vendre, facturer, clôturer = `vendre` ; annuler par un avoir = `stock.corriger` (propriétaire) ; réglages de facturation = `reglages`.
- Reste à faire signalé dans le bilan : avoir partiel, expiration automatique des devis, écran Clients, suivi des colis (étape 4).

## 17/11/2026 — Étape 2 validée ; droit « gérer les produits » choisi par le commerçant

- Le propriétaire a répondu « oui » pour l'étape 3 : **étape 2 validée**.
- Sa demande : laisser le commerçant décider, quand il invite un vendeur, s'il lui donne le droit sur les produits. Fait :
  - migration `0004_droit_produits` : colonne `gere_produits` sur `utilisateurs` et `invitations` ;
  - case à cocher dans l'invitation d'un employé, bouton « Autoriser / Retirer » dans Réglages › Équipe (journalisé) ;
  - droit `produits.gerer` = ajouter **et** modifier une fiche (nom, prix de vente, code, variantes, photo). Le propriétaire l'a toujours ; un vendeur seulement si accordé ; jamais un préparateur ;
  - le vendeur ne voit ni ne saisit jamais le prix d'achat : à la modification, les prix d'achat existants sont gardés tels quels ;
  - archiver, importer, sortir du stock et valider un inventaire restent au propriétaire (`stock.corriger`).
- Dans le code : `autorise(s.utilisateur, droit)` (`src/lib/droits.ts`) tient compte de ce droit personnel ; `peut(role, droit)` ne regarde que le rôle. `exigerUtilisateur` utilise `autorise`.
- Ceci remplace le choix noté dans l'entrée suivante (« le vendeur peut ajouter un produit »).
- Vérifications : 75 tests, 22 parcours de bout en bout.

## 17/11/2026 — Réponses du propriétaire après l'étape 2

- **Mot de passe du commerçant : 8 caractères au minimum** (au lieu de 15). Migration `0003_mot_de_passe_proprietaire` ; la liste des mots de passe trop courants et le blocage après 5 échecs restent. L'administrateur garde 15 caractères et la double authentification.
- **Qui crée les produits** : le propriétaire a laissé le choix (« vois ce qui est le mieux fait en Algérie »). Les logiciels de caisse algériens distinguent caissier, gérant et administrateur, et la création d'un article depuis la caisse est une fonction attendue ([Zoom Algérie](https://zoomalgerie.com/logiciel-caisse-pos-algerie/)). Choix appliqué : **le vendeur peut ajouter un produit, sans voir ni saisir le prix d'achat** (droit `produits.creer`). **Modifier une fiche ou un prix, archiver, importer, sortir du stock et valider un inventaire restent réservés au propriétaire** (droit `stock.corriger`), pour qu'un employé ne puisse pas baisser un prix. Le préparateur ne crée pas de produit.
- **Vente d'un produit que l'application croit épuisé (étape 3)** : le propriétaire est d'accord pour **laisser passer la vente et la signaler**, afin de ne jamais bloquer un client au comptoir. À prévoir à l'étape 3 : aujourd'hui la base interdit un stock négatif (contrainte `stock_insuffisant`) ; il faudra enregistrer la vente, sortir ce qui reste en stock, et garder l'écart comme alerte « stock à vérifier » pour le propriétaire.
- Rôles confirmés au propriétaire : l'administrateur crée et gère les commerçants et leurs abonnements, il n'entre pas leur stock ; chaque commerçant gère son magasin et invite ses employés.
- Vérifications : 75 tests, 22 parcours de bout en bout.

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
