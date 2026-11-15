# État du projet

Dernière mise à jour : 15/11/2026, fin de l'étape 0.

## Où on en est

- **Étape 0 (plan, schéma, maquettes) : livrée, en attente de la validation du propriétaire.**
- Aucun code d'application n'existe encore. Le dépôt ne contient que de la documentation.
- Branche de travail : `claude/admiring-euler-s5selq`. `main` contient la même chose (le propriétaire a demandé que le nouveau projet remplace l'ancien sur `main`).

## Prochaine action

1. Attendre la réponse du propriétaire sur l'étape 0 et sur les questions ci-dessous.
2. Reporter ses décisions dans `docs/etape-0/` et dans le journal.
3. Commencer l'étape 1 (socle) : d'abord la recherche du module (comptes, invitations, isolation), la liste « indispensable / utile / plus tard », sa validation, puis le code.

## Questions posées au propriétaire, sans réponse pour l'instant

1. Nom du produit : « Hanout » convient-il ?
2. Boutique en ligne sans registre du commerce (loi 18-05) : simple avertissement ou blocage de la mise en ligne ?
3. Droit de timbre : accord pour un réglage par tranches, à faire confirmer par un comptable ?
4. Ajout du total en lettres sur les factures ; facture récapitulative et bon de transfert classés « plus tard » : d'accord ?
5. PDF produits par Chromium côté serveur (arabe fiable, 300 Mo de plus) : d'accord ?
6. Une commande de la boutique est un seul objet (le devis) vu dans Commandes et dans Devis : d'accord ?
7. Maquettes : couleurs, police et disposition conviennent-elles ?

## Points à vérifier plus tard (sources officielles non joignables le 15/11/2026)

- Liste complète des mentions du décret 05-468 et règles de la facture d'avoir (`commerce.gov.dz`).
- Tranches exactes du droit de timbre et taux de TVA en vigueur.
- Délai de retour de la loi 18-05.
- Paramètres Argon2id sur la page OWASP ; numérotation exacte des wilayas 59 à 69 et communes.
- Dernière version stable de PostgreSQL ; compatibilité TypeScript 7 avec Next.js 16.

## Où trouver quoi

| Fichier | Contenu |
|---|---|
| `docs/CAHIER-DES-CHARGES.md` | La demande complète du propriétaire |
| `docs/etape-0/01-recherche.md` | Recherche et sources, contradictions signalées |
| `docs/etape-0/02-plan.md` | Outils, architecture, règles, liens entre modules, étapes |
| `docs/etape-0/03-schema.md` | Schéma de la base |
| `docs/etape-0/maquettes.html` | Cinq maquettes, français/arabe, clair/sombre |
| `docs/journal/JOURNAL.md` | Historique daté |
