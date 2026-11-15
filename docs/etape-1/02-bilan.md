# Étape 1 — Bilan du socle

Terminée le 15/11/2026. En attente de la validation du propriétaire.

## Fait

| Fonction | Où |
|---|---|
| Projet Next.js 16, React 19, TypeScript 7, Tailwind 4, PostgreSQL | racine, `README.md` |
| Migrations versionnées et réversibles (testées dans les deux sens) | `db/migrations`, `scripts/migrer.ts` |
| Quatre rôles de base de données, RLS activée et forcée | `db/migrations/0001_socle.up.sql` |
| Chiffrement AES-256-GCM champ par champ, clés renouvelables | `src/lib/chiffrement.ts` |
| Compte administrateur, double authentification obligatoire | `scripts/creer-admin.ts`, `/admin` |
| Administration minimale : créer un commerçant, lien d'invitation, suspendre, limite d'employés | `/admin` |
| Invitation à usage unique, 7 jours, annulable | `src/lib/invitations.ts`, `/invitation/…` |
| Connexion par téléphone, blocage après 5 échecs, limites de débit | `src/lib/comptes.ts`, `/connexion` |
| Équipe : inviter, changer de rôle, bloquer, supprimer | `/reglages/equipe` |
| Mot de passe oublié (employé par le propriétaire, propriétaire par l'administrateur) | idem, `/admin/commercants/…` |
| Trois rôles et leurs droits, vérifiés côté serveur à chaque page et action | `src/lib/droits.ts`, `src/lib/web.ts` |
| Français et arabe (droite à gauche), bouton de langue sur chaque écran, choix mémorisé | `messages/`, `src/components/EnTete.tsx` |
| Barre du bas à cinq entrées, colonne latérale sur grand écran | `src/components/NavBas.tsx` |
| Thèmes clair, sombre, automatique | `src/app/globals.css`, `/plus` |
| Réglages : informations légales (chiffrées), modules activés ou non | `/reglages` |
| Double authentification facultative pour les commerçants, codes de secours | `/reglages/securite` |
| Appareils connectés, déconnexion d'un appareil, changement de mot de passe | `/reglages/securite` |
| Journal des actions sensibles, en ajout seulement | table `journal_actions` |
| CSP stricte avec nonce, en-têtes de sécurité, cookies HttpOnly/SameSite | `src/proxy.ts`, `src/lib/web.ts` |
| Installation sur l'écran d'accueil (manifeste et icônes) | `src/app/manifest.ts` |
| États vide, chargement, erreur, accès refusé, page introuvable | `src/app` |

## Tests automatiques

- **43 tests** unitaires et d'intégration (`npm test`), dont **17 sur l'isolation** : un commerçant ne peut ni lire, ni modifier, ni supprimer, ni créer de données chez un autre ; sans commerçant fixé, rien n'est visible ; le rôle de l'application ne peut pas lire un mot de passe, activer le paiement par carte, changer son état, effacer le journal ni contourner la RLS.
- **10 parcours de bout en bout** (`npm run test:e2e`) sur un écran de 360 px : administrateur, invitation, connexion, arabe, thème sombre, rôles, modules, blocage, double authentification, suspension. Ils vérifient aussi qu'aucun écran ne déborde en largeur et qu'aucune violation de la politique de sécurité n'apparaît.
- Captures d'écran : `docs/etape-1/captures/`.

## Pas fait, ou différent du plan

- **Fichiers Docker écrits mais non testés** : le service Docker n'était pas disponible dans l'environnement de travail. À valider à l'étape 8.
- **PostgreSQL** : développé et testé sur la version 16 (seule installée ici). La version 18 est celle visée dans `docker-compose.yml` ; rien dans le code ne dépend de la version.
- **Accueil** : provisoire (liste des modules). Le vrai tableau de bord est l'étape 5.
- **Administration** : minimale. Abonnements, paiements et demandes sont l'étape 7.
- **Lecture seule** après la fin d'abonnement : le blocage des écritures existe (`exigerEcriture`), le passage automatique en lecture seule sera fait à l'étape 7.
- **Identifiants** : UUID version 4 (aléatoires) au lieu de la version 7 annoncée dans le schéma : ils sont moins devinables.
- **HTTPS, TLS vers la base, sauvegardes** : prévus dans la configuration (`DATABASE_SSL`, cookies `__Host-`, HSTS), mis en place sur le vrai serveur à l'étape 8.
- Code PIN de caisse, connexion par empreinte, envoi d'e-mails : « plus tard », comme convenu.

## Défaut trouvé et corrigé pendant les tests

- Les codes de secours disparaissaient de l'écran juste après l'activation de la double authentification. Ils restent maintenant affichés jusqu'à ce que l'utilisateur touche « Continuer ».

## À essayer par le propriétaire

1. Se connecter à `/admin`, activer la double authentification avec une application (Google Authenticator, Aegis…), noter les codes de secours.
2. Créer un commerçant, ouvrir le lien d'invitation dans une fenêtre privée, choisir un mot de passe de 15 caractères.
3. Changer de langue et de thème ; vérifier que tout reste lisible en arabe sur un vrai téléphone.
4. Inviter un vendeur et un préparateur, se connecter avec chacun, vérifier ce qu'ils voient.
5. Bloquer un employé, utiliser « Mot de passe oublié », désactiver un module.
6. Sur téléphone : « Ajouter à l'écran d'accueil » (demande le HTTPS, donc un vrai serveur).

## Liens entre les éléments construits

```
 ADMINISTRATEUR ──crée──► COMMERÇANT ──────────────┐
       │                      ▲                    │ modules, état, limite d'employés
       └─crée─► INVITATION ───┘ (type commerçant)  │
                    │ acceptée                     ▼
                    ▼                        UTILISATEUR (propriétaire)
              UTILISATEUR ◄──invite── INVITATION (type employé) ◄── propriétaire
                    │                 INVITATION (réinitialisation) ◄── propriétaire ou administrateur
                    ├──► SESSIONS (un appareil = une session)
                    └──► JOURNAL DES ACTIONS (qui, quoi, quand)
```
