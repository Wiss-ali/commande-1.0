# Hanout

Application de gestion pour les petits commerçants algériens : stock, caisse, factures, commandes
et boutique en ligne, en français et en arabe. Multi-commerçants, vendue par abonnement.

- Demande complète : `docs/CAHIER-DES-CHARGES.md`
- État du projet et suite : `docs/journal/ETAT.md`

## Lancer en développement

Il faut Node.js 22, PostgreSQL (16 ou plus) et Chromium (pour les PDF).

```bash
cp .env.example .env          # puis remplacer les mots de passe et créer les clés (voir le fichier)
npm install
set -a; . ./.env; set +a
npm run db:roles              # crée les rôles et la base (une seule fois)
npm run db:migrer             # applique les migrations
npm run admin:creer -- moi@exemple.dz   # crée l'administrateur de la plateforme
npm run dev                   # http://localhost:3000 — administration : /admin
npm run demo                  # magasin de démonstration (jamais sur le site réel) — boutique : /b/magasin-demo
npm run push:cles             # clés des notifications sur le téléphone (une fois, à copier dans .env)
npm run taches                # tâches périodiques (expiration des tickets de la boutique) : toutes les 5 minutes
```

## Vérifier

```bash
npm run verifier   # types, tests unitaires et d'isolation, construction, tests de bout en bout
```

Les tests utilisent une base séparée (`hanout_test`), recréée à chaque lancement.

Les photos des produits sont rangées dans le dossier `DOSSIER_FICHIERS` (par défaut `./donnees`), à sauvegarder avec la base.

## Mettre en ligne (production)

Tout est dans `deploiement/` et expliqué pas à pas, pour un débutant, dans **`docs/GUIDE-INSTALLATION.md`** :
Caddy (HTTPS automatique, boutiques en sous-domaine), site réel et copie de test sur le même serveur,
sauvegardes chiffrées chaque nuit et restauration, mise à jour sans coupure (`deploiement/deployer.sh`),
retour arrière en une commande, surveillance et alertes. Liste de vérification finale : `docs/VERIFICATION-FINALE.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `db/migrations` | Changements de la base, versionnés et réversibles (`.up.sql` / `.down.sql`) |
| `src/lib` | Cœur serveur : base et RLS, chiffrement, comptes, invitations, droits, formats, stock, codes-barres, tableur, photos, documents, calculs fiscaux, PDF |
| `src/app` | Écrans et actions serveur (`(app)` commerçant, `(public)` sans connexion, `admin`) |
| `messages` | Tous les textes : `fr.json` et `ar.json` |
| `tests` | `unit`, `integration` (isolation entre commerçants), `e2e` (parcours sur téléphone) |
