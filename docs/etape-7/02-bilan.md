# Étape 7 — Bilan : administration de la plateforme et abonnements

Terminée le 17/11/2026. Vérification par le propriétaire prévue à la fin du projet.
Recherche et liste des fonctions : `docs/etape-7/01-recherche-administration.md`.

## Décisions du propriétaire appliquées

- Modules **par formule, avec retouche** commerçant par commerçant.
- La **boutique en ligne est un module comme les autres**.
- Le module Stock (les fiches produits) est compris dans toute formule.

## Fait

| Fonction | Où |
|---|---|
| Tableau : abonnements actifs, qui expirent dans 7 jours, terminés ou en lecture seule, revenu du mois ; chaque chiffre ouvre la liste | `/admin` |
| Liste des commerçants avec formule, date de fin et état de l'abonnement ; filtres « Bientôt », « En délai », « Lecture seule », « Sans abonnement » | `/admin` |
| Formules : nom, prix, durée en jours (30 un mois, 365 un an), modules compris, active ou non ; modifiables | `/admin/formules` |
| Paiement reçu hors application (CCP, BaridiMob, virement, espèces) : formule, montant (prix de la formule par défaut), date, référence ; il prolonge l'abonnement | fiche du commerçant |
| La période suivante commence à la fin de la précédente (l'échéance ne bouge pas) ; si l'abonnement était fini depuis plus que le délai, elle commence le jour du paiement | serveur |
| Retouche des modules d'un commerçant : « Selon la formule », « Ajouté » ou « Retiré » | fiche du commerçant |
| Historique des paiements de chaque commerçant, et de tous les paiements mois par mois | fiche, `/admin/paiements` |
| Réglages : délai après la fin (5 jours), durée de la lecture seule (90 jours), jours des deux rappels (7 et 1) | `/admin/reglages` |
| Liste des 69 wilayas modifiable (noms, proposée ou non) | `/admin/wilayas` |
| Demandes (paiement par carte, site personnalisé) traitées depuis le tableau | `/admin` |
| Commerçant : formule, période, jours restants, modules compris, ses paiements | Réglages › Abonnement |
| Rappel dans l'application 7 jours avant la fin (et jusqu'au dernier jour), puis pendant le délai | bandeau en haut des écrans du propriétaire |
| Après le délai : lecture seule, boutique « momentanément indisponible » ; après 90 jours : archivé (connexion fermée). Rien n'est supprimé ; un paiement rouvre | serveur |
| Modules non compris dans l'abonnement : grisés « Non compris dans votre abonnement », absents des menus, refusés par le serveur même en tapant l'adresse | partout |

## Règles garanties

- L'état et les modules sont recalculés à **chaque requête** d'après l'abonnement : même si la tâche périodique n'a pas tourné, un abonnement fini passe en lecture seule à la bonne date.
- Un paiement enregistré et sa période ne se modifient plus et ne se suppriment pas (la base le refuse).
- Le commerçant lit ses paiements, mais ne peut ni en créer ni changer ses modules autorisés (la base le refuse).
- Une suspension décidée par l'administrateur prime toujours sur l'abonnement.
- Chaque action de l'administrateur (formule, paiement, modules, délais, wilayas) est notée dans le journal.

## Tests automatiques

- **140 tests** unitaires et d'intégration, dont 10 nouveaux : règles de dates, modules, formules, paiements successifs, échéance qui ne bouge pas, lecture seule, archivage, réouverture, modules limités dans la session et dans la boutique, droits refusés au commerçant, tableau.
- **69 parcours de bout en bout**, dont 8 nouveaux : création des formules, paiement BaridiMob, modules limités puis retouchés, rappel, lecture seule, tableau, paiements, délais, wilayas, arabe en thème sombre.
- Captures : `docs/etape-7/captures/`.

## Pas fait, ou différent du plan

- **Facture de l'abonnement** (de vous au commerçant) : pas encore ; vous facturez hors de l'application.
- **Rappels par SMS ou e-mail** : seulement dans l'application (aucun fournisseur de SMS ou d'e-mail n'est encore choisi).
- **Commerçants créés avant cette étape** : « Sans abonnement », tous les modules ouverts jusqu'au premier paiement enregistré.
- **Changement de formule en cours de période** : la nouvelle formule s'applique à la période payée suivante (pas de prorata).
- Paiement de l'abonnement en ligne : jamais sans passerelle certifiée.

## À essayer par le propriétaire (à la fin)

1. Créer vos vraies formules (prix et modules).
2. Sur la fiche d'un commerçant : enregistrer un paiement, vérifier la date de fin.
3. Se connecter comme ce commerçant : vérifier que seuls les modules payés apparaissent.
4. Ajouter un module à ce commerçant seul.
5. Regarder le revenu du mois et la liste des paiements.
6. Dans Réglages de l'administration : relire les délais (5 jours, 90 jours, rappels 7 et 1).

## Liens entre les modules construits

```
   ADMINISTRATEUR ──► FORMULES (prix, durée, modules)
        │                   │
        └─► PAIEMENT reçu ──┴─► PÉRIODE d'abonnement ──► ÉTAT du commerçant (actif, délai, lecture seule, archivé)
                                       │                         │
                                       ▼                         ▼
                      MODULES autorisés (formule ± retouche)   BOUTIQUE en ligne coupée si lecture seule
                                       │
                                       ▼
            menus, pages et actions du commerçant (vérifiés à chaque requête)
   COMMERÇANT ──► Réglages › Abonnement (dates, paiements) ; rappel 7 j et 1 j ; DEMANDES ──► ADMINISTRATEUR
```
