# Étape 0 — Schéma de la base de données

Proposition à valider. Les noms sont en français pour rester lisibles par vous ; ils seront figés
à l'étape 1.

## Conventions

- Chaque table a un `id` UUID (version 7), `cree_le`, `modifie_le`.
- Chaque table d'un commerçant a `commercant_id`, avec la RLS **activée et forcée**. Les clés étrangères incluent `commercant_id`, pour qu'une ligne ne puisse jamais pointer vers celle d'un autre commerçant.
- Montants : `bigint` en centimes de dinar. Taux : entiers en centièmes de pour cent (1900 = 19 %).
- 🔒 = champ chiffré en AES-256-GCM par l'application. `_hmac` = empreinte pour la recherche exacte.
- Rien n'est supprimé pour de bon dans les tables comptables : on annule ou on archive.

## Plateforme (visible par l'administrateur seulement)

| Table | Contenu principal |
|---|---|
| `commercants` | nom, `sous_domaine` (unique), langue, état (`actif`, `lecture_seule`, `suspendu`, `archive`), `paiement_carte_actif` (faux), modules activés, mentions légales (forme juridique, adresse 🔒, téléphone, RC 🔒, NIF 🔒, NIS 🔒, article d'imposition 🔒) |
| `invitations` | empreinte du jeton, nom et téléphone du commerçant visé, expire le (7 jours), utilisée le, annulée le |
| `formules` | nom, prix, durée en jours, active |
| `abonnements` | commerçant, formule, début, fin, délai de grâce |
| `paiements_abonnement` | abonnement, montant, moyen (CCP, BaridiMob, virement, espèces), reçu le, saisi par |
| `demandes` | commerçant, type (`paiement_carte`, `site_personnalise`), nom, téléphone, état, note de l'administrateur |
| `reglages_plateforme` | durée de conservation (10 ans), tranches du droit de timbre, liste des taux de TVA proposés, durée de réservation par défaut |
| `wilayas` | code, nom français, nom arabe, active |
| `communes` | wilaya, nom français, nom arabe, active |
| `administrateurs` | e-mail, mot de passe haché, secret TOTP 🔒 (obligatoire) |

## Comptes

| Table | Contenu principal |
|---|---|
| `utilisateurs` | commerçant, nom, identifiant de connexion (téléphone ou e-mail), mot de passe Argon2id, rôle (`proprietaire`, `vendeur`, `preparateur`), langue, thème, secret TOTP 🔒, codes de secours hachés, échecs de connexion, bloqué jusqu'à |
| `sessions` | empreinte du jeton, utilisateur, créée, dernière activité, expire, appareil |
| `abonnements_push` | utilisateur, point d'envoi et clés du navigateur 🔒 |
| `journal_actions` | qui, quoi, sur quel objet, quand, depuis quelle adresse (tronquée). En ajout seulement |
| `cles_idempotence` | clé, utilisateur, réponse enregistrée, expire |

## Produits et stock

| Table | Contenu principal |
|---|---|
| `categories` | nom français, nom arabe, ordre |
| `produits` | nom français, nom arabe, description, catégorie, taux de TVA, visible dans la boutique, pastille « Nouveau », archivé |
| `variantes` | produit, libellé (taille, couleur), code-barres (unique par commerçant), prix d'achat, prix de vente, prix barré, seuil d'alerte |
| `photos_produit` | produit, fichier, ordre |
| `stocks` | variante, `quantite`, `reservee` ; contraintes : `reservee >= 0` et `quantite >= reservee` |
| `mouvements_stock` | variante, type (`entree`, `vente`, `retour`, `correction`, `reservation`, `liberation`), quantité signée, auteur, document d'origine, motif. En ajout seulement |
| `inventaires` et `lignes_inventaire` | séance de comptage par scan, quantité comptée, écart, correction créée |

Un produit sans variante a une variante unique cachée : le stock est ainsi toujours porté par la variante.

## Clients

| Table | Contenu principal |
|---|---|
| `clients` | nom, téléphone 🔒, `telephone_hmac`, adresse 🔒, wilaya, commune, mentions légales de l'acheteur professionnel (RC, NIF…) 🔒 |

Total dépensé, nombre de commandes et taux de retour sont calculés à partir des documents, pas recopiés.

## Documents commerciaux

Une seule famille de tables pour tous les documents, ce qui rend les transformations simples.

| Table | Contenu principal |
|---|---|
| `compteurs_documents` | commerçant, type, année, dernier numéro. Verrouillé à chaque émission |
| `documents` | type (`devis`, `proforma`, `bon_commande`, `bon_livraison`, `facture`, `avoir`, `recu`, `ticket_caisse`), numéro, état, origine (`caisse`, `manuel`, `boutique`), client, **copie figée** des mentions du vendeur et de l'acheteur au moment de l'émission, totaux HT, TVA, timbre, TTC, mode et date de paiement, validité, langue du PDF, émis le, émis par |
| `lignes_document` | document, variante, désignation figée, quantité, prix unitaire HT, taux de TVA, remise, total |
| `liens_documents` | document source, document créé, nature du lien (`transforme_en`, `corrige`, `regle`, `livre`) |
| `fichiers_pdf` | document, langue, fichier, empreinte SHA-256 |

États du devis : `en_attente`, `transforme`, `refuse`, `expire`. Les devis de la boutique portent en
plus le numéro court du ticket, l'empreinte du lien privé et la date de fin de réservation.

Un déclencheur interdit toute modification ou suppression d'un document émis (sauf le devis en attente).

## Ventes, commandes et colis

| Table | Contenu principal |
|---|---|
| `ventes` | canal (`caisse`, `commande`), mode (`vente_directe`, `envoi`), client, facture ou ticket lié, vendeur, encaissée le |
| `commandes` | numéro, devis d'origine, client, statut (`nouvelle`, `a_confirmer`, `confirmee`, `preparee`, `expediee`, `livree`, `retournee`, `annulee`), tentatives d'appel, livraison (`domicile`, `point_relais`), wilaya, commune, adresse 🔒, frais de livraison, note |
| `lignes_commande` | commande, variante, quantité, prix |
| `historique_commande` | commande, ancien et nouveau statut, auteur, date |
| `colis` | commande, transporteur, numéro de suivi, statut, expédié le, livré le, retourné le, montant à encaisser, encaissé le |
| `transporteurs` | nom, actif, connecteur (vide aujourd'hui, prêt pour une API) |
| `frais_livraison` | wilaya, transporteur, prix à domicile, prix en point relais |

## Boutique en ligne

| Table | Contenu principal |
|---|---|
| `boutiques` | une par commerçant : en ligne (faux), modèle (`vitrine`, `catalogue`, `grandes_photos`, `produit_unique`), logo, bannière, couleur, texte d'accueil français et arabe, ordre des sections, réseaux sociaux, WhatsApp, conditions de livraison et de retour, affichage des ruptures (`visible` ou `masque`), seuil « Plus que N », durée de réservation |
| `limites_tickets` | empreinte du téléphone ou de l'appareil, compteur, fenêtre de temps |

## Notifications et exports

| Table | Contenu principal |
|---|---|
| `notifications` | utilisateur ou rôle visé, type, objet lié, lue le |
| `exports` | période, demandé par, état, fichier d'archive, expire le |
| `taches` | file du worker : type, données, à exécuter le, essais, erreur |

## Règles RLS, en résumé

```sql
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON produits
  USING      (commercant_id = current_setting('app.commercant_id', true)::uuid)
  WITH CHECK (commercant_id = current_setting('app.commercant_id', true)::uuid);
```

- La même règle est posée sur chaque table d'un commerçant. Un test automatique parcourt toutes les tables et échoue si l'une n'a pas `commercant_id`, la RLS forcée et sa règle.
- D'autres tests se connectent comme le commerçant A et tentent de lire, modifier et supprimer chaque type de donnée du commerçant B. Tous doivent échouer.
- Les tables de la plateforme ne sont pas accessibles au rôle `app`, sauf `wilayas`, `communes` et `formules` en lecture.
