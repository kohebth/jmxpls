# Install

Use Node 22, pnpm 9 through Corepack, Java 17, and Gradle. From the repository root:

```bash
corepack pnpm install
corepack pnpm -r build
corepack pnpm -r test
cd packages/java-bridge && gradle test
```

Run the MCP server after building TypeScript:

```bash
node packages/mcp-server/dist/index.js
```

For local development, run focused package checks:

```bash
corepack pnpm -C packages/mcp-server test
corepack pnpm -C packages/core typecheck
```

## MCP Client Config

Configure an MCP client to launch the built server with stdio:

```json
{
  "mcpServers": {
    "jmxpls": {
      "command": "node",
      "args": ["/absolute/path/to/jmxpls/packages/mcp-server/dist/index.js"],
      "env": {
        "JMXPLS_WORKSPACE_ROOTS": "/absolute/path/to/workspace:/tmp"
      }
    }
  }
}
```

`JMXPLS_WORKSPACE_ROOTS` is optional; by default the runtime allows the current working directory and the OS temp directory.

## Java Bridge

Build the bridge from `packages/java-bridge` with `gradle build`. Configure MCP runtime validation with:

- `JMXPLS_JAVA_BRIDGE_JAR`: path to the built bridge jar.
- `JMXPLS_JAVA_COMMAND`: optional Java executable override.
- `JMXPLS_JAVA_BRIDGE_TIMEOUT_MS`: optional request timeout in milliseconds.

After setting these variables, call `get_jmeter_environment` to confirm Java and JMeter availability before using `validate_with_jmeter` or `roundtrip_validate`.

## Troubleshooting

- If `open_plan` reports an outside path, add the plan directory to `JMXPLS_WORKSPACE_ROOTS`.
- If `validate_with_jmeter` returns `JMX_JMETER_BRIDGE_NOT_CONFIGURED`, build the Java bridge and set `JMXPLS_JAVA_BRIDGE_JAR`.
- If a tool response is too large, use `list_tree` with `limit`, `cursor`, `depth`, and `byteBudget`.
