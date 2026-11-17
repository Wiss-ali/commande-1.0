# Étape 6 — Recherche : boutique en ligne, commande sans compte, notifications

Recherche faite le 17/11/2026 (résumés des moteurs de recherche ; les sites ne s'ouvrent pas depuis l'environnement de travail).

## 1. Ce que proposent les outils du domaine

- Les boutiques algériennes (DZBuild, YouCan, Shopify avec applications) reposent sur un **formulaire de commande court** (nom, téléphone, wilaya, commune) et le paiement à la livraison, encore environ 80 % du commerce en ligne en Algérie.
  Sources : [DZBuild — confiance et fraude](https://dzbuild.com/blog/trust-security-algerian-ecommerce-reviews-fraud-prevention), [DZBuild — bonnes pratiques](https://dzbuild.com/blog/cod-best-practices).
- **Fausses commandes** : problème principal du paiement à la livraison (exemple cité : 35 000 DA perdus par mois pour un marchand sans filtre). Les outils proposent : vérification du téléphone, liste des numéros qui ont refusé, limite de commandes, captcha invisible pour les vrais clients, score de risque.
  Sources : [DZBuild — fausses commandes](https://dzbuild.com/docs/operations/fake-orders), [Antiro (Shopify)](https://apps.shopify.com/antiro?locale=fr), [Kolonell — fraude au paiement à la livraison](https://kolonell.com/fr/blog/fraude-fausse-commande-cod-blacklist-2026).
- **Notifications sur le téléphone** (Web Push, clés VAPID) : fonctionnent dans Chrome, Edge, Firefox et Safari ; sur iPhone et iPad, **seulement si l'application est installée sur l'écran d'accueil** (iOS 16.4 ou plus), et la demande d'autorisation doit suivre un toucher. La clé privée VAPID doit rester la même d'un redémarrage à l'autre.
  Sources : [Apple — Web Push](https://developer.apple.com/tutorials/data/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.md), [MagicBell — limites iOS](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [webscraft — iOS 2026](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en).
- Bibliothèque `web-push` (npm) : sa dernière version a moins de deux semaines. **Choix : chiffrement Web Push (RFC 8291, aes128gcm) et signature VAPID (RFC 8292) écrits avec le module `crypto` de Node**, sans dépendance de plus (une centaine de lignes, testées en déchiffrant comme le ferait le navigateur).

## 2. Ce que demande la réglementation

- **Loi 18-05 (commerce électronique)** : l'offre doit être claire, le vendeur identifiable (nom, contacts), les conditions de livraison et de retour affichées ; le vendeur reste responsable de la livraison. La boutique affiche donc l'identité du vendeur, ses conditions de livraison et de retour.
- **Loi 18-07 (données personnelles)** : on ne demande que le nom, le téléphone, la wilaya et la commune ; le téléphone n'est visible que par le vendeur concerné, chiffré en base ; pas de compte acheteur, pas de suivi publicitaire.
- **Paiement par carte (CIB, Edahabia)** : non codé (cahier des charges, partie 5) ; seule une interface vide est prévue pour une passerelle certifiée.

## 3. Ce dont le commerçant a besoin

- Une boutique qui charge vite sur une connexion lente, lisible sur téléphone, en français et en arabe.
- Ne jamais vendre un article qu'il n'a plus : réservation du stock dès le ticket, libérée si la commande n'est pas confirmée.
- Être prévenu tout de suite d'une nouvelle commande, pour rappeler le client tant qu'il est disponible.

## 4. Fonctions proposées

### Indispensable (fait à cette étape)

1. Module Boutique : interrupteur en ligne / coupée ; coupée, l'adresse affiche « Boutique momentanément indisponible » ; rien n'est supprimé.
2. Adresse : nom choisi par le commerçant (lettres, chiffres, tirets), vérifié libre et correct ; sous-domaine `nom.domaine` quand le domaine est configuré, et adresse de secours `/boutique/nom`.
3. Quatre modèles (Vitrine, Catalogue, Grandes photos, Produit unique) + carte « Site personnalisé » qui envoie une demande à l'administrateur.
4. Personnalisation : logo, bannière, couleur dans une palette à bon contraste, texte d'accueil (fr/ar), ordre des sections, réseaux sociaux, WhatsApp, conditions de livraison et de retour ; aperçu sur téléphone avant de publier.
5. Lien avec le stock : interrupteur « Visible dans la boutique » par produit, stock par variante, « Rupture de stock » ou produit masqué selon le réglage, retour automatique dès qu'il y a du stock, pastilles « Plus que N » et « Nouveau », prix barré.
6. Commande sans compte : nom, téléphone, wilaya, commune ; ticket avec numéro court, total, « Paiement à la livraison », téléphone du vendeur en grand, boutons Appeler et WhatsApp ; lien privé pour retrouver le ticket.
7. Option « Carte CIB / Edahabia » visible, avec le message demandé ; bouton « Demander l'activation » côté commerçant ; réglage `paiement_carte_actif` modifiable seulement par l'administrateur.
8. Le ticket crée un devis « Boutique en ligne » et une commande « Nouvelle » ; réservation du stock pendant une durée réglable (24 h par défaut) ; sans confirmation, devis expiré et stock libéré tout seul.
9. Anti-fausses commandes : format du téléphone, limite de tickets par téléphone et par appareil, piège invisible anti-robots, alerte si le numéro a des retours ou des annulations.
10. Notifications : dans l'application (cloche avec pastille) et sur le téléphone (Web Push), qui ouvrent la commande ; pastille des devis en attente sur la carte Factures.

### Utile (fait si simple)

- Recherche et filtre par catégorie dans le modèle Catalogue.
- Panier gardé dans le téléphone de l'acheteur.

### Plus tard

- Vérification du téléphone par SMS (code) : demande un fournisseur de SMS.
- Avis clients, codes promo.
- Nom de domaine propre au commerçant (site personnalisé : traité à la main par l'administrateur).
- Interface de passerelle de paiement certifiée : vide, branchée seulement quand l'administrateur l'activera.
