FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

RUN groupadd --system --gid 10001 pixbrasil \
  && useradd --system --uid 10001 --gid pixbrasil --home-dir /app --shell /usr/sbin/nologin pixbrasil

COPY --from=build --chown=pixbrasil:pixbrasil /app/package.json ./package.json
COPY --from=build --chown=pixbrasil:pixbrasil /app/node_modules ./node_modules
COPY --from=build --chown=pixbrasil:pixbrasil /app/dist ./dist

USER pixbrasil
EXPOSE 8080

CMD ["node", "dist/main.js"]
