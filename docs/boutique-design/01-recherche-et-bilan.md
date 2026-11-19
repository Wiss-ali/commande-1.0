# Boutiques en ligne : vérification, suppression, nouveau design et création guidée

19/11/2026. Demande du propriétaire : vérifier que la boutique se coupe bien et peut être supprimée, qu'un commerçant
n'en a qu'une ; rendre les boutiques belles (« de vrais trucs avec du faux texte à remplacer ») ; création plus
belle et plus fluide, avec des choix de logos.

## 1. Vérification

| Point | Résultat |
|---|---|
| Couper la boutique | **Marchait déjà.** Coupée, l'accueil, les fiches produits, le panier et les photos affichent « Boutique momentanément indisponible » ; aucune commande n'est acceptée (vérifié aussi côté serveur) ; le commerçant garde l'aperçu ; le ticket d'un acheteur reste lisible par son lien privé. |
| Une seule boutique par commerçant | **Garanti par la base** : la table `boutiques` a pour clé le commerçant (une seule ligne possible), et l'adresse est une colonne du commerçant. Nouveau test : une seconde création est refusée (« Vous avez déjà une boutique ») et une seconde ligne est impossible. |
| Supprimer la boutique | **N'existait pas : ajouté.** Voir plus bas. |

## 2. Recherche (courte, module existant)

- Accueil d'une boutique : montrer tout de suite les produits et un chemin clair vers eux ; peu de signaux de
  confiance mais bien choisis (plusieurs sources d'agences le disent ; chiffres non vérifiés). En Algérie, le signal
  qui compte le plus est le **paiement à la livraison** (déjà la règle de l'application).
- Les grandes plateformes posent quelques questions sur l'activité à l'ouverture et adaptent le guide de départ ;
  elles donnent un logo en texte par défaut, un vrai logo restant facultatif (Shopify Logo Maker, ex-Hatchful).
- Sources : [Baymard, accueil e-commerce](https://baymard.com/research-articles/ecommerce-homepage-ux),
  [Baymard, bonnes pratiques](https://baymard.com/learn/ecommerce-best-practices),
  [ecommerce homepage design](https://btng-studio.pages.dev/articles/ecommerce-homepage-design),
  [Shopify Logo Maker (Hatchful)](https://gempages.net/blogs/shopify/hatchful-shopify-logo-maker),
  [ouverture d'une boutique Shopify pas à pas](https://fitsmallbusiness.com/how-to-set-up-shopify-store/).

**Indispensable (fait)** : suppression ; assistant de création ; logos dessinés ; textes d'exemple signalés ;
accueil avec accroche et bouton vers les produits ; points forts (paiement à la livraison) ; cartes produits soignées.
**Utile (fait)** : ambiances (polices), 11 couleurs, aperçu en direct, produits d'exemple dans l'aperçu d'une boutique vide.
**Plus tard** : envoyer ses propres photos d'ambiance par section, avis clients, page « À propos » séparée,
choix de police libre.

## 3. Ce qui a été fait

- **Création guidée** (quand il n'y a pas encore de boutique) en 5 étapes, avec un aperçu de téléphone qui suit
  chaque choix : 1) « Que vendez-vous ? » (8 activités), 2) adresse (proposée à partir du nom du magasin),
  3) modèle (4 dessins), 4) logo, couleur, ambiance, 5) résumé, et « Publier mes N produits » (coché par défaut).
  La boutique est créée **hors ligne**.
- **Logos dessinés** : 4 formes (rond, carré, contour, nom seul) × 24 icônes ou les initiales du magasin, dans la
  couleur de la boutique. Une image envoyée remplace le logo dessiné.
- **Ambiances** : Moderne (Inter), Élégante (Playfair Display / Amiri en arabe), Chaleureuse (Nunito / El Messiri),
  Audacieuse (Space Grotesk / Cairo). Elles changent aussi les coins et le fond de l'accueil. Polices servies par
  l'application (aucun site extérieur, sécurité inchangée).
- **11 couleurs** au lieu de 6 (bleu canard, bleu marine, framboise, ocre, olive en plus), toutes vérifiées à 4,5:1.
- **Textes d'exemple** par activité, en français et en arabe (fichiers de traduction, `boutiqueExemples`) :
  accroche, accueil, livraison, retours. Tant qu'ils ne sont pas remplacés, l'écran les signale (bandeau orange,
  pastille « Exemple ») et rappelle de les changer avant la mise en ligne.
- **Nouvelle boutique publique** : accueil plein écran (bannière avec voile, ou fond dégradé à la couleur avec le
  logo), accroche en grand, bouton « Découvrir nos produits » et WhatsApp ; bande de 3 points forts ; cartes
  produits (lettre sur fond coloré quand il n'y a pas de photo, pourcentage de remise) ; livraison et retours avec
  icônes ; encadré « Une question ? » ; pied de page complet. Chaque modèle a sa mise en page ; écran large :
  4 colonnes, fiche produit en deux colonnes.
- **Écran du commerçant** réorganisé : état (avec le logo), Apparence (aperçu en direct), Textes, Site
  personnalisé, Réglages, Adresse, Pixels, Produits, Carte, et en bas « Supprimer la boutique ».
- **Suppression** : il faut retaper l'adresse. Effacés : réglages, logo, bannière, textes ; les produits ne sont
  plus publiés ; l'adresse est libérée. **Gardés** : produits, stock, toutes les commandes (même celles de la
  boutique), devis, factures, demandes. Le commerçant peut recréer une boutique ensuite. Noté dans le journal
  d'activité (`boutique.supprimee`, `boutique.creee`).
- Base : migration `0019_boutique_design` (activité, ambiance, forme et icône du logo, accroche fr/ar ; droit de
  supprimer sa propre ligne de `boutiques`, toujours limité au commerçant par l'isolation).

## 4. Tests

- 181 tests ✅ (5 nouveaux : création, une seule boutique, valeurs refusées, suppression puis recréation, textes
  d'exemple fr/ar). Un ancien test de chiffrement qui échouait au hasard (environ une fois sur quelques milliers) a été rendu fiable.
- 88 parcours ✅ (le parcours boutique suit maintenant l'assistant ; nouveau parcours de suppression). Aucune
  erreur de script ni violation de la politique de sécurité.

## 5. À essayer par le propriétaire

1. Avec un commerçant sans boutique : ouvrir « Boutique en ligne », suivre les 5 étapes, regarder l'aperçu changer.
2. Ouvrir l'aperçu : remarquer les textes d'exemple, puis les remplacer dans « Textes de la boutique ».
3. Changer l'ambiance, la couleur, le logo ; envoyer une bannière ; essayer les 4 modèles.
4. Ouvrir la boutique en arabe et en mode sombre.
5. Supprimer la boutique (en tapant l'adresse) : vérifier que les produits et les commandes sont toujours là.

## 6. Point d'attention

- Après une suppression, les liens de tickets déjà envoyés aux acheteurs ne s'ouvrent plus (les commandes restent
  dans « Commandes »). C'est écrit dans l'écran de suppression. Pour fermer un moment, il faut « Couper ».
- La boutique de démonstration de l'administration peut aussi être supprimée depuis son espace ; « Remettre à zéro » la recrée.
