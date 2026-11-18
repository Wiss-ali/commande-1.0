# Audit « comme un pirate » — 18/11/2026

Question du propriétaire : « Si tu étais une personne malveillante qui essaie de casser le site, tu ferais quoi ? »

Méthode : lecture du code (connexion, sessions, droits, boutique publique, administration, PDF, photos, import
Excel, déploiement) en se mettant à la place d'un attaquant. **Aucune attaque n'a été lancée contre le serveur en
ligne.** Un seul essai pratique, en local : un fichier Excel piégé (voir « Ce qui a résisté »).

Gravité : 🔴 important · 🟠 moyen · 🟡 faible.

## Défauts trouvés

| # | Gravité | Ce que ferait un pirate | Où |
|---|---|---|---|
| 1 | 🔴 | **Vider la boutique d'un concurrent.** Passer de faux tickets (99 pièces × 50 articles chacun) : le stock est réservé 24 h et la boutique affiche « rupture ». Limites actuelles : 5 tickets/heure par appareil (il suffit d'effacer le cookie), 3 par jour par numéro (il suffit d'inventer des numéros), 20/heure par adresse. Une seule connexion Internet suffit pour bloquer une petite boutique, et le vendeur reçoit 20 fausses notifications par heure. | `src/lib/boutique.ts` (`creerTicket`), `src/app/actions/boutique-publique.ts` |
| 2 | 🔴 | **Clé privée de sauvegarde encore sur le serveur** (déjà noté dans `ETAT.md`). Quelqu'un qui entre sur le serveur peut lire toutes les sauvegardes. | `/srv/hanout/deploiement/secrets/*/CLE-PRIVEE-A-RECUPERER.asc` |
| 3 | 🟠 | **Vendeuse qui contourne l'interdiction de remise.** Dans la caisse, la remise est refusée sans permission. Mais dans Factures, elle peut écrire un devis avec le prix qu'elle veut (et une remise), puis le transformer en facture « vente directe » : le stock sort, l'argent encaissé est plus bas. | `src/app/actions/ventes.ts` (`enregistrerDocument`, pas de contrôle `peutRemiser`, `prixLibres: true`) |
| 4 | 🟠 | **Bloquer l'administrateur.** Les échecs de connexion bloquent le compte administrateur entier, quelle que soit l'adresse. Un inconnu qui connaît l'identifiant peut le garder bloqué en continu. En plus, la réponse « bloqué » n'existe que pour un identifiant réel : cela confirme l'identifiant. | `src/lib/comptes.ts` (`connecterAdmin`, `echec`) |
| 5 | 🟠 | **Deviner le code à 6 chiffres** (si le mot de passe est déjà connu). 8 essais permis toutes les 10 minutes, sans fin ni alerte : environ 0,35 % de chances par jour, donc élevé sur plusieurs mois. Vaut aussi pour l'administrateur. | `src/lib/comptes.ts` (`verifierCode`) |
| 6 | 🟡 | **Téléphone oublié déverrouillé** : « Changer le mot de passe » et « Désactiver la double authentification » vérifient le mot de passe actuel sans limite d'essais. Désactiver la double authentification ne demande pas de code. | `src/app/actions/reglages.ts` |
| 7 | 🟡 | **Empêcher un commerçant de se connecter depuis un nouveau téléphone** : 20 échecs par heure sur son numéro, depuis plusieurs adresses, bloquent tout appareil pas encore reconnu (son téléphone habituel n'est pas gêné). | `src/lib/comptes.ts` (`ECHECS_MAX_NUMERO`) |
| 8 | 🟡 | **PDF d'une facture téléchargeable même quand le module Factures est coupé** ou hors formule (seul le rôle est vérifié). | `src/app/(app)/factures/[id]/pdf/route.ts` |
| 9 | 🟡 | **Pixels Facebook/TikTok** : une fois activés par le commerçant, leurs scripts tournent dans la page de commande et peuvent lire le nom et le téléphone tapés par l'acheteur. | `src/components/boutique/Pixels.tsx` |
| 10 | 🟡 | **Numéro personnel du propriétaire** montré sur le ticket public si le magasin n'a pas de numéro à lui. | `src/lib/boutique.ts` (`trouverBoutique`) |
| 11 | 🟡 | **Savoir si un numéro a un compte** sur la plateforme : un propriétaire qui invite un employé reçoit « numéro déjà pris ». | `src/lib/invitations.ts` (`telephonePris`) |
| 12 | 🟡 | **Saturer le site** : aucune limite de débit sur les pages publiques des boutiques, et chaque visite écrit en base (expiration des tickets). | `src/lib/boutique.ts` (`catalogue`), Caddy |
| 13 | 🟡 | **Copie de test et site réel sur le même réseau Docker** : si la copie de test était piratée, elle pourrait joindre le site réel sans passer par Caddy et se faire passer pour n'importe quelle adresse IP. | `deploiement/compose.yml` (réseau `hanout_web`) |
| 14 | 🟡 | **Adresse du serveur dans le dépôt** (`ETAT.md`, `JOURNAL.md`) : à retirer si le dépôt devient public. | `docs/journal/` |
| 15 | ⚖️ | Mots de passe des commerçants à 8 caractères sans double authentification imposée (choix déjà connu, question ouverte de `VERIFICATION-FINALE.md`). | — |

## Ce qui a résisté

- **Injection SQL** : toutes les requêtes sont paramétrées.
- **Injection de code dans les pages (XSS)** : React échappe tout, politique CSP stricte avec nonce ; identifiants des pixels vérifiés par un format strict.
- **PDF** : texte échappé, page sans réseau (CSP `default-src 'none'`).
- **Fichier Excel piégé** (« bombe zip » qui ment sur sa taille) : **essayé en local**, 200 Mo cachés dans 195 Ko ; le fichier est coupé à la taille annoncée, rien n'explose.
- **Voir les données d'un autre commerçant** : isolation par la base (RLS forcée), droits vérifiés côté serveur, tests d'isolation.
- **Photos** : réécrites en WebP, taille limitée ; photos publiques limitées aux produits publiés.
- **Sessions et liens** : jetons de 256 bits, seule leur empreinte est gardée, cookies `__Host-`, nouveau jeton à chaque étape, liens à usage unique.
- **Fausse adresse IP** : derrière Caddy, l'en-tête `X-Forwarded-For` envoyé par le visiteur est remplacé.
- **Certificats à la demande** : seulement pour une boutique qui existe.
- **Paiement par carte** : jamais traité, refusé côté serveur.

## Corrections proposées (pas encore faites)

1. Boutique : limiter le nombre de pièces réservées par ticket et par jour, compter aussi par numéro de wilaya + nom, et laisser le commerçant régler un plafond ; envisager une confirmation par appel avant réservation longue.
2. Effacer la clé privée du serveur (action du propriétaire).
3. Factures : refuser prix modifié et remise à un vendeur sans la permission « remise ».
4. Administrateur : bloquer par adresse (comme les commerçants) au lieu du compte entier ; même réponse que l'identifiant existe ou non.
5. Code à 6 chiffres : après 5 erreurs, fermer la session en attente et prévenir (journal + alerte) ; plafond par jour.
6. Limiter les essais du mot de passe actuel ; demander un code pour désactiver la double authentification.
7. PDF : vérifier aussi le module Factures.
8. Pixels : prévenir le commerçant ; mention dans la page de commande.
9. Ticket : ne jamais montrer le numéro personnel, demander un numéro de magasin pour ouvrir la boutique.
10. Limite de débit dans Caddy pour les pages publiques ; ne pas écrire en base à chaque visite.
11. Réseaux Docker séparés pour la copie de test et le site réel.
