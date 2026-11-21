# Simplification des écrans : recherche et liste (21/11/2026)

Demande du propriétaire : « des trucs sont ouverts ou visibles alors qu'on n'en a pas besoin, ou il faudrait
répondre à autre chose avant ». Règle retenue : **montrer seulement l'essentiel ; le reste apparaît quand on
répond à une question ou qu'on touche « Plus d'options »**. Rien n'est supprimé, tout reste accessible.

## Recherche (sources)

- **Divulgation progressive** (Jakob Nielsen, Nielsen Norman Group) : les fonctions avancées ou rares sont
  reportées à un second niveau ; la première vue ne garde que ce que la plupart des gens utilisent.
  [Wikipédia](https://en.wikipedia.org/wiki/Progressive_disclosure),
  [IxDF](https://ixdf.org/encyclopedia/progressive_disclosure.html),
  [NN/g](https://www.nngroup.com/articles/progressive-disclosure/) (cité par les deux premières).
- **Baymard Institute** (formulaires de commande) : les champs facultatifs ou rarement utilisés se cachent
  derrière un lien (exemple type : le code promo / la remise) ; ceux qui en ont besoin trouvent le lien.
  Cela retire 20 à 60 % des champs visibles. Un champ dont beaucoup de gens ont besoin reste visible.
  [Form design](https://baymard.com/learn/form-design),
  [Champs redondants](https://baymard.com/guidelines/576-hiding-redundant-checkout-fields-and-options).
- **GOV.UK Design System** : une question qui dépend d'une réponse n'apparaît qu'après cette réponse
  (« conditional reveal »), à garder simple ; partir d'« une chose par page ».
  [Radios](https://design-system.service.gov.uk/components/radios/),
  [One thing per page](https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/).
- **US Web Design System** : formulaires complexes = étapes + divulgation progressive.
  [Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/).

## Constat écran par écran (captures du magasin de démonstration, téléphone)

| Écran | Ce qui gêne |
|---|---|
| Boutique en ligne (commerçant) | Une seule page de **8 000 pixels** : apparence, logo, textes, ordre des sections, contact, réglages anti-abus, adresse, pixels, produits, carte, suppression. |
| Nouveau produit | Nom arabe, catégorie, photo, code-barres, seuil d'alerte affichés d'emblée alors que nom + prix + quantité suffisent. |
| Caisse › Encaisser | « Remise sur le total » est le premier champ, avant le montant à payer. |
| Nouvelle commande | « Commune » visible avant d'avoir choisi la wilaya ; « Note » toujours ouverte. |
| Nouveau devis / facture | Remise sur chaque ligne, remise sur le total et note toujours ouvertes. |
| Stock | Boutons « Arrivage » et « Fournisseurs » en haut, aussi visibles que « Ajouter un produit ». |
| Plus | « Barre du bas » (réglage fait une fois) au milieu des modules. |

## Liste

### Indispensable (fait dans ce lot)

1. **Boutique** : 4 onglets (Apparence, Textes, Produits, Réglages) ; un seul ouvert à la fois. La carte
   « en ligne / coupée » reste en haut. Dans Réglages : Contact visible ; ordre des sections, stock et
   réservation, adresse, mesure des publicités, site personnalisé et suppression rangés sous des volets fermés.
   L'onglet Textes est signalé tant que des textes d'exemple restent.
2. **Nouveau produit** : visibles = nom (dans la langue de l'écran), prix de vente, prix d'achat, quantité.
   Le reste (nom dans l'autre langue, catégorie, photo, code-barres, seuil, TVA) sous « Plus de détails »,
   ouvert tout seul si l'un d'eux est déjà rempli (modification, produit créé depuis un scan).
3. **Encaisser** : le montant à payer d'abord ; la remise derrière « Faire une remise » (seulement pour qui en
   a le droit, ouverte si une remise est déjà saisie).
4. **Nouvelle commande** : la commune n'apparaît qu'une fois la wilaya choisie ; note derrière « Ajouter une note ».
5. **Devis / facture** : remise de ligne, remise globale et note derrière des liens, ouverts si déjà remplis.
6. **Stock** : Arrivage et Fournisseurs descendus dans « Outils ».
7. **Plus** : « Barre du bas » déplacée dans Réglages.

### Utile (plus tard, à proposer)

- Accueil : « Vos modules » répète la barre du bas et « À faire » ; pourrait se replier.
- Premier lancement guidé : poser 3 questions (vendez-vous en ligne ? livrez-vous ? avez-vous des employés ?)
  et n'activer que les modules utiles.
- Fiche commande : n'afficher que l'action suivante (confirmer, expédier…) en grand.

### Plus tard

- Mode « simple / complet » choisi par le commerçant.
