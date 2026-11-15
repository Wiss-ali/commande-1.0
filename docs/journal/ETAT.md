# État du projet

Dernière mise à jour : 15/11/2026, fin de l'étape 1.

## Où on en est

- **Étape 0 : validée.**
- **Étape 1 (socle) : terminée et testée, en attente de la validation du propriétaire.** Bilan : `docs/etape-1/02-bilan.md`.
- Prochaine étape : **étape 2, produits, stock et scan**, avec en plus l'import de produits depuis Excel.
- Branche de travail : `claude/admiring-euler-s5selq`. `main` est tenu identique, à la demande du propriétaire.

## Prochaine action

1. Obtenir la validation de l'étape 1.
2. Étape 2 : d'abord la recherche du module (stock, codes-barres, scan dans le navigateur, étiquettes, import Excel), la liste « indispensable / utile / plus tard », sa validation, puis le code.
3. Remplacer la page d'attente `src/app/(app)/[module]/page.tsx` par un vrai dossier `stock/` et `scan/`.

## Pour reprendre le travail dans un nouveau conteneur

```bash
npm install
pg_ctlcluster 16 main start          # si PostgreSQL local est arrêté
cp .env.example .env                 # puis créer les clés : openssl rand -base64 32
set -a; . ./.env; set +a
npm run db:roles && npm run db:migrer
npm run verifier                     # tout doit passer avant de continuer
```

## Questions ouvertes

- Aucune. Les ajouts validés (import Excel à l'étape 2, clôture de caisse à l'étape 3) sont dans le journal.

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
| `docs/etape-1/01-recherche-socle.md` | Recherche et liste des fonctions de l'étape 1 |
| `docs/etape-1/02-bilan.md` | Bilan de l'étape 1 : fait, pas fait, à essayer, liens |
| `README.md` | Lancer, vérifier, organisation du code |
| `docs/journal/JOURNAL.md` | Historique daté |
