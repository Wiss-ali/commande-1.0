# Lot d'ajouts n° 1 — bilan

Terminé le 18/11/2026, à la demande du propriétaire (ajouts 1 à 10 de la revue `docs/revue-modules/01-rapport.md`,
export pour le comptable dans Factures, barre du bas au choix). Recherche et liste : `01-recherche.md`.
Pas fait, à sa demande : l'alerte de stock sur le téléphone. En attente de sa réponse : « voir comme le commerçant ».

## Fait

| N° | Fonction | Où |
|---|---|---|
| 1 | **Moyen de paiement** à chaque encaissement : espèces, chèque, virement, CCP / BaridiMob, autre ; **deux moyens** pour une même vente ; référence (n° de chèque, de virement) ; moyen imprimé sur la facture et le ticket | Caisse › Encaisser ; fiche d'une facture |
| 1 | **Droit de timbre seulement sur la part payée en espèces** (barème toujours saisi par l'administrateur) | calcul serveur |
| 1 | Seules les espèces comptent dans la clôture ; chaque somme reçue ou rendue est notée et ne se modifie plus | Caisse › Clôture |
| 2 | **Remise** sur un article (en DA ou en %) et sur le total, à la caisse ; sur les lignes et le total d'un devis, d'une proforma, d'un bon de commande. Une remise sur le total est répartie entre les lignes pour garder une TVA juste. Colonne « Remise » sur le PDF | Caisse ; Factures › Nouveau devis |
| 2 | **Droit « Peut faire des remises »** accordé (ou non) à chaque vendeur ; le propriétaire peut toujours. Revérifié par le serveur, même pour une vente gardée pendant une coupure | Réglages › Équipe |
| 3 | **Retour d'une partie d'une vente** : avoir pour certains articles et une partie de la quantité ; stock remis pour eux seuls ; argent rendu seulement à hauteur de ce qui avait été payé ; plusieurs retours possibles, la dernière part retombe juste au centime | fiche d'une facture ou d'un ticket › Annuler par un avoir › Retour d'une partie |
| 4 | **Vente à crédit** : à la caisse (« À crédit », payé en partie ou pas du tout, nom du client exigé) ou en transformant un devis (« Pas encore payé ») | Caisse ; fiche d'un devis |
| 4 | **Paiements en plusieurs fois** sur une facture ou un ticket, avec un reçu à chaque fois ; pastille « Payée en partie », « Reste à payer » | fiche d'une facture ou d'un ticket |
| 4 | **Ce que doit chaque client**, ses ventes dues, et **versement global** (il règle les ventes les plus anciennes d'abord) ; filtre « Ils vous doivent » et total dû ; ligne « Vos clients vous doivent … » dans « À faire » | Clients ; fiche client ; Accueil |
| 5 | **Les 1 541 communes** (69 wilayas, loi 26-06) en base, en français et en arabe ; choix dans une liste (commande au téléphone et boutique) ; le serveur refuse une commune qui n'est pas de la wilaya et l'écrit sous son nom officiel (accents et majuscules ignorés) | Commandes › Nouvelle ; boutique › panier |
| 5 | Liste des communes modifiable par l'administrateur (nom, proposée ou non, ajout) | Administration › Wilayas › Communes |
| 6 | **Pixel Facebook / Instagram et TikTok**, désactivé par défaut : le commerçant colle son identifiant ; seul un identifiant au bon format est accepté (la base le revérifie) ; chargé seulement sur sa boutique, jamais dans l'espace de gestion ni pendant l'aperçu ; page vue, produit vu, ajout au panier, commande (montant seulement, jamais le nom ni le téléphone) ; mention en bas de la boutique | Boutique › Mesure des publicités |
| 7 | **Fournisseurs** (nom, téléphone, note, archivage) et **ce qu'on leur doit** ; paiements en plusieurs fois (en espèces, la somme sort de la caisse) | Stock › Fournisseurs |
| 7 | **Arrivage de marchandise** : articles reçus, quantité, prix payé ; le stock entre (un mouvement par article, relié à l'arrivage) ; **prix d'achat au coût moyen pondéré** ; somme payée tout de suite, le reste dû au fournisseur | Stock › Arrivage |
| 8 | **Argent des colis livrés** : colis livrés pas encore reversés par le transporteur, versement qui en regroupe plusieurs, somme reçue et **frais retenus** gardés | Commandes › Argent reçu |
| 9 | **Dépenses** (loyer, électricité, salaires, transport, fournitures, entretien, impôts, publicité, autre) ; payée avec l'argent de la caisse, elle est déduite des espèces attendues à la clôture ; annulable tant que la caisse n'est pas clôturée | Caisse › Dépenses |
| 9 | **Bénéfice net** = marge − dépenses de la période, avec le détail par type | Rapports › Marge |
| 10 | **Jusqu'à 6 photos par produit**, ordre choisi (« En premier » = photo principale) ; galerie qui défile au doigt dans la boutique | fiche produit › Photos ; boutique |
| + | **Export pour le comptable depuis Factures** (bouton « Exporter » en haut) ; accessible avec le module Factures ou Rapports ; colonne « Reste dû » dans `clients.csv` | Factures |
| + | **Barre du bas au choix** : chaque personne choisit ses 4 entrées parmi ce qu'elle peut ouvrir ; « Plus » reste à la fin ; par défaut Accueil, Caisse, Scan, Stock, complétée par Commandes si la caisse n'est pas ouverte | Plus › Barre du bas ; Réglages › Barre du bas |

### Retouche de la caisse demandée par le propriétaire (18/11/2026)

- Écran d'encaissement simplifié : **Espèces** et **Carte** en gros boutons ; chèque, virement, CCP / BaridiMob, autre et
  « À crédit » dans un **menu déroulant** ; « Payer avec deux moyens » est aussi une option de ce menu (rare en Algérie :
  rien ne s'affiche tant qu'on ne la choisit pas).
- **Carte** : visible mais **pas encore activée** (« Le paiement par carte n'est pas encore activé. Choisissez un autre
  moyen. »), la vente ne peut pas être validée avec. Rien n'est enregistré ni traité ; à activer plus tard.
- Un **ticket de caisse** est toujours remis ; la facture seulement en cochant « Faire aussi une facture (le client la demande) ».

## Règles garanties par la base

- Un paiement, un arrivage, ses lignes et un paiement de fournisseur ne se modifient ni ne s'effacent.
- Une dépense ne change qu'une fois (son annulation), et jamais après la clôture de sa caisse.
- Un pixel ne peut contenir que des chiffres (Facebook) ou des majuscules et chiffres (TikTok).
- Un même colis ne peut pas entrer dans deux versements (verrou dans la transaction).
- Les sept nouvelles tables sont isolées par commerçant (RLS activée et forcée) ; la vue des soldes s'exécute avec les droits de l'utilisateur (l'isolation s'y applique).
- Deux ventes simultanées n'ouvrent jamais deux caisses (l'ouverture se fait après le verrou du numéro).

## Base de données

Six migrations, toutes réversibles et essayées dans les deux sens :
`0012_communes`, `0013_paiements` (paiements, remise, avoir partiel, droit de remise, vue des soldes, reprise des
ventes déjà payées), `0014_pixels`, `0015_fournisseurs`, `0016_depenses_versements`, `0017_preferences_photos`.
La reprise des anciennes ventes a été vérifiée : chaque vente payée, reçu et remboursement existant devient un paiement.

## Tests

- **174 tests** unitaires et d'intégration (29 nouveaux) : moyens de paiement, timbre sur la seule part en espèces, crédit et versements, répartition des remises, avoir partiel (y compris une remise qui ne se divise pas), communes, pixels (code refusé), arrivage et coût moyen, dettes, dépenses et clôture, versements, barre du bas, isolation de toutes les nouvelles tables.
- **86 parcours de bout en bout** sur un écran de 360 px (12 nouveaux, `tests/e2e/suivi-ajouts.spec.ts`) : remise et paiement en deux moyens, retour d'une partie, vente à crédit puis versement, fournisseur et arrivage, dépense et bénéfice net, versement du transporteur, communes, pixel (et politique de sécurité de la page), photos, barre du bas, export depuis Factures, écrans en arabe sombre, aucune erreur de script.
- Les anciens parcours ont été adaptés là où le comportement a changé exprès : commune choisie dans une liste, barre du bas complétée par « Commandes ».
- Une fois, le parcours de l'administrateur a vu une ressource introuvable (404) sur l'accueil ; relancé deux fois, il passe. Ce cas aléatoire était déjà signalé dans les tests existants.
- Captures : `docs/ajouts-1/captures/`.

## Pas fait, ou différent

- **« Voir comme le commerçant »** : en attente de votre réponse (question ci-dessous).
- **Carte** : bouton visible à la caisse, pas encore activé (décision du propriétaire : on le fera plus tard).
- **Timbre d'un paiement fait plus tard en espèces** (vente à crédit réglée en espèces) : pas de timbre ajouté, la facture étant figée. À confirmer avec un comptable.
- **Un retour partiel d'un colis pas encore expédié** n'est pas possible : on modifie la commande, ou on l'annule.
- **Versements** : le prix réel payé au transporteur ne remplace pas encore les frais de livraison dans la marge (les frais retenus sont gardés à part).
- **Dépenses** : le vendeur voit et annule seulement les siennes ; le propriétaire voit tout et le total du mois.
- **À surveiller (sécurité)** : une vendeuse peut noter une dépense « payée par la caisse », ce qui baisse les espèces attendues. C'est nécessaire au quotidien (payer un livreur), mais chaque dépense garde son auteur, est notée dans le journal des actions sensibles, et le propriétaire les voit toutes. Si vous préférez, on peut réserver les dépenses au propriétaire.
- **Remises dans les devis** : permises à toute personne qui peut faire un devis, car les prix d'un devis sont déjà libres (c'était déjà le cas). Le droit « Peut faire des remises » s'applique à la caisse, où le prix vient de la fiche.
- **Commandes abandonnées, codes promo, avis** : non demandés dans ce lot.
- Les noms arabes des communes viennent d'une compilation communautaire, et 272 graphies françaises ne sont pas confirmées par un Journal officiel récent : corrigeables dans l'administration.

## À essayer par le propriétaire

1. Caisse : faire une remise de 10 % sur un article, puis 100 DA sur le total ; payer une partie en espèces et le reste par BaridiMob.
2. Caisse : vendre « À crédit » à un client ; aller dans Clients › Ils vous doivent ; enregistrer son versement.
3. Ouvrir un ticket de 3 articles, faire « Retour d'une partie » pour un seul ; regarder le stock et l'argent rendu.
4. Stock › Fournisseurs : ajouter votre grossiste ; Stock › Arrivage : recevoir des articles, payer une partie ; regarder le nouveau prix d'achat et ce que vous lui devez.
5. Caisse › Dépenses : noter un paiement fait avec l'argent du tiroir ; clôturer la caisse le soir et vérifier qu'il est déduit.
6. Rapports › Marge : lire le bénéfice net.
7. Commandes › Argent reçu : enregistrer un versement de Yalidine (ou autre) pour vos colis livrés.
8. Nouvelle commande et boutique : choisir la wilaya, puis la commune dans la liste.
9. Boutique › Mesure des publicités : coller l'identifiant de votre pixel (si vous faites de la publicité).
10. Fiche d'un produit : ajouter 2 ou 3 photos, en mettre une en premier ; regarder la page dans la boutique.
11. Plus › Barre du bas : mettre « Commandes » à la place de « Caisse ».
12. Factures › Exporter.
13. Réglages › Équipe : autoriser (ou non) les remises à une vendeuse.

## Liens entre les modules (nouveaux)

```
   CAISSE ──► TICKET / FACTURE ──► PAIEMENTS (espèces, chèque, virement, CCP, autre ; rendu = négatif)
     │              │  │                 │ espèces ──► JOURNÉE DE CAISSE ◄── DÉPENSES « par la caisse »
     │              │  │                 │                     ▲        ◄── PAIEMENTS FOURNISSEURS en espèces
     │              │  └─► AVOIR partiel (lignes reliées aux lignes vendues) ──► stock remis, argent rendu
     │              └────► RESTE DÛ ──► CLIENT (« Ils vous doivent ») ──► versement ──► REÇUS
   FOURNISSEUR ──► ARRIVAGE ──► MOUVEMENTS D'ENTRÉE (reliés) ──► PRIX D'ACHAT (coût moyen) ──► marge des ventes
        └──────── PAIEMENTS FOURNISSEURS ──► ce qu'on lui doit
   COMMANDE livrée ──► VERSEMENT DU TRANSPORTEUR (somme reçue, frais retenus)
   RAPPORTS : marge − DÉPENSES = BÉNÉFICE NET
   COMMUNES (liste officielle) ──► COMMANDE, BOUTIQUE        PIXELS ──► pages publiques de la boutique seulement
```
