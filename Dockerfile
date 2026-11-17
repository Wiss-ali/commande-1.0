# Image de l'application (testée à l'étape 8). Une seule image sert le site, les tâches périodiques et les migrations.
# Image de base de l'exécution (voir plus bas). Déclarée avant le premier FROM pour pouvoir servir dans un FROM.
ARG BASE_EXECUTION=node:22-slim
FROM node:22-slim AS construction
WORKDIR /app
COPY package.json package-lock.json ./
# Facultatif : certificat d'un proxy réseau (réseau d'entreprise), passé comme secret de construction.
RUN --mount=type=secret,id=ca_proxy,required=false \
    if [ -f /run/secrets/ca_proxy ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_proxy; fi && npm ci --no-audit --no-fund
COPY . .
RUN --mount=type=secret,id=ca_proxy,required=false \
    if [ -f /run/secrets/ca_proxy ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_proxy; fi && npm run build

# Image d'exécution : Debian (node:22-slim) avec le Chromium de Debian. Variante possible : une image qui contient
# déjà Chromium (par exemple mcr.microsoft.com/playwright), avec INSTALLER_CHROMIUM=0 et son CHEMIN_CHROMIUM.
FROM ${BASE_EXECUTION}
ARG INSTALLER_CHROMIUM=1
ARG CHEMIN_CHROMIUM=/usr/bin/chromium
ARG USAGER=node
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Chromium produit les PDF (factures, tickets) en français et en arabe. Rien d'autre n'est installé.
# Derrière un proxy qui n'accepte que HTTPS, les dépôts Debian passent en HTTPS avec son certificat (facultatif).
RUN --mount=type=secret,id=ca_proxy,required=false \
    if [ "$INSTALLER_CHROMIUM" != 1 ]; then exit 0; fi && \
    if [ -f /run/secrets/ca_proxy ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && \
      echo 'Acquire::https::CAInfo "/run/secrets/ca_proxy";' > /etc/apt/apt.conf.d/99proxy; fi && \
    apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && \
    rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/99proxy
ENV CHEMIN_CHROMIUM=$CHEMIN_CHROMIUM
COPY --from=construction --chown=${USAGER}:${USAGER} /app ./
RUN mkdir -p /donnees /sauvegardes && chown ${USAGER}:${USAGER} /donnees
USER ${USAGER}
EXPOSE 3000
ARG VERSION_APP=inconnue
ENV VERSION_APP=$VERSION_APP
# Le conteneur est « sain » quand la page d'état répond (base joignable).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/etat?base').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
