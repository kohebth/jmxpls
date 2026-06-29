# jmxpls Implementation Plan

**Project:** JMeter JMX MCP Server  
**Product name:** `jmxpls` — JMeter Plan Language Server over MCP  
**Document type:** Agent-executable implementation plan  
**Target state:** Full JMX support through typed adapters, dynamic catalogs, raw passthrough, and JMeter-backed validation  
**Last updated:** 2026-06-28

---

## 1. Execution rules for the coding agent

1. Implement in the order listed.
2. Do not skip tests for a completed step.
3. Do not edit `.jmx` as raw XML in product features except inside the canonical XML layer and raw tools.
4. Every mutation must support dry-run, semantic diff, validation, and rollback.
5. Every tool must have schema validation.
6. Every save must use temp file + validation + atomic replace.
7. Unknown JMeter/plugin nodes must be preserved by default.
8. JMeter-backed validation must become mandatory before release, with static-only fallback allowed only when JMeter is unavailable and clearly reported.
9. The product is not complete until typed core coverage, dynamic cataloging, raw passthrough, run/report tools, security, and compatibility tests are implemented.
10. Existing `.jmx` files must be readable through JMeter Plan Language before agents are expected to inspect or edit them.

---

## 2. Delivery map

```text
Track A: Repository and engineering foundation
Track B: Canonical JMX AST and hashTree parser
Track C: Java bridge and JMeter correctness layer
Track D: Semantic model, index, summaries, and resources
Track D2: JMX-to-Plan-Language projection, import, export, and round-trip
Track E: Patch engine and semantic diffs
Track F: Component catalog and typed adapters
Track G: MCP tools and prompts
Track H: Validation engine
Track I: Execution, JTL analysis, reports
Track J: Plugin/full-fidelity support
Track K: Security hardening
Track L: Test corpus and CI
Track M: Documentation and release
```

Each track builds on earlier tracks, but after repository bootstrap the agent can parallelize independent test fixture creation and component descriptor work.

---

## 3. Phase 0 — Product contracts

### Goal

Freeze the initial product contract before writing implementation code.

### Build

Create and commit:

```text
requirements.md
design.md
plan.md
AGENTS.md
README.md
LICENSE
```

### Tasks

1. Copy the requirements from `requirements.md` into the repository root.
2. Copy the architecture from `design.md` into the repository root.
3. Copy this implementation plan into `plan.md`.
4. Add `AGENTS.md` with coding-agent rules.
5. Add `README.md` with project definition and quick start placeholder.
6. Choose license.

### Acceptance

- The repository has clear implementation rules.
- The coding agent can locate the product definition, architecture, and task order.

---

## 4. Phase 1 — Monorepo bootstrap

### Goal

Create a buildable TypeScript + Java monorepo.

### Build

```text
packages/mcp-server
packages/core
packages/java-bridge
schemas
fixtures
examples
docs
```

### Tasks

