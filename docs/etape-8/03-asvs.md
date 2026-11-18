# Étape 8 — Sécurité : ce qui est couvert, et ce qui ne l'est pas

Référence demandée par le cahier des charges : **OWASP ASVS niveau 2** et le **Top 10 OWASP**.
Version utilisée : ASVS 5.0 (2025, 17 chapitres) et Top 10 2025. Les noms de chapitres viennent des résumés
publics ; à recouper avec la liste officielle d'OWASP lors d'un audit.

Légende : ✅ couvert et testé · 🟡 en partie · ❌ pas couvert · ⚖️ choix du propriétaire.

## OWASP ASVS 5.0 — niveau 2

| Chapitre | État | Ce qui est en place | Ce qui manque |
|---|---|---|---|
| V1 Encodage et nettoyage | ✅ | React échappe tout l'affichage ; PDF : texte échappé et isolé (`<bdi>`) ; requêtes SQL paramétrées (Kysely) ; cellules CSV neutralisées (formules Excel) | — |
| V2 Validation et règles métier | ✅ | Validation serveur de chaque entrée (Zod, contrôles maison) ; prix toujours relus dans la fiche ; numérotation sans trou ; documents figés par la base ; idempotence (double toucher) ; limites anti-fausses commandes | — |
| V3 Sécurité côté navigateur | ✅ | CSP stricte avec nonce, sans `unsafe-inline` ; `X-Frame-Options: DENY`, `frame-ancestors 'none'` ; `nosniff` ; `Referrer-Policy: no-referrer` ; COOP ; HSTS ; cookies `__Host-` | `wasm-unsafe-eval` nécessaire au scanner de codes-barres (Safari) |
| V4 API et services web | ✅ | Pas d'API publique ; actions serveur Next.js (contrôle d'origine intégré) ; routes GET sans effet de bord | — |
| V5 Fichiers | ✅ | Photos : taille limitée, décodées et réécrites en WebP (métadonnées supprimées), servies après contrôle du commerçant ; import Excel sans la bibliothèque `xlsx` vulnérable | — |
| V6 Authentification | 🟡 ⚖️ | Argon2id ; liste des mots de passe courants ; blocage après 5 échecs pour ce numéro depuis cette adresse (ou cet appareil reconnu), jamais du compte entier, même réponse que le compte existe ou non ; limite par numéro qui ne bloque pas un appareil reconnu (OWASP « device cookies ») ; code de double authentification à usage unique ; double authentification obligatoire pour l'administrateur (15 caractères), proposée aux commerçants ; codes de secours hachés ; comptes sur invitation (jeton de 256 bits, usage unique, 7 jours) | **Commerçants : 8 caractères sans double authentification imposée (choix du propriétaire). NIST 800-63B rév. 4 demande 15 caractères quand le mot de passe est utilisé seul.** |
| V7 Sessions | ✅ | Jeton aléatoire, seule son empreinte est gardée ; cookie HttpOnly, Secure, SameSite ; nouveau jeton à chaque étape de connexion ; durée maximale (30 jours, administrateur 12 heures) ; **déconnexion après inactivité (7 jours, administrateur 1 heure)** ; déconnexion de tous les appareils au changement de mot de passe ou au blocage | — |
| V8 Autorisations | ✅ | Droits vérifiés côté serveur à chaque action et à chaque page (rôle, droit personnel, module, abonnement) ; isolation des commerçants par la base elle-même (RLS activée et forcée, rôle non propriétaire) ; tests automatiques d'isolation sur chaque table | — |
| V9 Jetons autonomes (JWT) | ✅ | Pas de JWT pour les utilisateurs. Seul jeton signé : VAPID (ES256) vers les services de notification | — |
| V10 OAuth et OIDC | — | Non utilisé | — |
| V11 Cryptographie | 🟡 | AES-256-GCM champ par champ (téléphones, adresses, numéros légaux, secrets de double authentification, abonnements aux notifications), avec le contexte comme donnée associée ; empreintes HMAC pour la recherche ; clés hors de la base, numérotées (plusieurs clés acceptées en lecture) ; sauvegardes chiffrées avec une autre clé (gpg, clé privée hors du serveur) | Pas encore de script pour re-chiffrer toutes les données avec une nouvelle clé (la rotation est prévue par le format, pas outillée) |
| V12 Communications | ✅ | HTTPS partout (Caddy, TLS 1.2 et 1.3, HSTS) ; TLS vérifié entre l'application et la base (autorité locale) ; notifications vers des services connus seulement | — |
| V13 Configuration | ✅ | Secrets dans des fichiers d'environnement créés à l'installation, jamais dans le code ni dans git ; conteneurs sans privilège (utilisateur non root) ; seul Caddy est exposé ; dépendances verrouillées (`package-lock.json`), `npm audit` dans la vérification | Alerte `picomatch` sans correction publiée (outils de développement, pas de saisie utilisateur) |
| V14 Protection des données | ✅ | Le moins de données possible (acheteur : nom, téléphone, wilaya, commune) ; suppression des données d'un client sur demande ; export pour le commerçant ; pages personnelles jamais en cache (`no-store`) ; aucune donnée personnelle dans les journaux techniques | — |
| V15 Code et architecture | ✅ | TypeScript strict ; une seule fonction écrit chaque type d'opération sensible (stock, documents) ; transactions « tout ou rien » | — |
| V16 Journalisation et erreurs | 🟡 | Journal des actions sensibles en ajout seulement (la base refuse toute modification) ; erreurs techniques sans détail montré à l'utilisateur ; page d'état et alertes | Pas d'alerte automatique sur des comportements suspects (beaucoup d'échecs de connexion, par exemple) : à surveiller dans le journal |
| V17 WebRTC | — | Non utilisé | — |

