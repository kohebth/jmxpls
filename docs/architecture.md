# Architecture

`jmxpls` uses four representations: canonical JMX AST, semantic plan model, Plan Language projection, and JMeter runtime validation. The canonical layer preserves XML/hashTree structure and unknown plugin content. The semantic layer is the compact agent-facing view used by tools and resources.

## Runtime Layers

The MCP server registers resources, tools, and prompts independently from execution. `JmxplsRuntime` handles executable behavior in layers:

- The base runtime owns open plan sessions, semantic queries, Plan Language views, validation, generic mutations, typed component mutations, and save operations.
- The enhanced runtime adds run records, guarded JMeter execution/report generation, JTL analysis, raw/plugin-safe operations, catalog tools/resources, and template tools.
- Catalog and template helpers keep stateful descriptor/template behavior separate from the plan-session runtime.

## Resource Model

Resources are read-only views over runtime state. Plan resources expose summaries, trees, diagnostics, diffs, and Plan Language projections for opened plans. Catalog resources expose the active merged component catalog. Run resources expose in-memory JMeter command records, logs, status, and artifacts.

## Identity Sidecars

JMX does not carry stable node IDs. On save, `jmxpls` writes `<plan>.jmxpls.meta.json` with current stable node IDs, JMX paths, fingerprints, and names. On open, matching sidecar fingerprints are reapplied to the canonical tree so semantic resources, diffs, and patches can keep stable IDs across reloads while the `.jmx` remains valid without the sidecar.

## Execution Boundary

Execution tools prepare allowlisted JMeter CLI commands and record planned runs by default. When callers pass `execute: true`, the runtime executes the allowlisted JMeter command without a shell, records stdout/stderr, updates run status, and exposes artifacts through run resources. JTL analysis tools parse CSV result files directly. JMeter-backed validation remains a guarded Java bridge integration point.

## Java Bridge Protocol

The Java bridge is a line-delimited JSON stdio service. Requests include an `id`, `command`, and command-specific fields such as `path`. Responses use a common envelope with `id`, `success`, `data`, and `diagnostics`.

Current bridge commands are `ping`, `environment`, `componentCatalog`, `loadJmx`, `saveJmx`, `validateJmx`, and `roundTripJmx`. The JMeter commands still return guarded placeholder data until a configured JMeter runtime is wired into the bridge.
