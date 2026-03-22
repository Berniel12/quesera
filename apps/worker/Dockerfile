FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.base.json ./

# Copy packages
COPY packages/ packages/

# Copy worker app
COPY apps/worker/ apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm --filter @signal-map/worker build

# Production stage
FROM node:22-slim AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/worker/dist ./dist
COPY --from=base /app/packages ./packages

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
