# Étape 8 — Bilan : sécurité, installation, exploitation

Terminée le 17/11/2026. C'est la dernière étape. Vérification par le propriétaire : `docs/VERIFICATION-FINALE.md`.
Recherche : `docs/etape-8/01-recherche-securite-exploitation.md`. Sécurité point par point : `docs/etape-8/03-asvs.md`.

## Fait, et essayé pour de vrai (Docker, serveur complet dans l'environnement de travail)

| Fonction | Où | Essai |
|---|---|---|
| Image de production (application, PDF en arabe, utilisateur non root, vérification de santé) | `Dockerfile` | PDF arabe produit dans le conteneur ✅ |
| HTTPS automatique (Caddy) : site, administration, copie de test | `deploiement/proxy/` | En-têtes de sécurité et HSTS présents ✅ |
| Sous-domaine de chaque boutique avec certificat obtenu à la première visite, **seulement si la boutique existe** | Caddy + `/api/tls-autorise` | Boutique servie ✅ ; nom inconnu refusé ✅ |
| Deux environnements séparés : site réel et copie de test | `deploiement/compose.yml` | Les deux en service ✅ |
| Connexion chiffrée (TLS vérifié) entre l'application et la base | certificats créés à l'installation | ✅ |
| Sauvegarde chaque nuit, base + photos, **chiffrée avec une clé publique** (la clé privée reste chez vous), gardée 30 jours, empreintes vérifiées | `deploiement/sauvegarde.sh` | ✅ |
| Copie des sauvegardes sur un autre serveur | `deploiement/copier-sauvegardes.sh` | Écrit ; demande un second serveur réel |
| **Restauration** : base et photos remises, site reparti | `deploiement/restaurer.sh` | Données modifiées puis restaurées ✅ ; copie du site réel restaurée sur la copie de test avec lecture des données chiffrées ✅ |
| **Mise à jour sans coupure** : sauvegarde avant, migrations, deux copies redémarrées l'une après l'autre | `deploiement/deployer.sh` | 381 visites pendant la mise à jour, **0 erreur** ✅ |
| **Retour à la version précédente en une commande**, et retour automatique si la nouvelle version ne démarre pas | `./deployer.sh prod retour` | 119 visites pendant le retour, 0 erreur ✅ |
| Page d'état (application, base, âge de la dernière sauvegarde) ; détail protégé par un jeton | `/etat` | ✅ |
| **Alertes** sur le téléphone (panne, puis « de nouveau en service »), sans répétition plus d'une fois par heure | `deploiement/surveiller.sh` | Base arrêtée puis redémarrée : deux messages reçus ✅ |
| Tâches périodiques (tickets expirés, échéances des abonnements) dans leur propre conteneur | `compose.yml` | ✅ |
| Commandes du quotidien en une ligne (administrateur, état, journaux, sauvegarde…) | `deploiement/outils.sh` | ✅ |
| Déconnexion après inactivité (7 jours ; administrateur 1 heure ; réglables) | `src/lib/sessions.ts` | Test automatique ✅ |
| Suppression des données d'un client à sa demande (factures conservées) | fiche client | Test de bout en bout ✅ |
| Durée de conservation des documents réglable (10 ans), sans suppression automatique | `/admin/reglages` | ✅ |
| Guide pas à pas pour un débutant | `docs/GUIDE-INSTALLATION.md` | — |
| Liste unique de vérification et questions | `docs/VERIFICATION-FINALE.md` | — |

## Défauts trouvés et corrigés pendant ces essais

- Deux sauvegardes dans la même minute : la seconde échouait et **effaçait la première**. Corrigé : nom à la seconde, dossier neuf obligatoire, jamais d'effacement d'un dossier existant.
- Les empreintes des sauvegardes contenaient des chemins internes : la restauration (prudente) refusait. Corrigé.
- Après une mise à jour, le conteneur de sauvegarde gardait l'ancienne version de son script. Corrigé : il est recréé à chaque mise à jour.
- La copie de test n'obtenait pas son certificat (conflit avec les sous-domaines des boutiques). Corrigé.
- Fichiers de sauvegarde trop ouverts en écriture ; le conteneur des tâches recevait à tort la vérification de santé du site. Corrigés.

## Tests automatiques

- **142 tests** unitaires et d'intégration, dont la déconnexion après inactivité et la suppression des données d'un client.
- **74 parcours de bout en bout** (dont la page d'état, les certificats des sous-domaines et la suppression des données d'un client).
- Essais de l'installation réelle décrits ci-dessus (Docker, Caddy, base PostgreSQL 18).

## Pas fait, ou à savoir

- **Dans cet environnement de travail, les dépôts de paquets Debian sont bloqués** : l'image a été essayée avec une image de base qui contient déjà Chromium (celle de Microsoft Playwright). Sur votre serveur, l'image normale (Debian + Chromium) s'installe sans réglage ; le premier `./deployer.sh test` le confirmera.
- **Pas d'essai sur un vrai serveur loué** (ni Let's Encrypt réel, ni second serveur, ni téléphone réel pour les notifications) : c'est la première chose à faire, sur la copie de test.
- Mot de passe des commerçants : 8 caractères (votre choix), en dessous de la norme NIST 2025 (15 caractères sans double authentification). Question dans la vérification finale.
- Pas de script pour re-chiffrer toutes les données avec une nouvelle clé (le format le permet ; à outiller plus tard).
- Pas d'alerte automatique sur un comportement suspect (beaucoup d'échecs de connexion) : visible dans le journal.
- Test d'intrusion par une équipe extérieure : recommandé avant une vente à grande échelle.

## Schéma final

```
 Internet ──HTTPS──► CADDY ──► site réel : 2 copies de l'application (mise à jour l'une après l'autre)
   (votredomaine.dz,             │   └─ TLS ─► PostgreSQL ◄── sauvegarde chiffrée chaque nuit ──► 2ᵉ serveur
    nom.votredomaine.dz,         │                 ▲                  │
    test.votredomaine.dz)        │              tâches              /etat ◄── surveillance (5 min) ──► alerte téléphone
                                 └──► copie de test : même chose, séparée (base, photos, clés)
```
