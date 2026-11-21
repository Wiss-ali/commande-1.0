# Test « comme un commerçant » — 20/11/2026

Demande du propriétaire : se mettre à la place d'un commerçant, utiliser un compte complet, dire si tout est
fluide et facile, et ce qui manque pour que ce soit le plus complet possible. Signalement : « Barre du bas » apparaissait deux fois.

Comment : magasin de démonstration (`npm run demo`, propriétaire Ali), téléphone de 390 px de large, en français
puis en arabe. Écrans parcourus : Accueil, Caisse (vraie vente avec monnaie), Stock, Nouveau produit, Commandes
(liste, fiche, nouvelle commande), Factures, Clients (liste, fiche avec crédit), Rapports, Boutique en ligne
(écran du commerçant et boutique publique), Notifications, Scan, Plus, Réglages, Sécurité, Équipe, Clôture.

## Corrigé tout de suite

- **« Barre du bas » en double** : pour le propriétaire, elle était dans « Plus » juste sous « Réglages », et encore dans Réglages.
  Elle n'est plus que dans Réglages. Les employés, qui n'ont pas la page Réglages, la gardent dans « Plus ».
  Test de parcours mis à jour : il vérifie l'absence du doublon. 187 tests ✅ ; 88 parcours ✅.

## Ce qui marche bien

- **Accueil** : les chiffres du jour et la liste « À faire » (commande à confirmer, colis à préparer, clients qui doivent) disent quoi faire en premier.
- **Caisse** : toucher un produit, Encaisser, la monnaie à rendre s'affiche toute seule ; ticket et « Nouvelle vente » juste après. Rapide.
- **Commandes** : boutons Appeler et WhatsApp, une seule question « Envoi ou vente directe ? ». Clair.
- **Crédit client** : la fiche montre ce que le client doit et permet d'enregistrer un versement.
- **Rapports** : marge réelle et bénéfice net (dépenses comprises) expliqués en une phrase.
- **Boutique publique** : belle, claire, Appeler/WhatsApp, rupture et « plus que 3 » visibles.
- **Arabe** : écran retourné, montants lisibles (vérifié chiffre par chiffre : « 10 510 » reste dans le bon ordre).

## Ce qui gêne (classé du plus gênant au moins gênant)

1. **Factures : pas de bouton « Nouvelle facture ».** Dans l'onglet Factures, rien pour en créer une. Il faut savoir
   qu'on passe par un devis (« Transformer en facture ») ou par la caisse (« Faire aussi une facture »). Un commerçant
   qui doit faire une facture à une entreprise va chercher ici et ne trouvera pas.
   *Proposition* : un bouton « Nouvelle facture » qui ouvre le même formulaire que le devis et le transforme directement.
2. **Clients : impossible d'ajouter ou de modifier un client.** Pas de bouton « Ajouter un client », pas de moyen de
   corriger un nom, un numéro ou une adresse, pas de note (« client fidèle », « ne répond pas »). Les clients
   n'apparaissent qu'après une vente ou une commande.
3. **Caisse : la grille des produits bouge pendant qu'on vend.** Chaque nouvel article s'ajoute au panier *au-dessus*
   de la grille, qui descend d'un cran : en allant vite, on touche le mauvais produit.
   *Proposition* : panier en bas de l'écran (replié, avec le nombre d'articles), la grille ne bouge plus.
4. **Écran « Boutique en ligne » du commerçant très long** : une seule page d'environ 20 écrans de téléphone
   (apparence, logo, couleurs, textes, réglages, produits…). On s'y perd. *Proposition* : onglets ou parties repliables.
5. **Facture et ticket : pas de bouton « Envoyer sur WhatsApp ».** En Algérie, le client demande souvent sa facture
   sur WhatsApp ; aujourd'hui il faut télécharger le PDF puis le partager à la main.
6. **Caisse, petits plus** : boutons rapides 500 / 1 000 / 2 000 DA pour le montant reçu ; stock restant sur chaque
   produit ; filtre par catégorie quand il y a beaucoup de produits.
7. **Mots** : dans Clients, un client qui a acheté à crédit en caisse affiche « Aucune commande » (il a pourtant
   acheté). Écrire « 1 achat » plutôt que « commande » pour les ventes en caisse.

## Ce qui manque pour être complet (déjà connu, rappelé)

- Envoi automatique des colis chez Yalidine, ZR Express, EcoTrack… (aujourd'hui le numéro de suivi se tape à la main ; tout est prêt pour brancher).
- Client reconnu à son numéro quand on tape une nouvelle commande.
- Vente au poids, date de péremption, ventes par vendeur, comparaison avec le mois d'avant.
- Rappels par SMS, impression directe sur petite imprimante de ticket (58 mm ou Bluetooth ; aujourd'hui PDF 80 mm).

## Pas essayé ici

- Le scan avec la caméra, les notifications sur le téléphone, l'aspect imprimé des PDF : il faut un vrai téléphone et le serveur en ligne.

## Question au propriétaire

Lesquels des points 1 à 7 faut-il faire, et dans quel ordre ? Proposition : 1, 2, 3 d'abord (les plus gênants au quotidien), puis 5 et 6.

## Suite : fait le 21/11/2026 (choix du propriétaire : 1, 2, 3, puis 6 et 7 ; 4 déjà réglé ; 5 plus tard)

| Point | Ce qui est fait | Où |
|---|---|---|
| 1 | Bouton **« Nouvelle facture »** dans l'onglet Factures : la facture est créée directement (plus besoin de devis). Même question qu'avant : « Vente directe » (moyen de paiement, ou « à crédit ») ou « Envoi » (stock réservé, payée à la livraison). Nom du client obligatoire. | Factures › Nouvelle facture |
| 2 | **Ajouter un client** (bouton en haut de la liste) et **Modifier** sa fiche : nom, téléphone, adresse et numéros légaux, **note** (chiffrée). Un numéro déjà pris par un autre client est refusé. Une vente sans adresse n'efface plus l'adresse de la fiche. | Clients |
| 3 | **Panier de la caisse** : le produit touché (ou scanné) passe en haut ; seules les 3 dernières lignes sont visibles, le reste dans un volet « Voir N autres lignes » qu'on rouvre et replie. Les boutons + et − ne font pas bouger la ligne. | Caisse |
| 6 | **Montants rapides** sous « Montant reçu » : « Compte exact » puis les billets et sommes rondes au-dessus (ex. 1 540 DA → 1 600, 2 000, 5 000). **Stock restant** sur chaque produit de la grille. **Filtre par catégorie** (s'il y a au moins deux catégories). | Caisse |
| 7 | Liste des clients : « 1 achat » pour les ventes en caisse ou par facture, « 1 commande » pour les colis ; « Aucun achat » sinon. | Clients |

Correction du rapport : le point 5 était inexact, la facture a déjà un bouton « Partager (WhatsApp, e-mail…) ».

Migration `0021_note_client` (colonne `note_chiffre`, passe toute seule). Tests : 190 ✅ (3 nouveaux) ; 93 parcours ✅ (5 nouveaux, `tests/e2e/suivi-test-commercant.spec.ts`).

### À essayer

1. Factures › Nouvelle facture : un client, un produit, « Vente directe » par virement ; puis une autre « à crédit » : le client apparaît dans « Ils vous doivent ».
2. Clients › Ajouter un client avec une note ; Modifier ; essayer le numéro d'un autre client (refusé).
3. Caisse : toucher 5 produits, retoucher le premier (il remonte), ouvrir puis replier le reste du panier ; Encaisser et toucher un billet.
