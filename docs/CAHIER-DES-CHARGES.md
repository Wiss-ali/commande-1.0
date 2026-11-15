# Cahier des charges (texte du propriétaire, à respecter tel quel)

> Texte fourni par le propriétaire du projet le 15/11/2026. Ne pas le modifier sans sa demande.
> Seule adaptation : les étapes sont numérotées de 0 à 8 (voir partie 10), pour que les renvois
> du texte (« étape 0 », « étape 6 », « étape 8 ») tombent juste. Le propriétaire a été informé.

## 1. Rôle et objectif

Tu es un ingénieur full-stack senior et un designer produit. Construis une application web de gestion pour les petits commerçants algériens qui ont déjà un magasin et du stock. Elle leur sert d'abord à gérer le stock, encaisser et facturer. Elle leur permet ensuite d'ouvrir une boutique en ligne reliée au même stock, sans rien ressaisir. Les vendeurs sur Instagram et Facebook sans magasin peuvent l'utiliser aussi.

L'application est multi-commerçants : chaque commerçant a son espace, isolé des autres. Je suis l'administrateur de la plateforme et je la vends par abonnement. Le marché principal est l'Algérie.

Tous les modules partagent une seule base de données. Une vente, où qu'elle soit faite, met à jour le stock, crée la facture et alimente le suivi, sans double saisie.

Les modules restent séparés : chacun a sa page, son menu et son rôle, et peut être activé ou désactivé par le commerçant dans les réglages. Un tableau de bord général fait le pont entre eux. Un commerçant qui ne veut que le stock et la caisse ne voit pas le reste.

L'outil doit rester léger. Ce n'est pas un concurrent de Shopify : il fait peu de choses, mais bien, et un commerçant doit le comprendre en dix minutes.

## 2. Règles de travail

- Avance par étapes (partie 10). Arrête-toi à la fin de chaque étape et attends ma validation.
- Avant de coder, propose le plan, le schéma de la base et les maquettes des écrans principaux.
- N'invente aucune règle fiscale ou légale. Tout taux ou mention légale est un réglage modifiable, jamais une valeur écrite en dur.
- Vérifie la documentation actuelle de chaque outil avant de l'utiliser et prends les dernières versions stables.
- Si une demande est ambiguë ou risquée pour la sécurité, pose la question au lieu de deviner.

**Recherche avant chaque module.** Avant de construire un module, fais une recherche sur le web et présente-moi un court compte rendu, avec tes sources :

- ce que les meilleurs outils du domaine proposent pour ce module, en Algérie et ailleurs ;
- ce que la réglementation algérienne exige pour lui (documents, mentions, conservation des données) ;
- ce dont un petit commerçant algérien a vraiment besoin au quotidien ;
- la liste des fonctions que tu proposes, classées en « indispensable », « utile » et « plus tard ».

Je valide cette liste avant que tu codes. Si la recherche contredit ce prompt, signale-le au lieu de choisir seul.

**Liens entre les modules.** Chaque information n'existe qu'à un seul endroit. Chaque document garde le lien vers ce qui l'a créé et ce qu'il a créé : la commande, le devis, la facture, le mouvement de stock, le colis. Depuis n'importe lequel, on ouvre les autres d'un toucher. À la fin de chaque étape, montre-moi un schéma des liens entre les modules déjà construits.

## 3. Les modules, chacun sur sa page

**Tableau de bord général.** C'est la page d'accueil et le pont entre les modules. En haut, quatre chiffres au maximum : ventes du jour, commandes à confirmer, colis en cours, produits en stock bas. En dessous, une carte par module actif (Stock, Caisse, Factures, Commandes, Boutique en ligne, Clients, Rapports). Chaque carte montre un seul chiffre utile et ouvre le module d'un toucher. La carte Boutique en ligne indique si le site est en ligne ou désactivé. Puis un seul graphique, les ventes sur 7 ou 30 jours, et une liste « À faire » cliquable.

