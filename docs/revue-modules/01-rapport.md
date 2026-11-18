# Revue des modules : ce qui est complet, ce qui manque, ce qu'il faudrait déplacer

Date : 18/11/2026. Demande du propriétaire : vérifier chaque module (caisse, factures, etc.) en le
comparant aux meilleurs outils et à la réglementation, puis dire ce qui manque et ce qu'il faudrait
déplacer ou ajouter. Quand un module est déjà au bon niveau, on le dit et on ne cherche pas plus loin.

Méthode : lecture du cahier des charges, des bilans des étapes 2 à 7, du code (tables, écrans), puis
recherche web (sources en fin de document). Certains sites (comparatifs algériens, blogs de logiciels
COD) n'étaient pas joignables depuis l'environnement de travail : seuls leurs extraits de recherche
ont été utilisés.

**Rien n'a été codé pendant cette revue.** C'est un rapport, pour que vous choisissiez.

---

## 1. Résumé en une page

| Module | Verdict | Ce qui manque le plus |
|---|---|---|
| Tableau de bord | ✅ Complet | Rien d'important. |
| Produits et stock | 🟡 Bon, il manque le côté « achats » | Fournisseurs et réceptions de marchandise ; vente au poids ou au carton ; plusieurs photos. |
| Scan | ✅ Complet | À essayer sur de vrais téléphones. |
| **Caisse** | 🟠 **Il manque des gestes de tous les jours** | **Remise, retour d'un seul article, vente à crédit (carnet), autres moyens de paiement, sorties d'espèces.** |
| **Factures et documents** | 🟠 **Solide, mais un point légal à corriger** | **Mode de paiement (virement, chèque, CCP…) : le droit de timbre ne s'applique qu'aux paiements en espèces.** Paiements partiels, avoir partiel, remise. |
| Commandes et colis | 🟡 Bon, il manque l'outillage des vendeurs en ligne | Liste des communes, versements du transporteur, frais de retour, rappel programmé, motif de retour. |
| Clients | 🟡 Minimal | Solde dû (crédit), notes, liste noire manuelle. |
| Rapports | 🟡 Bon | Dépenses du magasin (pour un vrai bénéfice), comparaison avec la période d'avant, par vendeur. |
| Boutique en ligne | 🟡 Bon, il manque l'outil n° 1 des vendeurs Facebook/Instagram | Pixel Facebook / TikTok, plusieurs photos, commandes abandonnées, offres « 2 achetés ». |
| Réglages | ✅ Complet | Droits plus fins pour les vendeurs (remise, annulation). |
| Administration | 🟡 Bon | « Voir comme le commerçant » (pour l'aider), essai gratuit, facture d'abonnement, annonces. |

### Les 10 ajouts que je ferais en premier (par ordre)

1. **Mode de paiement sur chaque encaissement** (espèces, virement, chèque, CCP/BaridiMob, autre) : c'est une mention exigée sur la facture, et c'est lui qui décide du droit de timbre. *(Factures, caisse)*
2. **Remise** à la caisse et sur les factures (sur une ligne ou sur le total), réservée aux personnes autorisées. *(Caisse, factures)*
3. **Retour ou échange d'un seul article** en magasin (avoir partiel). Aujourd'hui, on ne peut annuler qu'un ticket entier. *(Caisse, factures)*
4. **Vente à crédit / carnet du client** : vendre sans être payé tout de suite, suivre ce que doit chaque client, encaisser en plusieurs fois. Très courant en Algérie. *(Caisse, factures, clients)*
5. **Liste des 1 541 communes** dans la base : l'acheteur choisit au lieu de taper, et les transporteurs l'exigent. *(Commandes, boutique)*
6. **Pixel Facebook et TikTok** dans la boutique : sans lui, les vendeurs qui font de la publicité ne peuvent pas mesurer leurs ventes, et partiront chez un concurrent. *(Boutique — question de vie privée à trancher, voir 10.)*
7. **Fournisseurs et réception de marchandise** : enregistrer un arrivage, mettre à jour le prix d'achat, savoir ce qu'on doit au grossiste. *(Stock)*
8. **Versements du transporteur** : savoir quels colis livrés ont été payés par Yalidine/ZR, et lesquels pas encore. *(Commandes)*
9. **Dépenses du magasin** (loyer, électricité, salaires, frais divers) : pour afficher un vrai bénéfice, et des sorties d'espèces justes à la clôture. *(Rapports, caisse)*
10. **Plusieurs photos par produit** (la base est déjà prête). *(Stock, boutique)*

Le reste est détaillé ci-dessous, module par module, en trois colonnes : **indispensable**, **utile**, **plus tard**.

---

## 2. Tableau de bord — ✅ complet

**Ce qui est là** : les quatre chiffres demandés, une carte par module actif, un seul graphique 7/30 jours, la liste « À faire » cliquable, chaque rôle ne voit que ce qui le concerne.

C'est exactement le cahier des charges et ce que font les bons outils. **Rien d'indispensable à ajouter.**

- Utile, une fois les autres ajouts faits : une ligne « À faire » pour *les clients qui doivent de l'argent* (si le crédit est ajouté) et pour *les colis livrés pas encore payés par le transporteur* (si les versements sont ajoutés).

---

## 3. Produits et stock — 🟡 bon, il manque le côté « achats »

**Ce qui est là, et qui est au niveau des meilleurs outils** : fiche bilingue, variantes avec leur propre stock, mouvements avec auteur jamais modifiables, stock jamais négatif garanti par la base, inventaire par scan avec écarts, étiquettes code-barres/QR, import Excel sans doublon, archivage. Le prix d'achat est figé sur chaque vente (la marge passée ne change pas si le prix change).

**Ce que proposent les autres et qui manque ici** : les logiciels de gestion (Sage, EBP, Loyverse en option payante) gèrent tout le **cycle d'achat** : fournisseur → bon de commande → réception → facture du fournisseur, avec mise à jour automatique du stock et du prix d'achat (souvent au **coût moyen pondéré**). Les outils pour l'alimentaire ajoutent la **date de péremption**.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Fournisseurs** (nom, téléphone) et **réception de marchandise** : une seule saisie fait entrer le stock et met à jour le prix d'achat. | **Vente au poids, au mètre, au litre** (quantité à virgule, prix au kg) et **étiquettes de balance** (codes-barres commençant par 2 qui contiennent le poids ou le prix) pour les épiceries, boucheries, droguistes. | Plusieurs dépôts ou magasins, transferts entre eux. |
| **Plusieurs photos par produit** (déjà prévu dans la base, pas dans les écrans). | **Conditionnement** : un carton de 12 entre en stock comme 12 unités ; prix de gros si le client prend le carton. | Numéros de lot. |
| | **Coût moyen pondéré** : quand un arrivage coûte plus cher, le prix d'achat devient la moyenne, pas le dernier prix. | Commande automatique au fournisseur quand le stock est bas. |
| | **Date de péremption** et liste « périme dans 30 jours ». | |
| | Écran pour **renommer, fusionner ou supprimer les catégories** (aujourd'hui elles naissent seulement depuis une fiche ou l'import). | |
| | **Alerte stock bas sur le téléphone** (les notifications existent déjà pour les commandes). | |
| | **Dette envers chaque fournisseur** (ce qu'on lui doit, ce qu'on lui a payé). | |

**À déplacer** : rien.

---

## 4. Scan — ✅ complet

Lecteur natif, lecteur de secours pour iPhone, son, vibration, lampe, saisie manuelle, branché partout (recherche, création, caisse, colis, inventaire), étiquettes. **C'est tout le chapitre 6 du cahier des charges.**

Seule chose qui reste : **l'essayer sur un vrai Android et un vrai iPhone** en HTTPS (le serveur de test le permet maintenant).

---

## 5. Caisse — 🟠 il manque des gestes de tous les jours

**Ce qui est là** : recherche, scan, grille des produits les plus vendus, panier, monnaie à rendre, ticket ou facture, vente sans connexion envoyée une seule fois, clôture avec comptage à l'aveugle et écart gardé. La vente, le stock et le document s'écrivent ensemble. La clôture à l'aveugle est même meilleure que beaucoup d'outils.

**Ce que tous les logiciels de caisse proposent et qui manque ici** (Loyverse, Square, Shopify POS, et les comparatifs algériens qui conseillent de tester en priorité « le scan, les retours, le stock, l'inventaire, **les crédits clients** et la clôture ») :

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Remise** sur un article ou sur tout le ticket (en % ou en DA), avec un réglage « qui a le droit ». | **Mettre une vente de côté** (le client va chercher un autre article) et servir le suivant, puis la reprendre. | Impression directe sur imprimante à tickets et ouverture du tiroir-caisse (sans passer par le PDF). |
| **Retour / échange d'un seul article** : le client rapporte 1 article sur 3 ; avoir partiel, stock remis, espèces rendues ou bon d'échange. | **Article « divers » à prix libre** (un produit sans fiche, au prix tapé), compté à part dans les rapports. | Points de fidélité. |
| **Moyen de paiement** : espèces, et aussi CCP / BaridiMob (paiement par QR « Barid Pay » qui se répand chez les commerçants en 2026), virement, chèque — et **paiement mixte** (une partie en espèces, le reste autrement). Seules les espèces vont dans le tiroir à la clôture. | **Prix de gros** selon la quantité ou le type de client. | Plusieurs caisses dans le même magasin. |
| **Vente à crédit** : le client part sans payer (ou paie une partie), la somme s'ajoute à son carnet. | **Clôture par vendeur** (qui a encaissé quoi). | |
| **Entrées et sorties d'espèces** (payer le livreur de pain, prendre 2 000 DA pour la monnaie) : sinon la clôture montre un faux écart. | | |

**Point à trancher par vous** : enregistrer qu'un client a payé « par carte sur le terminal de la banque » (TPE posé à côté) n'est **pas** du paiement par carte codé dans l'application : on note seulement le moyen utilisé, aucun numéro de carte n'entre. Je propose de l'ajouter comme moyen « TPE (terminal de la banque) », mais la règle du projet interdit tout ce qui touche à la carte : **je ne le fais que si vous dites oui.**

**À déplacer** : rien. La clôture est bien placée dans la caisse.

---

## 6. Factures et documents — 🟠 solide, mais un point légal à corriger

**Ce qui est là, et c'est au niveau des meilleurs** : numérotation sans trou garantie par la base même sous 12 ventes simultanées, facture figée et jamais supprimable, avoir, toute la chaîne (devis, proforma, bon de commande, bon de livraison, facture, avoir, reçu) avec liens dans les deux sens, mentions du vendeur et de l'acheteur, TVA par produit, total en lettres en français et en arabe, PDF bilingue, partage WhatsApp, export pour le comptable. Aucun taux écrit en dur.

### Le point légal

Plusieurs sources (éditeurs algériens de facturation, à faire confirmer par un comptable) indiquent :
- le **droit de timbre ne s'applique qu'aux paiements en espèces** ; virement, versement bancaire ou postal et TPE en sont exonérés ;
- le barème d'après la loi de finances 2025 serait : **1 DA par tranche de 100 DA jusqu'à 30 000 DA, 1,5 DA jusqu'à 100 000 DA, 2 DA au-delà, minimum 5 DA, sans plafond**. L'écran de l'administration accepte déjà ce type de barème : il suffira de le saisir après confirmation.
- la loi de finances 2025 (art. 207) interdit les espèces pour certaines opérations (immobilier, véhicules neufs, bateaux, assurances obligatoires) : peu concerné ici.

**Or l'application ne connaît que deux moyens de paiement : « espèces » et « à la livraison ».** Une facture payée par virement ne peut donc pas l'indiquer, et le timbre serait mal calculé dès qu'il est activé. Le cahier des charges demande aussi « mode et date de paiement » sur la facture.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Choisir le moyen de paiement** à l'encaissement d'une facture (espèces, chèque, virement, CCP/BaridiMob, autre), l'imprimer sur la facture, et **ne calculer le timbre que pour les espèces**. | **Échéance** sur une facture (« à payer avant le… ») et liste des **factures impayées**, avec relance WhatsApp. | **Facture récapitulative** mensuelle reprenant plusieurs bons de livraison (prévue par le décret 05-468 pour les ventes répétées à un même client, sur autorisation de la direction du commerce). |
| **Paiements partiels / acomptes** : une facture payée en plusieurs fois, chaque versement avec son reçu. | **Remise** sur une ligne ou sur le total d'une facture (aujourd'hui, seulement en changeant le prix dans un devis). | **Bon de transfert** (marchandise déplacée entre deux locaux du même commerçant, décret 05-468). |
| **Avoir partiel** (une seule ligne, ou une partie de la quantité). Déjà dans les questions ouvertes. | Mention **« Duplicata »** quand on retélécharge un PDF déjà remis. | Facture électronique officielle, si l'Algérie l'impose un jour (aucune source fiable trouvée pour 2026). |
| | Envoi de la facture par e-mail directement depuis l'application. | |

**À déplacer** : l'**export pour le comptable** est aujourd'hui dans Rapports. Je le mettrais **aussi** dans Factures (bouton « Exporter » en haut de la liste) : c'est là qu'un commerçant le cherchera, et c'est ce que dit le cahier des charges (« un bouton Exporter »).

---

## 7. Commandes et colis — 🟡 bon, il manque l'outillage des vendeurs en ligne

**Ce qui est là** : saisie en moins de 30 secondes, frais par wilaya, alerte retours dès la saisie du numéro, réservation du stock, compteur d'appels, Appeler/WhatsApp, « Envoi » ou « Vente directe », suivi du colis jusqu'à livré/retourné avec avoir automatique, rôle préparateur, 69 wilayas modifiables, interface prête pour les transporteurs.

**Ce que proposent les outils COD algériens** (eGrow/Ecotrack, plugins WooCommerce DZ, YouCan) : 95 % des commandes en ligne en Algérie sont payées à la livraison, l'objectif courant est **plus de 85 % de confirmation** avant l'envoi ; ces outils récupèrent les prix et les statuts des transporteurs automatiquement, et passent les colis en « livré » ou « retourné » tout seuls. Il existe maintenant des API communes (dzship, CourierDZ) qui couvrent **Yalidine, ZR Express, Maystro, NOEST et plus de 30 sociétés Ecotrack** d'un coup.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Liste des 1 541 communes** (la table est prête, vide) : choix dans une liste, plus de fautes de frappe. | **Rappel programmé** : « rappeler à 18 h » ; la commande remonte en haut à l'heure dite. | **Branchement réel d'un transporteur** (création du colis, numéro de suivi et statuts automatiques), de préférence par une API commune pour en couvrir plusieurs d'un coup. |
| **Versements du transporteur** : marquer les colis payés par le transporteur (lot du jour), voir « livré mais pas encore reversé ». Aujourd'hui « Livré » vaut « payé ». | **Motif d'annulation ou de retour** (refusé, injoignable, faux numéro, changé d'avis) : utile pour les rapports et l'alerte. | **Étiquette d'expédition** et bordereau du jour imprimables. |
| **Frais de retour** et **coût réel payé au transporteur** (souvent différent du prix facturé au client) : sinon la marge est fausse. | **Statut « Reportée »** (le client veut être livré plus tard) et **« Échange »** (on renvoie une autre taille). | Confirmation automatique par WhatsApp/SMS (demande un fournisseur payant). |
| | **Client reconnu à son numéro** dans une nouvelle commande (nom et adresse proposés). Déjà proposé lors de la revue précédente. | Répartition des commandes entre plusieurs personnes qui confirment. |
| | **Grille de frais par transporteur**, et **liste des points relais (stop desk)** par wilaya. | |
| | Action groupée : « marquer ces 15 colis expédiés ». | |

**À déplacer** : le bouton **« Commandes » dans la barre du bas** pour les commerçants qui n'ont pas la caisse (vendeurs Instagram/Facebook sans magasin) : aujourd'hui, l'entrée « Caisse » ne leur sert à rien et leur écran le plus utilisé est caché dans « Plus ». Proposition : la barre du bas s'adapte aux modules actifs (Caisse si la caisse est active, sinon Commandes).

---

## 8. Clients — 🟡 minimal

**Ce qui est là** : liste, recherche, total dépensé, taux de retour, historique des commandes et documents. C'est ce que demande le cahier des charges.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Solde dû** (si la vente à crédit est ajoutée) : ce que le client doit, ses versements, bouton « Encaisser ». | **Note** libre sur le client (« livrer après 17 h »). | Messages groupés (promotion) par SMS/WhatsApp. |
| | **Liste noire manuelle** : bloquer un numéro qui fait de fausses commandes (la boutique refuse ses tickets). | Fidélité. |
| | **Fusionner deux fiches** du même client. | |
| | **Export et suppression d'un client sur demande** (loi 18-07 sur les données personnelles) depuis sa fiche. | |

---

## 9. Rapports — 🟡 bon

**Ce qui est là** : marge réelle, taux de confirmation et de livraison, retours par wilaya, meilleurs produits, périodes au choix, un graphique par écran, export comptable complet.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Dépenses** (loyer, électricité, salaires, transport, divers ; payées par la caisse ou non) et **bénéfice net** = marge − dépenses. Sans cela, le commerçant ne sait pas s'il gagne de l'argent. | **Comparaison avec la période précédente** (« +12 % par rapport au mois dernier »). | Ventes par heure et par jour de la semaine. |
| | **Ventes par vendeur.** | Prévision de rupture. |
| | **Encaissements par moyen de paiement** (une fois les moyens ajoutés). | |
| | **Stock qui ne se vend pas** (aucune vente depuis 60 jours) et valeur du stock dans le temps. | |
| | **Retours par produit** (quel article revient le plus). | |

---

## 10. Boutique en ligne — 🟡 bon, il manque l'outil n° 1 des vendeurs Facebook/Instagram

**Ce qui est là** : quatre modèles, sous-domaine, personnalisation avec contraste vérifié, aperçu, lien direct avec le stock (rupture, réservation 24 h), commande sans compte, ticket avec Appeler/WhatsApp, message carte bancaire, anti-fausses commandes, notifications sur le téléphone. C'est tout le cahier des charges.

**Ce que proposent YouCan, Shopify COD et les outils algériens** : le **pixel Facebook / Instagram** et l'API de conversion côté serveur (l'aide de YouCan les présente comme fonctions de base), les **paniers abandonnés**, l'**upsell en un clic**. Ces trois-là reviennent partout.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **Pixel Facebook (Meta) et TikTok** : le commerçant colle son identifiant, la boutique signale « vue produit », « commande ». **À trancher par vous** : cela fait charger un script de Facebook ou TikTok chez l'acheteur (vie privée, loi 18-07, politique de sécurité de la page). Je propose : désactivé par défaut, activé par le commerçant, mention dans la page, et de préférence l'envoi **depuis le serveur** (API de conversion) sans aucun script tiers dans la page. | **Commandes abandonnées** : l'acheteur a tapé son téléphone mais n'a pas validé ; le vendeur peut le rappeler. (Question de consentement à trancher aussi.) | Codes promo. |
| **Plusieurs photos par produit**, et une photo par variante (couleur). | **Offres par quantité** (« 2 pour 3 500 DA ») et produit proposé en plus au moment de valider. | Avis clients. |
| **Liste des communes** (voir Commandes). | **Aperçu propre quand on partage le lien** sur WhatsApp/Facebook (image et titre du produit). | Nom de domaine propre au commerçant (aujourd'hui traité à la main par la demande « site personnalisé »). |
| | **Choix du point relais** (stop desk) dans la liste du transporteur. | Vérification du téléphone par SMS. |
| | Description de produit plus riche (paragraphes, tableau des tailles). | |

---

## 11. Réglages et équipe — ✅ complet

Informations légales, équipe et rôles, langue, transporteurs et frais, TVA, modules, double authentification proposée. **Conforme au cahier des charges.**

- Utile : des **droits plus fins** par vendeur, à ajouter avec les fonctions ci-dessus : faire une remise (et jusqu'à combien), rembourser, vendre à crédit.

**Remarque** : depuis la revue du 18/11, le bouton de langue est dans « Plus » et non plus en haut de chaque écran, comme le demandait le cahier des charges (§ 8). C'était votre choix ; je le signale seulement pour que ce soit noté.

---

## 12. Administration de la plateforme — 🟡 bon

**Ce qui est là** : tableau (actifs, expirent bientôt, lecture seule, revenu du mois), formules modifiables, paiements hors application, retouche des modules, délais réglables, wilayas, demandes, journal de chaque action, double authentification obligatoire.

**Ce que proposent les panneaux d'administration des logiciels par abonnement** : se connecter « comme le client » pour l'aider (avec trace et indication visible), annonces dans l'application, essai gratuit, suivi des clients qui partent.

| Indispensable | Utile | Plus tard |
|---|---|---|
| **« Voir comme le commerçant »** en **lecture seule**, noté dans le journal, avec un bandeau visible chez lui (« l'administrateur a consulté votre compte le… »). Sans cela, quand un commerçant appelle pour un problème, vous ne pouvez pas voir ce qu'il voit. **Question de confiance à trancher** : je propose qu'il doive d'abord donner son accord dans ses réglages. | **Essai gratuit** de N jours (réglable) à la création. | Rappels d'abonnement par SMS ou WhatsApp. |
| | **Facture d'abonnement** (de vous au commerçant), en PDF. | Parrainage. |
| | **Annonce** affichée à tous les commerçants (nouvelle fonction, maintenance prévue). | |
| | **Note interne** sur chaque commerçant (« a payé en retard 2 fois »). | |
| | Liste des **commerçants inactifs** (aucune vente depuis 14 jours) pour les rappeler avant qu'ils partent. | |

---

## 13. Ce que je déplacerais (récapitulatif)

1. **Barre du bas adaptée aux modules** : « Commandes » à la place de « Caisse » quand la caisse n'est pas active.
2. **Export pour le comptable** : aussi accessible depuis Factures, pas seulement depuis Rapports.
3. **Alerte stock bas** : aussi sur le téléphone (notification), pas seulement à l'accueil.

Tout le reste est bien rangé : chaque module a sa page, les liens entre documents marchent dans les deux sens, et rien n'est saisi deux fois.

---

## 14. Nouveau module que je créerais : « Argent »

Plusieurs manques ci-dessus sont en fait le même sujet : **qui doit quoi à qui**. Plutôt que d'en mettre un morceau partout, je proposerais un seul petit module, activable dans Réglages › Modules comme les autres :

- **Crédit des clients** (ce qu'ils doivent, leurs versements) ;
- **Dettes envers les fournisseurs** ;
- **Versements du transporteur** ;
- **Dépenses** du magasin.

Une seule page, quatre onglets, un chiffre sur l'accueil (« On vous doit 45 000 DA »). Il garde l'outil léger : un commerçant qui n'en veut pas ne le voit pas.

---

## 15. Questions à trancher par vous

1. **Moyen « TPE (terminal de la banque) »** à la caisse : on note seulement que le client a payé sur le terminal, aucune carte n'entre dans l'application. D'accord ?
2. **Pixel Facebook/TikTok** : désactivé par défaut, activé par le commerçant, de préférence envoyé depuis le serveur. D'accord ?
3. **Commandes abandonnées** : garder le téléphone d'un acheteur qui n'a pas validé, pour que le vendeur le rappelle ? (Question de vie privée.)
4. **« Voir comme le commerçant »** : avec son accord préalable, ou sans ?
5. **Par quoi commencer** : je propose la liste des 10 du résumé, dans cet ordre.
6. **Barème du timbre et règle « espèces seulement »** : à faire confirmer par votre comptable avant de saisir le barème.

---

## Sources

- Ministère du Commerce, FAQ facture et décret 05-468 : [commerce.gov.dz — facture](https://commerce.gov.dz/fr/questions-frequentes/themes/facture), [conditions et modalités d'établissement de la facture](https://www.commerce.gov.dz/fr/reglementation/recueil/conditions-et-modalites-d-etablissement-de-la-facture), [guide des modes de facturation](https://commerce.gov.dz/fr/actualites/guide-precisant-les-differents-modes-de-facturation)
- Legal Doctrine, établissement d'une facture en Algérie : [legal-doctrine.com](https://legal-doctrine.com/edition/quelles-sont-les-conditions-et-modalites-detablissement-dune-facture-en-algerie) ; réforme du Code du timbre : [legal-doctrine.com](https://legal-doctrine.com/en/edition/la-reforme-recente-du-code-du-timbre-en-algerie-modernisation-fiscale-et-adaptation-aux-realites-economiques-3b56cdf16ba8f7b1e1491734532cade1)
- Droit de timbre (sources d'éditeurs, à confirmer) : [facturedz.com](https://www.facturedz.com/droit-de-timbre.html), [costy.app](https://costy.app/comment-calculer-les-frais-de-timbre-en-algerie-en-2026/), [lamacta.com](https://lamacta.com/en/blog/guide-facturation-legale-algerie-2026/), [artec-int.com](https://artec-int.com/fr/insights/mentions-obligatoires-facture-algerie)
- Paiements en espèces, LF 2025 art. 207 : [algerie360.com](https://www.algerie360.com/fin-des-paiements-en-cash-un-grand-acteur-du-secteur-industriel-saligne-sur-la-lf-2025/), [tsa-algerie.com](https://www.tsa-algerie.com/linterdiction-des-especes-dans-ces-transactions-est-elle-en-vigueur), LF 2026 : [Deloitte](https://blog.avocats.deloitte.fr/algerie-les-principales-mesures-de-la-loi-de-finances-pour-2026/)
- Caisse en Algérie (comparatif) : [zoomalgerie.com](https://zoomalgerie.com/logiciel-caisse-pos-algerie/) ; crédit client : [kolonell.com](https://kolonell.com/fr/blog/application-gestion-commerciale-sur-mesure-alger-prix-dzd-2026) ; module Odoo algérien (balance âgée) : [apps.odoo.com](https://apps.odoo.com/apps/modules/17.0/dz_accounting)
- BaridiMob / Barid Pay : [App Store](https://apps.apple.com/dz/app/baridimob/id1481839638), [algeriatech.news](https://algeriatech.news/tag/baridimob-en/)
- Caisse ailleurs : [Loyverse — fonctions](https://loyverse.com/features), [Merchant Maverick](https://www.merchantmaverick.com/reviews/loyverse-review/), [FitSmallBusiness](https://fitsmallbusiness.com/loyverse-review/), [The Retail Exec](https://theretailexec.com/payment-processing/pos-features/), [KORONA POS](https://koronapos.com/blog/pos-system-features/)
- Stock et achats : [Sage 100](https://absyscyborg.com/fr/logiciels/sage/sage-100/sage-100-gestion-commerciale), [EBP](https://www.ebp.com/wp-content/uploads/2026/08/ebp-FP-logiciel-gamme-gestion-commerciale.pdf), [Appvizer](https://www.appvizer.fr/magazine/operations/gestion-de-stock/meilleur-logiciel-gestion-de-stock), [GetApp](https://www.getapp.fr/blog/216/logiciels-gestion-de-stocks)
- Commerce en ligne COD en Algérie : [eGrow — guide COD 2026](https://www.egrow.com/en/blog/algeria-ecommerce-cod-complete-guide-2026), [dzbuild — WooCommerce et COD](https://dzbuild.com/blog/woocommerce-cash-on-delivery-algeria), [dzship / freeship](https://freeship.dzbuild.com/), [CourierDZ](https://packagist.org/packages/piteurstudio/courierdz), [EasySell — marché algérien](https://easysellapp.com/blogs/wiki/algeria-ecommerce-cod-market-entry-shopify-2026), [algeriatech.news — dépendance au COD](https://algeriatech.news/?p=25174)
- Boutique : [YouCan — fonctions](https://youcan.shop/en/features), [YouCan — applications](https://youcan.shop/en/blog/posts/YouCan-Apps), [YouCan — aide](https://youcan.shop/en/help/application), [Storeleads — pixel TikTok en Algérie](https://storeleads.app/reports/technology/TikTok%20Pixel/country/DZ)
- Administration d'un logiciel par abonnement : [Makerkit Super Admin](https://makerkit.dev/blog/changelog/super-admin), [brotcode — tableau d'administration](https://brotcode.pages.dev/blog/engineering/saas-admin-dashboard-operators/), [Baremetrics](https://baremetrics.com/blog/saas-metrics-dashboards-examples-templates)
