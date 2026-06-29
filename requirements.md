# jmxpls Requirements

**Project:** JMeter JMX MCP Server  
**Product name:** `jmxpls` — JMeter Plan Language Server over MCP  
**Document type:** Product and system requirements  
**Target state:** Full-fidelity JMeter `.jmx` semantic editing, generation, validation, execution, and analysis for agents  
**Last updated:** 2026-06-28

---

## 1. Product definition

`jmxpls` is an MCP server that treats Apache JMeter `.jmx` test plans as structured, editable, validated test-plan trees instead of raw XML blobs.

The server shall expose compact semantic summaries, typed edit tools, validation diagnostics, execution tools, and report analysis tools to coding agents and IDE agents. The `.jmx` file remains the authoritative JMeter-compatible artifact, but agents should interact primarily with semantic operations and compact views.

### 1.1 One-sentence definition

`jmxpls` is a semantic JMeter test-plan MCP server that parses `.jmx` into a full-fidelity canonical AST, exposes compact summaries and typed edit operations to agents, preserves unknown/plugin JMX content losslessly, validates through JMeter itself, and writes correct `.jmx` without forcing the agent to reason over verbose XML.

### 1.2 Full-fidelity meaning

“Full support” shall mean:

1. **Known JMeter core elements** have typed semantic adapters, schemas, generators, validators, and high-level MCP tools.
2. **Unknown JMeter/plugin elements** are preserved without destructive rewrites and can be inspected, moved, enabled, disabled, cloned, deleted, and patched through raw property tools.
3. **JMeter itself** is used as the final correctness oracle for load/save/serialize validation, CLI validation, and execution compatibility.
4. **Round-trip fidelity** is measured and enforced by golden tests, differential tests, and lossless preservation tests.
5. **Classpath-aware plugin handling** supports external components when the user provides the JMeter home, plugin jars, and dependent libraries.

A static hand-authored list of components is not enough. The architecture must support both typed semantic coverage and dynamic/raw coverage.

---

## 2. Source-grounded constraints

The implementation shall be based on these JMeter and MCP facts:

1. JMeter test plans are tree-like. In JMeter APIs, parent-child relationships are stored through `ListedHashTree`, not directly inside the elements.
2. JMX XML uses `hashTree` pairing; each test element is followed by a `hashTree` that owns that element’s children.
3. JMX node names map to Java classes through JMeter save-service mappings such as `saveservice.properties`.
4. JMeter supports broad protocols and plugin extension points, so the server must not assume HTTP-only plans.
5. JMeter load tests should be executed through CLI/non-GUI mode, not GUI mode.
6. MCP servers expose capabilities through resources, tools, and prompts; tool calls must have schemas and safe operational boundaries.

