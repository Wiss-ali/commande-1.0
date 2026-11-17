# Étape 4 — Bilan : commandes à livrer, colis, clients

Terminée le 17/11/2026. En attente de la validation du propriétaire.
Recherche et liste des fonctions : `docs/etape-4/01-recherche-commandes.md`.

## Fait

| Fonction | Où |
|---|---|
| Commande prise au téléphone en moins de 30 secondes : téléphone, nom, wilaya, commune, domicile ou point relais, articles (recherche ou scan) | `/commandes/nouvelle` |
| Frais de livraison de la wilaya ajoutés tout seuls (modifiables pour une commande), total client toujours visible | même écran |
| Alerte pendant la saisie si ce numéro a déjà des colis retournés ou des commandes annulées chez vous (même écrit avec +213) | même écran, et sur la fiche |
| Le stock est réservé dès l'enregistrement : il ne peut pas être vendu deux fois | base de données |
| Statuts : à confirmer, confirmée, préparée, expédiée, livrée, retournée, annulée, avec pastille forme + couleur | `/commandes` |
| Filtres « À confirmer », « À expédier », « En route », « Terminées », recherche par nom, téléphone ou numéro | `/commandes` |
| « Pas de réponse » : compteur d'appels et date du dernier appel ; boutons Appeler et WhatsApp | fiche commande |
| Confirmer : une seule question, « Envoi » ou « Vente directe » ; la facture est créée sans ressaisie | fiche commande |
| Colis prêt, puis expédié avec transporteur et numéro de suivi ; le stock réservé sort à ce moment | fiche commande |
| Livré et payé : la facture est marquée payée à la livraison (hors caisse du jour) | fiche commande |
| Retour : avoir automatique, articles remis en stock | fiche commande |
| Annulation avant l'expédition : stock libéré ; si la facture existait, elle est annulée par un avoir (rien n'est supprimé) | fiche commande |
| Historique de chaque commande : qui a fait quoi, quand | fiche commande |
| Liens dans les deux sens : commande ↔ devis, facture, avoir ; la facture d'une commande renvoie à la commande | fiches |
| Clients : liste, recherche par nom ou téléphone, total dépensé, taux de retour, commandes et documents | `/clients` |
| Réglages › Livraison : transporteurs (ajouter, désactiver), frais à domicile et en point relais pour les 69 wilayas, « remplir partout » | `/reglages/livraison` |
| Liste officielle des 69 wilayas en français et en arabe, dans la base, modifiable par l'administrateur | table `wilayas` |
| Interface vide prête pour brancher l'API d'un transporteur | `src/lib/transporteurs.ts` |
| Magasin de démonstration : transporteur, frais et deux commandes | `npm run demo` |

## Règles garanties

- Chaque étape (confirmer, expédier, livrer, retourner, annuler) se fait en une seule transaction : tout réussit ou rien ne change. Un double toucher ne fait rien de plus.
- Une commande refusée (stock insuffisant, téléphone invalide…) n'écrit rien et ne consomme aucun numéro.
- Le devis et la facture d'une commande ne peuvent être transformés, annulés ou encaissés que depuis la commande : le suivi reste juste.
- Le préparateur voit les commandes, prépare et expédie ; il ne confirme pas, ne marque ni livraison ni retour, n'annule pas et ne voit pas les clients.
- Les quatre nouvelles tables des commerçants sont isolées (RLS activée et forcée) ; les wilayas sont lisibles par tous et modifiables seulement par l'administration.
- L'adresse est chiffrée ; le téléphone reste chiffré dans la fiche client. L'alerte ne regarde que les commandes du même commerçant.

## Tests automatiques

