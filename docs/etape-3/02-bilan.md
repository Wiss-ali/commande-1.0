# Étape 3 — Bilan : caisse, factures et documents

Terminée le 17/11/2026. En attente de la validation du propriétaire.

## Fait

| Fonction | Où |
|---|---|
| Caisse : recherche ou scan, panier, total toujours visible, monnaie à rendre, ticket ou facture | `/caisse` |
| Vente, stock et document écrits ensemble : tout réussit ou rien ne change | `src/lib/documents.ts` (`creerDocument`) |
| La vente passe même si le stock connu manque ; le produit est noté « Stock à vérifier » | caisse, puis `/stock` |
| Caisse sans connexion : la vente est gardée dans le téléphone, puis envoyée une seule fois | `src/components/Caisse.tsx` |
| Clôture de caisse : fond de caisse, comptage avant de voir le montant attendu, écart gardé, rapport figé | `/caisse/cloture` |
| Factures : mentions du vendeur figées, acheteur, TVA par produit, droit de timbre, total en lettres | `/factures` |
| Numérotation continue sans trou, une suite par type de document et par année | table `compteurs_documents` |
| Une facture émise ne se modifie pas et ne se supprime pas : elle s'annule par un avoir (propriétaire seulement) | fiche du document |
| Devis : numérotation séparée, modifiable tant qu'il est en attente, refusé ou rouvert | `/factures?onglet=devis` |
| « Transformer en facture » puis une seule question : « Envoi » ou « Vente directe » | fiche du devis |
| Proforma, bon de commande, bon de livraison, reçu de paiement ; chacun se transforme en suivant sans ressaisie | fiche du document |
| Liens entre documents, dans les deux sens, ouverts d'un toucher | fiche du document |
| PDF en français ou en arabe (facture, ticket 80 mm et les autres), partage par WhatsApp ou e-mail | boutons de la fiche |
| Client enregistré depuis une facture ; téléphone et numéros légaux chiffrés | table `clients` |
| Réglages du commerçant : TVA (oui ou non, taux par défaut, taux par produit), timbre, texte des documents | `/reglages/facturation` |
| Barème du droit de timbre saisi par l'administrateur, vide au départ | `/admin/reglages` |

## Règles garanties par la base de données elle-même

- Un numéro n'est pris que si le document est vraiment écrit : aucun trou, même si deux ventes arrivent en même temps ou si l'une échoue.
- Un document émis est figé (totaux, lignes, date, numéro). Seuls changent l'état d'un devis et la date de paiement d'une facture, une seule fois.
- Aucun document ne peut être supprimé.
- Une clôture de caisse ne se modifie plus.
- Les sept nouvelles tables sont isolées par commerçant (RLS activée et forcée).
- Le téléphone, l'adresse et les numéros légaux des acheteurs, ainsi que les mentions figées, sont chiffrés.

## Tests automatiques

- **97 tests** unitaires et d'intégration, dont 22 nouveaux : vente en une transaction, prix toujours pris dans la fiche (jamais dans le téléphone), numérotation sans trou sous 12 ventes simultanées, facture figée même en écrivant directement dans la base, avoir, envoi et réservation, chaîne devis → proforma → bon de livraison → facture, clôture, TVA, timbre, montant en lettres en français et en arabe, isolation.
- **36 parcours de bout en bout**, dont 14 nouveaux sur un écran de 360 px : vente avec scan, facture, vente hors connexion, avoir, devis, envoi, clôture au dinar près, droits de la vendeuse, PDF réel, arabe sombre, isolation entre commerçants, barème du timbre côté administrateur.
- `npm audit` : aucune faille connue. Captures : `docs/etape-3/captures/`.

## Défauts trouvés et corrigés pendant les tests

- Dans les PDF en arabe, la devise s'affichait du mauvais côté du montant, et une adresse écrite en français voyait son numéro déplacé.
- À la caisse, le bouton « Encaisser » écrasait le total sur un petit écran.

## Pas fait, ou différent du plan

- **À saisir par vous avant la mise en vente** : le barème du droit de timbre (dans l'administration) et, pour chaque commerçant, son taux de TVA. Rien n'est supposé : tant que c'est vide, il n'y a ni timbre ni TVA.
- **« Envoi »** : la facture est créée, le stock est réservé et la facture attend son paiement. Le suivi du colis (transporteur, statuts, retour) est l'étape 4.
- **Avoir** : il annule toute la facture. L'avoir partiel (une seule ligne) est pour plus tard.
- **Devis expiré** : l'état existe, mais le passage automatique après la date de validité arrivera avec les tâches de fond (étape 6).
- **Hors connexion** : la caisse doit avoir été ouverte avant la coupure. Une vente gardée est enregistrée au prix de la fiche au moment de l'envoi.
- **Imprimante à tickets** : le ticket est un PDF de 80 mm de large, à imprimer depuis le téléphone ou l'ordinateur.
- **Remises** : pas à la caisse. Dans un devis, le prix de chaque ligne se négocie.
- **Écran Clients** : les clients sont enregistrés, leur écran arrive à l'étape 4.
- Par rapport au schéma de l'étape 0 : pas de table `ventes` (le document porte déjà le vendeur, le mode et la date : une information à un seul endroit), et les PDF sont produits à la demande au lieu d'être stockés.
- PDF : produits ici par le Chromium de l'environnement de travail ; l'installation dans Docker est écrite mais non testée (étape 8).

## À essayer par le propriétaire

1. Faire une vente à la caisse avec deux produits, taper le montant reçu, vérifier la monnaie, ouvrir le ticket PDF.
2. Demander une facture à la caisse ; ouvrir son PDF en français puis en arabe ; le partager par WhatsApp.
3. Vendre plus que le stock connu ; retrouver le produit dans « Stock à vérifier ».
4. Couper le Wi-Fi et les données du téléphone, faire une vente, remettre la connexion : la vente doit partir toute seule, une seule fois.
5. Créer un devis, le modifier, puis « Transformer en facture » : essayer « Vente directe », puis « Envoi » sur un autre devis.
6. Annuler une facture par un avoir ; vérifier que le stock revient.
7. Clôturer la caisse le soir : compter, puis lire le rapport.
8. Dans Réglages › Facturation, activer la TVA avec votre comptable et regarder une facture.
9. Dans l'administration, saisir le barème du timbre.

## Liens entre les modules construits

```
   CAISSE ──► TICKET ou FACTURE ◄── « Transformer » ◄── DEVIS ◄── saisie manuelle
     │              │   │                               PROFORMA ─► BON DE COMMANDE ─► BON DE LIVRAISON
     │              │   └─► AVOIR (annule) ──► remet le stock, rend les espèces
     │              └─────► REÇU (paiement d'une facture « Envoi »)
     ▼
 JOURNÉE DE CAISSE ──► CLÔTURE (attendu, compté, écart)

 Chaque vente écrit des MOUVEMENTS DE STOCK (sortie, réservation, retour) reliés au document.
 Stock manquant ──► « STOCK À VÉRIFIER » dans le module Stock.
 Facture ──► CLIENT (retrouvé par son téléphone).
```

Depuis un document, on ouvre ceux dont il vient et ceux qu'il a créés. Depuis « Stock à vérifier », on ouvre le produit.