1. Initialize Node workspace with pnpm.
2. Add TypeScript config.
3. Add ESLint and formatter.
4. Add Vitest.
5. Add Java Gradle project under `packages/java-bridge`.
6. Add root scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "bridge:build": "cd packages/java-bridge && ./gradlew build"
  }
}
```

7. Add CI workflow skeleton.

### Acceptance

- `pnpm install` succeeds.
- `pnpm build` succeeds with placeholder packages.
- `pnpm test` succeeds.
- Java bridge `./gradlew test` succeeds.

---

## 5. Phase 2 — Shared schemas and result types

### Goal

Define stable contracts used by all packages.

### Build files

```text
packages/core/src/model/result.ts
packages/core/src/model/diagnostics.ts
packages/core/src/model/diff.ts
packages/core/src/model/patches.ts
packages/core/src/model/session.ts
schemas/diagnostics.schema.json
schemas/semantic-patch.schema.json
schemas/tool-output.schema.json
```

### Tasks

1. Implement `Result<T, E>` and `ToolResult<T>`.
2. Implement `Diagnostic` model.
3. Implement semantic diff types.
4. Implement semantic patch operation types.
5. Implement JSON schemas.
6. Add schema validation tests.

### Acceptance

- All tool outputs can use one envelope.
- Diagnostics have severity, code, message, node path, and fix suggestion.
- Patch and diff schemas validate known examples.

---

## 6. Phase 3 — XML loader and source mapping

### Goal

Read XML without losing structure required for JMX preservation.

### Build files

```text
packages/core/src/xml/load-xml.ts
packages/core/src/xml/source-map.ts
packages/core/src/xml/preserve.ts
packages/core/src/xml/xml-types.ts
fixtures/jmx/minimal.jmx
fixtures/malformed/not-xml.jmx
```

### Tasks

1. Implement XML file loading with encoding detection.
2. Preserve line ending style.
3. Parse XML into an ordered XML node representation.
4. Capture source range where possible.
5. Preserve root attributes.
6. Add malformed XML diagnostics.

### Acceptance

- `minimal.jmx` loads.
- Malformed XML returns `JMX_XML_PARSE_ERROR`.
- XML root and ordered children are preserved.
- Tests prove empty elements remain distinguishable.

---

## 7. Phase 4 — Canonical JMX AST and hashTree parser

### Goal

Implement the core JMX structure parser.

### Build files

```text
packages/core/src/model/canonical.ts
packages/core/src/jmx/hash-tree-parser.ts
packages/core/src/jmx/jmeter-path.ts
packages/core/src/jmx/fingerprint.ts
packages/core/src/jmx/property-tree.ts
schemas/canonical-jmx.schema.json
fixtures/malformed/odd-hashtree.jmx
fixtures/malformed/orphan-hashtree.jmx
```

### Tasks

1. Implement `JmxDocument`, `HashTreeNode`, `JmxPairNode`, `JmxElementNode`.
2. Implement root detection for `jmeterTestPlan`.
3. Implement element/hashTree pair parsing.
4. Implement property node parser.
5. Implement JMeter path generation.
6. Implement node fingerprinting.
7. Implement hashTree diagnostics:

```text
JMX_HASH_TREE_ODD_CHILDREN
JMX_HASH_TREE_ORPHAN
JMX_ELEMENT_WITHOUT_HASHTREE
JMX_UNEXPECTED_ROOT
```

### Acceptance

- Valid JMX produces canonical tree.
- Malformed hashTree fixtures produce blocking diagnostics.
- Node order is preserved.
- Every test element has an owning child `hashTree`.

---

## 8. Phase 5 — Lossless serializer

### Goal

Serialize the canonical AST back to JMX without unnecessary destruction.

### Build files

```text
packages/core/src/xml/serialize-xml.ts
packages/core/src/jmx/hash-tree-serializer.ts
packages/core/src/jmx/property-serializer.ts
```

### Tasks

1. Serialize XML declaration.
2. Serialize root attributes.
3. Serialize `hashTree` pairs in order.
4. Serialize all known property node types.
5. Preserve unknown property XML.
6. Support pretty output and original-ish output.
7. Add structural equivalence comparator.

### Acceptance

- `minimal.jmx` round-trips structurally.
- Unknown tags round-trip structurally.
- Empty `hashTree` remains empty.
- Serializer output can be parsed again by Phase 4 parser.

---

## 9. Phase 6 — Sidecar identity store

### Goal

Add stable node identity without modifying `.jmx`.

### Build files

```text
packages/core/src/model/sidecar.ts
packages/core/src/jmx/sidecar-store.ts
schemas/sidecar.schema.json
```

### Tasks

1. Define `.jmxpls.meta.json` schema.
2. Generate session node IDs.
3. Generate stable IDs from sidecar if present.
4. Reconcile stale sidecar by path and fingerprint.
5. Save sidecar on plan save.
6. Add tests for missing, valid, stale, and corrupt sidecar.

### Acceptance

- Opening a JMX without sidecar works.
- Saving can write sidecar.
- Renamed/moved nodes keep identity when fingerprint match is strong.
- Corrupt sidecar does not block opening the `.jmx`; it emits warning.

---

## 10. Phase 7 — Java bridge skeleton

### Goal

Create a Java process that TypeScript can call.

### Build files

```text
packages/java-bridge/src/main/java/io/jmxpls/bridge/Main.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/BridgeServer.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/protocol/BridgeRequest.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/protocol/BridgeResponse.java
packages/core/src/jmeter/bridge-client.ts
```

### Tasks

1. Implement JSON request/response loop over stdin/stdout.
2. Add `ping` command.
3. Add TypeScript bridge client.
4. Add timeout and process lifecycle handling.
5. Add bridge error mapping.

### Acceptance

- TypeScript can start bridge and call `ping`.
- Bridge errors return structured diagnostics.
- Bridge process exits cleanly.

---

## 11. Phase 8 — JMeter bridge bootstrap

### Goal

Load JMeter libraries and report runtime metadata.

### Build files

```text
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/JMeterBootstrap.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/JMeterEnvironment.java
```

### Tasks

1. Add JMeter dependencies.
2. Accept `jmeterHome`, `properties`, and `extraClasspath`.
3. Initialize JMeter properties and SaveService prerequisites.
4. Report JMeter version.
5. Report classpath fingerprint.
6. Add bootstrap diagnostics.

### Acceptance

- Bridge reports JMeter version.
- Missing JMeter home returns clear diagnostic.
- Invalid plugin jar path returns clear diagnostic.

---

## 12. Phase 9 — JMeter load/save/roundtrip commands

### Goal

Use JMeter as compatibility oracle.

### Build files

```text
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/JmxLoadCommand.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/JmxSaveCommand.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/JmxValidateCommand.java
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/RoundTripCommand.java
packages/core/src/jmeter/jmeter-validation.ts
```

### Tasks

1. Implement load JMX command.
2. Implement save JMX command.
3. Implement load-save-reload validation.
4. Map JMeter exceptions to diagnostics.
5. Add temp file handling.
6. Add tests with `minimal.jmx`.

### Acceptance

- Valid JMX loads through bridge.
- Invalid JMX returns JMeter diagnostic.
- Round-trip validation returns success/failure.
- TypeScript validation wrapper works.

---

## 13. Phase 10 — Plan session manager

### Goal

Manage open plans, revisions, dirty state, and resources.

### Build files

```text
packages/core/src/session/session-manager.ts
packages/core/src/session/plan-session.ts
packages/core/src/session/revision-log.ts
```

### Tasks

1. Implement `openPlan`.
2. Implement `closePlan`.
3. Implement revision counter.
4. Track dirty state.
5. Store canonical AST, semantic index, catalog, diagnostics, sidecar.
6. Add memory limits and LRU behavior if many plans are opened.

### Acceptance

- Multiple plans can be open.
- Each plan has unique `planId`.
- Revisions increment after mutation.
- Dirty state is accurate.

---

## 14. Phase 11 — Semantic model and indexer

### Goal

Convert canonical AST into compact agent-facing semantic tree.

### Build files

```text
packages/core/src/model/semantic.ts
packages/core/src/semantic/indexer.ts
packages/core/src/semantic/summarizer.ts
packages/core/src/semantic/execution-flow.ts
packages/core/src/semantic/variables.ts
schemas/semantic-plan.schema.json
```

### Tasks

1. Define `SemanticNode` and `SemanticPlan`.
2. Implement default semantic mapping for all nodes using generic fields.
3. Implement role inference.
4. Implement indexes by role, name, testClass, enabled, variable references.
5. Implement compact plan summary.
6. Implement compact tree output.
7. Implement execution flow view.

### Acceptance

- Existing JMX can be summarized without typed adapters.
- Summary response contains no raw XML.
- Tree output is paginated.
- Variable references are extracted.

---


## 14A. Phase 11A — JMX to Plan Language projection, import/export, and round-trip

### Goal

Make existing `.jmx` files readable as compact JMeter Plan Language before the agent reads raw XML. This is the direct workflow where a user already has a JMX file and asks the agent to understand it.

### Build files

```text
packages/core/src/plan-language/types.ts
packages/core/src/plan-language/projector.ts
packages/core/src/plan-language/renderer.ts
packages/core/src/plan-language/parser.ts
packages/core/src/plan-language/serializer.ts
packages/core/src/plan-language/roundtrip.ts
packages/core/src/plan-language/redaction.ts
packages/core/src/plan-language/yaml.ts
packages/core/src/plan-language/json.ts
packages/mcp-server/src/resources/plan-language-resource.ts
packages/mcp-server/src/tools/plan-language-tools.ts
schemas/semantic-plan.schema.json
schemas/plan-language.schema.json
schemas/jmxpls-plan-language.schema.json
```

### Tasks

1. Define `PlanLanguageDocument` schema.
2. Render whole-plan Plan Language from `SemanticPlan`.
3. Render subtree-scoped Plan Language from any node ID.
4. Support detail levels: `compact`, `expanded`, `lossless-references`, `raw-linked`.
5. Support view modes: `outline`, `flow`, `semantic`, and `full`.
5. Implement redaction modes: `none`, `standard`, `strict`.
6. Represent unknown/plugin nodes as opaque blocks with raw resource references.
7. Implement JSON export.
8. Implement YAML export.
9. Implement Plan Language parser.
10. Convert parsed Plan Language to semantic patch operations.
11. Add `export_plan_language` MCP tool.
12. Add `import_plan_language` MCP tool.
13. Add `explain_plan_language` MCP tool.
14. Add `compare_plan_language` MCP tool.
15. Add `jmxpls://plans/{planId}/plan-language` resource.
16. Add dedicated resources for `outline`, `flow`, `semantic`, and `full`.
17. Add `get_plan_language` MCP tool for inline reads.
18. Add `validate_plan_language` MCP tool.
19. Add `roundtrip_plan_language` MCP tool.
20. Add golden tests for `.jmx → Plan Language → semantic patch → .jmx`.

