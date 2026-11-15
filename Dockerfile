# Image de l'application. Non testée dans l'environnement de développement : à valider à l'étape 8.
FROM node:22-slim AS construction
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=construction /app ./
USER node
EXPOSE 3000
# Applique les migrations en attente, puis démarre.
CMD ["sh", "-c", "npm run db:migrer && npx next start -p 3000"]
