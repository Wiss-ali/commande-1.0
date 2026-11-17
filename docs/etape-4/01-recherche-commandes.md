# Étape 4 — Recherche : commandes à livrer, colis, clients

Recherche faite le 17/11/2026. Les pages des sites n'ont pas pu être ouvertes depuis l'environnement de
travail : les informations viennent des résumés des moteurs de recherche. Chaque point à confirmer est signalé.

## 1. Ce que proposent les outils du domaine

- **Transporteurs algériens** : Yalidine, ZR Express, EcoTrack (plateforme utilisée par plusieurs sociétés de
  livraison), NOEST, Maystro, et d'autres. Tous livrent **à domicile** ou en **point relais (« stop desk »)**, avec
  un prix par wilaya pour chacun des deux modes. Le point relais est moins cher.
  Sources : [dzbuild — vue d'ensemble des transporteurs](https://dzbuild.com/docs/couriers/overview),
  [dzbuild — sociétés de livraison](https://dzbuild.com/blog/shipping-companies-algeria),
  [eGrow — transporteurs 2026](https://www.egrow.com/en/blog/best-delivery-companies-algeria-2026).
- **API des transporteurs** : Yalidine (avec webhooks de suivi), EcoTrack (jeton « Bearer »), ZR Express
  (nouvelle plateforme avec ses propres identifiants de territoires). Chacun a ses identifiants de wilaya, de
  commune et de point relais : un connecteur par transporteur est nécessaire. Des bibliothèques tierces unifient
  les statuts. Sources : [dzbuild — EcoTrack](https://dzbuild.com/docs/couriers/ecotrack),
  [dzbuild — Yalidine](https://dzbuild.com/docs/couriers/yalidine), [dzbuild — ZR Express](https://dzbuild.com/docs/couriers/zr-express),
  [Dolivroo SDK](https://packagist.org/packages/dolivroo/sdk).
- **Outils de gestion des commandes (eGrow, plateformes algériennes)** : liste des commandes par statut,
  compteur d'appels, historique du client par téléphone, liste noire, frais par wilaya, export vers le transporteur.

## 2. Ce que demande la réglementation

- **Loi 18-05 sur le commerce électronique** (JO n° 28 du 16/05/2018) : le vendeur reste responsable de la
  livraison même faite par un tiers ; il ne peut pas faire payer un produit non commandé ; il garde un registre
  des transactions datées ; un accusé de réception est remis à la livraison (le bordereau du transporteur joue ce
  rôle). Sources : [legal-doctrine](https://legal-doctrine.com/edition/ecommerce-algerie-les-parties-du-econtrat),
  [ministère du Commerce](https://commerce.gov.dz/fr/actualites/la-loi-relative-au-commerce-electronique-fixant-les-regles-generales-du-commerce-electronique-des-biens-et-des-services).
  **À vérifier dans le texte officiel** : le délai de retour et le délai de livraison (non trouvés).
- **Loi 18-07 sur les données personnelles** (JO n° 34 du 10/06/2018) : le téléphone et l'adresse de l'acheteur
  sont des données personnelles ; le traitement est à déclarer à l'ANPDP ; droit d'accès et de rectification.
  Sources : [ministère du Commerce — confidentialité](https://commerce.gov.dz/fr/priv),
  [algerie-eco — appel de l'ANPDP](https://algerie-eco.com/?p=212224), [Gide](https://www.gide.com/en/news-insights/protection-of-personal-data-focus-on-algerian-regulations/).
  Conséquence : téléphone et adresse restent chiffrés ; **pas de liste noire partagée entre commerçants**
  (l'alerte ne regarde que les commandes du même commerçant).
- **69 wilayas** : 11 wilayas créées par la loi modifiant la loi 84-09 (adoptée le 24/12/2025), numéros fixés par
  le **décret présidentiel 26-206 du 25/05/2026** : 59 Aflou, 60 Barika, 61 El Kantara, 62 Bir El Ater,
  63 El Aricha, 64 Ksar Chellala, 65 Aïn Oussera, 66 Messaad, 67 Ksar El Boukhari, 68 Bou Saâda,
  69 El Abiodh Sidi Cheikh. Elles exercent leurs prérogatives à partir du 01/01/2027. Une autre numérotation,
  antérieure au décret, circule encore : elle est fausse. Communes : 1 541.
  Sources : [dznews](https://dznews.org/wilayas-algerie/), [L'express DZ](https://www.expressdz.dz/2026/06/05/nouvelles-wilayas-en-algerie-noms-chefs-lieux-et-numeros-fixes-par-decret/),
  [algerie-eco](https://algerie-eco.com/2026/07/20/immatriculation-des-vehicules-voici-les-codes-des-11-nouvelles-wilayas-qui-entreront-en-vigueur-le-1er-janvier-2027/),
  [dzbuild — 69 wilayas](https://dzbuild.com/blog/algeria-69-wilayas-list-2026).
  **À vérifier au Journal officiel** : la liste a été enregistrée comme donnée modifiable par l'administrateur.

## 3. Ce dont le commerçant a besoin au quotidien

- Le paiement à la livraison représente 85 à 95 % des achats en ligne en Algérie ; les retours sont de 20 à 35 %
  selon les sources (chiffres de vendeurs d'outils, à prendre avec prudence).
- La cause de retour la plus citée : **une commande pas confirmée par téléphone**. Conseil répété : appeler,
  confirmer le total livraison comprise, compter les appels sans réponse, annuler après plusieurs essais.
- Savoir tout de suite si un numéro a **déjà refusé ou renvoyé** des colis.
  Sources : [dzbuild — réduire les retours](https://dzbuild.com/blog/reduce-cod-return-rate-algeria),
  [dzbuild — bonnes pratiques](https://dzbuild.com/blog/cod-best-practices),
  [algeriatech — dépendance au paiement à la livraison](https://algeriatech.news/?p=25174).

## 4. Fonctions proposées

### Indispensable (fait à cette étape)

1. Commande créée à la main en moins de 30 secondes : nom, téléphone, wilaya, commune, domicile ou point relais, articles (recherche ou scan). Les frais de livraison de la wilaya s'ajoutent tout seuls.
2. Statuts : à confirmer, confirmée, préparée, expédiée, livrée, retournée, annulée (« nouvelle » servira aux commandes de la boutique, étape 6). Pastille de statut avec forme et couleur.
3. Bouton « Pas de réponse » : compteur de tentatives d'appel, avec la date du dernier appel.
4. Confirmer : une seule question, « Envoi » ou « Vente directe » (facture créée, stock réservé ou sorti).
5. Expédier : transporteur et numéro de suivi saisis à la main ; le stock réservé sort à ce moment.
6. Livrée : la facture est marquée payée (paiement à la livraison). Retournée : avoir automatique, stock remis.
7. Annuler : stock libéré ; si une facture existait, elle est annulée par un avoir.
8. Alerte quand le téléphone a déjà des commandes retournées ou annulées chez ce commerçant.
9. Liste officielle des 69 wilayas, en français et en arabe, stockée dans la base.
10. Réglages › Livraison : transporteurs, frais à domicile et en point relais par wilaya.
11. Historique de chaque commande (qui a changé quoi, quand).
12. Écran Clients : historique des achats, total dépensé, taux de retour, recherche par nom ou téléphone.
13. Interface vide prête pour brancher l'API d'un transporteur.

### Utile (fait si simple)

- Filtre de la liste par statut, recherche par numéro de commande ou téléphone.
- Bouton « Appeler » et « WhatsApp » sur la commande.
- Lien vers le devis, la facture et l'avoir depuis la commande.

### Plus tard

- Liste officielle des 1 541 communes (la commune est saisie à la main en attendant ; la table est prête).
- Connecteurs réels Yalidine, ZR Express, EcoTrack (création du colis et suivi automatique).
- Étiquette d'expédition imprimable, bordereau groupé du jour.
- Suivi de l'argent reversé par le transporteur (versements).
- Frais différents selon le transporteur (une seule grille par commerçant pour l'instant).
- Écran d'administration des wilayas (étape 7).
