# Étape 1 — Recherche avant le socle

Recherche faite le 15/11/2026. Module concerné : comptes sur invitation, commerçants, isolation,
deux langues, navigation. En attente de validation du propriétaire avant de coder.

## 1. Ce que font les bons outils

- **Invitations** : un jeton à usage unique, lié à un espace précis, à durée courte, annulable. Le jeton n'est jamais renvoyé par l'application après sa création, et un nouveau lien annule l'ancien. Piège connu : accepter une invitation dans une session déjà ouverte par quelqu'un d'autre ; il faut déconnecter avant.
- **Équipe** : le propriétaire invite ses employés et choisit leur rôle. La recherche n'a rien donné de fiable sur le code PIN des caisses (Square, Loyverse) : classé « plus tard ».

Sources : [Dev.to – invitations liées à l'espace](https://dev.to/sophiax99/tenant-bound-magic-links-for-saas-invites-5g84), [Vortex – parcours d'invitation](https://blog.vortexsoftware.com/enterprise-invitation-flows), [Achromatic – invitations](https://www.achromatic.dev/docs/monorepo-next-prisma-authjs/organizations/invitations)

## 2. Mots de passe et sessions (NIST, OWASP)

- **NIST SP 800-63B révision 4** (finale, juillet 2025) : 15 caractères au minimum quand le mot de passe est le seul facteur, 8 avec une double authentification ; au moins 64 caractères acceptés ; pas de règle de composition (majuscule, chiffre…) ; pas de changement forcé ; refus des mots de passe connus ou compromis. Sources secondaires, texte officiel à relire.
- **Sessions** : identifiant aléatoire d'au moins 64 bits (nous prendrons 256), cookie avec le préfixe `__Host-`, `HttpOnly`, `Secure`, `SameSite` ; déconnexion qui détruit la session côté serveur ; durée d'inactivité et durée maximale adaptées au risque ; nouvel identifiant après connexion.
- **Proposition** : 15 caractères pour l'administrateur et les propriétaires sans double authentification, 8 dès que la double authentification est active, liste locale de mots de passe courants refusés (aucun appel à un service étranger). Un commerçant garde sa session 30 jours sur son téléphone (réglable) ; l'administrateur, 12 heures.

Sources : [NIST – mots de passe](https://pages.nist.gov/800-63-4/sp800-63b/passwords), [NIST – sessions](https://pages.nist.gov/800-63-4/sp800-63b/session), [Enzoic – résumé de la révision 4](https://www.enzoic.com/blog/nist-sp-800-63b-rev4/), [OWASP – Session Management](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Session_Management_Cheat_Sheet.md), [MDN – gestion des sessions](https://developer.mozilla.org/en-US/docs/Web/Security/Authentication/Session_management)

## 3. Isolation par RLS

- `FORCE ROW LEVEL SECURITY` ne protège pas contre un super-utilisateur ni un rôle `BYPASSRLS` : le rôle de l'application ne doit être ni l'un ni l'autre, ni propriétaire des tables. Conforme au cahier des charges.
- Le commerçant courant doit être fixé **pour la transaction seulement** (`set_config(..., true)`), sinon une connexion réutilisée garde l'identité du commerçant précédent. Les tâches de fond sont la source de fuite la plus fréquente : elles passeront par la même fonction que les pages.
- La RLS est un filet de sécurité : le code filtre aussi par commerçant.

Sources : [AWS – isolation avec la RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security), [Svix – RLS en défense en profondeur](https://www.svix.com/blog/row-level-security-defense-in-depth/), [ClickHouse – architecture multi-clients](https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture)

## 4. Outils

- **Next.js 16** : le fichier `middleware.ts` s'appelle maintenant `proxy.ts` et tourne sur Node.js. next-intl 4 le prend en compte.
- **PostgreSQL 18** est la version stable ; la 19 est encore en test. Nous prenons la 18.
- **TypeScript 7 avec Next.js 16** : pas de réponse par la recherche. Sera testé à l'installation, repli sur la version 6.

Sources : [Next.js – proxy](https://nextjs.org/docs/app/api-reference/file-conventions/middleware), [next-intl avec Next.js 16](https://www.buildwithmatija.com/blog/next-intl-nextjs-16-proxy-fix), [PostgreSQL 18](https://www.postgresql.org/docs/current/release-18.html), [PostgreSQL 19 en test](https://www.postgresql.org/docs/release/19/)

## 5. Réglementation

- Loi 18-07 : ne collecter que le nécessaire. Un compte ne demandera que le nom, un identifiant de connexion et le mot de passe. Les adresses internet ne sont gardées que tronquées dans le journal.

## 6. Fonctions proposées pour l'étape 1

**Indispensable**

1. Installation du projet : Next.js, PostgreSQL 18, Docker, tests, migrations réversibles.
2. Trois rôles de base de données, RLS forcée, et les tests d'isolation entre deux commerçants.
3. Compte administrateur avec double authentification obligatoire, créé par une commande au moment de l'installation.
4. Écran d'administration minimal : créer un commerçant, créer et annuler un lien d'invitation.
5. Acceptation de l'invitation : mot de passe, informations légales du commerçant (chiffrées).
6. Connexion, déconnexion, blocage progressif après des échecs répétés.
7. Équipe : le propriétaire invite, change le rôle, bloque ou supprime un employé. Droits des trois rôles vérifiés côté serveur.
8. Mot de passe oublié : le propriétaire réinitialise ses employés, l'administrateur réinitialise les propriétaires, par un lien à usage unique.
9. Français et arabe, sens de lecture, format des montants, dates et téléphones. Bouton de langue sur chaque écran, choix mémorisé.
10. Navigation du bas à cinq entrées, thèmes clair et sombre, pages vides des modules à venir.
11. Réglages : informations légales, langue, modules activés ou non.
12. Journal des actions sensibles.
13. Protection CSRF, en-têtes de sécurité, CSP, limites de débit sur la connexion.

**Utile**

14. Double authentification facultative pour les commerçants, avec codes de secours.
15. Liste des appareils connectés, avec « déconnecter cet appareil ».
16. Installation sur l'écran d'accueil (PWA), version de base.
17. Limite du nombre d'employés par formule (le réglage existe ; l'écran des formules arrive à l'étape 7).

**Plus tard**

18. Connexion rapide par code PIN sur la caisse partagée.
19. Clés d'accès (empreinte digitale, visage) à la place du mot de passe.
20. Identifiant de connexion par e-mail avec envoi de messages : demande un serveur d'envoi.

## 7. Question ouverte

**Avec quoi se connecte-t-on ?** Sans serveur d'e-mail ni SMS, je propose le **numéro de téléphone**
comme identifiant, avec le mot de passe. Les liens (invitation, mot de passe oublié) sont transmis à
la main, par WhatsApp par exemple. L'e-mail reste possible en plus, sans envoi automatique.
