# Medic Hub: web app + API + realtime in one container
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 STATIC_DIR=/app/dist-app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist-app ./dist-app
COPY --from=build /app/server-dist ./server-dist
COPY server/db/schema.sql ./server/db/schema.sql
EXPOSE 8080
CMD ["node", "server-dist/index.mjs"]
