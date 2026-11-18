# Lot d'ajouts n° 1 — recherche et liste

Date : 18/11/2026. Décision du propriétaire (même jour) : faire les ajouts 1 à 10 de la revue
`docs/revue-modules/01-rapport.md`, mettre aussi l'export pour le comptable dans Factures, et permettre de
choisir dans les réglages les 4 entrées de la barre du bas. Pas d'alerte de stock sur le téléphone.
« Voir comme le commerçant » : question posée, pas encore codé.

La recherche générale (sources) est dans le rapport de la revue. Ci-dessous : ce qui a été cherché en plus, et
la liste retenue, avec les choix par défaut prudents pour les questions encore ouvertes.

## 1. Recherche complémentaire

### Liste des communes
- La loi n° 26-06 du 4 avril 2026 (JO n° 25) porte le pays à 69 wilayas et 1 541 communes ; le décret
  présidentiel 26-206 du 25 mai 2026 fixe les noms et chefs-lieux des wilayas 59 à 69
  ([legal-doctrine.com](https://legal-doctrine.com/en/edition/reforme-territoriale-2026-ce-qui-change-pour-les-wilayas-et-les-communes-2dcf62d2ce16395411980a758f3617da),
  [expressdz.dz](https://www.expressdz.dz/2026/06/05/nouvelles-wilayas-en-algerie-noms-chefs-lieux-et-numeros-fixes-par-decret/)).
- Source retenue : le jeu de données ouvert [oussamidat/algerie-decoupage-administratif](https://github.com/oussamidat/algerie-decoupage-administratif),
  vérifié contre les PDF du Journal officiel (lois 84-09, 19-12, 26-06), licence ODbL 1.0. Ses numéros 59 à 69
  sont ceux déjà en base. Contrôle croisé avec la presse : Aïn Oussara (10 communes, mêmes noms), Ksar Chellala (6),
  El Abiodh Sidi Cheikh (7), Bou Saâda (23), Ksar El Boukhari (21)
  ([dznews.org](https://dznews.org/wilayas-algerie/)).
- Limites : ce n'est pas une publication officielle ; 272 noms sont des graphies non confirmées par un JO
  récent ; les noms arabes viennent d'une compilation communautaire. La liste reste donc **modifiable par
  l'administrateur**, comme les wilayas.

### Moyens de paiement et droit de timbre
- Plusieurs éditeurs algériens indiquent que le droit de timbre ne concerne que les paiements **en espèces** ;
  virement, versement bancaire ou postal et TPE en sont exonérés
  ([facturedz.com](https://www.facturedz.com/droit-de-timbre.html), [costy.app](https://costy.app/comment-calculer-les-frais-de-timbre-en-algerie-en-2026/)).
  À faire confirmer par un comptable. Aucun barème n'est écrit dans le code : il reste saisi par l'administrateur.
- Choix : le timbre est calculé sur la **part payée en espèces au moment de la vente** (vente comptant). Pour un
  paiement mixte, sur la seule part en espèces. Un versement ultérieur n'ajoute pas de timbre (la facture est
  figée) : point signalé au comptable.

### Coût d'achat des arrivages
- Les logiciels de gestion (Sage 100, EBP) calculent le prix d'achat au **coût moyen unitaire pondéré**
  (CMUP) ; c'est aussi une méthode admise par le système comptable financier
  ([absyscyborg.com](https://absyscyborg.com/fr/logiciels/sage/sage-100/sage-100-gestion-commerciale)).
  Choix : à chaque arrivage, prix d'achat = (stock × ancien prix + quantité reçue × prix payé) ÷ (stock + quantité).

### Pixel Facebook et TikTok
- YouCan propose le pixel Facebook / Instagram et l'API de conversion parmi ses fonctions de base
  ([youcan.shop](https://youcan.shop/en/help/application)).
- Question encore ouverte chez le propriétaire (vie privée, loi 18-07). Choix par défaut prudent : **désactivé**,
  activé seulement par le commerçant qui colle son identifiant, script chargé seulement sur **sa** boutique, politique
  de sécurité élargie seulement pour ces pages, mention visible en bas de la boutique. Aucun nom ni téléphone de
  l'acheteur n'est envoyé : seulement la page vue, le produit et le montant de la commande.

## 2. Liste retenue (tout « indispensable », décidé par le propriétaire)

1. **Moyen de paiement** à chaque encaissement : espèces, chèque, virement, CCP / BaridiMob, autre ; paiement en
   deux moyens ; imprimé sur la facture ; timbre seulement sur les espèces. Seules les espèces comptent dans la
   clôture. « TPE » : pas ajouté (question 1 encore ouverte).
2. **Remise** sur une ligne et sur le total, à la caisse, sur les devis et les factures écrites à la main. Le
   propriétaire peut toujours ; un vendeur seulement si le propriétaire l'y autorise.
3. **Retour d'une partie d'une vente** : avoir partiel (une ligne, une partie de la quantité), stock remis, argent
   rendu seulement à hauteur de ce qui avait été payé.
4. **Vente à crédit** : à la caisse ou à la facture, payé en partie ou pas du tout ; ce que doit chaque client sur
   sa fiche ; versements en plusieurs fois, avec reçu ; liste « Clients qui doivent ».
5. **Communes** : les 1 541 communes en base ; choix dans une liste (commande au téléphone et boutique) ; le
   serveur refuse une commune qui n'est pas de la wilaya choisie.
6. **Pixel Facebook / TikTok** : voir ci-dessus.
7. **Fournisseurs et arrivages** : fiche fournisseur, arrivage (articles, quantités, prix payé), stock entré,
   prix d'achat au coût moyen pondéré, montant payé et reste dû, paiements au fournisseur.
8. **Versements du transporteur** : colis livrés « à reverser » ; un versement regroupe des colis, avec le montant
   reçu et les frais retenus ; colis livrés pas encore reversés visibles.
9. **Dépenses** : catégorie, montant, date, payée par la caisse ou non ; une dépense payée par la caisse diminue
   les espèces attendues à la clôture ; bénéfice net dans Rapports (marge − dépenses).
10. **Plusieurs photos par produit** (jusqu'à 6), ordre choisi, galerie dans la boutique.

En plus : **export pour le comptable** accessible depuis Factures ; **barre du bas au choix** (4 entrées parmi
les modules autorisés, « Plus » toujours en dernier), mémorisée par personne.

## 3. Où chaque ajout est rangé

Pas de nouveau module : chaque ajout va dans le module qui le concerne (le module « Argent » de la revue n'a pas
été validé). Fournisseurs et arrivages : Stock. Crédit des clients : Clients et Factures. Versements : Commandes.
Dépenses : Caisse (saisie) et Rapports (bénéfice net).
