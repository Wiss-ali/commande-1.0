# Étape 0 — Plan

Nom de travail du produit : **Hanout** (حانوت, « la boutique » en arabe algérien). C'est une
proposition, changeable en un réglage.

## 1. Outils retenus

Je garde vos outils (TypeScript, Next.js, React, PostgreSQL, Tailwind, Vitest, Playwright, Docker)
et je propose les compléments suivants.

| Besoin | Choix | Pourquoi |
|---|---|---|
| Application | Next.js 16 (App Router), React 19, Node.js 22 | Un seul programme pour l'interface, le serveur et la boutique publique |
| Accès à la base | Kysely + pilote `pg`, SQL écrit à la main pour les migrations | Requêtes paramétrées et typées ; migrations avec « aller » et « retour », comme vous l'exigez. Les ORM plus automatiques gèrent mal la RLS et le retour arrière |
| Comptes et sessions | Code maison, court et testé : Argon2id (`@node-rs/argon2`), sessions en base, TOTP (`otpauth`) | Aucune dépendance à un service étranger ; chaque règle du cahier des charges est visible et testable |
| Validation | Zod, côté serveur sur chaque entrée | |
| Langues | next-intl, fichiers `fr.json` et `ar.json` | Gère le sens de lecture et les formats |
| Composants | Tailwind 4 + primitives accessibles (Radix UI) | Clavier et lecteurs d'écran corrects sans tout réécrire |
| PDF | Page HTML convertie en PDF par Chromium sans écran, dans un conteneur à part | Seule méthode fiable pour un arabe correct (lettres liées, droite à gauche). Les bibliothèques PDF pures gèrent mal l'arabe. Coût : environ 300 Mo de disque en plus |
| Scan | `BarcodeDetector` natif, sinon `zxing-wasm` ; étiquettes avec `bwip-js` | Conforme à la partie 6 |
| Images | `sharp` : vérification du type réel, redimensionnement, suppression des métadonnées | |
| Tâches de fond | Un petit « worker » qui lit une file dans PostgreSQL | Expiration des devis, rappels, PDF, sauvegardes. Pas de Redis à installer |
| Notifications | Web Push (clés VAPID), sans service tiers | Sur iPhone, ne marche que si l'application est installée sur l'écran d'accueil |
| Graphiques | SVG dessiné à la main | Un graphique par écran ne justifie pas une bibliothèque lourde |
| Serveur web | Caddy devant l'application | Certificats HTTPS automatiques, y compris pour les sous-domaines des boutiques |
| Sauvegardes | `pg_dump` chiffré avec `age`, envoyé vers un second serveur | Clé différente de celle de l'application |

**Deux points à surveiller à l'étape 1 :** TypeScript 7 est récent, je vérifierai qu'il fonctionne
avec Next.js 16 et je prendrai la version 6 sinon. Les certificats pour tous les sous-domaines
demandent un fournisseur DNS compatible ; sinon Caddy crée un certificat par boutique à la demande.

## 2. Architecture

```
                    Internet (HTTPS, TLS 1.3)
                              │
                         ┌────┴────┐
                         │  Caddy  │  certificats, HSTS, limites de débit
                         └────┬────┘
        app.domaine.dz        │        nom-boutique.domaine.dz
   (commerçants + admin)      │        (boutiques publiques)
                         ┌────┴────┐
                         │ Next.js │  même application, routage selon l'adresse
                         └─┬─────┬─┘
              rôle « app » │     │ file de tâches
              (sans droits │  ┌──┴─────┐   ┌──────────┐
              de proprié-  │  │ Worker │───│ Chromium │ PDF
              taire, RLS)  │  └──┬─────┘   └──────────┘
                         ┌─┴─────┴─┐
                         │PostgreSQL│──► sauvegarde chiffrée ──► second serveur
                         └─────────┘
```