**Produits et stock.** Fiche produit : nom en français et en arabe, photo, prix d'achat, prix de vente, code-barres, variantes (taille, couleur), seuil d'alerte. Chaque mouvement de stock est enregistré avec son auteur : entrée, vente, retour, correction. Inventaire rapide par scan.

**Commandes.** Création manuelle en moins de 30 secondes, ou arrivée automatique depuis la boutique. Statuts : nouvelle, à confirmer, confirmée, préparée, expédiée, livrée, retournée, annulée. Compteur de tentatives d'appel. Adresse par wilaya et commune, avec la liste officielle des 69 wilayas stockée comme donnée modifiable. Livraison à domicile ou en point relais. Frais de livraison par wilaya. Transporteur et numéro de suivi saisis à la main, avec une interface prête pour brancher plus tard les API des transporteurs. Alerte si le numéro de téléphone a déjà des retours.

**Caisse.** Vente en magasin : scan des produits, panier, encaissement en espèces, ticket ou facture.

**Factures.** Numérotation continue sans trou. Une facture émise ne se modifie plus : on la corrige par un avoir. Mentions du vendeur : nom ou raison sociale, forme juridique, adresse, téléphone, registre du commerce, NIF, NIS, article d'imposition. Mentions de l'acheteur, date, numéro, désignation, quantité, prix unitaire hors taxe, taux de TVA réglable par produit, totaux HT, TVA et TTC, mode et date de paiement. Droit de timbre réglable. Export PDF en français ou en arabe. Bon de livraison.

**Devis.** Le module Factures a un onglet « Devis ». Un devis a sa propre numérotation, séparée de celle des factures, et peut être modifié tant qu'il n'est pas transformé. Le vendeur peut créer un devis à la main. Chaque commande passée sur la boutique en ligne crée aussi un devis automatiquement, marqué « Boutique en ligne ». Un bouton « Transformer en facture » crée la facture définitive à partir du devis, sans ressaisie, et garde le lien entre les deux. Statuts d'un devis : en attente, transformé en facture, refusé, expiré.

**Facture proforma et autres documents.** Le module Factures produit toute la chaîne des documents commerciaux, chacun avec sa numérotation et un modèle PDF en français ou en arabe :

- Devis : offre de prix avant l'accord du client.
- Facture proforma : offre détaillée sans valeur comptable, que le client présente par exemple à sa banque pour un crédit. Elle porte la mention « Proforma », une durée de validité, et ne touche ni au stock ni au chiffre d'affaires.
- Bon de commande et bon de livraison.
- Facture définitive, puis facture d'avoir pour corriger ou annuler.
- Reçu de paiement.

Chaque document se transforme en suivant d'un toucher, sans ressaisie : devis ou proforma, puis bon de livraison, puis facture. Vérifie par la recherche quels documents et quelles mentions la réglementation algérienne prévoit, et signale ceux qui manquent à cette liste.

**Clients.** Historique des achats, total dépensé, taux de retour.

**Rapports.** Marge réelle (vente moins achat, livraison et retours), taux de confirmation, taux de livraison, retours par wilaya, meilleurs produits. Un graphique par écran, avec le chiffre clé écrit au-dessus.

**Boutique en ligne.** Page publique par commerçant : catalogue, panier, commande sans compte (nom, téléphone, wilaya, commune). Affiche l'identité du vendeur, les conditions de livraison et de retour.

**Réglages.** Informations légales, équipe et rôles, langue, transporteurs et frais, taux de TVA.

**Administration de la plateforme.** Réservée à moi : liste des commerçants, abonnements, suspension, demandes d'activation du paiement par carte.

## 4. Le parcours d'une commande

Quand une commande est validée, l'écran pose une seule question : « Envoi » ou « Vente directe ».

- **Envoi** : la commande entre dans le suivi des colis. Le stock est réservé, puis déduit à l'expédition. L'argent est compté à la livraison. Un retour remet le stock.
- **Vente directe** : le stock est déduit et la facture est créée tout de suite.

