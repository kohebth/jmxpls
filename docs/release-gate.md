# Release Gate

Release readiness requires lint, typecheck, build, unit tests, MCP workflow tests, Java bridge tests, security checks, plugin preservation fixtures, compatibility workflow configuration, documentation, and packaging artifacts.

Current implementation is scaffold-complete through Phase 43 plus guarded executable run/report mode. JMeter-backed validation and execution still depend on a configured local JMeter runtime and plugin classpath.
