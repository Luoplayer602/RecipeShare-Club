FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
# Build-time placeholders only. Runtime credentials are supplied through secrets.
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_STANDALONE=1
RUN DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=recipeshare DB_USER=build DB_PASSWORD=build pnpm build && node scripts/copy-external.mjs

FROM dependencies AS migration
COPY drizzle ./drizzle
COPY scripts/container-secrets.mjs scripts/migrate-container.mjs ./scripts/
USER node
ENTRYPOINT ["node", "scripts/migrate-container.mjs"]

FROM node:24.18.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node scripts/container-secrets.mjs scripts/start-container.mjs ./scripts/
RUN mkdir -p /data/uploads /app/.next/cache && chown -R node:node /data /app/.next/cache
USER node
EXPOSE 3000
CMD ["node", "scripts/start-container.mjs"]
