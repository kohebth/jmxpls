# MCP Tools

The server exposes session, query, Plan Language, mutation, validation, execution, template, and typed component tools. Tools are schema-first and avoid raw XML unless a raw tool is explicitly requested.

## Resources

Resources provide read-only, progressive disclosure views for plans, catalogs, runs, and diffs.

- `jmxpls://plans/{planId}/summary`, `/tree`, `/execution-flow`, `/diagnostics`, and `/plan-language/{mode}` expose opened plan views.
- `jmxpls://plans/{planId}/diff/semantic` exposes the latest semantic diff after a mutation.
- `jmxpls://catalog`, `/summary`, `/types`, and `/types/{type}` expose the active component catalog, including imported descriptors.
- `jmxpls://runs`, `/runs/{runId}`, `/runs/{runId}/logs`, and `/runs/{runId}/artifacts` expose in-memory planned run records.
- Raw XML and XML diff views are explicit resources only; normal workflows should use semantic or Plan Language resources.

## Sessions and Queries

- `open_plan` opens a `.jmx` file and returns a `planId`, compact summary, diagnostics, and default resource URI.
- `list_tree`, `get_node`, `find_nodes`, `find_by_variable`, `find_by_request`, and `find_disabled_nodes` inspect the semantic tree without returning raw XML.
- `explain_execution_flow` returns the effective execution order from the semantic plan.

## Plan Language

- `get_plan_language` and `export_plan_language` project an opened plan into `outline`, `flow`, `semantic`, or `full` modes.
- `validate_plan_language`, `roundtrip_plan_language`, `explain_plan_language`, and `compare_plan_language` validate and compare compact plan-language documents.

## Semantic Mutations

Use `add_node`, `update_node_field`, `delete_node`, `move_node`, `clone_node`, `enable_node`, `disable_node`, or `apply_semantic_patch` for generic tree edits. Mutation inputs accept `dryRun` and `validate` where applicable. Save changes with `save_plan` or `save_plan_as`.

## Typed Component Tools

High-value typed tools generate semantic patches for common JMeter elements:

- HTTP/config: `add_http_request`, `add_http_defaults`, `add_header_manager`, `add_cookie_manager`, `add_cache_manager`, `add_auth_manager`
- Data/config: `add_user_variables`, `add_csv_data_set`, `add_counter`, `add_random_variable`, `add_jdbc_data_source`
- Samplers: `add_jdbc_sampler`, `add_ftp_sampler`, `add_tcp_sampler`, `add_jms_sampler`, `add_smtp_sampler`, `add_jsr223_sampler`, `add_debug_sampler`
- Timers/assertions/extractors/processors/listeners use matching `add_*` tool names.

## Validation

- `validate_plan` runs the active static validation suite for an opened `planId`.
- `validate_tree`, `validate_hash_tree`, `validate_component_schema`, `validate_variables`, and `validate_files` return focused diagnostics.
- `get_jmeter_environment` probes the configured Java bridge and reports Java/JMeter availability before JMeter-backed validation.
- `validate_with_jmeter` and `roundtrip_validate` accept either an opened `planId` or a direct JMX path via `path`, `planPath`, or `jmxPath`.
- Path-based JMeter validation uses the Java bridge when `JMXPLS_JAVA_BRIDGE_JAR` is set. Optional settings are `JMXPLS_JAVA_COMMAND` for a non-default Java executable and `JMXPLS_JAVA_BRIDGE_TIMEOUT_MS` for request timeouts.
- Without bridge configuration, path-based validation and `get_jmeter_environment` return `JMX_JMETER_BRIDGE_NOT_CONFIGURED`; session-based validation keeps the static fallback diagnostics.

Examples:

```json
{"name":"get_jmeter_environment","arguments":{}}
```

```json
{"name":"validate_with_jmeter","arguments":{"path":"plans/load-test.jmx","mode":"loadSaveReload","strict":true}}
```

## Execution and Reports

- `run_jmeter` creates a planned non-GUI command record for `jmeter -n -t <planPath> -l <jtlPath>` and returns a `runId`.
- `get_run_status`, `get_run_logs`, `export_run_artifacts`, and `stop_run` operate on in-memory run records.
- `generate_html_report` creates a planned report command for `jmeter -g <jtlPath> -o <outputDir>`.
- `analyze_jtl`, `compare_jtl`, and `check_sla` parse JTL CSV output and return metrics including errors, throughput, percentiles, response codes, and per-label summaries.

Example:

```json
{"name":"check_sla","arguments":{"jtlPath":"results.jtl","maxErrorRate":0.01,"maxP95Ms":750}}
```

## Raw Tools

Raw tools are reserved for unknown/plugin nodes and low-level recovery work. Prefer typed tools when a known component adapter exists.

- `get_raw_element` returns the semantic node plus its `rawRef` and field map.
- `get_raw_properties` returns only the raw field map for a node.
- `add_raw_element` forwards to `add_node` with caller-provided `nodeType` and `fields`.
- `update_raw_property` forwards to `update_node_field`; use `dryRun: true` first for risky edits.
- `replace_raw_element` applies a field-by-field semantic patch from a provided `fields` object.
- `validate_raw_patch` checks raw patch shape before applying it.
- `generate_raw_template` creates a starter field object for plugin/custom elements.

## Catalog Tools

Catalog tools load, refresh, inspect, import, and export component descriptors for typed or plugin-aware workflows.

- `load_component_catalog` and `refresh_component_catalog` load the built-in descriptor set.
- `list_component_types` can filter by role, such as `sampler` or `config`.
- `inspect_component_schema` returns the descriptor for a component type.
- `get_component_defaults` returns starter fields derived from the descriptor.
- `import_component_catalog` merges a JSON catalog object or file path into the active catalog.
- `export_component_catalog` returns the active merged catalog.

## Template Tools

Template tools expose built-in semantic patch templates:

- `http_api_baseline` creates a thread group with HTTP defaults, a health-check request, and a summary listener.
- `http_api_login_bearer_token` adds a login request, JSON token extractor, authorization header manager, and authenticated sample request.
- `csv_driven_login_flow` adds a CSV data set for `username,password`, a login request, and a response assertion.
- `constant_load_profile`, `ramp_load_profile`, `spike_load_profile`, `stress_load_profile`, and `soak_load_profile` create complete HTTP starter flows with scheduled thread groups and profile-specific timers.

- `list_templates`, `get_template`, and `instantiate_template` inspect and instantiate templates.
- `instantiate_template` retargets top-level template operations to the opened plan root when `planId` is supplied; pass `apply: true` to call `apply_semantic_patch`.
- `create_http_api_plan`, `create_login_flow`, `create_bearer_token_flow`, `create_crud_flow`, and `create_csv_driven_flow` are aliases for built-in templates.
- `prepare_plan_for_ci` forwards to GUI-listener disabling.
- `convert_hardcoded_values_to_variables` currently supports host-to-variable conversion through `host` and `variableName`.

Example:

```json
{"name":"instantiate_template","arguments":{"name":"http_api_baseline","planId":"<planId>","dryRun":true,"apply":true}}
```

```json
{"name":"instantiate_template","arguments":{"name":"soak_load_profile","planId":"<planId>","dryRun":true,"apply":true}}
```
