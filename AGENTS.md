# Repository Guidelines

## Project Structure & Module Organization

`jmxpls` is a TypeScript + Java monorepo for editing JMeter `.jmx` plans through MCP. Core TypeScript code lives in `packages/core/src/` and covers XML/JMX parsing, semantic models, validation, Plan Language export, and patching. MCP server descriptors, runtime handlers, transports, and security policy live in `packages/mcp-server/src/`. The Java bridge lives in `packages/java-bridge/` and is built with Gradle. Shared schemas are in `schemas/`, sample plans and malformed inputs are in `fixtures/`, runnable examples are in `examples/`, scripts are in `scripts/`, and project documentation is in `docs/`.

## Build, Test, and Development Commands

Use the pinned Node toolchain through Corepack/pnpm:

- `corepack pnpm install` installs workspace dependencies.
- `corepack pnpm -r lint` runs ESLint for TypeScript packages.
- `corepack pnpm -r typecheck` runs `tsc --noEmit`.
- `corepack pnpm -r build` emits TypeScript package builds.
- `corepack pnpm -r test` runs Vitest suites.
- `cd packages/java-bridge && gradle build` compiles and tests the Java bridge.

The root script `corepack pnpm bridge:build` delegates to the Java bridge Gradle build.

## Coding Style & Naming Conventions

Use TypeScript modules with ESM imports and explicit exported types for public contracts. Keep file names descriptive and kebab-case, for example `hash-tree-parser.ts` or `canonical-patch.ts`. Before writing code, choose the shortest implementation that preserves behavior and stays simple to read. Prefer typed schema-driven inputs and outputs over loose objects. Java code uses package `io.jmxpls.bridge`, Java 17, and JUnit 5 tests. Preserve unknown JMeter/plugin nodes unless a tool explicitly targets them.

## Testing Guidelines

TypeScript tests use Vitest and live under each package `test/` directory. Add fixtures under `fixtures/jmx/`, `fixtures/malformed/`, `fixtures/plugins/`, or `fixtures/large/` when behavior depends on JMX shape. Cover round-trip fidelity, semantic diffs, validation, patch application, and MCP runtime behavior. Per project cadence, run tests after every five implementation phases unless the user asks otherwise. During active AC-AJ phased implementation, implement module slices first, record pending tests, add focused tests after implementation modules are complete, then finish docs.

## Commit & Pull Request Guidelines

No established Git history is available here. Use concise imperative commit messages such as `Implement canonical patch saving`. Pull requests should summarize behavior changes, list validation commands run, link related issues, and include sample MCP output or screenshots only when user-facing behavior changes.

## Agent-Specific Instructions

Use `apply_patch` for manual repository edits. Before editing an existing protected guide such as this file, ask the user for permission.

When the user says `continue`, `next`, `go`, or gives broad approval, reread this file, inspect current trackers, pick the next unchecked actionable task, and carry it through implementation, tracker updates, build-only verification, and commit. Prefer one coherent module at a time, but continue into the next module in the same turn when the path is clear and no approval or product decision is needed.
