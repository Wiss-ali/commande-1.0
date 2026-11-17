#!/usr/bin/env bash
# Restaure une sauvegarde (base + photos) dans un environnement.
#   ./restaurer.sh prod /srv/hanout/sauvegardes/prod/2026-11-17_0330 /chemin/CLE-PRIVEE.asc
#   ./restaurer.sh test <dossier d'une sauvegarde du site réel> <clé privée du site réel> --cles-de prod
#     (essai de restauration sur la copie de test : elle reçoit les clés de données du site réel pour pouvoir lire les données)
# L'application est arrêtée pendant la restauration, puis redémarrée. Tout le contenu actuel est remplacé.
set -euo pipefail
cd "$(dirname "$0")"
ENV="${1:?prod ou test}"; SOURCE="${2:?dossier de la sauvegarde}"; CLE="${3:?fichier de la clé privée}"
[[ "$ENV" =~ ^(prod|test)$ ]] || { echo "Environnement : prod ou test" >&2; exit 2; }
D="secrets/$ENV"
SOURCE=$(cd "$SOURCE" && pwd); CLE=$(cd "$(dirname "$CLE")" && pwd)/$(basename "$CLE")
VERSION=$(cat "$D/version-actuelle")
compose() { VERSION="$VERSION" docker compose -p "hanout-$ENV" --env-file "$D/compose.env" -f compose.yml "$@"; }

echo "Vérification des empreintes…"
(cd "$SOURCE" && sha256sum -c --quiet empreintes.sha256)

if [ "${4:-}" = --cles-de ]; then
  ORIGINE="secrets/${5:?environnement d\'origine des clés}/app.env"
  for v in CLES_CHIFFREMENT CLE_CHIFFREMENT_ACTIVE CLE_HMAC; do
    ligne=$(grep "^$v=" "$ORIGINE")
    sed -i "s|^$v=.*|$ligne|" "$D/app.env"
  done
  echo "Clés de données de « ${5} » copiées dans « $ENV »."
fi

read -r -p "Remplacer TOUTES les données de « $ENV » par cette sauvegarde ? Tapez OUI : " reponse
[ "$reponse" = OUI ] || { echo "Annulé."; exit 1; }

compose stop app_bleu app_vert taches
set -a; . "$D/compose.env"; set +a
docker run --rm --network "hanout-${ENV}_interne" \
  -v "$SOURCE:/s:ro" -v "$CLE:/cle.asc:ro" -v "$(pwd)/$D/certs/ca.crt:/ca.crt:ro" -v "hanout-${ENV}_fichiers:/donnees" \
  -e PGHOST=base -e PGUSER=postgres -e PGPASSWORD="$POSTGRES_MOT_DE_PASSE" -e PGSSLMODE=verify-full -e PGSSLROOTCERT=/ca.crt -e BASE="$NOM_BASE" \
  postgres:18 bash -euo pipefail -c '
    G=$(mktemp -d); gpg --batch --quiet --homedir "$G" --import /cle.asc
    gpg --batch --quiet --homedir "$G" --decrypt /s/base.dump.gpg | pg_restore --clean --if-exists --exit-on-error --single-transaction --dbname="$BASE"
    proprietaire=$(stat -c %u:%g /donnees)
    find /donnees -mindepth 1 -delete
    gpg --batch --quiet --homedir "$G" --decrypt /s/fichiers.tar.gpg | tar -C /donnees -xf -
    chown -R "$proprietaire" /donnees
    echo "Base et photos restaurées."'
compose up -d --force-recreate app_bleu app_vert taches
echo "Restauration terminée sur « $ENV »."