Reference URLs are listed in [section 24](#24-reference-urls).

---

## 3. Users and user stories

### 3.1 Primary users

| User | Main problem | Required outcome |
|---|---|---|
| AI coding agent | Raw JMX consumes context and is easy to corrupt | Compact summaries and safe semantic edits |
| Performance engineer | Large JMX plans are slow and error-prone in GUI | Structural search, patching, validation, CI-safe runs |
| QA engineer | Needs repeatable test-plan changes | Typed generation and reproducible semantic diffs |
| Backend engineer | Wants API load tests from endpoint specs | Templates, generators, token extraction, assertions |
| Platform/DevOps engineer | Needs JMeter in CI/CD | Headless validation, execution, report generation, artifact management |
| Plugin-heavy JMeter user | Uses custom JMeter plugins | Lossless plugin preservation and classpath-aware cataloging |

### 3.2 Core user stories

#### US-001 — Open and summarize existing JMX

As an agent, I want to open a large `.jmx` file and receive a compact plan summary so that I can understand the load-test structure without reading raw XML.

Acceptance:

- The agent can open a `.jmx` file.
- The response contains `planId`, plan name, thread groups, samplers, controllers, configs, listeners, warnings, and resource URIs.
- The default response must not include full XML.
- The server preserves the original AST internally.


#### US-001A — Read existing JMX through JMeter Plan Language

As an agent, I want to translate an existing `.jmx` file into compact JMeter Plan Language so that I can understand, discuss, and edit a user's existing test plan without loading raw XML into context.

Acceptance criteria:

- The agent can call `open_plan` on an existing `.jmx` file and then call `get_plan_language`.
- The server can return Plan Language in `outline`, `flow`, `semantic`, or `full` view modes.
- The default Plan Language output contains no raw XML and is safe for agent context.
- `outline` mode summarizes the tree, thread groups, controllers, samplers, configs, timers, assertions, extractors, listeners, variables, and warnings.
- `flow` mode explains execution order in human-readable sequence form.
- `semantic` mode returns an editable typed JSON/YAML representation suitable for semantic patching.
- `full` mode represents all known fields and all unknown/plugin nodes through generic property blocks and `rawRef` handles.
- The server can export `.jmxpls.yaml` or `.jmxpls.json` from an opened `.jmx`.
- The server can import `.jmxpls.yaml` or `.jmxpls.json` to create, replace, or patch a `.jmx` plan.
- Round-trip validation covers `.jmx -> Plan Language -> .jmx`.

#### US-002 — Query the plan tree

As an agent, I want to find JMeter nodes by type, role, name, path, variable usage, request path, method, enabled state, plugin class, and parent/child relationship.

Acceptance:

- `find_nodes` supports exact, fuzzy, regex, and semantic filters.
- Queries can be scoped to subtree.
- Queries return compact results by default and allow `full` or `raw` view on demand.

#### US-003 — Apply safe semantic edits

As an agent, I want to add, update, move, delete, clone, enable, and disable nodes through semantic operations so that I do not edit `hashTree` XML manually.

Acceptance:

- Edits are atomic.
- Edits support dry-run.
- Edits return semantic diffs.
- Edits validate structural constraints before commit unless the caller explicitly uses unsafe raw mode.

#### US-004 — Generate a complete test plan

As an agent, I want to generate a production-grade `.jmx` from a structured intent so that I can create load tests without using the JMeter GUI.

Acceptance:

- The server can create a test plan with variables, thread groups, controllers, samplers, config elements, timers, extractors, assertions, and listeners.
- The generated file loads in JMeter.
- The generated file passes static validation and JMeter load/save validation.

#### US-005 — Preserve unknown plugins

As a plugin-heavy JMeter user, I want unsupported or unknown components to remain intact so that the tool never corrupts a plan containing custom plugins.

Acceptance:

- Unknown tags/classes are stored in canonical AST.
- Unknown properties are preserved.
- Unknown child trees are preserved.
- Unknown nodes can be moved, enabled, disabled, cloned, deleted, and raw-patched.
- Unknown typed generation requires a loaded component catalog or explicit raw element definition.

#### US-006 — Validate with multiple layers

As a performance engineer, I want static, semantic, policy, and JMeter-backed validation so that generated `.jmx` files are trustworthy.

Acceptance:

- The server validates XML shape, `hashTree` pairing, JMeter placement rules, component properties, variables, files, secrets, performance risks, and JMeter load/save compatibility.
- Validation output uses severity levels and machine-readable error codes.
- Each diagnostic points to a node ID, JMX path, and recommended fix.

#### US-007 — Run and analyze JMeter tests

As a CI/CD pipeline, I want to run JMeter in CLI mode and analyze outputs so that performance tests can run without GUI.

Acceptance:

- The server can run `jmeter -n -t <plan> -l <jtl>` with controlled arguments.
- The server can generate HTML dashboard reports.
- The server can parse JTL/CSV results and compute summary metrics.
- Execution tools are guarded by path, command, and resource restrictions.

#### US-008 — Reduce agent context usage

As an agent, I want progressive disclosure so that I only read the smallest relevant context.

Acceptance:

- Resources are split into summary, tree, subtree, node, diagnostics, diff, catalog, schema, and raw XML views.
- Raw XML is never returned by default.
- Large arrays are paginated.
- Responses include `nextSuggestedResources`.

---

## 4. Non-goals

The product shall not:

1. Replace Apache JMeter.
2. Guarantee correctness of a plugin whose jar and dependencies are unavailable.
3. Run arbitrary shell commands beyond a narrow JMeter allowlist.
4. Hide destructive mutations from the user.
5. Treat `.jmxpls` metadata as a replacement for `.jmx`; `.jmx` remains the portable JMeter artifact.
6. Assume all JMeter plans are HTTP-only.

---

## 5. Operating modes

### 5.1 Local stdio MCP mode

Used by desktop IDEs, coding agents, and local automation.

Requirements:

- Expose MCP server over stdio.
- Access only configured workspace roots.
- Use local JMeter installation or bundled bridge.
- Never execute arbitrary shell.

### 5.2 Local HTTP MCP mode

Used by agent platforms that connect over local HTTP.

Requirements:

- Support Streamable HTTP where the selected MCP SDK supports it.
- Require explicit origin/host validation.
- Support optional token auth.
- Disable remote workspace access by default.

### 5.3 CI mode

Used by GitHub Actions, GitLab CI, Jenkins, Buildkite, or internal runners.

Requirements:

- Deterministic non-interactive behavior.
- Machine-readable output.
- Fail builds on configurable validation severities.
- Write `.jmx`, `.jtl`, report, diagnostics, and semantic diff artifacts.

### 5.4 Daemon mode

Used when repeatedly opening many plans or classpath scanning plugin catalogs.

Requirements:

- Long-lived Java bridge process.
- Bounded memory.
- Idle timeout.
- Clean shutdown.

---

## 6. Compatibility requirements

### 6.1 JMeter baseline

- Baseline: Apache JMeter 5.6.3 unless a newer version is explicitly configured.
- Runtime: Java 17 recommended for the project and Java bridge.
- Compatibility matrix shall include JMeter 5.4.x, 5.5.x, 5.6.x, and latest available release supported by project CI.
- The server shall detect the JMeter version from JMeter home or bridge dependency metadata.
- Component catalogs shall be versioned by JMeter version and plugin classpath fingerprint.

### 6.2 JMX format versions

The server shall:

- Read JMX 2.1-style XML with `jmeterTestPlan`, `hashTree`, and test element tags.
- Preserve older JMX where possible.
- Detect and report unsupported legacy formats.
- Preserve XML declaration, encoding, line endings, and relevant attributes when lossless mode is enabled.

### 6.3 Plugin compatibility

The server shall:

- Support user-provided JMeter `lib` and `lib/ext` jars.
- Build component catalogs from active classpath.
- Treat absent plugin classes as unknown preserved nodes.
- Allow catalog import/export.
- Validate plugin nodes through JMeter load/save when plugin classpath is available.

---

## 7. Functional requirements — MCP surface

### 7.1 Resources

The server shall expose resources with stable URI patterns:

```text
jmxpls://plans
jmxpls://plans/{planId}/summary
jmxpls://plans/{planId}/tree
jmxpls://plans/{planId}/tree?depth={n}&cursor={cursor}
jmxpls://plans/{planId}/execution-flow
jmxpls://plans/{planId}/plan-language
jmxpls://plans/{planId}/plan-language/outline
jmxpls://plans/{planId}/plan-language/flow
jmxpls://plans/{planId}/plan-language/semantic
jmxpls://plans/{planId}/plan-language/full
jmxpls://plans/{planId}/plan-language?format=json|yaml&view=outline|flow|semantic|full
jmxpls://plans/{planId}/node/{nodeId}
jmxpls://plans/{planId}/node/{nodeId}/children
jmxpls://plans/{planId}/node/{nodeId}/raw
jmxpls://plans/{planId}/diagnostics
jmxpls://plans/{planId}/diff/semantic
jmxpls://plans/{planId}/diff/xml
jmxpls://plans/{planId}/variables
jmxpls://plans/{planId}/catalog
jmxpls://plans/{planId}/schema/{componentType}
jmxpls://schemas/plan-language
jmxpls://catalogs/current
jmxpls://catalogs/jmeter/{version}
jmxpls://templates
jmxpls://templates/{templateId}
jmxpls://runs/{runId}/summary
jmxpls://runs/{runId}/jtl
jmxpls://runs/{runId}/report
```

Resource requirements:

- All list resources support pagination.
- Raw XML resources require explicit request.
- Node resources support `compact`, `semantic`, `full`, and `raw` variants.
- Large content responses include truncation metadata and a continuation cursor.

### 7.2 Tools

The server shall expose typed tools grouped by domain.

#### 7.2.1 Session and file tools

```text
open_plan
create_plan
close_plan
reload_plan
save_plan
save_plan_as
export_plan
backup_plan
list_open_plans
get_plan_status
```

#### 7.2.2 Summary and query tools

```text
summarize_plan
list_tree
summarize_subtree
get_node
get_node_path
find_nodes
find_by_variable
find_by_request
find_by_component_class
find_disabled_nodes
explain_node
explain_execution_flow
explain_plan_language
compare_plan_language
```

#### 7.2.3 Generic mutation tools

```text
apply_semantic_patch
add_node
update_node
delete_node
move_node
clone_subtree
rename_node
enable_node
disable_node
set_property
unset_property
replace_subtree
```

#### 7.2.4 Raw/full-fidelity tools

```text
get_raw_element
get_raw_properties
add_raw_element
update_raw_property
replace_raw_element
validate_raw_patch
generate_raw_template
```

#### 7.2.4A Plan Language tools

```text
get_plan_language
export_plan_language
import_plan_language
parse_plan_language
apply_plan_language
validate_plan_language
roundtrip_plan_language
compare_plan_language
```

Tool requirements:

- `get_plan_language` reads an opened `.jmx` through the canonical AST and returns a compact Plan Language projection.
- `export_plan_language` writes `.jmxpls.yaml` or `.jmxpls.json`.
- `import_plan_language` creates a new plan or loads a Plan Language file into a session.
- `apply_plan_language` updates an existing JMX-backed session from Plan Language content with `replace`, `merge`, or `patch` mode.
- `validate_plan_language` validates Plan Language against schema and component catalog rules.
- `roundtrip_plan_language` verifies `.jmx -> Plan Language -> .jmx` and reports semantic and raw-preservation deltas.
- Plan Language tools must support `scope`, `depth`, `cursor`, `redaction`, and `viewMode` options.

#### 7.2.5 Typed JMeter tools

Typed tools shall exist for all supported core component classes and high-level patterns. A non-exhaustive list:

```text
create_test_plan
set_test_plan_variables
add_user_defined_variables
add_thread_group
add_setup_thread_group
add_teardown_thread_group
add_loop_controller
add_once_only_controller
add_if_controller
add_while_controller
add_foreach_controller
add_transaction_controller
add_throughput_controller
add_runtime_controller
add_switch_controller
add_random_controller
add_interleave_controller
add_module_controller
add_include_controller
add_http_request
add_graphql_http_request
add_http_defaults
add_header_manager
add_cookie_manager
add_cache_manager
add_auth_manager
add_dns_cache_manager
add_csv_dataset
add_counter
add_random_variable
add_jdbc_connection_config
add_jdbc_request
add_jms_sampler
add_ftp_request
add_tcp_sampler
add_smtp_sampler
add_ldap_sampler
add_java_request
add_junit_request
add_os_process_sampler
add_debug_sampler
add_constant_timer
add_uniform_random_timer
add_gaussian_random_timer
add_poisson_random_timer
add_synchronizing_timer
add_constant_throughput_timer
add_precise_throughput_timer
add_jsr223_timer
add_response_assertion
add_json_assertion
add_jmespath_assertion
add_xpath_assertion
add_xpath2_assertion
add_xml_assertion
add_xml_schema_assertion
add_html_assertion
add_size_assertion
add_duration_assertion
add_jsr223_assertion
add_regex_extractor
add_json_extractor
add_jmespath_extractor
add_boundary_extractor
add_xpath_extractor
add_xpath2_extractor
add_css_selector_extractor
add_jsr223_preprocessor
add_jsr223_postprocessor
add_jsr223_sampler
add_backend_listener
add_summary_report_listener
add_aggregate_report_listener
add_simple_data_writer
add_view_results_tree_listener
```

#### 7.2.6 Validation tools

```text
validate_plan
validate_tree
validate_hash_tree
validate_component_schema
validate_variables
validate_files
validate_security
validate_load_test_policy
validate_with_jmeter
roundtrip_validate
```

#### 7.2.7 Execution and analysis tools

```text
run_jmeter
stop_run
get_run_status
get_run_logs
generate_html_report
analyze_jtl
compare_jtl
check_sla
export_run_artifacts
```

#### 7.2.8 Catalog and schema tools

```text
load_component_catalog
refresh_component_catalog
inspect_component_schema
list_component_types
list_component_roles
get_component_defaults
infer_component_adapter
export_component_catalog
import_component_catalog
```

#### 7.2.9 Template and workflow tools

```text
list_templates
get_template
instantiate_template
create_http_api_plan
create_login_flow
create_bearer_token_flow
create_crud_flow
create_csv_driven_flow
create_spike_test_profile
create_stress_test_profile
create_soak_test_profile
prepare_plan_for_ci
convert_hardcoded_values_to_variables
disable_gui_only_listeners
```

### 7.3 Prompts

The server shall expose reusable prompts for agents:

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

Prompt requirements:

- Prompts must guide the agent to use semantic tools before raw XML.
- Prompts must warn when a requested action needs user credentials, secrets, or destructive changes.
- Prompts must recommend validation after edits.

---

## 8. Functional requirements — canonical model

### 8.1 Canonical JMX AST

The server shall parse every opened JMX into a canonical AST that preserves:

- XML declaration.
- Root `jmeterTestPlan` attributes.
- Element order.
- `hashTree` pairing.
- Test element attributes: `guiclass`, `testclass`, `testname`, `enabled`.
- All property elements and their exact names.
- All property types.
- Empty `hashTree` nodes.
- Unknown tags.
- Plugin-specific XML.
- XML escaping behavior.
- Comments where supported by parser mode.
- Source position where available.

### 8.2 Semantic View Model

The server shall map canonical nodes to compact semantic roles:

```text
plan
thread_group
controller
sampler
config
timer
assertion
pre_processor
post_processor
listener
reporter
workbench_or_fragment
unknown
```

Each semantic node shall expose:

```ts
type NodeSummary = {
  id: string;
  stableId?: string;
  jmxPath: string;
  role: string;
  type: string;
  testClass?: string;
  guiClass?: string;
  name: string;
  enabled: boolean;
  childrenCount: number;
  compactFields: Record<string, unknown>;
  warnings?: Diagnostic[];
};
```


### 8.3 Identity model

JMX has no stable node IDs. The server shall maintain stable IDs with sidecar metadata by default.

Sidecar file:

```text
<plan>.jmxpls.meta.json
```

Sidecar content:

```json
{
  "version": "1.0",
  "planFingerprint": "sha256:...",
  "jmeterVersion": "5.6.3",
  "nodes": {
    "node_http_login": {
      "jmxPath": "/jmeterTestPlan/hashTree/TestPlan[0]/ThreadGroup[0]/HTTPSamplerProxy[1]",
      "fingerprint": "sha256:...",
      "semanticRole": "sampler",
      "lastKnownName": "POST /login"
    }
  }
}
```

Requirements:

- Sidecar is optional.
- If missing, the server generates session IDs.
- If stale, the server repairs identity mapping using fingerprints and path similarity.
- The `.jmx` file remains valid without the sidecar.

---

### 8.4 JMeter Plan Language

JMeter Plan Language, abbreviated as JPL, is the agent-facing serialized projection of an opened JMX plan. It is not a replacement for `.jmx`; it is the compact language agents use to read, reason about, edit, diff, and review a plan.

Conversion pipeline:

```text
existing .jmx
  -> XML loader
  -> canonical JMX AST
  -> semantic index
  -> JMeter Plan Language projection
  -> agent reads or edits
  -> semantic patch / Plan Language import
  -> canonical JMX AST
  -> JMeter-validated .jmx
```

Supported Plan Language formats:

```text
.jmxpls.yaml
.jmxpls.json
application/vnd.jmxpls.plan+yaml
application/vnd.jmxpls.plan+json
```

Supported view modes:

| View mode | Purpose | Default raw XML exposure |
|---|---|---|
| `outline` | Smallest tree summary for first read | None |
| `flow` | Execution-order explanation for test-plan review | None |
| `semantic` | Editable typed representation for agent patches | None |
| `full` | Full-fidelity projection including unknown/plugin metadata | No inline raw XML; uses `rawRef` |

Minimal Plan Language shape:

```yaml
jmxplsVersion: 1
source:
  type: jmx
  fingerprint: sha256:...
  jmeterVersion: 5.6.3
plan:
  id: plan
  name: API Load Test
  variables:
    BASE_URL: https://api.example.com
  threadGroups:
    - id: tg_main
      name: Main Load
      enabled: true
      users: 500
      rampUp: 300s
      loop: forever
      children:
        - id: http_login
          kind: sampler.http
          name: POST /login
          method: POST
          path: /api/login
          body:
            mode: json
            value:
              username: ${username}
              password: ${password}
          postProcessors:
            - kind: extractor.json
              variable: TOKEN
              jsonPath: $.token
        - id: http_profile
          kind: sampler.http
          name: GET /profile
          method: GET
          path: /api/profile
          headers:
            Authorization: Bearer ${TOKEN}
unknownComponents:
  - id: plugin_1
    role: unknown
    testClass: com.example.jmeter.CustomSampler
    guiClass: com.example.jmeter.CustomSamplerGui
    name: Custom plugin sampler
    enabled: true
    rawRef: raw://plugin_1
    propertiesPreview:
      sampleField: sampleValue
warnings:
  - code: VIEW_RESULTS_TREE_ENABLED
    nodeId: listener_1
    message: View Results Tree is enabled.
```

Requirements:

- Plan Language generation must work for every valid opened `.jmx`, even when typed adapters do not exist.
- Unknown/plugin components must be represented with generic metadata, `rawRef`, class names, fingerprints, enabled state, test name, and compact property previews.
- `outline` mode must be small enough for agents to read large plans without loading full XML.
- `semantic` mode must be suitable as input to `apply_semantic_patch`.
- `full` mode must preserve enough metadata to recreate the same canonical AST or explicitly report unsupported raw-preservation gaps.
- Generated Plan Language must include stable node IDs from sidecar metadata when available.
- Generated Plan Language must include source fingerprint, JMeter version when known, catalog version, and schema version.
- Sensitive values must be redacted by default in agent-facing Plan Language unless redaction is disabled explicitly.
- Plan Language import must support `new`, `replace`, `merge`, and `patch` modes.
- Plan Language import must run schema validation, structural validation, and optional JMeter-backed validation before save.
- `.jmx -> Plan Language -> .jmx` must be part of the golden test suite.

---

## 9. Functional requirements — parsing and serialization

### 9.1 HashTree parser

The parser shall implement JMeter `hashTree` pairing:

```text
parent hashTree children are encoded as:
  element_1
  hashTree_for_element_1
  element_2
  hashTree_for_element_2
```

Requirements:

- Detect orphan elements.
- Detect orphan `hashTree` nodes.
- Detect odd child counts.
- Preserve order exactly.
- Support nested controllers and samplers.
- Support empty `hashTree` as a valid child tree.

### 9.2 Serializer

The serializer shall support two modes:

| Mode | Purpose |
|---|---|
| Lossless XML serializer | Preserve original formatting and unknown nodes when possible |
| JMeter canonical serializer | Save through JMeter `SaveService` / bridge for compatibility |

Requirements:

- Default save mode is safe canonical JMeter serialization when JMeter is available.
- Lossless mode is used for minimal patches and unknown plugin preservation.
- All save operations perform validation unless `unsafeSkipValidation` is explicitly true.
- Save failures must not corrupt the original file; write to temp file and atomic rename.

---

## 10. Functional requirements — component catalog

### 10.1 Built-in catalog

The built-in catalog shall include Apache JMeter core components grouped by:

- Test plan and fragments.
- Thread groups.
- Logic controllers.
- Samplers.
- Configuration elements.
- Timers.
- Assertions.
- Pre-processors.
- Post-processors.
- Listeners.
- Non-test elements.

Each descriptor shall contain:

```ts
type ComponentDescriptor = {
  id: string;
  displayName: string;
  role: ComponentRole;
  testClass: string;
  guiClass?: string;
  xmlTagNames: string[];
  propertySchema: JsonSchema;
  semanticFields: SemanticFieldMapping[];
  defaultProperties: Record<string, unknown>;
  allowedParents: ParentPolicy[];
  allowedChildren: ChildPolicy[];
  validationRules: string[];
  jmeterVersions: string[];
  plugin?: {
    groupId?: string;
    artifactId?: string;
    minVersion?: string;
  };
};
```

### 10.2 Dynamic catalog

The server shall dynamically augment catalog entries from:

- JMeter classpath scanning.
- Save-service mappings.
- Existing JMX nodes.
- Known templates.
- User-provided catalog files.

### 10.3 Unknown component behavior

For unknown components:

- Preserve raw XML.
- Summarize best-effort from `testclass`, `guiclass`, `testname`, `enabled`, and property names.
- Expose raw property tree.
- Allow raw patch only with validation and explicit tool name.
- Flag unavailable classes if JMeter validation fails because the plugin is missing.

---

## 11. Functional requirements — typed component support

### 11.1 Test plan and fragments

Required typed adapters:

- `TestPlan`
- `WorkBench` if encountered in older files
- `TestFragmentController`

### 11.2 Thread groups

Required typed adapters:

- `ThreadGroup`
- `SetupThreadGroup`
- `PostThreadGroup`
- Open Model Thread Group when available in installed JMeter/version
- Plugin thread groups through dynamic catalog, including Ultimate and Concurrency Thread Groups when plugin jars are available

### 11.3 Controllers

Required typed adapters:

- Loop Controller
- Once Only Controller
- Interleave Controller
- Random Controller
- Random Order Controller
- Recording Controller
- Runtime Controller
- If Controller
- While Controller
- Switch Controller
- ForEach Controller
- Module Controller
- Include Controller
- Transaction Controller
- Throughput Controller
- Critical Section Controller
- Flow Control Action / Test Action

### 11.4 Samplers

Required typed adapters:

- HTTP Request
- GraphQL HTTP Request GUI mapping when represented as HTTP sampler fields
- FTP Request
- JDBC Request
- Java Request
- JUnit Request
- LDAP Request
- LDAP Extended Request
- JMS Point-to-Point
- JMS Publisher
- JMS Subscriber
- Mail Reader
- SMTP Sampler
- OS Process Sampler
- TCP Sampler
- Debug Sampler
- JSR223 Sampler
- BeanShell Sampler if encountered, with warning to prefer JSR223/Groovy

### 11.5 Config elements

Required typed adapters:

- HTTP Request Defaults
- HTTP Header Manager
- HTTP Cookie Manager
- HTTP Cache Manager
- HTTP Authorization Manager
- DNS Cache Manager
- CSV Data Set Config
- User Defined Variables / Arguments
- Counter
- Random Variable
- JDBC Connection Configuration
- FTP Request Defaults
- LDAP Request Defaults
- TCP Sampler Config
- Login Config Element
- Keystore Configuration
- Simple Config Element

### 11.6 Timers

Required typed adapters:

- Constant Timer
- Uniform Random Timer
- Gaussian Random Timer
- Poisson Random Timer
- Synchronizing Timer
- Constant Throughput Timer
- Precise Throughput Timer
- JSR223 Timer
- BeanShell Timer if encountered, with warning

### 11.7 Assertions

Required typed adapters:

- Response Assertion
- JSON Assertion
- JMESPath Assertion
- XPath Assertion
- XPath2 Assertion
- XML Assertion
- XML Schema Assertion
- HTML Assertion
- MD5Hex Assertion
- Size Assertion
- Duration Assertion
- Compare Assertion
- JSR223 Assertion
- BeanShell Assertion if encountered, with warning
- SMIME Assertion if supported by runtime dependencies

### 11.8 Extractors and post-processors

Required typed adapters:

- Regular Expression Extractor
- JSON Extractor
- JMESPath Extractor
- Boundary Extractor
- XPath Extractor
- XPath2 Extractor
- CSS Selector Extractor
- Result Status Action Handler
- Debug PostProcessor
- JSR223 PostProcessor
- BeanShell PostProcessor if encountered, with warning

### 11.9 Pre-processors

Required typed adapters:

- User Parameters
- HTML Link Parser
- HTTP URL Re-writing Modifier
- JDBC PreProcessor
- JSR223 PreProcessor
- BeanShell PreProcessor if encountered, with warning

### 11.10 Listeners and result collectors

Required typed adapters:

- Simple Data Writer
- Summary Report
- Aggregate Report
- Aggregate Graph
- View Results Tree
- View Results in Table
- Backend Listener
- Graph Results if encountered
- Mailer Visualizer if encountered
- Result Collector generic adapter

Listener requirements:

- Listeners intended only for debugging shall be flagged when enabled in high-load or CI mode.
- The server shall support listener save-configuration fields.

---

## 12. Functional requirements — templates and generation

The server shall provide built-in templates:

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

Template requirements:

- Templates produce valid semantic patches.
- Templates are parameterized by environment variables and JMeter variables.
- Templates include validation rules.
- Templates can be instantiated into an existing plan or new plan.

---

## 13. Functional requirements — validation

### 13.1 Diagnostic model

All validation output shall use:

```ts
type Diagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeId?: string;
  jmxPath?: string;
  propertyPath?: string;
  source?: "xml" | "hashTree" | "semantic" | "jmeter" | "policy" | "security" | "runtime";
  fix?: FixSuggestion;
};
```

### 13.2 Validation layers

| Layer | Required checks |
|---|---|
| XML validation | Well-formed XML, root shape, encoding |
| HashTree validation | Element/hashTree pairing, orphan detection, order |
| Canonical AST validation | IDs, paths, fingerprints, property tree integrity |
| Semantic validation | Parent-child placement, required fields, variable references |
| Component validation | Property schema and known component constraints |
| JMeter validation | Load/save with JMeter libraries or CLI |
| Policy validation | CI/load-test safety, listeners, timers, hardcoded values |
| Security validation | Path traversal, secrets, dangerous scripts, command restrictions |
| Execution validation | JMeter command availability, output path permissions, report config |

### 13.3 Required policy rules

- Warn if View Results Tree is enabled in CI/high-load mode.
- Warn if Test Plan functional testing is enabled for stress/load test.
- Warn if a Thread Group has no ramp-up.
- Warn if a Thread Group has no duration or loop termination in CI mode.
- Warn if no assertions exist under samplers.
- Warn if no timers/think-time exist in high-load HTTP plans.
- Warn if HTTP request lacks connect/response timeout defaults.
- Warn if hostnames or credentials are hardcoded.
- Error if referenced CSV file does not exist unless `allowMissingFiles` is true.
- Error if raw patch would break `hashTree` pairing.
- Error if plugin class is required but unavailable during strict JMeter validation.

---

## 14. Functional requirements — execution and reports

### 14.1 Run engine

The server shall run JMeter through a controlled invocation model:

```text
jmeter -n -t <plan.jmx> -l <result.jtl> [-e -o <html-report-dir>] [safe additional args]
```

Requirements:

- CLI/non-GUI only.
- No arbitrary command injection.
- Allowlist accepted flags.
- Restrict file paths to configured roots.
- Stream logs with bounded buffers.
- Support cancellation.
- Support timeout.
- Capture exit code, stdout, stderr, generated files, and report paths.

### 14.2 JTL analysis

The server shall parse JTL CSV/XML and report:

- Total samples.
- Error rate.
- Throughput.
- Average latency.
- Median latency when available/computable.
- p90, p95, p99.
- Min/max.
- Bytes sent/received where present.
- Error groups by sampler and response code.
- SLA pass/fail.

### 14.3 Report generation

The server shall support:

- Generate HTML dashboard at end of run.
- Generate HTML dashboard from existing JTL.
- Export report artifact manifest.

---

## 15. Functional requirements — semantic diff

Every mutation shall return a semantic diff by default.

Example:

```json
{
  "planId": "p1",
  "revision": 42,
  "changes": [
    {
      "op": "add",
      "nodeId": "n_http_login",
      "parentId": "n_tg_main",
      "role": "sampler",
      "type": "HTTPSamplerProxy",
      "name": "POST /login"
    },
    {
      "op": "update",
      "nodeId": "n_tg_main",
      "field": "threads",
      "before": 100,
      "after": 500
    }
  ],
  "warnings": []
}
```

Diff requirements:

- Semantic diff is default.
- XML diff is available on request.
- Diffs are revisioned.
- Failed dry-runs return proposed diff and blocking diagnostics.

---

## 16. Non-functional requirements

### 16.1 Performance

The server shall:

- Open a 10 MB JMX file within a practical local execution window.
- Keep compact plan summaries under configurable token/byte budgets.
- Avoid returning full XML unless requested.
- Cache component catalogs.
- Cache semantic indexes.
- Use pagination for large trees and result files.

### 16.2 Reliability

The server shall:

- Never overwrite a `.jmx` without backup or atomic write.
- Preserve unknown components in default mode.
- Include crash recovery for open sessions.
- Mark dirty plans clearly.
- Return recoverable errors where possible.

### 16.3 Security

The server shall:

- Restrict all file operations to configured roots.
- Normalize and validate paths.
- Redact secrets in summaries and logs.
- Treat JSR223/BeanShell script contents as sensitive/dangerous.
- Require explicit confirmation for execution tools when the host supports confirmation.
- Maintain an audit log of mutations and runs.
- Disable arbitrary shell.
- Validate MCP tool inputs with schemas.
- Avoid prompt-injection through untrusted JMX content by labeling raw plan text as untrusted data.

### 16.4 Observability

The server shall emit:

- Structured logs.
- Operation IDs.
- Plan revision IDs.
- Timing per stage: parse, index, validate, save, run.
- Java bridge health status.
- Catalog fingerprint.

---

## 17. API response requirements

All tools shall return:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  diagnostics?: Diagnostic[];
  semanticDiff?: SemanticDiff;
  warnings?: string[];
  nextSuggestedResources?: string[];
  revision?: number;
};
```

Error results shall include:

- Machine-readable error code.
- Human-readable message.
- Recoverability flag.
- Suggested fix.
- Relevant node IDs and paths.

---

## 18. File artifact requirements

The project shall support these files:

```text
*.jmx                         # JMeter test plan
*.jmxpls.meta.json             # sidecar stable identity and fingerprints
*.jmxpls.catalog.json          # optional catalog export
*.jmxpls.patch.json            # semantic patch
*.jmxpls.plan.json             # exported Plan Language JSON projection
*.jmxpls.plan.yaml             # exported Plan Language YAML projection
*.jtl                          # JMeter result log
jmeter-report/                 # generated HTML report
jmeter.properties              # optional property inputs
user.properties                # optional property inputs
system.properties              # optional property inputs
```

---

## 19. Testing requirements

### 19.1 Golden test corpus

The project shall maintain JMX fixtures for:

- Minimal plan.
- HTTP API plan.
- Login + token extraction.
- CSV-driven plan.
- JDBC plan.
- JMS plan.
- FTP plan.
- TCP plan.
- JSR223-heavy plan.
- Controller-heavy plan.
- Listener-heavy plan.
- Plugin-heavy plan.
- Unknown class plan.
- Malformed hashTree plan.
- Large generated plan.

### 19.2 Round-trip tests

For every fixture:

1. Load JMX.
2. Build canonical AST.
3. Serialize lossless mode.
4. Compare structural equivalence.
5. Load through JMeter bridge.
6. Save through JMeter bridge.
7. Reload and compare semantic equivalence.

### 19.3 Mutation tests

Each tool must have tests for:

- Dry-run success.
- Dry-run diagnostic failure.
- Apply success.
- Apply rollback on failure.
- Semantic diff accuracy.
- JMeter validation after mutation.

### 19.4 Fuzz tests

The parser and patch engine shall use fuzz/property-based tests for:

- Random valid `hashTree` structures.
- Unknown XML property combinations.
- Random node movements.
- Invalid/odd `hashTree` sequences.
- Escaped XML content.

---

## 20. Acceptance criteria for final product

The final product is accepted when:

1. It can open, summarize, query, mutate, validate, save, and run representative JMeter plans across all JMeter core component categories.
2. It preserves unknown/plugin nodes in lossless mode.
3. It validates final `.jmx` through JMeter load/save and CLI dry execution where configured.
4. It provides a dynamic component catalog and raw fallback for unsupported components.
5. It exposes MCP resources, tools, and prompts with strict schemas.
6. It passes golden, round-trip, mutation, fuzz, CI, and compatibility tests.
7. It includes examples and AGENTS.md guidance for coding agents.

---

## 21. Implementation constraints

Recommended architecture:

```text
TypeScript MCP server
+ TypeScript core semantic/index/diff layer
+ Java bridge for JMeter SaveService/load/save/catalog/run validation
+ XML AST layer for lossless preservation and source mapping
```

Recommended baseline packages:

```text
TypeScript:
- @modelcontextprotocol/server or production-stable MCP SDK package/version
- zod
- fast-xml-parser or saxes + xmlbuilder2
- uuid or deterministic ID package
- diff
- pino

