# Journal du projet

Entrées les plus récentes en haut. Une entrée par action importante.

## 15/11/2026 — Étape 0 validée, recherche de l'étape 1

- Le propriétaire a répondu « ok pour tout ». Décisions enregistrées :
  - Nom du produit : Hanout.
  - Boutique sans registre du commerce : avertissement, pas de blocage.
  - Droit de timbre : réglage par tranches.
  - Total en lettres sur les factures ; facture récapitulative et bon de transfert « plus tard ».
  - PDF produits par Chromium côté serveur.
  - Une commande de la boutique = un devis, vu dans Commandes et dans Devis.
  - Maquettes acceptées (couleurs, police, disposition).
  - Ajouts au cahier des charges : import de produits depuis Excel (étape 2), clôture de caisse (étape 3), mot de passe oublié (étape 1). Vente à crédit, fournisseurs, dépenses, plusieurs magasins : version 2.
  - Équipe : le propriétaire crée les comptes de ses employés par lien d'invitation. Droits : le vendeur vend et prépare ; le préparateur prépare, scanne et fait l'inventaire ; seul le propriétaire voit les prix d'achat, la marge, les rapports, corrige le stock et accède aux réglages.
  - Nombre d'employés limité selon la formule d'abonnement, réglable par l'administrateur.
- Écrit `docs/etape-1/01-recherche-socle.md` : recherche et liste des fonctions de l'étape 1. En attente de validation avant de coder.
- PostgreSQL 18 retenu (la 19 est encore en test). Next.js 16 : `proxy.ts` remplace `middleware.ts`.

## 15/11/2026 — Étape 0 livrée

- Écrit `docs/etape-0/maquettes.html` : accueil, commandes, scan, facture, boutique. Bouton de langue et de thème. Vérifié par capture d'écran en français clair et en arabe sombre.
- Leçon pour le code : en arabe, un montant écrit « 48 500 » avec une espace normale s'affiche à l'envers (« 500 48 »). Il faut une espace insécable entre les groupes de chiffres. À intégrer dans la fonction de formatage des montants dès l'étape 1.
- Écrit `02-plan.md` et `03-schema.md`. Choix proposés au-delà du cahier des charges : Kysely pour la base, comptes codés maison, PDF par Chromium, Caddy, worker sur file PostgreSQL, empreinte HMAC du téléphone pour la recherche.
- Écrit `01-recherche.md`. Contradictions signalées au propriétaire : droit de timbre par tranches depuis 2025, total en lettres exigé sur la facture, facture récapitulative et bon de transfert absents du cahier des charges, loi 18-05 (registre du commerce et hébergement en Algérie obligatoires pour vendre en ligne), loi 18-07 (déclaration à l'ANPDP).
- Confirmé : 69 wilayas, conservation 10 ans (article 12 du Code de commerce).
- Sites non joignables depuis la session : `commerce.gov.dz`, `legal-doctrine.com`, `cheatsheetseries.owasp.org`. Les points concernés sont marqués « à vérifier ».

## 15/11/2026 — Démarrage

- Le propriétaire a confirmé : supprimer tout l'ancien projet PHP (17 fichiers, logos compris), y compris sur `main`, et mettre le nouveau projet à la place.
- Ancien projet supprimé par un commit normal : il reste récupérable dans l'historique git (dernier commit de l'ancien projet : `79b8679`).
- Étapes numérotées de 0 à 8 au lieu de 1 à 9, pour correspondre aux renvois du cahier des charges.
- Créé `CLAUDE.md`, `docs/CAHIER-DES-CHARGES.md` et ce journal.
