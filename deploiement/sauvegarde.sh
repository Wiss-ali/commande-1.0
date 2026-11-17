#!/usr/bin/env bash
# Sauvegarde de la base et des photos, chiffrée avec la clé PUBLIQUE (gpg) : le serveur ne peut pas relire ses
# propres sauvegardes ; seule la clé privée, gardée hors du serveur par l'administrateur, le peut.
# « sauvegarde.sh maintenant » : une sauvegarde tout de suite. « sauvegarde.sh boucle » : chaque nuit à HEURE_SAUVEGARDE.
# Résultat écrit dans /sauvegardes/derniere.json (lu par la page d'état, qui déclenche l'alerte en cas d'échec).
set -uo pipefail
# Fichiers lisibles par l'application (état), jamais modifiables par un autre utilisateur.
umask 022

DOSSIER=/sauvegardes
CLE=/cle/publique.asc

ecrire_etat() { printf '{"le":"%s","ok":%s,"fichier":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${2:-}" > "$DOSSIER/derniere.json.tmp" && mv "$DOSSIER/derniere.json.tmp" "$DOSSIER/derniere.json"; }

sauvegarder() {
  local nom gpgdir
  nom="$(date +%Y-%m-%d_%H%M%S)"
  # Dossier neuf obligatoire : une sauvegarde n'en écrase ni n'en efface jamais une autre.
  if ! mkdir "$DOSSIER/$nom"; then ecrire_etat false; echo "ÉCHEC : le dossier $nom existe déjà" >&2; return; fi
  gpgdir="$(mktemp -d)"
  chiffrer() { gpg --batch --quiet --homedir "$gpgdir" --trust-model always --recipient-file "$CLE" --compress-algo none --encrypt --output "$1"; }
  if pg_dump --format=custom --compress=6 --dbname="$BASE" | chiffrer "$DOSSIER/$nom/base.dump.gpg" \
     && tar -C /donnees -cf - . | chiffrer "$DOSSIER/$nom/fichiers.tar.gpg" \
     && (cd "$DOSSIER/$nom" && sha256sum ./*.gpg > empreintes.sha256) \
     && [ -s "$DOSSIER/$nom/base.dump.gpg" ]; then
    ecrire_etat true "$nom"
    echo "Sauvegarde réussie : $nom"
  else
    rm -rf "${DOSSIER:?}/$nom"
    ecrire_etat false
    echo "ÉCHEC de la sauvegarde" >&2
  fi
  rm -rf "$gpgdir"
  # On garde JOURS_GARDES jours de sauvegardes sur ce serveur (la copie distante a sa propre durée).
  find "$DOSSIER" -mindepth 1 -maxdepth 1 -type d -mtime +"${JOURS_GARDES:-30}" -exec rm -rf {} +
}

case "${1:-maintenant}" in
  maintenant) sauvegarder ;;
  boucle)
    while true; do
      maintenant=$(date +%s)
      cible=$(date -d "today ${HEURE_SAUVEGARDE:-03:30}" +%s)
      [ "$cible" -le "$maintenant" ] && cible=$(date -d "tomorrow ${HEURE_SAUVEGARDE:-03:30}" +%s)
      sleep $((cible - maintenant))
      sauvegarder
    done ;;
  *) echo "usage : sauvegarde.sh maintenant|boucle" >&2; exit 2 ;;
esac
