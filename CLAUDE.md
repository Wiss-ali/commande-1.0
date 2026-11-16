# Instructions pour toute session Claude sur ce dépôt

Ce dépôt contient une application de gestion multi-commerçants pour l'Algérie (stock, caisse,
factures, commandes, boutique en ligne). Le travail se fait par étapes, sur plusieurs sessions.

## À lire avant toute action, dans cet ordre

1. `docs/journal/ETAT.md` : où en est le projet, quelle est la prochaine action, ce qui attend une réponse du propriétaire.
2. `docs/CAHIER-DES-CHARGES.md` : la demande complète du propriétaire. Elle fait autorité.
3. `docs/journal/JOURNAL.md` : l'historique daté de ce qui a été fait et décidé.
4. Le dossier `docs/etape-N/` de l'étape en cours.

## Règles permanentes

- Le propriétaire parle français. Lui répondre en français, simplement : il n'est pas développeur.
- Avancer par étapes (0 à 8). S'arrêter à la fin de chaque étape et attendre sa validation.
- Avant chaque module : recherche web avec sources et liste « indispensable / utile / plus tard », écrites dans `docs/etape-N/`. Depuis le 16/11/2026, le propriétaire autorise à coder ensuite sans attendre sa validation de la liste.
- Pas de double authentification imposée aux commerçants (seulement proposée). Elle reste obligatoire pour l'administrateur de la plateforme.
- Aucune règle fiscale ou légale écrite en dur : tout taux ou mention est un réglage.
- Ne jamais coder de paiement par carte. Ne jamais recevoir ni stocker un numéro de carte.
- Aucun texte d'interface écrit en dur : tout passe par les fichiers de traduction (français et arabe).
- En cas d'ambiguïté ou de risque de sécurité : poser la question, ne pas deviner.

## Tenue du journal (obligatoire)

- Après chaque action importante (décision, module terminé, changement de schéma, commit), ajouter une entrée datée en haut de `docs/journal/JOURNAL.md`.
- À chaque fin de session ou d'étape, réécrire `docs/journal/ETAT.md` pour qu'il décrive l'état réel : fait, pas fait, prochaine action, questions ouvertes.
- Committer et pousser le journal avec le travail. Le conteneur est éphémère : ce qui n'est pas poussé est perdu.
