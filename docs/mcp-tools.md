# MCP Tools

The server exposes session, query, Plan Language, mutation, validation, execution, template, and typed component tools. Tools are schema-first and avoid raw XML unless a raw tool is explicitly requested.

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

- `validate_plan` runs the active static validation suite.
- `validate_tree`, `validate_hash_tree`, `validate_component_schema`, `validate_variables`, and `validate_files` return focused diagnostics.
- `validate_with_jmeter` and `roundtrip_validate` currently return static validation plus a bridge-not-configured diagnostic until the Java bridge is wired into runtime execution.

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

Catalog tools load, refresh, inspect, import, and export component descriptors for typed or plugin-aware workflows. Use `inspect_component_schema`, `list_component_types`, and `get_component_defaults` before adding unfamiliar components.
