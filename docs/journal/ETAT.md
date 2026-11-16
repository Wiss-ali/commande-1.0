# État du projet

Dernière mise à jour : 16/11/2026, fin de l'étape 2.

## Où on en est

- **Étape 0 : validée.**
- **Étape 1 (socle) : terminée.** Le propriétaire a demandé de continuer ; seule remarque : pas de double authentification imposée aux commerçants (elle était déjà facultative). Bilan : `docs/etape-1/02-bilan.md`.
- **Étape 2 (produits, stock, scan) : terminée et testée, en attente de la validation du propriétaire.** Bilan : `docs/etape-2/02-bilan.md`.
- Prochaine étape : **étape 3, caisse, factures PDF, choix « Envoi » ou « Vente directe »**, avec en plus la clôture de caisse.
- Branche de travail : `claude/adoring-ptolemy-sn6zzz`. `main` est en retard : il s'arrête à la fin de l'étape 1 (le propriétaire voulait `main` identique ; à refaire quand il le confirme).

## Façon de travailler (décidée par le propriétaire le 16/11/2026)

- La recherche avant chaque module est faite et écrite dans `docs/etape-N/`, puis le code est lancé **sans attendre** la validation de la liste.
- On s'arrête toujours à la fin de chaque étape, avec le bilan et la liste « à essayer ».

## Prochaine action

1. Obtenir la validation de l'étape 2 et les réponses aux questions ouvertes.
2. Étape 3 : recherche (caisse, ticket, facture, mentions du décret 05-468, droit de timbre, TVA, PDF en arabe par Chromium), liste, puis code.
3. À l'étape 3 : brancher `Scanner` dans la caisse, écrire la vente avec `ajouterMouvement` (type `vente`), ajouter le taux de TVA par produit, remplacer la page d'attente `src/app/(app)/[module]/page.tsx` pour `caisse` et `factures`.

## Pour reprendre le travail dans un nouveau conteneur

```bash
npm install
pg_ctlcluster 16 main start          # si PostgreSQL local est arrêté
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\""   # une fois, si la connexion est refusée
cp .env.example .env                 # puis créer les clés : openssl rand -base64 32
set -a; . ./.env; set +a
npm run db:roles && npm run db:migrer
npm run verifier                     # tout doit passer avant de continuer
```

## Questions ouvertes pour le propriétaire

1. **Qui crée et modifie les produits ?** Aujourd'hui le propriétaire seulement. Faut-il l'ouvrir au vendeur (sans le prix d'achat) ?
2. **Vendre un produit que l'application croit épuisé** : aujourd'hui une sortie est refusée s'il n'y a pas assez de stock. Pour la caisse (étape 3) : refuser la vente, ou la laisser passer en la signalant ?
3. **Mot de passe du propriétaire** : 15 caractères au minimum sans double authentification (recommandation NIST). C'est un réglage : à garder, ou à réduire pour simplifier ?

## Points à vérifier plus tard (sources officielles non joignables)

- Liste complète des mentions du décret 05-468 et règles de la facture d'avoir (`commerce.gov.dz`).
- Tranches exactes du droit de timbre et taux de TVA en vigueur.
- Délai de retour de la loi 18-05.
- Paramètres Argon2id sur la page OWASP ; numérotation exacte des wilayas 59 à 69 et communes.
- Texte exact de l'article 10 du Code de commerce (inventaire annuel) ; état actuel de l'obligation du code-barres ; arrêté sur l'affichage des prix.
- Essai du scan sur de vrais téléphones (Android et iPhone), en HTTPS.

## Où trouver quoi

| Fichier | Contenu |
|---|---|
| `docs/CAHIER-DES-CHARGES.md` | La demande complète du propriétaire |
| `docs/etape-0/` | Recherche, plan, schéma de la base, maquettes |
| `docs/etape-1/` | Recherche et bilan du socle |
| `docs/etape-2/01-recherche-stock.md` | Recherche et liste des fonctions de l'étape 2 |
| `docs/etape-2/02-bilan.md` | Bilan de l'étape 2 : fait, pas fait, à essayer, liens |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
