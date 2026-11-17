# Étape 7 — Recherche : administration de la plateforme, abonnements

Recherche faite le 17/11/2026 (résumés des moteurs de recherche ; les sites ne s'ouvrent pas depuis l'environnement de travail).

## 1. Décisions du propriétaire (17/11/2026)

- **Modules par formule, avec retouche** : chaque formule contient une liste de modules ; l'administrateur peut ajouter ou retirer un module pour un commerçant précis ; le commerçant n'allume que ce que son abonnement contient.
- **La boutique en ligne est un module comme les autres.**
- La fiche produit reste toujours disponible : le module Stock fait partie de toute formule.

## 2. Ce que proposent les outils du domaine

- **Délai de grâce** : 3 à 14 jours selon les éditeurs ; accès complet pendant le délai, puis accès réduit (lecture seule), puis suspension. Le cahier des charges fixe 5 jours puis lecture seule : conforme à ces pratiques.
- **La date d'échéance ne bouge pas** quand le paiement arrive pendant le délai : la période suivante commence à la fin de la précédente, pas au jour du paiement.
- **Rappels** clairs et sans ton menaçant, au moins deux avant l'échéance (le cahier : 7 jours et 1 jour avant).
  Sources : [lostchurn — délai de grâce](https://lostchurn-marketing-staging.pages.dev/glossary/grace-period), [aaxonix](https://aaxonix.com/resources/?p=5340), [Fungies](https://fungies.io/saas-dunning-management-failed-payment-recovery-2026.md), [Kinde](https://kinde.com/learn/billing/churn/dunning-strategies-for-saas-email-flows-and-retry-logic/), [Maxio](https://www.maxio.com/blog/what-is-dunning).
- **Encaissement en Algérie** sans carte : CCP (mandat ou versement), BaridiMob (virement entre comptes CCP), CCP Business Cashless (paiement par QR, lancé en 2026), virement bancaire, espèces. Aucun ne prévient automatiquement un logiciel tiers : le paiement est **vérifié puis saisi à la main** par l'administrateur, avec la référence du versement.
  Sources : [algeriatech — CCP Business Cashless](https://algeriatech.news/baridimob-ccp-business-cashless-algeria-qr-payments-2026/), [algeriatech — BaridiMob](https://algeriatech.news/?p=21571), [Kolonell](https://kolonell.com/fr/blog/logiciel-gestion-reseau-salles-de-sport-alger-2026).

## 3. Ce que demande la réglementation

- L'administrateur vend un service : il facture lui-même ses abonnements (hors de l'application pour l'instant ; voir « Plus tard »).
- Données des commerçants : gardées, jamais effacées sans demande écrite (cahier des charges) ; lecture seule 90 jours après la fin, puis archivées.
- Toute action de l'administrateur sur un commerçant est notée dans le journal des actions sensibles.

## 4. Fonctions proposées

### Indispensable (fait à cette étape)

1. Formules : nom, prix, durée (en jours : 30 pour un mois, 365 pour un an), modules compris, active ou non. Modifiables par l'administrateur.
2. Paiement saisi à la main : montant, moyen (CCP, BaridiMob, virement, espèces), date, référence ; il prolonge l'abonnement d'une durée de la formule, à partir de la fin de la période en cours (ou du jour du paiement si l'abonnement était terminé depuis plus que le délai).
3. Chaque commerçant : formule, date de début, date de fin, historique des paiements, retouche des modules.
4. Le commerçant voit sa date de fin (Réglages › Abonnement) et un rappel dans l'application 7 jours et 1 jour avant.
5. Après la date de fin : 5 jours de délai (réglable), puis lecture seule ; la boutique affiche « Boutique momentanément indisponible ». Après 90 jours (réglable) en lecture seule : archivé. Rien n'est supprimé. Un paiement rouvre le compte.
6. Tableau de l'administration : abonnements actifs, qui expirent bientôt, en délai, en lecture seule ; paiements reçus ; revenu du mois.
7. Demandes (paiement par carte, site personnalisé) : liste avec suivi (déjà commencée à l'étape 6).
8. Liste des 69 wilayas modifiable (nom français, nom arabe, active).

### Utile (fait si simple)

- Montant proposé = prix de la formule ; le paiement garde la formule et la période qu'il a payées.
- Commerçant « sans abonnement » (créé avant cette étape, ou pas encore payé) : signalé dans la liste.

### Plus tard

- Facture d'abonnement de l'administrateur au commerçant (PDF), envoi des rappels par SMS ou e-mail.
- Paiement de l'abonnement en ligne (carte CIB/Edahabia) : jamais codé sans passerelle certifiée.
- Remises, parrainage, essai gratuit automatique.
