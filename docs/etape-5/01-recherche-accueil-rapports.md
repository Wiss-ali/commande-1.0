# Étape 5 — Recherche : accueil, rapports, export pour le comptable

Recherche faite le 17/11/2026 (résumés des moteurs de recherche ; les sites eux-mêmes ne s'ouvrent pas depuis
l'environnement de travail).

## 1. Ce que proposent les outils du domaine

- Les logiciels de caisse montrent un tableau de bord avec le chiffre d'affaires, la marge, le panier moyen, les
  meilleurs et les moins bons produits, et les ventes par vendeur ; le détail est un niveau plus bas.
  Sources : [tool-advisor — logiciels de caisse](https://tool-advisor.fr/logiciel-de-caisse/comparatif/logiciel-de-caisse-commerce-de-detail/),
  [Lightspeed — indicateurs du commerce de détail](https://www.lightspeedhq.com/ch/blog/les-indicateurs-du-commerce-de-detail-a-connaitre-7-indicateurs-a-surveiller/),
  [Skello — indicateurs d'un commerce](https://www.skello.io/blog/apprenez-a-lire-les-indicateurs-de-performance-de-votre-commerce).
- Pour un petit commerce, quatre chiffres suffisent : chiffre d'affaires, marge, panier moyen, et un indicateur
  d'activité. Marge = ventes − coût d'achat ; taux de marque = marge / ventes.
  Source : [Toucan Toco — tableau de bord retail](https://toucantoco.com/blog/ameliorer-pilotage-ventes-grace-reporting/).
- Vente à la livraison (étape 4) : les outils algériens suivent le taux de confirmation, le taux de livraison et
  les retours par wilaya, car le retour coûte la livraison aller (et souvent le retour).
  Source : [dzbuild — réduire les retours](https://dzbuild.com/blog/reduce-cod-return-rate-algeria).

## 2. Ce que demande la réglementation

- Durée de conservation des factures en Algérie : **non confirmée par la recherche** (les résultats ne portaient que
  sur le droit français, 10 ans). Le cahier des charges prévoit 10 ans par défaut, réglables par l'administrateur :
  c'est gardé, à faire confirmer par un comptable. Une facture n'est jamais supprimée.
- Le comptable doit pouvoir utiliser l'export tel quel : documents numérotés, dates, totaux hors taxe, TVA,
  timbre, toutes taxes comprises, mode de paiement, et les avoirs qui annulent des factures.
- Les fichiers d'export contiennent des données personnelles (noms et téléphones des clients, loi 18-07) :
  export réservé au propriétaire et noté dans le journal des actions sensibles.

## 3. Fichiers lisibles dans Excel

- Excel en français attend le **point-virgule** comme séparateur et lit mal les accents sans le **BOM UTF-8**.
  Les montants s'écrivent avec une virgule décimale. Sources : [Qualtrics](https://www.qualtrics.com/support/fr/survey-platform/contacts/csv-upload-issues),
  [cococonvert — caractères spéciaux](https://cococonvert.com/blog/excel-csv-special-characters).
- Sécurité : une cellule qui commence par `=`, `+`, `-` ou `@` peut être prise pour une formule (injection de
  formule, OWASP) : ces textes sont précédés d'une apostrophe.

## 4. Fonctions proposées

### Indispensable (fait à cette étape)

1. Accueil : quatre chiffres au plus — ventes du jour, commandes à confirmer, colis en route, produits en stock bas. Chaque rôle ne voit que ce qui le concerne.
2. Une carte par module actif, avec un seul chiffre utile ; la carte Boutique dit « Désactivée » tant que la boutique n'est pas en ligne.
3. Un seul graphique : les ventes sur 7 ou 30 jours (barres), avec un tableau caché lisible par les lecteurs d'écran.
4. Liste « À faire » cliquable : commandes à confirmer, colis à expédier, stock à vérifier, ruptures, devis en attente, caisse pas clôturée depuis un jour passé, archive du mois à télécharger.
5. Rapports (propriétaire) avec une période au choix (7 jours, 30 jours, ce mois, mois dernier, cette année) :
   - **Marge réelle** = ventes hors taxe − coût d'achat − livraison payée au transporteur (y compris pour les colis retournés) ; factures annulées par un avoir retirées ;
   - **Commandes** : taux de confirmation et taux de livraison ;
   - **Retours par wilaya** ;
   - **Meilleurs produits** (quantité, ventes, marge).
   Un graphique par écran, le chiffre clé écrit au-dessus.
6. Export pour le comptable : une archive ZIP pour la période choisie avec un PDF par document (factures, avoirs, tickets, reçus) et des fichiers CSV lisibles dans Excel : documents, lignes vendues, stock, clients.
7. Rappel mensuel dans « À faire » : télécharger l'archive du mois précédent.

### Utile (fait si simple)

- Panier moyen sous le chiffre des ventes du jour.
- Taux de marque à côté de la marge.

### Plus tard

- Coût réel de livraison différent du prix facturé au client (réglage par transporteur).
- Comparaison avec la période précédente.
- Rapports par vendeur.
- Export automatique envoyé par e-mail chaque mois (étape 8, avec les tâches de fond).
