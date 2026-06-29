FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm -r build

ENTRYPOINT ["node", "packages/mcp-server/dist/index.js"]
