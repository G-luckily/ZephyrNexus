FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git python3 make g++ gcc \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/local/bin/python
ENV PATH="/usr/local/bin:${PATH}"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/context-manager/package.json packages/context-manager/
COPY packages/context-extractor/package.json packages/context-extractor/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/

RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @zephyr-nexus/context-manager build
RUN pnpm --filter @zephyr-nexus/context-extractor build
RUN pnpm --filter @zephyr-nexus/ui build
RUN pnpm --filter @zephyr-nexus/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --chown=node:node --from=build /app /app
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai \
  && mkdir -p /zephyr-nexus \
  && chown node:node /zephyr-nexus

ENV NODE_ENV=production \
  HOME=/zephyr-nexus \
  ZEPHYR_HOME=/zephyr-nexus \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  ZEPHYR_INSTANCE_ID=default \
  ZEPHYR_DEPLOYMENT_MODE=authenticated \
  ZEPHYR_DEPLOYMENT_EXPOSURE=public \
  ZEPHYR_AUTH_BASE_URL_MODE=explicit

EXPOSE 3100

USER node
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
