# Étape 6 — Bilan : boutique en ligne

Terminée le 17/11/2026. Vérification par le propriétaire prévue à la fin du projet.
Recherche et liste des fonctions : `docs/etape-6/01-recherche-boutique.md`.

## Fait

| Fonction | Où |
|---|---|
| Module Boutique : interrupteur « En ligne / Coupée » ; coupée, l'adresse affiche « Boutique momentanément indisponible », rien n'est supprimé | `/boutique` |
| Adresse choisie par le commerçant, vérifiée (format, noms réservés, déjà prise) ; sous-domaine `nom.mondomaine.dz`, et adresse de secours `/b/nom` | `/boutique` |
| Quatre modèles : Vitrine, Catalogue (catégories et recherche), Grandes photos, Produit unique (formulaire de commande sur la même page) ; changement sans rien perdre | `/boutique`, `/b/nom` |
| Carte « Site personnalisé » : « Un site créé sur mesure pour votre marque. Service payant en supplément. » et demande envoyée à l'administrateur avec nom et téléphone | `/boutique`, `/admin` |
| Personnalisation : couleur (palette à contraste vérifié), logo, bannière, textes d'accueil, conditions de livraison et de retour (fr et ar), ordre des sections, WhatsApp, Facebook, Instagram, TikTok | `/boutique` |
| Aperçu sur téléphone, même boutique coupée (visible par le commerçant seul) | bouton « Aperçu » |
| Lien avec le stock : interrupteur « Visible dans la boutique » par produit, stock par variante, « Rupture de stock » ou produit masqué selon le réglage, retour automatique dès qu'il y a du stock | `/boutique`, `/b/nom` |
| Pastilles « Nouveau » et « Plus que N », prix barré | `/b/nom` |
| Commande sans compte : nom, téléphone, wilaya, commune ; domicile ou point relais si le prix existe ; frais de la wilaya | `/b/nom/panier` |
| Option « Carte CIB / Edahabia » visible ; si choisie : « Le paiement par carte n'est pas encore activé pour cette boutique. Choisissez le paiement à la livraison. » | `/b/nom/panier` |
| Ticket : numéro court, produits, total, « Paiement à la livraison », téléphone du vendeur en grand, Appeler et WhatsApp (message prérempli), lien privé impossible à deviner | `/b/nom/t/…` |
| Le ticket crée un devis « Boutique en ligne » et une commande « Nouvelle » ; le stock est réservé pendant la durée réglée (24 h par défaut) ; sans confirmation, devis expiré et stock libéré tout seul | Factures › Devis, Commandes |
| Le vendeur retrouve le devis par le numéro du ticket, et confirme : « Envoi » ou « Vente directe » | Factures › Devis, Commandes |
| Contre les fausses commandes : format du téléphone, 3 tickets par téléphone et par jour, 5 par appareil et 20 par adresse par heure, piège invisible anti-robots, alerte si le numéro a des retours ou des annulations | serveur |
| Notifications : cloche avec pastille en haut de chaque écran ; sur le téléphone même application fermée (Web Push), en un toucher « Activer sur ce téléphone » | `/notifications` |
| Paiement par carte : « Demander l'activation » côté commerçant ; seul l'administrateur peut autoriser (réglage `paiement_carte_actif`) ; aucune passerelle branchée, interface vide prête | `/boutique`, `/admin` |
| Administration : liste des demandes (carte, site personnalisé), « Traitée » ou « Refusée » avec une note ; autorisation du paiement par carte par commerçant | `/admin` |
| Carte Boutique de l'accueil : « En ligne » ou « Désactivée » | `/` |

## Règles garanties

- Le prix vient toujours de la fiche produit, jamais du téléphone de l'acheteur. Seuls les produits publiés peuvent être commandés.
- Le téléphone de l'acheteur n'est visible que par le vendeur concerné, chiffré en base ; le ticket public ne le montre pas.
- Le lien du ticket est un jeton aléatoire de 256 bits ; seule son empreinte est gardée.
- Une facture n'est créée qu'à la confirmation du vendeur : une fausse commande ne consomme jamais de numéro de facture.
- Le commerçant ne peut pas activer lui-même le paiement par carte (la base le refuse). L'application ne reçoit et ne stocke aucun numéro de carte.
- Notifications sur le téléphone : message sans nom ni téléphone ; envoi seulement vers les services connus (Google, Mozilla, Apple, Microsoft) ; adresse et clés chiffrées.
- Les cinq nouvelles tables des commerçants sont isolées (RLS activée et forcée).

