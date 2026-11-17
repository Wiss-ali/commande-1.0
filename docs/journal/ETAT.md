# État du projet

Dernière mise à jour : 17/11/2026, fin de l'étape 3.

## Où on en est

- **Étape 0 : validée.**
- **Étape 1 (socle) : terminée.** Le propriétaire a demandé de continuer ; seule remarque : pas de double authentification imposée aux commerçants (elle était déjà facultative). Bilan : `docs/etape-1/02-bilan.md`.
- **Étape 2 (produits, stock, scan) : validée le 17/11/2026.** Bilan : `docs/etape-2/02-bilan.md`.
- **Étape 3 (caisse, factures, documents) : terminée et testée, en attente de la validation du propriétaire.** Bilan : `docs/etape-3/02-bilan.md`.
- Prochaine étape : **étape 4, commandes à livrer et suivi des colis** (avec l'écran Clients).
- Branche de travail : `claude/adoring-ptolemy-sn6zzz`. `main` est en retard : il s'arrête à la fin de l'étape 1 (le propriétaire voulait `main` identique ; à refaire quand il le confirme).

## Façon de travailler (décidée par le propriétaire le 16/11/2026)

- La recherche avant chaque module est faite et écrite dans `docs/etape-N/`, puis le code est lancé **sans attendre** la validation de la liste.
- On s'arrête toujours à la fin de chaque étape, avec le bilan et la liste « à essayer ».

## Prochaine action

1. Obtenir la validation de l'étape 3.
2. Étape 4 : recherche (transporteurs algériens, frais par wilaya, point relais, statuts d'un colis, liste officielle des 69 wilayas et des communes), liste, puis code.
3. À l'étape 4 : construire la commande à partir d'une facture « Envoi » (stock déjà réservé, voir le journal), le colis, les tentatives d'appel, l'alerte sur un téléphone qui a déjà des retours, l'écran Clients ; remplacer la page d'attente `src/app/(app)/[module]/page.tsx` pour `commandes` et `clients`.

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

1. **Barème du droit de timbre et taux de TVA** : à faire confirmer par un comptable, puis à saisir (timbre : Administration › Réglages fiscaux ; TVA : Réglages › Facturation de chaque commerçant). Tant que c'est vide, aucune taxe n'est ajoutée.
2. **Avoir partiel** (annuler une seule ligne d'une facture) : utile tout de suite, ou plus tard ?
3. **Comment le propriétaire essaie l'application** : il n'a pas Docker, et l'aperçu de la session précédente ne s'est pas affiché chez lui. Lui proposer : (a) un pas-à-pas pour installer sur son ordinateur (Windows ou Mac), ou (b) avancer une partie de l'étape 8 pour mettre un petit serveur de test en ligne, à essayer sur son vrai téléphone (scan, installation sur l'écran d'accueil). Lui demander son choix.

## Magasin de démonstration

`npm run demo` crée (une seule fois) un magasin rempli : propriétaire `0550000001` / `hanout demo`, vendeuse `0550000002` / `hanout vente`, cinq produits. Mots de passe publics : **jamais sur le site réel**. Puis `npm run build` et `npx next start -p 3000`.

## Points à vérifier plus tard (sources officielles non joignables)

- Liste complète des mentions du décret 05-468 et règles de la facture d'avoir (`commerce.gov.dz`).
- Tranches exactes du droit de timbre et taux de TVA en vigueur.
- Délai de retour de la loi 18-05.
- Paramètres Argon2id sur la page OWASP ; numérotation exacte des wilayas 59 à 69 et communes.
- Texte exact de l'article 10 du Code de commerce (inventaire annuel) ; état actuel de l'obligation du code-barres ; arrêté sur l'affichage des prix.
- Essai du scan sur de vrais téléphones (Android et iPhone), en HTTPS.
- Mentions complètes de la facture (cachet, signature, capital social), règles de l'avoir, timbre sur les tickets de caisse : à confirmer avec un comptable.
- Production des PDF dans l'image Docker (Chromium installé par le Dockerfile, non testé).

## Où trouver quoi

| Fichier | Contenu |
|---|---|
| `docs/CAHIER-DES-CHARGES.md` | La demande complète du propriétaire |
| `docs/etape-0/` | Recherche, plan, schéma de la base, maquettes |
| `docs/etape-1/` | Recherche et bilan du socle |
| `docs/etape-2/01-recherche-stock.md` | Recherche et liste des fonctions de l'étape 2 |
| `docs/etape-2/02-bilan.md` | Bilan de l'étape 2 : fait, pas fait, à essayer, liens |
| `docs/etape-3/01-recherche-caisse-factures.md` | Recherche et liste des fonctions de l'étape 3 |
| `docs/etape-3/02-bilan.md` | Bilan de l'étape 3 : fait, pas fait, à essayer, liens |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
