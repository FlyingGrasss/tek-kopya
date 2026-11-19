# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable || true
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable || true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable || true
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json pnpm-lock.yaml next.config.* tsconfig*.json ./
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY scripts/start.sh /app/scripts/start.sh
RUN chmod +x /app/scripts/start.sh
RUN useradd -m app && mkdir -p /app/data && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["/app/scripts/start.sh"]
