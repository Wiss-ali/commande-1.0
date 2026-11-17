#!/usr/bin/env bash
# Copie chaque nuit les sauvegardes (déjà chiffrées) sur un autre serveur, par rsync et SSH.
# Réglage dans secrets/alerte.env : DESTINATION_SAUVEGARDES="utilisateur@autre-serveur:/chemin/hanout"
# La copie distante garde aussi ce qui a disparu d'ici (pas de suppression) : faire le ménage là-bas une fois par an.
set -uo pipefail
cd "$(dirname "$0")"
[ -e secrets/alerte.env ] && . secrets/alerte.env
if [ -z "${DESTINATION_SAUVEGARDES:-}" ]; then echo "$(date '+%F %T') Aucune destination : copie distante non faite."; exit 0; fi
if rsync -a --partial -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" /srv/hanout/sauvegardes/ "$DESTINATION_SAUVEGARDES/"; then
  echo "$(date '+%F %T') Copie distante réussie."
else
  echo "$(date '+%F %T') ÉCHEC de la copie distante."
  [ -n "${ALERTE_URL:-}" ] && curl -fsS -m 15 -H "Title: Hanout" -d "🔴 Copie des sauvegardes vers l'autre serveur : ÉCHEC. Voir le guide, « Réagir à une alerte »." "$ALERTE_URL" >/dev/null
  exit 1
fi