## OWASP Top 10 (2025)

| Risque | État | Comment |
|---|---|---|
| A01 Contrôle d'accès défaillant | ✅ | Droits côté serveur partout, RLS forcée, tests d'isolation |
| A02 Mauvaise configuration | ✅ | En-têtes stricts, aucun port de base exposé, secrets générés à l'installation |
| A03 Chaîne d'approvisionnement logicielle | 🟡 | Versions exactes verrouillées, `npm audit`, peu de dépendances (Web Push et Excel écrits sans bibliothèque) ; une alerte sans correctif publiée (`picomatch`, outils) |
| A04 Défaillances cryptographiques | ✅ | AES-256-GCM, Argon2id, TLS, sauvegardes chiffrées |
| A05 Injection | ✅ | Requêtes paramétrées, échappement, CSP |
| A06 Conception non sécurisée | ✅ | Documents figés par la base, numérotation sans trou, aucune carte bancaire jamais reçue |
| A07 Authentification | 🟡 ⚖️ | Voir V6 : longueur minimale des mots de passe des commerçants |
| A08 Intégrité des données et du logiciel | ✅ | Empreintes des sauvegardes vérifiées avant restauration ; documents et paiements figés |
| A09 Journalisation et alertes | 🟡 | Journal et alertes de disponibilité ; pas encore d'alerte sur les comportements suspects |
| A10 Mauvaise gestion des cas exceptionnels | ✅ | Transactions annulées en entier en cas d'erreur ; mise à jour qui revient seule à la version précédente si elle échoue |

## Ce que la sécurité ne peut pas garantir seule

- **Chiffrement du disque** du serveur (au repos) : à demander à l'hébergeur (disque chiffré) ; le guide l'explique.
- **Test d'intrusion** par une équipe extérieure : recommandé avant de vendre l'application à grande échelle.
- **Déclaration à l'ANPDP** du traitement des données (loi 18-07, modifiée par la loi 25-11) : démarche du propriétaire.
