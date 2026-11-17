# État du projet

Dernière mise à jour : 17/11/2026, fin de l'étape 4.

## Où on en est

- **Étape 0 : validée.**
- **Étape 1 (socle) : terminée.** Bilan : `docs/etape-1/02-bilan.md`.
- **Étape 2 (produits, stock, scan) : validée le 17/11/2026.** Bilan : `docs/etape-2/02-bilan.md`.
- **Étape 3 (caisse, factures, documents) : validée le 17/11/2026** (« reprends et continue »). Bilan : `docs/etape-3/02-bilan.md`.
- **Étape 4 (commandes à livrer, colis, clients) : terminée et testée, en attente de la validation du propriétaire.** Bilan : `docs/etape-4/02-bilan.md`.
- Prochaine étape : **étape 5, accueil et rapports** (tableau de bord, marge réelle, taux de confirmation et de livraison, retours par wilaya, meilleurs produits, export pour le comptable).
- Branche de travail : `claude/vigilant-gates-3k9mjn` (elle contient tout `claude/adoring-ptolemy-sn6zzz`). `main` est en retard : il s'arrête à la fin de l'étape 1 (à mettre à jour quand le propriétaire le confirme).

## Façon de travailler (décidée par le propriétaire le 16/11/2026)

- La recherche avant chaque module est faite et écrite dans `docs/etape-N/`, puis le code est lancé **sans attendre** la validation de la liste.
- On s'arrête toujours à la fin de chaque étape, avec le bilan et la liste « à essayer ».

## Prochaine action

1. Obtenir la validation de l'étape 4.
2. Étape 5 : recherche (tableaux de bord des logiciels de caisse et d'e-commerce, indicateurs utiles au commerçant, export pour le comptable algérien), liste, puis code.
3. À l'étape 5 : remplacer la page d'attente `src/app/(app)/[module]/page.tsx` pour `rapports` ; la carte Commandes de l'accueil compte les commandes à confirmer (`compterParFiltre` dans `src/lib/commandes.ts`) ; la marge réelle lit `lignes_document.cout_unitaire`, `commandes.frais_livraison` et les avoirs de retour.

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
4. **Argent reversé par le transporteur** : aujourd'hui, « Livré et payé » marque la facture payée. Faut-il suivre aussi le jour où le transporteur vous reverse l'argent (versements groupés) ?

## Magasin de démonstration

`npm run demo` crée (une seule fois) un magasin rempli : propriétaire `0550000001` / `hanout demo`, vendeuse `0550000002` / `hanout vente`, cinq produits, un transporteur, les frais des 69 wilayas et deux commandes. Mots de passe publics : **jamais sur le site réel**. Puis `npm run build` et `npx next start -p 3000`.

## Points à vérifier plus tard (sources officielles non joignables)

- Numérotation des wilayas 59 à 69 (décret 26-206 du 25/05/2026) au Journal officiel, et liste officielle des 1 541 communes à importer dans la table `communes`.
- Loi 18-05 : délai de retour et délai de livraison. Déclaration du traitement des données des acheteurs à l'ANPDP (loi 18-07).

- Liste complète des mentions du décret 05-468 et règles de la facture d'avoir (`commerce.gov.dz`).
- Tranches exactes du droit de timbre et taux de TVA en vigueur.
- Délai de retour de la loi 18-05.
- Paramètres Argon2id sur la page OWASP.
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
| `docs/etape-4/01-recherche-commandes.md` | Recherche et liste des fonctions de l'étape 4 |
| `docs/etape-4/02-bilan.md` | Bilan de l'étape 4 : fait, pas fait, à essayer, liens |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
