FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# --- Dependencies (cached unless package.json/lockfile change) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM deps AS build
COPY . .
RUN pnpm build

# --- Production ---
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY package.json tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/seed-admin.mjs && node dist/index.js"]
