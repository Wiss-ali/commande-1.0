# Étape 2 — Bilan : produits, stock et scan

Terminée le 16/11/2026. En attente de la validation du propriétaire.

## Fait

| Fonction | Où |
|---|---|
| Fiche produit : nom français et arabe, catégorie, photo, prix d'achat, prix de vente, code-barres, seuil d'alerte | `/stock/nouveau`, `/stock/…/modifier` |
| Variantes (taille, couleur), chacune avec son stock, son prix et son code | même formulaire |
| Liste du stock : recherche par nom ou code, filtres « Stock bas », « Rupture », « Archivés », pastilles de statut | `/stock` |
| Valeur du stock au prix d'achat (propriétaire seulement) | `/stock` |
| Entrée de stock (toute l'équipe), sortie pour casse, perte, périmé, erreur (propriétaire) | fiche du produit |
| Historique : chaque mouvement garde son auteur, son motif, la date et le stock obtenu | fiche du produit, `/stock/mouvements` |
| Scan par l'appareil photo : lecteur du téléphone, sinon lecteur de secours (iPhone), son, vibration, lampe, saisie manuelle | `/scan`, `src/components/Scanner.tsx` |
| Le scan sert à : chercher un produit, créer un produit à partir d'un code inconnu, remplir le code d'une fiche, compter l'inventaire | |
| Inventaire par scan : comptage, recherche par nom, écarts, validation par le propriétaire, historique des inventaires | `/stock/inventaire` |
| Étiquettes code-barres ou QR, feuille A4 ou rouleau 50 × 30 mm, avec ou sans prix | `/stock/etiquettes` |
| Code interne (commence par 2) pour les produits sans code-barres | fiche du produit, étiquettes |
| Import depuis Excel ou CSV : modèle à télécharger, aperçu avant de confirmer, lignes fausses signalées, pas de doublon | `/stock/import` |
| Archiver un produit (rien n'est supprimé), le rétablir | fiche du produit |
| Carte « Stock » de l'accueil : nombre de produits en alerte | `/` |

## Règles garanties par la base de données elle-même

- Le stock ne change **que** par un mouvement. Le programme n'a pas le droit d'écrire une quantité directement : un déclencheur applique chaque mouvement.
- Le stock ne peut pas passer sous zéro, ni sous la quantité réservée.
- Un mouvement ne se modifie pas et ne s'efface pas.
- Un code-barres ne désigne qu'un seul article en vente chez un commerçant.
- Un inventaire validé ou annulé est figé, ainsi que ses lignes.
- Un double toucher ne crée pas deux mouvements (clé d'idempotence).
- Les huit nouvelles tables sont isolées par commerçant (RLS activée et forcée), comme celles de l'étape 1.

## Tests automatiques

- **75 tests** unitaires et d'intégration (`npm test`), dont 32 nouveaux : mouvements, stock jamais négatif, droits de la base, isolation entre commerçants, inventaire, lecture d'un vrai fichier Excel, codes-barres, photos (une fausse image est refusée, les métadonnées sont retirées).
- **22 parcours de bout en bout** (`npm run test:e2e`), dont 12 nouveaux sur un écran de 360 px. Le navigateur de test a une fausse caméra qui filme un code-barres : le scan est donc vraiment essayé, avec le lecteur de secours.
- Chaque écran est vérifié en français clair et en arabe sombre, sans débordement en largeur, sans erreur de script ni violation de la politique de sécurité.
- `npm audit` : aucune faille connue. Captures d'écran : `docs/etape-2/captures/`.

## Défauts trouvés et corrigés pendant les tests

- En arabe, « 1 200 د.ج » s'affichait « 200 1 ». L'espace insécable ne suffisait pas : le nombre est maintenant isolé pour rester écrit de gauche à droite (`formaterMontant`).
- Le titre arabe « الفئة » (catégorie) du modèle Excel n'était pas reconnu à l'import.

## Pas fait, ou différent du plan

- **Vrai téléphone** : le scan est testé avec une fausse caméra sur Chromium. Il reste à l'essayer sur un Android et un iPhone réels (il faut le HTTPS, donc un vrai serveur ou un tunnel).
- **Scan en caisse et pour préparer un colis** : le composant est prêt, il sera branché aux étapes 3 et 4.
- **Droits** (décidé le 17/11/2026) : le vendeur peut ajouter un produit, sans prix d'achat. Modifier un prix, archiver, importer et corriger le stock restent au propriétaire.
- **Une seule photo par produit** dans les écrans ; la base en accepte plusieurs (utile à la boutique, étape 6).
- **Taux de TVA par produit** : ajouté à l'étape 3, avec les factures.
- **Catégories** : créées depuis la fiche produit ou l'import ; pas encore d'écran pour les renommer ou les supprimer.
- **Inventaire** : seuls les articles comptés sont corrigés. Il se fait en ligne (pas hors connexion).
- Fournisseurs, dates de péremption, notification de stock bas sur le téléphone : « plus tard », voir la recherche.
- Docker : volume des photos ajouté, toujours non testé (étape 8).

## À essayer par le propriétaire

1. Créer un produit simple avec une photo prise au téléphone, puis un produit avec deux tailles.
2. Faire une entrée de stock, puis une sortie « casse » ; regarder l'historique.
3. Ouvrir « Scan » et viser un vrai produit ; scanner un code inconnu et créer le produit.
4. Commencer un inventaire, scanner quelques articles, changer une quantité à la main, valider.
5. Créer un code pour un produit sans code-barres et imprimer une planche d'étiquettes ; scanner l'étiquette imprimée.
6. Télécharger le modèle Excel, y mettre dix produits, l'importer. L'importer une seconde fois : rien ne doit être créé en double.
7. Se connecter comme vendeur : il peut ajouter un produit, mais ne voit pas le prix d'achat et ne peut pas modifier une fiche.
8. Passer en arabe et vérifier les noms, les montants et le sens de lecture.

## Liens entre les éléments construits

```
 CATÉGORIE ◄── PRODUIT ──► PHOTO
                  │
                  ▼
              VARIANTE ──► STOCK (quantité, réservée)
              (code-barres)    ▲
                  ▲            │ appliqué par la base
                  │        MOUVEMENT ──► auteur (UTILISATEUR)
        SCAN ─────┘            ▲   └──► document d'origine (vente, facture… étapes 3 à 6)
   (chercher, créer,           │
    compter)              INVENTAIRE ──► LIGNES (compté, attendu, écart)
                               ▲
        IMPORT EXCEL ──► PRODUITS + mouvements « import »
        ÉTIQUETTES ◄── VARIANTES (code interne si besoin)
        ACCUEIL ◄── nombre de produits en alerte
```

Depuis la fiche d'un produit, on ouvre son historique, ses étiquettes et sa modification d'un toucher.
Depuis un mouvement de l'historique général, on ouvre le produit.
