# Install

Use Node 22, pnpm 9, Java 17, and Gradle. Install dependencies with `pnpm install`, build TypeScript packages with `pnpm build`, and verify the Java bridge from `packages/java-bridge` with `gradle test`.

## Java Bridge

Build the bridge from `packages/java-bridge` with `gradle build`. Configure MCP runtime validation with:

- `JMXPLS_JAVA_BRIDGE_JAR`: path to the built bridge jar.
- `JMXPLS_JAVA_COMMAND`: optional Java executable override.
- `JMXPLS_JAVA_BRIDGE_TIMEOUT_MS`: optional request timeout in milliseconds.

After setting these variables, call `get_jmeter_environment` to confirm Java and JMeter availability before using `validate_with_jmeter` or `roundtrip_validate`.
