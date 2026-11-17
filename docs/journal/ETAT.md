# État du projet

Dernière mise à jour : 17/11/2026, fin de l'étape 6.

## Où on en est

- **Étapes 0 à 5 : validées** (le propriétaire vérifiera tout à la fin). Bilans dans `docs/etape-N/02-bilan.md`.
- **Étape 6 (boutique en ligne) : terminée et testée.** Bilan : `docs/etape-6/02-bilan.md`.
- Prochaine étape : **étape 7, administration de la plateforme** (commerçants, formules, abonnements mensuels ou annuels, paiements reçus hors application, rappels 7 j et 1 j, délai de 5 jours puis lecture seule, revenu du mois, demandes). **À traiter d'abord avec le propriétaire : les modules par abonnement (question 6).**
- Branche de travail : `claude/vigilant-gates-3k9mjn`. `main` est en retard : il s'arrête à la fin de l'étape 1 (à mettre à jour quand le propriétaire le confirme).

## Façon de travailler (décidée par le propriétaire le 16/11/2026)

- La recherche avant chaque module est faite et écrite dans `docs/etape-N/`, puis le code est lancé **sans attendre** la validation de la liste.
- On s'arrête toujours à la fin de chaque étape, avec le bilan et la liste « à essayer ».
- **Décision du 17/11/2026** : le propriétaire vérifiera tout à la fin, et répondra aux questions ouvertes à la fin aussi.
  En attendant, chaque question ouverte suit le choix par défaut ci-dessous (prudent et réversible). Les bilans
  et la liste « à essayer » de chaque étape restent écrits, pour la vérification finale.

## Prochaine action

1. Étape 7 : parler avec le propriétaire des modules par abonnement (question 6), puis recherche (logiciels SaaS algériens, moyens de paiement hors ligne : CCP, BaridiMob, virement), liste, code.
2. À l'étape 7 : tables `formules`, `abonnements`, `paiements_abonnement` (prévues dans `docs/etape-0/03-schema.md`) ; passage en lecture seule 5 jours après la fin (l'état `lecture_seule` existe déjà et coupe la boutique) ; écran complet des demandes (la liste simple existe dans `/admin`) ; écran d'administration des wilayas.
3. La page d'attente `src/app/(app)/[module]/page.tsx` ne sert plus à aucun module (tous construits) : à supprimer à l'étape 8.

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

## Questions ouvertes pour le propriétaire (réponses attendues à la fin, choix par défaut en attendant)

Choix par défaut appliqués : 1 → rien n'est ajouté tant que ce n'est pas saisi ; 2 → plus tard ; 3 → guide
d'installation et serveur de test préparés à l'étape 8 ; 4 → plus tard ; 5 → mise à jour dès qu'une correction sort.

1. **Barème du droit de timbre et taux de TVA** : à faire confirmer par un comptable, puis à saisir (timbre : Administration › Réglages fiscaux ; TVA : Réglages › Facturation de chaque commerçant). Tant que c'est vide, aucune taxe n'est ajoutée.
2. **Avoir partiel** (annuler une seule ligne d'une facture) : utile tout de suite, ou plus tard ?
3. **Comment le propriétaire essaie l'application** : il n'a pas Docker, et l'aperçu de la session précédente ne s'est pas affiché chez lui. Lui proposer : (a) un pas-à-pas pour installer sur son ordinateur (Windows ou Mac), ou (b) avancer une partie de l'étape 8 pour mettre un petit serveur de test en ligne, à essayer sur son vrai téléphone (scan, installation sur l'écran d'accueil). Lui demander son choix.
4. **Argent reversé par le transporteur** : aujourd'hui, « Livré et payé » marque la facture payée. Faut-il suivre aussi le jour où le transporteur vous reverse l'argent (versements groupés) ?
5. **Sécurité des dépendances** : `picomatch` a une alerte sans correction publiée (outils de développement seulement) ; à mettre à jour dès que possible.
6. **Modules par abonnement (à discuter à l'étape 7, demandé par le propriétaire)** : l'administrateur doit pouvoir choisir les modules d'un compte (ex. caisse + factures seulement). Proposition faite : chaque formule contient une liste de modules, réglable aussi commerçant par commerçant ; le commerçant n'allume que ce que sa formule contient ; la fiche produit reste toujours disponible (sinon la caisse n'a rien à vendre). Boutique : option payante ou comprise ? À trancher à l'étape 7.

## Magasin de démonstration

`npm run demo` crée (une seule fois) un magasin rempli : propriétaire `0550000001` / `hanout demo`, vendeuse `0550000002` / `hanout vente`, cinq produits, un transporteur, les frais des 69 wilayas, deux commandes et la boutique en ligne `/b/magasin-demo`. Mots de passe publics : **jamais sur le site réel**. Puis `npm run build` et `npx next start -p 3000`.

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
- Notifications sur un vrai téléphone (Android et iPhone installé), avec des clés VAPID sur le serveur réel.
- Sous-domaines des boutiques : DNS et certificat « *.domaine » à l'installation.

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
| `docs/etape-5/01-recherche-accueil-rapports.md` | Recherche et liste des fonctions de l'étape 5 |
| `docs/etape-5/02-bilan.md` | Bilan de l'étape 5 : fait, pas fait, à essayer, liens |
| `docs/etape-6/01-recherche-boutique.md` | Recherche et liste des fonctions de l'étape 6 |
| `docs/etape-6/02-bilan.md` | Bilan de l'étape 6 : fait, pas fait, à essayer, liens |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
