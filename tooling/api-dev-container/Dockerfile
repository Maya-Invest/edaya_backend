FROM oven/bun:1.3.14

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps ./apps
COPY package ./package
COPY tooling ./tooling

RUN bun install --frozen-lockfile

COPY tooling/api-dev-container/container.api.env apps/api/.env
COPY tooling/api-dev-container/container.root.env .env

RUN chmod +x tooling/api-dev-container/bake-seeded-data.sh \
  && tooling/api-dev-container/bake-seeded-data.sh

RUN chmod +x tooling/api-dev-container/entrypoint.sh

EXPOSE 9999 9200

ENTRYPOINT ["/app/tooling/api-dev-container/entrypoint.sh"]
