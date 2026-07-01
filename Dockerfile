FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY . .
RUN corepack pnpm -r build

FROM gradle:8.10-jdk17 AS bridge-build

WORKDIR /bridge
COPY packages/java-bridge .
RUN gradle build --no-daemon

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV JMXPLS_WORKSPACE_ROOTS=/workspace:/tmp
ENV JMXPLS_JAVA_BRIDGE_JAR=/app/packages/mcp-server/java-bridge/jmxpls-java-bridge.jar

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/packages/mcp-server ./packages/mcp-server
COPY --from=bridge-build /bridge/build/libs/jmxpls-java-bridge-0.0.0.jar ./packages/mcp-server/java-bridge/jmxpls-java-bridge.jar

RUN useradd --create-home --uid 10001 jmxpls \
  && mkdir -p /workspace \
  && chown -R jmxpls:jmxpls /app /workspace
USER jmxpls

ENTRYPOINT ["node", "packages/mcp-server/dist/index.js"]