### Acceptance

- Agent can open an existing `.jmx` and retrieve Plan Language without raw XML.
- Existing JMX with unknown/plugin nodes still produces a useful Plan Language document.
- Plan Language export is valid JSON or YAML.
- Plan Language import can create a new plan or generate a dry-run semantic patch.
- Secrets and long script bodies are redacted by default.
- Raw XML appears only through explicit raw resources.
- `outline` mode is the default first-read path for large existing JMX files.
- `flow` mode explains what the test does in execution order.
- `semantic` mode is directly usable for semantic patch generation.
- `full` mode preserves unknown/plugin components through `rawRef`.
- Round-trip tests preserve canonical AST data for untouched unknown nodes.
- `.jmx -> Plan Language -> .jmx` reports semantic equality, raw-ref preservation, and JMeter validation result.

## 15. Phase 12 — MCP server skeleton

### Goal

Expose working MCP resources and tools.

### Build files

```text
packages/mcp-server/src/index.ts
packages/mcp-server/src/server.ts
packages/mcp-server/src/transports/stdio.ts
packages/mcp-server/src/resources/registry.ts
packages/mcp-server/src/tools/registry.ts
```

### Tasks

1. Initialize MCP server.
2. Add stdio transport.
3. Add resource registry.
4. Add tool registry.
5. Add structured logging.
6. Add config loading.

### Acceptance

- MCP inspector/client can connect.
- `list_open_plans` tool works.
- Static `jmxpls://plans` resource works.

---

## 16. Phase 13 — Plan resources

### Goal

Expose compact plan context through MCP resources.

### Build files

```text
packages/mcp-server/src/resources/plan-resources.ts
packages/mcp-server/src/resources/catalog-resources.ts
packages/mcp-server/src/resources/run-resources.ts
```

### Tasks

Implement resources:

