#!/usr/bin/env bash
# Installation, une seule fois par serveur. Voir docs/GUIDE-INSTALLATION.md, étape par étape.
#   ./installer.sh proxy EMAIL DOMAINE           HTTPS : site DOMAINE, boutiques *.DOMAINE, copie de test test.DOMAINE
#   ./installer.sh environnement prod DOMAINE    secrets du site réel (clés, mots de passe, certificats, clé de sauvegarde)
#   ./installer.sh environnement test test.DOMAINE
#   ./installer.sh cron                          surveillance toutes les 5 minutes, copie des sauvegardes chaque nuit
# Rien n'est jamais écrasé : un secret déjà créé est gardé.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
mkdir -p secrets

alea() { openssl rand -base64 "$1" | tr -d '\n'; }
mot_de_passe() { openssl rand -hex 24; }

case "${1:-}" in
proxy)
  EMAIL="${2:?adresse e-mail pour Let\'s Encrypt}"; DOMAINE="${3:?domaine principal, par exemple hanout.dz}"
  if [ -e secrets/proxy.env ]; then echo "secrets/proxy.env existe déjà : rien n'est changé."; else
    cat > secrets/proxy.env <<FIN
EMAIL_CERTIFICATS=$EMAIL
DOMAINE_PROD=$DOMAINE
DOMAINE_BOUTIQUES_PROD=$DOMAINE
DOMAINE_TEST=test.$DOMAINE
# Vide sur le vrai serveur. « local_certs » : certificats de test, sans Let's Encrypt.
CADDY_OPTIONS=
FIN
  fi
  docker compose -f proxy/compose.yml up -d
  echo "Caddy démarré (HTTPS automatique)." ;;

environnement)
  ENV="${2:?prod ou test}"; DOMAINE="${3:?adresse du site, par exemple hanout.dz ou test.hanout.dz}"
  [[ "$ENV" =~ ^(prod|test)$ ]] || { echo "Environnement : prod ou test" >&2; exit 2; }
  D="secrets/$ENV"
  if [ -e "$D/app.env" ]; then echo "$D existe déjà : rien n'est changé."; exit 0; fi
  mkdir -p "$D/certs"
  SAUV="/srv/hanout/sauvegardes/$ENV"
  mkdir -p "$SAUV" && chmod 755 /srv/hanout "/srv/hanout/sauvegardes" "$SAUV" 2>/dev/null || true
  P_SUPER=$(mot_de_passe); P_PROP=$(mot_de_passe); P_APP=$(mot_de_passe); P_AUTH=$(mot_de_passe); P_PLAT=$(mot_de_passe)
  cat > "$D/compose.env" <<FIN
ENV_NOM=$ENV
NOM_BASE=hanout
POSTGRES_MOT_DE_PASSE=$P_SUPER
DATABASE_URL_PROPRIETAIRE=postgres://hanout_proprietaire:$P_PROP@base:5432/hanout
DOSSIER_SAUVEGARDES=$SAUV
HEURE_SAUVEGARDE=$([ "$ENV" = prod ] && echo 03:30 || echo 04:30)
JOURS_GARDES=30
FIN
  BOUTIQUES=""; [ "$ENV" = prod ] && BOUTIQUES="DOMAINE_BOUTIQUES=$DOMAINE"
  cat > "$D/app.env" <<FIN
URL_APP=https://$DOMAINE
DATABASE_URL_APP=postgres://hanout_app:$P_APP@base:5432/hanout
DATABASE_URL_AUTH=postgres://hanout_auth:$P_AUTH@base:5432/hanout
DATABASE_URL_PLATEFORME=postgres://hanout_plateforme:$P_PLAT@base:5432/hanout
# Clés de chiffrement des données : à garder AUSSI hors du serveur (sans elles, une sauvegarde est illisible).
CLES_CHIFFREMENT=1:$(alea 32)
CLE_CHIFFREMENT_ACTIVE=1
CLE_HMAC=$(alea 32)
$BOUTIQUES
# Détail de la page d'état (surveillance).
ETAT_JETON=$(openssl rand -hex 24)
# Notifications sur le téléphone : voir le guide (npm run push:cles), puis remplir.
VAPID_PUBLIQUE=
VAPID_PRIVEE=
VAPID_CONTACT=mailto:contact@$DOMAINE
FIN
  # Certificats de la base (connexion chiffrée application ↔ base) : une autorité locale et le certificat « base ».
  openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=Hanout $ENV autorite locale" -keyout "$D/certs/ca.key" -out "$D/certs/ca.crt" 2>/dev/null
  openssl req -newkey rsa:3072 -nodes -subj "/CN=base" -keyout "$D/certs/base.key" -out "$D/certs/base.csr" 2>/dev/null
  printf 'subjectAltName=DNS:base\n' > "$D/certs/ext.cnf"
  openssl x509 -req -in "$D/certs/base.csr" -CA "$D/certs/ca.crt" -CAkey "$D/certs/ca.key" -CAcreateserial -days 3650 -extfile "$D/certs/ext.cnf" -out "$D/certs/base.crt" 2>/dev/null
  rm -f "$D/certs/base.csr" "$D/certs/ext.cnf"
  chmod 644 "$D/certs/ca.crt" "$D/certs/base.crt"; chmod 600 "$D/certs/base.key"
  chown 999:999 "$D/certs/base.key" "$D/certs/base.crt"   # utilisateur « postgres » du conteneur de la base
  chmod 755 "$D" "$D/certs"
  # Clé de sauvegarde (gpg) : la publique reste ici, la PRIVÉE doit être récupérée puis effacée du serveur.
  G=$(mktemp -d)
  gpg --batch --homedir "$G" --pinentry-mode loopback --passphrase '' --quick-gen-key "Hanout sauvegardes $ENV" default default never 2>/dev/null
  gpg --batch --homedir "$G" --armor --export > "$D/cle-sauvegarde-publique.asc"
  gpg --batch --homedir "$G" --pinentry-mode loopback --passphrase '' --armor --export-secret-keys > "$D/CLE-PRIVEE-A-RECUPERER.asc"
  rm -rf "$G"
  chmod 644 "$D/cle-sauvegarde-publique.asc"
  echo "Environnement « $ENV » prêt dans $D."
  echo "IMPORTANT : copiez sur votre ordinateur $D/CLE-PRIVEE-A-RECUPERER.asc ET $D/app.env, puis effacez la clé privée du serveur :"
  echo "    rm $(pwd)/$D/CLE-PRIVEE-A-RECUPERER.asc" ;;

cron)
  ICI="$(pwd)"
  cat > /etc/cron.d/hanout <<FIN
# Hanout : surveillance toutes les 5 minutes, copie des sauvegardes hors du serveur chaque nuit.
*/5 * * * * root $ICI/surveiller.sh >> /var/log/hanout-surveillance.log 2>&1
45 4 * * * root $ICI/copier-sauvegardes.sh >> /var/log/hanout-sauvegardes.log 2>&1
FIN
  chmod 644 /etc/cron.d/hanout
  echo "Tâches programmées dans /etc/cron.d/hanout." ;;

*) sed -n '2,8p' "$0"; exit 2 ;;
esac
