#!/usr/bin/env bash
# Surveillance (toutes les 5 minutes, programmée par « installer.sh cron ») : page d'état de chaque environnement
# (application, base, sauvegarde de moins de 26 heures). En cas de panne, une alerte part vers ALERTE_URL
# (secrets/alerte.env), par exemple un sujet ntfy reçu sur le téléphone. Une alerte au changement, puis un rappel par heure.
set -uo pipefail
cd "$(dirname "$0")"
[ -e secrets/alerte.env ] && . secrets/alerte.env
ALERTE_URL="${ALERTE_URL:-}"

alerter() {
  echo "$(date '+%F %T') $1"
  [ -n "$ALERTE_URL" ] && curl -fsS -m 15 -H "Title: Hanout" -d "$1" "$ALERTE_URL" >/dev/null || true
}

for ENV in prod test; do
  [ -e "secrets/$ENV/app.env" ] || continue
  URL=$(grep '^URL_APP=' "secrets/$ENV/app.env" | cut -d= -f2-)
  JETON=$(grep '^ETAT_JETON=' "secrets/$ENV/app.env" | cut -d= -f2-)
  ETAT_FICHIER="/var/tmp/hanout-etat-$ENV"
  reponse=$(curl -sS -m 20 -H "Authorization: Bearer $JETON" "$URL/etat" 2>&1)
  if printf '%s' "$reponse" | grep -q '"etat":"ok"'; then
    if [ -e "$ETAT_FICHIER" ]; then alerter "✅ $ENV : de nouveau en service ($URL)"; rm -f "$ETAT_FICHIER"; fi
  else
    detail=$(printf '%s' "$reponse" | head -c 300)
    if [ ! -e "$ETAT_FICHIER" ] || [ -n "$(find "$ETAT_FICHIER" -mmin +60)" ]; then
      alerter "🔴 $ENV : PANNE ($URL). Détail : $detail. Que faire : docs/GUIDE-INSTALLATION.md, « Réagir à une alerte »."
      touch "$ETAT_FICHIER"
    fi
  fi
done
