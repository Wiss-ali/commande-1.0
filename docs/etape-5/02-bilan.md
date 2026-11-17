# Étape 5 — Bilan : accueil, rapports, export pour le comptable

Terminée le 17/11/2026. En attente de la validation du propriétaire.
Recherche et liste des fonctions : `docs/etape-5/01-recherche-accueil-rapports.md`.

## Fait

| Fonction | Où |
|---|---|
| Accueil : quatre chiffres au plus (ventes du jour, commandes à confirmer, colis en route, produits en stock bas), chacun ouvre l'écran concerné | `/` |
| Un seul graphique : les ventes des 7 ou 30 derniers jours (barres), avec le tableau des chiffres en dessous | `/` |
| Liste « À faire » cliquable : commandes à confirmer, colis à expédier, ventes à vérifier dans le stock, ruptures, devis en attente, caisse d'un jour passé pas clôturée, archive du mois à télécharger (du 1er au 10 du mois) | `/` |
| Une carte par module actif, avec un seul chiffre ; la carte Boutique en ligne dit « Désactivée » | `/` |
| Chaque rôle ne voit que ce qui le concerne : le préparateur ne voit ni les ventes ni l'argent | `/` |
| Rapport Marge réelle : ventes hors taxe − prix d'achat − livraison payée (colis retournés compris), taux de marque, panier moyen | `/rapports` |
| Rapport Commandes : taux de confirmation et taux de livraison | `/rapports?r=commandes` |
| Rapport Retours par wilaya | `/rapports?r=retours` |
| Rapport Meilleurs produits : quantité, ventes, marge | `/rapports?r=produits` |
| Période au choix pour chaque rapport : 7 jours, 30 jours, ce mois, mois dernier, cette année | `/rapports` |
| Export pour le comptable : archive ZIP avec un PDF par facture, avoir, ticket et reçu, rangés par dossier, et quatre tableaux CSV (documents, lignes vendues, stock, clients) qui s'ouvrent dans Excel | `/rapports/export` |

## Règles garanties

- Tous les chiffres sont calculés à partir des documents, des commandes et du stock, à l'heure d'Alger. Rien n'est recopié.
- Une facture annulée par un avoir sort des ventes et de la marge.
- Rapports et export : propriétaire seulement, revérifié côté serveur. Chaque export est noté dans le journal des actions sensibles (il contient les téléphones des clients).
- Dans les fichiers CSV, un texte qui ressemble à une formule Excel est neutralisé.
- Une archive contient 500 documents au plus ; au-delà, l'application demande une période plus courte.

## Tests automatiques

- **117 tests** unitaires et d'intégration, dont 8 nouveaux : périodes et heure d'Alger, chiffres de l'accueil, série des ventes, marge réelle calculée à la main sur un magasin connu, taux de confirmation et de livraison, retours par wilaya, meilleurs produits, cellules CSV, archive complète avec ses PDF, isolation entre commerçants.
- **53 parcours de bout en bout**, dont 6 nouveaux sur un écran de 360 px : accueil du propriétaire, quatre rapports, téléchargement réel de l'archive, droits de la vendeuse et du préparateur, arabe en thème sombre.
- Correction dans les anciens parcours : les captures « thème sombre » attendent maintenant que le thème soit vraiment changé.
- Captures : `docs/etape-5/captures/`.

## Pas fait, ou différent du plan

- **Coût réel de la livraison** : la marge compte les frais facturés au client comme coût payé au transporteur. Si votre transporteur vous coûte un autre prix, il faudra un réglage par transporteur (plus tard).
- **Comparaison avec la période précédente** et **rapports par vendeur** : plus tard.
- **Rappel mensuel** : il apparaît dans « À faire » du 1er au 10 du mois. L'envoi par e-mail viendra avec les tâches de fond (étape 8).
- **Carte Boutique** : toujours « Désactivée » jusqu'à l'étape 6. Elle n'apparaît que si le module Boutique est activé dans Réglages › Modules.
- **Durée légale de conservation des factures en Algérie** : non confirmée par la recherche ; le réglage de 10 ans du cahier des charges reste, à faire confirmer par un comptable.
- **Sécurité des dépendances** : une alerte publiée sur `picomatch` (risque de lenteur sur un motif de fichiers piégé) n'a pas encore de version corrigée. Ce module ne sert qu'aux outils de développement et à la surveillance des fichiers de traduction, jamais avec un texte saisi par un utilisateur. À mettre à jour dès qu'une correction sort.

## À essayer par le propriétaire

1. Ouvrir l'accueil le matin : lire les quatre chiffres, toucher chacun.
2. Passer le graphique de 7 à 30 jours ; ouvrir « Voir les chiffres ».
3. Toucher une ligne de « À faire » : elle doit ouvrir le bon écran.
4. Rapports › Marge : vérifier le calcul avec une vente dont vous connaissez le prix d'achat.
5. Rapports › Retours : repérer la wilaya qui renvoie le plus.
6. Rapports › Exporter pour le comptable : télécharger le mois, ouvrir `documents.csv` dans Excel, et un PDF.
7. Se connecter avec un compte vendeur puis préparateur : regarder ce que chacun voit.
8. Refaire en arabe.

## Liens entre les modules construits

```
                              ACCUEIL (pont entre les modules)
   ventes du jour   commandes à confirmer   colis en route   stock bas   « À faire »
        │                   │                     │              │           │
        ▼                   ▼                     ▼              ▼           ▼
   CAISSE/FACTURES ──► COMMANDES ──► COLIS ──────────────────► STOCK   (chaque ligne ouvre l'écran)
        │                   │           │                        │
        └─────────┬─────────┴───────────┴────────────────────────┘
                  ▼
              RAPPORTS : marge réelle (documents + prix d'achat + livraison), confirmation, livraison,
                         retours par wilaya, meilleurs produits ──► fiche produit
                  │
                  ▼
              EXPORT : PDF de chaque document + CSV documents, lignes, stock, clients
```
