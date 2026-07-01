# Deferred Verification Notes

## 1. Execution Engine

### Testing Later

Run focused runtime tests for planned runs, successful `execute: true` runs, timeout handling, active cancellation through `stop_run`, report generation, logs, artifacts, and unsafe executable rejection. Add a long-running local shell shim named `jmeter` to prove `stop_run` can kill an active process and that the final status remains `stopped`. Verify timeout metadata uses `process.timedOut`, cancellation uses `process.cancelled`, and both produce clear log entries. Include resource reads for `jmxpls://runs/{runId}`, `/logs`, and `/artifacts` so the MCP resource surface matches tool results.

### Documentation Later

Document the execution lifecycle from planned command to running process, final status, logs, artifacts, and structured `process` metadata. Explain that commands are allowlisted and executed without a shell, and show examples for planned mode, executed mode, timeout configuration, cancellation, and report generation. Clarify the meaning of `completed`, `failed`, and `stopped`, plus the special exit codes used for timeout and cancellation. Add troubleshooting notes for missing JMeter binaries, workspace-root path rejection, and empty JTL/report outputs after failed runs.

## 2. JMeter-Backed Validation

### Testing Later

Run bridge-backed validation with a real Java bridge jar and an installed JMeter runtime. Cover `validate_with_jmeter` for `load`, `loadSave`, and `loadSaveReload`, plus `roundtrip_validate` for opened sessions and direct paths. Include both valid and malformed JMX fixtures. Verify fallback behavior when `JMXPLS_JAVA_BRIDGE_JAR` is missing, strict mode severity, request timeout behavior through `JMXPLS_JAVA_BRIDGE_TIMEOUT_MS`, and `nextSuggestedResources`. Confirm bridge diagnostics are preserved and enriched rather than replaced.

### Documentation Later

Expand validation documentation with a clear setup sequence: build the bridge, configure `JMXPLS_JAVA_BRIDGE_JAR`, optionally set `JMXPLS_JAVA_COMMAND` and timeout, then call `get_jmeter_environment`. Explain which workflows are static-only, which are JMeter-backed, and how strict mode changes fallback diagnostics. Add examples for direct path validation, opened-plan validation, and round-trip validation. Document how to interpret bridge diagnostics, when to trust them over static validation, and what evidence is required before release readiness.

## 3. Plugin and Classpath Validation

### Testing Later

Add plugin fixtures for unknown classes and, where possible, a known plugin jar in the JMeter classpath. Validate that unsupported plugin nodes survive open, semantic mutation, save, reload, and raw inspection. Run strict bridge validation on a plan with missing plugin classes and assert `JMX_JMETER_PLUGIN_CLASS_MISSING` appears with actionable guidance. Verify that installing the plugin removes the diagnostic and that dynamically loaded catalog data includes plugin component types without corrupting built-in descriptors.

### Documentation Later

Document the plugin preservation contract: unknown JMeter/plugin nodes must remain intact unless a tool explicitly edits them. Explain how static validation treats unknown components, how raw tools expose unsupported fields, and how JMeter-backed validation detects missing runtime classes. Add classpath setup guidance for local MCP clients, Docker, CI, and compatibility workflows. Include a troubleshooting section mapping common Java errors such as `ClassNotFoundException` and `NoClassDefFoundError` to the required plugin jar installation steps.

## 4. Compatibility Workflow

### Testing Later

Run the compatibility workflow manually and in CI for all configured JMeter versions. Confirm each uploaded JSON report contains artifact metadata, required check names, commands, status, and deterministic report paths. Replace placeholder statuses with real pass/fail evidence once the workflow downloads JMeter archives and runs bridge validation against fixtures. Verify checksum handling, report upload names, and behavior when one matrix version fails. Keep local script output stable so it can be snapshot-tested later without network access.

### Documentation Later

Document how to run compatibility checks locally and in GitHub Actions. Explain the configured JMeter version matrix, where reports are written, what each check means, and how known incompatibilities should be recorded. Add release guidance that compatibility must pass before changing parser, serializer, bridge validation, plugin preservation, or run/report behavior. Include instructions for updating the version list, validating checksum URLs, and interpreting matrix failures without blocking unrelated versions from producing artifacts.

## 5. End-to-End MCP Workflows

### Testing Later

Run MCP E2E tests through JSON-RPC calls rather than direct runtime methods. Cover opening a fixture, reading compact Plan Language resources, applying semantic edits, reviewing diffs, validating, saving, planning a run, executing a guarded run when JMeter is available, and analyzing JTL output. Include plugin preservation and CI preparation workflows. Confirm no E2E scenario requires raw XML editing for normal operation. Add inspector/client smoke coverage so lifecycle compliance is verified outside the unit-level transport tests.

### Documentation Later

Document the primary agent workflow as a sequence of MCP calls and resources: initialize, list tools/resources, open a plan, inspect compact resources, mutate semantically, validate, save, run, and analyze. Keep examples small but realistic, with exact tool names and representative JSON arguments. Explain when raw resources are appropriate and why normal workflows should prefer semantic or Plan Language resources. Add a client troubleshooting note for lifecycle errors, uninitialized sessions, and workspace-root path failures.

## 6. Packaging

### Testing Later

Verify the root `bin/jmxpls`, package `bin`, packed tarballs, Docker image, and bundled Java bridge jar all start the same MCP stdio server. Run package installation from generated tarballs in a temporary project and call `initialize` through stdin/stdout. Build the Docker image, mount a workspace, and validate that `JMXPLS_WORKSPACE_ROOTS` and `JMXPLS_JAVA_BRIDGE_JAR` point to usable locations. Confirm release artifacts include checksums and that missing bridge jars produce clear fallback diagnostics rather than startup failure.

### Documentation Later

Document installation options for local source checkout, npm-style package use, and Docker. Include exact commands for building TypeScript packages, building the Java bridge, copying or resolving the bridge jar, running the `jmxpls` binary, and configuring an MCP client. Explain required Node and Java versions, environment variables, mounted workspace paths, and expected release artifacts. Add troubleshooting for stale `dist`, missing executable permissions, missing bridge jar, Docker file permissions, and checksum verification.

## 7. Final Release Gate

### Testing Later

Before marking the project complete, run every release-gate command: lint, typecheck, build, unit tests, E2E tests, compatibility tests, Java bridge tests, Docker build, security tests, plugin preservation checks, and large-plan performance checks. Capture command outputs and attach compatibility reports. Verify the tests cover the full product goal: inspect, edit, validate, run, and analyze JMeter plans through MCP without raw XML editing. Treat any skipped JMeter/plugin-dependent check as a release blocker unless documented with an explicit environment reason.

### Documentation Later

Turn the release gate into a human-readable checklist that explains what each command proves and which product requirement it protects. Add a release-readiness section that distinguishes implemented capabilities from verified capabilities. Document required local tools, environment variables, fixture expectations, compatibility artifacts, Docker validation, and bridge/plugin prerequisites. Include a final sign-off template for maintainers listing evidence links, command outputs, package artifacts, compatibility reports, known limitations, and follow-up issues that are not release blockers.