```text
jmxpls://plans
jmxpls://plans/{planId}/summary
jmxpls://plans/{planId}/tree
jmxpls://plans/{planId}/execution-flow
jmxpls://plans/{planId}/plan-language
jmxpls://plans/{planId}/plan-language/outline
jmxpls://plans/{planId}/plan-language/flow
jmxpls://plans/{planId}/plan-language/semantic
jmxpls://plans/{planId}/plan-language/full
jmxpls://plans/{planId}/node/{nodeId}
jmxpls://plans/{planId}/node/{nodeId}/children
jmxpls://plans/{planId}/diagnostics
jmxpls://plans/{planId}/diff/semantic
```

### Acceptance

- Opened plan is visible as resource.
- Summary/tree/node resources return compact content.
- Raw node resource is separate and explicit.
- Plan Language resources expose opened JMX in outline, flow, semantic, and full modes.

---

## 17. Phase 14 — Session and query tools

### Goal

Allow agents to open, inspect, and find nodes.

### Build files

```text
packages/mcp-server/src/tools/session-tools.ts
packages/mcp-server/src/tools/query-tools.ts
```

### Tasks

Implement tools:

```text
open_plan
create_plan
close_plan
reload_plan
save_plan
list_open_plans
summarize_plan
list_tree
get_node
find_nodes
find_by_variable
find_by_request
find_disabled_nodes
explain_execution_flow
get_plan_language
export_plan_language
import_plan_language
apply_plan_language
validate_plan_language
roundtrip_plan_language
explain_plan_language
compare_plan_language
```

### Acceptance

- Agent can open a real JMX and inspect it compactly.
- Agent can open a real JMX and read its Plan Language projection.
- Agent can ask to read an existing JMX and receive Plan Language instead of XML.
- `get_plan_language(mode=outline)` is the default first-read path for large JMX files.
- `find_nodes` can find Thread Groups and HTTP samplers.
- Query tools do not return raw XML by default.

---

## 18. Phase 15 — Generic mutation engine

### Goal

Apply structural changes safely to canonical AST.

### Build files

```text
packages/core/src/patch/patch-engine.ts
packages/core/src/patch/atomic-transaction.ts
packages/core/src/patch/operations.ts
packages/mcp-server/src/tools/mutation-tools.ts
```

### Tasks

1. Implement AST clone transaction.
2. Implement add/update/delete/move/clone/enable/disable.
3. Implement dry-run.
4. Implement rollback on failure.
5. Rebuild semantic index after patch.
6. Return semantic diff.
7. Expose mutation tools.

### Acceptance

- Adding a generic node works when component descriptor exists.
- Moving a node preserves child tree.
- Deleting a node deletes subtree.
- Dry-run does not mutate current revision.
- Invalid move returns diagnostic.

---

## 19. Phase 16 — Semantic diff engine

### Goal

Return meaningful diffs after every mutation.

### Build files

```text
packages/core/src/diff/semantic-diff.ts
packages/core/src/diff/xml-diff.ts
packages/mcp-server/src/resources/diff-resources.ts
```

### Tasks

1. Compare semantic plans by node ID.
2. Detect add, delete, move, rename, enable/disable, field update.
3. Support subtree diff.
4. Support XML diff on request.
5. Store latest diff by revision.

### Acceptance

- Mutation responses include semantic diff.
- Diff resource returns latest diff.
- XML diff is not default.

---

## 20. Phase 17 — Component registry foundation

### Goal

Add descriptors and adapter routing.

### Build files

```text
packages/core/src/components/registry.ts
packages/core/src/components/descriptor.ts
packages/core/src/components/adapter.ts
packages/core/src/components/adapters/unknown.ts
packages/core/src/components/descriptors/core.ts
```

### Tasks

1. Implement registry.
2. Implement descriptor lookup by XML tag, `testclass`, `guiclass`.
3. Implement unknown adapter.
4. Wire registry into semantic indexer.
5. Add descriptor tests.

### Acceptance

- Known descriptor can be selected.
- Unknown adapter preserves unknown elements.
- Semantic output includes `role` and `type` from descriptors.

---

## 21. Phase 18 — Test Plan, Thread Group, and Controller adapters

### Goal

Type the structural backbone of JMeter plans.

### Build files

```text
packages/core/src/components/adapters/test-plan.ts
packages/core/src/components/adapters/thread-group.ts
packages/core/src/components/adapters/controllers.ts
packages/core/src/components/descriptors/test-plan.ts
packages/core/src/components/descriptors/thread-groups.ts
packages/core/src/components/descriptors/controllers.ts
```

### Tasks

Implement adapters for:

```text
TestPlan
TestFragmentController
ThreadGroup
SetupThreadGroup
PostThreadGroup
LoopController
OnceOnlyController
InterleaveControl
RandomController
RandomOrderController
RecordingController
RunTime
IfController
WhileController
SwitchController
ForeachController
ModuleController
IncludeController
TransactionController
ThroughputController
CriticalSectionController
```

### Acceptance

- Semantic summary extracts threads, ramp-up, loops, duration.
- Controller types appear correctly in execution flow.
- Patches can update thread group fields.
- Fixtures cover each controller.

---

## 22. Phase 19 — HTTP and web config adapters

### Goal

Support the most common API/web test-plan operations with first-class fields.

### Build files

```text
packages/core/src/components/adapters/http-sampler.ts
packages/core/src/components/adapters/http-config.ts
packages/core/src/components/descriptors/http.ts
packages/mcp-server/src/tools/typed/http-tools.ts
```

### Tasks

Implement adapters and tools for:

```text
HTTPSamplerProxy
HTTP Request Defaults
HeaderManager
CookieManager
CacheManager
AuthManager
DNSCacheManager
```

