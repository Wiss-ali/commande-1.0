# Étape 3 — Recherche : caisse, factures et documents

Recherche faite le 17/11/2026. Comme convenu, le code est lancé sans attendre la validation de la liste.
Les sites `commerce.gov.dz` et `legal-doctrine.com` restent injoignables depuis la session : les points
légaux viennent de résumés et sont marqués **à vérifier**. Aucun taux ni mention n'est écrit dans le code.

## 1. Ce que dit la réglementation algérienne

| Sujet | Ce qui a été trouvé | Effet dans l'application |
|---|---|---|
| Facture | Décret exécutif 05-468 : identité du vendeur et de l'acheteur, numéro d'ordre et date, désignation et quantité, mode et date de paiement, prix total TTC en chiffres et en lettres. Il couvre aussi le bon de livraison, le bon de transfert et la facture récapitulative. [Ministère du Commerce](https://commerce.gov.dz/fr/questions-frequentes/themes/facture) | La facture porte toutes ces mentions. Celles du vendeur sont copiées et figées au moment de l'émission |
| Vente au consommateur | Loi 04-02, article 10 (texte de 2004) : la vente au consommateur fait l'objet d'un ticket de caisse ou d'un bon ; la facture est délivrée si le client la demande. L'article a été réécrit en 2010. [Journal officiel 2004](https://archive.gazettes.africa/archive/dz/2004/dz-government-gazette-dated-2004-06-27-no-41.pdf) | La caisse sort un ticket par défaut, et une facture sur demande |
| TVA | La loi de finances 2026 cite un taux réduit de 9 % ; le taux normal n'a pas été retrouvé dans une source officielle. [Deloitte](https://blog.avocats.deloitte.fr/algerie-les-principales-mesures-de-la-loi-de-finances-pour-2026/) | Chaque commerçant dit s'il facture la TVA et à quel taux ; le taux peut changer par produit. Aucun taux par défaut |
| Droit de timbre | Depuis la loi de finances 2025 (article 46), le calcul se fait par tranches et vise les paiements en espèces. Le barème exact n'a pas pu être vérifié. [Legal Doctrine](https://legal-doctrine.com/edition/reamenagement-du-mode-de-calcul-du-droit-de-timbre-de-quittance-une-reforme-fiscale-importante-b8cda97cd9e7d45028f7b4fa96c01bc6) | Le barème est un tableau que **vous** saisissez dans l'administration. Tant qu'il est vide, aucun timbre n'est ajouté. Chaque commerçant choisit de l'appliquer ou non |
| Facture d'avoir | Aucune source algérienne précise. Règle générale : l'avoir cite le numéro et la date de la facture corrigée, avec sa propre numérotation continue | L'avoir a sa numérotation, cite la facture d'origine et garde le lien |

**À vérifier avec un comptable avant la mise en vente** : la liste complète des mentions (cachet, signature, capital social), le taux normal de TVA, le barème du timbre et s'il s'applique aux tickets de caisse, les règles de l'avoir.

## 2. Ce que font les meilleurs outils

- Caisse : panier rempli par scan ou recherche, total toujours visible, monnaie à rendre calculée, ticket immédiat. Les logiciels algériens ajoutent des droits par rôle et un rapport de clôture par caisse et par utilisateur. [Zoom Algérie](https://zoomalgerie.com/logiciel-caisse-pos-algerie/)
- Clôture : on compte les espèces **avant** de voir le montant attendu, l'écart est gardé dans le rapport, et le rapport ne se modifie plus. [Sage](https://www.sage.com/fr-fr/blog/glossaire/cloture-de-caisse-z-de-caisse-definition-de-la-cloture-et-du-z-de-caisse/), [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/comptabilite/ticket-z)

## 3. Choix techniques

- **Prix de vente = prix payé par le client (TTC).** La facture en déduit le prix hors taxe et la TVA, ligne par ligne. C'est la façon de penser d'un commerçant de détail, et les prix affichés doivent être TTC.
- **Numérotation** : un compteur par commerçant, par type de document et par année, pris dans la même transaction que le document. Un document refusé ne consomme donc jamais de numéro.
- **Documents figés** : la base refuse toute modification d'un document émis (sauf un devis en attente) et toute suppression.
- **PDF** : page HTML convertie par Chromium, seul moyen fiable d'avoir un arabe correct. Chromium est lancé en ligne de commande, sans bibliothèque supplémentaire.
- **Vente sans stock connu** (décision du 17/11/2026) : la vente passe, le stock connu sort jusqu'à zéro, et le manque est noté dans une liste « Stock à vérifier » pour le propriétaire.
- **Caisse hors connexion** : le catalogue est chargé dans le téléphone à l'ouverture de la caisse ; une vente faite sans connexion est gardée dans le téléphone puis envoyée, avec une clé qui empêche tout doublon.

## 4. Fonctions

### Indispensable (cette étape)

- Caisse : scan, recherche, panier, espèces, monnaie à rendre, ticket ou facture.
- Vente, stock et document écrits dans une seule transaction.
- Facture avec toutes les mentions, total en lettres, TVA par produit, droit de timbre réglable.
- Numérotation continue sans trou ; facture non modifiable ; correction par avoir.
- Devis (numérotation séparée, modifiable tant qu'il n'est pas transformé), « Transformer en facture », puis « Envoi » ou « Vente directe ».
- Proforma, bon de commande, bon de livraison, reçu de paiement ; chaque document se transforme en suivant sans ressaisie et garde ses liens.
- PDF en français ou en arabe, partage par WhatsApp.
- Clôture de caisse (demande ajoutée à l'étape 0).

### Utile (cette étape)

- Caisse qui continue sans connexion.
- Client enregistré depuis une facture (nom, téléphone, numéros légaux), téléphone chiffré.
- Liste « Stock à vérifier ».

### Plus tard

- Remises et prix négociés à la caisse.
- Facture récapitulative, bon de transfert (décidé à l'étape 0).
- Vente à crédit et paiements partiels (version 2).
- Impression directe sur imprimante à tickets sans passer par le PDF.
- Suivi des colis pour les factures « Envoi » : étape 4.
