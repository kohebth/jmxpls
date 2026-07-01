# jmxpls

`jmxpls` is a JMeter Plan Language Server over MCP. It treats Apache JMeter `.jmx` files as structured, editable, validated test-plan trees rather than raw XML blobs.

## Current Scope

The repository contains a TypeScript + Java monorepo scaffold with canonical XML/JMX parsing, semantic projection, Plan Language export, component descriptors, validation scaffolding, execution/report helpers, MCP resource/tool/prompt descriptors, and a Java bridge skeleton.

## Quick Start

```bash
corepack pnpm install
corepack pnpm -r lint
corepack pnpm -r typecheck
corepack pnpm -r build
corepack pnpm -r test
cd packages/java-bridge && gradle test
```

Run the MCP server locally after building:

```bash
corepack pnpm -C packages/mcp-server build
node packages/mcp-server/dist/index.js
```

Typical agent workflow:

1. Call `open_plan` with a workspace `.jmx` path.
2. Read the returned `defaultResource`, usually `plan-language/outline`.
3. Use `list_tree`, `find_nodes`, or template tools to identify targets.
4. Apply semantic tools such as `disable_node` or `instantiate_template`.
5. Read `jmxpls://plans/<planId>/diff/semantic`, then `validate_plan` and `save_plan`.

## Project Documents

- `requirements.md` defines product behavior and acceptance criteria.
- `design.md` defines the architecture and planned layout.
- `plan.md` defines the implementation phases.
- `AGENTS.md` defines contributor and coding-agent guidelines.
- `docs/` contains installation, architecture, tools, validation, security, CI, and examples.

## License

MIT. See `LICENSE`.