Vente, stock et facture s'écrivent dans une seule transaction de base de données : tout réussit ou rien ne change.

## 5. Le paiement par carte : ne le code pas

N'intègre aucun paiement par carte (CIB, Edahabia). Le paiement à la livraison est le seul mode actif.

- Dans la boutique, l'option « Carte CIB / Edahabia » est visible. Si le client la choisit, affiche : « Le paiement par carte n'est pas encore activé pour cette boutique. Choisissez le paiement à la livraison. »
- Côté commerçant, un bouton « Demander l'activation » m'envoie une demande dans l'administration de la plateforme.
- Chaque commerçant a un réglage `paiement_carte_actif`, faux par défaut. Seul l'administrateur de la plateforme peut le changer.
- Prévois seulement une interface vide pour brancher plus tard une passerelle certifiée. L'application ne doit jamais recevoir ni stocker un numéro de carte.

## 6. Le scan par l'appareil photo

- Fonctionne dans le navigateur, sans application à installer, en HTTPS, avec la caméra arrière.
- Utilise l'API native BarcodeDetector quand elle existe. Sinon, bascule sur une bibliothèque ZXing en WebAssembly, nécessaire sur Safari iPhone.
- Formats : EAN-13, EAN-8, UPC-A, Code 128, QR code.
- Vibration et son à la lecture, lampe torche si le téléphone le permet, saisie manuelle de secours.
- Génère et imprime des étiquettes code-barres ou QR pour les produits qui n'en ont pas.
- Le scan sert partout : ajouter un produit, chercher, vendre en caisse, préparer un colis, faire l'inventaire.

## 7. Design : mobile d'abord

- Conçois chaque écran pour un téléphone de 360 px de large, puis élargis pour la tablette et l'ordinateur.
- Barre de navigation en bas avec cinq entrées : Accueil, Caisse, Scan (au centre), Stock, Plus.
- Une action principale par écran. Boutons d'au moins 44 px, utilisables au pouce.
- Écrans légers : peu de chiffres, un graphique simple (barres ou lignes), le détail un niveau plus bas.
- L'état se voit par la forme et la couleur : pastille de statut sur chaque commande, alerte sur le stock bas.
- Thèmes clair et sombre. Contrastes conformes WCAG AA.
- Prévois les états vide, chargement et erreur de chaque écran, avec des messages qui disent quoi faire.
- L'application reste rapide sur une connexion lente. Elle est installable sur l'écran d'accueil (PWA). La caisse garde les ventes en attente si la connexion coupe, puis les envoie.
- Donne-lui une identité propre : une palette et une typographie choisies pour ce produit, pas un modèle générique.

## 8. Langues : français et arabe

- Un bouton de langue en haut de chaque écran, y compris la boutique et la page de connexion. Le changement est immédiat et mémorisé par utilisateur.
- L'arabe s'affiche de droite à gauche, de façon native : propriétés CSS logiques, icônes directionnelles inversées, police arabe lisible.
- Aucun texte écrit en dur : tout passe par des fichiers de traduction.
- Montants en dinars (« 12 500 DA » et « د.ج » en arabe), chiffres 0-9, dates au format JJ/MM/AAAA, téléphones algériens à 10 chiffres.
- Teste chaque écran dans les deux langues avec du vrai contenu arabe.

## 9. Sécurité et technique

**Isolation des commerçants.** PostgreSQL avec un identifiant de commerçant sur chaque table. Row Level Security activée et forcée. L'application se connecte avec un rôle qui n'est pas propriétaire des tables. Des tests automatiques prouvent qu'un commerçant ne peut ni lire ni modifier les données d'un autre.

**Comptes.** Mots de passe hachés avec Argon2id. Sessions par cookies HttpOnly, Secure et SameSite. Double authentification possible, obligatoire pour l'administrateur de la plateforme. Blocage après plusieurs échecs de connexion. Rôles : propriétaire, vendeur, préparateur. Journal de toutes les actions sensibles.

