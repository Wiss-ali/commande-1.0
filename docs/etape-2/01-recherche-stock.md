# Étape 2 — Recherche : produits, stock et scan

Recherche faite le 15/11/2026. Le propriétaire a demandé de lancer sans attendre sa validation :
la liste ci-dessous a donc été appliquée telle quelle. Tout reste modifiable.

## 1. Ce que font les meilleurs outils

- **Loyverse** (gratuit, très utilisé par les petits commerces) : suivi du stock par article, seuil d'alerte par article, filtre « stock bas / rupture », historique des mouvements filtrable par motif et par employé, comptage d'inventaire. [Aide Loyverse](https://help.loyverse.com/help/low-stock), [inventaire avancé](https://loyverse.com/advanced-inventory)
- **Square** : la vente baisse le stock toute seule, alerte de stock bas réglée article par article. [Aide Square](https://square.com/help/ie/en/article/5228-basic-inventory-management)
- **Shopify POS** : le comptage et les alertes sont réservés à la formule payante. [Comparatif](https://hackceleration.com/labs/feature/pos-inventory-management)
- **En Algérie** : les logiciels locaux (EasyStock et autres) mettent en avant le scan des codes-barres, l'inventaire, la casse et la perte, les achats. Un comparatif local résume le besoin : savoir à tout moment ce qu'on possède, combien ça a coûté et quand recommander. [Zoom Algérie](https://zoomalgerie.com/?p=17160), [annonce EasyStock](https://www.ouedkniss.com/applications-software-logiciel-de-gestion-stock-easystock-batna-algeria-d28377713)

À retenir : stock mis à jour tout seul, seuil d'alerte par produit, historique avec le motif et l'auteur, comptage par scan, motifs « casse » et « perte ».

## 2. Ce que dit la réglementation algérienne

| Sujet | Ce qui a été trouvé | Effet dans l'application |
|---|---|---|
| Inventaire | L'article 10 du Code de commerce impose au commerçant un inventaire au moins une fois par an. [Mémoire univ. Béjaïa](https://www.univ-bejaia.dz/jspui/bitstream/123456789/17488/1/Les%20travaux%20de%20fin%20d%27exercice.pdf) | Chaque inventaire est gardé avec sa date, son auteur et ses écarts |
| Code-barres | Le préfixe des produits enregistrés en Algérie est 613 (GS1 Algeria). Un arrêté du 16/02/2021 rend le code-barres obligatoire sur les produits préemballés ; son application a été reportée plusieurs fois, la dernière date annoncée étant le 29/03/2023. [Ministère du Commerce](https://commerce.gov.dz/fr/questions-frequentes?page=47), [Algérie Eco](https://algerie-eco.com/2022/12/03/commerce-apposition-obligatoire-du-code-a-barres-sur-tous-les-produits-avant-le-29-mars-2023-rezig/) | Cette obligation vise le fabricant et l'importateur, pas le détaillant. L'application lit les codes existants et ne crée que des codes **internes** |
| Codes internes | La plage 200 à 299 est réservée par GS1 aux numéros « à circulation restreinte », utilisables dans un magasin. [GS1](https://www.gs1.org/prefixes), [GS1 RCN](https://www.gs1.org/docs/barcodes/GSCN-23-006-RCN.pdf) | Les codes créés par l'application commencent par 2 : ils ne peuvent pas entrer en conflit avec un vrai produit |
| Affichage des prix | La loi 04-02 (articles 4 et 5) oblige le vendeur à informer le client des prix par marquage, étiquetage ou affichage. [Algérie360](https://www.algerie360.com/affichage-prix-amende-fermeture-commerce/) | Les étiquettes peuvent porter le prix (case cochée par défaut) |

**Non vérifié sur une source officielle** (Journal officiel non joignable) : le texte exact de l'article 10, l'état actuel de l'obligation du code-barres après 2023, l'arrêté sur l'affichage des prix. Aucune de ces règles n'est écrite en dur dans le code.

## 3. Points techniques vérifiés

- **Scan** : l'API `BarcodeDetector` fonctionne sur Chrome Android, mais reste désactivée sur Safari iPhone et absente de Firefox. Le secours `zxing-wasm` (WebAssembly) est donc nécessaire, comme le prévoit le cahier des charges. [caniuse](https://caniuse.com/mdn-api_barcodedetector), [MDN](https://developer.mozilla.org/docs/Web/API/Barcode_Detection_API), [zxing-wasm](https://npmjs.com/package/zxing-wasm)
- **Lampe torche** : fiable sur Android ; sur iPhone elle dépend de la version. Le bouton n'apparaît que si le téléphone l'annonce. [Bug WebKit](https://bugs.webkit.org/show_bug.cgi?id=243075)
- **Import Excel** : la bibliothèque `xlsx` publiée sur npm a une faille connue et n'est plus mise à jour. [Avis de sécurité](https://advisories.gitlab.com/pkg/npm/xlsx/) Choix : le fichier est lu **dans le navigateur** par un petit lecteur maison (décompression par `fflate`), et le serveur ne reçoit que des lignes qu'il revérifie une par une.
- **Versions** : `zxing-wasm` 3.1.6 (la 3.1.7 est sortie le jour même, on évite une version de quelques heures), `sharp` 0.35.5, `fflate` 0.8.3. `npm audit` : aucune faille connue.

## 4. Fonctions

### Indispensable (fait à cette étape)

- Fiche produit : nom français et arabe, photo, prix d'achat, prix de vente, code-barres, seuil d'alerte, catégorie.
- Variantes (taille, couleur), chacune avec son stock, son code-barres et son prix.
- Mouvements de stock enregistrés avec leur auteur : entrée, correction, casse, perte, périmé. Les types vente, retour, réservation sont prêts dans la base pour les étapes 3 à 6.
- Le stock ne peut pas passer sous zéro, et personne ne peut le modifier sans laisser un mouvement.
- Liste du stock : recherche par nom ou code, filtres « stock bas » et « rupture », pastilles de statut.
- Scan par l'appareil photo, avec son, vibration, lampe et saisie manuelle. Il sert à chercher un produit, remplir le code d'une fiche, faire une entrée de stock et compter l'inventaire.
- Inventaire par scan : comptage, liste des écarts, validation par le propriétaire.
- Étiquettes code-barres ou QR à imprimer, avec création d'un code interne pour les produits qui n'en ont pas.
- Import de produits depuis Excel (demande ajoutée à l'étape 0), avec un modèle à télécharger.

### Utile (fait à cette étape)

- Valeur du stock au prix d'achat, visible du propriétaire seulement.
- Archiver un produit au lieu de le supprimer (son historique reste).
- Historique complet des mouvements, par produit et pour tout le magasin.
- Formats d'étiquettes : planche A4 et rouleau d'imprimante à étiquettes.

### Plus tard

- Fournisseurs et bons d'achat (version 2, décidé à l'étape 0).
- Plusieurs photos par produit (prévu dans la base, utile à la boutique, étape 6).
- Dates de péremption et numéros de lot.
- Notification sur le téléphone quand un produit passe en stock bas (avec les notifications, étape 6).
- Inventaire sans connexion.
- Export du stock en Excel (avec les exports pour le comptable, étape 5).

## 5. Choix à confirmer par le propriétaire

1. **Qui crée et modifie les produits ?** Aujourd'hui : le propriétaire seulement. Le vendeur et le préparateur peuvent faire une entrée de stock et compter l'inventaire, mais pas changer un prix ni corriger le stock.
2. **Stock à zéro** : une sortie est refusée s'il n'y a pas assez de stock. Pour la caisse (étape 3), il faudra décider si on peut vendre un produit que l'application croit épuisé.