- **Trois rôles PostgreSQL** : `proprietaire` (migrations seulement), `app` (commerçants et boutique, soumis à la RLS), `plateforme` (administration, utilisé uniquement par les pages d'administration après double authentification).
- **Isolation** : chaque requête s'exécute dans une transaction qui fixe le commerçant courant. Les règles RLS comparent `commercant_id` à cette valeur. Sans valeur, aucune ligne n'est visible.
- **Boutique publique** : elle ne lit jamais les tables directement. Elle passe par quelques fonctions SQL dédiées, qui ne renvoient que les produits visibles d'une boutique en ligne et créent un ticket.

## 3. Règles de fonctionnement importantes

1. **Une vente = une transaction.** Une seule fonction serveur écrit la vente, les mouvements de stock et la facture. Si une partie échoue, rien n'est écrit.
2. **Numérotation sans trou.** Un compteur par commerçant, par type de document et par année, verrouillé dans la même transaction que le document. Les brouillons n'ont pas de numéro.
3. **Documents figés.** Une facture émise est protégée par un déclencheur en base : ni modification ni suppression, même par un bug de l'application. On la corrige par un avoir.
4. **Stock** : le stock est toujours la somme des mouvements. Un compteur par variante garde `quantite` et `reservee` à jour ; « disponible » = quantité moins réservée. Une contrainte interdit de passer sous zéro.
5. **Argent** : entiers en centimes de dinar. Affichage « 12 500 DA » ou « 12 500 د.ج ».
6. **Idempotence** : chaque création de vente, commande ou ticket porte une clé unique générée par le téléphone. Un double toucher ou un renvoi après coupure ne crée rien en double.
7. **Caisse hors connexion** : les ventes en attente sont gardées dans le téléphone (IndexedDB), puis envoyées avec leur clé d'idempotence. Si le stock a manqué entre-temps, la vente est quand même enregistrée et signalée au commerçant.
8. **Données chiffrées champ par champ** : téléphones et adresses des acheteurs, numéros légaux, secrets de double authentification. Chaque valeur porte le numéro de la clé utilisée, pour changer de clé sans perte. Une empreinte HMAC du téléphone sert à la recherche.
9. **Droits** : vérifiés côté serveur à chaque action, selon le rôle (propriétaire, vendeur, préparateur) et les modules activés.

## 4. Une commande de la boutique : un seul objet, deux vues

Le cahier des charges dit à la fois qu'une commande de la boutique « arrive dans Commandes » et
qu'elle « crée un devis ». Pour ne rien stocker deux fois, je propose :

- Le ticket de l'acheteur crée **un devis** marqué « Boutique en ligne » et réserve le stock.
- Ce devis apparaît dans Factures › Devis **et** dans la liste Commandes, avec le statut « à confirmer ». C'est le même enregistrement vu de deux endroits.
- « Transformer en facture » puis « Envoi » crée la commande à livrer (statut « confirmée ») et son colis. « Vente directe » crée la facture tout de suite.

## 5. Liens entre les modules

```
 Boutique en ligne ──ticket──► DEVIS ◄── saisie manuelle
                                 │ transformer
        Caisse ──────────────────┤
                                 ▼
                    « Envoi » ou « Vente directe »
                       │                  │
                       ▼                  ▼
                  COMMANDE ──► COLIS    FACTURE ──► AVOIR
                       │  livré           ▲   └──► REÇU
                       └──────────────────┘
                       │
   BON DE LIVRAISON ◄──┘
        Tous écrivent des MOUVEMENTS DE STOCK (réservation, sortie, retour)
        Tous pointent vers un CLIENT ──► Rapports et Accueil lisent le tout
```

Chaque flèche est un lien enregistré en base (table `liens_documents`), affiché sur chaque document
sous forme de boutons « Voir le devis », « Voir la facture », « Voir le colis ».

## 6. Identité visuelle

- **Couleurs** : fond papier chaud, encre presque noire, un **vert émeraude profond** pour l'action principale, un **safran** réservé aux alertes, une **terre cuite** pour les erreurs. Le thème sombre reprend les mêmes teintes, éclaircies. Tous les couples texte/fond visent au moins 4,5:1.
- **Typographie** : IBM Plex Sans et IBM Plex Sans Arabic. C'est une même famille dessinée pour les deux écritures, avec des chiffres alignés pour les montants. Les polices sont servies par l'application elle-même, sans appel à un site extérieur.
- **Formes** : cartes à coins peu arrondis, pastilles de statut avec une forme en plus de la couleur (rond plein, anneau, losange), pour rester lisibles sans les couleurs.

Les maquettes sont dans `docs/etape-0/maquettes.html`.

## 7. Déroulé des étapes

| Étape | Contenu | Ce que vous pourrez essayer |
|---|---|---|
| 0 | Plan, schéma, maquettes | Lire et valider |
| 1 | Socle : invitation, connexion, double authentification, isolation RLS et ses tests, français/arabe, navigation, thèmes, réglages légaux | Créer un commerçant, changer de langue |
| 2 | Produits, variantes, mouvements de stock, scan, étiquettes, inventaire | Scanner un vrai produit avec votre téléphone |
| 3 | Caisse (y compris hors connexion), factures et documents PDF, « Envoi » ou « Vente directe » | Faire une vente et recevoir le PDF |
| 4 | Commandes à livrer, colis, frais par wilaya, alertes téléphone, clients | Suivre un colis jusqu'au retour |
| 5 | Accueil, rapports, export pour le comptable | Vérifier les chiffres |
| 6 | Boutique en ligne, quatre modèles, ticket, devis automatique, notifications | Commander comme un acheteur |
| 7 | Administration : commerçants, abonnements, paiements, demandes | Gérer un abonnement de bout en bout |
| 8 | Sécurité (ASVS niveau 2), tests complets, sauvegardes, mise à jour sans coupure, guide d'installation | Installer sur un vrai serveur |

Le socle d'administration nécessaire aux invitations (créer un commerçant, envoyer un lien) est
fait dès l'étape 1 ; l'écran complet arrive à l'étape 7.
