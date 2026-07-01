# Release Gate

Release readiness requires lint, typecheck, build, unit tests, MCP workflow tests, Java bridge tests, security checks, plugin preservation fixtures, compatibility workflow configuration, documentation, and packaging artifacts.

Current implementation is scaffold-complete through Phase 43 plus guarded executable run/report mode and sidecar-backed stable node IDs. JMeter-backed validation and execution still depend on a configured local JMeter runtime and plugin classpath.

## Required Verification Commands

Run these before declaring the product release-ready:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm test:compatibility`
- `cd packages/java-bridge && gradle test`
- `docker build -t jmxpls:local .`

The current implementation pass intentionally did not run test commands. Treat the release gate as open until the commands above pass with a configured JMeter runtime and plugin classpath.
