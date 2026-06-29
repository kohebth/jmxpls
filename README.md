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

## Project Documents

- `requirements.md` defines product behavior and acceptance criteria.
- `design.md` defines the architecture and planned layout.
- `plan.md` defines the implementation phases.
- `AGENTS.md` defines contributor and coding-agent guidelines.
- `docs/` contains installation, architecture, tools, validation, security, CI, and examples.

## License

MIT. See `LICENSE`.
