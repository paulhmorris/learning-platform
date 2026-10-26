FROM node:24.21.0-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build

ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_MIXPANEL_TOKEN
ARG SENTRY_AUTH_TOKEN
# Enables sourcemaps and the Sentry upload in vite.config.ts.
ENV CI=true

COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY patches ./patches
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM base
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/build ./build

CMD ["node", "./build/server/index.js"]