Implement tools:

```text
add_http_request
add_http_defaults
add_header_manager
add_cookie_manager
add_cache_manager
add_auth_manager
```

### Acceptance

- Existing HTTP requests map to method/path/domain/body fields.
- Agent can add GET/POST requests.
- JSON raw body is represented correctly.
- Headers can be added as child manager.
- JMeter validation passes for generated HTTP fixture.

---

## 23. Phase 20 — Data/config adapters

### Goal

Support variables, CSV, JDBC, counters, and common configs.

### Build files

```text
packages/core/src/components/adapters/data-config.ts
packages/core/src/components/adapters/jdbc.ts
packages/core/src/components/descriptors/data-config.ts
packages/mcp-server/src/tools/typed/data-tools.ts
```

### Tasks

Implement adapters and tools for:

```text
Arguments / User Defined Variables
CSVDataSet
CounterConfig
RandomVariableConfig
JDBCDataSource
ConfigTestElement variants
LoginConfig
KeystoreConfig
```

### Acceptance

- Variables are indexed.
- CSV variables are parsed and validated.
- JDBC connection config and sampler references are linked.
- Agent can convert hardcoded host to variable.

---

## 24. Phase 21 — Sampler adapters beyond HTTP

### Goal

Cover JMeter core sampler categories.

### Build files

```text
packages/core/src/components/adapters/samplers.ts
packages/core/src/components/descriptors/samplers.ts
packages/mcp-server/src/tools/typed/sampler-tools.ts
```

### Tasks

Implement adapters for:

```text
FTPSampler
JDBCSampler
JavaSampler
JUnitSampler
LDAPSampler
LDAPExtSampler
JMSSampler variants
MailReaderSampler
SmtpSampler
TCPSampler
SystemSampler
DebugSampler
JSR223Sampler
BeanShellSampler read/update with warning
```

### Acceptance

- Fixtures for each sampler summarize correctly.
- Typed add tools exist for high-value samplers: JDBC, FTP, TCP, JMS, SMTP, JSR223, Debug.
- BeanShell components are supported but flagged as legacy/risky.

---

## 25. Phase 22 — Timer adapters

### Goal

Support timing and throughput controls.

### Build files

```text
packages/core/src/components/adapters/timers.ts
packages/core/src/components/descriptors/timers.ts
packages/mcp-server/src/tools/typed/timer-tools.ts
```

### Tasks

Implement adapters/tools for:

```text
ConstantTimer
UniformRandomTimer
GaussianRandomTimer
PoissonRandomTimer
SyncTimer
ConstantThroughputTimer
PreciseThroughputTimer
JSR223Timer
BeanShellTimer read/update with warning
```

### Acceptance

- Timers summarize delay and randomization fields.
- Policy validator can detect missing timers.
- Generated timers validate through JMeter.

---

## 26. Phase 23 — Assertion adapters

### Goal

Support correctness checks.

### Build files

```text
packages/core/src/components/adapters/assertions.ts
packages/core/src/components/descriptors/assertions.ts
packages/mcp-server/src/tools/typed/assertion-tools.ts
```

### Tasks

Implement adapters/tools for:

```text
ResponseAssertion
JSONPathAssertion
JMESPathAssertion
XPathAssertion
XPath2Assertion
XMLAssertion
XMLSchemaAssertion
HTMLAssertion
MD5HexAssertion
SizeAssertion
DurationAssertion
CompareAssertion
JSR223Assertion
BeanShellAssertion read/update with warning
SMIMEAssertion where dependencies available
```

### Acceptance

- Agent can add status/body/header assertions.
- JSON assertion supports JSONPath and expected value.
- Duration assertion supports milliseconds.
- JMeter validation passes.

---

## 27. Phase 24 — Extractor and processor adapters

### Goal

Support correlation, token extraction, and request manipulation.

### Build files

```text
packages/core/src/components/adapters/extractors.ts
packages/core/src/components/adapters/processors.ts
packages/core/src/components/descriptors/extractors.ts
packages/core/src/components/descriptors/processors.ts
packages/mcp-server/src/tools/typed/extractor-tools.ts
packages/mcp-server/src/tools/typed/processor-tools.ts
```

### Tasks

Implement adapters/tools for:

```text
RegexExtractor
JSONPostProcessor / JSON Extractor
JMESPathExtractor
BoundaryExtractor
XPathExtractor
XPath2Extractor
CSS/JQuery Extractor
JSR223PreProcessor
JSR223PostProcessor
JDBCPreProcessor
UserParameters
HTMLLinkParser
URLRewritingModifier
ResultAction
DebugPostProcessor
BeanShell variants with warning
```

### Acceptance

- Agent can add JSON extractor for token.
- Extracted variables appear in variable index.
- Processor placement validation works.

---

## 28. Phase 25 — Listener and report collector adapters

### Goal

Support listeners and CI-safe warnings.

### Build files

```text
packages/core/src/components/adapters/listeners.ts
packages/core/src/components/descriptors/listeners.ts
packages/mcp-server/src/tools/typed/listener-tools.ts
```

### Tasks

Implement adapters/tools for:

```text
ResultCollector generic
SimpleDataWriter
SummaryReport
AggregateReport
AggregateGraph
ViewResultsTree
ViewResultsFullVisualizer
TableVisualizer
BackendListener
GraphVisualizer if encountered
MailerVisualizer if encountered
```

