# État du projet

Dernière mise à jour : 18/11/2026 — revue d'ensemble : sécurité de la connexion, caisse en grille, menu sur ordinateur, langue dans « Plus ».

## Où on en est

- **Les 8 étapes sont construites et testées.** Étapes 0 à 7 validées par le propriétaire ; il a choisi de tout vérifier à la fin.
- **Étape 8 (sécurité, installation, exploitation) : terminée.** Bilan : `docs/etape-8/02-bilan.md`.
- **À faire par le propriétaire maintenant** : `docs/VERIFICATION-FINALE.md` (tout ce qu'il faut essayer, et les questions à trancher), en installant d'abord le serveur avec `docs/GUIDE-INSTALLATION.md`.
- **`main` est à jour** : identique à la branche de travail `claude/vigilant-gates-3k9mjn`. Le guide installe depuis `main`.
- **Essai en ligne (18/11/2026)** : VPS Contabo `155.133.198.241` (hors d'Algérie, données de démonstration seulement), copie de test en service sur `https://test.155-133-198-241.sslip.io`, compte administrateur créé. **Le site réel (`./deployer.sh prod`) n'est pas encore lancé** ; alertes ntfy et `installer.sh cron` pas encore faits. Les secrets restent sur le serveur (`/srv/hanout/deploiement/secrets/`) ; la clé privée de sauvegarde de prod est copiée chez le propriétaire mais **pas encore effacée du serveur**.
- **Notifications (18/11/2026)** : ouvrir une notification la marque comme lue (migration 0010). À mettre sur le serveur avec la même commande que ci-dessous.
- **Revue d'ensemble (18/11/2026)**, branche `claude/wizardly-newton-jszkps` (pas encore dans `main`) : un inconnu ne peut plus bloquer le compte d'un commerçant (blocage par adresse ou appareil, appareils reconnus), code de double authentification à usage unique (migration 0011), caisse avec la grille de tous les produits (les plus vendus en haut), menu complet sur ordinateur, langue choisie dans « Plus ». `deployer.sh` rappelle d'effacer la clé privée tant qu'elle est sur le serveur. Détail dans le journal.
- **Refonte visuelle (18/11/2026)** : blanc, contours bleutés, bleu principal, sombre bleu nuit, police Inter. Voir `docs/refonte-visuelle/01-recherche.md`. Pour l'avoir sur le serveur : `cd /srv/hanout && git pull && cd deploiement && ./deployer.sh test`.

## Façon de travailler (décidée par le propriétaire le 16/11/2026)

- La recherche avant chaque module est faite et écrite dans `docs/etape-N/`, puis le code est lancé **sans attendre** la validation de la liste.
- On s'arrête toujours à la fin de chaque étape, avec le bilan et la liste « à essayer ».
- **Décision du 17/11/2026** : le propriétaire vérifiera tout à la fin, et répondra aux questions ouvertes à la fin aussi.
  En attendant, chaque question ouverte suit le choix par défaut ci-dessous (prudent et réversible). Les bilans
  et la liste « à essayer » de chaque étape restent écrits, pour la vérification finale.

## Prochaine action

0. Faire valider par le propriétaire la revue du 18/11 (branche `claude/wizardly-newton-jszkps`), la mettre dans `main` avec son accord, puis sur le serveur (`git pull` puis `./deployer.sh test`). **Le propriétaire doit effacer la clé privée du serveur** : `rm /srv/hanout/deploiement/secrets/*/CLE-PRIVEE-A-RECUPERER.asc` (après avoir vérifié qu'il en a bien une copie).
1. Faire mettre à jour la copie de test du VPS (`git pull` puis `./deployer.sh test`), recueillir l'avis du propriétaire sur le nouveau design, puis lancer `./deployer.sh prod`, `./outils.sh prod admin …`, les alertes ntfy et `./installer.sh cron`, et faire effacer les clés privées du serveur.
2. Obtenir les réponses du propriétaire aux questions de `docs/VERIFICATION-FINALE.md` (en particulier : longueur des mots de passe des commerçants). Proposition faite pour un essai gratuit : Oracle Cloud « Always Free » + adresse sslip.io, avec des données de démonstration seulement.
3. Aider le propriétaire à louer le serveur et à suivre le guide ; corriger ce que l'installation réelle révèle (image Debian + Chromium, Let's Encrypt, second serveur, notifications sur un vrai téléphone).
4. Puis, selon ses retours : bouton « Commandes » dans la barre du bas, client reconnu à son numéro dans une nouvelle commande, liste des communes (propositions de la revue, laissées de côté pour l'instant) ; avoir partiel, versements du transporteur, facture d'abonnement, rappels par SMS, script de re-chiffrement des données, alertes sur comportements suspects.

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

La liste à jour et complète est dans `docs/VERIFICATION-FINALE.md` (section « Questions à trancher »). Ci-dessous, l'historique.

Choix par défaut appliqués : 1 → rien n'est ajouté tant que ce n'est pas saisi ; 2 → plus tard ; 3 → guide
d'installation et serveur de test préparés à l'étape 8 ; 4 → plus tard ; 5 → mise à jour dès qu'une correction sort.

1. **Barème du droit de timbre et taux de TVA** : à faire confirmer par un comptable, puis à saisir (timbre : Administration › Réglages fiscaux ; TVA : Réglages › Facturation de chaque commerçant). Tant que c'est vide, aucune taxe n'est ajoutée.
2. **Avoir partiel** (annuler une seule ligne d'une facture) : utile tout de suite, ou plus tard ?
3. **Comment le propriétaire essaie l'application** : il n'a pas Docker, et l'aperçu de la session précédente ne s'est pas affiché chez lui. Lui proposer : (a) un pas-à-pas pour installer sur son ordinateur (Windows ou Mac), ou (b) avancer une partie de l'étape 8 pour mettre un petit serveur de test en ligne, à essayer sur son vrai téléphone (scan, installation sur l'écran d'accueil). Lui demander son choix.
4. **Argent reversé par le transporteur** : aujourd'hui, « Livré et payé » marque la facture payée. Faut-il suivre aussi le jour où le transporteur vous reverse l'argent (versements groupés) ?
5. **Sécurité des dépendances** : `picomatch` a une alerte sans correction publiée (outils de développement seulement ; vérifié de nouveau le 18/11/2026, toujours aucune version corrigée) ; à mettre à jour dès que possible.
6. ~~Modules par abonnement~~ : **tranché le 17/11/2026** (par formule avec retouche ; boutique = module comme les autres) et fait à l'étape 7.

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
- Image Docker avec le Chromium de Debian (essayée ici avec une image de base équivalente, car les dépôts Debian sont bloqués dans l'environnement de travail).
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
| `docs/etape-7/01-recherche-administration.md` | Recherche et liste des fonctions de l'étape 7 |
| `docs/etape-7/02-bilan.md` | Bilan de l'étape 7 : fait, pas fait, à essayer, liens |
| `docs/etape-8/01-recherche-securite-exploitation.md` | Recherche de l'étape 8 |
| `docs/etape-8/02-bilan.md` | Bilan de l'étape 8 : installation essayée, défauts corrigés |
| `docs/etape-8/03-asvs.md` | Sécurité : OWASP ASVS niveau 2 et Top 10, couvert ou non |
| `docs/GUIDE-INSTALLATION.md` | Guide pas à pas : louer, installer, mettre à jour, restaurer, alertes |
| `docs/VERIFICATION-FINALE.md` | Tout ce que le propriétaire doit essayer, et les questions à trancher |
| `deploiement/` | Fichiers et scripts de production (Docker, Caddy, sauvegardes, mise à jour) |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
