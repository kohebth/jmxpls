# Release Gate

Release readiness requires lint, typecheck, build, unit tests, MCP workflow tests, Java bridge tests, security checks, plugin preservation fixtures, compatibility workflow configuration, package-install smoke, Docker smoke, documentation, and packaging artifacts.

Current implementation is scaffold-complete through Phase 43 plus guarded executable run/report mode, sidecar-backed stable node IDs, JMeter environment detection, bridge-backed validation smoke, package install smoke, and Docker stdio smoke. JMeter-backed validation and execution depend on a configured local JMeter runtime and plugin classpath.

## Latest Local Verification

Verified locally after the seven-part release-readiness pass:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm test:compatibility`
- `corepack pnpm test:smoke`
- `corepack pnpm test:smoke:docker`
- `cd packages/java-bridge && gradle test`
- `docker build -t jmxpls:local .`

The smoke gate verifies a configured JMeter home, bridge-backed minimal validation, bridge-backed round-trip validation, missing-plugin diagnostics, tarball installation through `node_modules/.bin/jmxpls`, and Docker stdio startup. Docker commands require access to local Docker/Buildx state outside the workspace. Real plugin classpath certification still requires the target JMeter installation plus the target plugin jars.

## Required Verification Commands

Run these before declaring the product release-ready:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm test:compatibility`
- `corepack pnpm test:smoke`
- `corepack pnpm test:smoke:docker`
- `cd packages/java-bridge && gradle test`
- `docker build -t jmxpls:local .`

Treat the release gate as open for real JMeter/plugin certification until the commands above pass in the target runtime environment with the required plugin classpath.
