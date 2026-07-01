# CI

The default GitHub Actions workflow runs dependency install, lint, typecheck, build, Node tests, and Java bridge tests.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
cd packages/java-bridge && gradle test
```

Compatibility is a separate workflow over JMeter `5.4.3`, `5.5`, and `5.6.3`; it uploads one JSON artifact per version. Use this workflow before changing parsing, serialization, bridge validation, or plugin preservation behavior.

For plan validation in CI, run the MCP server against checked-in fixtures or mounted workspace plans, call `validate_plan`, and only use `validate_with_jmeter` after `JMXPLS_JAVA_BRIDGE_JAR` is configured.