### Acceptance

- Listener fields and save config summarize.
- View Results Tree enabled emits policy warning in CI/load mode.
- Backend Listener config is represented.

---

## 29. Phase 26 — Raw full-fidelity tools

### Goal

Guarantee operability for unsupported and plugin components.

### Build files

```text
packages/mcp-server/src/tools/raw-tools.ts
packages/core/src/patch/raw-property-patch.ts
```

### Tasks

Implement tools:

```text
get_raw_element
get_raw_properties
add_raw_element
update_raw_property
replace_raw_element
validate_raw_patch
generate_raw_template
```

### Acceptance

- Unknown element raw properties can be inspected.
- Raw property patch validates XML and hashTree shape.
- Raw tools are clearly named and return warnings.
- Unknown plugin fixture is preserved after unrelated edits.

---

## 30. Phase 27 — Dynamic component catalog

### Goal

Discover and expose components beyond built-in descriptors.

### Build files

```text
packages/java-bridge/src/main/java/io/jmxpls/bridge/jmeter/ComponentCatalogCommand.java
packages/core/src/catalog/catalog-loader.ts
packages/core/src/catalog/catalog-merge.ts
packages/mcp-server/src/tools/catalog-tools.ts
packages/mcp-server/src/resources/catalog-resources.ts
```

### Tasks

1. Inspect JMeter SaveService mappings.
2. Discover loaded JMeter classes where feasible.
3. Generate catalog entries for unknown test classes found in open plans.
4. Merge built-in and dynamic catalogs.
5. Expose catalog resources and tools.

Tools:

```text
load_component_catalog
refresh_component_catalog
inspect_component_schema
list_component_types
get_component_defaults
export_component_catalog
import_component_catalog
```

### Acceptance

- Catalog reports JMeter version and classpath fingerprint.
- Plugin classes are visible when jars are loaded.
- Unknown JMX nodes can link to dynamic descriptors.

---

## 31. Phase 28 — Static validation engine

### Goal

Validate plans without requiring JMeter first.

### Build files

```text
packages/core/src/validation/validator.ts
packages/core/src/validation/xml-rules.ts
packages/core/src/validation/hash-tree-rules.ts
packages/core/src/validation/semantic-rules.ts
packages/core/src/validation/component-rules.ts
packages/mcp-server/src/tools/validation-tools.ts
```

### Tasks

Implement:

```text
validate_plan
validate_tree
validate_hash_tree
validate_component_schema
validate_variables
validate_files
```

Rules:

- Thread Group placement.
- Controllers/samplers under thread group or valid fragment/module structure.
- Assertions/processors/timers/config placement.
- Required fields.
- Missing files.
- Variable references.
- Duplicate variable warnings.

### Acceptance

- Malformed fixtures produce expected errors.
- Valid fixtures produce no blocking errors.
- Diagnostics include node IDs and fix suggestions.

---

## 32. Phase 29 — JMeter validation integration

### Goal

Make JMeter-backed validation available from MCP.

### Build files

```text
packages/core/src/validation/jmeter-rules.ts
packages/mcp-server/src/tools/validation-tools.ts
```

### Tasks

Implement:

```text
validate_with_jmeter
roundtrip_validate
```

Validation modes:

```text
load
loadSave
loadSaveReload
```

### Acceptance

- Valid fixtures pass JMeter validation.
- Missing plugin fixture fails strict validation with actionable plugin-class diagnostic.
- Round-trip output can be re-opened.

---

## 33. Phase 30 — Policy and security validation

### Goal

Detect performance and safety risks.

### Build files

```text
packages/core/src/validation/policy-rules.ts
packages/core/src/validation/security-rules.ts
packages/mcp-server/src/security/redaction.ts
```

### Tasks

Implement policy checks:

```text
View Results Tree enabled
Functional Testing enabled for load mode
No ramp-up
No termination in CI
No timers
No assertions
No HTTP timeouts
Hardcoded hosts
Hardcoded credentials
Suspicious scripts
Dangerous file paths
```

### Acceptance

- CI profile flags risky listeners.
- Secret-like fields are redacted.
- Hardcoded values can be converted by template/tool later.

---

## 34. Phase 31 — Save/export tools

### Goal

Safely persist plans.

### Build files

```text
packages/core/src/io/atomic-writer.ts
packages/core/src/io/backup.ts
packages/mcp-server/src/tools/session-tools.ts
```

### Tasks

Implement:

```text
save_plan
save_plan_as
export_plan
backup_plan
```

Save flow:

```text
serialize temp
validate temp
backup target
atomic rename
write sidecar
return diff + revision
```

### Acceptance

- Save never corrupts original on validation failure.
- Backup is created.
- Sidecar updates.
- Saved JMX reloads through parser.

---

## 35. Phase 32 — Execution engine

### Goal

Run JMeter safely in non-GUI mode.

### Build files

```text
packages/core/src/runs/jmeter-command.ts
packages/core/src/runs/run-manager.ts
packages/mcp-server/src/tools/execution-tools.ts
packages/mcp-server/src/resources/run-resources.ts
```

### Tasks

Implement:

```text
run_jmeter
stop_run
get_run_status
get_run_logs
export_run_artifacts
```

Security:

- Use argument array, never shell string.
- Validate paths.
- Allowlist flags.
- Support timeout and cancellation.

