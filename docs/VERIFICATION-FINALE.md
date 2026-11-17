# Vérification finale — tout ce que le propriétaire doit essayer, et les questions à trancher

Le propriétaire a choisi de tout vérifier à la fin. Cette liste regroupe les « à essayer » de toutes les étapes.
Le plus simple : installer d'abord le serveur (guide `docs/GUIDE-INSTALLATION.md`), puis tout essayer sur la
**copie de test** (`https://test.votredomaine.dz`), avec un vrai téléphone Android et, si possible, un iPhone.
Chaque bilan (`docs/etape-N/02-bilan.md`) donne le détail.

Astuce : `npm run demo` (ou, sur le serveur, `docker compose … run --rm outils npm run demo` sur la copie de test)
crée un magasin rempli : propriétaire `0550000001` / `hanout demo`, vendeuse `0550000002` / `hanout vente`,
boutique `/b/magasin-demo`. **Jamais sur le site réel.**

## A. Administration (vous)

- [ ] Se connecter à `/admin`, activer la double authentification, noter les codes de secours.
- [ ] Créer vos vraies formules (prix, durée, modules) ; vérifier les délais (5 jours, 90 jours, rappels 7 et 1).
- [ ] Créer un commerçant, ouvrir le lien d'invitation dans une fenêtre privée, choisir son mot de passe.
- [ ] Sur sa fiche : enregistrer un paiement ; vérifier la date de fin ; ajouter un module pour lui seul.
- [ ] Se connecter comme ce commerçant : seuls les modules payés apparaissent.
- [ ] Regarder le revenu du mois, la liste des paiements, les demandes (site personnalisé, paiement par carte).
- [ ] Saisir le barème du droit de timbre (avec votre comptable) ; relire la durée de conservation (10 ans).
- [ ] Suspendre puis réactiver un commerçant ; vérifier que son équipe est déconnectée.

## B. Commerçant : compte, équipe, stock

- [ ] Changer de langue et de thème ; tout doit rester lisible en arabe sur un vrai téléphone.
- [ ] « Ajouter à l'écran d'accueil » sur le téléphone.
- [ ] Inviter un vendeur (avec et sans le droit sur les produits) et un préparateur ; vérifier ce que chacun voit. Le vendeur ne voit jamais le prix d'achat.
- [ ] Bloquer un employé, « Mot de passe oublié », désactiver un module.
- [ ] Créer un produit avec une photo prise au téléphone, puis un produit avec deux tailles.
- [ ] Entrée de stock, sortie « casse », historique.
- [ ] Scanner un vrai produit ; scanner un code inconnu et créer le produit.
- [ ] Inventaire par scan, puis validation.
- [ ] Étiquettes code-barres imprimées, puis scannées.
- [ ] Import Excel de dix produits, deux fois (rien en double).

## C. Caisse et factures

- [ ] Vente à la caisse avec deux produits, monnaie à rendre, ticket PDF.
- [ ] Facture à la caisse ; PDF en français puis en arabe ; partage par WhatsApp.
- [ ] Vendre plus que le stock connu ; le retrouver dans « Stock à vérifier ».
- [ ] Couper le Wi-Fi et les données, vendre, remettre la connexion : la vente part toute seule, une seule fois.
- [ ] Devis : créer, modifier, transformer en facture (« Vente directe », puis « Envoi » sur un autre).
- [ ] Annuler une facture par un avoir ; le stock revient.
- [ ] Clôture de caisse le soir.
- [ ] Réglages › Facturation : activer la TVA avec votre comptable, regarder une facture.

## D. Commandes, colis, clients

- [ ] Réglages › Livraison : transporteur, frais des 69 wilayas.
- [ ] Commande prise au téléphone en moins de 30 secondes (chronométrer).
- [ ] « Pas de réponse », « Envoi », « Colis prêt » (préparateur), « Colis expédié » avec numéro de suivi, « Colis retourné ».
- [ ] Même numéro de téléphone : l'alerte rouge apparaît dès la saisie.
- [ ] Fiche client : taux de retour, total dépensé ; supprimer les données d'un client à sa demande.

## E. Accueil, rapports, export

- [ ] Les quatre chiffres de l'accueil, le graphique 7 / 30 jours, la liste « À faire ».
- [ ] Rapports : marge (vérifier avec une vente connue), commandes, retours par wilaya, meilleurs produits.
- [ ] Export pour le comptable : ouvrir `documents.csv` dans Excel, et un PDF.

## F. Boutique en ligne

- [ ] Choisir l'adresse, publier des produits, couleur, texte, mettre en ligne.
- [ ] Sur un autre téléphone, sans compte : panier, commande, ticket ; choisir « Carte CIB / Edahabia » et lire le message.
- [ ] Côté commerçant : cloche, commande, confirmation.
- [ ] Les quatre modèles ; couper la boutique (« momentanément indisponible »).
- [ ] Activer les notifications sur votre téléphone (Android ; iPhone après « Ajouter à l'écran d'accueil »).
- [ ] Demander un site personnalisé et le retrouver dans l'administration.

## G. Serveur

- [ ] Installer en suivant le guide ; récupérer la clé privée et `app.env` sur une clé USB.
- [ ] Recevoir une alerte d'essai : `./outils.sh prod arreter`, attendre 5 minutes, puis `./outils.sh prod demarrer`.
- [ ] Faire un essai de restauration sur la copie de test (guide, section 8).
- [ ] Faire une mise à jour sur la copie de test, puis sur le site réel ; essayer `./deployer.sh prod retour`.

## Questions à trancher (choix par défaut appliqués en attendant)

| # | Question | Choix par défaut aujourd'hui |
|---|---|---|
| 1 | **Barème du droit de timbre et taux de TVA** (avec un comptable) | Rien n'est ajouté tant que ce n'est pas saisi |
| 2 | **Mot de passe des commerçants** : 8 caractères sans double authentification imposée (votre choix). La norme NIST de 2025 demande 15 caractères quand le mot de passe est utilisé seul. Garder 8, passer à 12 ou 15, ou imposer la double authentification ? | 8 caractères (votre choix du 17/11), liste des mots de passe courants, blocage après 5 essais |
| 3 | **Avoir partiel** (annuler une seule ligne d'une facture) | Plus tard |
| 4 | **Argent reversé par le transporteur** (suivre le jour du versement) | Plus tard |
| 5 | ~~Mettre la branche principale (`main`) à jour~~ | **Fait le 17/11/2026** |
| 6 | **Hébergeur** : lequel choisir (ICOSNET, Djaweb, Octenium…) ; le guide fonctionne avec tous | À choisir |
| 7 | **Déclaration à l'ANPDP** (loi 18-07 / 25-11) | Démarche à faire de votre côté |
| 8 | **Facture d'abonnement** de vous au commerçant, rappels par SMS ou e-mail | Plus tard |

## Points à vérifier dans les textes officiels (non joignables pendant la construction)

- Numérotation des wilayas 59 à 69 (décret 26-206) au Journal officiel ; liste des 1 541 communes à importer.
- Mentions obligatoires de la facture et de l'avoir (décret 05-468), droit de timbre, TVA.
- Durée légale de conservation des factures en Algérie.
- Loi 18-05 : délais de livraison et de retour.
