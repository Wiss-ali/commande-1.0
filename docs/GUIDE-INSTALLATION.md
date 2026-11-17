# Guide d'installation et d'exploitation — pas à pas, pour un débutant

Ce guide installe Hanout **une seule fois**, sur **un seul serveur**, pour **tous** vos commerçants.
Il contient deux environnements séparés sur ce serveur :

- le **site réel** (« prod ») : `https://votredomaine.dz`, l'administration `https://votredomaine.dz/admin`,
  et chaque boutique `https://nom-boutique.votredomaine.dz` ;
- la **copie de test** (« test ») : `https://test.votredomaine.dz`, pour essayer chaque mise à jour avant le site réel.

Tout ce qui est décrit ici a été essayé de bout en bout pendant la construction (installation, HTTPS, boutiques en
sous-domaine, mise à jour sans coupure, retour arrière, sauvegarde, restauration, alertes).

> Dans ce guide, remplacez toujours `votredomaine.dz` par votre vrai nom de domaine, et `1.2.3.4` par l'adresse de votre serveur.
> Les lignes dans les cadres gris sont à copier-coller dans le terminal du serveur, une par une.

---

## 1. Ce qu'il vous faut

| Quoi | Pourquoi | Combien (ordre d'idée) |
|---|---|---|
| Un **nom de domaine** (`.dz` ou `.com`) | L'adresse du site et des boutiques | Chez un registraire (.dz : via le CERIST / un revendeur agréé) |
| Un **serveur VPS** (Ubuntu 24.04, 2 processeurs, 4 Go de mémoire, 60 Go de disque) | Fait tourner l'application | Chez un hébergeur en Algérie (voir ci-dessous) |
| Un **second espace de stockage** (un petit second serveur, ou un espace accessible en SSH) | Garder une copie des sauvegardes ailleurs | Le moins cher suffit |
| Votre **ordinateur** (Windows, Mac ou Linux) | Vous connecter au serveur, garder la clé des sauvegardes | — |
| Votre **téléphone** avec l'application **ntfy** (gratuite) | Recevoir les alertes | — |

**Hébergeurs avec des serveurs en Algérie** (recommandé pour la loi 18-07 sur les données personnelles) :
ICOSNET, Algérie Télécom / Djaweb, Octenium, ISSAL NET. Demandez-leur :
1. un VPS **Ubuntu 24.04** ;
2. un **disque chiffré** (chiffrement au repos exigé par le cahier des charges) ;
3. la confirmation écrite que le serveur est **en Algérie** ;
4. un accès **SSH** (adresse IP, utilisateur, mot de passe ou clé).

---

## 2. Régler le nom de domaine (DNS)

Dans l'espace client de votre nom de domaine, créez deux enregistrements de type **A** :

| Nom | Type | Valeur |
|---|---|---|
| `@` (le domaine lui-même) | A | `1.2.3.4` |
| `*` (tous les sous-domaines : boutiques et copie de test) | A | `1.2.3.4` |

Attendez jusqu'à une heure que ce soit pris en compte.

---

## 3. Se connecter au serveur

- **Windows** : ouvrez « Terminal » (ou « PowerShell »).
- **Mac** : ouvrez l'application « Terminal ».

```
ssh root@1.2.3.4
```

Tapez `yes` à la première question, puis le mot de passe donné par l'hébergeur. Vous êtes sur le serveur.

### Sécuriser le serveur (une fois)

```
apt update && apt upgrade -y
apt install -y ufw unattended-upgrades git docker.io docker-compose-v2 docker-buildx rsync
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
dpkg-reconfigure -plow unattended-upgrades
```

(La dernière commande pose une question : répondez « Oui ». Les mises à jour de sécurité d'Ubuntu se feront seules.)

---

## 4. Installer Hanout

### 4.1 Récupérer le programme

```
mkdir -p /srv && cd /srv
git clone https://github.com/Wiss-ali/commande-1.0.git hanout
cd /srv/hanout/deploiement
```

Si le dépôt GitHub est privé, `git` demande un identifiant : votre nom d'utilisateur GitHub et, comme mot de passe,
un « jeton d'accès » (GitHub › Settings › Developer settings › Personal access tokens, droit de lecture seulement).

### 4.2 Le HTTPS (Caddy)

```
./installer.sh proxy votre-email@exemple.com votredomaine.dz
```

Les certificats HTTPS (Let's Encrypt) se créent et se renouvellent tout seuls.

### 4.3 Le site réel et la copie de test

```
./installer.sh environnement prod votredomaine.dz
./installer.sh environnement test test.votredomaine.dz
```

Ces commandes créent tous les mots de passe, les clés de chiffrement et les certificats internes. **Personne ne les tape à la main.**

### 4.4 ⚠ Récupérer les clés sur votre ordinateur (très important)

Sur **votre ordinateur** (pas sur le serveur), ouvrez un autre terminal et tapez :

```
scp root@1.2.3.4:/srv/hanout/deploiement/secrets/prod/CLE-PRIVEE-A-RECUPERER.asc .
scp root@1.2.3.4:/srv/hanout/deploiement/secrets/prod/app.env ./app-prod.env
```

Rangez ces deux fichiers **en lieu sûr** : une clé USB dans un tiroir fermé, et une seconde copie ailleurs.

- `CLE-PRIVEE-A-RECUPERER.asc` : la seule clé qui ouvre les sauvegardes.
- `app-prod.env` : les clés qui ouvrent les données chiffrées (téléphones, adresses, numéros légaux).

**Sans ces deux fichiers, une sauvegarde ne peut pas être relue.** Puis, de retour sur le serveur, effacez la clé privée :

```
rm /srv/hanout/deploiement/secrets/prod/CLE-PRIVEE-A-RECUPERER.asc /srv/hanout/deploiement/secrets/test/CLE-PRIVEE-A-RECUPERER.asc
```

### 4.5 Premier lancement

```
./deployer.sh test
./deployer.sh prod
```

La première fois, comptez 5 à 10 minutes. Le message final est « Version … en service ».

### 4.6 Créer votre compte administrateur

```
./outils.sh prod admin votre-email@exemple.com
```

Choisissez un mot de passe d'au moins 15 caractères (une phrase est idéale). Ouvrez ensuite
`https://votredomaine.dz/admin` : la double authentification est demandée à la première connexion
(application Google Authenticator, Aegis ou 2FAS sur votre téléphone). **Notez les codes de secours sur papier.**

### 4.7 Les notifications sur le téléphone des commerçants (facultatif mais conseillé)

```
./outils.sh prod cles-push
nano secrets/prod/app.env
```

Recopiez les trois lignes affichées (`VAPID_PUBLIQUE`, `VAPID_PRIVEE`, `VAPID_CONTACT`) à la place des lignes vides,
enregistrez (`Ctrl+O`, `Entrée`, `Ctrl+X`), puis `./deployer.sh prod`. **Ne changez plus jamais ces clés** :
sinon tous les téléphones inscrits seraient désabonnés.

---

## 5. Alertes et copie des sauvegardes

### 5.1 Recevoir les alertes sur votre téléphone

1. Installez **ntfy** sur votre téléphone (Play Store ou App Store).
2. Inventez un nom de sujet difficile à deviner, par exemple `hanout-alertes-8f3k29xq`, et abonnez-vous à ce sujet dans ntfy.
3. Sur le serveur :

```
nano secrets/alerte.env
```

Écrivez (avec votre sujet) :

```
ALERTE_URL=https://ntfy.sh/hanout-alertes-8f3k29xq
DESTINATION_SAUVEGARDES=utilisateur@adresse-du-second-serveur:/sauvegardes/hanout
```

Le message d'alerte ne contient aucune donnée de client.

### 5.2 Copie des sauvegardes sur le second serveur

Sur le serveur Hanout :

```
ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519
ssh-copy-id utilisateur@adresse-du-second-serveur
```

(Tapez le mot de passe du second serveur une dernière fois.)

### 5.3 Programmer la surveillance et la copie

```
./installer.sh cron
```

Désormais : vérification toutes les 5 minutes, sauvegarde chaque nuit (3 h 30), copie sur le second serveur à 4 h 45.

---

## 6. Tous les jours : rien à faire

- Sauvegarde automatique chaque nuit, gardée 30 jours sur le serveur (et sans limite sur le second serveur).
- Si le site ne répond plus, si la base tombe ou si une sauvegarde échoue : **une alerte arrive sur votre téléphone**,
  puis un message « de nouveau en service » quand tout repart.
- Pour vérifier vous-même :

```
cd /srv/hanout/deploiement
./outils.sh prod etat
```

Tous les services doivent être « Up » ; `app_bleu`, `app_vert` et `base` doivent être « healthy ».

---

## 7. Mettre à jour (sans coupure)

```
cd /srv/hanout && git pull
cd deploiement
./deployer.sh test
```

Ouvrez `https://test.votredomaine.dz` et essayez ce qui a changé. Si tout va bien :

```
./deployer.sh prod
```

Pendant la mise à jour du site réel, une sauvegarde est faite d'abord, puis les deux copies de l'application
redémarrent **l'une après l'autre** : les commerçants ne voient aucune coupure (essayé : 381 visites pendant une
mise à jour, aucune erreur). Si la nouvelle version ne démarre pas correctement, **l'ancienne est remise toute seule**.

### Revenir à la version précédente

```
./deployer.sh prod retour
```

### Annuler une modification de la base (rare)

Si la notice de la mise à jour le demande seulement :

```
./outils.sh prod annuler-migration
./deployer.sh prod retour
```

---

## 8. Restaurer une sauvegarde

Les sauvegardes sont dans `/srv/hanout/sauvegardes/prod/` (un dossier par sauvegarde, daté) et sur le second serveur.

1. Copiez la clé privée de votre ordinateur vers le serveur :

```
scp CLE-PRIVEE-A-RECUPERER.asc root@1.2.3.4:/root/
```

2. Sur le serveur, choisissez la sauvegarde (la plus récente est en bas) :

```
ls /srv/hanout/sauvegardes/prod/
cd /srv/hanout/deploiement
./restaurer.sh prod /srv/hanout/sauvegardes/prod/2026-11-17_033000 /root/CLE-PRIVEE-A-RECUPERER.asc
```

Tapez `OUI` pour confirmer. Le site s'arrête une minute, la base et les photos sont remplacées, le site repart.

3. **Effacez la clé du serveur** :

```
rm /root/CLE-PRIVEE-A-RECUPERER.asc
```

Si le serveur entier est perdu : louez-en un nouveau, refaites les étapes 3 à 4.3, remettez votre fichier `app-prod.env`
à la place de `secrets/prod/app.env` (mêmes clés de données), faites `./deployer.sh prod`, récupérez une sauvegarde
depuis le second serveur (`scp` ou `rsync`), puis restaurez-la comme ci-dessus.

### Essai de restauration, une fois par mois (recommandé)

Restaurez la dernière sauvegarde du site réel **sur la copie de test**, pour vérifier qu'elle est bonne :

```
./restaurer.sh test /srv/hanout/sauvegardes/prod/<dossier> /root/CLE-PRIVEE-A-RECUPERER.asc --cles-de prod
```

Puis ouvrez `https://test.votredomaine.dz` et connectez-vous comme un commerçant : ses produits et factures doivent y être.

---

## 9. Réagir à une alerte

| Message reçu | Que faire |
|---|---|
| « PANNE … base : erreur » | `./outils.sh prod etat`. Si `base` n'est pas « Up » : `./outils.sh prod demarrer`. Toujours en panne : `./outils.sh prod journaux` et regardez la fin. |
| « PANNE … » sans réponse du tout | Le serveur est peut-être éteint : redémarrez-le depuis l'espace client de l'hébergeur. Tout repart seul. Sinon `./outils.sh prod demarrer`. |
| « PANNE … sauvegarde » (`"ok":false`) | `./outils.sh prod sauvegarde`. Si l'erreur parle d'espace disque : `df -h` ; supprimez les plus vieux dossiers de `/srv/hanout/sauvegardes/prod/` **après** avoir vérifié qu'ils sont sur le second serveur, ou agrandissez le disque. |
| « Copie des sauvegardes … ÉCHEC » | Le second serveur ne répond pas ou a changé : `ssh utilisateur@adresse-du-second-serveur` doit fonctionner sans mot de passe. |
| « de nouveau en service » | Rien à faire. |

Après une panne, regardez aussi `/var/log/hanout-surveillance.log`.

---

## 10. Bon à savoir

- **Vos fichiers de secrets** (`/srv/hanout/deploiement/secrets/`) ne sont jamais envoyés sur GitHub ; ne les envoyez à personne.
- **Changer les clés de chiffrement des données** : ajoutez une nouvelle clé avec un nouveau numéro dans `CLES_CHIFFREMENT`
  (séparées par des virgules), mettez ce numéro dans `CLE_CHIFFREMENT_ACTIVE`, puis `./deployer.sh prod`.
  Les anciennes données restent lisibles avec l'ancienne clé ; ne la retirez pas.
- **Durée de conservation des factures** : réglable dans l'administration (10 ans par défaut). Aucune facture n'est jamais supprimée automatiquement.
- **Nouvelle boutique** : rien à faire. Son adresse `nom.votredomaine.dz` obtient son certificat HTTPS toute seule à la première visite.
- **Déclaration ANPDP** : le traitement des données des acheteurs doit être déclaré à l'Autorité nationale (loi 18-07, modifiée par la loi 25-11).