### Acceptance

- Minimal plan can run in CLI mode when JMeter available.
- Logs are captured.
- Cancellation works.
- Unsafe path is rejected.

---

## 36. Phase 33 — JTL parser and report tools

### Goal

Analyze JMeter outputs.

### Build files

```text
packages/core/src/runs/jtl-parser.ts
packages/core/src/runs/metrics.ts
packages/core/src/runs/report-generator.ts
packages/mcp-server/src/tools/execution-tools.ts
```

### Tasks

Implement:

```text
analyze_jtl
generate_html_report
compare_jtl
check_sla
```

Metrics:

```text
samples
errors
error rate
throughput
avg
median
p90
p95
p99
min
max
bytes
response code groups
sampler groups
```

### Acceptance

- JTL CSV fixture is parsed.
- SLA checker returns pass/fail.
- HTML report generation calls JMeter safely.

---

## 37. Phase 34 — Template engine

### Goal

Generate common test-plan patterns through semantic patches.

### Build files

```text
packages/core/src/templates/registry.ts
packages/core/src/templates/http-api.ts
packages/core/src/templates/login-flow.ts
packages/core/src/templates/load-profiles.ts
packages/mcp-server/src/tools/template-tools.ts
```

### Tasks

Implement templates:

```text
blank_test_plan
http_api_baseline
http_api_login_bearer_token
csv_driven_login_flow
crud_api_flow
constant_load_profile
ramp_load_profile
spike_load_profile
stress_load_profile
soak_load_profile
jmeter_ci_artifact_profile
backend_listener_influxdb_profile
jdbc_query_test
jms_point_to_point_test
tcp_smoke_test
```

Tools:

```text
list_templates
get_template
instantiate_template
create_http_api_plan
create_login_flow
create_bearer_token_flow
create_crud_flow
create_csv_driven_flow
prepare_plan_for_ci
convert_hardcoded_values_to_variables
disable_gui_only_listeners
```

### Acceptance

- Each template produces a semantic patch.
- Each instantiated template validates with static validation.
- High-priority templates validate with JMeter.

---

## 38. Phase 35 — MCP prompts

### Goal

Guide agents toward safe workflows.

### Build files

```text
packages/mcp-server/src/prompts/registry.ts
packages/mcp-server/src/prompts/plan-review.ts
packages/mcp-server/src/prompts/prepare-ci.ts
packages/mcp-server/src/prompts/add-login-flow.ts
packages/mcp-server/src/prompts/debug-failure.ts
```

### Tasks

Implement prompts:

```text
jmeter_plan_review
jmeter_plan_add_login_flow
jmeter_plan_prepare_for_ci
jmeter_plan_debug_failure
jmeter_plan_extract_variables
jmeter_plan_plugin_recovery
jmeter_plan_from_openapi
jmeter_plan_from_curl_collection
```

### Acceptance

- Prompts are discoverable by MCP client.
- Prompts instruct agent to use compact resources first.
- Prompts instruct agent to validate before saving.

---

## 39. Phase 36 — Large-plan context optimization

### Goal

Keep agent context small for large `.jmx` files.

### Build files

```text
packages/core/src/util/pagination.ts
packages/core/src/semantic/summarizer.ts
packages/mcp-server/src/resources/plan-resources.ts
```

### Tasks

1. Add response byte budgets.
2. Add cursors for tree/node lists.
3. Add depth-limited tree summaries.
4. Add subtree summaries.
5. Add `nextSuggestedResources` everywhere.
6. Add tests with generated large plan.

### Acceptance

- Large plan summary stays compact.
- Tree can be navigated incrementally.
- No default tool returns full XML.

---

## 40. Phase 37 — Plugin test harness

### Goal

Prove plugin and unknown preservation.

### Build files

```text
fixtures/plugins/unknown-plugin.jmx
fixtures/plugins/known-plugin-with-jar.jmx
packages/core/src/testing/plugin-fixtures.ts
```

### Tasks

1. Add fixture with unavailable plugin class.
2. Add fixture with available plugin jar if possible.
3. Test open/summarize/move/save for unknown plugin.
4. Test classpath catalog when plugin jar is available.
5. Test strict JMeter validation failure when plugin missing.

### Acceptance

- Unknown plugin JMX survives unrelated edits.
- Missing plugin diagnostic is actionable.
- Loaded plugin appears in catalog.

---

## 41. Phase 38 — Compatibility matrix

### Goal

Validate across JMeter versions and operating systems.

### Build files

```text
.github/workflows/compatibility.yml
scripts/download-jmeter.ts
scripts/run-compatibility.ts
```

### Tasks

1. Add JMeter version matrix.
2. Download and verify JMeter artifacts.
3. Run bridge validation for fixtures.
4. Run serializer round-trip.
5. Run selected CLI tests.
6. Store compatibility reports.

### Acceptance

- Compatibility report lists pass/fail by JMeter version.
- Known incompatibilities are documented.
- Latest configured JMeter version is tested.

---

## 42. Phase 39 — Security hardening

### Goal

Make the MCP server safe enough for local agent use and CI.

### Build files

```text
packages/mcp-server/src/security/workspace-guard.ts
packages/mcp-server/src/security/tool-policy.ts
packages/mcp-server/src/security/redaction.ts
packages/core/src/security/path.ts
packages/core/src/security/secrets.ts
```