Java:
- Apache JMeter core and component dependencies
- Jackson
- Picocli or custom stdin/stdout JSON command loop
- JUnit 5
```

---

## 22. Risk requirements

| Risk | Required mitigation |
|---|---|
| JMX corruption | Lossless AST, atomic writes, backups, round-trip tests |
| Plugin incompatibility | Unknown passthrough, classpath catalog, JMeter-backed validation |
| Raw XML context explosion | Progressive resources, compact summaries, pagination |
| Invalid hashTree edits | No direct XML editing by default, paired parser, structural validator |
| Dangerous script execution | Script redaction, explicit validation, run gating, no arbitrary shell |
| MCP over-permission | Root restrictions, allowlisted tools, audit logs, confirmation where supported |
| Version drift | JMeter version matrix and generated catalogs |

---

## 23. AGENTS.md requirement

The repository shall include this guidance:

```text
For JMeter plans:
- Prefer jmxpls MCP over raw .jmx editing.
- Never load a full .jmx into context unless explicitly needed.
- Use summarize_plan, list_tree, find_nodes, and get_node compact views first.
- Use semantic patch tools for edits.
- Use typed component tools for known components.
- Use raw property tools only for unsupported/plugin components.
- Always run validate_tree after structural edits.
- Run validate_with_jmeter before finalizing generated .jmx when JMeter is available.
- Treat .jmx as a serialized artifact; preserve unknown plugin nodes.
- Return semantic diff before raw XML diff.
```

---

## 24. Reference URLs

- Apache JMeter overview: https://jmeter.apache.org/
- Apache JMeter component reference: https://jmeter.apache.org/usermanual/component_reference.html
- Apache JMeter elements of a test plan: https://jmeter.apache.org/usermanual/test_plan.html
- Apache JMeter programmatic test-plan guide: https://jmeter.apache.org/usermanual/build-programmatic-test-plan.html
- Apache JMeter getting started / CLI guidance: https://jmeter.apache.org/usermanual/get-started.html
- Apache JMeter dashboard report generation: https://jmeter.apache.org/usermanual/generating-dashboard.html
- Apache JMeter JMX format wiki: https://cwiki.apache.org/confluence/display/jmeter/JmxTestPlan
- Apache JMeter download page: https://jmeter.apache.org/download_jmeter.cgi
- MCP introduction: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP specification 2025-06-18: https://modelcontextprotocol.io/specification/2025-06-18
- MCP tools specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP resources specification: https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- MCP prompts specification: https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
