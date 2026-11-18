#!/usr/bin/env bash
# Mise à jour sans coupure, et retour à la version précédente en une commande.
#   ./deployer.sh test            construit la version actuelle du code et la met sur la copie de test
#   ./deployer.sh prod            même chose sur le site réel (après l'avoir essayée sur la copie de test)
#   ./deployer.sh prod retour     remet la version précédente du site réel
# Déroulé : construction de l'image, sauvegarde (site réel), migrations, puis les deux copies de l'application
# redémarrent l'une après l'autre ; chacune doit être « saine » avant de passer à la suivante, sinon retour automatique.
set -euo pipefail
cd "$(dirname "$0")"
ENV="${1:?prod ou test}"; ACTION="${2:-}"
[[ "$ENV" =~ ^(prod|test)$ ]] || { echo "Environnement : prod ou test" >&2; exit 2; }
D="secrets/$ENV"
[ -e "$D/compose.env" ] || { echo "Lancez d'abord : ./installer.sh environnement $ENV <domaine>" >&2; exit 2; }
# Rappel : la clé privée des sauvegardes ne doit pas rester sur le serveur (une fois copiée chez vous).
for CLE in secrets/*/CLE-PRIVEE-A-RECUPERER.asc; do
  [ -e "$CLE" ] && echo "⚠ La clé privée des sauvegardes est encore sur le serveur : $(pwd)/$CLE
  Si elle est bien copiée sur votre ordinateur, effacez-la : rm $(pwd)/$CLE" >&2
done

compose() { local v="$1"; shift; VERSION="$v" docker compose -p "hanout-$ENV" --env-file "$D/compose.env" -f compose.yml "$@"; }
attendre_sain() {
  local conteneur; conteneur=$(compose "$1" ps -q "$2")
  for _ in $(seq 1 60); do
    case "$(docker inspect -f '{{.State.Health.Status}}' "$conteneur" 2>/dev/null)" in
      healthy) return 0 ;; unhealthy) return 1 ;;
    esac
    sleep 2
  done
  return 1
}

ACTUELLE=$(cat "$D/version-actuelle" 2>/dev/null || true)
if [ "$ACTION" = retour ]; then
  VERSION=$(cat "$D/version-precedente" 2>/dev/null || true)
  [ -n "$VERSION" ] || { echo "Aucune version précédente connue." >&2; exit 1; }
  echo "Retour à la version $VERSION (actuelle : $ACTUELLE)."
  echo "Rappel : si la version annulée avait changé la base, voir le guide (« Annuler une migration »)."
else
  VERSION="$(git -C .. rev-parse --short HEAD 2>/dev/null || echo local)-$(date +%Y%m%d%H%M%S)"
  echo "Construction de la version $VERSION…"
  # OPTIONS_CONSTRUCTION : options supplémentaires de « docker build » (proxy, image de base…), vide d'habitude.
  # shellcheck disable=SC2086
  docker build ${OPTIONS_CONSTRUCTION:-} --build-arg VERSION_APP="$VERSION" -t "hanout:$VERSION" ..
fi

compose "$VERSION" up -d --wait base
if [ "$ACTION" != retour ]; then
  # Site réel : une sauvegarde juste avant de toucher à la base.
  if [ "$ENV" = prod ] && [ -n "$ACTUELLE" ]; then compose "$VERSION" exec -T sauvegarde bash /usr/local/bin/sauvegarde.sh maintenant; fi
  compose "$VERSION" run --rm outils sh -c 'npm run --silent db:roles && npm run --silent db:migrer'
fi

for service in app_vert app_bleu; do
  echo "Redémarrage de $service…"
  compose "$VERSION" up -d --no-deps "$service"
  if ! attendre_sain "$VERSION" "$service"; then
    echo "ÉCHEC : $service ne démarre pas correctement avec $VERSION." >&2
    if [ -n "$ACTUELLE" ]; then
      echo "Retour automatique à $ACTUELLE." >&2
      for s in app_vert app_bleu; do compose "$ACTUELLE" up -d --no-deps "$s"; done
    fi
    exit 1
  fi
done
# Recréés à chaque fois : ils reprennent la dernière version des scripts.
compose "$VERSION" up -d --no-deps --force-recreate taches sauvegarde
# Première installation : une sauvegarde tout de suite (sinon la page d'état signale « pas de sauvegarde » jusqu'à la nuit).
DOSSIER_SAUV=$(grep '^DOSSIER_SAUVEGARDES=' "$D/compose.env" | cut -d= -f2-)
[ -e "$DOSSIER_SAUV/derniere.json" ] || compose "$VERSION" exec -T sauvegarde bash /usr/local/bin/sauvegarde.sh maintenant

if [ "$ACTION" = retour ]; then
  echo "$ACTUELLE" > "$D/version-precedente"
else
  [ -n "$ACTUELLE" ] && echo "$ACTUELLE" > "$D/version-precedente"
fi
echo "$VERSION" > "$D/version-actuelle"
# On garde les 3 dernières images de l'application.
docker images hanout --format '{{.Tag}}' | grep -vxF -e "$VERSION" -e "$(cat "$D/version-precedente" 2>/dev/null)" -e "$(cat secrets/*/version-actuelle 2>/dev/null | tr '\n' ' ')" | tail -n +3 | xargs -r -I{} docker rmi -f "hanout:{}" >/dev/null 2>&1 || true
echo "Version $VERSION en service sur « $ENV »."