**Application.** Validation de toutes les entrées côté serveur. Requêtes paramétrées. Protection CSRF, politique CSP stricte, en-têtes de sécurité, limites de débit. Identifiants non devinables (UUID). Images envoyées vérifiées et redimensionnées. Secrets dans des variables d'environnement. Dépendances verrouillées et auditées.

**Données et argent.** HTTPS partout, chiffrement au repos, sauvegardes quotidiennes chiffrées avec test de restauration. Montants stockés en entiers, jamais en nombres à virgule. Clé d'idempotence pour qu'un double clic ne crée pas deux commandes. Le moins de données personnelles possible, avec export et suppression sur demande.

**Chiffrement.**

- En transit : TLS 1.3 (1.2 au minimum) sur toutes les connexions, y compris entre l'application et la base de données, avec HSTS.
- Au repos : disque et base de données chiffrés en AES-256.
- Champ par champ, en plus : les téléphones et adresses des acheteurs, les numéros légaux des commerçants et les secrets de double authentification sont chiffrés en AES-256-GCM avant d'être écrits dans la base.
- Les clés sont stockées en dehors de la base, jamais dans le code, et peuvent être renouvelées sans perte de données.
- Les sauvegardes sont chiffrées avec une clé différente et stockées sur un autre serveur.
- Aucune donnée personnelle, aucun mot de passe et aucune clé n'apparaît dans les journaux techniques.
- Chaque passage d'un module à un autre revérifie les droits de l'utilisateur côté serveur.

Vérifie par la recherche que ces choix correspondent aux recommandations actuelles (OWASP, NIST) et propose mieux si elles ont changé.

**Conservation et export des données.** Les données sont gardées sur le serveur, qui fait référence, et le commerçant peut en télécharger une copie quand il veut.

- Chaque document se télécharge en PDF d'un toucher et se partage par WhatsApp ou e-mail.
- Un bouton « Exporter » produit, pour une période choisie, une archive avec tous les PDF et des fichiers CSV lisibles dans Excel : factures, ventes, stock, clients. Le comptable du commerçant doit pouvoir s'en servir tel quel.
- Un rappel mensuel propose au commerçant de télécharger l'archive du mois.
- Les factures et documents comptables sont conservés pendant une durée réglable par l'administrateur, 10 ans par défaut. Vérifie par la recherche la durée légale en Algérie.
- Une facture émise ne peut jamais être supprimée, même par le commerçant.
- Si un abonnement se termine, les données restent consultables et exportables en lecture seule pendant 90 jours, puis sont archivées. Rien n'est effacé sans une demande écrite du commerçant.

**Référence.** Utilise OWASP ASVS niveau 2 et le Top 10 OWASP comme liste de contrôle, et dis-moi à la fin ce qui est couvert et ce qui ne l'est pas.

**Outils proposés.** TypeScript partout, Next.js et React, PostgreSQL, Tailwind CSS avec des composants accessibles, tests avec Vitest et Playwright. Le tout se déploie avec Docker sur un seul serveur, y compris chez un hébergeur en Algérie, sans dépendre d'un service cloud étranger. Si tu as un meilleur choix, propose-le à l'étape 0 et explique pourquoi.

**Mise en ligne et exploitation.** L'application est installée une seule fois et sert tous les commerçants. Il n'y a jamais une installation par client.

- Tous les commerçants se connectent à la même adresse, avec leur propre compte.
- Chaque boutique en ligne a son sous-domaine, par exemple magasin-ali.mondomaine.dz, qui pointe vers la même application. Le commerçant choisit ce nom, et l'application vérifie qu'il est libre et correct.
- Deux environnements séparés : une copie de test et le site réel. Toute modification passe d'abord par la copie de test.
- Mise à jour sans coupure, avec retour à la version précédente en une commande si quelque chose casse. Les changements de base de données sont versionnés et réversibles.
- Une page d'état interne vérifie l'application, la base et les sauvegardes. Une alerte m'est envoyée si le site ne répond plus ou si une sauvegarde échoue.
- Sauvegarde automatique chaque jour, gardée 30 jours, avec une procédure de restauration testée.
- À l'étape 8, écris un guide pas à pas pour un débutant : louer le serveur, installer, mettre à jour, restaurer une sauvegarde, réagir à une alerte.