### Tasks

1. Enforce workspace roots.
2. Normalize all paths.
3. Reject path traversal.
4. Redact secret-like values.
5. Gate execution tools.
6. Add audit log.
7. Add prompt-injection labels for untrusted plan/script text.
8. Add security tests.

### Acceptance

- Unsafe paths are rejected.
- Secrets are redacted in summaries and logs.
- Run tools cannot execute arbitrary commands.
- Audit log records mutations and runs.

---

## 43. Phase 40 — End-to-end MCP tests

### Goal

Verify real agent workflows through MCP, not only internal APIs.

### Build files

```text
packages/mcp-server/test/e2e/
```

### Tasks

Create E2E tests:

```text
open and summarize plan
add login flow
prepare plan for CI
preserve unknown plugin
validate and save
run CLI smoke test
analyze JTL
```

### Acceptance

- E2E tests use MCP tool calls.
- E2E tests verify returned resources and semantic diffs.
- No E2E test requires raw XML editing.

---

## 44. Phase 41 — Documentation

### Goal

Make the project usable by agents and humans.

### Build files

```text
README.md
docs/architecture.md
docs/install.md
docs/mcp-tools.md
docs/component-adapters.md
docs/plugin-support.md
docs/validation.md
docs/security.md
docs/ci.md
docs/examples.md
```

### Tasks

1. Document setup.
2. Document MCP client config.
3. Document all tools and resources.
4. Document validation modes.
5. Document plugin classpath behavior.
6. Document examples.
7. Document troubleshooting.

### Acceptance

- A new agent can use docs to open and mutate a plan.
- A human can run examples.
- CI example works.

---

## 45. Phase 42 — Packaging

### Goal

Prepare installable artifacts.

### Build files

```text
Dockerfile
bin/jmxpls
packages/mcp-server/package.json
packages/java-bridge/build.gradle.kts
.github/workflows/release.yml
```

### Tasks

1. Package MCP server.
2. Package Java bridge jar.
3. Add postinstall or runtime bridge resolution.
4. Build Docker image.
5. Add release workflow.
6. Add checksum generation.

### Acceptance

- Package can be installed and run locally.
- Docker image can run validation on mounted workspace.
- Release artifacts include server and bridge.

---

## 46. Phase 43 — Final release gate

### Goal

Prove the final system meets full-fidelity support requirements.

### Required checks

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:fuzz
pnpm test:compatibility
./gradlew test
security test suite
large plan performance suite
plugin preservation suite
```

### Release acceptance

- All core JMeter component categories have typed adapters or documented dynamic/raw fallback.
- Unknown/plugin nodes are preserved by default.
- JMeter-backed validation passes for generated representative plans.
- MCP tools/resources/prompts are documented.
- Execution engine is non-GUI and allowlisted.
- CI examples work.
- No raw XML is required for normal agent workflows.

---

## 47. Component adapter completion checklist

For each component adapter, complete:

```text
[ ] Descriptor
[ ] Semantic schema
[ ] Default JMX fixture
[ ] Existing JMX fixture
[ ] toSemantic mapping
[ ] fromSemantic mapping
[ ] patch mapping
[ ] validation rules
[ ] compact summary fields
[ ] typed tool if high-value
[ ] round-trip test
[ ] JMeter validation test
[ ] docs entry
```

---

## 48. Tool completion checklist

For each MCP tool, complete:

```text
[ ] Input schema
[ ] Output schema
[ ] Success test
[ ] Invalid input test
[ ] Diagnostic failure test
[ ] Security/path test if relevant
[ ] Dry-run test if mutation
[ ] Semantic diff test if mutation
[ ] Documentation
[ ] Example call
```

---

## 49. Validation completion checklist

For each validator, complete:

```text
[ ] Diagnostic code
[ ] Severity
[ ] Message
[ ] Node/path mapping
[ ] Fix suggestion
[ ] Positive fixture
[ ] Negative fixture
[ ] Documentation
```

---

## 50. Suggested first coding prompts for the agent

Use these in order.

### Prompt 1

```text
Read requirements.md, design.md, and plan.md. Create the monorepo skeleton exactly as Phase 1 specifies. Do not implement product logic yet. Add placeholder tests that pass.
```

### Prompt 2

```text
Implement Phase 2 shared schemas and result types. Add JSON schema fixtures and validation tests. Keep public types stable and documented.
```

### Prompt 3

```text
Implement Phase 3 XML loader and source mapping. Add fixtures for valid minimal JMX and malformed XML. Ensure no raw XML content is exposed by default outside parser tests.
```

### Prompt 4

```text
Implement Phase 4 canonical JMX AST and hashTree parser. Add malformed hashTree fixtures and diagnostics. Ensure every element/hashTree pair is represented by JmxPairNode.
```

### Prompt 5

```text
Implement Phase 5 lossless serializer and structural equivalence tests. Prove minimal and unknown-node fixtures round-trip.
```

Continue phase by phase until Phase 43 is complete.

---

## 51. Done definition

The implementation is done when a coding agent can perform this full workflow without raw XML editing:

```text
open existing complex plugin-heavy JMX
summarize compactly
find target thread group
add login + token extraction
add authenticated request
update load profile
prepare for CI
validate static rules
validate with JMeter load/save
save atomically
run JMeter CLI
analyze JTL
return semantic diff and report summary
preserve all unknown plugin content
```
