FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=5173

WORKDIR /app

COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node scripts/static-server.mjs ./scripts/static-server.mjs

USER node

EXPOSE 5173

CMD ["node", "scripts/static-server.mjs"]
