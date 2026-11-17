#!/usr/bin/env bash
# Commandes du quotidien, pour un environnement (prod ou test) :
#   ./outils.sh prod admin moi@exemple.dz    créer (ou réinitialiser) le compte administrateur
#   ./outils.sh prod cles-push               créer les clés des notifications sur le téléphone
#   ./outils.sh prod sauvegarde              faire une sauvegarde tout de suite
#   ./outils.sh prod etat                    état des services (tous doivent être « Up », « healthy »)
#   ./outils.sh prod journaux                derniers messages de l'application (sans données personnelles)
#   ./outils.sh prod annuler-migration       annuler la dernière modification de la base (voir le guide)
#   ./outils.sh prod demarrer | arreter      démarrer ou arrêter tout l'environnement
set -euo pipefail
cd "$(dirname "$0")"
ENV="${1:?prod ou test}"; ACTION="${2:?action}"; shift 2
[[ "$ENV" =~ ^(prod|test)$ ]] || { echo "Environnement : prod ou test" >&2; exit 2; }
D="secrets/$ENV"
VERSION=$(cat "$D/version-actuelle" 2>/dev/null || echo aucune)
compose() { VERSION="$VERSION" docker compose -p "hanout-$ENV" --env-file "$D/compose.env" -f compose.yml "$@"; }
case "$ACTION" in
  admin) compose run --rm ${ADMIN_MOT_DE_PASSE:+-e ADMIN_MOT_DE_PASSE} outils npm run --silent admin:creer -- "${1:?identifiant, par exemple votre e-mail}" ;;
  cles-push) compose run --rm outils npm run --silent push:cles ;;
  sauvegarde) compose exec -T sauvegarde bash /usr/local/bin/sauvegarde.sh maintenant ;;
  etat) compose ps --format 'table {{.Service}}\t{{.Status}}' ;;
  journaux) compose logs --tail 100 app_bleu app_vert taches sauvegarde ;;
  annuler-migration) compose run --rm outils npm run --silent db:annuler ;;
  demarrer) compose up -d base app_bleu app_vert taches sauvegarde ;;
  arreter) compose stop ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
