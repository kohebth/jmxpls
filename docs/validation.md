# Validation

Validation combines XML diagnostics, hashTree structure checks, semantic rules, component catalog lookup, policy warnings, security warnings, and optional JMeter-backed validation through the Java bridge.

## Static Validation

Use `validate_plan` for the full static suite against an opened `planId`. Use focused tools when narrowing diagnostics: `validate_tree`, `validate_hash_tree`, `validate_component_schema`, `validate_variables`, and `validate_files`.

## JMeter Bridge Validation

`get_jmeter_environment` probes the configured bridge and returns Java/JMeter availability, bridge diagnostics, and `JMX_JMETER_BRIDGE_NOT_CONFIGURED` when bridge env vars are missing.

`validate_with_jmeter` and `roundtrip_validate` accept either an opened `planId` or a direct JMX path using `path`, `planPath`, or `jmxPath`. Direct path validation uses the Java bridge when configured:

- `JMXPLS_JAVA_BRIDGE_JAR`: required path to the bridge jar.
- `JMXPLS_JAVA_COMMAND`: optional Java executable override; defaults to `java`.
- `JMXPLS_JAVA_BRIDGE_TIMEOUT_MS`: optional request timeout in milliseconds.

If the bridge is not configured, path-based validation returns `JMX_JMETER_BRIDGE_NOT_CONFIGURED`. Session-based validation keeps the static fallback diagnostics so existing `planId` workflows remain usable.

```json
{"name":"get_jmeter_environment","arguments":{}}
```

```json
{"name":"validate_with_jmeter","arguments":{"path":"plans/load-test.jmx","mode":"loadSaveReload","strict":true}}
```