## Tests automatiques

- **130 tests** unitaires et d'intégration, dont 13 nouveaux : adresse, mise en ligne, réglages, contraste de la palette, catalogue relié au stock, ticket complet, refus (robot, téléphone, produit non publié, stock, boutique coupée), limites, expiration, ruptures, demandes, chiffrement des notifications (déchiffré comme un navigateur) et signature VAPID, isolation.
- **63 parcours de bout en bout**, dont 10 nouveaux sur un écran de 360 px : préparation et mise en ligne, visite de l'acheteur, commande sans compte, carte refusée avec le message, ticket, notification et confirmation, quatre modèles, sous-domaine, boutique coupée, demandes, arabe en thème sombre.
- Captures : `docs/etape-6/captures/`.

## Défauts trouvés et corrigés pendant les tests

- Si le commerçant n'avait pas rempli le téléphone du magasin, le ticket n'avait pas de numéro à appeler : c'est maintenant celui du propriétaire.
- Le formulaire de demande restait bloqué pour la même raison (téléphone vide).
- La liste des devis ne montrait pas la mention « Boutique en ligne ».

## Pas fait, ou différent du plan

- **Sous-domaines sur le vrai serveur** : prêts dans l'application (réglage `DOMAINE_BOUTIQUES`), mais le DNS et le certificat HTTPS « *.mondomaine.dz » se font à l'installation (étape 8). En attendant, l'adresse `/b/nom` marche partout.
- **Notifications sur le téléphone** : prêtes, mais à activer avec des clés (`npm run push:cles`) sur le serveur réel ; non essayées sur un vrai téléphone (le service de Google ou d'Apple n'est pas joignable depuis l'environnement de travail). Sur iPhone, l'application doit être installée sur l'écran d'accueil.
- **Expiration des tickets** : faite à chaque visite de la boutique et par la tâche `npm run taches`, à programmer toutes les 5 minutes sur le serveur (étape 8).
- **Vérification du téléphone par SMS**, avis clients, codes promo : plus tard.
- **Plusieurs photos par produit** : une seule photo par produit (comme à l'étape 2).
- **Écran complet des demandes** dans l'administration : liste simple aujourd'hui ; l'écran complet arrive avec l'administration (étape 7).
- Le choix des modules par abonnement (demandé par le propriétaire) sera traité à l'étape 7.

## À essayer par le propriétaire (à la fin)

1. Boutique : choisir l'adresse, publier deux ou trois produits, choisir une couleur, écrire le texte d'accueil, mettre en ligne.
2. Ouvrir la boutique sur un autre téléphone, sans compte : ajouter au panier, commander, lire le ticket.
3. Choisir « Carte CIB / Edahabia » : lire le message.
4. Côté commerçant : voir la cloche, ouvrir la commande, appeler, confirmer « Envoi ».
5. Essayer les quatre modèles.
6. Couper la boutique : vérifier le message « Boutique momentanément indisponible ».
7. Activer les notifications sur votre téléphone (sur le serveur réel).
8. Envoyer une demande de site personnalisé et la voir dans l'administration.

## Liens entre les modules construits

```
   ACHETEUR (sans compte) ──► BOUTIQUE (/b/nom ou nom.domaine) ──► TICKET (lien privé)
                                   │ produits publiés, stock libre          │
                                   ▼                                        ▼
   STOCK ◄── réservation ──── DEVIS « Boutique en ligne » ◄────────── COMMANDE « Nouvelle »
     ▲        (24 h)               │ expiré : stock libéré                  │
     │                             │ « Confirmer » : Envoi / Vente directe  ├──► NOTIFICATION (cloche, téléphone)
     └── sortie à l'expédition ── FACTURE ──► COLIS ──► livré / retourné ──► AVOIR
                                                                           └──► CLIENT (alerte retours)
   COMMERÇANT ──► DEMANDES (paiement par carte, site personnalisé) ──► ADMINISTRATION
```