## 10. Les étapes (numérotées de 0 à 8)

0. Plan, schéma de la base, maquettes de l'accueil, des commandes, du scan, d'une facture et de la boutique. Arrêt.
1. Socle : comptes sur invitation, commerçants, isolation, deux langues, navigation.
2. Produits, stock et scan.
3. Caisse, factures PDF, choix « Envoi » ou « Vente directe ».
4. Commandes à livrer et suivi des colis.
5. Accueil et rapports.
6. Boutique en ligne avec ses quatre modèles, lien avec le stock, message du paiement par carte, demandes d'activation et de site personnalisé.
7. Administration de la plateforme.
8. Renforcement de la sécurité, tests complets, guide d'installation.

## 11. Quand une étape est terminée

- Les tests automatiques passent, y compris ceux d'isolation entre commerçants.
- Chaque écran fonctionne sur téléphone, en français et en arabe, en clair et en sombre.
- Tu me donnes la liste de ce qui est fait, de ce qui ne l'est pas, et de ce que je dois essayer moi-même.

## 12. Modèles de boutique et lien avec le stock

Cette partie se construit à l'étape 6.

**Quatre modèles au choix.** Le commerçant choisit un modèle et peut en changer sans perdre ses produits.

- Vitrine : grille classique de produits, pour un petit catalogue.
- Catalogue : catégories, recherche et filtres, pour beaucoup de produits.
- Grandes photos : images en pleine largeur, pour la mode et la décoration.
- Produit unique : une page de vente pour un seul produit, avec le formulaire de commande sur la même page.

**Personnalisation de chaque modèle.** Logo, bannière, couleur principale choisie dans une palette qui garde un bon contraste, texte d'accueil, ordre des sections, liens vers les réseaux sociaux, numéro WhatsApp. Aperçu en direct sur téléphone avant de publier. Les quatre modèles fonctionnent en français et en arabe.

**Site personnalisé.** Une cinquième carte « Site personnalisé » est visible dans le choix des modèles. Elle affiche : « Un site créé sur mesure pour votre marque. Service payant en supplément. » Le bouton « Demander un site personnalisé » m'envoie une demande dans l'administration de la plateforme, avec le nom et le téléphone du commerçant. Rien d'autre n'est automatisé : je traite la demande moi-même.

**Lien avec le stock.**

- Seuls les produits présents dans le stock peuvent être publiés. Chaque produit a un interrupteur « Visible dans la boutique ».
- Quand le stock tombe à zéro, le produit passe tout seul en « Rupture » ou disparaît de la boutique, selon le réglage du commerçant. Il revient dès qu'il y a du stock, y compris après un retour.
- Le stock est réservé au moment de la commande, pour ne jamais vendre deux fois le même article.
- Chaque variante (taille, couleur) a son propre stock.
- Options : pastille « Plus que 3 », pastille « Nouveau », prix barré pour une promotion.
- Une vente en caisse met à jour la boutique tout de suite.

**Affichage des ruptures.** Par défaut, un produit épuisé reste visible avec la mention « Rupture de stock » bien lisible et un bouton de commande désactivé. Le commerçant peut choisir de le masquer à la place.

**Activer ou désactiver le site.** La boutique en ligne est facultative et désactivée à la création du compte. Un interrupteur dans le module la met en ligne ou la coupe. Coupée, son adresse affiche « Boutique momentanément indisponible », et rien n'est supprimé : produits, modèle et réglages restent prêts. Le stock, la caisse et les factures continuent de fonctionner normalement.