- **109 tests** unitaires et d'intégration, dont 12 nouveaux : parcours complet du colis et du stock à chaque étape, réservation passée du devis à la facture sans doublon, retour et avoir, annulation avant et après confirmation, modification des articles, alerte par téléphone, refus sans écriture, double toucher, isolation entre commerçants.
- **47 parcours de bout en bout**, dont 11 nouveaux sur un écran de 360 px : réglages de livraison, commande au téléphone, appel, envoi, préparateur, expédition, retour, alerte, vente directe, fiche client, isolation, arabe en thème sombre.
- `npm audit` : aucune faille connue. Captures : `docs/etape-4/captures/`.

## Pas fait, ou différent du plan

- **Communes** : la table est prête mais vide. La commune se tape à la main en attendant la liste officielle des 1 541 communes (à importer quand la source officielle sera accessible).
- **Numérotation des wilayas 59 à 69** : reprise du décret 26-206 du 25/05/2026 d'après la presse ; à vérifier au Journal officiel. Elle se corrige dans la base sans toucher au code.
- **Connecteurs Yalidine, ZR Express, EcoTrack** : non branchés (l'interface est prête). Numéro de suivi saisi à la main.
- **Frais par transporteur** : une seule grille par commerçant pour l'instant.
- **Argent reversé par le transporteur** : une commande livrée marque la facture payée ; le suivi des versements du transporteur est pour plus tard.
- **Étiquette d'expédition** et bordereau du jour : plus tard.
- **Écran d'administration des wilayas** : à l'étape 7.
- Par rapport au schéma de l'étape 0 : le colis fait partie de la commande (pas de table `colis` à part), et les articles de la commande sont les lignes de son devis (pas de table `lignes_commande`). Une information n'existe ainsi qu'à un seul endroit.
- Le statut « nouvelle » est réservé aux commandes de la boutique en ligne (étape 6).
- Correction faite en passant dans l'étape 3 : une facture « Envoi » refusée faute de stock pouvait laisser un document à moitié écrit ; le stock est maintenant vérifié avant toute écriture.

## À essayer par le propriétaire

1. Réglages › Livraison : ajouter votre transporteur, puis remplir les frais (« Remplir toutes les wilayas », puis corriger votre wilaya).
2. Commandes › Nouvelle commande : saisir une vraie commande en chronométrant (objectif : moins de 30 secondes).
3. Toucher « Pas de réponse » deux fois, puis « Envoi : préparer le colis ».
4. Avec un compte préparateur : « Colis prêt », puis « Colis expédié » avec un numéro de suivi.
5. Marquer « Colis retourné » ; vérifier que le stock est revenu et que l'avoir est créé.
6. Créer une nouvelle commande avec le même numéro de téléphone : l'alerte rouge doit apparaître dès la saisie du numéro.
7. Ouvrir Clients, chercher ce client : taux de retour, total dépensé, historique.
8. Refaire le tout en arabe.

## Liens entre les modules construits

```
             saisie au téléphone (et boutique, étape 6)
                          │
                          ▼
   CLIENT ◄────────── COMMANDE ──────────► DEVIS (articles + frais de livraison, stock réservé)
 (téléphone,           │  │  appels, historique          │ « Confirmer » : Envoi ou Vente directe
  alerte retours)      │  │                               ▼
                       │  └──────────────────────────► FACTURE (réservation reprise, ou stock sorti)
                       │      expédiée : stock sorti ───────┤
                       │      livrée : facture payée ───────┤
                       │      retournée / annulée ──────► AVOIR (stock remis ou libéré)
                       ▼
          TRANSPORTEUR + numéro de suivi        FRAIS PAR WILAYA (69 wilayas)

   CAISSE ──► TICKET ou FACTURE ◄── DEVIS ◄── saisie manuelle ; PROFORMA ─► BON DE COMMANDE ─► BON DE LIVRAISON
   Tous écrivent des MOUVEMENTS DE STOCK reliés au document.
```

Depuis une commande, on ouvre son client, son devis, sa facture et son avoir ; depuis la facture, on revient à la commande ; depuis le client, toutes ses commandes et tous ses documents.