## 13. Comptes et abonnements

Cette partie se construit aux étapes 1 et 7.

**Création de compte sur invitation.** Personne ne peut s'inscrire librement. Depuis l'administration, je crée un lien d'invitation pour un commerçant précis. Le lien est à usage unique, expire après 7 jours, contient un jeton aléatoire impossible à deviner, et peut être annulé. Le commerçant choisit son mot de passe et remplit ses informations.

**Abonnement mensuel ou annuel.** Comme le paiement par carte n'est pas intégré, je reçois l'argent en dehors de l'application (CCP, BaridiMob, virement, espèces) et j'enregistre le paiement à la main dans l'administration.

- Chaque commerçant a une formule, une date de début et une date de fin.
- Le commerçant voit sa date de fin et reçoit un rappel dans l'application 7 jours et 1 jour avant.
- Après la date de fin, 5 jours de délai, puis le compte passe en lecture seule et la boutique affiche « Boutique momentanément indisponible ». Aucune donnée n'est supprimée.
- L'administration montre les abonnements actifs, ceux qui expirent bientôt, les paiements reçus et le revenu du mois.
- Les formules, les prix et les durées sont des réglages que je peux modifier.

## 14. Commande sans compte, confirmée par téléphone

Cette partie se construit à l'étape 6. L'acheteur ne crée jamais de compte et ne choisit jamais de mot de passe.

**Côté acheteur.**

1. Il choisit un ou plusieurs produits et touche « Valider ».
2. Il donne seulement son nom, son téléphone, sa wilaya et sa commune.
3. Il voit tout de suite son ticket de commande : un numéro court, la liste des produits, le total, et la mention « Paiement à la livraison ».
4. Sur ce ticket, le numéro de téléphone du vendeur est affiché en grand, avec un bouton « Appeler » et un bouton « WhatsApp ». Le message indique : « Appelez le vendeur et donnez-lui votre numéro de ticket pour confirmer. »
5. Il peut retrouver son ticket plus tard grâce à un lien privé impossible à deviner.

**Côté vendeur.**

1. La commande crée automatiquement un devis dans le module Factures, onglet « Devis », avec le numéro du ticket, les produits, le total et le téléphone de l'acheteur.
2. Le vendeur reçoit une notification qui ouvre ce devis. Elle arrive dans l'application et, s'il l'autorise, sur son téléphone même quand l'application est fermée. Une pastille sur la carte Factures du tableau de bord compte les devis en attente.
3. Quand l'acheteur appelle, le vendeur cherche le numéro du ticket dans les devis. Le devis propose « Appeler », « Modifier », « Transformer en facture » et « Refuser ».
4. Une fois d'accord avec l'acheteur, il touche « Transformer en facture ». L'écran demande alors « Envoi » ou « Vente directe » (partie 4).

**Règles.**

- Le ticket de l'acheteur correspond à un devis, pas à une facture. La facture est créée seulement quand le vendeur transforme le devis, pour qu'une fausse commande ne consomme jamais un numéro de facture.
- Le stock est réservé à la création du ticket pendant une durée réglable, 24 heures par défaut. Sans transformation en facture, le devis passe en « expiré » et le stock est libéré tout seul.
- Contre les fausses commandes : vérification du format du téléphone, limite du nombre de tickets par téléphone et par appareil, piège anti-robots invisible, et alerte au vendeur si ce numéro a déjà des commandes refusées ou retournées.
- Le téléphone de l'acheteur n'est visible que par le vendeur concerné.

## Demandes complémentaires du propriétaire (15/11/2026)

- L'ancien projet PHP du dépôt est abandonné : tout a été supprimé, y compris les logos. La nouvelle application le remplace, y compris sur `main`.
- Le produit est pensé comme un « pack complet à revendre ».
- Tenir un journal dans `docs/journal/` après chaque action importante, pour qu'une autre session Claude puisse reprendre.
